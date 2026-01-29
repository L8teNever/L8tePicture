"""
Smart Image Analysis Module
Uses OpenCV and basic computer vision to analyze images for:
- Face detection
- People detection
- Dominant colors
- Brightness analysis
- Auto-tagging
"""

import cv2
import numpy as np
import logging
from typing import Dict, List, Tuple
import os

logger = logging.getLogger(__name__)

class ImageAnalyzer:
    def __init__(self):
        """Initialize the image analyzer with pre-trained models."""
        # Load Haar Cascade for face detection (lightweight, no ML dependencies)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Load full body cascade for people detection
        body_cascade_path = cv2.data.haarcascades + 'haarcascade_fullbody.xml'
        self.body_cascade = cv2.CascadeClassifier(body_cascade_path)
        
    def analyze_image(self, image_path: str) -> Dict:
        """
        Perform comprehensive analysis on an image.
        
        Returns:
            dict: {
                'face_count': int,
                'has_people': bool,
                'dominant_colors': list of [r, g, b],
                'brightness': float (0-1),
                'tags': list of strings
            }
        """
        try:
            # Read image with OpenCV
            img_cv = cv2.imread(image_path)
            if img_cv is None:
                logger.error(f"Failed to load image: {image_path}")
                return self._empty_result()
            
            # Convert to RGB for PIL operations
            img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            face_count = self._detect_faces(img_cv)
            
            # Detect people (full body)
            has_people = self._detect_people(img_cv) or face_count > 0
            
            # Extract dominant colors
            dominant_colors = self._extract_dominant_colors(img_rgb)
            
            # Calculate brightness
            brightness = self._calculate_brightness(img_rgb)
            
            # Generate tags
            tags = self._generate_tags(face_count, has_people, brightness, dominant_colors)
            
            return {
                'face_count': face_count,
                'has_people': has_people,
                'dominant_colors': dominant_colors,
                'brightness': brightness,
                'tags': tags
            }
            
        except Exception as e:
            logger.error(f"Error analyzing image {image_path}: {e}")
            return self._empty_result()
    
    def _detect_faces(self, img_cv) -> int:
        """Detect faces in the image using Haar Cascade."""
        try:
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            return len(faces)
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            return 0
    
    def _detect_people(self, img_cv) -> bool:
        """Detect people (full body) in the image."""
        try:
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            bodies = self.body_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=3,
                minSize=(50, 100)
            )
            return len(bodies) > 0
        except Exception as e:
            logger.error(f"People detection error: {e}")
            return False
    
    def _extract_dominant_colors(self, img_rgb, num_colors=3) -> List[List[int]]:
        """Extract dominant colors using k-means clustering."""
        try:
            # Resize image for faster processing
            img_small = cv2.resize(img_rgb, (150, 150))
            
            # Reshape to list of pixels
            pixels = img_small.reshape(-1, 3).astype(np.float32)
            
            # Apply k-means clustering
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
            _, labels, centers = cv2.kmeans(
                pixels, 
                num_colors, 
                None, 
                criteria, 
                10, 
                cv2.KMEANS_RANDOM_CENTERS
            )
            
            # Convert centers to integers and return as list
            dominant_colors = centers.astype(int).tolist()
            return dominant_colors
            
        except Exception as e:
            logger.error(f"Color extraction error: {e}")
            return [[128, 128, 128]]  # Default gray
    
    def _calculate_brightness(self, img_rgb) -> float:
        """Calculate average brightness of the image (0-1 scale)."""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
            
            # Calculate mean brightness
            brightness = np.mean(gray) / 255.0
            return round(brightness, 3)
            
        except Exception as e:
            logger.error(f"Brightness calculation error: {e}")
            return 0.5
    
    def _generate_tags(self, face_count: int, has_people: bool, brightness: float, colors: List) -> List[str]:
        """Generate descriptive tags based on analysis."""
        tags = []
        
        # People tags
        if face_count > 0:
            if face_count == 1:
                tags.append("portrait")
            elif face_count == 2:
                tags.append("duo")
            else:
                tags.append("group")
            tags.append("faces")
        
        if has_people:
            tags.append("people")
        
        # Brightness tags
        if brightness < 0.3:
            tags.append("dark")
            tags.append("night")
        elif brightness > 0.7:
            tags.append("bright")
            tags.append("daylight")
        
        # Color tags (simplified)
        if colors:
            avg_color = np.mean(colors, axis=0)
            r, g, b = avg_color
            
            # Determine dominant color
            if r > g and r > b and r > 150:
                tags.append("red-tones")
            elif g > r and g > b and g > 150:
                tags.append("green-tones")
            elif b > r and b > g and b > 150:
                tags.append("blue-tones")
            
            # Check for warm/cool tones
            if r + g > b * 1.5:
                tags.append("warm")
            elif b > (r + g) * 0.7:
                tags.append("cool")
        
        return tags
    
    def _empty_result(self) -> Dict:
        """Return empty analysis result."""
        return {
            'face_count': 0,
            'has_people': False,
            'dominant_colors': [[128, 128, 128]],
            'brightness': 0.5,
            'tags': []
        }


# Global analyzer instance
_analyzer = None

def get_analyzer() -> ImageAnalyzer:
    """Get or create the global analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = ImageAnalyzer()
    return _analyzer
