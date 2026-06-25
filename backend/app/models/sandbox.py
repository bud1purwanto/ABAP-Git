from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base


class Sandbox(Base):
    __tablename__ = "sandboxes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    host = Column(String(255), nullable=False)
    sysnr = Column(String(10), nullable=False)
    client = Column(String(10), nullable=False)
    rfc_user = Column(String(100), nullable=False)
    rfc_password = Column(String(255), nullable=False)
    environment = Column(String(20), nullable=False, default="DEV")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
