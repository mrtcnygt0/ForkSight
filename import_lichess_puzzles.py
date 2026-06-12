"""Faz 3.3 — Lichess Açık Bulmaca Veritabanı İçe Aktarıcısı.

Lichess'in https://database.lichess.org/lichess_db_puzzle.csv.zst dosyasını
stream olarak indirir, çözümler, rating bantlarına göre dengeli örnekleme
yaparak `lichess_puzzles` tablosuna ekler.

Sunucuda (Ubuntu) doğrudan çalıştırmak için tasarlandı:
    cd /opt/stockfish-server
    venv/bin/python import_lichess_puzzles.py --target-per-band 2000

Argümanlar:
    --target-per-band: Her rating bandı için hedef adet (varsayılan 2000)
    --min-popularity: Minimum popülerlik (varsayılan 80, [-100..100])
    --min-nb-plays:   Minimum oynama sayısı (varsayılan 50)
    --db:             SQLite yolu (varsayılan ./users.db)
    --url:            Kaynak URL (varsayılan resmi Lichess DB)
    --dry-run:        DB'ye yazma, sadece sayım
    --replace:        Mevcut Lichess bulmacalarını SİL ve yeniden doldur

Bantlar: 800-1000, 1000-1200, …, 2400-2600, 2600+.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import random
import sqlite3
import sys
import time
from collections import defaultdict
from typing import Iterable

try:
    import zstandard as zstd  # type: ignore
except ImportError:
    print("HATA: 'zstandard' paketi gerekli. → pip install zstandard", file=sys.stderr)
    sys.exit(2)

try:
    import requests  # type: ignore
except ImportError:
    print("HATA: 'requests' paketi gerekli. → pip install requests", file=sys.stderr)
    sys.exit(2)


DEFAULT_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"

# Rating bantları — alt-üst (üst dahil değil; son bant açık üst sınır).
BANDS: list[tuple[int, int]] = [
    (600, 1000),
    (1000, 1200),
    (1200, 1400),
    (1400, 1600),
    (1600, 1800),
    (1800, 2000),
    (2000, 2200),
    (2200, 2400),
    (2400, 2600),
    (2600, 3500),
]


def _band_for(rating: int) -> tuple[int, int] | None:
    for lo, hi in BANDS:
        if lo <= rating < hi:
            return (lo, hi)
    return None


def _iter_csv_rows(url: str) -> Iterable[list[str]]:
    """`.csv.zst` dosyasını stream'le indir + çöz + CSV satırları üret.

    Header satırı: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,
    NbPlays,Themes,GameUrl,OpeningTags
    """
    print(f"[indiriliyor] {url}")
    resp = requests.get(url, stream=True, timeout=60)
    resp.raise_for_status()
    total_size = int(resp.headers.get("Content-Length") or 0)
    print(f"[indir] sıkıştırılmış boyut: {total_size/1e6:.1f} MB")

    dctx = zstd.ZstdDecompressor()
    # Decompress streaming: raw stream → decompress → text io
    raw_stream = resp.raw  # urllib3 file-like
    decomp_stream = dctx.stream_reader(raw_stream)
    text_stream = io.TextIOWrapper(decomp_stream, encoding="utf-8", newline="")
    reader = csv.reader(text_stream)
    header = next(reader, None)
    if header is None:
        return
    # Hızlı sanity: kolon sayısı
    if len(header) < 8:
        raise RuntimeError(f"Beklenmedik CSV header: {header}")
    yield from reader


def sample_puzzles(
    url: str,
    target_per_band: int,
    min_popularity: int,
    min_nb_plays: int,
    progress_every: int = 100_000,
) -> list[tuple]:
    """Reservoir sampling — her bant için target_per_band kayıt al."""
    rng = random.Random(42)
    per_band_keep: dict[tuple[int, int], list[tuple]] = defaultdict(list)
    per_band_seen: dict[tuple[int, int], int] = defaultdict(int)

    start = time.time()
    total = 0
    kept_total = 0
    for row in _iter_csv_rows(url):
        total += 1
        if total % progress_every == 0:
            elapsed = time.time() - start
            rate = total / elapsed if elapsed else 0
            kept_total = sum(len(v) for v in per_band_keep.values())
            print(
                f"[ilerleme] okunan={total:>9,}  "
                f"alınan={kept_total:>7,}  "
                f"hız={rate:>6,.0f}/s  "
                f"süre={elapsed:>5.1f}s"
            )
        try:
            (pid, fen, moves, rating_s, rdev_s, pop_s, nbp_s, themes, *rest) = row
        except ValueError:
            continue
        try:
            rating = int(rating_s)
            popularity = int(pop_s)
            nb_plays = int(nbp_s)
        except (ValueError, TypeError):
            continue
        if popularity < min_popularity or nb_plays < min_nb_plays:
            continue
        band = _band_for(rating)
        if band is None:
            continue
        per_band_seen[band] += 1
        bucket = per_band_keep[band]
        rec = (
            pid,
            fen,
            moves,
            rating,
            int(rdev_s) if rdev_s.lstrip("-").isdigit() else 0,
            popularity,
            nb_plays,
            themes or "",
            (rest[0] if len(rest) >= 1 else "") or "",
            (rest[1] if len(rest) >= 2 else "") or "",
        )
        if len(bucket) < target_per_band:
            bucket.append(rec)
        else:
            # Reservoir: 1/n şansıyla değiştir
            j = rng.randint(0, per_band_seen[band] - 1)
            if j < target_per_band:
                bucket[j] = rec

    elapsed = time.time() - start
    print(f"[okuma bitti] toplam satır={total:,}  süre={elapsed:.1f}s")

    out: list[tuple] = []
    print("[bant özeti]")
    for band in BANDS:
        kept = per_band_keep.get(band, [])
        seen = per_band_seen.get(band, 0)
        print(f"  {band[0]:>4}-{band[1]:<4}: alındı={len(kept):>5}/{target_per_band}  görülen={seen:,}")
        out.extend(kept)
    return out


def write_to_db(db_path: str, rows: list[tuple], replace: bool) -> None:
    print(f"[db] yazılıyor → {db_path} (kayıt={len(rows):,}, replace={replace})")
    conn = sqlite3.connect(db_path, timeout=60)
    try:
        cur = conn.cursor()
        # ensure_schema'ın yarattığı şemayı bekliyoruz; yine de safety:
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
        if replace:
            cur.execute("DELETE FROM lichess_puzzles")
            print(f"[db] mevcut kayıtlar silindi: {cur.rowcount:,}")

        cur.executemany(
            """INSERT OR REPLACE INTO lichess_puzzles
               (lichess_id, fen, moves, rating, rating_dev, popularity,
                nb_plays, themes, game_url, opening, imported_at)
               VALUES (?,?,?,?,?,?,?,?,?,?, strftime('%s','now'))""",
            rows,
        )
        conn.commit()
        total = cur.execute("SELECT COUNT(*) FROM lichess_puzzles").fetchone()[0]
        print(f"[db] tamam — tabloda toplam: {total:,}")
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Lichess bulmaca DB içe aktarıcı")
    ap.add_argument("--target-per-band", type=int, default=2000)
    ap.add_argument("--min-popularity", type=int, default=80)
    ap.add_argument("--min-nb-plays", type=int, default=50)
    ap.add_argument("--db", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db"))
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--replace", action="store_true")
    args = ap.parse_args()

    rows = sample_puzzles(
        url=args.url,
        target_per_band=args.target_per_band,
        min_popularity=args.min_popularity,
        min_nb_plays=args.min_nb_plays,
    )
    if args.dry_run:
        print(f"[dry-run] toplam alındı: {len(rows):,} — DB'ye yazılmadı")
        return 0
    write_to_db(args.db, rows, replace=args.replace)
    return 0


if __name__ == "__main__":
    sys.exit(main())
