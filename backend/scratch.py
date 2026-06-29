import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from app.services.sap_service import _connect
from app.models.sandbox import Sandbox

# Simulate a Sandbox object (using environment variables)
class DummySandbox:
    id = 1
    sap_host = os.getenv("SAP_ASHOST")
    sap_system_number = os.getenv("SAP_SYSNR")
    sap_client = os.getenv("SAP_CLIENT")
    sap_user = os.getenv("SAP_USER")
    sap_password = os.getenv("SAP_PASS")

sandbox = DummySandbox()
program_name = "ZQMI_BARRIER_PASS_FAIL"

conn = _connect(sandbox)
try:
    print("--- E071 ---")
    res_e071 = conn.call(
        "RFC_READ_TABLE",
        QUERY_TABLE="E071",
        DELIMITER="|",
        OPTIONS=[
            {"TEXT": "PGMID = 'R3TR' AND OBJECT = 'PROG'"},
            {"TEXT": f"AND OBJ_NAME = '{program_name}'"}
        ],
        FIELDS=[{"FIELDNAME": "OBJ_NAME"}, {"FIELDNAME": "TRKORR"}],
        ROWCOUNT=50,
    )
    tr_list = []
    for row in res_e071.get("DATA", []):
        print(row)
        parts = row["WA"].split("|")
        if len(parts) >= 2 and parts[0].strip().upper() == program_name.upper():
            tr_list.append(parts[1].strip())
    
    print("Found TRs:", tr_list)

    if tr_list:
        print("--- E070 ---")
        e070_options = [{"TEXT": "("}]
        for i, tr in enumerate(tr_list):
            prefix = "" if i == 0 else "OR "
            e070_options.append({"TEXT": f"{prefix}TRKORR = '{tr}' "})
        e070_options.append({"TEXT": ") AND TRSTATUS = 'D' "})
        print("OPTIONS:", e070_options)

        res_e070 = conn.call(
            "RFC_READ_TABLE",
            QUERY_TABLE="E070",
            DELIMITER="|",
            OPTIONS=e070_options,
            FIELDS=[{"FIELDNAME": "TRKORR"}, {"FIELDNAME": "TRSTATUS"}],
            ROWCOUNT=50,
        )
        for row in res_e070.get("DATA", []):
            print(row)

finally:
    conn.close()
