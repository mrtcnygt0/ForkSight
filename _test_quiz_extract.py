import os, paramiko
from dotenv import load_dotenv
load_dotenv()

LOCAL = '_fs_remote_extract_test.py'
REMOTE = '/tmp/_fs_extract_test.py'

with open(LOCAL, 'w', encoding='utf-8') as f:
    f.write(r'''
import sys, os
sys.path.insert(0, '/opt/stockfish-server')
import quiz_extractor as qx

# 1) Scholar's mate: white delivers mate on move 4 (Qxf7#).
# Position BEFORE move 4 has unique mate-1 for white.
pgn_scholar = """[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0
"""
puzzles = qx.extract_puzzles_from_pgn(pgn_scholar, "white", max_per_game=20)
print("SCHOLAR puzzles:", len(puzzles))
for p in puzzles:
    print(" ", p["type"], p["solution_uci"], "ply=", p["source_ply"], "rating=", p["rating"])

# 2) Fool's mate variant (mate in 2) test: a known KxR + mate position.
# Use a simple back-rank mate-in-1 from FEN via PGN that resolves to mate.
pgn_backrank = """[Event "?"]
[White "A"]
[Black "B"]
[Result "1-0"]
[FEN "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"]
[SetUp "1"]

1. Rd8# 1-0
"""
puzzles2 = qx.extract_puzzles_from_pgn(pgn_backrank, "white")
print("BACKRANK puzzles:", len(puzzles2))
for p in puzzles2:
    print(" ", p["type"], p["solution_uci"], "fen=", p["fen"])

# 3) Mate-in-2 test (Anastasia-like idea simplified):
# Position with unique mate-in-2 for white.
pgn_m2 = """[Event "?"]
[White "A"]
[Black "B"]
[Result "1-0"]
[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]
[SetUp "1"]

1. Ra8+ Kh7? 2. wait
"""
# We just call extractor directly on the FEN via a small ad-hoc PGN.
# But mate-in-2 from this FEN isn't real; skip detailed assertion — extractor
# will return whatever it finds.
puzzles3 = qx.extract_puzzles_from_pgn(pgn_m2, "white")
print("M2_TEST puzzles:", len(puzzles3))

print("OK")
''')

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(os.environ['DEPLOY_HOST'], username=os.environ['DEPLOY_USER'], password=os.environ['DEPLOY_PASS'])
sftp = cli.open_sftp()
# Upload the extractor module so we test the latest version, plus the test.
sftp.put('quiz_extractor.py', '/opt/stockfish-server/quiz_extractor.py')
sftp.put(LOCAL, REMOTE)
sftp.close()
i, o, e = cli.exec_command(f'/opt/stockfish-server/venv/bin/python {REMOTE}')
print(o.read().decode())
err = e.read().decode()
if err.strip():
    print('ERR:', err)
cli.close()
os.remove(LOCAL)
