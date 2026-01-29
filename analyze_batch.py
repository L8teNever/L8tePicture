"""
Batch Analysis Script
Analyzes all existing images in the database that haven't been analyzed yet.
"""

import os
import sys
from database import SessionLocal
import models
from image_analyzer import get_analyzer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")

def analyze_existing_images():
    """Analyze all images that haven't been analyzed yet."""
    db = SessionLocal()
    analyzer = get_analyzer()
    
    try:
        # Get all unanalyzed images
        unanalyzed = db.query(models.Image).filter(
            models.Image.analyzed == False,
            models.Image.media_type == "image"
        ).all()
        
        total = len(unanalyzed)
        logger.info(f"Found {total} unanalyzed images")
        
        for idx, image in enumerate(unanalyzed, 1):
            try:
                file_path = os.path.join(UPLOAD_DIR, image.filename)
                
                if not os.path.exists(file_path):
                    logger.warning(f"[{idx}/{total}] File not found: {image.filename}")
                    continue
                
                logger.info(f"[{idx}/{total}] Analyzing {image.filename}...")
                
                # Perform analysis
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
        
        logger.info(f"✓ Analysis complete! Processed {total} images")
        
    except Exception as e:
        logger.error(f"Batch analysis failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("L8tePicture - Batch Image Analysis")
    print("=" * 60)
    print()
    
    analyze_existing_images()
    
    print()
    print("=" * 60)
    print("Analysis complete!")
    print("=" * 60)
