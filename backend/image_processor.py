"""
Image Processing Pipeline for P.I.X.I.
Generates BlurHash, Grid Preview, and Full Preview for each image
"""
import asyncio
import json
from pathlib import Path
from typing import Optional, Dict, List
from PIL import Image, ImageOps
import aiofiles
from datetime import datetime

from config import settings
from blur_helper import BlurHashGenerator


class ImageProcessor:
    """Process images and generate all required variants"""
    
    def __init__(self):
        self.blurhash_gen = BlurHashGenerator()
        self.is_scanning = False
        self.metadata_cache: Dict[str, dict] = {}
        
    async def process_image(self, image_path: Path) -> Optional[Dict]:
        """
        Process a single image and generate all variants
        """
        try:
            rel_path = image_path.relative_to(settings.PICTURES_DIR)
            stem = image_path.stem
            
            grid_path = settings.CACHE_DIR / "grid" / f"{stem}.webp"
            full_path = settings.CACHE_DIR / "full" / f"{stem}.webp"
            blurhash_path = settings.CACHE_DIR / "blurhash" / f"{stem}.txt"
            
            if await self._is_cached(image_path, grid_path, full_path, blurhash_path):
                return await self._load_metadata(image_path)
            
            print(f"Processing: {rel_path}")
            
            blurhash_string = None
            original_size = (0, 0)

            # ALL processing inside this block
            with Image.open(image_path) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                original_size = img.size
                
                # 1. Generate BlurHash
                blurhash_string = self.blurhash_gen.generate_from_img(img)
                
                # 2. Generate Full Preview
                full_img = img.copy()
                full_img.thumbnail((settings.FULL_PREVIEW_SIZE, settings.FULL_PREVIEW_SIZE), 
                                   Image.Resampling.LANCZOS)
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_img.save(full_path, 'WEBP', quality=settings.WEBP_QUALITY, method=6)
                
                # 3. Generate Grid Preview (from the thumb, very fast)
                grid_img = full_img.copy()
                grid_img.thumbnail((settings.GRID_PREVIEW_SIZE, settings.GRID_PREVIEW_SIZE), 
                                   Image.Resampling.LANCZOS)
                grid_path.parent.mkdir(parents=True, exist_ok=True)
                grid_img.save(grid_path, 'WEBP', quality=settings.WEBP_QUALITY, method=6)
                
                full_img.close()
                grid_img.close()

            # Save BlurHash to disk
            if blurhash_string:
                blurhash_path.parent.mkdir(parents=True, exist_ok=True)
                async with aiofiles.open(blurhash_path, 'w') as f:
                    await f.write(blurhash_string)
            
            metadata = {
                'original_path': str(rel_path),
                'original_size': original_size,
                'grid_preview': f"/cache/grid/{stem}.webp",
                'full_preview': f"/cache/full/{stem}.webp",
                'blurhash': blurhash_string,
                'processed_at': datetime.now().isoformat(),
                'file_size': image_path.stat().st_size,
                'modified_at': datetime.fromtimestamp(image_path.stat().st_mtime).isoformat()
            }
            
            self.metadata_cache[str(rel_path)] = metadata
            await asyncio.sleep(0.05) # Tiny break
            return metadata
            
        except Exception as e:
            print(f"Error processing {image_path}: {e}")
            return None

    async def _is_cached(self, original: Path, grid: Path, full: Path, blurhash: Path) -> bool:
        """Check if cached versions exist and are up to date"""
        if not (grid.exists() and full.exists() and blurhash.exists()):
            return False
        
        # Check if original is newer than cached versions
        original_mtime = original.stat().st_mtime
        return (grid.stat().st_mtime >= original_mtime and
                full.stat().st_mtime >= original_mtime)
    
    async def _load_metadata(self, image_path: Path) -> Dict:
        """Load metadata for an already processed image"""
        rel_path = image_path.relative_to(settings.PICTURES_DIR)
        stem = image_path.stem
        
        # Load BlurHash
        blurhash_path = settings.CACHE_DIR / "blurhash" / f"{stem}.txt"
        blurhash_string = None
        if blurhash_path.exists():
            async with aiofiles.open(blurhash_path, 'r') as f:
                blurhash_string = await f.read()
        
        # Get image dimensions (using original or full preview to be fast)
        # Using full preview if available is faster than original for big RAWs/JPGs
        dim_source = settings.CACHE_DIR / "full" / f"{stem}.webp"
        if not dim_source.exists():
            dim_source = image_path
            
        with Image.open(dim_source) as img:
            original_size = img.size
        
        return {
            'original_path': str(rel_path),
            'original_size': original_size,
            'grid_preview': f"/cache/grid/{stem}.webp",
            'full_preview': f"/cache/full/{stem}.webp",
            'blurhash': blurhash_string,
            'file_size': image_path.stat().st_size,
            'modified_at': datetime.fromtimestamp(image_path.stat().st_mtime).isoformat()
        }

    async def scan_directory(self) -> List[Dict]:
        """
        Scan pictures directory and process all images
        """
        if self.is_scanning:
            print("Scan already in progress, skipping...")
            return []
            
        self.is_scanning = True
        try:
            all_metadata = []
            image_files = []
            for ext in settings.SUPPORTED_FORMATS:
                image_files.extend(settings.PICTURES_DIR.rglob(f"*{ext}"))
                image_files.extend(settings.PICTURES_DIR.rglob(f"*{ext.upper()}"))
            
            print(f"Found {len(image_files)} images to process")
            
            for i, image_path in enumerate(sorted(image_files)):
                metadata = await self.process_image(image_path)
                if metadata:
                    all_metadata.append(metadata)
                
                # Save progress every 50 images
                if i > 0 and i % 50 == 0:
                    await self._save_index(all_metadata)
            
            await self._save_index(all_metadata)
            print(f"Finished processing {len(all_metadata)} images")
            return all_metadata
        finally:
            self.is_scanning = False

    async def _save_index(self, data: List[Dict]):
        index_path = settings.CACHE_DIR / "gallery_index.json"
        async with aiofiles.open(index_path, 'w') as f:
            await f.write(json.dumps(data, indent=2))
    
    async def get_gallery_index(self) -> List[Dict]:
        """Load or generate gallery index"""
        index_path = settings.CACHE_DIR / "gallery_index.json"
        
        if index_path.exists():
            async with aiofiles.open(index_path, 'r') as f:
                content = await f.read()
                return json.loads(content)
        else:
            return await self.scan_directory()
