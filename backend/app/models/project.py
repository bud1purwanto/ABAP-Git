from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    sandbox_id = Column(Integer, ForeignKey("sandboxes.id"), nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    sandbox = relationship("Sandbox")
    programs = relationship("ProjectProgram", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint('name', 'sandbox_id', name='uix_project_name_sandbox'),)


class ProjectProgram(Base):
    __tablename__ = "project_programs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    program_name = Column(String(100), nullable=False)
    tcode = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    project = relationship("Project", back_populates="programs")

    __table_args__ = (UniqueConstraint('project_id', 'program_name', name='uix_project_program'),)
