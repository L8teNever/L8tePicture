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

PREVIEW_DIR = "previews"
THUMB_DIR = "thumbnails"
UPLOAD_DIR = "uploads"

def process_image_versions(file_path: str, filename: str):
    """Generates a small thumbnail and a medium preview in WebP format."""
    try:
        with PILImage.open(file_path) as img:
            # Generate Preview (max 1600px)
            preview_img = img.copy()
            preview_img.thumbnail((1600, 1600))
            preview_path = os.path.join(PREVIEW_DIR, filename + ".webp")
            preview_img.save(preview_path, "WEBP", quality=75)

            # Generate Thumbnail (max 300px)
            thumb_img = img.copy()
            thumb_img.thumbnail((300, 300))
            thumb_path = os.path.join(THUMB_DIR, filename + ".webp")
            thumb_img.save(thumb_path, "WEBP", quality=60)
    except Exception as e:
        logger.error(f"Image optimization failed (Watchdog) for {filename}: {e}")

class ImageHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        
        # Delay for FTP
        time.sleep(2)
        
        file_path = event.src_path
        filename = os.path.basename(file_path)
        
        if filename.startswith('.') or filename.endswith('.webp'):
            return

        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            return

        db = SessionLocal()
        try:
            existing = db.query(models.Image).filter(models.Image.filename == filename).first()
            if existing:
                return

            if os.path.getsize(file_path) == 0:
                time.sleep(2)

            with PILImage.open(file_path) as img:
                width, height = img.size
                actual_size = os.path.getsize(file_path)

            # Ensure directories exist
            os.makedirs(PREVIEW_DIR, exist_ok=True)
            os.makedirs(THUMB_DIR, exist_ok=True)
            
            process_image_versions(file_path, filename)

            db_image = models.Image(
                filename=filename,
                original_name=filename,
                width=width,
                height=height,
                size=actual_size
            )
            db.add(db_image)
            db.commit()
            logger.info(f"Auto-imported & optimized: {filename}")
        except Exception as e:
            logger.error(f"Watchdog failed for {filename}: {e}")
        finally:
            db.close()

def start_observer():
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
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        os.makedirs(THUMB_DIR, exist_ok=True)

        files = os.listdir(UPLOAD_DIR)
        for filename in files:
            if filename.startswith('.') or filename.endswith('.webp'): continue
            
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
                    
                    process_image_versions(file_path, filename)

                    db_image = models.Image(
                        filename=filename,
                        original_name=filename,
                        width=width,
                        height=height,
                        size=size
                    )
                    db.add(db_image)
                    db.commit()
                    logger.info(f"Startup Sync & Optimize: {filename}")
                except Exception as e:
                    logger.error(f"Startup Sync failed for {filename}: {e}")
    finally:
        db.close()
