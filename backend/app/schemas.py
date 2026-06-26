from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SandboxCreate(BaseModel):
    requested_by: str
    name: str
    host: str
    sysnr: str
    client: str
    rfc_user: str
    rfc_password: str
    environment: str = "SANDBOX"  # SANDBOX | DEV | QA | PROD


class SandboxUpdate(BaseModel):
    requested_by: str
    name: str
    host: str
    sysnr: str
    client: str
    rfc_user: str
    rfc_password: Optional[str] = None  # if omitted/empty, keep existing password
    environment: str


class SandboxOut(BaseModel):
    id: int
    name: str
    host: str
    sysnr: str
    client: str
    rfc_user: str
    environment: str
    is_live: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    requested_by: str
    username: str
    password: str
    git_author_name: Optional[str] = None
    role: str = "developer"


class UserOut(BaseModel):
    id: int
    username: str
    git_author_name: Optional[str] = None
    role: str
    must_change_password: bool

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    requested_by: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    username: str
    current_password: str
    new_password: str


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
    author: Optional[str] = "system"


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


class EditCommitRequest(BaseModel):
    requested_by: str
    commit_message: str


class RenameProgramRequest(BaseModel):
    requested_by: str
    old_name: str
    new_name: str


class ProgramVersionOut(BaseModel):
    id: int
    program_name: str
    commit_message: str
    author: str
    sandbox_name: Optional[str] = None
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
    servers_by_environment: dict[str, int]
    total_programs: int
    total_commits: int
    commits_today: int
    recent_activity: list[ActivityLogOut]
    recent_commits: list[ProgramVersionOut]
