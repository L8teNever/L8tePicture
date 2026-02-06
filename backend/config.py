"""
P.I.X.I. Configuration
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Directories
    PICTURES_DIR: Path = Path("/pictures")
    CACHE_DIR: Path = Path("/cache")
    MUSIC_DIR: Path = Path("/music")
    
    # Image processing settings
    GRID_PREVIEW_SIZE: int = 400
    FULL_PREVIEW_SIZE: int = 1920
    WEBP_QUALITY: int = 85
    
    # Supported image formats
    SUPPORTED_FORMATS: list[str] = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Cache settings
    ENABLE_WATCH: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Ensure directories exist
settings.CACHE_DIR.mkdir(parents=True, exist_ok=True)
(settings.CACHE_DIR / "grid").mkdir(exist_ok=True)
(settings.CACHE_DIR / "full").mkdir(exist_ok=True)
(settings.CACHE_DIR / "blurhash").mkdir(exist_ok=True)
