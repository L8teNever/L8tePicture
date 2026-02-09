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

        this.init();
    }

    init() {
        document.getElementById('discoveryBtn').addEventListener('click', () => this.open());
        document.getElementById('closeDiscovery').addEventListener('click', () => this.close());
        document.getElementById('restartDiscovery').addEventListener('click', () => this.open());

        // Global mouse/touch release for better safety
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

        // Show loading if empty
        if (!window.galleryManager.photos || window.galleryManager.photos.length === 0) {
            this.cardContainer.innerHTML = '<div id="discoveryLoader" class="text-white opacity-50 font-bold flex flex-col items-center gap-4"><div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>Bilder werden geladen...</div>';
            await window.galleryManager.loadPhotos();
        }

        this.photos = [...window.galleryManager.photos];
        this.photos.sort(() => Math.random() - 0.5);

        this.render();
    }

    close() {
        this.overlay.classList.remove('active');
        // Refresh gallery to show updated scores/isFav
        window.galleryManager.loadPhotos();
    }

    render() {
        this.cardContainer.querySelectorAll('.discovery-card').forEach(c => c.remove());
        const loader = document.getElementById('discoveryLoader');
        if (loader) loader.remove();

        if (this.photos.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.emptyState.querySelector('h3').textContent = 'Keine Bilder gefunden';
            this.emptyState.querySelector('p').textContent = 'Versuche es später erneut oder scanne deine Ordner.';
            return;
        }

        if (this.currentIndex >= this.photos.length) {
            this.emptyState.classList.remove('hidden');
            this.emptyState.querySelector('h3').textContent = 'Keine weiteren Bilder';
            this.emptyState.querySelector('p').textContent = 'Du hast erst einmal alles gesehen. Komm später wieder!';
            return;
        }

        this.emptyState.classList.add('hidden');

        // Render 3 cards ahead for performance
        for (let i = Math.min(this.photos.length - 1, this.currentIndex + 2); i >= this.currentIndex; i--) {
            this.createCard(this.photos[i], i === this.currentIndex);
        }
    }

    createCard(photo, isTop) {
        const card = document.createElement('div');
        card.className = 'discovery-card';
        card.innerHTML = `
            <img src="${photo.full_preview}" alt="Photo">
            <div class="card-status like">LIKE</div>
            <div class="card-status dislike">NOPE</div>
            <div class="card-status delete">DELETE</div>
        `;

        if (isTop) {
            this.currentCard = card;
            card.addEventListener('mousedown', (e) => this.handleDragStart(e));
            card.addEventListener('touchstart', (e) => this.handleDragStart(e));
        } else {
            // Stack effect
            card.style.transform = `scale(0.95) translateY(20px)`;
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
    }

    handleDragMove(e) {
        if (!this.isDragging || !this.currentCard) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const moveX = clientX - this.startX;
        const moveY = clientY - this.startY;
        const rotate = moveX / 10;

        this.currentCard.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotate}deg)`;

        // Indicators
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

        const transform = this.currentCard.style.transform;
        const match = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
        if (!match) return;

        const moveX = parseFloat(match[1]);
        const moveY = parseFloat(match[2]);

        if (moveX > 100) {
            this.swipe('right');
        } else if (moveX < -100) {
            this.swipe('left');
        } else if (moveY < -150) {
            this.swipe('up');
        } else {
            // Reset
            this.currentCard.style.transition = 'transform 0.3s ease';
            this.currentCard.style.transform = '';
            this.currentCard.querySelectorAll('.card-status').forEach(s => s.style.opacity = 0);
        }
    }

    async swipe(direction) {
        const card = this.currentCard;
        const photo = this.photos[this.currentIndex];
        this.currentCard = null;
        this.currentIndex++;

        let rotate = 0;
        let x = 0;
        let y = 0;

        if (direction === 'right') {
            x = 1000; rotate = 30;
            this.vote(photo, 1);
        } else if (direction === 'left') {
            x = -1000; rotate = -30;
            this.vote(photo, -1);
        } else if (direction === 'up') {
            y = -1000;
            this.requestDelete(photo);
        }

        card.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
        card.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
        card.style.opacity = '0';

        setTimeout(() => {
            card.remove();
            this.render();
        }, 600);
    }

    async vote(photo, delta) {
        try {
            await fetch('/api/photos/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_path: photo.original_path, delta: delta })
            });

            // Auto-favorite on strong score if you want, but for now just score
            if (delta > 0 && !photo.isFav) {
                // If like, maybe auto-favorite or just keep score
                // user requested "liked images showed more often"
                // The slideshow logic needs to use scores
            }
        } catch (err) {
            console.error('Vote failed:', err);
        }
    }

    async requestDelete(photo) {
        // Find index in main gallery to use existing logic or just call API
        // For simplicity, let's just use window.galleryManager's logic if possible
        // but we need the index. Let's find it.
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

            const list = document.getElementById('topPhotosList');
            list.innerHTML = '';

            data.top_photos.forEach(photo => {
                const item = document.createElement('div');
                item.className = 'relative group w-24 h-24 rounded-2xl overflow-hidden shadow-md';
                item.innerHTML = `
                    <img src="${photo.grid_preview}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span class="text-white font-bold text-xs">⭐ ${photo.score}</span>
                    </div>
                `;
                list.appendChild(item);
            });
        } catch (err) {
            console.error('Stats failed:', err);
        }
    }
}

// Initialize
window.discoveryManager = new DiscoveryManager();
