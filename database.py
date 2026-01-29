from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

# Create data directory if it doesn't exist
os.makedirs("data", exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/data.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    import sqlite3
    db_path = "./data/data.db"
    if not os.path.exists(db_path):
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Check for content_hash column
        cursor.execute("PRAGMA table_info(images)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if columns and "content_hash" not in columns:
            print("Migration: Adding content_hash column to images table...")
            cursor.execute("ALTER TABLE images ADD COLUMN content_hash VARCHAR")
            cursor.execute("CREATE INDEX ix_images_content_hash ON images (content_hash)")
            conn.commit()
            print("Migration: Successfully added content_hash column.")
            
        if columns and "media_type" not in columns:
            print("Migration: Adding media_type column to images table...")
            cursor.execute("ALTER TABLE images ADD COLUMN media_type VARCHAR DEFAULT 'image'")
            conn.commit()
            print("Migration: Successfully added media_type column.")

        # AI Analysis columns
        ai_columns = {
            "analyzed": "BOOLEAN DEFAULT 0",
            "face_count": "INTEGER DEFAULT 0",
            "has_people": "BOOLEAN DEFAULT 0",
            "dominant_colors": "JSON",
            "brightness": "FLOAT",
            "tags": "JSON"
        }
        
        # Remove old columns if they exist (from previous version)
        old_columns = ["faces_count", "pose_info"]
        for old_col in old_columns:
            if columns and old_col in columns:
                print(f"Migration: Removing old column {old_col}...")
                # SQLite doesn't support DROP COLUMN directly, so we'll just ignore it
                # The new schema will use the correct column names
                print(f"Migration: Old column {old_col} will be ignored (SQLite limitation)")
        
        for col, col_type in ai_columns.items():
            if columns and col not in columns:
                print(f"Migration: Adding {col} column to images table...")
                cursor.execute(f"ALTER TABLE images ADD COLUMN {col} {col_type}")
                conn.commit()
                print(f"Migration: Successfully added {col} column.")
    except Exception as e:
        print(f"Migration Error: {e}")
    finally:
        conn.close()
