"""
BlurHash generation helper for P.I.X.I.
Ensures no name collision with the 'blurhash' library
"""
import blurhash
from PIL import Image
from pathlib import Path
from typing import Optional


class BlurHashGenerator:
    """Generate BlurHash strings from images"""
    
    @staticmethod
    def generate(image_path: Path, components_x: int = 4, components_y: int = 3) -> Optional[str]:
        """
        Generate a BlurHash string from an image
        """
        try:
            with Image.open(image_path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize for faster processing
                img.thumbnail((100, 100), Image.Resampling.LANCZOS)
                
                # Generate BlurHash using the library
                hash_string = blurhash.encode(img, components_x, components_y)
                return hash_string
                
        except Exception as e:
            print(f"Error generating BlurHash for {image_path}: {e}")
            return None
