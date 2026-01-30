import os
import time
import logging
import hashlib
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sqlalchemy.orm import Session
from PIL import Image as PILImage
import models
from database import SessionLocal
from image_analyzer import analyze_image

# Setup logging
logger = logging.getLogger(__name__)

# Use absolute paths for reliability
BASE_DIR = os.getcwd()
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PREVIEW_DIR = os.path.join(BASE_DIR, "previews")
THUMB_DIR = os.path.join(BASE_DIR, "thumbnails")

def generate_video_thumbnail(video_path, thumb_path):
    """Extracts a frame from the video using ffmpeg and saves as WebP."""
    import subprocess
    try:
        subprocess.run([
            'ffmpeg', '-y', '-ss', '00:00:01', '-i', video_path, 
            '-vframes', '1', 
            '-vf', 'scale=400:-1', 
            '-c:v', 'webp', '-lossless', '0', '-compression_level', '4', '-q:v', '65',
            thumb_path
        ], check=True, capture_output=True)
        return True
    except Exception as e:
        logger.error(f"FFmpeg thumbnail failed (Watcher): {e}")
        return False

def generate_video_preview(video_path, preview_path):
    """Generates a short (3s) silent looping preview of the video."""
    import subprocess
    try:
        subprocess.run([
            'ffmpeg', '-y', '-ss', '00:00:01', '-t', '3', '-i', video_path,
            '-vf', 'fps=10,scale=320:-1:flags=lanczos',
            '-loop', '0', '-c:v', 'webp', '-lossless', '0', '-compression_level', '4', '-q:v', '50',
            preview_path
        ], check=True, capture_output=True)
        return True
    except Exception as e:
        logger.error(f"FFmpeg preview generation failed (Watcher): {e}")
        return False

def process_image_versions(file_path: str, filename: str, media_type: str = "image"):
    """Generates a small thumbnail and a medium preview in WebP format."""
    try:
        if not os.path.exists(file_path):
            return

        if media_type == "video":
            thumb_path = os.path.join(THUMB_DIR, filename + ".webp")
            preview_path = os.path.join(THUMB_DIR, filename + "_preview.webp")
            
            if not os.path.exists(thumb_path):
                generate_video_thumbnail(file_path, thumb_path)
            
            if not os.path.exists(preview_path):
                generate_video_preview(file_path, preview_path)
            return

        with PILImage.open(file_path) as img:
            # Generate Preview (max 1600px)
            preview_path = os.path.join(PREVIEW_DIR, filename + ".webp")
            if not os.path.exists(preview_path):
                preview_img = img.copy()
                preview_img.thumbnail((1600, 1600))
                # Ensure RGB for JPEG/PNG compatibility
                if preview_img.mode in ("RGBA", "P"):
                    preview_img = preview_img.convert("RGB")
                preview_img.save(preview_path, "WEBP", quality=75)

            # Generate Thumbnail (max 300px)
            thumb_path = os.path.join(THUMB_DIR, filename + ".webp")
            if not os.path.exists(thumb_path):
                thumb_img = img.copy()
                thumb_img.thumbnail((300, 300))
                if thumb_img.mode in ("RGBA", "P"):
                    thumb_img = thumb_img.convert("RGB")
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
        
        # Skip hidden files and already generated webp versions
        if filename.startswith('.') or filename.endswith('.webp'):
            return

        ext = os.path.splitext(filename)[1].lower()
        media_type = "image"
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            media_type = "image"
        elif ext in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
            media_type = "video"
        else:
            return

        db = SessionLocal()
        try:
            # Check DB
            existing = db.query(models.Image).filter(models.Image.filename == filename).first()
            
            # Ensure folders exist
            os.makedirs(PREVIEW_DIR, exist_ok=True)
            os.makedirs(THUMB_DIR, exist_ok=True)
            
            # ALWAYS process versions if they are missing
            process_image_versions(file_path, filename, media_type)

            # Calculate content hash
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            content_hash = sha256_hash.hexdigest()

            # Check for duplicate by hash
            existing_by_hash = db.query(models.Image).filter(models.Image.content_hash == content_hash).first()

            if not existing and not existing_by_hash:
                width, height = 0, 0
                if media_type == "image":
                    with PILImage.open(file_path) as img:
                        width, height = img.size
                
                actual_size = os.path.getsize(file_path)

                db_image = models.Image(
                    filename=filename,
                    original_name=filename,
                    width=width,
                    height=height,
                    size=actual_size,
                    content_hash=content_hash,
                    media_type=media_type
                )
                
                # Perform AI Analysis
                if media_type == "image":
                    results = analyze_image(file_path)
                    if results:
                        db_image.analyzed = True
                        db_image.face_count = results["face_count"]
                        db_image.has_people = results["has_people"]
                        # db_image.pose_info = results["pose_info"] # Not supported currently
                        db_image.brightness = results["brightness"]
                        db_image.dominant_colors = results["dominant_colors"]
                        db_image.tags = results["tags"]

                db.add(db_image)
                db.commit()
                logger.info(f"Auto-imported & optimized & analyzed: {filename}")
            elif existing and not existing.content_hash:
                # Update hash for legacy entries
                existing.content_hash = content_hash
                db.commit()
                logger.info(f"Updated hash for: {filename}")
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
            media_type = "image"
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
                media_type = "image"
            elif ext in ['.mp4', '.webm', '.mov', '.avi', '.mkv']:
                media_type = "video"
            else:
                continue
                
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            # 1. Ensure Previews/Thumbs exist (even for existing DB entries)
            process_image_versions(file_path, filename, media_type)
            
            # 2. Check if in DB
            existing = db.query(models.Image).filter(models.Image.filename == filename).first()
            
            # Calculate hash
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            content_hash = sha256_hash.hexdigest()
            
            existing_by_hash = db.query(models.Image).filter(models.Image.content_hash == content_hash).first()

            if not existing and not existing_by_hash:
                try:
                    width, height = 0, 0
                    if media_type == "image":
                        with PILImage.open(file_path) as img:
                            width, height = img.size
                    
                    size = os.path.getsize(file_path)
                    
                    db_image = models.Image(
                        filename=filename,
                        original_name=filename,
                        width=width,
                        height=height,
                        size=size,
                        content_hash=content_hash,
                        media_type=media_type
                    )

                    # Perform AI Analysis
                    if media_type == "image":
                        results = analyze_image(file_path)
                        if results:
                            db_image.analyzed = True
                            db_image.face_count = results["face_count"]
                            db_image.has_people = results["has_people"]
                            # db_image.pose_info = results["pose_info"]
                            db_image.brightness = results["brightness"]
                            db_image.dominant_colors = results["dominant_colors"]
                            db_image.tags = results["tags"]

                    db.add(db_image)
                    db.commit()
                    logger.info(f"Startup Sync: Added & Analyzed {filename} to DB")
                except Exception as e:
                    logger.error(f"Startup Sync failed for {filename}: {e}")
            elif existing and not existing.content_hash:
                existing.content_hash = content_hash
                db.commit()
    finally:
        db.close()
