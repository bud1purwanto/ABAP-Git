from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sandbox import Sandbox
from app.schemas import SandboxCreate, SandboxOut

router = APIRouter(prefix="/api/sandboxes", tags=["sandboxes"])


@router.get("", response_model=list[SandboxOut])
def list_sandboxes(db: Session = Depends(get_db)):
    return db.query(Sandbox).order_by(Sandbox.created_at.desc()).all()


@router.post("", response_model=SandboxOut, status_code=201)
def create_sandbox(payload: SandboxCreate, db: Session = Depends(get_db)):
    existing = db.query(Sandbox).filter(Sandbox.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Sandbox '{payload.name}' already exists")

    sandbox = Sandbox(**payload.model_dump())
    db.add(sandbox)
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.delete("/{sandbox_id}", status_code=204)
def delete_sandbox(sandbox_id: int, db: Session = Depends(get_db)):
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    db.delete(sandbox)
    db.commit()
    return None
