"""
ForkSight — GitHub Sponsors / OAuth secret kurulum yardımcısı.

KULLANIM (kendi terminalinde sen çalıştır, secret'lar sana özel kalır):
    python _setup_env.py

Ne yapar:
  1. 3 anahtarı GİZLİ olarak sorar (ekrana yazılmaz):
       - GITHUB_OAUTH_CLIENT_ID
       - GITHUB_OAUTH_CLIENT_SECRET
       - GITHUB_SPONSORS_WEBHOOK_SECRET  (boş bırakırsan güçlü bir tane üretir)
  2. Sunucudaki /opt/stockfish-server/.env dosyasını YEDEKLER, mevcut
     anahtarları (ELEVENLABS_API_KEY vb.) KORUYARAK sadece bu 3'ünü ekler/günceller.
  3. premium.html'in güncel halini yükler (Sponsors linki düzeltmesi).
  4. Servisi yeniden başlatır, hazır olana kadar bekler.
  5. /sponsors/webhook'a İMZALI bir ping atıp uçtan uca doğrular.
"""
import getpass
import hashlib
import hmac
import secrets
import time
import urllib.request
import urllib.error

from _creds import ssh_connect

ENV_PATH = "/opt/stockfish-server/.env"
APP_DIR = "/opt/stockfish-server"
PUBLIC = "https://forksight.net"

# ── 1) Secret'ları gizli oku ────────────────────────────────────────
print("GitHub App → Client ID (Settings → Developer settings → GitHub Apps):")
client_id = getpass.getpass("  GITHUB_OAUTH_CLIENT_ID: ").strip()
client_secret = getpass.getpass("  GITHUB_OAUTH_CLIENT_SECRET: ").strip()
webhook_secret = getpass.getpass(
    "  GITHUB_SPONSORS_WEBHOOK_SECRET (boş = otomatik üret): "
).strip()

if not client_id or not client_secret:
    raise SystemExit("HATA: Client ID ve Client Secret zorunlu.")

generated = False
if not webhook_secret:
    webhook_secret = secrets.token_hex(32)
    generated = True

TARGET = {
    "GITHUB_OAUTH_CLIENT_ID": client_id,
    "GITHUB_OAUTH_CLIENT_SECRET": client_secret,
    "GITHUB_SPONSORS_WEBHOOK_SECRET": webhook_secret,
}

ssh = ssh_connect()
sftp = ssh.open_sftp()


def run(cmd, t=40):
    _i, o, e = ssh.exec_command(cmd, timeout=t)
    return o.read().decode().strip(), e.read().decode().strip()


# ── 2) Mevcut .env'i oku, anahtarları birleştir (diğerlerini koru) ──
try:
    with sftp.open(ENV_PATH, "r") as f:
        existing = f.read().decode("utf-8")
except IOError:
    existing = ""

lines = existing.splitlines()
seen = set()
out_lines = []
for line in lines:
    s = line.strip()
    key = None
    if s and not s.startswith("#") and "=" in s:
        key = s.split("=", 1)[0].strip()
    if key in TARGET:
        out_lines.append(f"{key}={TARGET[key]}")
        seen.add(key)
    else:
        out_lines.append(line)
for k, v in TARGET.items():
    if k not in seen:
        out_lines.append(f"{k}={v}")
new_content = "\n".join(out_lines).rstrip("\n") + "\n"

# Yedek al, yaz, izinleri sıkılaştır.
run(f"cp -a {ENV_PATH} {ENV_PATH}.bak 2>/dev/null || true")
with sftp.open(ENV_PATH, "w") as f:
    f.write(new_content)
run(f"chown stockfish:stockfish {ENV_PATH}")
run(f"chmod 600 {ENV_PATH}")
print(f"[OK] .env güncellendi (yedek: {ENV_PATH}.bak)")
print(f"     Anahtarlar: {', '.join(TARGET.keys())}")

# ── 3) premium.html'in güncel halini yükle (restart gerektirmez) ────
try:
    with open("premium.html", "r", encoding="utf-8") as f:
        html = f.read()
    with sftp.open(f"{APP_DIR}/premium.html", "w") as f:
        f.write(html)
    run(f"chown stockfish:stockfish {APP_DIR}/premium.html")
    print("[OK] premium.html yüklendi")
except FileNotFoundError:
    print("[SKIP] premium.html yerelde bulunamadı")

sftp.close()

# ── 4) Servisi yeniden başlat, hazır olana kadar bekle ─────────────
run("systemctl restart stockfish-server")
print("[..] Servis yeniden başlatılıyor, hazırlık bekleniyor (~25sn)...")
ready = False
for _ in range(25):
    time.sleep(2)
    code, _ = run("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5555/version")
    if code == "200":
        ready = True
        break
print(f"[{'OK' if ready else 'WARN'}] Yerel port 5555: {'hazır' if ready else 'yanıt yok'}")

active, _ = run("systemctl is-active stockfish-server")
print(f"[STATUS] {active}")
ver, _ = run(f"curl -s {PUBLIC}/version")
print(f"[VERSION] {ver}")

ssh.close()

# ── 5) İmzalı webhook ping'i ile uçtan uca doğrula ─────────────────
print("\n[..] Webhook imza doğrulaması (signed ping)...")
body = b'{"zen":"ForkSight setup verification"}'
sig = "sha256=" + hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
req = urllib.request.Request(
    f"{PUBLIC}/sponsors/webhook",
    data=body,
    method="POST",
    headers={
        "X-GitHub-Event": "ping",
        "X-Hub-Signature-256": sig,
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(f"[WEBHOOK] HTTP {r.status} → {r.read().decode()[:120]}")
        print("[OK] Webhook secret çalışıyor ✓")
except urllib.error.HTTPError as e:
    print(f"[WEBHOOK] HTTP {e.code} → {e.read().decode()[:160]}")
    print("[WARN] İmza doğrulanamadı; secret uyuşmuyor olabilir.")
except Exception as e:
    print(f"[WEBHOOK] Hata: {e}")

# ── Özet / sıradaki adım ───────────────────────────────────────────
print("\n" + "=" * 60)
print("SIRADAKİ ADIM — GitHub Sponsors webhook'unu kur:")
print("  https://github.com/sponsors/mrtcnygt0/dashboard/webhooks")
print(f"  • Payload URL : {PUBLIC}/sponsors/webhook")
print("  • Content type: application/json")
if generated:
    print("  • Secret      : (AŞAĞIDAKİ ÜRETİLEN DEĞERİ YAPIŞTIR)")
    print("  ┌" + "─" * 56)
    print(f"  │ {webhook_secret}")
    print("  └" + "─" * 56)
else:
    print("  • Secret      : (script'e girdiğin webhook secret'ı ile AYNI)")
print("=" * 60)
