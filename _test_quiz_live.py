import os, paramiko
from dotenv import load_dotenv
load_dotenv()

REMOTE = '/tmp/_fs_quiz_live_test.py'
LOCAL = '_fs_quiz_live_test.py'

with open(LOCAL, 'w', encoding='utf-8') as f:
    f.write(r'''
import sys, sqlite3, threading
sys.path.insert(0, '/opt/stockfish-server')
import quiz_extractor as qx

DB = '/opt/stockfish-server/users.db'

def _conn():
    c = sqlite3.connect(DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

lock = threading.Lock()

# Find any user with synced games
c = _conn()
rows = c.execute(
    "SELECT user_id, COUNT(*) AS n FROM chess_games GROUP BY user_id "
    "ORDER BY n DESC LIMIT 5"
).fetchall()
print("USERS WITH GAMES:", [dict(r) for r in rows])

if not rows:
    print("No synced games; skipping live extract test.")
else:
    uid = rows[0]["user_id"]
    games = c.execute(
        "SELECT id, white_username, black_username, user_color, result "
        "FROM chess_games WHERE user_id=? ORDER BY end_time DESC LIMIT 5",
        (uid,)
    ).fetchall()
    print(f"USER {uid} recent games:")
    for g in games:
        print(" ", dict(g))

    print("\\n--- Running extract_for_user (limit=20) ---")
    res = qx.extract_for_user(_conn, lock, uid, limit_games=20, include_mate2=True)
    print("RESULT:", res)

    # Show what landed in puzzles table
    pz = c.execute(
        "SELECT type, COUNT(*) AS n FROM puzzles WHERE user_id=? GROUP BY type",
        (uid,)
    ).fetchall()
    print("PUZZLES IN DB FOR USER", uid, ":", [dict(r) for r in pz])

    sample = c.execute(
        "SELECT id, type, side_to_move, solution_uci, source_game_id, source_ply "
        "FROM puzzles WHERE user_id=? LIMIT 5",
        (uid,)
    ).fetchall()
    print("SAMPLE PUZZLES:")
    for s in sample:
        print(" ", dict(s))

c.close()
print("DONE")
''')

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(os.environ['DEPLOY_HOST'], username=os.environ['DEPLOY_USER'], password=os.environ['DEPLOY_PASS'])
sftp = cli.open_sftp()
sftp.put(LOCAL, REMOTE)
sftp.close()
i, o, e = cli.exec_command(f'/opt/stockfish-server/venv/bin/python {REMOTE}')
print(o.read().decode())
err = e.read().decode()
if err.strip():
    print('ERR:', err)
cli.close()
os.remove(LOCAL)
