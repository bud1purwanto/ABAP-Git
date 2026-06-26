from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base


class ProgramVersion(Base):
    __tablename__ = "program_versions"

    id = Column(Integer, primary_key=True, index=True)
    program_name = Column(String(100), nullable=False, index=True)
    source_code = Column(Text, nullable=False)
    commit_message = Column(Text, nullable=False, default="")
    author = Column(String(100), nullable=False, default="system")
    sandbox_name = Column(String(100), nullable=True)
    version_hash = Column(String(64), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
