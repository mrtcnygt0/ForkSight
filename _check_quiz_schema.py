import os, paramiko
from dotenv import load_dotenv
load_dotenv()

LOCAL = '_fs_remote_check.py'
REMOTE = '/tmp/_fs_check_quiz.py'

with open(LOCAL, 'w', encoding='utf-8') as f:
    f.write(
        "import os, glob, sqlite3\n"
        "print('DB FILES:', glob.glob('/opt/stockfish-server/*.db'))\n"
        "db = os.environ.get('DB_PATH') or '/opt/stockfish-server/users.db'\n"
        "print('USING:', db)\n"
        "c = sqlite3.connect(db)\n"
        "cur = c.cursor()\n"
        "tables = [r[0] for r in cur.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\")]\n"
        "print('TABLES:', tables)\n"
        "for t in ('puzzles','quiz_attempts','user_quiz_stats'):\n"
        "    row = cur.execute(\"SELECT sql FROM sqlite_master WHERE name=?\", (t,)).fetchone()\n"
        "    print('---', t, '---')\n"
        "    print(row[0] if row else 'MISSING')\n"
        "idx = [r[0] for r in cur.execute(\"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'\")]\n"
        "print('INDEXES:', idx)\n"
    )

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(os.environ['DEPLOY_HOST'], username=os.environ['DEPLOY_USER'], password=os.environ['DEPLOY_PASS'])
sftp = cli.open_sftp()
sftp.put(LOCAL, REMOTE)
sftp.close()
i, o, e = cli.exec_command(f'/opt/stockfish-server/venv/bin/python {REMOTE}')
print(o.read().decode())
err = e.read().decode()
if err.strip():
    print('ERR:', err)
cli.close()
os.remove(LOCAL)
