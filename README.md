# L8tePicture

Eine hocheffiziente, moderne Bildergalerie mit Fokus auf Geschwindigkeit und Ästhetik.

## Features
- **Multip-Upload**: Lade viele Bilder gleichzeitig hoch, die nacheinander verarbeitet werden.
- **Performance**: Automatisierte Erstellung von Thumbnails für blitzschnelle Ladezeiten.
- **Favoriten**: Markiere deine besten Bilder.
- **Diashow**: Betrachte deine Bilder in einer eleganten, flüssigen Diashow.
- **Docker Ready**: Direkt als Container ausführbar.

## Installation & Start

### Mit Docker (Empfohlen)
1. Build den Container:
   ```bash
   docker build -t l8tepicture .
   ```
2. Starte den Container:
   ```bash
   docker run -p 8000:8000 -v $(pwd)/uploads:/app/uploads -v $(pwd)/thumbnails:/app/thumbnails l8tepicture
   ```

### Lokal (ohne Docker)
1. Installiere Abhängigkeiten:
   ```bash
   pip install -r requirements.txt
   ```
2. Starte den Server:
   ```bash
   python main.py
   ```
   Die Website ist dann erreichbar unter `http://localhost:8000`.

## Technik
- **Backend**: FastAPI (Python)
- **Frontend**: Vanilla JS, CSS3 (Glassmorphism), HTML5
- **Datenbank**: SQLite mit SQLAlchemy
- **Bildverarbeitung**: Pillow (PIL)
