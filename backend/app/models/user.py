from sqlalchemy import Boolean, Column, Integer, String

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    password = Column(String, nullable=False)
    git_author_name = Column(String, nullable=True)
    role = Column(String(20), nullable=False, default="developer")
    must_change_password = Column(Boolean, nullable=False, default=False)
