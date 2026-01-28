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
    except Exception as e:
        print(f"Migration Error: {e}")
    finally:
        conn.close()
