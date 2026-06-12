"""Tiny SSH runner: python _ssh_run.py "<remote command>"

Quoting helper so we don't fight PowerShell escapes for every shell-out.
"""
from __future__ import annotations
import sys
from _creds import ssh_connect


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python _ssh_run.py '<remote command>'")
        return 2
    cmd = sys.argv[1]
    ssh = ssh_connect()
    try:
        _, out, err = ssh.exec_command(cmd, timeout=300)
        o = out.read().decode("utf-8", "replace")
        e = err.read().decode("utf-8", "replace")
        rc = out.channel.recv_exit_status()
        if o:
            print(o, end="" if o.endswith("\n") else "\n")
        if e:
            print("--- stderr ---", file=sys.stderr)
            print(e, end="" if e.endswith("\n") else "\n", file=sys.stderr)
        return rc
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
