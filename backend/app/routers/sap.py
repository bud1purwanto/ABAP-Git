import difflib
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from sqlalchemy import desc

from app.database import get_db
from app.models.sandbox import Sandbox
from app.models.program_version import ProgramVersion
from app.models.activity_log import ActivityLog
from app.models.project import Project
from app.schemas import SapReadResponse, SapWriteRequest, SapTestConnectionRequest, ScanUndeployedRequest, MassDeployRequest
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

    query = db.query(ProgramVersion).filter(
        ProgramVersion.program_name == program_name,
        ProgramVersion.sandbox_name == sandbox.name
    )
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

    # Extract includes from SAP source code, but only custom ones (Z* or Y*)
    include_matches = re.findall(r'^\s*INCLUDE\s+([A-Z0-9_]+)\s*\.', sap_source, re.IGNORECASE | re.MULTILINE)
    includes = list(set(inc.upper() for inc in include_matches if inc.upper().startswith("Z") or inc.upper().startswith("Y")))

    return SapReadResponse(
        program_name=program_name,
        sap_source=sap_source,
        db_source=db_source,
        diff=diff_text,
        version_id=version.id if version else None,
        parent_version_hash=version.version_hash if version else None,
        tcode=program_tcode,
        includes=includes,
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
    live_sandbox = db.query(Sandbox).filter(Sandbox.environment == "DEV").first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Development server configured. Please configure one in Servers.")

    try:
        checks = sap_service.check_live_deployment_rules_sequential(live_sandbox, payload.program_name, payload.author)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run validation checks: {exc}") from exc

    return {"checks": checks, "all_passed": all(c["passed"] for c in checks)}


@router.post("/deploy_live")
def deploy_to_live(payload: DeployLiveRequest, db: Session = Depends(get_db)):
    # 1. Find live server
    live_sandbox = db.query(Sandbox).filter(Sandbox.environment == "DEV").first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Development server configured. Please configure one in Servers.")

    # 2. Find version
    version = db.query(ProgramVersion).filter(ProgramVersion.id == payload.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # 3. Re-validate Live Deployment rules server-side (never trust the client-side check alone)
    try:
        checks = sap_service.check_live_deployment_rules_sequential(live_sandbox, payload.program_name, payload.author)
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
    source_id: int
    target_id: int
    program_name: str


class SyncApplyRequest(BaseModel):
    source_id: int
    target_id: int
    program_name: str
    author: str | None = "system"


def _sources_identical(a: str, b: str) -> bool:
    """Compare two ABAP sources ignoring trailing whitespace per line (same
    normalization used by the diff viewer) so cosmetic whitespace doesn't count."""
    norm_a = [line.rstrip() for line in (a or "").splitlines()]
    norm_b = [line.rstrip() for line in (b or "").splitlines()]
    return norm_a == norm_b


def _resolve_sync_servers(db: Session, source_id: int, target_id: int):
    """Validate and return (source, target) for a sync. The source must be a non-sandbox
    server (DEV/QA/PROD), and the target must be a SANDBOX server."""
    source = db.query(Sandbox).filter(Sandbox.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source server not found")
    target = db.query(Sandbox).filter(Sandbox.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target sandbox not found")
    if source.environment == "SANDBOX":
        raise HTTPException(status_code=400, detail="Sync source must be a Development, QA, or Production server.")
    if target.environment != "SANDBOX":
        raise HTTPException(status_code=400, detail="Sync target must be a sandbox.")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="Source and target must be different servers.")
    return source, target


@router.post("/sync/compare")
def sync_compare(payload: SyncCompareRequest, db: Session = Depends(get_db)):
    """Read the same program from the source server and the target sandbox so the UI can
    show a side-by-side diff. Direction of a later sync: source -> sandbox."""
    source, target = _resolve_sync_servers(db, payload.source_id, payload.target_id)

    # Audit Rule: If source restricts multiple logon, ensure no active dialog session
    if source.environment != "SANDBOX" and not source.allow_multiple_logon:
        logon_check = sap_service.check_multiple_logon(source, "system")
        if not logon_check["passed"]:
            raise HTTPException(status_code=403, detail=f"Audit rule: Source server '{source.name}' has an active dialog session. Data fetch blocked.")

    try:
        source_source = sap_service.read_program(source, payload.program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read program from '{source.name}': {exc}") from exc

    # If the program doesn't exist yet in the sandbox, treat its source as empty so the
    # diff shows everything as new and a sync can create it.
    try:
        sandbox_source = sap_service.read_program(target, payload.program_name)
    except Exception:
        sandbox_source = ""

    # Get transport info
    source_transport = _get_server_transport_info(source, payload.program_name, db)
    sandbox_transport = _get_server_transport_info(target, payload.program_name, db)

    return {
        "program_name": payload.program_name,
        "source_code": source_source,
        "sandbox_source": sandbox_source,
        "identical": _sources_identical(source_source, sandbox_source),
        "source_name": source.name,
        "source_environment": source.environment,
        "sandbox_name": target.name,
        "source_transport": source_transport,
        "sandbox_transport": sandbox_transport,
    }


@router.post("/sync/apply")
def sync_apply(payload: SyncApplyRequest, db: Session = Depends(get_db)):
    """Overwrite the program in the target sandbox with the source server's version."""
    source, target = _resolve_sync_servers(db, payload.source_id, payload.target_id)

    # Audit Rule: If source restricts multiple logon, ensure no active dialog session
    if source.environment != "SANDBOX" and not source.allow_multiple_logon:
        logon_check = sap_service.check_multiple_logon(source, payload.author)
        if not logon_check["passed"]:
            raise HTTPException(status_code=403, detail=f"Audit rule: Source server '{source.name}' has an active dialog session. Sync blocked.")

    try:
        source_source = sap_service.read_program(source, payload.program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read program from '{source.name}': {exc}") from exc

    try:
        sandbox_source = sap_service.read_program(target, payload.program_name)
    except Exception:
        sandbox_source = ""

    if _sources_identical(source_source, sandbox_source):
        raise HTTPException(status_code=400, detail="Sandbox is already in sync with the source. Nothing to do.")

    try:
        sap_service.write_program(target, payload.program_name, source_source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Sync failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write program to sandbox: {exc}") from exc

    log = ActivityLog(
        action="SYNC",
        username=payload.author or "system",
        program_name=payload.program_name,
        sandbox_name=target.name,
        detail=f"Synced {payload.program_name} from {source.environment} '{source.name}' into sandbox '{target.name}'",
    )
    db.add(log)
    db.commit()

    return {"status": "ok", "message": f"Program {payload.program_name} synced from '{source.name}' into '{target.name}'."}


# Environment hierarchy ranks: lower number = lower in the promotion chain.
ENV_RANK = {"SANDBOX": 0, "DEV": 1, "QA": 2, "PROD": 3}


class CompareServersRequest(BaseModel):
    left_id: int
    right_id: int
    program_name: str


def _get_server_transport_info(server: Sandbox, program_name: str, db: Session):
    if server.environment == "SANDBOX":
        # For Sandbox, check if there are Git commits
        latest = db.query(ProgramVersion).filter(
            ProgramVersion.program_name == program_name,
            ProgramVersion.sandbox_name == server.name
        ).order_by(ProgramVersion.created_at.desc()).first()
        
        if latest:
            return {
                "package": "Git",
                "cr_number": "Latest Commit",
                "cr_description": latest.commit_message,
                "cr_status": f"v{latest.version_number}"
            }
        return {"package": None, "cr_number": None, "cr_description": None, "cr_status": None}
    
    return sap_service.get_object_transport_info(server, program_name)


@router.post("/compare")
def compare_servers(payload: CompareServersRequest, db: Session = Depends(get_db)):
    """Read-only comparison of a program between two servers. The right server must be
    strictly lower in the environment hierarchy than the left (Sandbox < DEV < QA < PROD)."""
    left = db.query(Sandbox).filter(Sandbox.id == payload.left_id).first()
    if not left:
        raise HTTPException(status_code=404, detail="Left server not found")
    right = db.query(Sandbox).filter(Sandbox.id == payload.right_id).first()
    if not right:
        raise HTTPException(status_code=404, detail="Right server not found")
    if left.id == right.id:
        raise HTTPException(status_code=400, detail="Pick two different servers to compare.")
    if ENV_RANK.get(right.environment, 0) >= ENV_RANK.get(left.environment, 0):
        raise HTTPException(
            status_code=400,
            detail="Right server must be strictly lower in the promotion path than left server.",
        )

    # Audit Rule: For non-sandbox servers that restrict multiple logon, block fetch if session is active
    for server in (left, right):
        if server.environment != "SANDBOX" and not server.allow_multiple_logon:
            logon_check = sap_service.check_multiple_logon(server, "system")
            if not logon_check["passed"]:
                raise HTTPException(status_code=403, detail=f"Audit rule: Server '{server.name}' has an active dialog session. Data fetch blocked.")

    # Tolerate a program missing on either side — show it as empty so the diff still renders.
    try:
        left_source = sap_service.read_program(left, payload.program_name)
    except Exception:
        left_source = ""

    try:
        right_source = sap_service.read_program(right, payload.program_name)
    except Exception:
        right_source = ""

    left_transport = _get_server_transport_info(left, payload.program_name, db)
    right_transport = _get_server_transport_info(right, payload.program_name, db)

    return {
        "program_name": payload.program_name,
        "left_source": left_source,
        "right_source": right_source,
        "identical": _sources_identical(left_source, right_source),
        "left_name": left.name,
        "left_environment": left.environment,
        "right_name": right.name,
        "right_environment": right.environment,
        "left_transport": left_transport,
        "right_transport": right_transport,
    }


@router.get("/debug/live-user-list")
def debug_live_user_list(db: Session = Depends(get_db)):
    """Diagnostic endpoint: dump the raw TH_USER_LIST from the Live server so we can see
    exactly who SAP reports as logged on. Hit this while logged OUT, then again while
    logged IN, and compare."""
    live_sandbox = db.query(Sandbox).filter(Sandbox.environment == "DEV").first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Development server configured.")
    try:
        return sap_service.debug_user_list(live_sandbox)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read user list: {exc}") from exc


@router.get("/{sandbox_id}/logon-check")
def logon_check(sandbox_id: int, author: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Check for multiple logon (active interactive sessions) on a server. DEV/QA/PROD
    systems forbid multiple logon for audit reasons; SANDBOX servers are exempt."""
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Server not found")

    if sandbox.environment == "SANDBOX" or sandbox.allow_multiple_logon:
        return {
            "applicable": False,
            "environment": sandbox.environment,
            "server_name": sandbox.name,
            "passed": True,
            "conflicting_user": None,
            "conflicting_terminal": None,
            "dialog_sessions": [],
        }

    try:
        result = sap_service.check_multiple_logon(sandbox, author)
    except Exception as exc:
        # Fail-closed: cannot verify → block access
        raise HTTPException(status_code=503, detail=f"Cannot verify logon status on '{sandbox.name}': {exc}") from exc

    return {
        "applicable": True,
        "environment": sandbox.environment,
        "server_name": sandbox.name,
        **result,
    }


@router.get("/{sandbox_id}/lock-check")
def lock_check(sandbox_id: int, program: str = Query(...), db: Session = Depends(get_db)):
    """Check whether a program is currently locked/edited on a sandbox server."""
    sandbox = db.query(Sandbox).filter(Sandbox.id == sandbox_id).first()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Server not found")

    try:
        conn = sap_service._connect(sandbox)
        try:
            res = conn.call("ENQUEUE_READ", GNAME="TRDIR", GARG=program)
            locks = res.get("ENQ", [])
            if locks:
                lock_user = str(locks[0].get("GUNAME", "Unknown")).strip()
                return {"passed": False, "lock_user": lock_user,
                        "message": f"'{program}' is currently locked by '{lock_user}'."}
            return {"passed": True, "lock_user": None, "message": f"'{program}' is not locked."}
        finally:
            conn.close()
    except Exception as exc:
        # Fail-closed
        raise HTTPException(status_code=503, detail=f"Cannot verify lock status: {exc}") from exc


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


@router.post("/test-connection")
def test_connection(payload: SapTestConnectionRequest, db: Session = Depends(get_db)):
    """Test SAP connection using provided credentials (without saving them)."""
    password = payload.rfc_password

    # If editing an existing sandbox and password wasn't changed/provided, fetch it from DB
    if not password and payload.sandbox_id:
        existing = db.query(Sandbox).filter(Sandbox.id == payload.sandbox_id).first()
        if existing:
            password = existing.rfc_password

    if not password:
        raise HTTPException(status_code=400, detail="RFC Password is required for connection test")

    # Create a dummy Sandbox object in memory to pass to sap_service._connect
    temp_sandbox = Sandbox(
        host=payload.host,
        sysnr=payload.sysnr,
        client=payload.client,
        rfc_user=payload.rfc_user,
        rfc_password=password
    )

    try:
        conn = sap_service._connect(temp_sandbox)
        try:
            conn.ping()
        finally:
            conn.close()
        return {"passed": True, "message": "Connection successful"}
    except Exception as exc:
        return {"passed": False, "message": str(exc)}


@router.post("/scan_undeployed")
def scan_undeployed(payload: ScanUndeployedRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    live_sandbox = db.query(Sandbox).filter(Sandbox.environment == "DEV").first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Development server configured.")

    undeployed_programs = []
    scanned_set = set()
    queue = [{"name": p.program_name, "tcode": p.tcode} for p in project.programs]

    while queue:
        item = queue.pop(0)
        pname = item["name"]
        
        if pname.upper() in scanned_set:
            continue
        scanned_set.add(pname.upper())

        # Compare latest DB version with DEV server early to skip uncommitted programs
        latest_version = db.query(ProgramVersion).filter(
            ProgramVersion.program_name == pname,
            ProgramVersion.sandbox_name == project.sandbox.name
        ).order_by(desc(ProgramVersion.created_at)).first()

        if not latest_version:
            continue

        # Check live deployment rules
        try:
            checks = sap_service.check_live_deployment_rules_sequential(live_sandbox, pname, payload.author)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Validation failed for {pname}: {exc}")

        failed_checks = [c for c in checks if not c["passed"]]
        if failed_checks:
            return {
                "status": "failed",
                "program_name": pname,
                "tcode": item["tcode"],
                "failed_rule": failed_checks[0]["key"],
                "message": failed_checks[0]["message"]
            }

        try:
            dev_source = sap_service.read_program(live_sandbox, pname)
        except Exception:
            continue

        # Extract custom includes (Z* or Y*)
        include_matches = re.findall(r'^\s*INCLUDE\s+([A-Z0-9_]+)\s*\.', dev_source, re.IGNORECASE | re.MULTILINE)
        for inc in include_matches:
            inc_upper = inc.upper()
            if (inc_upper.startswith("Z") or inc_upper.startswith("Y")) and inc_upper not in scanned_set:
                queue.append({"name": inc_upper, "tcode": None})

        if _diff(latest_version.source_code, dev_source).strip() != "":
            undeployed_programs.append({
                "program_name": pname,
                "tcode": item["tcode"]
            })

    return {
        "status": "success",
        "undeployed": undeployed_programs
    }


@router.post("/mass_deploy_live")
def mass_deploy_to_live(payload: MassDeployRequest, db: Session = Depends(get_db)):
    live_sandbox = db.query(Sandbox).filter(Sandbox.environment == "DEV").first()
    if not live_sandbox:
        raise HTTPException(status_code=400, detail="No Development server configured.")

    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    results = []
    
    for prog_name in payload.program_names:
        version = db.query(ProgramVersion).filter(
            ProgramVersion.program_name == prog_name,
            ProgramVersion.sandbox_name == project.sandbox.name
        ).order_by(desc(ProgramVersion.created_at)).first()
        
        if not version:
            continue

        try:
            sap_service.write_program(live_sandbox, prog_name, version.source_code)
            
            log = ActivityLog(
                action="DEPLOY_LIVE",
                username=payload.author or "system",
                program_name=prog_name,
                sandbox_name=live_sandbox.name,
                detail=f"Mass deployed {prog_name} (v{version.version_number}) to Live Server '{live_sandbox.name}'",
            )
            db.add(log)
            results.append({"program": prog_name, "status": "success"})
        except Exception as exc:
            results.append({"program": prog_name, "status": "failed", "error": str(exc)})

    db.commit()
    return {"status": "ok", "results": results}
