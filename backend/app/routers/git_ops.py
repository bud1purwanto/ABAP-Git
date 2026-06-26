import hashlib

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas import (
    CommitRequest,
    ProgramVersionOut,
    ProgramSummary,
    ProgramVersionFull,
    EditCommitRequest,
    RenameProgramRequest,
)

router = APIRouter(prefix="/api/git", tags=["git"])


def _is_super_admin(db: Session, username: str) -> bool:
    user = db.query(User).filter(User.username == username).first()
    return bool(user and user.role == "super_admin")


@router.post("/commit", response_model=ProgramVersionOut, status_code=201)
def commit_version(payload: CommitRequest, db: Session = Depends(get_db)):
    latest_version = (
        db.query(ProgramVersion)
        .filter(ProgramVersion.program_name == payload.program_name)
        .order_by(ProgramVersion.created_at.desc())
        .first()
    )

    if latest_version:
        if not payload.parent_version_hash or payload.parent_version_hash != latest_version.version_hash:
            raise HTTPException(
                status_code=409,
                detail="Concurrency Conflict: The program has been modified by someone else since you fetched it. Please fetch again."
            )

    version_hash = hashlib.sha256(payload.source_code.encode("utf-8")).hexdigest()[:12]
    new_version_number = (latest_version.version_number + 1) if latest_version else 1

    version = ProgramVersion(
        program_name=payload.program_name,
        source_code=payload.source_code,
        commit_message=payload.commit_message,
        author=payload.author or "system",
        sandbox_name=payload.sandbox_name,
        version_hash=version_hash,
        version_number=new_version_number,
    )
    db.add(version)

    log = ActivityLog(
        action="COMMIT",
        username=payload.author or "system",
        program_name=payload.program_name,
        sandbox_name=payload.sandbox_name,
        detail=f"Committed {payload.program_name} ({version_hash})",
    )
    db.add(log)

    db.commit()
    db.refresh(version)
    return version


@router.get("/version/{version_id}", response_model=ProgramVersionFull)
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(ProgramVersion).filter(ProgramVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.patch("/version/{version_id}", response_model=ProgramVersionOut)
def edit_commit(version_id: int, payload: EditCommitRequest, db: Session = Depends(get_db)):
    """Edit a commit message. Only the commit's own author or a super admin may do this."""
    version = db.query(ProgramVersion).filter(ProgramVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if version.author != payload.requested_by and not _is_super_admin(db, payload.requested_by):
        raise HTTPException(
            status_code=403,
            detail="You can only edit commits you authored.",
        )

    if not payload.commit_message.strip():
        raise HTTPException(status_code=400, detail="Commit message cannot be empty.")

    version.commit_message = payload.commit_message

    db.add(ActivityLog(
        action="EDIT",
        username=payload.requested_by,
        program_name=version.program_name,
        sandbox_name=version.sandbox_name,
        detail=f"Edited commit message of {version.program_name} ({version.version_hash})",
    ))

    db.commit()
    db.refresh(version)
    return version


@router.delete("/version/{version_id}", status_code=204)
def delete_commit(version_id: int, requested_by: str = Query(...), db: Session = Depends(get_db)):
    """Delete a commit. Only the commit's own author or a super admin may do this."""
    version = db.query(ProgramVersion).filter(ProgramVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if version.author != requested_by and not _is_super_admin(db, requested_by):
        raise HTTPException(
            status_code=403,
            detail="You can only delete commits you authored.",
        )

    program_name = version.program_name
    version_hash = version.version_hash
    sandbox_name = version.sandbox_name

    db.delete(version)

    db.add(ActivityLog(
        action="DELETE",
        username=requested_by,
        program_name=program_name,
        sandbox_name=sandbox_name,
        detail=f"Deleted commit of {program_name} ({version_hash})",
    ))

    db.commit()
    return None


@router.post("/rename-program", status_code=200)
def rename_program(payload: RenameProgramRequest, db: Session = Depends(get_db)):
    """Rename a program across its entire version history.

    Rules:
      - The new name must not already be used by another program.
      - The requester must be a super admin, OR must have authored at least one
        commit of the program being renamed.
    """
    old_name = payload.old_name.strip()
    new_name = payload.new_name.strip()

    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="Program name cannot be empty.")
    if old_name == new_name:
        raise HTTPException(status_code=400, detail="New name must differ from the current name.")

    existing = (
        db.query(ProgramVersion)
        .filter(ProgramVersion.program_name == old_name)
        .first()
    )
    if not existing:
        raise HTTPException(status_code=404, detail=f"Program '{old_name}' has no version history.")

    # Block if a program with the new name already exists (case-insensitive).
    clash = (
        db.query(ProgramVersion)
        .filter(func.lower(ProgramVersion.program_name) == new_name.lower())
        .first()
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"A program named '{new_name}' already exists. Choose a different name.",
        )

    is_admin = _is_super_admin(db, payload.requested_by)
    if not is_admin:
        has_commit = (
            db.query(ProgramVersion)
            .filter(
                ProgramVersion.program_name == old_name,
                ProgramVersion.author == payload.requested_by,
            )
            .first()
        )
        if not has_commit:
            raise HTTPException(
                status_code=403,
                detail="You can only rename programs you have committed to.",
            )

    updated = (
        db.query(ProgramVersion)
        .filter(ProgramVersion.program_name == old_name)
        .update({ProgramVersion.program_name: new_name}, synchronize_session=False)
    )
    db.query(ActivityLog).filter(ActivityLog.program_name == old_name).update(
        {ActivityLog.program_name: new_name}, synchronize_session=False
    )

    db.add(ActivityLog(
        action="RENAME",
        username=payload.requested_by,
        program_name=new_name,
        detail=f"Renamed program '{old_name}' to '{new_name}' ({updated} version(s))",
    ))

    db.commit()
    return {"status": "ok", "old_name": old_name, "new_name": new_name, "versions_updated": updated}

@router.get("/history", response_model=list[ProgramVersionOut])
def get_history(program_name: str = Query(...), author: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(ProgramVersion).filter(ProgramVersion.program_name == program_name)
    if author:
        query = query.filter(ProgramVersion.author == author)
    return query.order_by(ProgramVersion.created_at.desc()).all()


@router.get("/programs", response_model=list[ProgramSummary])
def list_programs(search: str | None = Query(default=None), author: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Distinct programs ever committed, each with its most recent version info."""
    latest_per_program = (
        db.query(
            ProgramVersion.program_name,
            func.max(ProgramVersion.created_at).label("max_created_at"),
            func.count(ProgramVersion.id).label("version_count"),
        )
        .group_by(ProgramVersion.program_name)
        .subquery()
    )

    query = db.query(
        latest_per_program.c.program_name,
        latest_per_program.c.version_count,
        ProgramVersion.commit_message,
        ProgramVersion.author,
        ProgramVersion.created_at,
    ).join(
        ProgramVersion,
        (ProgramVersion.program_name == latest_per_program.c.program_name)
        & (ProgramVersion.created_at == latest_per_program.c.max_created_at),
    )

    if search:
        query = query.filter(ProgramVersion.program_name.ilike(f"%{search}%"))
    if author:
        query = query.filter(ProgramVersion.author == author)

    rows = query.order_by(latest_per_program.c.max_created_at.desc()).all()

    return [
        ProgramSummary(
            program_name=row.program_name,
            version_count=row.version_count,
            latest_commit_message=row.commit_message,
            latest_author=row.author,
            latest_created_at=row.created_at,
        )
        for row in rows
    ]
