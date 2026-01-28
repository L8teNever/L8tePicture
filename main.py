import os
import uuid
import shutil
import logging
from typing import List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from PIL import Image as PILImage
import models
from database import engine, get_db

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created or already exist.")
except Exception as e:
    logger.error(f"Error creating database tables: {e}")

app = FastAPI(title="L8tePicture")

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
app.mount("/previews", StaticFiles(directory=PREVIEW_DIR), name="previews")
app.mount("/thumbnails", StaticFiles(directory=THUMB_DIR), name="thumbnails")
templates = Jinja2Templates(directory="templates")

def process_image_versions(file_path: str, filename: str):
    """Generates a small thumbnail and a medium preview in WebP format."""
    try:
        # Use a small delay to ensure file is flushed
        time.sleep(0.1)
        with PILImage.open(file_path) as img:
            # Generate Preview (max 1600px)
            preview_path = os.path.join(PREVIEW_DIR, filename + ".webp")
            if not os.path.exists(preview_path):
                preview_img = img.copy()
                preview_img.thumbnail((1600, 1600))
                if preview_img.mode in ("RGBA", "P"):
                    preview_img = preview_img.convert("RGB")
                preview_img.save(preview_path, "WEBP", quality=75, method=3) # Method 3 is faster

            # Generate Thumbnail (max 300px)
            thumb_path = os.path.join(THUMB_DIR, filename + ".webp")
            if not os.path.exists(thumb_path):
                thumb_img = img.copy()
                thumb_img.thumbnail((300, 300))
                if thumb_img.mode in ("RGBA", "P"):
                    thumb_img = thumb_img.convert("RGB")
                thumb_img.save(thumb_path, "WEBP", quality=60, method=3)
            
    except Exception as e:
        logger.error(f"Background optimization failed for {filename}: {e}")

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

@app.get("/")
async def read_root(request: Request, db: Session = Depends(get_db), search: str = ""):
    try:
        query = db.query(models.Image).order_by(models.Image.upload_date.desc())
        if search:
            query = query.filter(models.Image.original_name.ilike(f"%{search}%"))
        
        # Load first 50 images for initial landing
        images = query.limit(50).all()
        return templates.TemplateResponse("index.html", {"request": request, "images": images, "search": search})
    except Exception as e:
        logger.error(f"Error loading images for root: {e}")
        return templates.TemplateResponse("index.html", {"request": request, "images": [], "search": ""})

@app.get("/api/images")
async def get_images_api(db: Session = Depends(get_db), offset: int = 0, limit: int = 50, search: str = ""):
    """API endpoint for infinite scrolling and efficient image fetching."""
    query = db.query(models.Image).order_by(models.Image.upload_date.desc())
    if search:
        query = query.filter(models.Image.original_name.ilike(f"%{search}%"))
    
    images = query.offset(offset).limit(limit).all()
    return [{
        "id": img.id,
        "filename": img.filename,
        "original_name": img.original_name,
        "is_favorite": img.is_favorite,
        "upload_date": img.upload_date.isoformat() if img.upload_date else None
    } for img in images]

@app.post("/upload")
async def upload_images(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    uploaded_count = 0
    errors = []
    
    new_image_ids = []
    for file in files:
        if not file.content_type.startswith("image/"):
            errors.append(f"{file.filename} is not an image.")
            continue
            
        try:
            # Generate unique filename
            ext = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            # Save original file instantly
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Quick metadata extraction
            with PILImage.open(file_path) as img:
                width, height = img.size
                actual_size = os.path.getsize(file_path)

            # OFFLOAD heavy processing to background
            background_tasks.add_task(process_image_versions, file_path, unique_filename)

            # Save to DB instantly
            db_image = models.Image(
                filename=unique_filename,
                original_name=file.filename,
                width=width,
                height=height,
                size=actual_size
            )
            db.add(db_image)
            db.commit()
            db.refresh(db_image)
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
            "is_favorite": img.is_favorite
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
