import os
import sys

# Ensure backend is in python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.sandbox import Sandbox
from app.services.sap_service import _connect

def main():
    db = SessionLocal()
    sandbox = db.query(Sandbox).first()
    if not sandbox:
        print("No sandbox found")
        return
    
    print(f"Connecting to {sandbox.name}...")
    conn = _connect(sandbox)
    
    try:
        print("\nTesting RFC_READ_TABLE on D010INC for ZABAPGIT_STANDALONE...")
        result = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="D010INC",
            DELIMITER="|",
            OPTIONS=[{"TEXT": "MASTER = 'ZABAPGIT_STANDALONE'"}],
            FIELDS=[{"FIELDNAME": "INCLUDE"}],
            ROWCOUNT=20
        )
        for row in result["DATA"]:
            print(row['WA'])
    except Exception as e:
        print("Error:", e)
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
