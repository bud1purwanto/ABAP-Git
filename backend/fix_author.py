import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog

db = SessionLocal()
progs = db.query(ProgramVersion).filter(ProgramVersion.author == 'Budi Purwanto').all()
for p in progs:
    p.author = 'TRST-BUDI'

logs = db.query(ActivityLog).filter(ActivityLog.username == 'Budi Purwanto').all()
for log in logs:
    log.username = 'TRST-BUDI'

db.commit()
print(f"Reverted {len(progs)} programs and {len(logs)} logs.")
