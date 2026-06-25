import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn1 = _connect(sandbox)
conn2 = _connect(sandbox)
try:
    # Lock the program
    conn1.call("ENQUEUE_E_TRDIR", NAME="ZBUDI", _SCOPE="2")
    
    # Try to write using conn2
    res = conn2.call(
        "RFC_ABAP_INSTALL_AND_RUN",
        PROGRAMNAME="ZBUDI",
        MODE="I",
        PROGRAM=[{"LINE": "REPORT ZBUDI."}],
    )
    print("Result:", res)
except Exception as e:
    print("Exception:", e)
finally:
    try:
        conn1.call("DEQUEUE_E_TRDIR", NAME="ZBUDI", _SCOPE="2")
    except: pass
    conn1.close()
    conn2.close()
