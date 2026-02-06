/**
 * P.I.X.I. Gesture Support
 */

class GestureManager {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;

        this.init();
    }

    init() {
        const swipeArea = document.getElementById('swipeArea');
        if (!swipeArea) return;

        swipeArea.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        swipeArea.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe();
        }, { passive: true });

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

    handleSwipe() {
        const diffX = this.touchStartX - this.touchEndX;
        const diffY = this.touchStartY - this.touchEndY;

        // Horizontal swipe
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe left -> Next
                    window.galleryManager.navigate(1);
                } else {
                    // Swipe right -> Prev
                    window.galleryManager.navigate(-1);
                }
            }
        } else {
            // Vertical swipe
            if (Math.abs(diffY) > 100) {
                if (diffY < 0) {
                    // Swipe down -> Close
                    window.galleryManager.closeViewer();
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gestureManager = new GestureManager();
});
