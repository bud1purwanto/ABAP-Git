from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sandbox import Sandbox
from app.schemas import SandboxCreate, SandboxOut, SandboxUpdate
from app.security_deps import require_super_admin

router = APIRouter(prefix="/api/sandboxes", tags=["sandboxes"])

# Environments that may only have a single server each. SANDBOX is unlimited.
SINGLETON_ENVIRONMENTS = {"DEV", "QA", "PROD"}
VALID_ENVIRONMENTS = {"SANDBOX", "DEV", "QA", "PROD"}


def _validate_environment(environment: str):
    if environment not in VALID_ENVIRONMENTS:
        raise HTTPException(status_code=400, detail=f"Environment must be one of {sorted(VALID_ENVIRONMENTS)}")


def _check_singleton(db: Session, environment: str, exclude_id: int | None = None):
    """Ensure only one server exists for DEV/QA/PROD."""
    if environment not in SINGLETON_ENVIRONMENTS:
        return
    query = db.query(Sandbox).filter(Sandbox.environment == environment)
    if exclude_id is not None:
        query = query.filter(Sandbox.id != exclude_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A {environment} server already exists ('{existing.name}'). Only one {environment} server is allowed.",
        )


@router.get("", response_model=list[SandboxOut])
def list_sandboxes(db: Session = Depends(get_db)):
    return db.query(Sandbox).order_by(Sandbox.created_at.desc()).all()


@router.post("", response_model=SandboxOut, status_code=201)
def create_sandbox(payload: SandboxCreate, db: Session = Depends(get_db)):
    require_super_admin(db, payload.requested_by)
    _validate_environment(payload.environment)

    existing = db.query(Sandbox).filter(Sandbox.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Server '{payload.name}' already exists")

    _check_singleton(db, payload.environment)

    data = payload.model_dump(exclude={"requested_by"})
    sandbox = Sandbox(**data, is_live=(payload.environment == "DEV"))
    db.add(sandbox)
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.put("/{sandbox_id}", response_model=SandboxOut)
def update_sandbox(sandbox_id: int, payload: SandboxUpdate, db: Session = Depends(get_db)):
    require_super_admin(db, payload.requested_by)
    _validate_environment(payload.environment)

    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Server not found")

    name_clash = (
        db.query(Sandbox).filter(Sandbox.name == payload.name, Sandbox.id != sandbox_id).first()
    )
    if name_clash:
        raise HTTPException(status_code=400, detail=f"Server '{payload.name}' already exists")

    _check_singleton(db, payload.environment, exclude_id=sandbox_id)

    sandbox.name = payload.name
    sandbox.host = payload.host
    sandbox.sysnr = payload.sysnr
    sandbox.client = payload.client
    sandbox.rfc_user = payload.rfc_user
    if payload.rfc_password:
        sandbox.rfc_password = payload.rfc_password
    sandbox.environment = payload.environment
    if payload.allow_multiple_logon is not None:
        sandbox.allow_multiple_logon = payload.allow_multiple_logon
    sandbox.is_live = payload.environment == "DEV"

    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.delete("/{sandbox_id}", status_code=204)
def delete_sandbox(sandbox_id: int, requested_by: str = Query(...), db: Session = Depends(get_db)):
    require_super_admin(db, requested_by)

    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Server not found")

    db.delete(sandbox)
    db.commit()
    return None
