from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from datetime import datetime

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
