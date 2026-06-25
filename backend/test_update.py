import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn = _connect(sandbox)

program_name = "ZBUDI"
source_code = "REPORT ZBUDI.\nWRITE 'HELLO FROM RPY 2'."

try:
    lines = [{"LINE": line} for line in source_code.split("\n")]
    
    print("Trying RPY_PROGRAM_UPDATE...")
    res = conn.call(
        "RPY_PROGRAM_UPDATE",
        PROGRAM_NAME=program_name,
        SOURCE_EXTENDED=lines,
        SAVE_INACTIVE=" " # " " means save as active, "X" means save as inactive
    )
    print("Result:", res)
    
    # Check if it was saved
    res_check = conn.call("RPY_PROGRAM_READ", PROGRAM_NAME=program_name)
    print("Read back:", [x["LINE"] for x in res_check.get("SOURCE_EXTENDED", [])])
    
except Exception as e:
    print("Exception:", e)
finally:
    conn.close()
