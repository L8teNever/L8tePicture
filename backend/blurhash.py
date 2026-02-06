"""
BlurHash generation for progressive image loading
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
        
        Args:
            image_path: Path to the image file
            components_x: Number of horizontal components (4-9 recommended)
            components_y: Number of vertical components (3-9 recommended)
            
        Returns:
            BlurHash string or None if generation fails
        """
        try:
            with Image.open(image_path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize for faster processing (max 100px on longest side)
                img.thumbnail((100, 100), Image.Resampling.LANCZOS)
                
                # Generate BlurHash
                hash_string = blurhash.encode(img, components_x, components_y)
                return hash_string
                
        except Exception as e:
            print(f"Error generating BlurHash for {image_path}: {e}")
            return None
    
    @staticmethod
    def decode_to_image(hash_string: str, width: int = 32, height: int = 32) -> Optional[Image.Image]:
        """
        Decode a BlurHash string to a PIL Image (for testing)
        
        Args:
            hash_string: The BlurHash string
            width: Output image width
            height: Output image height
            
        Returns:
            PIL Image or None if decoding fails
        """
        try:
            pixels = blurhash.decode(hash_string, width, height)
            img = Image.frombytes('RGB', (width, height), pixels)
            return img
        except Exception as e:
            print(f"Error decoding BlurHash: {e}")
            return None
