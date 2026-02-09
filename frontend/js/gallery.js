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
        if (!this.grid) {
            setTimeout(() => this.init(), 100);
            return;
        }

        const savedCols = localStorage.getItem('pixi-cols');
        const isMobile = window.innerWidth < 768;
        const defaultCols = savedCols ? parseInt(savedCols) : (isMobile ? 2 : 5);

        this.setColumns(defaultCols);
        await this.loadPhotos();
        this.attachEventListeners();

        // Re-check router if we loaded photos after router initialization
        if (window.router) window.router.handleRoute();
    }

    async loadPhotos() {
        if (this.grid) this.grid.innerHTML = '<div class="empty-state"><p class="text-xl opacity-50">Lade Galerie...</p></div>';

        try {
            const response = await fetch('/api/photos');
            const data = await response.json();

            if (!Array.isArray(data)) {
                this.photos = [];
            } else {
                this.photos = data.map(p => ({ ...p, isFav: p.isFav || false }));
            }

            this.updateFilteredPhotos();
            this.render();
        } catch (error) {
            console.error('Error loading photos:', error);
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
                window.router.push(`#/photo/${index}`);
            }
        });

        document.getElementById('viewToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('viewPopover').classList.toggle('active');
        });

        document.querySelectorAll('.view-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.setColumns(parseInt(opt.dataset.cols));
                document.getElementById('viewPopover').classList.remove('active');
            });
        });

        document.getElementById('filterBtn').addEventListener('click', () => this.toggleFilter());
        document.getElementById('closeViewer').addEventListener('click', () => window.router.push('#/'));

        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsDialog').classList.add('active');
        });
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsDialog').classList.remove('active');
        });

        document.getElementById('viewerFavBtn').addEventListener('click', () => this.toggleFavorite(this.currentIndex));
        document.getElementById('viewerDeleteBtn').addEventListener('click', () => this.requestDelete());
    }

    async toggleFavorite(index) {
        const photo = this.filteredPhotos[index];
        if (photo) {
            photo.isFav = !photo.isFav;
            this.render();
            if (this.viewer.classList.contains('active')) this.updateViewerUI();

            try {
                const response = await fetch('/api/photos/favorite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ original_path: photo.original_path })
                });
                const result = await response.json();
                photo.isFav = result.is_fav;
                this.render();
            } catch (err) { console.error(err); }
        }
    }

    toggleFilter() {
        if (this.showOnlyFavorites) {
            window.router.push('#/');
        } else {
            window.router.push('#/favorites');
        }
    }

    setFilter(onlyFavorites) {
        if (this.showOnlyFavorites === onlyFavorites) return;

        this.showOnlyFavorites = onlyFavorites;
        document.getElementById('filterBtn').classList.toggle('bg-[var(--md-sys-color-secondary-container)]', this.showOnlyFavorites);
        document.getElementById('filterIcon').classList.toggle('active', this.showOnlyFavorites);
        this.updateFilteredPhotos();
        this.render();
    }

    setColumns(cols) {
        localStorage.setItem('pixi-cols', cols);
        this.grid.className = "max-w-7xl mx-auto pb-20 transition-all duration-300";
        if (cols === 1) this.grid.classList.add('columns-1');
        else if (cols === 2) this.grid.classList.add('columns-2');
        else if (cols === 3) this.grid.classList.add('columns-2', 'md:columns-3');
        else if (cols === 4) this.grid.classList.add('columns-2', 'sm:columns-3', 'lg:columns-4');
        else if (cols === 5) this.grid.classList.add('columns-3', 'sm:columns-4', 'lg:columns-5');

        document.getElementById('currentViewLabel').textContent = cols;
    }

    openViewer(index, updateHash = true) {
        if (updateHash) window.router.push(`#/photo/${index}`);
        this.currentIndex = index;
        const photo = this.filteredPhotos[index];
        if (!photo) return;

        // Reset zoom
        if (window.gestureManager) window.gestureManager.resetZoom();

        this.viewerImage.src = photo.full_preview;
        this.viewer.classList.add('active');
        this.updateViewerUI();
        this.updateViewerInfo();
    }

    closeViewer(updateHash = true) {
        if (updateHash) window.router.push('#/');
        this.viewer.classList.remove('active');
        if (window.gestureManager) window.gestureManager.resetZoom();
    }

    updateViewerUI() {
        const photo = this.filteredPhotos[this.currentIndex];
        if (!photo) return;
        const favIcon = document.getElementById('viewerFavIcon');
        favIcon.classList.toggle('active', photo.isFav);
        favIcon.setAttribute('fill', photo.isFav ? 'currentColor' : 'none');
    }

    updateViewerInfo() {
        const photo = this.filteredPhotos[this.currentIndex];
        if (photo) {
            document.getElementById('viewerInfoText').textContent = `${photo.original_path} • ${this.currentIndex + 1}/${this.filteredPhotos.length}`;
        }
    }

    toggleControls() {
        const controls = document.querySelector('.viewer-top-controls');
        const info = document.getElementById('viewerInfo');
        if (controls) {
            const isHidden = controls.style.opacity === '0';
            controls.style.opacity = isHidden ? '1' : '0';
            controls.style.pointerEvents = isHidden ? 'auto' : 'none';

            if (info) {
                info.style.opacity = isHidden ? '1' : '0';
            }
        }
    }

    navigate(direction) {
        const len = this.filteredPhotos.length;
        if (len === 0) return;

        // Reset zoom
        if (window.gestureManager) window.gestureManager.resetZoom();

        const nextIndex = (this.currentIndex + direction + len) % len;
        window.router.push(`#/photo/${nextIndex}`);
    }

    requestDelete() {
        document.getElementById('deleteDialog').classList.add('active');
    }
}

window.galleryManager = new GalleryManager();
