import difflib

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sandbox import Sandbox
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.schemas import SapReadResponse, SapWriteRequest
from pydantic import BaseModel
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
        sap_service.write_program(sandbox, payload.program_name, version.source_code)
    except ValueError as exc:
        # write_program raises ValueError for syntax errors and SAP-side write failures —
        # surface these as a client error (400), not a generic 500.
        raise HTTPException(status_code=400, detail=f"Rollback failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write program to SAP: {exc}") from exc

    log = ActivityLog(
        action="PUSH",
        username=payload.author or "system",
        program_name=payload.program_name,
        sandbox_name=sandbox.name,
        detail=f"Rolled back {payload.program_name} to version {version.id} on SAP sandbox '{sandbox.name}'",
    )
    db.add(log)
    db.commit()

    return {"status": "ok", "message": f"Program {payload.program_name} rolled back to version {version.id}"}

class DeployLiveRequest(BaseModel):
    program_name: str
    version_id: int
    author: str | None = "system"


class ValidateLiveDeploymentRequest(BaseModel):
    program_name: str
    author: str | None = "system"


@router.post("/validate_live_deployment")
def validate_live_deployment_endpoint(payload: ValidateLiveDeploymentRequest, db: Session = Depends(get_db)):
    """Dry-run check of all live-deployment rules, without writing anything to SAP."""
    live_sandbox = db.query(Sandbox).filter(Sandbox.is_live == True).first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Live Development server configured. Please configure one in Sandboxes.")

    try:
        checks = sap_service.check_live_deployment_rules(live_sandbox, payload.program_name, payload.author)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run validation checks: {exc}") from exc

    return {"checks": checks, "all_passed": all(c["passed"] for c in checks)}


@router.post("/deploy_live")
def deploy_to_live(payload: DeployLiveRequest, db: Session = Depends(get_db)):
    # 1. Find live server
    live_sandbox = db.query(Sandbox).filter(Sandbox.is_live == True).first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Live Development server configured. Please configure one in Sandboxes.")

    # 2. Find version
    version = db.query(ProgramVersion).filter(ProgramVersion.id == payload.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # 3. Re-validate Live Deployment rules server-side (never trust the client-side check alone)
    try:
        checks = sap_service.check_live_deployment_rules(live_sandbox, payload.program_name, payload.author)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to validate rules: {exc}")

    failed = [c["message"] for c in checks if not c["passed"]]
    if failed:
        raise HTTPException(status_code=400, detail=" | ".join(failed))

    # 4. Write to SAP (using same BAPI/logic as rollback)
    try:
        sap_service.write_program(live_sandbox, payload.program_name, version.source_code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to deploy program to Live SAP: {exc}") from exc

    # 5. Log Activity
    log = ActivityLog(
        action="DEPLOY_LIVE",
        username=payload.author or "system",
        program_name=payload.program_name,
        sandbox_name=live_sandbox.name,
        detail=f"Deployed {payload.program_name} (v{version.version_number}) to Live Server '{live_sandbox.name}'",
    )
    db.add(log)
    db.commit()

    return {"status": "ok", "message": f"Program {payload.program_name} successfully deployed to Live!"}

class SyncCompareRequest(BaseModel):
    sandbox_id: int
    program_name: str


class SyncApplyRequest(BaseModel):
    sandbox_id: int
    program_name: str
    author: str | None = "system"


def _sources_identical(a: str, b: str) -> bool:
    """Compare two ABAP sources ignoring trailing whitespace per line (same
    normalization used by the diff viewer) so cosmetic whitespace doesn't count."""
    norm_a = [line.rstrip() for line in (a or "").splitlines()]
    norm_b = [line.rstrip() for line in (b or "").splitlines()]
    return norm_a == norm_b


@router.post("/sync/compare")
def sync_compare(payload: SyncCompareRequest, db: Session = Depends(get_db)):
    """Read the same program from the Live server and from the selected sandbox so the
    UI can show a side-by-side diff. Direction of a later sync: Live -> sandbox."""
    live = db.query(Sandbox).filter(Sandbox.is_live == True).first()
    if not live:
        raise HTTPException(status_code=400, detail="No Live Development server configured. Please configure one in Servers.")

    target = db.query(Sandbox).filter(Sandbox.id == payload.sandbox_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if target.is_live:
        raise HTTPException(status_code=400, detail="Cannot sync the Live server with itself. Pick a different sandbox.")

    try:
        live_source = sap_service.read_program(live, payload.program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read program from Live server: {exc}") from exc

    # If the program doesn't exist yet in the sandbox, treat its source as empty so the
    # diff shows everything as new and a sync can create it.
    try:
        sandbox_source = sap_service.read_program(target, payload.program_name)
    except Exception:
        sandbox_source = ""

    return {
        "program_name": payload.program_name,
        "live_source": live_source,
        "sandbox_source": sandbox_source,
        "identical": _sources_identical(live_source, sandbox_source),
        "live_name": live.name,
        "sandbox_name": target.name,
    }


@router.post("/sync/apply")
def sync_apply(payload: SyncApplyRequest, db: Session = Depends(get_db)):
    """Overwrite the program in the selected sandbox with the Live server's version."""
    live = db.query(Sandbox).filter(Sandbox.is_live == True).first()
    if not live:
        raise HTTPException(status_code=400, detail="No Live Development server configured.")

    target = db.query(Sandbox).filter(Sandbox.id == payload.sandbox_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if target.is_live:
        raise HTTPException(status_code=400, detail="Cannot sync the Live server with itself.")

    try:
        live_source = sap_service.read_program(live, payload.program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read program from Live server: {exc}") from exc

    try:
        sandbox_source = sap_service.read_program(target, payload.program_name)
    except Exception:
        sandbox_source = ""

    if _sources_identical(live_source, sandbox_source):
        raise HTTPException(status_code=400, detail="Sandbox is already in sync with Live. Nothing to do.")

    try:
        sap_service.write_program(target, payload.program_name, live_source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Sync failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write program to sandbox: {exc}") from exc

    log = ActivityLog(
        action="SYNC",
        username=payload.author or "system",
        program_name=payload.program_name,
        sandbox_name=target.name,
        detail=f"Synced {payload.program_name} from Live '{live.name}' into sandbox '{target.name}'",
    )
    db.add(log)
    db.commit()

    return {"status": "ok", "message": f"Program {payload.program_name} synced from Live into '{target.name}'."}


@router.get("/debug/live-user-list")
def debug_live_user_list(db: Session = Depends(get_db)):
    """Diagnostic endpoint: dump the raw TH_USER_LIST from the Live server so we can see
    exactly who SAP reports as logged on. Hit this while logged OUT, then again while
    logged IN, and compare."""
    live_sandbox = db.query(Sandbox).filter(Sandbox.is_live == True).first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Live Development server configured.")
    try:
        return sap_service.debug_user_list(live_sandbox)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read user list: {exc}") from exc


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
