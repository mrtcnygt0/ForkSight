"""Live end-to-end test for quiz next/solve/stats.

Forges a short-lived access token (server-side JWT_SECRET) for an existing
user (DarkCommit / uid=96), then hits the live endpoints.
"""
import os, sys, time, json, urllib.request, urllib.error, paramiko
from dotenv import load_dotenv
load_dotenv()

BASE = "https://forksight.net"
USERNAME = "mertcanyigit"   # uid 96

JWT_SECRET = "91277dae5f7ebe346093601f8c3068b305e9e3de4392f3279bb6afd298f3edac"

import jwt as pyjwt
token = pyjwt.encode(
    {"sub": USERNAME, "adm": False, "prm": True,
     "iat": int(time.time()), "exp": int(time.time()) + 300, "type": "access"},
    JWT_SECRET, algorithm="HS256",
)
HEADERS = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def call(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read().decode()

print("=== GET /quiz/next ===")
code, res = call("GET", "/quiz/next")
print(code, json.dumps(res, indent=2, ensure_ascii=False)[:1200])

if not isinstance(res, dict) or not res.get("puzzle"):
    print("No puzzle to test solve.")
    sys.exit(0)

pz = res["puzzle"]
pid = pz["id"]

# Look up correct UCI via SSH (local DB read) to test both wrong + right.
cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(os.environ['DEPLOY_HOST'], username=os.environ['DEPLOY_USER'], password=os.environ['DEPLOY_PASS'])
i, o, e = cli.exec_command(
    f"/opt/stockfish-server/venv/bin/python -c \"import sqlite3; "
    f"c=sqlite3.connect('/opt/stockfish-server/users.db'); "
    f"print(c.execute('SELECT solution_uci FROM puzzles WHERE id=?', ({pid},)).fetchone()[0])\""
)
sol = o.read().decode().strip()
cli.close()
print(f"\nCorrect UCI for puzzle {pid}: {sol!r}")

print("\n=== POST /quiz/solve (WRONG: a1a2) ===")
code, res = call("POST", "/quiz/solve",
                  {"puzzle_id": pid, "move_uci": "a1a2", "used_hint": 0, "time_ms": 1500})
print(code, json.dumps(res, indent=2, ensure_ascii=False))

print("\n=== POST /quiz/solve (CORRECT) ===")
code, res = call("POST", "/quiz/solve",
                  {"puzzle_id": pid, "move_uci": sol.split()[0], "used_hint": 0, "time_ms": 2200})
print(code, json.dumps(res, indent=2, ensure_ascii=False))

print("\n=== GET /quiz/stats ===")
code, res = call("GET", "/quiz/stats")
print(code, json.dumps(res, indent=2, ensure_ascii=False)[:1500])

print("\n=== GET /quiz/next again (exclude prev) ===")
code, res = call("GET", f"/quiz/next?exclude_id={pid}")
print(code, json.dumps(res, indent=2, ensure_ascii=False)[:600])
