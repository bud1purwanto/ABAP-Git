import sys
sys.path.append('.')
from datetime import datetime
from app.database import SessionLocal
from app.models.activity_log import ActivityLog
from app.models.sandbox import Sandbox

db = SessionLocal()

logs = db.query(ActivityLog).filter(ActivityLog.created_at == None).all()
for log in logs:
    log.created_at = datetime.utcnow()

sandboxes = db.query(Sandbox).filter(Sandbox.created_at == None).all()
for sb in sandboxes:
    sb.created_at = datetime.utcnow()

db.commit()
print(f"Fixed {len(logs)} activity logs and {len(sandboxes)} sandboxes.")
