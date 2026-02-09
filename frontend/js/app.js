/**
 * P.I.X.I. Main Application & Router
 */

class Router {
    constructor() {
        this.currentHash = '';
        this.isNavigating = false;
        window.addEventListener('hashchange', () => this.handleRoute());
        // Handle route on load after a short delay to ensure managers are ready
        setTimeout(() => this.handleRoute(), 100);
    }

    handleRoute() {
        if (this.isNavigating) return;
        this.isNavigating = true;

        const hash = window.location.hash || '#/';
        this.currentHash = hash;

        console.log('🔗 Routing to:', hash);

        // Close all overlays/dialogs for a clean state
        const dialogs = document.querySelectorAll('.dialog-container, .overlay');
        dialogs.forEach(d => d.classList.remove('active'));

        // Reset specific manager states
        if (window.galleryManager) window.galleryManager.closeViewer(false);
        if (window.discoveryManager) window.discoveryManager.close(false);

        // Routing
        if (hash === '#/discovery') {
            if (window.discoveryManager) window.discoveryManager.open(false);
        } else if (hash === '#/stats') {
            if (window.discoveryManager) window.discoveryManager.openStats(false);
        } else if (hash === '#/favorites') {
            if (window.galleryManager) {
                window.galleryManager.closeViewer(false);
                window.galleryManager.setFilter(true);
            }
        } else if (hash.startsWith('#/photo/')) {
            const index = parseInt(hash.split('/').pop());
            if (window.galleryManager) {
                // If we jumped directly to a photo, check if we might be coming from favorites?
                // For now, simple logic: just open it.
                // NOTE: If we refresh on a photo URL, we won't know if we were in "Favorites" mode.
                // We could infer it from the photo itself if loaded, but for now strict URL mapping.
                window.galleryManager.openViewer(index, false);
            }
        } else {
            // Default: Gallery (All)
            // Only reset if we are explicitly at root or empty hash
            if (hash === '' || hash === '#/') {
                if (window.galleryManager) {
                    window.galleryManager.closeViewer(false);
                    window.galleryManager.setFilter(false);
                }
            }
        }

        this.isNavigating = false;
    }

    push(route) {
        if (window.location.hash === route) return;
        window.location.hash = route;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 P.I.X.I. Material You Design UI Initialized');

    window.router = new Router();

    // Rescan Button Logic
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.addEventListener('click', async () => {
            const originalText = rescanBtn.innerHTML;
            rescanBtn.disabled = true;
            rescanBtn.innerHTML = '<span class="inline-block animate-spin">⏳</span>';
            try {
                await fetch('/api/scan', { method: 'POST' });
                if (window.galleryManager) await window.galleryManager.loadPhotos();
            } catch (err) {
                console.error('Scan failed:', err);
            } finally {
                rescanBtn.disabled = false;
                rescanBtn.innerHTML = originalText;
            }
        });
    }

    // Global scroll handler for header effect
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });
});
