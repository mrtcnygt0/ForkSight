"""Quick TTS endpoint smoke test."""
import time
from _creds import ssh_connect

print("Waiting 25s for service startup...")
time.sleep(25)

ssh = ssh_connect()

def run(cmd):
    _, o, e = ssh.exec_command(cmd, timeout=60)
    return o.read().decode(), e.read().decode()

# 1) Check edge_tts is importable in venv
out, err = run("/opt/stockfish-server/venv/bin/python -c 'import edge_tts; print(edge_tts.__version__)'")
print(f"[edge_tts version] {out.strip()} {err.strip()}")

# 2) Hit /tts and check response
out, _ = run("curl -s -o /tmp/tts_test.mp3 -w 'HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download} CACHE=%header{x-tts-cache}' 'http://127.0.0.1:5555/tts?text=Merhaba+ben+koc+yapay+zekan.&lang=tr'")
print(f"[TTS #1] {out}")

# 3) Second call should hit cache
out, _ = run("curl -s -o /tmp/tts_test2.mp3 -w 'HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download} CACHE=%header{x-tts-cache}' 'http://127.0.0.1:5555/tts?text=Merhaba+ben+koc+yapay+zekan.&lang=tr'")
print(f"[TTS #2] {out}")

# 4) English voice
out, _ = run("curl -s -o /tmp/tts_test_en.mp3 -w 'HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download}' 'http://127.0.0.1:5555/tts?text=Hello+I+am+your+chess+coach.&lang=en'")
print(f"[TTS EN] {out}")

# 5) Public via nginx
out, _ = run("curl -s -o /dev/null -w 'HTTP=%{http_code} TYPE=%{content_type} SIZE=%{size_download}' 'https://forksight.net/tts?text=Test&lang=tr'")
print(f"[TTS PUBLIC] {out}")

ssh.close()
print("[DONE]")
