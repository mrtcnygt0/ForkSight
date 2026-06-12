"""ForkSight ↔ Chess.com Public Data API entegrasyonu.

Bu modül üç şey yapar:

1. Chess.com'un Public Data API'sinden kullanıcı profili, istatistikleri ve
   son oyunlarını çeker (kimlik doğrulaması gerekmez, UA header zorunlu).
2. PGN'leri parse edip final FEN, ECO, opening adı, kazanan, sonlanma
   tipi vb. metadata çıkarır (python-chess kullanır).
3. SQLite'ta `chess_games` ve `user_stats_cache` tablolarını yönetir;
   incremental sync yapar (yalnızca yeni oyunları çeker).

Kullanım:
    sync_user_games(user_id, chess_com_username, limit=50)
    build_weakness_report(user_id)
    get_user_overview(user_id)  → profil paneli için tek atışta tüm veri

Network başarısız olursa fonksiyonlar exception fırlatır; çağıran taraf
HTTPException(502) gibi sarmalamalı.
"""
from __future__ import annotations

import io
import json
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict
from typing import Any, Optional

import chess
import chess.pgn

# ─── HTTP ────────────────────────────────────────────────
# Chess.com Public Data API, kullanıcıyı tanıyabilmek için anlamlı bir
# User-Agent ister; aksi takdirde 403 Forbidden döner.
_UA = "ForkSight/1.0 (+https://forksight.net; contact: support@forksight.net)"
_API_BASE = "https://api.chess.com/pub"
_HTTP_TIMEOUT = 12  # saniye


class ChessComError(Exception):
    """Chess.com API çağrısı başarısız olduğunda fırlatılır."""

    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


def _http_get_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        # 404 → kullanıcı yok, 429 → rate limit
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:200]
        except Exception:
            pass
        raise ChessComError(f"Chess.com {e.code}: {body or e.reason}", status=e.code) from e
    except urllib.error.URLError as e:
        raise ChessComError(f"Chess.com bağlantı hatası: {e.reason}") from e


# ─── Public API çağrıları ────────────────────────────────
def fetch_profile(username: str) -> dict:
    """`/pub/player/{username}` → profil (avatar, country, name…)."""
    u = username.strip().lower()
    return _http_get_json(f"{_API_BASE}/player/{u}")


def fetch_stats(username: str) -> dict:
    """`/pub/player/{username}/stats` → tüm zaman kontrolleri için rating'ler."""
    u = username.strip().lower()
    return _http_get_json(f"{_API_BASE}/player/{u}/stats")


def fetch_archives(username: str) -> list[str]:
    """Aylık arşiv URL listesi (en eskiden en yeniye)."""
    u = username.strip().lower()
    data = _http_get_json(f"{_API_BASE}/player/{u}/games/archives")
    return list(data.get("archives") or [])


def fetch_recent_games(
    username: str,
    per_class_limit: int = 50,
    classes: tuple = ("bullet", "blitz", "rapid", "daily"),
) -> list[dict]:
    """En son oyunları döner — her zaman sınıfı için ayrı kota uygular.

    Önceden: tüm modlar karışık tek bir `limit` (varsayılan 50) ile çekiliyordu.
    Bu nedenle, ör. son ay yoğun bullet oynayan birinin rapid/daily verileri
    hiç çekilemiyordu. Yeni davranış:
      - bullet/blitz/rapid/daily için ayrı ayrı `per_class_limit`'e kadar
        oyun toplanır (kullanıcıda mevcut değilse o sınıf boş kalır).
      - Hepsi dolduğunda arşiv taraması sonlanır.
      - `time_class` listede olmayan oyunlar (chess960 vs.) atlanır.

    Döner: en yeniden eskiye doğru birleştirilmiş liste (sınıf-içi sıralı).
    """
    archives = fetch_archives(username)
    buckets: dict[str, list[dict]] = {c: [] for c in classes}
    for url in reversed(archives):  # en yeni ay önce
        if all(len(buckets[c]) >= per_class_limit for c in classes):
            break
        month = _http_get_json(url)
        games = month.get("games") or []
        # Aylık liste oyunları kronolojik (eski→yeni); biz yeni→eski istiyoruz.
        for g in reversed(games):
            tc = (g.get("time_class") or "").lower()
            if tc not in buckets:
                continue
            if len(buckets[tc]) >= per_class_limit:
                continue
            buckets[tc].append(g)
    # Birleştir — bucket'lar zaten yeni→eski sırada doldu; sınıflar arasında
    # global zaman damgasına göre sıralayalım ki tüketici en yeni oyunu
    # ilk olarak görsün.
    merged: list[dict] = []
    for c in classes:
        merged.extend(buckets[c])
    merged.sort(key=lambda g: int(g.get("end_time") or 0), reverse=True)
    return merged


# ─── İstatistik yardımcıları ─────────────────────────────
def extract_highest_rating(stats: dict) -> Optional[int]:
    """`stats` payload'ından tüm modlardaki en yüksek `last.rating` değerini bul."""
    best = 0
    for key in (
        "chess_rapid",
        "chess_blitz",
        "chess_bullet",
        "chess_daily",
        "chess960_daily",
    ):
        node = stats.get(key) or {}
        last = (node.get("last") or {}).get("rating")
        if isinstance(last, (int, float)) and last > best:
            best = int(last)
        best_node = (node.get("best") or {}).get("rating")
        if isinstance(best_node, (int, float)) and best_node > best:
            best = int(best_node)
    return best or None


# ─── PGN parse ───────────────────────────────────────────
def parse_pgn_metadata(pgn_text: str, my_username: str) -> dict:
    """PGN'den oyun-sonu özetini çıkar.

    Döner:
        final_fen, ply_count, user_color ('w'|'b'|None), result
        ('win'|'loss'|'draw'|None), termination, eco, opening_name,
        white_username, white_rating, black_username, black_rating, end_time.
    """
    out: dict[str, Any] = {
        "final_fen": None,
        "ply_count": 0,
        "user_color": None,
        "result": None,
        "termination": None,
        "eco": None,
        "opening_name": None,
        "white_username": None,
        "white_rating": None,
        "black_username": None,
        "black_rating": None,
        "end_time": None,
    }
    if not pgn_text or not pgn_text.strip():
        return out
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
    except Exception:
        return out
    if game is None:
        return out

    headers = game.headers
    out["eco"] = headers.get("ECO") or None
    out["opening_name"] = headers.get("ECOUrl", "").rsplit("/", 1)[-1].replace("-", " ") or (
        headers.get("Opening") or None
    )
    out["white_username"] = headers.get("White") or None
    out["black_username"] = headers.get("Black") or None
    try:
        out["white_rating"] = int(headers.get("WhiteElo") or 0) or None
    except (TypeError, ValueError):
        out["white_rating"] = None
    try:
        out["black_rating"] = int(headers.get("BlackElo") or 0) or None
    except (TypeError, ValueError):
        out["black_rating"] = None
    out["termination"] = headers.get("Termination") or None

    me = (my_username or "").strip().lower()
    w = (out["white_username"] or "").strip().lower()
    b = (out["black_username"] or "").strip().lower()
    if me and me == w:
        out["user_color"] = "w"
    elif me and me == b:
        out["user_color"] = "b"

    result = headers.get("Result") or ""
    if out["user_color"] == "w":
        out["result"] = {"1-0": "win", "0-1": "loss", "1/2-1/2": "draw"}.get(result)
    elif out["user_color"] == "b":
        out["result"] = {"0-1": "win", "1-0": "loss", "1/2-1/2": "draw"}.get(result)

    # Walk to final position
    board = game.board()
    ply = 0
    node = game
    while node.variations:
        node = node.variation(0)
        try:
            board.push(node.move)
        except Exception:
            break
        ply += 1
    out["ply_count"] = ply
    out["final_fen"] = board.fen()
    return out


# ─── SQLite şema ─────────────────────────────────────────
def ensure_schema(conn: sqlite3.Connection) -> None:
    """`chess_games`, `user_stats_cache` ve `users` ALTER'larını idempotent kur."""
    cur = conn.cursor()
    # users sütunları (eksikleri ekle)
    for col, ddl in (
        ("chess_com_username", "ALTER TABLE users ADD COLUMN chess_com_username TEXT"),
        ("chess_com_verified", "ALTER TABLE users ADD COLUMN chess_com_verified INTEGER DEFAULT 0"),
        ("chess_com_avatar", "ALTER TABLE users ADD COLUMN chess_com_avatar TEXT"),
        ("highest_rating", "ALTER TABLE users ADD COLUMN highest_rating INTEGER"),
        ("streak_count", "ALTER TABLE users ADD COLUMN streak_count INTEGER DEFAULT 0"),
        ("streak_last_date", "ALTER TABLE users ADD COLUMN streak_last_date TEXT"),
        ("avatar_theme", "ALTER TABLE users ADD COLUMN avatar_theme TEXT DEFAULT 'gold'"),
        ("last_synced_at", "ALTER TABLE users ADD COLUMN last_synced_at REAL"),
    ):
        try:
            cur.execute(ddl)
        except sqlite3.OperationalError:
            pass  # zaten var

    cur.execute(
        """CREATE TABLE IF NOT EXISTS chess_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            chess_com_game_id TEXT,
            url TEXT,
            end_time INTEGER,
            time_class TEXT,
            time_control TEXT,
            rated INTEGER,
            rules TEXT,
            white_username TEXT, white_rating INTEGER,
            black_username TEXT, black_rating INTEGER,
            user_color TEXT,
            result TEXT,
            termination TEXT,
            eco TEXT,
            opening_name TEXT,
            pgn TEXT,
            final_fen TEXT,
            ply_count INTEGER,
            fetched_at REAL DEFAULT (strftime('%s','now')),
            UNIQUE(user_id, chess_com_game_id)
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_chess_games_user_end "
        "ON chess_games(user_id, end_time DESC)"
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS user_stats_cache (
            user_id INTEGER PRIMARY KEY,
            total_games INTEGER,
            wins INTEGER,
            losses INTEGER,
            draws INTEGER,
            weak_openings_json TEXT,
            weak_phases_json TEXT,
            updated_at REAL
        )"""
    )

    # ─── Quiz tabloları (Faz 1) ─────────────────────────
    # `puzzles`: kullanıcının kendi oyunlarından üretilen sorular.
    #   solution_uci: " " ile ayrılmış UCI dizisi, ilk hamle kullanıcının
    #   beklenen cevabı; sonrası rakip + devamı (mate sequence için).
    #   type: "mate1" | "mate2" | "mate3" | "best" | "tactic" |
    #         "sac_mate" | "defense" | "promotion" | "endgame"
    #   rating: zorluk (Glicko placeholder, başlangıçta tip bazlı sabit).
    #   themes: ileride doldurulacak (fork, pin, skewer, ...).
    cur.execute(
        """CREATE TABLE IF NOT EXISTS puzzles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            source_game_id INTEGER,
            source_ply INTEGER,
            fen TEXT NOT NULL,
            side_to_move TEXT NOT NULL,
            type TEXT NOT NULL,
            solution_uci TEXT NOT NULL,
            rating INTEGER DEFAULT 1500,
            themes TEXT,
            hint TEXT,
            created_at REAL DEFAULT (strftime('%s','now')),
            played_cnt INTEGER DEFAULT 0,
            solved_cnt INTEGER DEFAULT 0,
            UNIQUE(user_id, fen, type)
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_puzzles_user_type "
        "ON puzzles(user_id, type, played_cnt)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_puzzles_user_rating "
        "ON puzzles(user_id, rating)"
    )

    # `quiz_attempts`: her çözüm denemesinin kaydı (istatistik + spaced
    # repetition için). `correct` 0/1; `used_hint` kademe (0..3);
    # `time_ms` çözüm süresi; `rating_delta` o denemede kullanıcı
    # rating'inin değişimi.
    cur.execute(
        """CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            puzzle_id INTEGER NOT NULL,
            correct INTEGER NOT NULL,
            used_hint INTEGER DEFAULT 0,
            time_ms INTEGER,
            points_delta INTEGER DEFAULT 0,
            rating_delta INTEGER DEFAULT 0,
            created_at REAL DEFAULT (strftime('%s','now'))
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created "
        "ON quiz_attempts(user_id, created_at DESC)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_puzzle "
        "ON quiz_attempts(puzzle_id)"
    )

    # `user_quiz_stats`: özet satır — okuma sık, yazma seyrek; her solve
    # sonrası UPDATE ile güncellenir. Glicko-2 alanları (`rating`, `rd`,
    # `volatility`) Faz 2'de kullanılacak ama şemada hazır duruyor.
    # `daily_goal` / `today_*` / `day_streak` Faz 2.1 — günlük hedef + streak.
    cur.execute(
        """CREATE TABLE IF NOT EXISTS user_quiz_stats (
            user_id INTEGER PRIMARY KEY,
            total_points INTEGER DEFAULT 0,
            rating INTEGER DEFAULT 1200,
            rd REAL DEFAULT 350.0,
            volatility REAL DEFAULT 0.06,
            streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            solved_cnt INTEGER DEFAULT 0,
            attempt_cnt INTEGER DEFAULT 0,
            last_solve_at REAL,
            daily_goal INTEGER DEFAULT 5,
            today_solved INTEGER DEFAULT 0,
            today_date TEXT,
            day_streak INTEGER DEFAULT 0,
            best_day_streak INTEGER DEFAULT 0,
            last_streak_day TEXT,
            updated_at REAL DEFAULT (strftime('%s','now'))
        )"""
    )

    # ─── Şema migration'ları (Faz 2.1 + 2.2) ─────────────
    # `ALTER TABLE ADD COLUMN` SQLite'de IF NOT EXISTS desteklemiyor;
    # mevcut sütunları çekip eksik olanları ekliyoruz.
    def _ensure_columns(table: str, cols: dict[str, str]) -> None:
        existing = {r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()}
        for name, decl in cols.items():
            if name not in existing:
                try:
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
                except Exception as e:
                    print(f"[schema] ALTER {table}.{name} failed: {e}")

    _ensure_columns("user_quiz_stats", {
        "daily_goal": "INTEGER DEFAULT 5",
        "today_solved": "INTEGER DEFAULT 0",
        "today_date": "TEXT",
        "day_streak": "INTEGER DEFAULT 0",
        "best_day_streak": "INTEGER DEFAULT 0",
        "last_streak_day": "TEXT",
        # Glicko-2 (Faz 2.3): eski kullanıcılarda eksik olabilir.
        "rd": "REAL DEFAULT 350.0",
        "volatility": "REAL DEFAULT 0.06",
    })
    # `puzzles`: Leitner spaced-repetition için kutu + sonraki ödev zamanı.
    # Glicko-2 için puzzle başına ayrı RD (rating zaten var).
    _ensure_columns("puzzles", {
        "next_due_at": "REAL DEFAULT 0",
        "box": "INTEGER DEFAULT 0",
        "last_attempt_at": "REAL",
        "rd": "REAL DEFAULT 200.0",
    })
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_puzzles_user_due "
        "ON puzzles(user_id, next_due_at)"
    )

    # Faz 2.3: Günlük Mücadele (her kullanıcı için günlük 5'li seçim).
    # `puzzle_ids` csv, `solved_mask` aynı sırada 0/1 csv (5 hane).
    cur.execute(
        """CREATE TABLE IF NOT EXISTS user_daily_picks (
            user_id INTEGER NOT NULL,
            day TEXT NOT NULL,
            puzzle_ids TEXT NOT NULL,
            solved_mask TEXT NOT NULL DEFAULT '0,0,0,0,0',
            created_at REAL NOT NULL,
            completed_at REAL,
            PRIMARY KEY (user_id, day)
        )"""
    )

    # Faz 3.1: Başarımlar (achievements).
    # Tanımlar koddadır (server.py ACHIEVEMENTS dict). Burada sadece
    # kullanıcının kazandığı rozetler tutulur.
    cur.execute(
        """CREATE TABLE IF NOT EXISTS user_achievements (
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            earned_at REAL NOT NULL,
            PRIMARY KEY (user_id, code)
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_achievements_user "
        "ON user_achievements(user_id, earned_at DESC)"
    )

    # ─── Faz 3.3: Lichess açık bulmaca veritabanı ───────
    # Kaynak: https://database.lichess.org/lichess_db_puzzle.csv.zst
    # `moves`: boşlukla ayrılmış UCI dizisi. İLK hamle rakibin setup
    # hamlesidir (FEN'de side_to_move = rakip). Kullanıcı 2., 4., 6.…
    # hamleleri bulmalı. `themes` virgülle ayrı (mateIn1, fork, pin…).
    cur.execute(
        """CREATE TABLE IF NOT EXISTS lichess_puzzles (
            lichess_id TEXT PRIMARY KEY,
            fen TEXT NOT NULL,
            moves TEXT NOT NULL,
            rating INTEGER NOT NULL,
            rating_dev INTEGER DEFAULT 0,
            popularity INTEGER DEFAULT 0,
            nb_plays INTEGER DEFAULT 0,
            themes TEXT,
            game_url TEXT,
            opening TEXT,
            imported_at REAL DEFAULT (strftime('%s','now'))
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_lichess_puzzles_rating "
        "ON lichess_puzzles(rating)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_lichess_puzzles_pop "
        "ON lichess_puzzles(popularity DESC)"
    )

    # Lichess çözüm denemeleri (puzzles tablosundan ayrı; lichess_id TEXT).
    cur.execute(
        """CREATE TABLE IF NOT EXISTS lichess_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lichess_id TEXT NOT NULL,
            correct INTEGER NOT NULL,
            used_hint INTEGER DEFAULT 0,
            time_ms INTEGER,
            points_delta INTEGER DEFAULT 0,
            rating_delta INTEGER DEFAULT 0,
            created_at REAL DEFAULT (strftime('%s','now'))
        )"""
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_lichess_attempts_user "
        "ON lichess_attempts(user_id, created_at DESC)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_lichess_attempts_user_pid "
        "ON lichess_attempts(user_id, lichess_id)"
    )

    conn.commit()


# ─── Sync ────────────────────────────────────────────────
def _extract_game_id_from_url(url: str) -> Optional[str]:
    if not url:
        return None
    # https://www.chess.com/game/live/123456789  → "live-123456789"
    # https://www.chess.com/game/daily/123456789 → "daily-123456789"
    parts = [p for p in url.rstrip("/").split("/") if p]
    if len(parts) >= 2 and parts[-1].isdigit():
        kind = parts[-2] if parts[-2] in ("live", "daily", "computer") else "game"
        return f"{kind}-{parts[-1]}"
    return parts[-1] if parts else None


def sync_user_games(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
    chess_com_username: str,
    limit: int = 50,
) -> dict:
    """Kullanıcının son oyunlarını chess.com'dan çekip DB'ye yazar.

    `limit` artık **her zaman sınıfı için ayrı kota** anlamına gelir:
    bullet/blitz/rapid/daily için ayrı ayrı `limit`'e kadar oyun çekilir
    (her birinde varsa max 50, yoksa mevcut olanlar). Toplamda 0–200 oyun.

    Incremental: en son saklanan `end_time`'dan büyük olanlar eklenir; aynı
    `chess_com_game_id` UNIQUE constraint ile çift-eklemeyi engeller.

    `conn_factory`: bağlantı üreten callable (server.py'deki `_get_db`).
    `db_lock`: server.py'deki `_db_lock`.

    Döner: `{inserted, updated, total, last_end_time}`.
    """
    if not chess_com_username:
        return {"inserted": 0, "updated": 0, "total": 0, "last_end_time": None}

    # En son saklanan end_time → bunun üstündekileri eklemek yeter
    with db_lock:
        conn = conn_factory()
        try:
            ensure_schema(conn)
            row = conn.execute(
                "SELECT COALESCE(MAX(end_time),0) AS m FROM chess_games WHERE user_id=?",
                (user_id,),
            ).fetchone()
            cursor_ts = int(row["m"] or 0)
        finally:
            conn.close()

    games = fetch_recent_games(chess_com_username, per_class_limit=limit)
    inserted = 0
    last_end = cursor_ts

    with db_lock:
        conn = conn_factory()
        try:
            for g in games:
                end_time = int(g.get("end_time") or 0)
                if end_time <= cursor_ts:
                    continue  # bu oyun zaten kayıtlı
                url = g.get("url") or ""
                gid = _extract_game_id_from_url(url)
                pgn = g.get("pgn") or ""
                meta = parse_pgn_metadata(pgn, chess_com_username)
                white = g.get("white") or {}
                black = g.get("black") or {}
                # Result chess.com payload'ında white.result / black.result
                # olarak da gelir ("win", "checkmated", "timeout", "resigned"
                # vs.). Kullanıcı rengi varsa oradan result hesapla, PGN'i
                # tamamla.
                user_color = meta.get("user_color")
                if user_color is None:
                    me = chess_com_username.strip().lower()
                    if (white.get("username") or "").lower() == me:
                        user_color = "w"
                    elif (black.get("username") or "").lower() == me:
                        user_color = "b"
                if user_color == "w":
                    raw = white.get("result") or ""
                elif user_color == "b":
                    raw = black.get("result") or ""
                else:
                    raw = ""
                result = (
                    "win"
                    if raw == "win"
                    else (
                        "draw"
                        if raw
                        in (
                            "agreed",
                            "repetition",
                            "stalemate",
                            "insufficient",
                            "50move",
                            "timevsinsufficient",
                        )
                        else ("loss" if raw else meta.get("result"))
                    )
                )
                termination = meta.get("termination") or raw or None

                try:
                    conn.execute(
                        """INSERT INTO chess_games(
                            user_id, chess_com_game_id, url, end_time,
                            time_class, time_control, rated, rules,
                            white_username, white_rating, black_username, black_rating,
                            user_color, result, termination, eco, opening_name,
                            pgn, final_fen, ply_count, fetched_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,strftime('%s','now'))""",
                        (
                            user_id,
                            gid,
                            url,
                            end_time,
                            g.get("time_class"),
                            g.get("time_control"),
                            1 if g.get("rated") else 0,
                            g.get("rules"),
                            white.get("username"),
                            white.get("rating"),
                            black.get("username"),
                            black.get("rating"),
                            user_color,
                            result,
                            termination,
                            meta.get("eco"),
                            meta.get("opening_name"),
                            pgn,
                            meta.get("final_fen"),
                            meta.get("ply_count") or 0,
                        ),
                    )
                    inserted += 1
                    if end_time > last_end:
                        last_end = end_time
                except sqlite3.IntegrityError:
                    pass  # zaten var (UNIQUE)
            conn.execute(
                "UPDATE users SET last_synced_at=? WHERE id=?",
                (time.time(), user_id),
            )
            conn.commit()
            total = conn.execute(
                "SELECT COUNT(*) AS c FROM chess_games WHERE user_id=?", (user_id,)
            ).fetchone()["c"]
        finally:
            conn.close()

    # En y\u00fcksek rating'i chess.com /pub/player/{u}/stats'tan g\u00fcncelle
    try:
        stats = fetch_stats(chess_com_username)
        hi = extract_highest_rating(stats or {})
        if hi:
            with db_lock:
                conn = conn_factory()
                try:
                    conn.execute(
                        "UPDATE users SET highest_rating=? WHERE id=? "
                        "AND (highest_rating IS NULL OR highest_rating<?)",
                        (hi, user_id, hi),
                    )
                    conn.commit()
                finally:
                    conn.close()
    except Exception:
        pass  # stats opsiyonel; sync kritik de\u011fil

    # Stats cache yenile
    rebuild_stats_cache(conn_factory, db_lock, user_id)
    return {
        "inserted": inserted,
        "updated": 0,
        "total": total,
        "last_end_time": last_end,
    }


# ─── Stats / weakness ────────────────────────────────────
def rebuild_stats_cache(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
) -> None:
    """`chess_games` üzerinden zayıflık metriklerini hesapla, cache'e yaz."""
    with db_lock:
        conn = conn_factory()
        try:
            rows = conn.execute(
                "SELECT result, eco, opening_name, ply_count, termination, end_time, id "
                "FROM chess_games WHERE user_id=?",
                (user_id,),
            ).fetchall()
        finally:
            pass

        total = len(rows)
        wins = sum(1 for r in rows if r["result"] == "win")
        losses = sum(1 for r in rows if r["result"] == "loss")
        draws = sum(1 for r in rows if r["result"] == "draw")

        # Açılış zayıflıkları: ECO bazında loss_rate, min 3 örnek
        per_eco: dict[str, list[sqlite3.Row]] = defaultdict(list)
        for r in rows:
            if r["eco"]:
                per_eco[r["eco"]].append(r)
        weak_openings = []
        for eco, ecorows in per_eco.items():
            if len(ecorows) < 3:
                continue
            l = sum(1 for x in ecorows if x["result"] == "loss")
            rate = l / len(ecorows)
            if rate < 0.5:
                continue  # zayıf sayılmaz
            # En son 2 kayıp game_id
            sample_ids = [
                x["id"]
                for x in sorted(
                    [x for x in ecorows if x["result"] == "loss"],
                    key=lambda x: x["end_time"] or 0,
                    reverse=True,
                )[:2]
            ]
            weak_openings.append(
                {
                    "eco": eco,
                    "name": ecorows[0]["opening_name"] or eco,
                    "games": len(ecorows),
                    "losses": l,
                    "loss_rate": round(rate, 2),
                    "sample_game_ids": sample_ids,
                }
            )
        weak_openings.sort(key=lambda x: (-x["loss_rate"], -x["games"]))
        weak_openings = weak_openings[:5]

        # Faz zayıflığı: kayıplarda ply_count bucket'ları
        phase_buckets = {"opening": [0, 0], "middlegame": [0, 0], "endgame": [0, 0]}
        # [losses, total]
        for r in rows:
            ply = r["ply_count"] or 0
            phase = (
                "opening"
                if ply <= 30  # ~15 hamle
                else "middlegame"
                if ply <= 80
                else "endgame"
            )
            phase_buckets[phase][1] += 1
            if r["result"] == "loss":
                phase_buckets[phase][0] += 1
        weak_phases = {
            k: {
                "games": v[1],
                "losses": v[0],
                "loss_rate": round(v[0] / v[1], 2) if v[1] else 0.0,
                "samples": [
                    x["id"]
                    for x in sorted(
                        [
                            x
                            for x in rows
                            if x["result"] == "loss"
                            and (
                                (
                                    k == "opening"
                                    and (x["ply_count"] or 0) <= 30
                                )
                                or (
                                    k == "middlegame"
                                    and 30 < (x["ply_count"] or 0) <= 80
                                )
                                or (
                                    k == "endgame" and (x["ply_count"] or 0) > 80
                                )
                            )
                        ],
                        key=lambda x: x["end_time"] or 0,
                        reverse=True,
                    )[:2]
                ],
            }
            for k, v in phase_buckets.items()
        }

        conn.execute(
            """INSERT INTO user_stats_cache(
                user_id, total_games, wins, losses, draws,
                weak_openings_json, weak_phases_json, updated_at
            ) VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
                total_games=excluded.total_games,
                wins=excluded.wins,
                losses=excluded.losses,
                draws=excluded.draws,
                weak_openings_json=excluded.weak_openings_json,
                weak_phases_json=excluded.weak_phases_json,
                updated_at=excluded.updated_at""",
            (
                user_id,
                total,
                wins,
                losses,
                draws,
                json.dumps(weak_openings, ensure_ascii=False),
                json.dumps(weak_phases, ensure_ascii=False),
                time.time(),
            ),
        )
        conn.commit()
        conn.close()


# ─── Query helpers (endpoint'lerin kullanacağı) ──────────
def get_user_overview(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
    recent_limit: int = 4,
) -> dict:
    """Profil paneli için tek atışta: kullanıcı + stats + son N oyun."""
    with db_lock:
        conn = conn_factory()
        try:
            urow = conn.execute(
                """SELECT id, username, chess_com_username, chess_com_verified,
                          chess_com_avatar, highest_rating, streak_count,
                          streak_last_date, avatar_theme, last_synced_at,
                          is_premium, premium_until
                   FROM users WHERE id=?""",
                (user_id,),
            ).fetchone()
            if not urow:
                return {}
            stats = conn.execute(
                "SELECT * FROM user_stats_cache WHERE user_id=?", (user_id,)
            ).fetchone()
            recent = conn.execute(
                """SELECT id, chess_com_game_id, url, end_time, time_class,
                          white_username, white_rating, black_username, black_rating,
                          user_color, result, termination, eco, opening_name,
                          final_fen, ply_count
                   FROM chess_games WHERE user_id=?
                   ORDER BY end_time DESC LIMIT ?""",
                (user_id, recent_limit),
            ).fetchall()
        finally:
            conn.close()

    stats_dict = dict(stats) if stats else None
    if stats_dict:
        # Ham JSON sütunlarını parse ederek frontend'e hazır halde döndür.
        try:
            stats_dict["weak_openings"] = json.loads(stats_dict.pop("weak_openings_json", "[]") or "[]")
        except (ValueError, TypeError):
            stats_dict["weak_openings"] = []
        try:
            stats_dict["weak_phases"] = json.loads(stats_dict.pop("weak_phases_json", "{}") or "{}")
        except (ValueError, TypeError):
            stats_dict["weak_phases"] = {}

    return {
        "user": dict(urow),
        "stats": stats_dict,
        "recent_games": [dict(r) for r in recent],
    }


def list_games(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    result_filter: Optional[str] = None,
    time_class: Optional[str] = None,
) -> list[dict]:
    sql = ["SELECT id, chess_com_game_id, url, end_time, time_class,",
           " white_username, white_rating, black_username, black_rating,",
           " user_color, result, termination, eco, opening_name, final_fen,",
           " ply_count FROM chess_games WHERE user_id=?"]
    args: list[Any] = [user_id]
    if result_filter in ("win", "loss", "draw"):
        sql.append("AND result=?")
        args.append(result_filter)
    if time_class:
        sql.append("AND time_class=?")
        args.append(time_class)
    sql.append("ORDER BY end_time DESC LIMIT ? OFFSET ?")
    args.extend([limit, offset])
    with db_lock:
        conn = conn_factory()
        try:
            rows = conn.execute(" ".join(sql), tuple(args)).fetchall()
        finally:
            conn.close()
    return [dict(r) for r in rows]


def get_game_pgn(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
    game_id: int,
) -> Optional[dict]:
    with db_lock:
        conn = conn_factory()
        try:
            row = conn.execute(
                "SELECT id, pgn, url, chess_com_game_id, white_username, black_username "
                "FROM chess_games WHERE id=? AND user_id=?",
                (game_id, user_id),
            ).fetchone()
        finally:
            conn.close()
    return dict(row) if row else None


# ─── Time-class bazlı faz eşikleri ────────────────────────
# Bullet, blitz, rapid ve daily oyunlarında "hangi ply'den itibaren
# orta/son oyun sayılır" farkı vardır — zaman baskısı altında hatalar
# erken çıkar. Kullanıcının doğru pool'a göre analiz görmesi için
# eşikleri ayrı tutuyoruz.
PHASE_THRESHOLDS = {
    "bullet": (16, 50),
    "blitz": (24, 70),
    "rapid": (30, 80),
    "daily": (36, 90),
}
_DEFAULT_THRESHOLD = (30, 80)


def _phase_of(ply: int, thr: tuple) -> str:
    op, mid = thr
    if ply <= op:
        return "opening"
    if ply <= mid:
        return "middlegame"
    return "endgame"


def _report_from_rows(rows, thr: tuple) -> dict:
    total = len(rows)
    wins = sum(1 for r in rows if r["result"] == "win")
    losses = sum(1 for r in rows if r["result"] == "loss")
    draws = sum(1 for r in rows if r["result"] == "draw")

    per_eco: dict[str, list] = defaultdict(list)
    for r in rows:
        if r["eco"]:
            per_eco[r["eco"]].append(r)
    weak_openings = []
    for eco, ecorows in per_eco.items():
        if len(ecorows) < 3:
            continue
        l = sum(1 for x in ecorows if x["result"] == "loss")
        rate = l / len(ecorows)
        if rate < 0.5:
            continue
        sample_ids = [
            x["id"]
            for x in sorted(
                [x for x in ecorows if x["result"] == "loss"],
                key=lambda x: x["end_time"] or 0,
                reverse=True,
            )[:2]
        ]
        weak_openings.append(
            {
                "eco": eco,
                "name": ecorows[0]["opening_name"] or eco,
                "games": len(ecorows),
                "losses": l,
                "loss_rate": round(rate, 2),
                "sample_game_ids": sample_ids,
            }
        )
    weak_openings.sort(key=lambda x: (-x["loss_rate"], -x["games"]))
    weak_openings = weak_openings[:5]

    phase_buckets = {"opening": [0, 0], "middlegame": [0, 0], "endgame": [0, 0]}
    for r in rows:
        ph = _phase_of(r["ply_count"] or 0, thr)
        phase_buckets[ph][1] += 1
        if r["result"] == "loss":
            phase_buckets[ph][0] += 1
    weak_phases = {}
    for k, v in phase_buckets.items():
        weak_phases[k] = {
            "games": v[1],
            "losses": v[0],
            "loss_rate": round(v[0] / v[1], 2) if v[1] else 0.0,
            "samples": [
                x["id"]
                for x in sorted(
                    [
                        x
                        for x in rows
                        if x["result"] == "loss"
                        and _phase_of(x["ply_count"] or 0, thr) == k
                    ],
                    key=lambda x: x["end_time"] or 0,
                    reverse=True,
                )[:2]
            ],
        }
    return {
        "total_games": total,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "weak_openings": weak_openings,
        "weak_phases": weak_phases,
    }


def get_weakness_report(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
) -> dict:
    """Per-time-class kırılımlı zayıflık raporu.

    `per_time_class`: {bullet, blitz, rapid, daily} her biri kendi faz
    eşikleriyle hesaplanır. Top-level alanlar (`total_games`,
    `weak_phases`, `weak_openings`) tüm sınıfların birleşimidir
    (geri uyumluluk için).
    """
    with db_lock:
        conn = conn_factory()
        try:
            rows = conn.execute(
                "SELECT id, result, eco, opening_name, ply_count, "
                "end_time, time_class "
                "FROM chess_games WHERE user_id=?",
                (user_id,),
            ).fetchall()
            cache_row = conn.execute(
                "SELECT updated_at FROM user_stats_cache WHERE user_id=?",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
    if not rows:
        return {
            "total_games": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "weak_openings": [],
            "weak_phases": {},
            "per_time_class": {},
            "updated_at": cache_row["updated_at"] if cache_row else None,
        }
    groups: dict[str, dict] = {}
    for cls in ("bullet", "blitz", "rapid", "daily"):
        sub = [r for r in rows if (r["time_class"] or "").lower() == cls]
        thr = PHASE_THRESHOLDS.get(cls, _DEFAULT_THRESHOLD)
        groups[cls] = _report_from_rows(sub, thr)
    combined = _report_from_rows(rows, _DEFAULT_THRESHOLD)
    combined["per_time_class"] = groups
    combined["updated_at"] = cache_row["updated_at"] if cache_row else None
    return combined


# ─── Streak ──────────────────────────────────────────────
def tick_streak(
    conn_factory,
    db_lock: threading.Lock,
    user_id: int,
) -> int:
    """ForkSight'a günlük login → streak güncelle. Yeni streak'i döner.

    - Bugün ile streak_last_date eşitse: değişmez.
    - Dünden geliyorsa: +1.
    - Daha eski / boş ise: 1'e reset (bugünden yeni başlangıç).
    """
    today = time.strftime("%Y-%m-%d", time.localtime())
    yesterday = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    with db_lock:
        conn = conn_factory()
        try:
            row = conn.execute(
                "SELECT streak_count, streak_last_date FROM users WHERE id=?",
                (user_id,),
            ).fetchone()
            if not row:
                return 0
            last = row["streak_last_date"]
            cnt = int(row["streak_count"] or 0)
            if last == today:
                new = cnt or 1
            elif last == yesterday:
                new = cnt + 1
            else:
                new = 1
            conn.execute(
                "UPDATE users SET streak_count=?, streak_last_date=? WHERE id=?",
                (new, today, user_id),
            )
            conn.commit()
            return new
        finally:
            conn.close()
