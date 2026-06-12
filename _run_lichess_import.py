"""Lichess bulmaca veritabanını sunucuda doldur (bir-defalık).

Önce zstandard+requests'in venv'de kurulu olduğunu doğrular, sonra
importer'ı arka planda başlatır ve ilerlemeyi periyodik kontrol eder.
"""
import time
from _creds import ssh_connect

ssh = ssh_connect()

def run(cmd, t=60):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=t)
    o = stdout.read().decode(errors="replace").strip()
    e = stderr.read().decode(errors="replace").strip()
    return o, e

# 1) Bağımlılıklar
print("[*] Installing zstandard + requests in venv…")
o, e = run(
    "/opt/stockfish-server/venv/bin/pip install --quiet zstandard requests",
    t=180,
)
if e and "error" in e.lower():
    print("[ERR] pip:", e[:400])
else:
    print("[OK] deps installed")

# 2) Eski log'u temizle, importer'ı arka planda başlat
print("[*] Launching importer in background…")
run("rm -f /tmp/lichess_import.log")
cmd = (
    "cd /opt/stockfish-server && "
    "nohup venv/bin/python import_lichess_puzzles.py "
    "--target-per-band 2000 "
    "--min-popularity 80 --min-nb-plays 50 "
    "> /tmp/lichess_import.log 2>&1 &"
)
run(cmd)

# 3) İlerlemeyi izle
print("[*] Tailing /tmp/lichess_import.log (max 20 min)…")
start = time.time()
last_lines = ""
while time.time() - start < 1200:
    time.sleep(15)
    o, _ = run("tail -n 30 /tmp/lichess_import.log 2>/dev/null || echo '(no log yet)'")
    if o != last_lines:
        print("─" * 60)
        print(o)
        last_lines = o
    # Done?
    o2, _ = run("grep -E 'DONE|Wrote|error' /tmp/lichess_import.log 2>/dev/null | tail -5")
    if "DONE" in o2 or "Wrote" in o2:
        print("[OK] importer finished")
        break

# 4) Doğrula
print("\n[*] Verifying lichess_puzzles count…")
probe = (
    "/opt/stockfish-server/venv/bin/python -c "
    "\"import sqlite3; c=sqlite3.connect('/opt/stockfish-server/users.db'); "
    "r=c.execute('SELECT COUNT(*), MIN(rating), MAX(rating) FROM lichess_puzzles').fetchone(); "
    "print('count=%d min=%s max=%s' % r)\""
)
o, e = run(probe, t=30)
print("[RESULT]", o or e)
