from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Float
from datetime import datetime
from database import Base

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    original_name = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    is_favorite = Column(Boolean, default=False)
    width = Column(Integer)
    height = Column(Integer)
    size = Column(Integer)  # in bytes
    content_hash = Column(String, index=True)
    media_type = Column(String, default="image") # "image" or "video"
    
    # AI Analysis fields
    analyzed = Column(Boolean, default=False)
    faces_count = Column(Integer, default=0)
    has_people = Column(Boolean, default=False)
    dominant_colors = Column(JSON)  # Store top 3 dominant colors as JSON array
    brightness = Column(Float)  # Average brightness 0-1
    tags = Column(JSON)  # Auto-generated tags based on analysis
    pose_info = Column(JSON) # Information about poses (standing, sitting, etc)
