/**
 * P.I.X.I. Discovery Mode (Tinder-style)
 */

class DiscoveryManager {
    constructor() {
        this.overlay = document.getElementById('discoveryOverlay');
        this.cardContainer = document.getElementById('cardContainer');
        this.emptyState = document.getElementById('discoveryEmptyState');

        this.photos = [];
        this.currentIndex = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.currentCard = null;
        this.preloadedImages = new Set();

        this.init();
    }

    init() {
        document.getElementById('discoveryBtn').addEventListener('click', () => this.open());
        document.getElementById('closeDiscovery').addEventListener('click', () => this.close());
        document.getElementById('restartDiscovery').addEventListener('click', () => this.open());

        // Global mouse/touch release
        window.addEventListener('mouseup', () => this.handleDragEnd());
        window.addEventListener('touchend', () => this.handleDragEnd());
        window.addEventListener('mousemove', (e) => this.handleDragMove(e));
        window.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });

        // Stats
        document.getElementById('statsBtn').addEventListener('click', () => this.openStats());
        document.getElementById('closeStatsBtn').addEventListener('click', () => {
            document.getElementById('statsDialog').classList.remove('active');
        });
    }

    async open() {
        this.overlay.classList.add('active');
        this.emptyState.classList.add('hidden');
        this.currentIndex = 0;
        this.preloadedImages.clear();

        if (!window.galleryManager.photos || window.galleryManager.photos.length === 0) {
            this.cardContainer.innerHTML = '<div id="discoveryLoader" class="text-white opacity-50 font-bold flex flex-col items-center gap-4"><div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>Bilder werden geladen...</div>';
            await window.galleryManager.loadPhotos();
        }

        this.photos = [...window.galleryManager.photos];
        this.photos.sort(() => Math.random() - 0.5);

        // Start preloading immediately
        this.preloadImages(0);
        this.render();
    }

    preloadImages(startAt) {
        // Preload next 10 images
        for (let i = startAt; i < Math.min(this.photos.length, startAt + 10); i++) {
            const url = this.photos[i].full_preview;
            if (!this.preloadedImages.has(url)) {
                const img = new Image();
                img.src = url;
                this.preloadedImages.add(url);
            }
        }
    }

    close() {
        this.overlay.classList.remove('active');
        window.galleryManager.loadPhotos();
    }

    render() {
        // Clear previous cards
        this.cardContainer.querySelectorAll('.discovery-card').forEach(c => c.remove());

        const loader = document.getElementById('discoveryLoader');
        if (loader) loader.remove();

        if (this.photos.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.emptyState.querySelector('h3').textContent = 'Keine Bilder gefunden';
            return;
        }

        if (this.currentIndex >= this.photos.length) {
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');

        // Render 3 cards ahead
        for (let i = Math.min(this.photos.length - 1, this.currentIndex + 2); i >= this.currentIndex; i--) {
            this.createCard(this.photos[i], i === this.currentIndex);
        }

        // Preload ahead
        this.preloadImages(this.currentIndex + 3);
    }

    createCard(photo, isTop) {
        const card = document.createElement('div');
        card.className = 'discovery-card';
        card.innerHTML = `
            <img src="${photo.full_preview}" alt="Photo" loading="eager">
            <div class="card-status like">LIKE</div>
            <div class="card-status dislike">NOPE</div>
            <div class="card-status delete">DELETE</div>
        `;

        if (isTop) {
            this.currentCard = card;
            card.addEventListener('mousedown', (e) => this.handleDragStart(e));
            card.addEventListener('touchstart', (e) => this.handleDragStart(e));
            card.style.zIndex = 10;
        } else {
            // Stack effect
            const offset = (this.cardContainer.querySelectorAll('.discovery-card').length + 1) * 10;
            card.style.transform = `scale(0.95) translateY(${offset}px)`;
            card.style.opacity = '0.5';
            card.style.zIndex = -1;
        }

        this.cardContainer.appendChild(card);
    }

    handleDragStart(e) {
        if (!this.currentCard) return;
        this.isDragging = true;
        this.startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        this.startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        this.currentCard.style.transition = 'none';
        this.currentCard.style.cursor = 'grabbing';
    }

    handleDragMove(e) {
        if (!this.isDragging || !this.currentCard) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const moveX = clientX - this.startX;
        const moveY = clientY - this.startY;
        const rotate = moveX / 10;

        this.currentCard.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotate}deg)`;

        const like = this.currentCard.querySelector('.card-status.like');
        const dislike = this.currentCard.querySelector('.card-status.dislike');
        const del = this.currentCard.querySelector('.card-status.delete');

        like.style.opacity = Math.max(0, moveX / 100);
        dislike.style.opacity = Math.max(0, -moveX / 100);
        del.style.opacity = Math.max(0, -moveY / 150);

        if (e.type === 'touchmove') e.preventDefault();
    }

    async handleDragEnd() {
        if (!this.isDragging || !this.currentCard) return;
        this.isDragging = false;
        this.currentCard.style.cursor = 'grab';

        const transform = this.currentCard.style.transform;
        const match = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
        if (!match) return;

        const moveX = parseFloat(match[1]);
        const moveY = parseFloat(match[2]);

        if (moveX > 100) this.swipe('right');
        else if (moveX < -100) this.swipe('left');
        else if (moveY < -150) this.swipe('up');
        else {
            this.currentCard.style.transition = 'transform 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
            this.currentCard.style.transform = '';
            this.currentCard.querySelectorAll('.card-status').forEach(s => s.style.opacity = 0);
        }
    }

    async swipe(direction) {
        const card = this.currentCard;
        const photo = this.photos[this.currentIndex];
        this.currentCard = null;
        this.currentIndex++;

        let rotate = direction === 'right' ? 45 : (direction === 'left' ? -45 : 0);
        let x = direction === 'right' ? 1200 : (direction === 'left' ? -1200 : 0);
        let y = direction === 'up' ? -1200 : 200;

        if (direction === 'right') this.vote(photo, 1);
        if (direction === 'left') this.vote(photo, -1);
        if (direction === 'up') this.requestDelete(photo);

        card.style.transition = 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease';
        card.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';

        setTimeout(() => {
            card.remove();
            this.render();
        }, 500);
    }

    async vote(photo, delta) {
        try {
            await fetch('/api/photos/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_path: photo.original_path, delta: delta })
            });
        } catch (err) { console.error('Vote failed:', err); }
    }

    async requestDelete(photo) {
        const mainIndex = window.galleryManager.photos.findIndex(p => p.original_path === photo.original_path);
        if (mainIndex !== -1) {
            window.galleryManager.currentIndex = mainIndex;
            window.galleryManager.requestDelete();
        }
    }

    async openStats() {
        const dialog = document.getElementById('statsDialog');
        dialog.classList.add('active');

        try {
            const res = await fetch('/api/stats');
            const data = await res.json();

            document.getElementById('statTotalImages').textContent = data.total_images;
            document.getElementById('statTotalSize').textContent = data.total_size_mb;

            // Hall of Fame Highlight
            const topOne = document.getElementById('topRankOne');
            if (data.top_photos && data.top_photos.length > 0) {
                const first = data.top_photos[0];
                topOne.classList.remove('hidden');
                topOne.querySelector('img').src = first.full_preview;
                document.getElementById('rankOneScore').textContent = `Score: ${first.score}`;
            } else {
                topOne.classList.add('hidden');
            }

            // Leaderboard List
            const list = document.getElementById('topPhotosList');
            list.innerHTML = '';

            const remaining = data.top_photos.slice(1, 9);
            remaining.forEach((photo, idx) => {
                const item = document.createElement('div');
                item.className = 'relative group aspect-square rounded-[24px] overflow-hidden shadow-lg bg-black/5';
                item.innerHTML = `
                    <img src="${photo.grid_preview}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <span class="text-white font-black text-xl">#${idx + 2}</span>
                        <span class="text-white/70 font-bold text-[10px] uppercase tracking-tighter">Score: ${photo.score}</span>
                    </div>
                `;
                list.appendChild(item);
            });
        } catch (err) { console.error('Stats failed:', err); }
    }
}

window.discoveryManager = new DiscoveryManager();
