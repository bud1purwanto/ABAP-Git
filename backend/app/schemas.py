from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SandboxCreate(BaseModel):
    name: str
    host: str
    sysnr: str
    client: str
    rfc_user: str
    rfc_password: str
    environment: str = "DEV"


class SandboxOut(BaseModel):
    id: int
    name: str
    host: str
    sysnr: str
    client: str
    rfc_user: str
    environment: str
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    git_author_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    git_author_name: Optional[str] = None

    class Config:
        from_attributes = True


class SapReadResponse(BaseModel):
    program_name: str
    sap_source: str
    db_source: Optional[str] = None
    diff: str
    version_id: Optional[int] = None
    parent_version_hash: Optional[str] = None
    tcode: Optional[str] = None


class SapWriteRequest(BaseModel):
    program_name: str
    sandbox_id: int
    version_id: int


class GenerateCommitRequest(BaseModel):
    diff: str
    program_name: Optional[str] = None


class GenerateCommitResponse(BaseModel):
    commit_message: str


class CommitRequest(BaseModel):
    program_name: str
    source_code: str
    commit_message: str
    author: Optional[str] = "system"
    sandbox_name: Optional[str] = None
    parent_version_hash: Optional[str] = None


class ProgramVersionOut(BaseModel):
    id: int
    program_name: str
    commit_message: str
    author: str
    version_hash: str
    version_number: int
    created_at: datetime

    class Config:
        from_attributes = True

class ProgramVersionFull(ProgramVersionOut):
    source_code: str


class ProgramSummary(BaseModel):
    program_name: str
    version_count: int
    latest_commit_message: str
    latest_author: str
    latest_created_at: datetime


class ActivityLogOut(BaseModel):
    id: int
    action: str
    username: str
    program_name: Optional[str]
    sandbox_name: Optional[str]
    detail: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OverviewStats(BaseModel):
    total_sandboxes: int
    total_programs: int
    total_commits: int
    commits_today: int
    recent_activity: list[ActivityLogOut]
    recent_commits: list[ProgramVersionOut]
