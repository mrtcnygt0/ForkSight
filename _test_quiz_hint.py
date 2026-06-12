"""Live test for GET /quiz/hint."""
import time, json, urllib.request, urllib.error
import jwt as pyjwt

BASE = "https://forksight.net"
USERNAME = "mertcanyigit"
JWT_SECRET = "91277dae5f7ebe346093601f8c3068b305e9e3de4392f3279bb6afd298f3edac"

token = pyjwt.encode(
    {"sub": USERNAME, "adm": False, "prm": True,
     "iat": int(time.time()), "exp": int(time.time()) + 300, "type": "access"},
    JWT_SECRET, algorithm="HS256",
)
H = {"Authorization": f"Bearer {token}"}

def get(path):
    req = urllib.request.Request(BASE + path, headers=H, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read().decode()

# Önce next ile bir puzzle al
code, res = get("/quiz/next")
print("next:", code)
pid = res["puzzle"]["id"]
print("puzzle:", pid, res["puzzle"]["fen"], "side:", res["puzzle"]["side_to_move"])

for lvl in (1, 2, 3):
    code, res = get(f"/quiz/hint?puzzle_id={pid}&level={lvl}")
    print(f"\nhint L{lvl}:", code, json.dumps(res, ensure_ascii=False))
