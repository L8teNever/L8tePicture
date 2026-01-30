import os
import uuid
import shutil
import logging
import hashlib
import time
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Request, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from PIL import Image as PILImage
import models
from database import engine, get_db, SessionLocal
import json
from image_analyzer import get_analyzer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
try:
    from database import run_migrations
    run_migrations()
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created or already exist.")
except Exception as e:
    logger.error(f"Error creating database tables or running migrations: {e}")

app = FastAPI(title="P.I.X.I.")

# Setup directories
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
PREVIEW_DIR = os.path.join(os.getcwd(), "previews")
THUMB_DIR = os.path.join(os.getcwd(), "thumbnails")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Specialized mounts with caching headers
@app.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str):
    path = os.path.join(THUMB_DIR, filename)
    if not os.path.exists(path): raise HTTPException(404)
    return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})

@app.get("/previews/{filename}")
async def get_preview(filename: str):
    path = os.path.join(PREVIEW_DIR, filename)
    if not os.path.exists(path): raise HTTPException(404)
    return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})

templates = Jinja2Templates(directory="templates")

def generate_video_thumbnail(video_path, thumb_path):
    """Extracts a frame from the video using ffmpeg and saves as WebP."""
    import subprocess
    try:
        # Extract frame at 1 second mark, scale, and save as WebP directly
        subprocess.run([
            'ffmpeg', '-y', '-ss', '00:00:01', '-i', video_path, 
            '-vframes', '1', 
            '-vf', 'scale=400:-1', 
            '-c:v', 'webp', '-lossless', '0', '-compression_level', '4', '-q:v', '65',
            thumb_path
        ], check=True, capture_output=True)
        return True
    except Exception as e:
        logger.error(f"FFmpeg thumbnail failed: {e}")
        return False

def generate_video_preview(video_path, preview_path):
    """Generates a short (3s) silent looping preview of the video."""
    import subprocess
    try:
        # Generate a small, low-fps animated WebP for hover previews
        # 3 seconds, 10fps, 320px width
        subprocess.run([
            'ffmpeg', '-y', '-ss', '00:00:01', '-t', '3', '-i', video_path,
            '-vf', 'fps=10,scale=320:-1:flags=lanczos',
            '-loop', '0', '-c:v', 'webp', '-lossless', '0', '-compression_level', '4', '-q:v', '50',
            preview_path
        ], check=True, capture_output=True)
        return True
    except Exception as e:
        logger.error(f"FFmpeg preview generation failed: {e}")
        return False

def analyze_and_update_image(image_id: int, file_path: str):
    """Analyze image and update database with AI metadata."""
    try:
        from database import SessionLocal
        db = SessionLocal()
        
        analyzer = get_analyzer()
        analysis = analyzer.analyze_image(file_path)
        
        # Update database
        image = db.query(models.Image).filter(models.Image.id == image_id).first()
        if image:
            image.analyzed = True
            image.face_count = analysis['face_count']
            image.has_people = analysis['has_people']
            image.dominant_colors = analysis['dominant_colors']
            image.brightness = analysis['brightness']
            image.tags = analysis['tags']
            db.commit()
            logger.info(f"Analysis complete for image {image_id}: {len(analysis['tags'])} tags, {analysis['face_count']} faces")
        
        db.close()
    except Exception as e:
        logger.error(f"Analysis failed for image {image_id}: {e}")

def process_image_versions(file_path: str, filename: str, media_type: str = "image", image_id: int = None):
    """Generates a small thumbnail and a medium preview in WebP format."""
    try:
        # Use a small delay to ensure file is flushed
        time.sleep(0.1)
        
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
                if preview_img.mode in ("RGBA", "P"):
                    preview_img = preview_img.convert("RGB")
                preview_img.save(preview_path, "WEBP", quality=75, method=6) # Method 6 is best compression

            # Generate Thumbnail (max 300px)
            thumb_path = os.path.join(THUMB_DIR, filename + ".webp")
            if not os.path.exists(thumb_path):
                thumb_img = img.copy()
                thumb_img.thumbnail((300, 300))
                if thumb_img.mode in ("RGBA", "P"):
                    thumb_img = thumb_img.convert("RGB")
                thumb_img.save(thumb_path, "WEBP", quality=60, method=6)
        
        # Perform AI analysis for images (not videos)
        if media_type == "image" and image_id:
            analyze_and_update_image(image_id, file_path)
            
    except Exception as e:
        logger.error(f"Background optimization failed for {filename}: {e}")



def analyze_unanalyzed_images_on_startup():
    """Background task to analyze all unanalyzed images on server startup."""
    import time
    time.sleep(5)  # Wait 5 seconds for server to fully start
    
    from database import SessionLocal
    db = SessionLocal()
    
    try:
        # Count unanalyzed images
        unanalyzed = db.query(models.Image).filter(
            models.Image.analyzed == False,
            models.Image.media_type == "image"
        ).all()
        
        total = len(unanalyzed)
        
        if total == 0:
            logger.info("✓ All images are already analyzed!")
            return
        
        logger.info(f"🔍 Found {total} unanalyzed images. Starting background analysis...")
        
        for idx, image in enumerate(unanalyzed, 1):
            try:
                file_path = os.path.join(UPLOAD_DIR, image.filename)
                
                if not os.path.exists(file_path):
                    logger.warning(f"[{idx}/{total}] File not found: {image.filename}")
                    continue
                
                logger.info(f"[{idx}/{total}] Analyzing {image.filename}...")
                
                # Perform analysis
                analyzer = get_analyzer()
                analysis = analyzer.analyze_image(file_path)
                
                # Update database
                image.analyzed = True
                image.face_count = analysis['face_count']
                image.has_people = analysis['has_people']
                image.dominant_colors = analysis['dominant_colors']
                image.brightness = analysis['brightness']
                image.tags = analysis['tags']
                
                db.commit()
                
                logger.info(f"  ✓ {len(analysis['tags'])} tags, {analysis['face_count']} faces, brightness: {analysis['brightness']:.2f}")
                
            except Exception as e:
                logger.error(f"  ✗ Error analyzing {image.filename}: {e}")
                db.rollback()
        
        logger.info(f"✓ Startup analysis complete! Processed {total} images")
        
    except Exception as e:
        logger.error(f"Startup analysis failed: {e}")
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    # Start the folder observer in the background
    try:
        from folder_observer import start_observer
        import threading
        # Running observer in a separate thread to not block uvicorn startup
        threading.Thread(target=start_observer, daemon=True).start()
        logger.info("Folder observer started in background thread.")
    except Exception as e:
        logger.error(f"Failed to start folder observer: {e}")
    
    # Start background analysis of unanalyzed images
    try:
        import threading
        threading.Thread(target=analyze_unanalyzed_images_on_startup, daemon=True).start()
        logger.info("Background image analysis started.")
    except Exception as e:
        logger.error(f"Failed to start background analysis: {e}")

@app.get("/manifest.json")
async def manifest():
    return FileResponse("static/manifest.json")

@app.get("/sw.js")
async def service_worker():
    return FileResponse("static/sw.js", media_type="application/javascript")

@app.get("/")
async def read_root(request: Request, db: Session = Depends(get_db), search: str = "", favorites: bool = False):
    try:
        query = db.query(models.Image).order_by(models.Image.upload_date.desc())
        if search:
            query = apply_filters(query, search)
        if favorites:
            query = query.filter(models.Image.is_favorite == True)
        
        # Load first 50 images for initial landing
        images = query.limit(50).all()
        return templates.TemplateResponse("index.html", {"request": request, "images": images, "search": search, "favorites": favorites})
    except Exception as e:
        logger.error(f"Error loading images for root: {e}")
        return templates.TemplateResponse("index.html", {"request": request, "images": [], "search": "", "favorites": False})

@app.get("/gallery")
async def gallery_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/")

def apply_filters(query, search_str):
    if not search_str:
        return query
    
    import re
    # Look for key:value patterns
    filters = re.findall(r'(\w+):([\w\-\.]+)', search_str)
    
    remaining_search = search_str
    for key, value in filters:
        key = key.lower()
        # Remove the filter from the search string to use the rest for name matching
        remaining_search = remaining_search.replace(f"{key}:{value}", "").strip()
        
        if key == "faces":
            try:
                query = query.filter(models.Image.face_count >= int(value))
            except: pass
        elif key == "people":
            if value.lower() == "true":
                query = query.filter(models.Image.has_people == True)
            else:
                query = query.filter(models.Image.has_people == False)
        elif key == "tag":
            # JSON contains tags, so we use a contains-like check
            query = query.filter(models.Image.tags.contains([value]))
        elif key == "date":
            # Simple date match
            query = query.filter(models.Image.upload_date.ilike(f"%{value}%"))
        elif key == "brightness":
            try:
                # Support brightness:dark, brightness:bright, or brightness:0.5
                if value == "dark":
                    query = query.filter(models.Image.brightness < 0.3)
                elif value == "bright":
                    query = query.filter(models.Image.brightness > 0.7)
                else:
                    query = query.filter(models.Image.brightness >= float(value))
            except: pass
            
    if remaining_search:
        query = query.filter(models.Image.original_name.ilike(f"%{remaining_search}%"))
    
    return query

@app.get("/api/images")
async def get_images_api(db: Session = Depends(get_db), offset: int = 0, limit: int = 50, search: str = "", favorites: bool = False):
    """API endpoint for infinite scrolling and efficient image fetching."""
    query = db.query(models.Image).order_by(models.Image.upload_date.desc())
    
    if search:
        query = apply_filters(query, search)
    if favorites:
        query = query.filter(models.Image.is_favorite == True)
    
    images = query.offset(offset).limit(limit).all()
    return [{
        "id": img.id,
        "filename": img.filename,
        "original_name": "Private Media", # Privacy: Hide original filenames
        "is_favorite": img.is_favorite,
        "media_type": img.media_type,
        "width": img.width,
        "height": img.height,
        "upload_date": img.upload_date.isoformat() if img.upload_date else None,
        "tags": img.tags or [],
        "face_count": img.face_count if img.analyzed else 0,
        "has_people": img.has_people if img.analyzed else False,
        "brightness": img.brightness if img.analyzed else None,
        "analyzed": img.analyzed
    } for img in images]

@app.post("/upload")
async def upload_images(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    uploaded_count = 0
    errors = []
    
    new_image_ids = []
    for file in files:
        media_type = "image"
        if file.content_type.startswith("image/"):
            media_type = "image"
        elif file.content_type.startswith("video/"):
            media_type = "video"
        else:
            errors.append(f"{file.filename} is not a supported image or video.")
            continue
            
        try:
            # Generate unique filename
            ext = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            # Save original file instantly
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Calculate hash for duplicate detection
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            content_hash = sha256_hash.hexdigest()

            # Check for duplicate
            existing_image = db.query(models.Image).filter(models.Image.content_hash == content_hash).first()
            if existing_image:
                os.remove(file_path) # Delete the duplicate file
                new_image_ids.append(existing_image.id)
                continue

            # Quick metadata extraction
            width, height = 0, 0
            if media_type == "image":
                with PILImage.open(file_path) as img:
                    width, height = img.size
            
            actual_size = os.path.getsize(file_path)

            # Save to DB instantly
            db_image = models.Image(
                filename=unique_filename,
                original_name=file.filename,
                width=width,
                height=height,
                size=actual_size,
                content_hash=content_hash,
                media_type=media_type
            )
            db.add(db_image)
            db.commit()
            db.refresh(db_image)
            
            # OFFLOAD heavy processing to background (including AI analysis)
            background_tasks.add_task(process_image_versions, file_path, unique_filename, media_type, db_image.id)
            
            new_image_ids.append(db_image.id)
            uploaded_count += 1
        except Exception as e:
            logger.error(f"Upload error: {e}")
            errors.append(f"Failed to process {file.filename}")

    # Fetch recently added images for the response
    new_images = db.query(models.Image).filter(models.Image.id.in_(new_image_ids)).all()

    return {
        "message": f"Successfully uploaded {uploaded_count} images", 
        "count": uploaded_count,
        "images": [{
            "id": img.id,
            "filename": img.filename,
            "original_name": img.original_name,
            "is_favorite": img.is_favorite,
            "media_type": img.media_type
        } for img in new_images]
    }

@app.post("/favorite/{image_id}")
async def toggle_favorite(image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.is_favorite = not image.is_favorite
    db.commit()
    return {"is_favorite": image.is_favorite}

@app.delete("/delete/{image_id}")
async def delete_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Remove files
    file_path = os.path.join(UPLOAD_DIR, image.filename)
    thumb_path = os.path.join(THUMB_DIR, image.filename)
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
    except Exception as e:
        logger.error(f"Error deleting physical files for image {image_id}: {e}")
        
    db.delete(image)
    db.commit()
    return {"message": "Image deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
