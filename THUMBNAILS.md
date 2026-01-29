# 🖼️ Thumbnails & Previews Generierung

## Problem: Vorschaubilder werden nicht angezeigt

Wenn die Vorschaubilder (Thumbnails) nicht geladen werden, fehlen wahrscheinlich die generierten Thumbnail-Dateien.

## Lösung: Thumbnails generieren

### Automatisch beim Upload
Neue Bilder erhalten automatisch Thumbnails beim Hochladen.

### Für bestehende Bilder

Führe das Thumbnail-Generierungs-Skript aus:

```bash
py generate_thumbnails.py
```

### Was macht das Skript?

1. ✅ Erstellt die Verzeichnisse `thumbnails/` und `previews/` falls nicht vorhanden
2. ✅ Durchsucht alle Bilder in der Datenbank
3. ✅ Generiert fehlende Thumbnails (300x300px, WebP)
4. ✅ Generiert fehlende Previews (1600x1600px, WebP)
5. ✅ Zeigt Fortschritt und Statistiken

### Verzeichnisstruktur

```
L8tePicture/
├── uploads/          # Original-Dateien
├── previews/         # Mittelgroße Vorschau (1600px, für Slideshow)
└── thumbnails/       # Kleine Thumbnails (300px, für Galerie)
```

### Thumbnail-Größen

- **Thumbnail**: Max 300x300px, WebP, Quality 60
- **Preview**: Max 1600x1600px, WebP, Quality 75
- **Original**: Unverändert in `uploads/`

### Wann Thumbnails fehlen können

- Nach Migration von einem anderen System
- Nach manueller Datei-Kopie
- Nach Datenbank-Import
- Bei Server-Neuinstallation

### Automatische Generierung

Beim Server-Start werden die Verzeichnisse automatisch erstellt:
```python
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)
```

### Performance

- ~1-2 Sekunden pro Bild
- Überspringt bereits vorhandene Thumbnails
- Zeigt Fortschritt in Echtzeit

### Fehlerbehandlung

Das Skript:
- ✅ Überspringt fehlende Originaldateien
- ✅ Loggt Fehler ohne Abbruch
- ✅ Zeigt Zusammenfassung am Ende

## Troubleshooting

### Problem: "File not found"
**Lösung**: Die Originaldatei fehlt in `uploads/`. Prüfe ob die Datei existiert.

### Problem: "Permission denied"
**Lösung**: Stelle sicher, dass die Verzeichnisse Schreibrechte haben.

### Problem: Thumbnails werden nicht angezeigt
**Lösung**: 
1. Führe `py generate_thumbnails.py` aus
2. Prüfe ob `thumbnails/` und `previews/` Verzeichnisse existieren
3. Prüfe Browser-Konsole auf 404-Fehler
4. Leere Browser-Cache (Strg+F5)

---

**Nach der Generierung sollten alle Vorschaubilder korrekt geladen werden! 🎉**
