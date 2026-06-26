import hashlib

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.schemas import CommitRequest, ProgramVersionOut, ProgramSummary, ProgramVersionFull

router = APIRouter(prefix="/api/git", tags=["git"])


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
