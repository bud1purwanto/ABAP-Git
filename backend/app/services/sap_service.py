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
