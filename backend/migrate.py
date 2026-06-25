import os
import sys

# Ensure backend is in python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.program_version import ProgramVersion

def migrate():
    # 1. Add column if not exists
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE program_versions ADD COLUMN version_number INTEGER DEFAULT 1 NOT NULL"))
            conn.commit()
            print("Added version_number column.")
        except Exception as e:
            conn.rollback()
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("Column version_number already exists.")
            else:
                print("Error adding column:", e)
                
    # 2. Populate version numbers sequentially per program
    db = SessionLocal()
    programs = db.query(ProgramVersion.program_name).distinct().all()
    
    for (prog_name,) in programs:
        versions = db.query(ProgramVersion).filter(ProgramVersion.program_name == prog_name).order_by(ProgramVersion.created_at.asc()).all()
        for i, v in enumerate(versions):
            v.version_number = i + 1
    
    db.commit()
    print("Migration complete.")
    db.close()

if __name__ == "__main__":
    migrate()
