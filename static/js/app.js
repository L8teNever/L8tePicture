/**
 * AURA - Core Application Logic
 */

let images = [];
let currentIndex = 0;
let offset = 50;
const limit = 50;
let isLoading = false;
let hasMore = true;
let search = "";
let favoritesOnly = new URLSearchParams(window.location.search).get('favorites') === "true";

// --- Slideshow Config ---
let ssInterval = null;
let ssIsPlaying = false;
let ssConfig = {
    interval: 3000,
    effect: 'fade'
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
    initInfiniteScroll();

    // Handle initial URL state
    handleUrlState();

    // Init Grid Controls
    initGridControls();

    // Global listeners
    window.addEventListener('popstate', handleUrlState);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeViewer();
        if (e.key === 'ArrowRight') nextMedia();
        if (e.key === 'ArrowLeft') prevMedia();
    });
});

function handleUrlState() {
    const urlParams = new URLSearchParams(window.location.search);
    const fav = urlParams.get('favorites') === 'true';
    const mediaId = urlParams.get('view');
    const searchTerm = urlParams.get('search') || "";

    let needsFetch = false;


    // Sync favorites
    if (fav !== favoritesOnly) {
        favoritesOnly = fav;
        updateFavoritesBtnUi();
        needsFetch = true;
    }

    if (needsFetch) {
        fetchImages(true).then(() => {
            handleViewerUrl(mediaId);
        });
    } else {
        handleViewerUrl(mediaId);
    }
}

function handleViewerUrl(mediaId) {
    if (mediaId) {
        const openIt = () => {
            const img = images.find(i => i.id == mediaId);
            if (img) openViewer(mediaId, img.filename, img.media_type, false);
        };

        if (images.length > 0) {
            openIt();
        } else {
            fetchImages().then(openIt);
        }
    } else {
        closeViewer(false);
    }
}

function initGallery() {
    const cards = document.querySelectorAll('.image-card');
    images = Array.from(cards).map(card => ({
        id: card.dataset.id,
        filename: card.querySelector('img').src.split('/').pop().replace('.webp', ''),
        media_type: card.querySelector('.video-indicator') ? 'video' : 'image',
        is_favorite: card.querySelector('.btn-fav').classList.contains('active')
    }));
}

// --- API Interactions ---

async function fetchImages(reset = false) {
    if (isLoading || (!hasMore && !reset)) return;
    isLoading = true;

    if (reset) {
        offset = 0;
        hasMore = true;
        images = [];
        const gallery = document.getElementById('gallery');
        if (gallery) gallery.innerHTML = '';
    }

    try {
        const response = await fetch(`/api/images?offset=${offset}&limit=${limit}&favorites=${favoritesOnly}`);
        const data = await response.json();

        if (data.length < limit) hasMore = false;

        data.forEach(img => {
            if (!images.find(i => i.id == img.id)) {
                appendImageToGallery(img);
                images.push(img);
            }
        });

        offset += data.length;
    } catch (err) {
        console.error("Fetch error:", err);
    } finally {
        isLoading = false;
    }
}

function appendImageToGallery(img) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    const card = document.createElement('div');
    card.className = "image-card glass active";
    card.dataset.id = img.id;
    card.onclick = () => openViewer(img.id, img.filename, img.media_type);

    const favActive = img.is_favorite ? 'active' : '';
    const dateStr = img.upload_date ? new Date(img.upload_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'ZEITLOS';

    card.innerHTML = `
        <button class="btn-fav ${favActive}" onclick="event.stopPropagation(); toggleFavorite('${img.id}', this)">
            <span class="material-symbols-outlined fill-1">favorite</span>
        </button>
        <img src="/thumbnails/${img.filename}.webp" alt="Memory" class="card-img" loading="lazy">
        <div class="card-overlay">
            <div class="card-meta">
                <div class="card-title">PRIVATE MOMENT</div>
                <div class="card-date">${dateStr}</div>
            </div>
        </div>
        ${img.media_type === 'video' ? '<div class="video-indicator"><span class="material-symbols-outlined">play_circle</span></div>' : ''}
    `;

    gallery.appendChild(card);
}

// --- Filtering ---

function toggleFavorites() {
    favoritesOnly = !favoritesOnly;
    updateFavoritesBtnUi();

    const url = new URL(window.location);
    if (favoritesOnly) url.searchParams.set('favorites', 'true');
    else url.searchParams.delete('favorites');
    window.history.pushState({}, '', url);

    fetchImages(true);
}

function updateFavoritesBtnUi() {
    const btn = document.querySelector('.header-actions .btn-action');
    if (!btn) return;
    const icon = btn.querySelector('.material-symbols-outlined');

    if (favoritesOnly) {
        icon.classList.add('fill-1');
        btn.innerHTML = `<span class="material-symbols-outlined fill-1">favorite</span> ALLE`;
    } else {
        icon.classList.remove('fill-1');
        btn.innerHTML = `<span class="material-symbols-outlined">favorite</span> FAVORITEN`;
    }
}

// --- Upload Logic ---

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const pill = document.getElementById('upload-status-pill');
    const statusText = document.getElementById('upload-status-text');
    const statusCount = document.getElementById('upload-status-count');

    if (pill) pill.classList.add('active');
    if (statusText) statusText.innerText = 'BEREITE VOR...';
    if (statusCount) statusCount.innerText = `0/${files.length}`;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                if (statusText) statusText.innerText = `HOCHLADEN ${percent}%`;
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                const result = JSON.parse(xhr.responseText);
                if (result.count > 0) {
                    showToast(`${result.count} Momente erfolgreich hinzugefügt!`, 'success');
                    fetchImages(true);
                }
            } else {
                showToast("Upload fehlgeschlagen", "error");
            }
            if (pill) pill.classList.remove('active');
        };

        xhr.onerror = function () {
            showToast("Netzwerkfehler beim Upload", "error");
            if (pill) pill.classList.remove('active');
        };

        xhr.send(formData);

    } catch (err) {
        showToast("Fehler beim Verarbeiten", "error");
        if (pill) pill.classList.remove('active');
    }
}

// --- Favorite & Delete ---

async function toggleFavorite(id, btn) {
    try {
        const response = await fetch(`/favorite/${id}`, { method: 'POST' });
        const data = await response.json();

        if (data.is_favorite) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        const imgIdx = images.findIndex(i => i.id == id);
        if (imgIdx !== -1) images[imgIdx].is_favorite = data.is_favorite;

    } catch (err) {
        console.error("Favorite toggle failed:", err);
    }
}

// --- Viewer / Modal ---

function openViewer(id, filename, type, updateHistory = true) {
    const modal = document.getElementById('viewer-modal');
    if (!modal) return;

    currentIndex = images.findIndex(i => i.id == id);
    if (currentIndex === -1) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Swipe Support
    initViewerSwipe();

    if (updateHistory) {
        const url = new URL(window.location);
        url.searchParams.set('view', id);
        window.history.pushState({ view: id }, '', url);
    }

    updateViewerContent();
}

function updateViewerContent() {
    const imgData = images[currentIndex];
    const modalImg = document.getElementById('viewer-img');
    const modalVid = document.getElementById('viewer-video');
    const favBtn = document.getElementById('viewer-fav-btn');

    if (imgData.media_type === 'video') {
        modalImg.style.display = 'none';
        modalVid.style.display = 'block';
        modalVid.src = `/uploads/${imgData.filename}`;
        modalVid.play().catch(() => { });
    } else {
        modalVid.style.display = 'none';
        modalVid.pause();
        modalImg.style.display = 'block';
        modalImg.src = `/previews/${imgData.filename}.webp`;
        modalImg.onerror = () => {
            modalImg.src = `/uploads/${imgData.filename}`;
            modalImg.onerror = null;
        };
    }

    if (imgData.is_favorite) {
        favBtn.classList.add('active');
        favBtn.querySelector('span').classList.add('fill-1');
    } else {
        favBtn.classList.remove('active');
        favBtn.querySelector('span').classList.remove('fill-1');
    }

    // Preload neighbors for instant switching
    preloadNeighbors();
}

function preloadNeighbors() {
    const nextIdx = currentIndex + 1;
    const prevIdx = currentIndex - 1;

    if (nextIdx < images.length) preloadMedia(images[nextIdx]);
    if (prevIdx >= 0) preloadMedia(images[prevIdx]);
}

function preloadMedia(data) {
    if (!data) return;

    if (data.media_type === 'image') {
        const img = new Image();
        img.src = `/previews/${data.filename}.webp`;
    } else if (data.media_type === 'video') {
        const vid = document.createElement('video');
        vid.preload = 'auto';
        vid.src = `/uploads/${data.filename}`;
    }
}

function closeViewer(updateHistory = true) {
    const modal = document.getElementById('viewer-modal');
    if (!modal) return;

    stopSlideshow();

    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    const video = document.getElementById('viewer-video');
    if (video) video.pause();

    if (updateHistory) {
        const url = new URL(window.location);
        url.searchParams.delete('view');
        window.history.pushState({}, '', url);
    }
}

// --- Swipe Logic for Viewer ---
let touchStartX = 0;
let touchEndX = 0;

function initViewerSwipe() {
    const modal = document.getElementById('viewer-modal');
    if (!modal) return;

    modal.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchEndX - touchStartX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff < 0) {
            // Swiped left -> Next
            nextMedia();
        } else {
            // Swiped right -> Previous
            prevMedia();
        }
    }
}

function nextMedia() {
    if (currentIndex < images.length - 1) {
        currentIndex++;
        const id = images[currentIndex].id;
        const url = new URL(window.location);
        url.searchParams.set('view', id);
        window.history.replaceState({ view: id }, '', url);
        updateViewerContent();
    } else if (hasMore) {
        fetchImages().then(() => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                const id = images[currentIndex].id;
                const url = new URL(window.location);
                url.searchParams.set('view', id);
                window.history.replaceState({ view: id }, '', url);
                updateViewerContent();
            }
        });
    }
}

function prevMedia() {
    if (currentIndex > 0) {
        currentIndex--;
        const id = images[currentIndex].id;
        const url = new URL(window.location);
        url.searchParams.set('view', id);
        window.history.replaceState({ view: id }, '', url);
        updateViewerContent();
    }
}

function toggleViewerFavorite() {
    const imgData = images[currentIndex];
    const favBtn = document.getElementById('viewer-fav-btn');
    toggleFavorite(imgData.id, favBtn).then(() => {
        const card = document.querySelector(`.image-card[data-id="${imgData.id}"] .btn-fav`);
        if (card) {
            if (imgData.is_favorite) card.classList.add('active');
            else card.classList.remove('active');
        }
    });
}

async function deleteCurrent() {
    if (!confirm("Moment wirklich löschen?")) return;

    const imgData = images[currentIndex];
    try {
        await fetch(`/delete/${imgData.id}`, { method: 'DELETE' });
        showToast("Moment gelöscht", "info");

        images.splice(currentIndex, 1);
        const card = document.querySelector(`.image-card[data-id="${imgData.id}"]`);
        if (card) card.remove();

        if (images.length === 0) {
            closeViewer();
            const gallery = document.getElementById('gallery');
            if (gallery) {
                gallery.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-outlined">photo_library</span>
                        <p>DEINE GALERIE IST NOCH LEER</p>
                        <button class="btn-action" onclick="document.getElementById('file-input').click()">ERSTEN MOMENT HOCHLADEN</button>
                    </div>
                `;
            }
        } else {
            if (currentIndex >= images.length) currentIndex = images.length - 1;
            const nextId = images[currentIndex].id;
            const url = new URL(window.location);
            url.searchParams.set('view', nextId);
            window.history.replaceState({ view: nextId }, '', url);
            updateViewerContent();
        }
    } catch (err) {
        showToast("Löschen fehlgeschlagen", "error");
    }
}

function downloadCurrent() {
    const imgData = images[currentIndex];
    const link = document.createElement('a');
    link.href = `/uploads/${imgData.filename}`;
    link.download = imgData.filename;
    link.click();
}

// --- Utilities ---

function initInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            fetchImages();
        }
    });
}

// --- Slideshow Logic ---

function toggleSlideshow() {
    ssIsPlaying = !ssIsPlaying;
    const btn = document.getElementById('slideshow-toggle');
    const icon = btn.querySelector('.material-symbols-outlined');

    if (ssIsPlaying) {
        icon.innerText = 'pause_circle';
        btn.classList.add('active');
        startSlideshow();
    } else {
        icon.innerText = 'play_circle';
        btn.classList.remove('active');
        stopSlideshow();
    }
}

function startSlideshow() {
    stopSlideshow();
    ssInterval = setInterval(() => {
        nextMediaWithTransition();
    }, ssConfig.interval);
}

function stopSlideshow() {
    if (ssInterval) {
        clearInterval(ssInterval);
        ssInterval = null;
    }
}

function nextMediaWithTransition() {
    const effect = document.getElementById('ss-effect-select')?.value || 'fade';
    const modalImg = document.getElementById('viewer-img');
    const modalVid = document.getElementById('viewer-video');
    const currentMedia = modalImg.style.display !== 'none' ? modalImg : modalVid;

    if (effect !== 'none') {
        currentMedia.classList.add(`transition-${effect}`);
        setTimeout(() => {
            nextMedia();
            currentMedia.classList.remove(`transition-${effect}`);
        }, 400);
    } else {
        nextMedia();
    }
}

function toggleSlideshowSettings() {
    const panel = document.getElementById('ss-settings');
    panel.classList.toggle('active');
}

function updateIntervalLabel(val) {
    document.getElementById('ss-interval-val').innerText = val;
    ssConfig.interval = val * 1000;
    if (ssIsPlaying) startSlideshow(); // Restart with new speed
}

// --- Grid Column Controls (Pinch & Settings) ---

let currentCols = 3;
let initialPinchDistance = null;
let lastPinchUpdateTime = 0;

function initGridControls() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    // Save/Load preference
    let saved = localStorage.getItem('pixi_cols');
    if (!saved && window.innerWidth <= 768) saved = 2;
    if (saved) updateGridCols(saved);

    // Touch Support for Pinch
    gallery.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialPinchDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
        }
    }, { passive: true });

    gallery.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            const now = Date.now();
            if (now - lastPinchUpdateTime < 150) return; // Throttle change

            const currentDist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );

            const diff = currentDist - initialPinchDistance;

            if (Math.abs(diff) > 50) { // Threshold for change
                if (diff > 0 && currentCols > 1) {
                    updateGridCols(currentCols - 1); // Zoom in -> fewer cols
                } else if (diff < 0 && currentCols < 6) {
                    updateGridCols(currentCols + 1); // Zoom out -> more cols
                }
                initialPinchDistance = currentDist;
                lastPinchUpdateTime = now;
            }
        }
    }, { passive: true });

    gallery.addEventListener('touchend', () => {
        initialPinchDistance = null;
    });
}

function toggleGridSettings() {
    const popup = document.getElementById('grid-settings');
    popup.classList.toggle('active');
}

function updateGridCols(val) {
    currentCols = parseInt(val);
    document.documentElement.style.setProperty('--grid-cols', currentCols);
    document.getElementById('grid-col-val').innerText = currentCols;
    document.getElementById('grid-col-range').value = currentCols;
    localStorage.setItem('pixi_cols', currentCols);

    // Performance Optimization: high density = low res mode
    const gallery = document.getElementById('gallery');
    if (gallery) {
        if (currentCols >= 5) gallery.dataset.density = 'high';
        else gallery.dataset.density = 'normal';
    }
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `glass toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 6rem;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        padding: 1rem 2rem;
        z-index: 2000;
        opacity: 0;
        transition: all 0.4s var(--spring-easing);
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
