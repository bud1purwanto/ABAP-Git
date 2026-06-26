from app.models.sandbox import Sandbox


def _get_connection_class():
    try:
        from pyrfc import Connection
    except ImportError as exc:
        raise RuntimeError(
            "pyrfc is not installed. It requires the SAP NetWeaver RFC SDK to be "
            "installed on this machine first (see SAP Note 2573790), then run "
            "'pip install pyrfc' inside the backend venv."
        ) from exc
    return Connection


def _connect(sandbox: Sandbox):
    Connection = _get_connection_class()
    return Connection(
        ashost=sandbox.host,
        sysnr=sandbox.sysnr,
        client=sandbox.client,
        user=sandbox.rfc_user,
        passwd=sandbox.rfc_password,
    )


def read_program(sandbox: Sandbox, program_name: str) -> str:
    """Fetch ABAP source code from SAP via RPY_PROGRAM_READ."""
    conn = _connect(sandbox)
    try:
        result = conn.call("RPY_PROGRAM_READ", PROGRAM_NAME=program_name)
        source_lines = result.get("SOURCE_EXTENDED") or result.get("SOURCE", [])
        lines = [row["LINE"] if isinstance(row, dict) else row for row in source_lines]
        return "\n".join(lines)
    finally:
        conn.close()


def check_syntax(sandbox: Sandbox, program_name: str, source_code: str) -> dict:
    """Check ABAP syntax using SYNTAX_CHECK RFC.
    Returns {"valid": bool, "message": str, "line": int}
    """
    conn = _connect(sandbox)
    try:
        program_lines = [{"LINE": line} for line in source_code.split("\n")]
        # Provide PROGRAM to specify the program name and SOURCE for the lines
        result = conn.call(
            "SYNTAX_CHECK",
            PROGRAM=program_name,
            SOURCE=program_lines,
        )
        # SYNTAX_CHECK returns MESSAGE, LINE, WORD, ERROR (if any)
        error_msg = result.get("MESSAGE")
        if error_msg and error_msg.strip():
            return {"valid": False, "message": error_msg.strip(), "line": result.get("LINE")}
        return {"valid": True, "message": "Syntax is correct.", "line": 0}
    except Exception as exc:
        # If SYNTAX_CHECK is missing or inaccessible, we fall back to valid to not block the rollback.
        return {"valid": True, "message": f"Syntax check skipped due to error: {exc}", "line": 0}
    finally:
        conn.close()


def write_program(sandbox: Sandbox, program_name: str, source_code: str) -> None:
    """Install ABAP source code back into SAP via RFC_ABAP_INSTALL_AND_RUN (MODE='I')."""
    
    # 1. Syntax check before writing
    syntax = check_syntax(sandbox, program_name, source_code)
    if not syntax.get("valid"):
        line_info = f" in line {syntax.get('line')}" if syntax.get("line") else ""
        raise ValueError(f"Syntax Error{line_info}: {syntax.get('message')}")

    conn = _connect(sandbox)
    try:
        # 3. Write program using Custom RFC
        program_lines = [{"LINE": line} for line in source_code.split("\n")]
        try:
            res = conn.call(
                "Z_RFC_PROGRAM_UPDATE",
                IV_PROGRAM_NAME=program_name,
                IV_PACKAGE="$TMP",
                IT_SOURCE=program_lines
            )
        except Exception as e:
            err_str = str(e)
            if "CALL_FUNCTION_PARM_UNKNOWN" in err_str:
                raise ValueError(
                    f"Terdapat bug (typo) di dalam ABAP Function Module Z_RFC_PROGRAM_UPDATE di SAP Anda: {err_str}. "
                    "Sepertinya ada pemanggilan parameter 'CORR_NUMBER' yang salah nama."
                ) from e
            raise ValueError(f"Gagal memanggil Z_RFC_PROGRAM_UPDATE: {e}") from e

        if res and res.get("EV_SUCCESS") != "X" and res.get("EV_MESSAGE"):
            raise ValueError(f"SAP Write Error: {res.get('EV_MESSAGE')}")
    finally:
        conn.close()

def get_tcodes(sandbox: Sandbox) -> list[dict]:
    """Fetch Z* T-codes and their associated programs from TSTC."""
    conn = _connect(sandbox)
    try:
        result = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="TSTC",
            DELIMITER="|",
            OPTIONS=[{"TEXT": "TCODE LIKE 'Z%' AND PGMNA <> ' '"}],
            FIELDS=[{"FIELDNAME": "TCODE"}, {"FIELDNAME": "PGMNA"}],
            ROWCOUNT=1000
        )
        tcodes = []
        for row in result.get("DATA", []):
            parts = row["WA"].split("|")
            tcode = parts[0].strip()
            program = parts[1].strip() if len(parts) > 1 else ""
            if tcode:
                tcodes.append({"tcode": tcode, "program": program})
        return tcodes
    finally:
        conn.close()

def get_programs(sandbox: Sandbox) -> list[dict]:
    """Fetch all Z* programs from TRDIR."""
    conn = _connect(sandbox)
    try:
        result = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="TRDIR",
            DELIMITER="|",
            OPTIONS=[{"TEXT": "NAME LIKE 'Z%'"}],
            FIELDS=[{"FIELDNAME": "NAME"}],
            ROWCOUNT=1000
        )
        programs = []
        for row in result.get("DATA", []):
            parts = row["WA"].split("|")
            name = parts[0].strip()
            if name:
                programs.append({"name": name})
        return programs
    finally:
        conn.close()

def get_program_includes(sandbox: Sandbox, program_name: str) -> list[str]:
    """Fetch custom Z* includes for a given master program from D010INC."""
    conn = _connect(sandbox)
    try:
        result = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="D010INC",
            DELIMITER="|",
            OPTIONS=[{"TEXT": f"MASTER = '{program_name}' AND INCLUDE LIKE 'Z%'"}],
            FIELDS=[{"FIELDNAME": "INCLUDE"}],
            ROWCOUNT=100
        )
        includes = []
        for row in result.get("DATA", []):
            parts = row["WA"].split("|")
            include_name = parts[0].strip()
            if include_name:
                includes.append(include_name)
        return includes
    finally:
        conn.close()

def get_tcode_for_program(sandbox: Sandbox, program_name: str) -> str | None:
    """Fetch the T-Code for a specific program from TSTC, if any."""
    conn = _connect(sandbox)
    try:
        result = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="TSTC",
            DELIMITER="|",
            OPTIONS=[{"TEXT": f"PGMNA = '{program_name}'"}],
            FIELDS=[{"FIELDNAME": "TCODE"}],
            ROWCOUNT=1
        )
        data = result.get("DATA", [])
        if data:
            return data[0]["WA"].split("|")[0].strip()
        return None
    except Exception:
        return None
    finally:
        conn.close()

def debug_user_list(sandbox: Sandbox) -> dict:
    """Diagnostic: return the raw TH_USER_LIST so we can see exactly which users/sessions
    SAP reports as logged on (including session type), instead of guessing."""
    conn = _connect(sandbox)
    try:
        res = conn.call("TH_USER_LIST")
        user_list = res.get("USRLIST", [])
        # Return every field of every entry verbatim so we can inspect BNAME, TYPE,
        # TERMINAL, etc. and figure out how to distinguish a real dialog logon from the
        # RFC connection this very call is using.
        return {
            "rfc_user_used_for_this_call": sandbox.rfc_user,
            "entry_count": len(user_list),
            "entries": [dict(entry) for entry in user_list],
        }
    finally:
        conn.close()


def check_multiple_logon(sandbox: Sandbox, author: str | None = None) -> dict:
    """Inspect TH_USER_LIST and report active interactive (dialog) sessions on a server.

    TH_USER_LIST returns both real SAPGUI dialog sessions AND backend RFC connections
    (including the one this very call uses). We filter to genuine dialog sessions by
    RFC_TYPE being blank — an RFC connection has RFC_TYPE set (e.g. "E").

    A "multiple logon" conflict is flagged when the shared rfc_user (the account the
    middleware connects with) OR the current operator (author) already has a dialog
    session open — that would mean the same account is logged on more than once, which
    DEV/QA/PROD systems forbid for audit reasons.

    Returns: {passed, conflicting_user, dialog_sessions: [{username, terminal, tcode}]}
    """
    conn = _connect(sandbox)
    try:
        res = conn.call("TH_USER_LIST")
        user_list = res.get("USRLIST", [])
        dialog_sessions = []
        for u in user_list:
            if str(u.get("RFC_TYPE", "")).strip():
                continue  # skip RFC connections, keep only dialog logons
            dialog_sessions.append(
                {
                    "username": str(u.get("BNAME", "")).strip(),
                    "terminal": str(u.get("TERM", "")).strip(),
                    "tcode": str(u.get("TCODE", "")).strip(),
                }
            )

        watched = {u.upper() for u in (author, sandbox.rfc_user) if u}
        conflicting_user = None
        conflicting_terminal = None
        for d in dialog_sessions:
            if d["username"].upper() in watched:
                conflicting_user = d["username"]
                conflicting_terminal = d["terminal"] or None
                break

        return {
            "passed": conflicting_user is None,
            "conflicting_user": conflicting_user,
            "conflicting_terminal": conflicting_terminal,
            "dialog_sessions": dialog_sessions,
        }
    finally:
        conn.close()


def check_live_deployment_rules_sequential(sandbox: Sandbox, program_name: str, author: str) -> list[dict]:
    """
    Runs rules sequentially and STOPS immediately at the first failure.
    All rules are fail-CLOSED: if an RFC call errors out, the rule is marked as FAILED
    (not skipped) so an unavailable RFC never silently grants access.

    Returns a list of {key, label, passed, message} dicts only up to the
    last rule that was actually evaluated (remaining rules are not included).
    """
    results = []

    def add(key, label, passed, message):
        results.append({"key": key, "label": label, "passed": passed, "message": message})
        return passed

    # ── Rule 1: Multiple Logon (fail-closed) ──────────────────────────────────
    try:
        logon = check_multiple_logon(sandbox, author)
        if logon["conflicting_user"]:
            terminal = logon.get("conflicting_terminal")
            terminal_info = f" (PC/Terminal: {terminal})" if terminal else ""
            add("multiple_logon", "Multiple Logon Check", False,
                f"User '{logon['conflicting_user']}'{terminal_info} still has an active dialog session on the Live server. "
                "Log out of SAP GUI first, then retry.")
            return results  # STOP
        ok = add("multiple_logon", "Multiple Logon Check", True,
                 "No active dialog session detected.")
    except Exception as exc:
        add("multiple_logon", "Multiple Logon Check", False,
            f"Cannot verify logon status (RFC unavailable: {exc}). "
            "Deploy blocked for audit safety — contact Basis to grant TH_USER_LIST access.")
        return results  # STOP

    # ── Rule 2: SAP Lock / Edit-in-progress (fail-closed) ────────────────────
    conn = _connect(sandbox)
    try:
        try:
            res = conn.call("ENQUEUE_READ", GNAME="TRDIR", GARG=program_name)
            locks = res.get("ENQ", [])
            if locks:
                lock_user = locks[0].get("GUNAME", "Unknown")
                add("sap_lock", "SAP Lock / Edit Check", False,
                    f"Program '{program_name}' is currently being edited/locked by user '{lock_user}'. "
                    "Wait for them to finish and release the lock.")
                return results  # STOP
            add("sap_lock", "SAP Lock / Edit Check", True,
                "Program is not currently locked by any user.")
        except Exception as exc:
            add("sap_lock", "SAP Lock / Edit Check", False,
                f"Cannot verify lock status (RFC unavailable: {exc}). "
                "Deploy blocked for audit safety.")
            return results  # STOP

        # ── Rule 3: Package = ZTRD (fail-closed) ─────────────────────────────
        try:
            res_tadir = conn.call(
                "RFC_READ_TABLE",
                QUERY_TABLE="TADIR",
                DELIMITER="|",
                OPTIONS=[{"TEXT": f"PGMID = 'R3TR' AND OBJECT = 'PROG' AND OBJ_NAME = '{program_name}'"}],
                FIELDS=[{"FIELDNAME": "OBJ_NAME"}, {"FIELDNAME": "DEVCLASS"}],
                ROWCOUNT=50,
            )
            tadir_data = res_tadir.get("DATA", [])
            matched_devclass = None
            for row in tadir_data:
                parts = row["WA"].split("|")
                if len(parts) >= 2 and parts[0].strip().upper() == program_name.upper():
                    matched_devclass = parts[1].strip()
                    break

            if matched_devclass is None:
                add("package", "Package Check (ZTRD)", False,
                    f"Program '{program_name}' was not found in the Live server's object repository (TADIR). "
                    "It must be registered under package ZTRD before it can be deployed.")
                return results  # STOP
            if matched_devclass != "ZTRD":
                add("package", "Package Check (ZTRD)", False,
                    f"Program must belong to package ZTRD. "
                    f"Current package is '{matched_devclass}'. Move it to ZTRD via SE80 / TADIR.")
                return results  # STOP
            add("package", "Package Check (ZTRD)", True,
                f"Program is correctly registered under package ZTRD.")
        except Exception as exc:
            add("package", "Package Check (ZTRD)", False,
                f"Could not verify package (RFC error: {exc}). Deploy blocked.")
            return results  # STOP

        # ── Rule 4: Open Transport Request (fail-closed) ─────────────────────
        try:
            res_e071 = conn.call(
                "RFC_READ_TABLE",
                QUERY_TABLE="E071",
                DELIMITER="|",
                OPTIONS=[{"TEXT": f"PGMID = 'R3TR' AND OBJECT = 'PROG' AND OBJ_NAME = '{program_name}'"}],
                FIELDS=[{"FIELDNAME": "OBJ_NAME"}, {"FIELDNAME": "TRKORR"}],
                ROWCOUNT=50,
            )
            tr_list = []
            for row in res_e071.get("DATA", []):
                parts = row["WA"].split("|")
                if len(parts) >= 2 and parts[0].strip().upper() == program_name.upper():
                    tr_list.append(parts[1].strip())

            if not tr_list:
                add("transport_request", "Transport Request Check", False,
                    f"Program '{program_name}' is not included in any Transport Request. "
                    "Add it to an open CR via SE09 / SE10 before deploying.")
                return results  # STOP

            tr_in_clause = ", ".join([f"'{tr}'" for tr in tr_list])
            res_e070 = conn.call(
                "RFC_READ_TABLE",
                QUERY_TABLE="E070",
                DELIMITER="|",
                OPTIONS=[{"TEXT": f"TRKORR IN ({tr_in_clause}) AND TRSTATUS = 'D'"}],
                FIELDS=[{"FIELDNAME": "TRKORR"}, {"FIELDNAME": "TRSTATUS"}],
                ROWCOUNT=50,
            )
            matched_tr = None
            for row in res_e070.get("DATA", []):
                parts = row["WA"].split("|")
                if len(parts) >= 2 and parts[0].strip() in tr_list and parts[1].strip() == "D":
                    matched_tr = parts[0].strip()
                    break

            if not matched_tr:
                add("transport_request", "Transport Request Check", False,
                    f"Program '{program_name}' is not in an OPEN (Modifiable) Transport Request. "
                    f"Found CR(s): {', '.join(tr_list)} — all are already released or have an invalid status.")
                return results  # STOP
            add("transport_request", "Transport Request Check", True,
                f"Program is included in open Transport Request '{matched_tr}'.")
        except Exception as exc:
            add("transport_request", "Transport Request Check", False,
                f"Could not verify Transport Request (RFC error: {exc}). Deploy blocked.")
            return results  # STOP

        return results

    finally:
        conn.close()
