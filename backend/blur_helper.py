"""
BlurHash generation helper for P.I.X.I.
"""
import blurhash
from PIL import Image
from pathlib import Path
from typing import Optional


class BlurHashGenerator:
    """Generate BlurHash strings from images"""
    
    @staticmethod
    def generate_from_img(img: Image.Image, components_x: int = 4, components_y: int = 3) -> Optional[str]:
        """
        Generate a BlurHash string from an existing PIL Image object
        """
        try:
            # Create a small copy for sampling to keep memory low
            sample = img.copy()
            if sample.mode != 'RGB':
                sample = sample.convert('RGB')
            
            sample.thumbnail((100, 100), Image.Resampling.LANCZOS)
            hash_string = blurhash.encode(sample, components_x, components_y)
            
            sample.close()
            return hash_string
        except Exception as e:
            print(f"Error encoding BlurHash: {e}")
            return None

    @staticmethod
    def generate(image_path: Path, components_x: int = 4, components_y: int = 3) -> Optional[str]:
        """
        Legacy method: Generate from path (opens image)
        """
        try:
            with Image.open(image_path) as img:
                return BlurHashGenerator.generate_from_img(img, components_x, components_y)
        except Exception as e:
            print(f"Error opening image for BlurHash: {e}")
            return None
