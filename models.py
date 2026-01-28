from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
