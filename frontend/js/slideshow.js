/**
 * P.I.X.I. Slideshow Engine
 * Ken Burns, Transitions and Background Music
 */

class SlideshowEngine {
    constructor() {
        this.overlay = document.getElementById('slideshowOverlay');
        this.container = document.getElementById('slideshowContainer');
        this.progressBar = document.getElementById('slideshowProgress');

        this.images = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.interval = 8000; // 8 seconds per slide
        this.timer = null;

        this.audio = new Audio();
        this.musicList = [];
        this.currentMusicIndex = 0;

        this.effects = ['ken-burns-zoom-in', 'ken-burns-zoom-out', 'ken-burns-pan-right', 'ken-burns-pan-left'];
        this.transitions = ['fade', 'slide', 'morph'];
        this.currentTransition = 'fade';

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadMusic();
    }

    async loadMusic() {
        try {
            const resp = await fetch('/api/music');
            this.musicList = await resp.json();
        } catch (e) {
            console.error('Music load failed:', e);
        }
    }

    start(images, startIndex = 0) {
        this.images = images;
        this.currentIndex = startIndex;
        this.isPlaying = true;
        this.overlay.classList.add('active');

        this.showNextSlide();
        if (this.musicList.length > 0) this.playMusic();
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timer);
        this.overlay.classList.remove('active');
        this.audio.pause();
        this.container.innerHTML = '';
    }

    showNextSlide() {
        if (!this.isPlaying) return;

        const imgData = this.images[this.currentIndex];
        const effect = this.effects[Math.floor(Math.random() * this.effects.length)];

        // Create new slide
        const slide = document.createElement('div');
        slide.className = `slideshow-slide transition-${this.currentTransition}-enter`;

        const img = document.createElement('img');
        img.src = imgData.full_preview;
        img.className = effect;

        slide.appendChild(img);
        this.container.appendChild(slide);

        // Animate in
        requestAnimationFrame(() => {
            slide.classList.add(`transition-${this.currentTransition}-enter-active`);
            // Dynamic themer during slideshow
            window.themeEngine.applyThemeFromImage(img);
        });

        // Remove old slides
        const slides = this.container.querySelectorAll('.slideshow-slide');
        if (slides.length > 1) {
            const oldSlide = slides[0];
            oldSlide.classList.add(`transition-${this.currentTransition}-exit-active`);
            setTimeout(() => oldSlide.remove(), 1000);
        }

        // Progress bar
        this.progressBar.style.transition = 'none';
        this.progressBar.style.width = '0%';
        setTimeout(() => {
            this.progressBar.style.transition = `width ${this.interval}ms linear`;
            this.progressBar.style.width = '100%';
        }, 50);

        // Prep next
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.timer = setTimeout(() => this.showNextSlide(), this.interval);
    }

    playMusic() {
        if (this.musicList.length === 0) return;
        this.audio.src = this.musicList[this.currentMusicIndex].path;
        this.audio.play();
        this.audio.onended = () => {
            this.currentMusicIndex = (this.currentMusicIndex + 1) % this.musicList.length;
            this.playMusic();
        };
    }

    setupEventListeners() {
        document.getElementById('slideshowBtn').onclick = () => {
            if (window.galleryManager.images.length > 0) {
                this.start(window.galleryManager.images);
            }
        };

        document.getElementById('slideshowClose').onclick = () => this.stop();

        document.getElementById('slideshowPlayPause').onclick = () => {
            this.isPlaying = !this.isPlaying;
            document.getElementById('slideshowPlayPause').innerHTML = this.isPlaying ?
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' :
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

            if (this.isPlaying) this.showNextSlide();
            else clearTimeout(this.timer);
        };

        document.getElementById('slideshowEffect').onclick = () => {
            const idx = (this.transitions.indexOf(this.currentTransition) + 1) % this.transitions.length;
            this.currentTransition = this.transitions[idx];
            console.log('Transition changed to:', this.currentTransition);
        };
    }
}

window.slideshowEngine = new SlideshowEngine();
