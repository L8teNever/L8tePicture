/**
 * AURA - Core Application Logic
 */

let images = [];
let currentIndex = 0;
let offset = 50;
const limit = 50;
let isLoading = false;
let hasMore = true;
let search = new URLSearchParams(window.location.search).get('search') || "";
let favoritesOnly = new URLSearchParams(window.location.search).get('favorites') === "true";

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
    initInfiniteScroll();

    // Global ESC key for modal
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeViewer();
        if (e.key === 'ArrowRight') nextMedia();
        if (e.key === 'ArrowLeft') prevMedia();
    });
});

function initGallery() {
    // Read initial images from DOM (if any)
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
        document.getElementById('gallery').innerHTML = '';
    }

    try {
        const response = await fetch(`/api/images?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}&favorites=${favoritesOnly}`);
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

// --- Searching & Filtering ---

let searchTimer;
function debounceSearch(val) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        search = val;
        fetchImages(true);
    }, 400);
}

function toggleFavorites() {
    favoritesOnly = !favoritesOnly;
    const btn = document.querySelector('.header-actions .btn-action');
    const icon = btn.querySelector('.material-symbols-outlined');

    if (favoritesOnly) {
        icon.classList.add('fill-1');
        btn.innerHTML = `<span class="material-symbols-outlined fill-1">favorite</span> ALLE`;
    } else {
        icon.classList.remove('fill-1');
        btn.innerHTML = `<span class="material-symbols-outlined">favorite</span> FAVORITEN`;
    }

    fetchImages(true);
}

// --- Upload Logic ---

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    showToast(`Lade ${files.length} Momente hoch...`, 'info');

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.count > 0) {
            showToast(`${result.count} Momente erfolgreich hinzugefügt!`, 'success');
            fetchImages(true); // Refresh for now, or could prepend
        }
    } catch (err) {
        showToast("Upload fehlgeschlagen", "error");
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

        // Update local state
        const imgIdx = images.findIndex(i => i.id == id);
        if (imgIdx !== -1) images[imgIdx].is_favorite = data.is_favorite;

    } catch (err) {
        console.error("Favorite toggle failed:", err);
    }
}

// --- Viewer / Modal ---

function openViewer(id, filename, type) {
    const modal = document.getElementById('viewer-modal');
    const modalImg = document.getElementById('viewer-img');
    const modalVid = document.getElementById('viewer-video');

    currentIndex = images.findIndex(i => i.id == id);
    const imgData = images[currentIndex];

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

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
        // Fallback if preview doesn't exist
        modalImg.onerror = () => {
            modalImg.src = `/uploads/${imgData.filename}`;
            modalImg.onerror = null;
        };
    }

    // Update favorite button
    if (imgData.is_favorite) {
        favBtn.classList.add('active');
        favBtn.querySelector('span').classList.add('fill-1');
    } else {
        favBtn.classList.remove('active');
        favBtn.querySelector('span').classList.remove('fill-1');
    }
}

function closeViewer() {
    const modal = document.getElementById('viewer-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('viewer-video').pause();
}

function nextMedia() {
    if (currentIndex < images.length - 1) {
        currentIndex++;
        updateViewerContent();
    } else if (hasMore) {
        fetchImages().then(() => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                updateViewerContent();
            }
        });
    }
}

function prevMedia() {
    if (currentIndex > 0) {
        currentIndex--;
        updateViewerContent();
    }
}

function toggleViewerFavorite() {
    const imgData = images[currentIndex];
    const favBtn = document.getElementById('viewer-fav-btn');
    toggleFavorite(imgData.id, favBtn);

    // Sync with gallery card
    const card = document.querySelector(`.image-card[data-id="${imgData.id}"] .btn-fav`);
    if (card) {
        if (imgData.is_favorite) card.classList.add('active');
        else card.classList.remove('active');
    }
}

async function deleteCurrent() {
    if (!confirm("Moment wirklich löschen?")) return;

    const imgData = images[currentIndex];
    try {
        await fetch(`/delete/${imgData.id}`, { method: 'DELETE' });
        showToast("Moment gelöscht", "info");

        // Remove from local and gallery
        images.splice(currentIndex, 1);
        const card = document.querySelector(`.image-card[data-id="${imgData.id}"]`);
        if (card) card.remove();

        if (images.length === 0) {
            closeViewer();
            document.getElementById('gallery').innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">photo_library</span>
                    <p>DEINE GALERIE IST NOCH LEER</p>
                    <button class="btn-action" onclick="document.getElementById('file-input').click()">ERSTEN MOMENT HOCHLADEN</button>
                </div>
            `;
        } else {
            if (currentIndex >= images.length) currentIndex = images.length - 1;
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
