from _creds import ssh_connect
ssh = ssh_connect()
for cmd in [
    "systemctl kill -s SIGKILL stockfish-server",
    "sleep 2",
    "systemctl reset-failed stockfish-server",
    "systemctl start stockfish-server",
    "sleep 5",
    "systemctl status stockfish-server --no-pager -n 5",
    "curl -s http://127.0.0.1:5555/version",
]:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f"--- {cmd} ---")
    print(stdout.read().decode())
    e = stderr.read().decode()
    if e.strip(): print("ERR:", e)
