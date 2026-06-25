import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn = _connect(sandbox)

program_name = "ZBUDI"
source_code = "REPORT ZBUDI.\nWRITE 'HELLO FROM Z_RFC_PROGRAM_UPDATE'."

try:
    lines = [{"LINE": line} for line in source_code.split("\n")]
    
    print("Trying Z_RFC_PROGRAM_UPDATE...")
    res = conn.call(
        "Z_RFC_PROGRAM_UPDATE",
        IV_PROGRAM_NAME=program_name,
        IV_PACKAGE="$TMP",
        IT_SOURCE=lines
    )
    print("Result:", res)
    
except Exception as e:
    print("Exception:", e)
finally:
    conn.close()
