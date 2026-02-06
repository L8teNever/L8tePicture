/**
 * P.I.X.I. Gallery Manager
 * Handles Grid, Progressive Loading & Fullscreen Viewer
 */

class GalleryManager {
    constructor() {
        this.grid = document.getElementById('galleryGrid');
        this.viewer = document.getElementById('fullscreenViewer');
        this.viewerContent = document.getElementById('imageContainer');
        this.images = [];
        this.currentIndex = 0;

        this.init();
    }

    async init() {
        await this.loadImages();
        this.setupEventListeners();
    }

    async loadImages() {
        try {
            const response = await fetch('/api/gallery');
            this.images = await response.json();
            this.renderGrid();

            document.getElementById('loadingIndicator').style.display = 'none';
            if (this.images.length === 0) {
                document.getElementById('emptyState').style.display = 'flex';
            }
        } catch (error) {
            console.error('Failed to load gallery:', error);
        }
    }

    renderGrid() {
        this.grid.innerHTML = '';
        this.images.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.setAttribute('data-index', index);

            // BlurHash or Small Preview Placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'grid-item-blur';
            placeholder.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';

            // Real Grid Preview
            const preview = document.createElement('img');
            preview.className = 'grid-item-img';
            preview.loading = 'lazy';
            preview.src = img.grid_preview;
            preview.onload = () => preview.classList.add('loaded');

            item.appendChild(placeholder);
            item.appendChild(preview);
            item.onclick = () => this.openViewer(index);

            this.grid.appendChild(item);
        });
    }

    openViewer(index) {
        this.currentIndex = index;
        const imgData = this.images[index];

        this.viewer.classList.add('active');
        this.updateViewerContent();

        // Apply theme from current image
        const tempImg = new Image();
        tempImg.src = imgData.grid_preview;
        tempImg.onload = () => window.themeEngine.applyThemeFromImage(tempImg);

        document.body.style.overflow = 'hidden';
    }

    updateViewerContent() {
        const imgData = this.images[this.currentIndex];
        this.viewerContent.innerHTML = '';

        const img = document.createElement('img');
        img.src = imgData.full_preview;
        img.alt = imgData.original_path;
        img.className = 'scale-in';

        this.viewerContent.appendChild(img);
        document.getElementById('viewerTitle').textContent = imgData.original_path.split('/').pop();
        document.getElementById('viewerCounter').textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }

    next() {
        if (this.currentIndex < this.images.length - 1) {
            this.currentIndex++;
            this.updateViewerContent();
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateViewerContent();
        }
    }

    closeViewer() {
        this.viewer.classList.remove('active');
        document.body.style.overflow = '';
    }

    setupEventListeners() {
        document.getElementById('closeViewer').onclick = () => this.closeViewer();
        document.getElementById('nextBtn').onclick = () => this.next();
        document.getElementById('prevBtn').onclick = () => this.prev();

        document.getElementById('gridSlider').addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('gridValue').textContent = val;
            this.grid.style.gridTemplateColumns = `repeat(${val}, 1fr)`;
        });

        document.getElementById('gridSizeBtn').onclick = () => {
            const controls = document.getElementById('gridControls');
            controls.style.display = controls.style.display === 'none' ? 'flex' : 'none';
        };

        // Keyboard Navigation
        document.addEventListener('keydown', (e) => {
            if (!this.viewer.classList.contains('active')) return;
            if (e.key === 'ArrowRight') this.next();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'Escape') this.closeViewer();
        });
    }
}

window.galleryManager = new GalleryManager();
