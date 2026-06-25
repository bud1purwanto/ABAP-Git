import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn = _connect(sandbox)
try:
    res = conn.call(
        "RFC_ABAP_INSTALL_AND_RUN",
        PROGRAMNAME="ZBUDI",
        MODE="I",
        PROGRAM=[{"LINE": "REPORT ZBUDI."}],
    )
    print("Result:", res)
except Exception as e:
    print("Exception:", e)
finally:
    conn.close()
