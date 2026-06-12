"""End-to-end smoke test for chess.com integration endpoints."""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "https://forksight.net"
USER = f"fstest{int(time.time()) % 100000}"
PASS = "testpass123"
CC = "hikaru"


def post(path, body, token=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def get(path, token=None):
    req = urllib.request.Request(BASE + path)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


print(f"[1] Register {USER} + chess.com={CC}")
code, body = post("/register", {"username": USER, "password": PASS, "chess_com_username": CC})
print(f"  → {code} {body}")
if not body.get("ok"):
    sys.exit(1)
token = body["token"]

print("[2] Wait 8s for background sync…")
time.sleep(8)

print("[3] GET /me/profile")
code, body = get("/me/profile", token)
print(f"  → {code}")
print(f"  user.chess_com_username = {body.get('user', {}).get('chess_com_username')}")
print(f"  user.streak_count = {body.get('user', {}).get('streak_count')}")
print(f"  stats = {body.get('stats')}")
print(f"  recent_games count = {len(body.get('recent_games') or [])}")
for g in (body.get("recent_games") or [])[:2]:
    print(f"    - id={g['id']} {g['white_username']} vs {g['black_username']} → {g['result']} (eco={g['eco']})")

print("[4] GET /me/games?limit=5")
code, body = get("/me/games?limit=5", token)
print(f"  → {code} got {len(body.get('games') or [])} games")

print("[5] GET /me/weakness-report")
code, body = get("/me/weakness-report", token)
print(f"  → {code}")
r = body.get("report") or {}
print(f"  total={r.get('total_games')} w/l/d={r.get('wins')}/{r.get('losses')}/{r.get('draws')}")
print(f"  weak_openings={len(r.get('weak_openings') or [])}")
print(f"  weak_phases keys={list((r.get('weak_phases') or {}).keys())}")

print("[6] POST /login → streak tick")
code, body = post("/login", {"username": USER, "password": PASS})
print(f"  → {code} streak={body.get('streak')}")
print("OK")
