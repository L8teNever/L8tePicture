import os
import uuid
import shutil
import logging
from typing import List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Request
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
        logger.error(f"Image optimization failed for {filename}: {e}")

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
async def read_root(request: Request, db: Session = Depends(get_db)):
    try:
        images = db.query(models.Image).order_by(models.Image.upload_date.desc()).all()
        return templates.TemplateResponse("index.html", {"request": request, "images": images})
    except Exception as e:
        logger.error(f"Error loading images for root: {e}")
        return templates.TemplateResponse("index.html", {"request": request, "images": []})

@app.post("/upload")
async def upload_images(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    uploaded_count = 0
    errors = []
    
    for file in files:
        if not file.content_type.startswith("image/"):
            errors.append(f"{file.filename} is not an image.")
            continue
            
        try:
            # Generate unique filename to avoid collisions
            ext = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            thumb_path = os.path.join(THUMB_DIR, unique_filename)

            # Save original file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Process image metadata and create optimized versions (Preview & Thumb)
            with PILImage.open(file_path) as img:
                width, height = img.size
                size = os.path.getsize(file_path)

            process_image_versions(file_path, unique_filename)

            # Save to DB
            db_image = models.Image(
                filename=unique_filename,
                original_name=file.filename,
                width=width,
                height=height,
                size=size
            )
            db.add(db_image)
            db.commit()
            uploaded_count += 1
            logger.info(f"Successfully uploaded: {unique_filename} (original: {file.filename})")
            
        except Exception as e:
            logger.error(f"Failed to upload {file.filename}: {e}")
            errors.append(f"Could not process {file.filename}: {str(e)}")

    if errors and uploaded_count == 0:
        return JSONResponse(status_code=500, content={"message": "Upload failed", "errors": errors})
        
    return {
        "message": f"Successfully uploaded {uploaded_count} images", 
        "count": uploaded_count,
        "errors": errors
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
