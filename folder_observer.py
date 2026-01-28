import os
import uuid
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sqlalchemy.orm import Session
from PIL import Image as PILImage
import models
from database import SessionLocal, engine

# Reuse create_thumbnail from main? Let's redefine for simplicity in this module 
# or we could import it if main.py was structured better.
THUMB_DIR = "thumbnails"
UPLOAD_DIR = "uploads"

def create_thumbnail(image_path: str, thumb_path: str, size=(400, 400)):
    try:
        with PILImage.open(image_path) as img:
            img.thumbnail(size)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(thumb_path, "JPEG", quality=85)
    except Exception as e:
        print(f"Error creating thumbnail: {e}")

class ImageHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        
        # Add a small delay to ensure file is fully copied (important for FTP/Filezilla)
        time.sleep(1)
        
        file_path = event.src_path
        filename = os.path.basename(file_path)
        
        # Check if it's an image
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            return

        db = SessionLocal()
        try:
            # Check if file already in DB
            existing = db.query(models.Image).filter(models.Image.filename == filename).first()
            if existing:
                return

            # Process image
            with PILImage.open(file_path) as img:
                width, height = img.size
                size = os.path.getsize(file_path)

            thumb_path = os.path.join(THUMB_DIR, filename)
            create_thumbnail(file_path, thumb_path)

            db_image = models.Image(
                filename=filename,
                original_name=filename,
                width=width,
                height=height,
                size=size
            )
            db.add(db_image)
            db.commit()
            print(f"Successfully imported: {filename}")
        except Exception as e:
            print(f"Error importing {filename}: {e}")
        finally:
            db.close()

def start_observer():
    # Also sync existing files on startup that might not be in DB
    sync_existing_files()
    
    event_handler = ImageHandler()
    observer = Observer()
    observer.schedule(event_handler, UPLOAD_DIR, recursive=False)
    observer.start()
    print(f"Folder observer started on {UPLOAD_DIR}")

def sync_existing_files():
    db = SessionLocal()
    files = os.listdir(UPLOAD_DIR)
    for filename in files:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            continue
            
        existing = db.query(models.Image).filter(models.Image.filename == filename).first()
        if not existing:
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                with PILImage.open(file_path) as img:
                    width, height = img.size
                    size = os.path.getsize(file_path)
                
                thumb_path = os.path.join(THUMB_DIR, filename)
                if not os.path.exists(thumb_path):
                    create_thumbnail(file_path, thumb_path)

                db_image = models.Image(
                    filename=filename,
                    original_name=filename,
                    width=width,
                    height=height,
                    size=size
                )
                db.add(db_image)
                db.commit()
                print(f"Synced existing file: {filename}")
            except Exception as e:
                print(f"Failed to sync {filename}: {e}")
    db.close()
