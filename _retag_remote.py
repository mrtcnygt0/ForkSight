"""Sunucudaki tüm puzzle'lar için themes alanını qx._detect_themes ile
yeniden hesaplar (Faz 2.4 backfill). SSH üzerinden uzaktan çalışır."""
from _creds import ssh_connect

REMOTE_SCRIPT = r'''
cd /opt/stockfish-server && ./venv/bin/python - <<'PY'
import sqlite3, sys
sys.path.insert(0, "/opt/stockfish-server")
import chess
import quiz_extractor as qx

conn = sqlite3.connect("/opt/stockfish-server/users.db")
conn.row_factory = sqlite3.Row
rows = conn.execute("SELECT id, fen, solution_uci, type FROM puzzles").fetchall()
upd = fail = 0
for r in rows:
    try:
        ptype = (r["type"] or "").lower()
        first = (r["solution_uci"] or "").strip().split()[0]
        if not first:
            fail += 1; continue
        b = chess.Board(r["fen"])
        try:
            mv = chess.Move.from_uci(first)
        except Exception:
            mv = chess.Move.from_uci(first + "q") if len(first) == 4 else None
        if mv is None or mv not in b.legal_moves:
            fail += 1; continue
        extra = qx._detect_themes(b, mv)
        parts = [ptype] + [t for t in extra if t and t != ptype]
        conn.execute("UPDATE puzzles SET themes=? WHERE id=?", (",".join(parts), r["id"]))
        upd += 1
    except Exception as e:
        print(f"[skip {r['id']}] {e}")
        fail += 1
conn.commit()
print(f"updated={upd} failed={fail} total={upd+fail}")
conn.close()
PY
'''

ssh = ssh_connect()
stdin, stdout, stderr = ssh.exec_command(REMOTE_SCRIPT, timeout=180)
print("STDOUT:", stdout.read().decode())
err = stderr.read().decode()
if err.strip():
    print("STDERR:", err)
