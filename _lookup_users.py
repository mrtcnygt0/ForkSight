import os, paramiko
from dotenv import load_dotenv
load_dotenv()

LOCAL = '_fs_users_lookup.py'
REMOTE = '/tmp/_fs_users_lookup.py'

with open(LOCAL, 'w', encoding='utf-8') as f:
    f.write(
        "import sqlite3\n"
        "c = sqlite3.connect('/opt/stockfish-server/users.db')\n"
        "c.row_factory = sqlite3.Row\n"
        "rows = c.execute('SELECT id, username, chess_com_username FROM users WHERE id IN (96,2,93,94,1) ORDER BY id').fetchall()\n"
        "for r in rows:\n"
        "    print(dict(r))\n"
    )

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(os.environ['DEPLOY_HOST'], username=os.environ['DEPLOY_USER'], password=os.environ['DEPLOY_PASS'])
sftp = cli.open_sftp(); sftp.put(LOCAL, REMOTE); sftp.close()
i, o, e = cli.exec_command(f'/opt/stockfish-server/venv/bin/python {REMOTE}')
print(o.read().decode())
err = e.read().decode()
if err.strip(): print('ERR:', err)
cli.close()
os.remove(LOCAL)
