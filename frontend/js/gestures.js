/**
 * P.I.X.I. Gesture Support
 * Native JavaScript Touch Navigation
 */

class GestureManager {
    constructor(elementId, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown) {
        this.element = document.getElementById(elementId);
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50;

        this.onSwipeLeft = onSwipeLeft;
        this.onSwipeRight = onSwipeRight;
        this.onSwipeUp = onSwipeUp;
        this.onSwipeDown = onSwipeDown;

        this.init();
    }

    init() {
        if (!this.element) return;

        this.element.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        this.element.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleGesture();
        }, { passive: true });
    }

    handleGesture() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal Swipe
            if (Math.abs(deltaX) > this.minSwipeDistance) {
                if (deltaX > 0) {
                    this.onSwipeRight && this.onSwipeRight();
                } else {
                    this.onSwipeLeft && this.onSwipeLeft();
                }
            }
        } else {
            // Vertical Swipe
            if (Math.abs(deltaY) > this.minSwipeDistance) {
                if (deltaY > 0) {
                    this.onSwipeDown && this.onSwipeDown();
                } else {
                    this.onSwipeUp && this.onSwipeUp();
                }
            }
        }
    }
}

// Global initialization for the viewer
window.addEventListener('DOMContentLoaded', () => {
    new GestureManager(
        'fullscreenViewer',
        () => window.galleryManager.next(),
        () => window.galleryManager.prev(),
        null,
        () => window.galleryManager.closeViewer()
    );
});
