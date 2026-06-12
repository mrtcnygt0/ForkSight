# -*- coding: utf-8 -*-
"""
quiz_extractor.py — Faz 1
=========================

Kullanıcının kendi (chess_games tablosundaki) oyunlarından puzzle çıkarır:

  * `mate1` — sırası kullanıcıda; **tek bir** legal hamle direkt mat.
  * `mate2` — sırası kullanıcıda; **tek bir** legal hamle, rakibin TÜM
              cevapları için kullanıcıya forced mate-in-1 bırakıyor.
  * `best_move` — Stockfish (opsiyonel) ile MultiPV=2 analizi sonunda
              en iyi hamle ile ikincisi arasındaki değerlendirme farkı
              `best_move_threshold_cp` (varsayılan 200) santipiyondan
              büyük ve **tek aday** kalan pozisyonlar. Mate puzzle'larıyla
              çakışmaması için sadece mate1/mate2 bulunamadığında üretilir.

Sadece *unique* (tek doğru cevaplı) hamleler puzzle sayılır; aksi takdirde
"hangisini seçeyim?" belirsizliği doğar.

Daha pahalı kategoriler (sac mate, theme tactic) Faz 2'de eklenecek.

Veri akışı:
    pgn (str)
      → list[dict]  (puzzle satırları)
      → DB INSERT OR IGNORE (UNIQUE(user_id, fen, type) çarpışmalarını yutar)

Modül stateless; veritabanı I/O sadece `extract_for_game` / `save_puzzles`
içinde, server.py'deki paylaşılan `_db_lock` altında yapılır.
"""

from __future__ import annotations

import io
import sqlite3
import threading
import time
from typing import Callable, Iterable, Optional

import chess
import chess.pgn


# ─── Saf bulmaca tespiti ────────────────────────────────
def _find_unique_mate_in_one(board: chess.Board) -> Optional[chess.Move]:
    """Sırası `board.turn`'de olan tarafın **tek bir** mat hamlesi varsa
    onu döner. Birden fazla veya hiç mat yoksa `None`."""
    mate_moves: list[chess.Move] = []
    for mv in board.legal_moves:
        board.push(mv)
        try:
            if board.is_checkmate():
                mate_moves.append(mv)
                if len(mate_moves) > 1:
                    return None
        finally:
            board.pop()
    return mate_moves[0] if len(mate_moves) == 1 else None


def _find_unique_mate_in_two(board: chess.Board) -> Optional[chess.Move]:
    """Sırası `board.turn`'de; **tek bir** hamle var ki rakibin HER
    legal cevabından sonra mat-1 forced. Birden fazla aday veya hiç
    yoksa `None`."""
    candidates: list[chess.Move] = []
    for m1 in board.legal_moves:
        board.push(m1)
        try:
            # m1 zaten matsa bu mate-1; mate-2 değil.
            if board.is_checkmate():
                continue
            # Rakibin oynayacak hamlesi yoksa (stalemate) mat değil.
            opp_moves = list(board.legal_moves)
            if not opp_moves:
                continue
            forced = True
            for r in opp_moves:
                board.push(r)
                try:
                    has_mate = False
                    for m2 in board.legal_moves:
                        board.push(m2)
                        try:
                            if board.is_checkmate():
                                has_mate = True
                                break
                        finally:
                            board.pop()
                    if not has_mate:
                        forced = False
                        break
                finally:
                    board.pop()
            if forced:
                candidates.append(m1)
                if len(candidates) > 1:
                    return None
        finally:
            board.pop()
    return candidates[0] if len(candidates) == 1 else None


# ─── PGN tarama ─────────────────────────────────────────
_TYPE_RATING = {
    "mate1": 1100,
    "mate2": 1500,
    "mate3": 1700,
    "best_move": 1300,
}


# ─── Engine yardımcıları (best_move için) ───────────────
# Çağıran (server) bir `engine_analyse(fen, depth, multipv) -> list[dict]`
# callable'ı geçer. Her sonuç dict'i şunları içermeli:
#   { "move_uci": str, "score_cp": int | None, "score_mate": int | None }
# `score_cp` ve `score_mate` daima **sırası gelen tarafın** bakış açısından.
# Hiç çıktı yoksa boş liste döner; bu durumda pozisyon atlanır.

# Mate skorunu cp eşdeğerine çevir (sıralama/farklar için).
_MATE_CP_EQUIV = 100000  # büyük sabit; gerçek cp'lerle karışmaz

def _result_to_score(r: dict) -> Optional[int]:
    """Bir analiz satırını tek bir sayısal skora indir: sırası gelen taraf
    için pozitif = iyi. Mate skorları için işaret korunur, mat hızına göre
    küçük bir azaltma uygulanır (M1 > M5 olsun)."""
    if r is None:
        return None
    sm = r.get("score_mate")
    if sm is not None:
        try:
            sm = int(sm)
        except Exception:
            return None
        if sm == 0:
            return None
        sign = 1 if sm > 0 else -1
        # M1 en yüksek; |M| büyüdükçe biraz düşür.
        return sign * (_MATE_CP_EQUIV - abs(sm))
    sc = r.get("score_cp")
    if sc is None:
        return None
    try:
        return int(sc)
    except Exception:
        return None


def _find_unique_mate_in_three(
    board: chess.Board,
    engine_analyse: Callable[[str, int, int], list],
    *,
    depth: int = 18,
) -> Optional[chess.Move]:
    """Sırası `board.turn`'de; engine analizi tek bir hamlenin **kesin**
    mate-in-3'e götürdüğünü söylüyorsa o hamleyi döner. Aksi halde `None`.

    Kriterler:
      * top-1.score_mate == 3 (kullanıcı için pozitif).
      * top-2 yoksa veya top-2 mate-in-≤3 değil (ambigu olmasın).
      * mate1/mate2 için ayrı dedektör olduğundan score_mate∈{1,2} ise
        burada üretmiyoruz (karışmasın).
    """
    try:
        rows = engine_analyse(board.fen(), depth, 2) or []
    except Exception:
        return None
    if not rows:
        return None
    r1 = rows[0] or {}
    sm1 = r1.get("score_mate")
    try:
        sm1 = int(sm1) if sm1 is not None else None
    except Exception:
        sm1 = None
    if sm1 != 3:
        return None
    if len(rows) >= 2 and rows[1]:
        sm2 = rows[1].get("score_mate")
        try:
            sm2 = int(sm2) if sm2 is not None else None
        except Exception:
            sm2 = None
        if sm2 is not None and 0 < sm2 <= 3:
            return None
    mv_uci = (r1.get("move_uci") or "").strip()
    if not mv_uci:
        return None
    try:
        mv = chess.Move.from_uci(mv_uci)
    except Exception:
        return None
    if mv not in board.legal_moves:
        return None
    return mv


def _find_unique_best_move(
    board: chess.Board,
    engine_analyse: Callable[[str, int, int], list],
    *,
    depth: int = 14,
    threshold_cp: int = 200,
) -> Optional[chess.Move]:
    """Sırası `board.turn`'de; MultiPV=2 analizi sonunda top-1 ile top-2
    arasındaki skor farkı `threshold_cp`'den büyükse top-1'i puzzle hamlesi
    olarak döner. Aksi halde `None`.

    Ek güvenlikler:
      * Top-1 zaten kaybediliyor (skor < -300 cp) ise puzzle yapma — kullanıcı
        "en az kötüsünü" bulmaya zorlanır, demoralize edici.
      * Skor parse edilemiyorsa atlanır.
    """
    try:
        rows = engine_analyse(board.fen(), depth, 2) or []
    except Exception:
        return None
    if not rows or len(rows) < 2:
        # MultiPV=2 alınamadıysa (örn. tek legal hamle), puzzle değil.
        return None
    s1 = _result_to_score(rows[0])
    s2 = _result_to_score(rows[1])
    if s1 is None or s2 is None:
        return None
    # Kaybedilen pozisyonda "en iyi"yi sormak motivasyon kırıcı.
    # Mate-equiv değerleri filtreyi geçer (büyük pozitif/negatif).
    if -10000 < s1 < -300:
        return None
    if (s1 - s2) < int(threshold_cp):
        return None
    mv_uci = (rows[0].get("move_uci") or "").strip()
    if not mv_uci:
        return None
    try:
        mv = chess.Move.from_uci(mv_uci)
    except Exception:
        return None
    if mv not in board.legal_moves:
        return None
    return mv


def _puzzle_dict(
    *,
    game_db_id: Optional[int],
    ply: int,
    board_before: chess.Board,
    move: chess.Move,
    ptype: str,
) -> dict:
    extra = _detect_themes(board_before, move)
    # ptype her zaman başta; ayraç virgül.
    themes_parts = [ptype] + [t for t in extra if t != ptype]
    return {
        "source_game_id": game_db_id,
        "source_ply": ply,
        "fen": board_before.fen(),
        "side_to_move": "w" if board_before.turn == chess.WHITE else "b",
        "type": ptype,
        "solution_uci": move.uci(),
        "rating": _TYPE_RATING.get(ptype, 1500),
        "themes": ",".join(themes_parts),
        "hint": None,
    }


# ─── Faz 2.4: tema dedektörü ─────────────────────────────
# Saf board mantığı — engine gerektirmez. Çıktı küçük etiket listesi:
# fork / pin / skewer / discovered_check / double_check / check /
# back_rank / hanging / capture / promotion.
_PIECE_VAL = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}

_RAY_OFFSETS = {
    chess.BISHOP: ((1, 1), (1, -1), (-1, 1), (-1, -1)),
    chess.ROOK: ((1, 0), (-1, 0), (0, 1), (0, -1)),
    chess.QUEEN: ((1, 1), (1, -1), (-1, 1), (-1, -1),
                  (1, 0), (-1, 0), (0, 1), (0, -1)),
}


def _ray_first_two(board: chess.Board, from_sq: int,
                    dx: int, dy: int) -> list[tuple[int, chess.Piece]]:
    """`from_sq`'dan (dx,dy) yönünde ilerleyip rastlanan ilk iki taşı
    sırasıyla döner."""
    f = chess.square_file(from_sq)
    r = chess.square_rank(from_sq)
    out: list[tuple[int, chess.Piece]] = []
    while True:
        f += dx
        r += dy
        if not (0 <= f <= 7 and 0 <= r <= 7):
            break
        sq = chess.square(f, r)
        p = board.piece_at(sq)
        if p is not None:
            out.append((sq, p))
            if len(out) >= 2:
                break
    return out


def _detect_themes(board_before: chess.Board, move: chess.Move) -> list[str]:
    """Çözüm hamlesinden çıkarılabilen taktik tema etiketleri.
    Hatalı durumda boş liste döner; ana akışı bloklamaz."""
    themes: list[str] = []
    try:
        me = board_before.turn
        them = not me
        was_capture = board_before.is_capture(move)
        if move.promotion is not None:
            themes.append("promotion")

        board_after = board_before.copy(stack=False)
        try:
            board_after.push(move)
        except Exception:
            return themes

        moved_piece = board_after.piece_at(move.to_square)
        if moved_piece is None:
            return themes
        moved_val = _PIECE_VAL[moved_piece.piece_type]

        if was_capture:
            themes.append("capture")
            # Hanging: hedef kare hamleden ÖNCE rakip tarafından savunulmuyorsa
            try:
                defenders = board_before.attackers(them, move.to_square)
                if not defenders:
                    themes.append("hanging")
            except Exception:
                pass

        # Çatal: hamlenin sonunda taşımız >=2 yüksek değerli rakip taşı atıyor
        try:
            attacked_valuable: list[int] = []
            for sq in board_after.attacks(move.to_square):
                p = board_after.piece_at(sq)
                if p is None or p.color != them:
                    continue
                v = _PIECE_VAL[p.piece_type]
                if p.piece_type == chess.KING or v >= moved_val:
                    attacked_valuable.append(sq)
            if len(attacked_valuable) >= 2:
                themes.append("fork")
        except Exception:
            pass

        # Şah / keşif şahı / çifte şah
        if board_after.is_check():
            checkers = board_after.checkers()
            if move.to_square not in checkers:
                themes.append("discovered_check")
            elif len(checkers) >= 2:
                themes.append("double_check")
            else:
                themes.append("check")

        # Pin / şiş: yalnız uzun-menzilli taşlar üretebilir
        slider_pt = moved_piece.piece_type
        if slider_pt in _RAY_OFFSETS:
            for (dx, dy) in _RAY_OFFSETS[slider_pt]:
                seq = _ray_first_two(board_after, move.to_square, dx, dy)
                if len(seq) < 2:
                    continue
                p1 = seq[0][1]
                p2 = seq[1][1]
                if p1.color != them or p2.color != them:
                    continue
                v1 = _PIECE_VAL[p1.piece_type]
                v2 = _PIECE_VAL[p2.piece_type]
                if p2.piece_type == chess.KING or v2 > v1:
                    if "pin" not in themes:
                        themes.append("pin")
                elif v1 > v2:
                    if "skewer" not in themes:
                        themes.append("skewer")

        # Geri sıra mat: mat + kralın bulunduğu sıra (1 veya 8)
        if board_after.is_checkmate():
            try:
                king_sq = board_after.king(them)
                if king_sq is not None:
                    rank = chess.square_rank(king_sq)
                    if (them == chess.WHITE and rank == 0) or \
                       (them == chess.BLACK and rank == 7):
                        themes.append("back_rank")
            except Exception:
                pass

        # Sacrifice (feda): hamle sonunda taşımız daha ucuz/eşit bir rakip
        # taşı tarafından attack ediliyor ve biz alış yapmadık (yani
        # bilerek terkettik). Mat ile biten pozisyonlar tipik feda örnekleri.
        # Şah (check) hamlelerinde feda daha anlamlıdır.
        try:
            if moved_val >= 3 and not was_capture:
                attackers = board_after.attackers(them, move.to_square)
                if attackers:
                    cheapest = 99
                    for sq in attackers:
                        ap = board_after.piece_at(sq)
                        if ap is None:
                            continue
                        v = _PIECE_VAL.get(ap.piece_type, 99)
                        if v < cheapest:
                            cheapest = v
                    # Daha ucuz veya eşit bir taşla atak ediliyorsak feda
                    if cheapest <= moved_val:
                        defenders = board_after.attackers(me, move.to_square)
                        # Savunucumuz yoksa veya en ucuz attacker bizim
                        # en ucuz defender değerinden düşükse net kayıp.
                        net_loss = True
                        if defenders:
                            cheapest_def = min(
                                _PIECE_VAL.get(
                                    (board_after.piece_at(s).piece_type
                                     if board_after.piece_at(s) else 0),
                                    99,
                                )
                                for s in defenders
                            )
                            # Savunucumuz attacker'dan ucuzsa net kayıp yok.
                            if cheapest_def < cheapest:
                                net_loss = False
                        if net_loss:
                            themes.append("sacrifice")
        except Exception:
            pass
    except Exception:
        return themes
    return themes


def extract_puzzles_from_pgn(
    pgn_text: str,
    user_color: str,
    *,
    game_db_id: Optional[int] = None,
    max_per_game: int = 25,
    include_mate2: bool = True,
    engine_analyse: Optional[Callable[[str, int, int], list]] = None,
    best_move_depth: int = 14,
    best_move_threshold_cp: int = 200,
    max_best_move_per_game: int = 8,
) -> list[dict]:
    """PGN metnini parse edip kullanıcıya ait pozisyonlarda mate-1/mate-2
    (ve `engine_analyse` verildiyse best-move) arar.
    `user_color` ∈ {"w","b","white","black"}.

    Sadece kullanıcının **oynayacağı** pozisyon (yani kullanıcının sırası)
    test edilir; oyunda kaçırdığı veya yakaladığı mate'ler dahil.

    Performans notu: best_move analizi pahalıdır. Açılış pozisyonları
    (ply<10) ve oyun-sonu pozisyonları atlanır; ayrıca `max_best_move_per_game`
    ile sınırlanır.
    """
    if not pgn_text:
        return []
    user_white = (user_color or "").lower().startswith("w")
    user_turn = chess.WHITE if user_white else chess.BLACK

    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
    except Exception:
        return []
    if game is None:
        return []

    board = game.board()
    out: list[dict] = []
    seen_fens: set[str] = set()
    ply = 0
    bm_added = 0

    for node in game.mainline():
        move_played = node.move
        # Test edilecek pozisyon: hamleden ÖNCEKİ board.
        if board.turn == user_turn and not board.is_game_over():
            fen_key = board.board_fen() + (" w" if board.turn == chess.WHITE else " b")
            if fen_key not in seen_fens:
                seen_fens.add(fen_key)
                m1 = _find_unique_mate_in_one(board)
                if m1 is not None:
                    out.append(_puzzle_dict(
                        game_db_id=game_db_id, ply=ply,
                        board_before=board, move=m1, ptype="mate1",
                    ))
                else:
                    m2 = None
                    if include_mate2:
                        # Mate-2 sadece düşük dallanmada mantıklı; orta oyunda
                        # 30+ legal hamle × 30 cevap × 30 mat = ~27k pozisyon.
                        # Genelde mate-2 setup'ı dar (check'ler veya sınırlı
                        # kaçış). Yine de sınırla.
                        if board.legal_moves.count() <= 35:
                            m2 = _find_unique_mate_in_two(board)
                    if m2 is not None:
                        out.append(_puzzle_dict(
                            game_db_id=game_db_id, ply=ply,
                            board_before=board, move=m2, ptype="mate2",
                        ))
                    else:
                        m3 = None
                        if (engine_analyse is not None
                                and ply >= 6
                                and board.legal_moves.count() >= 2):
                            m3 = _find_unique_mate_in_three(
                                board, engine_analyse,
                                depth=max(best_move_depth + 4, 18),
                            )
                        if m3 is not None:
                            out.append(_puzzle_dict(
                                game_db_id=game_db_id, ply=ply,
                                board_before=board, move=m3, ptype="mate3",
                            ))
                        elif (engine_analyse is not None
                                and bm_added < max_best_move_per_game
                                and ply >= 10
                                and board.legal_moves.count() >= 2):
                            bm = _find_unique_best_move(
                                board, engine_analyse,
                                depth=best_move_depth,
                                threshold_cp=best_move_threshold_cp,
                            )
                            if bm is not None:
                                out.append(_puzzle_dict(
                                    game_db_id=game_db_id, ply=ply,
                                    board_before=board, move=bm, ptype="best_move",
                                ))
                                bm_added += 1
        if move_played is None:
            break
        board.push(move_played)
        ply += 1
        if len(out) >= max_per_game:
            break

    return out


# ─── DB yardımcıları ────────────────────────────────────
def save_puzzles(
    conn_factory: Callable[[], sqlite3.Connection],
    db_lock: threading.Lock,
    user_id: int,
    puzzles: Iterable[dict],
) -> int:
    """`puzzles` tablosuna toplu ekleme. UNIQUE(user_id, fen, type)
    çakışmalarını yutar (INSERT OR IGNORE). Eklenen satır sayısını döner."""
    rows = list(puzzles)
    if not rows:
        return 0
    inserted = 0
    with db_lock:
        conn = conn_factory()
        try:
            cur = conn.cursor()
            for p in rows:
                cur.execute(
                    "INSERT OR IGNORE INTO puzzles "
                    "(user_id, source_game_id, source_ply, fen, side_to_move, "
                    " type, solution_uci, rating, themes, hint, created_at) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        user_id,
                        p.get("source_game_id"),
                        p.get("source_ply"),
                        p["fen"],
                        p["side_to_move"],
                        p["type"],
                        p["solution_uci"],
                        int(p.get("rating") or 1500),
                        p.get("themes"),
                        p.get("hint"),
                        time.time(),
                    ),
                )
                if cur.rowcount > 0:
                    inserted += 1
            conn.commit()
        finally:
            conn.close()
    return inserted


def extract_for_game(
    conn_factory: Callable[[], sqlite3.Connection],
    db_lock: threading.Lock,
    user_id: int,
    game_db_id: int,
    *,
    include_mate2: bool = True,
    max_per_game: int = 25,
    engine_analyse: Optional[Callable[[str, int, int], list]] = None,
    best_move_depth: int = 14,
    best_move_threshold_cp: int = 200,
    max_best_move_per_game: int = 8,
) -> dict:
    """Belirli bir `chess_games.id` için puzzle çıkarıp DB'ye yazar."""
    with db_lock:
        conn = conn_factory()
        try:
            row = conn.execute(
                "SELECT id, pgn, user_color FROM chess_games "
                "WHERE id=? AND user_id=?",
                (game_db_id, user_id),
            ).fetchone()
        finally:
            conn.close()
    if not row:
        return {"ok": False, "error": "game_not_found",
                "found": 0, "inserted": 0}
    pgn = row["pgn"] if isinstance(row, sqlite3.Row) else row[1]
    ucol = (row["user_color"] if isinstance(row, sqlite3.Row) else row[2]) or ""
    puzzles = extract_puzzles_from_pgn(
        pgn, ucol,
        game_db_id=game_db_id,
        max_per_game=max_per_game,
        include_mate2=include_mate2,
        engine_analyse=engine_analyse,
        best_move_depth=best_move_depth,
        best_move_threshold_cp=best_move_threshold_cp,
        max_best_move_per_game=max_best_move_per_game,
    )
    inserted = save_puzzles(conn_factory, db_lock, user_id, puzzles)
    return {
        "ok": True,
        "game_id": game_db_id,
        "found": len(puzzles),
        "inserted": inserted,
        "types": {
            t: sum(1 for p in puzzles if p["type"] == t)
            for t in {"mate1", "mate2", "best_move"}
        },
    }


def extract_for_user(
    conn_factory: Callable[[], sqlite3.Connection],
    db_lock: threading.Lock,
    user_id: int,
    *,
    limit_games: int = 50,
    include_mate2: bool = True,
    max_per_game: int = 25,
    engine_analyse: Optional[Callable[[str, int, int], list]] = None,
    best_move_depth: int = 14,
    best_move_threshold_cp: int = 200,
    max_best_move_per_game: int = 8,
) -> dict:
    """Kullanıcının son `limit_games` oyununu tarar; toplam puzzle ekler.
    UI'dan `POST /quiz/backfill` ile tetiklenecek (Adım 1.7); şimdi
    `POST /quiz/extract` tekil oyun için kullanılıyor."""
    with db_lock:
        conn = conn_factory()
        try:
            rows = conn.execute(
                "SELECT id FROM chess_games WHERE user_id=? "
                "ORDER BY end_time DESC LIMIT ?",
                (user_id, int(limit_games)),
            ).fetchall()
        finally:
            conn.close()
    total_found = 0
    total_inserted = 0
    per_game: list[dict] = []
    for r in rows:
        gid = r[0] if not isinstance(r, sqlite3.Row) else r["id"]
        res = extract_for_game(
            conn_factory, db_lock, user_id, gid,
            include_mate2=include_mate2, max_per_game=max_per_game,
            engine_analyse=engine_analyse,
            best_move_depth=best_move_depth,
            best_move_threshold_cp=best_move_threshold_cp,
            max_best_move_per_game=max_best_move_per_game,
        )
        if res.get("ok"):
            total_found += res.get("found", 0)
            total_inserted += res.get("inserted", 0)
            per_game.append(res)
    return {
        "ok": True,
        "games_scanned": len(per_game),
        "found": total_found,
        "inserted": total_inserted,
    }
