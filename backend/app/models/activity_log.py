from sqlalchemy import Column, Integer, String, Text, DateTime, event
from sqlalchemy.sql import func
from datetime import datetime, timedelta

from app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(20), nullable=False)  # PULL, PUSH, COMMIT, DELETE
    username = Column(String(100), nullable=False, default="system")
    program_name = Column(String(100), nullable=True)
    sandbox_name = Column(String(100), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


@event.listens_for(ActivityLog, "after_insert")
def auto_prune_old_logs(mapper, connection, target):
    """
    Automatically delete logs older than 30 days every time a new log is inserted.
    This runs inside the same transaction as the insert.
    """
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    connection.execute(
        ActivityLog.__table__.delete().where(ActivityLog.created_at < thirty_days_ago)
    )
