"""Stockfish binary'sini güvenli şekilde yeni sürüme yükselt.

Adımlar:
  1) Mevcut binary'nin UCI sürümünü oku (öncesi/sonrası karşılaştırma).
  2) Resmi GitHub release'inden yeni binary'yi indir + tar'dan çıkar.
  3) Eski binary'yi `<isim>.bak.<ts>` olarak yedekle.
  4) Servisi durdur → swap → başlat.
  5) Yeni sürümü doğrula.

Tek başına çalışır; kod tarafında HİÇBİR değişiklik gerektirmez (subprocess
UCI protokolü geri uyumlu).
"""
import time
from _creds import ssh_connect

# ── HEDEF SÜRÜM ─────────────────────────────────────────────────
TAG = "sf_17.1"   # https://github.com/official-stockfish/Stockfish/releases
ARCH = "ubuntu-x86-64-avx2"  # mevcut binary ile aynı mimari
URL = f"https://github.com/official-stockfish/Stockfish/releases/download/{TAG}/stockfish-{ARCH}.tar"

REMOTE_DIR = "/opt/stockfish-server/stockfish"
BINARY = f"{REMOTE_DIR}/stockfish-{ARCH}"
SERVICE = "stockfish-server"

ssh = ssh_connect()

def run(cmd, t=60, quiet=False):
    if not quiet:
        print(f"$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=t)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out and not quiet:
        print(out)
    if err and not quiet:
        print(f"!! {err}")
    return out, err

def uci_version(path):
    """UCI 'uci' komutu ile 'id name Stockfish X.Y' satırını döndür."""
    out, _ = run(
        f'echo -e "uci\\nquit" | {path} 2>/dev/null | grep -i "^id name" | head -1',
        quiet=True,
    )
    return out or "(bilinmiyor)"

# 1) Mevcut sürüm
print("\n=== ÖNCESİ ===")
before = uci_version(BINARY)
print(f"Mevcut: {before}")

# 2) İndir + çıkar
tmp = "/tmp/sf_upgrade"
run(f"rm -rf {tmp} && mkdir -p {tmp}")
print(f"\n=== İNDİR ===\n{URL}")
out, err = run(f"cd {tmp} && wget -q {URL} -O sf.tar && ls -l sf.tar", t=120)
# wget -q sessiz; başarılıysa `ls -l` çıktı verir
size_out, _ = run(f"stat -c %s {tmp}/sf.tar 2>/dev/null || echo 0", quiet=True)
try:
    size = int(size_out.strip())
except Exception:
    size = 0
print(f"İndirilen boyut: {size} bayt")
if size < 1_000_000:
    print("İndirme başarısız (dosya çok küçük)!")
    ssh.close(); raise SystemExit(1)

run(f"cd {tmp} && tar xf sf.tar")
out, _ = run(f"find {tmp} -name 'stockfish-{ARCH}' -type f")
if not out:
    print("Yeni binary tar içinde bulunamadı!")
    ssh.close(); raise SystemExit(1)
NEW_BIN = out.split("\n")[0].strip()
print(f"Yeni binary: {NEW_BIN}")
run(f"chmod +x {NEW_BIN}")

# Yeni sürümü doğrula (henüz swap etmedik)
new_ver = uci_version(NEW_BIN)
print(f"Yeni: {new_ver}")
if "Stockfish" not in new_ver:
    print("Yeni binary UCI yanıt vermiyor — swap iptal.")
    ssh.close(); raise SystemExit(1)

# 3) Yedek
ts = int(time.time())
backup = f"{BINARY}.bak.{ts}"
print(f"\n=== YEDEK ===\n{BINARY} → {backup}")
run(f"cp -p {BINARY} {backup}")

# 4) Stop → swap → start
print(f"\n=== SWAP ===")
run(f"systemctl stop {SERVICE}", t=30)
time.sleep(2)
run(f"cp {NEW_BIN} {BINARY}")
run(f"chmod +x {BINARY}")
run(f"chown stockfish:stockfish {BINARY}")
run(f"systemctl reset-failed {SERVICE}", t=10)
run(f"systemctl start {SERVICE}", t=30)
time.sleep(10)
status, _ = run(f"systemctl is-active {SERVICE}", quiet=True)
print(f"Servis: {status}")

# 5) Doğrula
print(f"\n=== SONRASI ===")
after = uci_version(BINARY)
print(f"Aktif: {after}")
print(f"\nYedek: {backup} (geri dönmek istersen: cp {backup} {BINARY})")

# Temizlik
run(f"rm -rf {tmp}", quiet=True)
ssh.close()
print("\n[DONE]")
