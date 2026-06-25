import sys
sys.path.append('.')
from app.database import engine, text

with engine.connect() as conn:
    conn.execute(text('UPDATE program_versions SET created_at = now() WHERE created_at IS NULL'))
    conn.commit()
    print("Updated successfully")
