import os
import uuid
import shutil
from typing import List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from PIL import Image as PILImage
import models
from database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="L8tePicture")

# Setup directories
UPLOAD_DIR = "uploads"
THUMB_DIR = "thumbnails"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=THUMB_DIR), name="thumbnails")
templates = Jinja2Templates(directory="templates")

def create_thumbnail(image_path: str, thumb_path: str, size=(400, 400)):
    with PILImage.open(image_path) as img:
        img.thumbnail(size)
        # Convert to RGB if necessary (for RGBA images like PNG to JPEG if needed, 
        # but here we keep format or use WebP for efficiency)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumb_path, "JPEG", quality=85)

@app.on_event("startup")
async def startup_event():
    # Start the folder observer
    from folder_observer import start_observer
    start_observer()

@app.get("/")
async def read_root(request: Request, db: Session = Depends(get_db)):
    images = db.query(models.Image).order_by(models.Image.upload_date.desc()).all()
    return templates.TemplateResponse("index.html", {"request": request, "images": images})

@app.post("/upload")
async def upload_images(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    uploaded_files = []
    for file in files:
        # Check if file is an image
        if not file.content_type.startswith("image/"):
            continue
            
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        thumb_path = os.path.join(THUMB_DIR, unique_filename)

        # Save original file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process image
        with PILImage.open(file_path) as img:
            width, height = img.size
            size = os.path.getsize(file_path)

        # Create thumbnail
        create_thumbnail(file_path, thumb_path)

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
        db.refresh(db_image)
        uploaded_files.append(db_image)

    return {"message": f"Successfully uploaded {len(uploaded_files)} images", "count": len(uploaded_files)}

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
    
    if os.path.exists(file_path):
        os.remove(file_path)
    if os.path.exists(thumb_path):
        os.remove(thumb_path)
        
    db.delete(image)
    db.commit()
    return {"message": "Image deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
