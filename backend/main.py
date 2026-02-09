"""
P.I.X.I. - Professional Image X-platform Interface
FastAPI Backend with Image Processing Pipeline
"""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

from config import settings
from image_processor import ImageProcessor


# Global processor instance
processor = ImageProcessor()
observer = None


class ImageWatcher(FileSystemEventHandler):
    """Watch for new/modified images and trigger processing"""
    
    def __init__(self, processor: ImageProcessor):
        self.processor = processor
        self.processing_lock = asyncio.Lock()
    
    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            self._handle_file(event.src_path)
    
    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            self._handle_file(event.src_path)
    
    def _handle_file(self, file_path: str):
        """Process file if it's a supported image"""
        path = Path(file_path)
        if path.suffix.lower() in settings.SUPPORTED_FORMATS:
            print(f"Detected new/modified image: {path.name}")
            # Schedule processing
            asyncio.create_task(self.processor.process_image(path))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global observer
    
    # Startup: Start initial scan in background
    print("🎨 P.I.X.I. Starting up...")
    print(f"📁 Pictures directory: {settings.PICTURES_DIR}")
    print(f"💾 Cache directory: {settings.CACHE_DIR}")
    
    # Start processing in background so API becomes available immediately
    asyncio.create_task(processor.scan_directory())
    
    # Start file watcher
    if settings.ENABLE_WATCH and settings.PICTURES_DIR.exists():
        event_handler = ImageWatcher(processor)
        observer = Observer()
        observer.schedule(event_handler, str(settings.PICTURES_DIR), recursive=True)
        observer.start()
        print("👀 File watcher started")
    
    print("✅ P.I.X.I. ready!")
    
    yield
    
    # Shutdown
    if observer:
        observer.stop()
        observer.join()
    print("👋 P.I.X.I. shutting down")


# Create FastAPI app
app = FastAPI(
    title="P.I.X.I.",
    description="Professional Image X-platform Interface",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware (for local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Routes

@app.get("/")
async def root():
    """Serve the main application"""
    frontend_path = Path(__file__).parent.parent / "frontend" / "index.html"
    if frontend_path.exists():
        return FileResponse(frontend_path)
    return {"message": "P.I.X.I. API - Frontend not found"}


from pydantic import BaseModel

class FavoriteRequest(BaseModel):
    original_path: str

class VoteRequest(BaseModel):
    original_path: str
    delta: int # +1 for like, -1 for dislike

@app.get("/api/photos")
async def get_photos() -> List[dict]:
    """Get all images with metadata"""
    try:
        gallery = await processor.get_gallery_index()
        return gallery
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/photos/favorite")
async def toggle_favorite(req: FavoriteRequest):
    """Toggle favorite status for a photo"""
    try:
        is_fav = await processor.toggle_favorite(req.original_path)
        return {"status": "success", "is_fav": is_fav}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/photos/vote")
async def vote_photo(req: VoteRequest):
    """Vote (like/dislike) for a photo"""
    try:
        new_score = await processor.vote(req.original_path, req.delta)
        return {"status": "success", "new_score": new_score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scan")
@app.get("/api/scan")
async def scan_gallery():
    """Trigger a manual rescan of the pictures directory"""
    try:
        gallery = await processor.scan_directory()
        return {"status": "success", "images_processed": len(gallery)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """Upload multiple images to the gallery"""
    try:
        uploaded = []
        failed = []
        
        for file in files:
            # Validate file type
            if not file.filename.lower().endswith(tuple(settings.SUPPORTED_FORMATS)):
                failed.append({
                    "filename": file.filename,
                    "error": "Unsupported file format"
                })
                continue
            
            # Generate unique filename if exists
            target_path = settings.PICTURES_DIR / file.filename
            counter = 1
            while target_path.exists():
                name_parts = file.filename.rsplit('.', 1)
                target_path = settings.PICTURES_DIR / f"{name_parts[0]}_{counter}.{name_parts[1]}"
                counter += 1
            
            # Save file
            try:
                content = await file.read()
                target_path.write_bytes(content)
                
                # Trigger processing in background
                asyncio.create_task(processor.process_image(target_path))
                
                uploaded.append({
                    "filename": file.filename,
                    "saved_as": target_path.name,
                    "size": len(content)
                })
            except Exception as e:
                failed.append({
                    "filename": file.filename,
                    "error": str(e)
                })
        
        return {
            "status": "success",
            "uploaded": len(uploaded),
            "failed": len(failed),
            "files": uploaded,
            "errors": failed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/music")
async def get_music_files() -> List[dict]:
    """Get list of available music files"""
    try:
        music_files = []
        if settings.MUSIC_DIR.exists():
            for ext in ['.mp3', '.m4a', '.ogg', '.wav', '.flac']:
                for file in settings.MUSIC_DIR.rglob(f"*{ext}"):
                    music_files.append({
                        'name': file.stem,
                        'path': f"/music/{file.name}",
                        'size': file.stat().st_size
                    })
        return sorted(music_files, key=lambda x: x['name'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Get gallery statistics"""
    try:
        gallery = await processor.get_gallery_index()
        total_size = sum(img.get('file_size', 0) for img in gallery)
        
        # Get top 5 photos by score
        top_photos = sorted(gallery, key=lambda x: x.get('score', 0), reverse=True)[:5]
        
        return {
            'total_images': len(gallery),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'top_photos': top_photos,
            'cache_dir': str(settings.CACHE_DIR),
            'pictures_dir': str(settings.PICTURES_DIR)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Static file serving
app.mount("/cache", StaticFiles(directory=str(settings.CACHE_DIR)), name="cache")
app.mount("/music", StaticFiles(directory=str(settings.MUSIC_DIR)), name="music")
app.mount("/pictures", StaticFiles(directory=str(settings.PICTURES_DIR)), name="pictures")

# Mount frontend
frontend_dir = Path(__file__).parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info"
    )
