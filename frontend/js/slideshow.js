/**
 * P.I.X.I. Slideshow Engine
 */

class SlideshowEngine {
    constructor() {
        this.indicator = document.getElementById('slideshowIndicator');
        this.progressLabel = document.getElementById('slideshowProgressLabel');
        this.speedSlider = document.getElementById('slideshowSpeed');
        this.speedLabel = document.getElementById('speedLabel');
        this.shuffleToggle = document.getElementById('shuffleToggle');
        this.loopToggle = document.getElementById('loopToggle');

        this.active = false;
        this.interval = 3500;
        this.timer = null;

        this.init();
    }

    init() {
        document.getElementById('slideshowBtn').addEventListener('click', () => this.start());
        document.getElementById('stopSlideshowBtn').addEventListener('click', () => this.stop());
        document.getElementById('viewerSlideshowBtn').addEventListener('click', () => this.toggle());

        this.speedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.interval = val * 1000;
            this.speedLabel.textContent = val.toFixed(1) + 's';
            if (this.active) {
                this.resetTimer();
            }
        });
    }

    start() {
        this.active = true;
        this.indicator.classList.remove('hidden');
        this.indicator.style.display = 'flex';

        if (!window.galleryManager.viewer.classList.contains('active')) {
            window.galleryManager.openViewer(0);
        }

        this.updateViewerButtons();
        this.updateProgress();
        this.resetTimer();
    }

    stop() {
        this.active = false;
        this.indicator.classList.add('hidden');
        this.indicator.style.display = 'none';

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.updateViewerButtons();
    }

    toggle() {
        if (this.active) this.stop();
        else this.start();
    }

    resetTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.shuffleToggle.checked) {
                const len = window.galleryManager.filteredPhotos.length;
                const next = Math.floor(Math.random() * len);
                window.galleryManager.currentIndex = next;
                window.galleryManager.navigate(0);
            } else {
                window.galleryManager.navigate(1);
            }
        }, this.interval);
    }

    updateProgress() {
        const current = window.galleryManager.currentIndex + 1;
        const total = window.galleryManager.filteredPhotos.length;
        this.progressLabel.textContent = `Foto ${current} / ${total}`;
    }

    updateViewerButtons() {
        const playIcon = document.getElementById('viewerPlayIcon');
        const pauseIcon = document.getElementById('viewerPauseIcon');
        if (playIcon && pauseIcon) {
            playIcon.classList.toggle('hidden', this.active);
            pauseIcon.classList.toggle('hidden', !this.active);
        }
    }
}

const slideshowEngine = new SlideshowEngine();
window.slideshowEngine = slideshowEngine;
