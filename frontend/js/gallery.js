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
        this.showInfo = false;

        this.init();
    }

    async init() {
        const savedCols = localStorage.getItem('pixi-cols');
        const isMobile = window.innerWidth < 768;
        // Default to 5 on PC, 2 on Mobile if nothing saved
        const defaultCols = savedCols ? parseInt(savedCols) : (isMobile ? 2 : 5);

        this.setColumns(defaultCols);
        await this.loadPhotos();
        this.attachEventListeners();
    }

    async loadPhotos() {
        try {
            const response = await fetch('/api/photos');
            this.photos = await response.json();

            // Ensure isFav property exists
            this.photos = this.photos.map(p => ({ ...p, isFav: p.isFav || false }));

            // Preserve current image if viewer is open
            let currentPath = null;
            if (this.viewer.classList.contains('active') && this.filteredPhotos[this.currentIndex]) {
                currentPath = this.filteredPhotos[this.currentIndex].original_path;
            }

            this.updateFilteredPhotos();
            this.render();

            if (this.viewer.classList.contains('active')) {
                // Find new index of the same image
                if (currentPath) {
                    const newIndex = this.filteredPhotos.findIndex(p => p.original_path === currentPath);
                    if (newIndex !== -1) {
                        this.currentIndex = newIndex;
                    }
                }
                this.updateViewerUI();
                this.updateViewerInfo();
            }
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

        // Viewer Menu Toggle
        const menuToggle = document.getElementById('viewerMenuToggle');
        const actionsMenu = document.getElementById('viewerActionsMenu');

        if (menuToggle && actionsMenu) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                actionsMenu.classList.toggle('open');
            });
        }

        // Close menu on click outside in viewer
        this.viewer.addEventListener('click', (e) => {
            if (!e.target.closest('.viewer-actions-menu') && actionsMenu) {
                actionsMenu.classList.remove('open');
            }
        });

        // Viewer Actions
        const infoBtn = document.getElementById('viewerInfoBtn');
        if (infoBtn) {
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showInfo = !this.showInfo;
                infoBtn.classList.toggle('bg-white/30', this.showInfo);
                infoBtn.classList.toggle('bg-white/10', !this.showInfo);
                this.updateViewerInfo();
            });
        }

        document.getElementById('viewerFavBtn').addEventListener('click', () => this.toggleFavorite(this.currentIndex));
        document.getElementById('viewerDeleteBtn').addEventListener('click', () => this.requestDelete());

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            document.getElementById('deleteDialog').classList.remove('active');
        });
    }

    async toggleFavorite(index) {
        const photo = this.filteredPhotos[index];
        if (photo) {
            // Optimistic UI update
            photo.isFav = !photo.isFav;
            this.render();
            if (this.viewer.classList.contains('active')) {
                this.updateViewerUI();
            }

            try {
                const response = await fetch('/api/photos/favorite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ original_path: photo.original_path })
                });
                const result = await response.json();
                // Ensure synced with server
                photo.isFav = result.is_fav;
                this.render();
                if (this.viewer.classList.contains('active')) {
                    this.updateViewerUI();
                }
            } catch (error) {
                console.error('Error toggling favorite:', error);
                // Rollback on error
                photo.isFav = !photo.isFav;
                this.render();
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
        localStorage.setItem('pixi-cols', cols);
        const grid = this.grid;
        // Reset classes
        grid.className = "max-w-7xl mx-auto pb-20 transition-all duration-300";

        // Logic for "Smart" Responsive Columns
        if (cols === 1) {
            grid.classList.add('columns-1');
        } else if (cols === 2) {
            grid.classList.add('columns-2'); // 2 on Mobile, 2 on PC
        } else if (cols === 3) {
            grid.classList.add('columns-2', 'md:columns-3'); // 2 on Mobile, 3 on PC
        } else if (cols === 4) {
            grid.classList.add('columns-2', 'sm:columns-3', 'lg:columns-4'); // 2 on Mobile, 3 Tablet, 4 PC
        } else if (cols === 5) {
            grid.classList.add('columns-3', 'sm:columns-4', 'lg:columns-5'); // 3 on Mobile, 4 Tablet, 5 PC
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

        // Reset menu state
        const actionsMenu = document.getElementById('viewerActionsMenu');
        if (actionsMenu) actionsMenu.classList.remove('open');

        this.viewerImage.src = photo.full_preview;
        this.viewer.classList.add('active');
        this.updateViewerUI();
        this.updateViewerInfo();
        this.initAutoHideControls();

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
        this.cleanupAutoHideControls();
    }

    updateViewerUI() {
        const photo = this.filteredPhotos[this.currentIndex];
        if (!photo) return;

        const favIcon = document.getElementById('viewerFavIcon');
        favIcon.classList.toggle('active', photo.isFav);
        favIcon.setAttribute('fill', photo.isFav ? 'currentColor' : 'none');
    }

    updateViewerInfo() {
        const current = this.currentIndex + 1;
        const total = this.filteredPhotos.length;
        const photo = this.filteredPhotos[this.currentIndex];

        const infoContainer = document.getElementById('viewerInfo');
        const infoText = document.getElementById('viewerInfoText');

        if (infoText && photo) {
            infoText.textContent = `${photo.original_path} • Bild ${current} von ${total}`;
        }

        if (infoContainer) {
            infoContainer.classList.toggle('active', this.showInfo);
        }
    }

    initAutoHideControls() {
        const controls = document.querySelectorAll('.viewer-controls-overlay');
        let hideTimeout;

        const showControls = () => {
            controls.forEach(c => c.classList.remove('hidden'));
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                controls.forEach(c => c.classList.add('hidden'));
            }, 3000);
        };

        const hideControls = () => {
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                controls.forEach(c => c.classList.add('hidden'));
            }, 3000);
        };

        // Show controls initially
        showControls();

        // Store handlers for cleanup
        this.viewerMouseMoveHandler = showControls;
        this.viewerTouchHandler = showControls;

        this.viewer.addEventListener('mousemove', this.viewerMouseMoveHandler);
        this.viewer.addEventListener('touchstart', this.viewerTouchHandler);
    }

    cleanupAutoHideControls() {
        if (this.viewerMouseMoveHandler) {
            this.viewer.removeEventListener('mousemove', this.viewerMouseMoveHandler);
        }
        if (this.viewerTouchHandler) {
            this.viewer.removeEventListener('touchstart', this.viewerTouchHandler);
        }
    }

    navigate(direction) {
        const len = this.filteredPhotos.length;
        if (len === 0) return;

        // Reset menu state
        const actionsMenu = document.getElementById('viewerActionsMenu');
        if (actionsMenu) actionsMenu.classList.remove('open');

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
            this.updateViewerInfo();
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
