import os
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sqlalchemy.orm import Session
from PIL import Image as PILImage
import models
from database import SessionLocal

# Setup logging
logger = logging.getLogger(__name__)

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
        logger.error(f"Error creating thumbnail in observer: {e}")

class ImageHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        
        # Delay to ensure file is fully copied (FTP/Filezilla friendly)
        time.sleep(2)
        
        file_path = event.src_path
        filename = os.path.basename(file_path)
        
        # Skip hidden files
        if filename.startswith('.'):
            return

        # Check if it's an image
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            return

        db = SessionLocal()
        try:
            # CHECK: If already in database, skip
            # This prevents duplicate entries when web-uploading
            existing = db.query(models.Image).filter(models.Image.filename == filename).first()
            if existing:
                return

            # DOUBLE CHECK: If file size is 0, it might still be copying
            if os.path.getsize(file_path) == 0:
                time.sleep(2)

            with PILImage.open(file_path) as img:
                width, height = img.size
                actual_size = os.path.getsize(file_path)

            thumb_path = os.path.join(THUMB_DIR, filename)
            if not os.path.exists(thumb_path):
                create_thumbnail(file_path, thumb_path)

            db_image = models.Image(
                filename=filename,
                original_name=filename,
                width=width,
                height=height,
                size=actual_size
            )
            db.add(db_image)
            db.commit()
            logger.info(f"Auto-imported (Watchdog): {filename}")
        except Exception as e:
            # Log but don't crash the observer
            logger.error(f"Watchdog failed to import {filename}: {e}")
        finally:
            db.close()

def start_observer():
    # Initial sync
    sync_existing_files()
    
    event_handler = ImageHandler()
    observer = Observer()
    observer.schedule(event_handler, UPLOAD_DIR, recursive=False)
    observer.start()
    logger.info(f"Folder observer actively monitoring: {UPLOAD_DIR}")
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

def sync_existing_files():
    db = SessionLocal()
    try:
        if not os.path.exists(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            return

        files = os.listdir(UPLOAD_DIR)
        for filename in files:
            if filename.startswith('.'): continue
            
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
                    logger.info(f"Startup Sync: Found new image {filename}")
                except Exception as e:
                    logger.error(f"Startup Sync failed for {filename}: {e}")
    finally:
        db.close()
