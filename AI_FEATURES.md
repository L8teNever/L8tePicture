# L8tePicture - Smart Image Analysis & Filtering

## 🎯 New Features

### 1. **AI-Powered Image Analysis**
Every uploaded image is automatically analyzed using computer vision to detect:
- **Face Detection**: Counts the number of faces in each image
- **People Detection**: Identifies if people are present in the image
- **Dominant Colors**: Extracts the top 3 dominant colors
- **Brightness Analysis**: Calculates average brightness (0-1 scale)
- **Auto-Tagging**: Generates smart tags like "portrait", "group", "dark", "bright", "warm", "cool", etc.

### 2. **Smart Search & Filtering**
Use powerful search filters directly in the search bar:

#### Filter Examples:
```
faces:2              # Find images with at least 2 faces
people:true          # Find images with people
brightness:bright    # Find bright images (brightness > 0.7)
brightness:dark      # Find dark images (brightness < 0.3)
brightness:0.5       # Find images with brightness >= 0.5
date:2024            # Find images from 2024
tag:portrait         # Find images tagged as portraits
tag:group            # Find group photos
```

#### Combine Multiple Filters:
```
faces:3 tag:group date:2024    # Group photos from 2024 with 3+ faces
people:true brightness:bright  # Bright photos with people
```

### 3. **Available Auto-Tags**
The system automatically generates these tags:
- **People Tags**: `portrait`, `duo`, `group`, `faces`, `people`
- **Lighting Tags**: `dark`, `night`, `bright`, `daylight`
- **Color Tags**: `red-tones`, `green-tones`, `blue-tones`, `warm`, `cool`

## 🔧 Technical Details

### Database Schema
New columns added to the `images` table:
- `analyzed` (Boolean): Whether the image has been analyzed
- `face_count` (Integer): Number of detected faces
- `has_people` (Boolean): Whether people are present
- `dominant_colors` (JSON): Array of RGB color values
- `brightness` (Float): Average brightness (0-1)
- `tags` (JSON): Array of auto-generated tags

### Image Analysis Pipeline
1. **Upload**: User uploads an image
2. **Quick Save**: Image is saved immediately to database
3. **Background Processing**: 
   - Thumbnail generation (300px)
   - Preview generation (1600px)
   - AI analysis (face detection, color extraction, etc.)
4. **Database Update**: Analysis results are stored

### Technologies Used
- **OpenCV**: Face and people detection using Haar Cascades
- **K-Means Clustering**: Dominant color extraction
- **NumPy**: Brightness calculation and image processing
- **FastAPI**: Backend API with advanced filtering
- **SQLAlchemy**: Database ORM with JSON field support

## 📊 Performance
- **Lightweight**: Uses Haar Cascades (no heavy ML models)
- **Fast**: Analysis runs in background, doesn't block uploads
- **Efficient**: Pre-trained models, no training required
- **Scalable**: Works with 10,000+ images

## 🚀 Usage

### Starting the Application
```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

The server will automatically:
1. Run database migrations to add new columns
2. Start analyzing new uploads in the background
3. Enable smart filtering in the search bar

### Example Searches
Try these in the search bar:
- `faces:1` - Find selfies/portraits
- `people:true brightness:bright` - Find bright photos with people
- `tag:group` - Find group photos
- `date:2024-01` - Find photos from January 2024
- `tag:night` - Find nighttime photos

## 🎨 UI Features
- **Smart Search Helper**: Hover over the info icon (ℹ️) in the search bar to see available filters
- **Real-time Filtering**: Results update as you type
- **Visual Feedback**: Filter status shown in search bar

## 🔮 Future Enhancements
- Object detection (cars, animals, etc.)
- Scene classification (indoor, outdoor, beach, etc.)
- Emotion detection in faces
- Advanced pose estimation
- Video content analysis
- Duplicate detection based on visual similarity
- Smart albums based on AI analysis

## 📝 Notes
- Analysis runs automatically on upload
- Existing images can be analyzed by re-uploading or running a batch analysis script
- Video analysis is planned for future releases
- All analysis is done locally - no external API calls
