"""ACİL: SF 17.1 swap'ını geri al, eski SF 18 binary'sini geri yükle."""
import time
from _creds import ssh_connect

BIN = "/opt/stockfish-server/stockfish/stockfish-ubuntu-x86-64-avx2"
BAK = BIN + ".bak.1779660199"

ssh = ssh_connect()
def r(c, t=30):
    i, o, e = ssh.exec_command(c, timeout=t)
    return o.read().decode().strip(), e.read().decode().strip()

print("Yedek dosyası:")
out, _ = r(f"ls -l {BAK}")
print(out)
if "No such" in out or not out:
    print("YEDEK BULUNAMADI — DURDU"); ssh.close(); raise SystemExit(1)

print("\nServis durduruluyor...")
r("systemctl stop stockfish-server")
time.sleep(2)
print("Binary geri yükleniyor...")
r(f"cp {BAK} {BIN}")
r(f"chmod +x {BIN}")
r(f"chown stockfish:stockfish {BIN}")
print("Servis başlatılıyor...")
r("systemctl reset-failed stockfish-server")
r("systemctl start stockfish-server")
time.sleep(8)
status, _ = r("systemctl is-active stockfish-server")
print(f"Servis: {status}")

cmd = 'echo -e "uci\\nquit" | ' + BIN + ' 2>/dev/null | grep -i "^id name" | head -1'
ver, _ = r(cmd)
print(f"Aktif sürüm: {ver}")
ssh.close()
