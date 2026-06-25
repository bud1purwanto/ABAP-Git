import sys
sys.path.append('.')
from app.database import engine, text

with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE users DROP COLUMN git_email'))
        conn.commit()
        print("Column dropped successfully")
    except Exception as e:
        print(f"Error dropping column: {e}")
