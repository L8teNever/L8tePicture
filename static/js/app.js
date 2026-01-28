let currentImages = [];
let currentIndex = 0;
let offset = 50;
let limit = 50;
let isLoadingMore = false;
let hasMore = true;
let currentSearch = new URLSearchParams(window.location.search).get('search') || "";

// Initialize images from DOM (first batch)
function updateImageList() {
    const cards = document.querySelectorAll('.image-card');
    currentImages = Array.from(cards).map(card => ({
        id: parseInt(card.dataset.id),
        filename: card.dataset.filename,
        name: card.dataset.name,
        is_favorite: card.querySelector('.favorite-btn span').classList.contains('fill-1')
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    updateImageList();

    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.addEventListener('change', handleUpload);

    const slider = document.getElementById('zoom-slider');
    if (slider) {
        if (window.innerWidth < 768) {
            slider.value = 2;
        } else {
            slider.value = 3;
        }
        updateZoom(slider.value);
    }

    initPinchToZoom();
    initInfiniteScroll();
});

// Optimization for 10,000+ images: Infinite Scroll
function initInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
            loadNextBatch();
        }
    }, { passive: true });
}

async function loadNextBatch() {
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;

    try {
        const response = await fetch(`/api/images?offset=${offset}&limit=${limit}&search=${encodeURIComponent(currentSearch)}`);
        const newImages = await response.json();

        if (newImages.length < limit) {
            hasMore = false;
        }

        if (newImages.length > 0) {
            const gallery = document.getElementById('image-gallery');
            newImages.forEach(img => {
                // Check if already exist to avoid duplicates
                if (currentImages.find(existing => existing.id === img.id)) return;

                const item = document.createElement('div');
                item.className = "masonry-item image-card";
                item.dataset.id = img.id;
                item.dataset.filename = img.filename;
                item.dataset.name = img.original_name;
                item.onclick = () => openSlideshow(currentImages.length);

                const favoriteClass = img.is_favorite ? 'fill-1' : '';

                item.innerHTML = `
                <div class="glass-card rounded-[28px] overflow-hidden p-1 relative min-h-[100px] flex items-center justify-center">
                    <div class="absolute inset-0 flex items-center justify-center z-0 spinner-container">
                        <div class="spinner"></div>
                    </div>
                    <div class="relative rounded-[24px] overflow-hidden w-full h-full z-10">
                        <img src="/thumbnails/${img.filename}.webp" alt="${img.original_name}"
                            class="w-full h-full object-cover image-loading" loading="lazy" 
                            onload="this.classList.add('image-loaded'); this.parentElement.parentElement.querySelector('.spinner-container').style.display='none';">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100 flex items-end justify-end p-4">
                            <div class="flex gap-2 text-white">
                                <button class="h-8 w-8 flex items-center justify-center rounded-full bg-white/25 backdrop-blur-lg border border-white/30 favorite-btn" 
                                    onclick="event.stopPropagation(); toggleFavorite(${img.id}, this)">
                                    <span class="material-symbols-outlined text-white text-[18px] font-extralight ${favoriteClass}">favorite</span>
                                </button>
                                <button class="h-8 w-8 flex items-center justify-center rounded-full bg-white/25 backdrop-blur-lg border border-white/30" 
                                    onclick="event.stopPropagation(); deleteImage(${img.id})">
                                    <span class="material-symbols-outlined text-white text-[18px] font-extralight">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;

                gallery.appendChild(item);
                currentImages.push({
                    id: img.id,
                    filename: img.filename,
                    name: img.original_name,
                    is_favorite: img.is_favorite
                });
            });
            offset += newImages.length;
        }
    } catch (e) {
        console.error("Failed to load more images:", e);
    } finally {
        isLoadingMore = false;
    }
}

// Server-side Search with Debounce for efficiency
let searchTimeout;
function debounceSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        // We use full page reload for search to keep state clean, 
        // but we could also do it via AJAX if preferred.
        // For 10k images, server search is mandatory.
        const url = new URL(window.location);
        url.searchParams.set('search', query);
        window.location.href = url.href;
    }, 600);
}

function updateZoom(value) {
    const gallery = document.getElementById('image-gallery');
    const label = document.getElementById('zoom-label');
    if (!gallery) return;

    if (label) label.innerText = value;

    if (gallery.classList.contains('grid-view')) {
        gallery.style.setProperty('--grid-cols', value);
    } else {
        gallery.style.setProperty('--masonry-cols', value);
    }
}

function toggleSettings() {
    const popup = document.getElementById('settings-popup');
    if (!popup) return;

    const isHidden = popup.classList.contains('opacity-0');
    if (isHidden) {
        popup.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        popup.classList.add('opacity-100', 'scale-100');
    } else {
        popup.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        popup.classList.remove('opacity-100', 'scale-100');
    }
}

// Pinch to Zoom implementation for mobile
let initialPinchDistance = null;
function initPinchToZoom() {
    const gallery = document.getElementById('image-gallery');
    const slider = document.getElementById('zoom-slider');
    if (!gallery || !slider) return;

    gallery.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        }
    }, { passive: true });

    gallery.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const diff = currentDistance - initialPinchDistance;

            if (Math.abs(diff) > 40) {
                let currentValue = parseInt(slider.value);
                if (diff > 0 && currentValue > 1) {
                    currentValue--;
                    initialPinchDistance = currentDistance;
                } else if (diff < 0 && currentValue < 10) {
                    currentValue++;
                    initialPinchDistance = currentDistance;
                }

                if (currentValue !== parseInt(slider.value)) {
                    slider.value = currentValue;
                    updateZoom(currentValue);
                }
            }
        }
    }, { passive: true });

    gallery.addEventListener('touchend', () => { initialPinchDistance = null; }, { passive: true });
}

function getDistance(touch1, touch2) {
    return Math.hypot(touch2.pageX - touch1.pageX, touch2.pageY - touch1.pageY);
}

function setViewMode(mode) {
    const gallery = document.getElementById('image-gallery');
    const gridBtn = document.getElementById('grid-mode-btn');
    const masonryBtn = document.getElementById('masonry-mode-btn');

    if (!gallery || !gridBtn || !masonryBtn) return;

    if (mode === 'grid') {
        gallery.classList.remove('masonry-view');
        gallery.classList.add('grid-view');
        gridBtn.classList.add('bg-white/60', 'shadow-sm');
        masonryBtn.classList.remove('bg-white/60', 'shadow-sm');
    } else {
        gallery.classList.remove('grid-view');
        gallery.classList.add('masonry-view');
        masonryBtn.classList.add('bg-white/60', 'shadow-sm');
        gridBtn.classList.remove('bg-white/60', 'shadow-sm');
    }
    updateZoom(document.getElementById('zoom-slider').value);
}

// PREMIUM UPLOAD LOGIC with Progress Tracking
function uploadFile(file, index, total) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('files', file);

        const row = document.getElementById(`upload-row-${index}`);
        const fill = row ? row.querySelector('.row-fill') : null;
        const percentLabel = row ? row.querySelector('.row-percent') : null;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                if (fill) fill.style.width = `${percent}%`;
                if (percentLabel) percentLabel.innerText = `${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed for ${file.name}`));
            }
        };

        xhr.onerror = () => reject(new Error(`Network error for ${file.name}`));

        xhr.open('POST', '/upload');
        xhr.send(formData);
    });
}

async function handleUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const modal = document.getElementById('upload-modal');
    const listContainer = document.getElementById('upload-file-list');
    const dotsContainer = document.getElementById('overall-progress-dots');
    const overallStatus = document.getElementById('overall-status');
    const countLabel = document.getElementById('file-count');

    if (modal) modal.style.display = 'flex';
    if (listContainer) listContainer.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';
    if (overallStatus) overallStatus.innerText = 'Uploading Images...';
    if (countLabel) countLabel.innerText = `0 of ${files.length} images uploaded`;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const row = document.createElement('div');
        row.id = `upload-row-${i}`;
        row.className = "flex flex-col gap-1.5";
        row.innerHTML = `
            <div class="flex justify-between items-center text-[11px] font-medium">
                <span class="text-slate-700 truncate max-w-[200px]">${file.name}</span>
                <span class="row-percent text-ios-accent">0%</span>
            </div>
            <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div class="row-fill h-full bg-ios-accent transition-all duration-300" style="width: 0%;"></div>
            </div>
        `;
        listContainer.appendChild(row);

        const dot = document.createElement('div');
        dot.className = "h-1.5 w-1.5 rounded-full bg-slate-200 transition-all duration-300";
        dot.id = `dot-${i}`;
        if (dotsContainer) dotsContainer.appendChild(dot);
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.classList.replace('bg-slate-200', 'bg-ios-accent');

        try {
            await uploadFile(files[i], i, files.length);
            successCount++;
            if (dot) dot.classList.replace('bg-ios-accent', 'bg-emerald-500');
            if (countLabel) countLabel.innerText = `${successCount} of ${files.length} images uploaded`;
        } catch (error) {
            console.error(error);
            if (dot) dot.classList.replace('bg-ios-accent', 'bg-red-500');
        }
    }

    if (overallStatus) overallStatus.innerText = 'Success!';
    setTimeout(() => { location.reload(); }, 1000);
}

async function toggleFavorite(id, btn) {
    try {
        const response = await fetch(`/favorite/${id}`, { method: 'POST' });
        const data = await response.json();
        const icon = btn.querySelector('.material-symbols-outlined');
        if (data.is_favorite) { icon.classList.add('fill-1'); }
        else { icon.classList.remove('fill-1'); }
    } catch (error) { console.error('Error toggling favorite:', error); }
}

async function deleteImage(id) {
    if (!confirm('Bist du sicher?')) return;
    try {
        const response = await fetch(`/delete/${id}`, { method: 'DELETE' });
        if (response.ok) {
            const card = document.querySelector(`.image-card[data-id="${id}"]`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                setTimeout(() => { card.remove(); updateImageList(); }, 300);
            }
        }
    } catch (error) { console.error('Error deleting image:', error); }
}

function openSlideshow(index) {
    currentIndex = index;
    const modal = document.getElementById('slideshow-modal');
    updateModalImage();
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeSlideshow() {
    const modal = document.getElementById('slideshow-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function changeSlide(direction) {
    currentIndex += direction;
    if (currentIndex >= currentImages.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = currentImages.length - 1;
    updateModalImage();
}

function updateModalImage() {
    const modalImg = document.getElementById('modal-img');
    const spinner = document.getElementById('modal-spinner');
    if (!modalImg || !currentImages[currentIndex]) return;

    modalImg.classList.remove('image-loaded');
    if (spinner) spinner.style.display = 'flex';
    modalImg.src = `/previews/${currentImages[currentIndex].filename}.webp`;

    const nextIdx = (currentIndex + 1) % currentImages.length;
    if (currentImages[nextIdx]) {
        const img = new Image();
        img.src = `/previews/${currentImages[nextIdx].filename}.webp`;
    }
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('slideshow-modal').style.display === 'flex') {
        if (e.key === 'ArrowLeft') changeSlide(-1);
        if (e.key === 'ArrowRight') changeSlide(1);
        if (e.key === 'Escape') closeSlideshow();
    }
});
