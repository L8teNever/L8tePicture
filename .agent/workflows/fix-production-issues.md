---
description: Fix Tailwind CDN and Missing Thumbnails
---

# Fix Production Issues

This workflow addresses two main issues:
1. Tailwind CSS CDN warning (not production-ready)
2. Missing thumbnail files (404 errors)

## Steps

### 1. Install Tailwind CSS Properly

Instead of using the CDN, we'll install Tailwind CSS as a PostCSS plugin:

```bash
npm init -y
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

### 2. Configure Tailwind

Create `tailwind.config.js` with the configuration from the HTML files.

### 3. Create CSS Input File

Create `static/css/input.css` with Tailwind directives.

### 4. Build Tailwind CSS

```bash
npx tailwindcss -i ./static/css/input.css -o ./static/css/tailwind.css --minify
```

### 5. Update HTML Files

Remove CDN script tags and link to the built CSS file instead.

### 6. Fix Missing Thumbnails

Run the thumbnail generation script to create missing thumbnails:

```bash
python generate_thumbnails.py
```

### 7. Verify Database Integrity

Check for orphaned database entries and clean them up if needed.

## Notes

- For development, you can run Tailwind in watch mode: `npx tailwindcss -i ./static/css/input.css -o ./static/css/tailwind.css --watch`
- The thumbnail generation script should be run whenever you notice missing images
- Consider adding error handling in the frontend to show placeholder images when thumbnails are missing
