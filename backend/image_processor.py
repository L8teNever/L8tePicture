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
        self.gallery_index: List[Dict] = []
        self._index_lock = asyncio.Lock()
        
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
            
            metadata = None
            if await self._is_cached(image_path, grid_path, full_path, blurhash_path):
                metadata = await self._load_metadata(image_path)
            else:
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
            
            if metadata:
                self.metadata_cache[str(rel_path)] = metadata
                # Update live index
                async with self._index_lock:
                    # Remove old entry if exists (by original_path)
                    self.gallery_index = [item for item in self.gallery_index if item['original_path'] != metadata['original_path']]
                    self.gallery_index.append(metadata)
                    # Keep it sorted so X von Y is consistent
                    self.gallery_index.sort(key=lambda x: x['original_path'])
                    await self._save_index(self.gallery_index)
                
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
        # Using full preview if available is faster than original for big JPGs
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
            return self.gallery_index
            
        self.is_scanning = True
        try:
            image_files = []
            for ext in settings.SUPPORTED_FORMATS:
                image_files.extend(settings.PICTURES_DIR.rglob(f"*{ext}"))
                image_files.extend(settings.PICTURES_DIR.rglob(f"*{ext.upper()}"))
            
            print(f"Found {len(image_files)} images total")
            
            new_index = []
            for i, image_path in enumerate(sorted(image_files)):
                metadata = await self.process_image(image_path)
                if metadata:
                    new_index.append(metadata)
            
            async with self._index_lock:
                self.gallery_index = new_index
                await self._save_index(self.gallery_index)
            
            print(f"Finished processing {len(self.gallery_index)} images")
            return self.gallery_index
        finally:
            self.is_scanning = False

    async def _save_index(self, data: List[Dict]):
        index_path = settings.CACHE_DIR / "gallery_index.json"
        async with aiofiles.open(index_path, 'w') as f:
            await f.write(json.dumps(data, indent=2))
    
    async def get_gallery_index(self) -> List[Dict]:
        """Load or generate gallery index"""
        if self.gallery_index:
            return self.gallery_index
            
        index_path = settings.CACHE_DIR / "gallery_index.json"
        if index_path.exists():
            async with aiofiles.open(index_path, 'r') as f:
                content = await f.read()
                data = json.loads(content)
                async with self._index_lock:
                    self.gallery_index = data
                return data
        else:
            return await self.scan_directory()
