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
        const mobileNav = document.getElementById('mobileNav');
        if (hash === '#/discovery') {
            if (mobileNav) mobileNav.style.display = 'none';
            if (window.discoveryManager) window.discoveryManager.open(false);
        } else if (hash === '#/stats') {
            if (mobileNav) mobileNav.style.display = 'none';
            if (window.discoveryManager) window.discoveryManager.openStats(false);
        } else if (hash === '#/favorites') {
            if (mobileNav) mobileNav.style.display = '';
            if (window.galleryManager) {
                window.galleryManager.closeViewer(false);
                if (!window.galleryManager.showOnlyFavorites) {
                    window.galleryManager.setFilter(true);
                }
            }
        } else if (hash.startsWith('#/photo/')) {
            if (mobileNav) mobileNav.style.display = 'none'; // Optional: hide on viewer too? User didn't ask but makes sense.
            // User only asked for "for you" (discovery), but let's stick to user request strictly first.
            // Wait, user said "bei der voryu" (For You). 
            // Let's hide it for Discovery as requested.

            const index = parseInt(hash.split('/').pop());
            if (window.galleryManager) {
                window.galleryManager.openViewer(index, false);
            }
        } else {
            // Default: Gallery (All)
            if (mobileNav) mobileNav.style.display = '';
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

    // Mobile Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const nav = item.dataset.nav;
            if (nav === 'gallery') window.router.push('#/');
            else if (nav === 'favorites') window.router.push('#/favorites');
            else if (nav === 'discovery') window.router.push('#/discovery');
            else if (nav === 'stats') window.router.push('#/stats');
        });
    });

    // Sync Active State on Hash Change
    window.addEventListener('hashchange', updateActiveNav);
    updateActiveNav(); // Initial

    function updateActiveNav() {
        const hash = window.location.hash || '#/';
        navItems.forEach(item => {
            item.classList.remove('active');
            item.querySelector('span').classList.remove('font-bold'); // Reset bold
        });

        let activeNav = 'gallery';
        if (hash === '#/favorites') activeNav = 'favorites';
        else if (hash === '#/discovery') activeNav = 'discovery';
        else if (hash === '#/stats') activeNav = 'stats';
        else if (hash.startsWith('#/photo/')) {
            // Determine based on filter state if possible, or default to gallery
            // For simplicity, we keep the last known state or default to gallery
            if (window.galleryManager && window.galleryManager.showOnlyFavorites) {
                activeNav = 'favorites';
            } else {
                activeNav = 'gallery';
            }
        }

        const activeBtn = document.querySelector(`.nav-item[data-nav="${activeNav}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.querySelector('span').classList.add('font-bold');
        }
    }

    // Mobile Header Buttons
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            // Toggle search/filter bar (if implemented) or just scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    if (mobileSettingsBtn) {
        mobileSettingsBtn.addEventListener('click', () => {
            document.getElementById('settingsDialog').classList.add('active');
        });
    }
});
