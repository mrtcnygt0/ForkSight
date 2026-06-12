"""Sunucudaki binary'nin resmi Stockfish 18 release'i olup olmadığını SHA256 ile doğrula."""
from _creds import ssh_connect

URL = "https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avx2.tar"
BIN = "/opt/stockfish-server/stockfish/stockfish-ubuntu-x86-64-avx2"

ssh = ssh_connect()
def r(c, t=120):
    i, o, e = ssh.exec_command(c, timeout=t)
    return o.read().decode().strip(), e.read().decode().strip()

print("[1] Sunucudaki binary bilgileri")
out, _ = r(f"ls -l {BIN}")
print(out)
out, _ = r(f"sha256sum {BIN}")
print(f"Sunucu SHA256: {out.split()[0]}")
local_sha = out.split()[0]

print("\n[2] Sunucudaki binary'nin UCI tanıtım bilgileri")
out, _ = r(f'echo -e "uci\\nquit" | {BIN} 2>/dev/null')
for line in out.splitlines():
    if line.startswith("id ") or line.startswith("option name") and "Eval File" in line:
        print(f"  {line}")

print("\n[3] Resmi sf_18 tarball indir ve SHA256 hesapla")
tmp = "/tmp/sf18_verify"
r(f"rm -rf {tmp} && mkdir -p {tmp}")
out, err = r(f"cd {tmp} && wget -q {URL} -O sf.tar && tar xf sf.tar && sha256sum stockfish/stockfish-ubuntu-x86-64-avx2", t=180)
print(out)
official_sha = out.split()[0] if out else "?"

print("\n[4] Karşılaştırma")
print(f"  Sunucu  : {local_sha}")
print(f"  Resmi   : {official_sha}")
if local_sha == official_sha:
    print("  >>> EŞLEŞTİ — sunucudaki binary BİT-BİT resmi Stockfish 18 release'i.")
else:
    print("  >>> EŞLEŞMEDİ — sunucudaki binary resmi release değil (özel derleme veya farklı sürüm).")
    # Boyut karşılaştır
    s1, _ = r(f"stat -c %s {BIN}")
    s2, _ = r(f"stat -c %s {tmp}/stockfish/stockfish-ubuntu-x86-64-avx2")
    print(f"  Boyut sunucu: {s1} bayt | resmi: {s2} bayt")
    # Resmi version-bench
    print("\n  Resmi binary'nin UCI çıktısı (kıyas):")
    out, _ = r(f'echo -e "uci\\nquit" | {tmp}/stockfish/stockfish-ubuntu-x86-64-avx2 2>/dev/null | head -3')
    print(out)

r(f"rm -rf {tmp}")
ssh.close()
