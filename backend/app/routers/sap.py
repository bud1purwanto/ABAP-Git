import difflib

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sandbox import Sandbox
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.schemas import SapReadResponse, SapWriteRequest
from app.services import sap_service

router = APIRouter(prefix="/api/sap", tags=["sap"])


def _diff(db_source: str, sap_source: str) -> str:
    db_lines = [line.rstrip() for line in db_source.splitlines()]
    sap_lines = [line.rstrip() for line in sap_source.splitlines()]
    diff_lines = difflib.unified_diff(db_lines, sap_lines, fromfile="db_version", tofile="sap_current", lineterm="")
    return "\n".join(diff_lines)


@router.get("/read", response_model=SapReadResponse)
def read_from_sap(
    program_name: str = Query(...),
    sandbox_id: int = Query(...),
    version_id: int | None = Query(default=None),
    author: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    try:
        sap_source = sap_service.read_program(sandbox, program_name)
        program_tcode = sap_service.get_tcode_for_program(sandbox, program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read program from SAP: {exc}") from exc

    query = db.query(ProgramVersion).filter(ProgramVersion.program_name == program_name)
    if version_id is not None:
        version = query.filter(ProgramVersion.id == version_id).first()
    else:
        version = query.order_by(ProgramVersion.created_at.desc()).first()

    db_source = version.source_code if version else ""
    diff_text = _diff(db_source, sap_source)

    log = ActivityLog(
        action="PULL",
        username=author or "system",
        program_name=program_name,
        sandbox_name=sandbox.name,
        detail=f"Read {program_name} from SAP sandbox '{sandbox.name}'",
    )
    db.add(log)
    db.commit()

    return SapReadResponse(
        program_name=program_name,
        sap_source=sap_source,
        db_source=db_source,
        diff=diff_text,
        version_id=version.id if version else None,
        parent_version_hash=version.version_hash if version else None,
        tcode=program_tcode,
    )


@router.post("/write")
def write_to_sap(payload: SapWriteRequest, db: Session = Depends(get_db)):
    sandbox = db.query(Sandbox).filter(Sandbox.id == payload.sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    version = db.query(ProgramVersion).filter(ProgramVersion.id == payload.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    try:
        syntax_res = sap_service.check_syntax(sandbox, payload.program_name, version.source_code)
        if not syntax_res.get("valid"):
            msg = syntax_res.get("message", "Syntax error")
            line = syntax_res.get("line", 0)
            raise HTTPException(status_code=400, detail=f"Rollback failed: Syntax error at line {line}: {msg}")

        sap_service.write_program(sandbox, payload.program_name, version.source_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write program to SAP: {exc}") from exc

    log = ActivityLog(
        action="PUSH",
        program_name=payload.program_name,
        sandbox_name=sandbox.name,
        detail=f"Rolled back {payload.program_name} to version {version.id} on SAP sandbox '{sandbox.name}'",
    )
    db.add(log)
    db.commit()

    return {"status": "ok", "message": f"Program {payload.program_name} rolled back to version {version.id}"}

@router.get("/{sandbox_id}/tcodes")
def get_tcodes(sandbox_id: int, db: Session = Depends(get_db)):
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    try:
        return {"data": sap_service.get_tcodes(sandbox)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch T-Codes: {exc}") from exc

@router.get("/{sandbox_id}/programs")
def get_programs(sandbox_id: int, db: Session = Depends(get_db)):
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    try:
        return {"data": sap_service.get_programs(sandbox)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch programs: {exc}") from exc

@router.get("/{sandbox_id}/program-includes")
def get_program_includes(sandbox_id: int, program: str = Query(...), db: Session = Depends(get_db)):
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    try:
        return {"data": sap_service.get_program_includes(sandbox, program)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch program includes: {exc}") from exc
