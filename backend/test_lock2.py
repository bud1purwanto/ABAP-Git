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
    print("Locking conn1...")
    conn1.call("ENQUEUE_E_TRDIR", NAME="ZBUDI", _SCOPE="2")
    
    print("Trying to lock conn2...")
    conn2.call("ENQUEUE_E_TRDIR", NAME="ZBUDI", _SCOPE="2")
    print("Conn2 locked successfully?!")
except Exception as e:
    print("Exception from conn2:", e)
finally:
    try:
        conn1.call("DEQUEUE_E_TRDIR", NAME="ZBUDI", _SCOPE="2")
    except: pass
    conn1.close()
    conn2.close()
