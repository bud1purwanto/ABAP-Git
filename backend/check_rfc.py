import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

db = SessionLocal()
sandbox = db.query(Sandbox).first()
conn = _connect(sandbox)
try:
    desc = conn.get_function_description("Z_RFC_PROGRAM_UPDATE")
    for param in desc.parameters:
        print(param)
except Exception as e:
    print(e)
finally:
    conn.close()
