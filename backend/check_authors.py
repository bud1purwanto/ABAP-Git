import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.program_version import ProgramVersion

db = SessionLocal()
progs = db.query(ProgramVersion.author).distinct().all()
print(f"Distinct authors: {progs}")
