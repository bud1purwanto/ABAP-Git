import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn = _connect(sandbox)

def search(name):
    try:
        res = conn.call("RFC_FUNCTION_SEARCH", FUNCNAME=name)
        print(f"Results for {name}:")
        for f in res.get("FUNCTIONS", []):
            print("  ", f["FUNCNAME"])
    except Exception as e:
        print(f"Error for {name}: {e}")

try:
    search("*INSERT_REPORT*")
    search("*PROGRAM_UPDATE*")
finally:
    conn.close()
