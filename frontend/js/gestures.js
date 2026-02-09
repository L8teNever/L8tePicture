/**
 * P.I.X.I. Gesture Support
 */

class GestureManager {
    constructor() {
        this.el = document.getElementById('swipeArea');
        this.img = document.getElementById('viewerImage');

        // State
        this.scale = 1;
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.startX = 0;
        this.startY = 0;

        // Touch state
        this.lastTouchEnd = 0;
        this.initialPinchDistance = 0;
        this.initialScale = 1;

        this.init();
    }

    init() {
        if (!this.el || !this.img) return;

        // Double tap to zoom & Single tap to toggle controls
        this.el.addEventListener('click', (e) => {
            // Ignore clicks on buttons/controls (if they bubble up, though usually they stop propagation)
            if (e.target.closest('button')) return;

            const now = Date.now();
            if (now - this.lastTouchEnd < 300) {
                clearTimeout(this.tapTimeout);
                this.handleDoubleTap(e);
            } else {
                this.tapTimeout = setTimeout(() => {
                    this.handleSingleTap(e);
                }, 300);
            }
            this.lastTouchEnd = now;
        });

        // Touch handling
        this.el.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.el.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.el.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!window.galleryManager.viewer.classList.contains('active')) return;

            if (e.key === 'ArrowRight') window.galleryManager.navigate(1);
            if (e.key === 'ArrowLeft') window.galleryManager.navigate(-1);
            if (e.key === 'Escape') window.galleryManager.closeViewer();
            if (e.key === ' ') {
                e.preventDefault();
                window.slideshowEngine.toggle();
            }
        });
    }

    handleSingleTap(e) {
        if (window.galleryManager && window.galleryManager.toggleControls) {
            window.galleryManager.toggleControls();
        }
    }

    handleDoubleTap(e) {
        e.preventDefault();
        if (this.scale > 1) {
            this.resetZoom();
        } else {
            this.zoomTo(2.5, e.clientX, e.clientY);
        }
    }

    zoomTo(scale, cx, cy) {
        this.scale = scale;
        this.img.style.transform = `scale(${this.scale})`;
        this.img.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';

        // Basic centering for now (can be improved to zoom towards point)
        if (scale === 1) {
            this.img.style.removeProperty('transform-origin');
            this.pointX = 0;
            this.pointY = 0;
            this.updateTransform();
        } else {
            // Calculate relative position? For now simple zoom center
            // this.img.style.transformOrigin = `${cx}px ${cy}px`;
        }
    }

    resetZoom() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.img.style.transform = `translate(0px, 0px) scale(1)`;
        this.img.style.transition = 'transform 0.3s ease';
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            this.panning = false;
            this.initialPinchDistance = this.getDistance(e.touches);
            this.initialScale = this.scale;
        } else if (e.touches.length === 1) {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;

            if (this.scale > 1) {
                this.panning = true;
                this.img.style.transition = 'none';
            } else {
                this.panning = false;
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault(); // Prevent browser scrolling

        if (e.touches.length === 2) {
            // Pinch to zoom
            const currentDistance = this.getDistance(e.touches);
            if (this.initialPinchDistance > 0) {
                const diff = currentDistance / this.initialPinchDistance;
                let newScale = this.initialScale * diff;
                newScale = Math.min(Math.max(1, newScale), 4); // Clamp scale

                this.scale = newScale;
                this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
            }
        } else if (e.touches.length === 1) {
            const clientX = e.touches[0].clientX;
            const clientY = e.touches[0].clientY;
            const diffX = clientX - this.startX;
            const diffY = clientY - this.startY;

            if (this.scale > 1 && this.panning) {
                // Pan logic
                this.pointX += diffX;
                this.pointY += diffY;
                this.startX = clientX;
                this.startY = clientY;
                this.updateTransform();
            }
        }
    }

    handleTouchEnd(e) {
        if (this.scale > 1) {
            // Bounce back logic could go here
            this.img.style.transition = 'transform 0.3s ease';

            // Check bounds (simplified)
            // If panned too far away, bring back?
        } else {
            // Swipe detection only if not zoomed
            const diffX = e.changedTouches[0].clientX - this.startX;
            const diffY = e.changedTouches[0].clientY - this.startY;

            if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) window.galleryManager.navigate(-1); // Right -> Prev
                else window.galleryManager.navigate(1);  // Left -> Next
            } else if (diffY < -100) { // Swipe Up -> Info?
                // Optional
            } else if (diffY > 100 && Math.abs(diffY) > Math.abs(diffX)) { // Swipe Down -> Close
                window.galleryManager.closeViewer();
            }
        }
    }

    getDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }

    updateTransform() {
        this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gestureManager = new GestureManager();
});
