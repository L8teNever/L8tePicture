/**
 * P.I.X.I. Gallery Manager
 */

class GalleryManager {
    constructor() {
        this.grid = document.getElementById('galleryGrid');
        this.viewer = document.getElementById('fullscreenViewer');
        this.viewerImage = document.getElementById('viewerImage');

        this.photos = [];
        this.filteredPhotos = [];
        this.currentIndex = 0;
        this.showOnlyFavorites = false;

        this.init();
    }

    async init() {
        await this.loadPhotos();
        this.attachEventListeners();
    }

    async loadPhotos() {
        try {
            const response = await fetch('/api/photos');
            this.photos = await response.json();

            // Add favorite property locally if not exists
            this.photos = this.photos.map(p => ({ ...p, isFav: false }));

            this.updateFilteredPhotos();
            this.render();
        } catch (error) {
            console.error('Error loading photos:', error);
            this.grid.innerHTML = '<div class="empty-state"><p class="text-2xl font-bold">Ladefehler</p></div>';
        }
    }

    updateFilteredPhotos() {
        this.filteredPhotos = this.showOnlyFavorites
            ? this.photos.filter(p => p.isFav)
            : this.photos;
    }

    render() {
        if (this.filteredPhotos.length === 0) {
            this.grid.innerHTML = '<div class="empty-state"><p class="text-2xl font-bold">Keine Fotos gefunden</p></div>';
            return;
        }

        this.grid.innerHTML = this.filteredPhotos.map((photo, index) => `
            <div class="photo-card group" data-index="${index}">
                <img src="${photo.grid_preview}" alt="${photo.original_path}" loading="lazy">
                <div class="absolute top-4 right-4 flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button class="fav-btn p-3 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg click-feedback" data-index="${index}">
                        <svg class="favorite-icon w-5 h-5 ${photo.isFav ? 'active' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${photo.isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    attachEventListeners() {
        // Photo clicks
        this.grid.addEventListener('click', (e) => {
            const card = e.target.closest('.photo-card');
            const favBtn = e.target.closest('.fav-btn');

            if (favBtn) {
                const index = parseInt(favBtn.dataset.index);
                this.toggleFavorite(index);
                return;
            }

            if (card) {
                const index = parseInt(card.dataset.index);
                this.openViewer(index);
            }
        });

        // View Toggle Popover
        const viewToggle = document.getElementById('viewToggle');
        const viewPopover = document.getElementById('viewPopover');

        viewToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            viewPopover.classList.toggle('active');
        });

        document.querySelectorAll('.view-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.setColumns(parseInt(opt.dataset.cols));
                viewPopover.classList.remove('active');
            });
        });

        // Close Popover on click outside
        document.addEventListener('click', () => viewPopover.classList.remove('active'));

        // Filter Toggle
        document.getElementById('filterBtn').addEventListener('click', () => this.toggleFilter());

        // Close Viewer
        document.getElementById('closeViewer').addEventListener('click', () => this.closeViewer());

        // Settings Dialog
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsDialog').classList.add('active');
        });
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsDialog').classList.remove('active');
        });

        // Viewer Fav/Delete
        document.getElementById('viewerFavBtn').addEventListener('click', () => this.toggleFavorite(this.currentIndex));
        document.getElementById('viewerDeleteBtn').addEventListener('click', () => this.requestDelete());

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            document.getElementById('deleteDialog').classList.remove('active');
        });
    }

    toggleFavorite(index) {
        const photo = this.filteredPhotos[index];
        if (photo) {
            photo.isFav = !photo.isFav;
            this.render();
            if (this.viewer.classList.contains('active')) {
                this.updateViewerUI();
            }
        }
    }

    toggleFilter() {
        this.showOnlyFavorites = !this.showOnlyFavorites;
        const btn = document.getElementById('filterBtn');
        const icon = document.getElementById('filterIcon');

        btn.classList.toggle('bg-[var(--md-sys-color-secondary-container)]', this.showOnlyFavorites);
        icon.classList.toggle('active', this.showOnlyFavorites);

        this.updateFilteredPhotos();
        this.render();
    }

    setColumns(cols) {
        const grid = this.grid;
        // Reset classes
        grid.className = "max-w-7xl mx-auto grid gap-6 sm:gap-8 pb-20 transition-all duration-300";

        if (cols === 1) {
            grid.classList.add('grid-cols-1');
        } else {
            grid.classList.add('grid-cols-2');
            if (cols >= 3) grid.classList.add('md:grid-cols-3');
            grid.classList.add(`lg:grid-cols-${cols}`);
        }

        document.getElementById('currentViewLabel').textContent = cols;
        document.querySelectorAll('.view-option').forEach(opt => {
            opt.classList.toggle('active', parseInt(opt.dataset.cols) === cols);
        });
    }

    openViewer(index) {
        this.currentIndex = index;
        const photo = this.filteredPhotos[index];
        if (!photo) return;

        this.viewerImage.src = photo.full_preview;
        this.viewer.classList.add('active');
        this.updateViewerUI();

        // Stop slideshow if manually opening
        if (window.slideshowEngine && !window.slideshowEngine.active) {
            // No-op
        }
    }

    closeViewer() {
        this.viewer.classList.remove('active');
        if (window.slideshowEngine) {
            window.slideshowEngine.stop();
        }
    }

    updateViewerUI() {
        const photo = this.filteredPhotos[this.currentIndex];
        if (!photo) return;

        const favIcon = document.getElementById('viewerFavIcon');
        favIcon.classList.toggle('active', photo.isFav);
        favIcon.setAttribute('fill', photo.isFav ? 'currentColor' : 'none');
    }

    navigate(direction) {
        const len = this.filteredPhotos.length;
        if (len === 0) return;

        this.currentIndex = (this.currentIndex + direction + len) % len;
        const photo = this.filteredPhotos[this.currentIndex];

        // Smooth transition
        this.viewerImage.style.opacity = '0';
        this.viewerImage.style.transform = 'scale(0.95)';

        setTimeout(() => {
            this.viewerImage.src = photo.full_preview;
            this.viewerImage.style.opacity = '1';
            this.viewerImage.style.transform = 'scale(1)';
            this.updateViewerUI();
            if (window.slideshowEngine && window.slideshowEngine.active) {
                window.slideshowEngine.updateProgress();
            }
        }, 150);
    }

    requestDelete() {
        document.getElementById('deleteDialog').classList.add('active');
    }

    confirmDelete() {
        const photo = this.filteredPhotos[this.currentIndex];
        // For now, just remove from local state
        this.photos = this.photos.filter(p => p !== photo);
        this.updateFilteredPhotos();
        this.render();
        document.getElementById('deleteDialog').classList.remove('active');

        if (this.filteredPhotos.length > 0) {
            this.navigate(0); // Show next available
        } else {
            this.closeViewer();
        }
    }
}

const galleryManager = new GalleryManager();
window.galleryManager = galleryManager;
