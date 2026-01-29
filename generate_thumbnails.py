"""
Generate Missing Thumbnails Script
Creates thumbnails and previews for all images that don't have them yet.
"""

import os
import sys
from PIL import Image as PILImage
from database import SessionLocal
import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
PREVIEW_DIR = os.path.join(os.getcwd(), "previews")
THUMB_DIR = os.path.join(os.getcwd(), "thumbnails")

# Create directories if they don't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

def generate_thumbnails():
    """Generate thumbnails and previews for all images."""
    db = SessionLocal()
    
    try:
        # Get all images
        images = db.query(models.Image).filter(models.Image.media_type == "image").all()
        
        total = len(images)
        logger.info(f"Found {total} images in database")
        
        generated_thumbs = 0
        generated_previews = 0
        skipped = 0
        errors = 0
        
        for idx, image in enumerate(images, 1):
            try:
                file_path = os.path.join(UPLOAD_DIR, image.filename)
                
                if not os.path.exists(file_path):
                    logger.warning(f"[{idx}/{total}] File not found: {image.filename}")
                    skipped += 1
                    continue
                
                logger.info(f"[{idx}/{total}] Processing {image.filename}...")
                
                # Open image
                img = PILImage.open(file_path)
                
                # Generate Preview (max 1600px)
                preview_path = os.path.join(PREVIEW_DIR, image.filename + ".webp")
                if not os.path.exists(preview_path):
                    preview_img = img.copy()
                    preview_img.thumbnail((1600, 1600))
                    if preview_img.mode in ("RGBA", "P"):
                        preview_img = preview_img.convert("RGB")
                    preview_img.save(preview_path, "WEBP", quality=75, method=6)
                    generated_previews += 1
                    logger.info(f"  ✓ Generated preview")
                
                # Generate Thumbnail (max 300px)
                thumb_path = os.path.join(THUMB_DIR, image.filename + ".webp")
                if not os.path.exists(thumb_path):
                    thumb_img = img.copy()
                    thumb_img.thumbnail((300, 300))
                    if thumb_img.mode in ("RGBA", "P"):
                        thumb_img = thumb_img.convert("RGB")
                    thumb_img.save(thumb_path, "WEBP", quality=60, method=6)
                    generated_thumbs += 1
                    logger.info(f"  ✓ Generated thumbnail")
                
                img.close()
                
            except Exception as e:
                logger.error(f"  ✗ Error processing {image.filename}: {e}")
                errors += 1
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Thumbnail Generation Complete!")
        logger.info(f"{'='*60}")
        logger.info(f"Total images: {total}")
        logger.info(f"Thumbnails generated: {generated_thumbs}")
        logger.info(f"Previews generated: {generated_previews}")
        logger.info(f"Skipped (file not found): {skipped}")
        logger.info(f"Errors: {errors}")
        logger.info(f"{'='*60}")
        
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("L8tePicture - Generate Missing Thumbnails")
    print("=" * 60)
    print()
    
    generate_thumbnails()
    
    print()
    print("=" * 60)
    print("Done!")
    print("=" * 60)
