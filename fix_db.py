
import sqlite3
import os

db_path = "data/data.db"

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if content_hash already exists
    cursor.execute("PRAGMA table_info(images)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if "content_hash" not in columns:
        print("Adding content_hash column to images table...")
        cursor.execute("ALTER TABLE images ADD COLUMN content_hash VARCHAR")
        # Also add the index as requested by the model
        cursor.execute("CREATE INDEX ix_images_content_hash ON images (content_hash)")
        conn.commit()
        print("Successfully added content_hash column and index.")
    else:
        print("content_hash column already exists.")

except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
