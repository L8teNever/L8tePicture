let currentImages = [];
let currentIndex = 0;
let offset = 50;
let limit = 50;
let isLoadingMore = false;
let hasMore = true;
let currentSearch = new URLSearchParams(window.location.search).get('search') || "";
let slideshowInterval = null;

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
        if (window.innerWidth < 768) { slider.value = 2; }
        else { slider.value = 3; }
        updateZoom(slider.value);
    }

    initPinchToZoom();
    initInfiniteScroll();
    initSwipeNavigation();
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

        if (newImages.length < limit) { hasMore = false; }

        if (newImages.length > 0) {
            const gallery = document.getElementById('image-gallery');
            newImages.forEach(img => {
                if (currentImages.find(existing => existing.id === img.id)) return;

                const item = document.createElement('div');
                item.className = "masonry-item image-card";
                item.dataset.id = img.id;
                item.dataset.filename = img.filename;
                item.dataset.name = img.original_name;
                item.onclick = () => openSlideshow(currentImages.indexOf(currentImages.find(i => i.id === img.id)) || currentImages.length);

                const favoriteClass = img.is_favorite ? 'fill-1' : '';

                item.innerHTML = `
                <div class="glass-card rounded-[28px] overflow-hidden p-1 relative">
                    <div class="absolute inset-0 flex items-center justify-center z-0 spinner-container">
                        <div class="spinner"></div>
                    </div>
                    <div class="relative rounded-[24px] overflow-hidden w-full h-full z-10">
                        <img src="/thumbnails/${img.filename}.webp" alt="${img.original_name}"
                            class="w-full h-full object-cover image-loading" loading="lazy" 
                            onload="this.classList.add('image-loaded'); this.parentElement.parentElement.querySelector('.spinner-container').style.display='none';"
                            onerror="this.parentElement.parentElement.querySelector('.spinner-container').style.display='none';">
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

function debounceSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
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

// PREMIUM UPLOAD LOGIC with Background Task Capability
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
                updateMiniProgress(index, total, percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) { resolve(JSON.parse(xhr.responseText)); }
            else { reject(new Error(`Upload failed for ${file.name}`)); }
        };
        xhr.onerror = () => reject(new Error(`Network error for ${file.name}`));
        xhr.open('POST', '/upload');
        xhr.send(formData);
    });
}

function updateMiniProgress(index, total, percent) {
    const mini = document.getElementById('upload-mini-progress');
    const miniCircle = document.getElementById('mini-progress-circle');
    const miniCount = document.getElementById('mini-count');

    if (mini) mini.classList.remove('hidden');
    if (miniCount) miniCount.innerText = `${index + 1} / ${total} Images`;

    const totalProgress = ((index / total) * 100) + (percent / total);
    const offset = 88 - (88 * totalProgress) / 100;
    if (miniCircle) miniCircle.style.strokeDashoffset = offset;
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) modal.style.display = 'none';
}

function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) modal.style.display = 'flex';
}

async function handleUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    openUploadModal();
    const listContainer = document.getElementById('upload-file-list');
    const dotsContainer = document.getElementById('overall-progress-dots');
    const overallStatus = document.getElementById('overall-status');
    const countLabel = document.getElementById('file-count');

    if (listContainer) listContainer.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';
    if (overallStatus) overallStatus.innerText = 'Uploading Images...';
    if (countLabel) countLabel.innerText = `0 of ${files.length} images uploaded`;

    // Initialize UI rows
    files.forEach((file, i) => {
        const row = document.createElement('div');
        row.id = `upload-row-${i}`;
        row.className = "flex flex-col gap-1.5";
        row.innerHTML = `<div class="flex justify-between items-center text-[11px] font-medium">
                <span class="text-slate-700 truncate max-w-[200px]">${file.name}</span>
                <span class="row-percent text-ios-accent">Waiting...</span>
            </div>
            <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div class="row-fill h-full bg-ios-accent transition-all duration-300" style="width: 0%;"></div>
            </div>`;
        listContainer.appendChild(row);

        const dot = document.createElement('div');
        dot.className = "h-1.5 w-1.5 rounded-full bg-slate-200 transition-all duration-300";
        dot.id = `dot-${i}`;
        if (dotsContainer) dotsContainer.appendChild(dot);
    });

    let successCount = 0;
    const concurrencyLimit = 3;
    const queue = files.map((file, index) => ({ file, index }));
    let activeUploads = 0;

    return new Promise((resolve) => {
        function startNext() {
            if (queue.length === 0 && activeUploads === 0) {
                if (overallStatus) overallStatus.innerText = 'All Done! Optimizing...';
                setTimeout(() => { location.reload(); }, 1500);
                return resolve();
            }

            while (activeUploads < concurrencyLimit && queue.length > 0) {
                const { file, index } = queue.shift();
                activeUploads++;
                const dot = document.getElementById(`dot-${index}`);
                if (dot) dot.classList.replace('bg-slate-200', 'bg-ios-accent');

                uploadFile(file, index, files.length)
                    .then(() => {
                        successCount++;
                        if (dot) dot.classList.replace('bg-ios-accent', 'bg-emerald-500');
                        if (countLabel) countLabel.innerText = `${successCount} of ${files.length} images uploaded`;
                    })
                    .catch(err => {
                        console.error(err);
                        if (dot) dot.classList.replace('bg-ios-accent', 'bg-red-500');
                    })
                    .finally(() => {
                        activeUploads--;
                        startNext();
                    });
            }
        }
        startNext();
    });
}

function openSlideshow(index) {
    currentIndex = index;
    const modal = document.getElementById('slideshow-modal');
    updateModalImage();
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeSlideshow() {
    const modal = document.getElementById('slideshow-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    stopSlideshow();
}

function changeSlide(direction) {
    currentIndex += direction;
    if (currentIndex >= currentImages.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = currentImages.length - 1;
    updateModalImage();
}

function updateModalImage() {
    const modalImg = document.getElementById('modal-img');
    const modalBg = document.getElementById('modal-bg');
    const spinner = document.getElementById('modal-spinner');
    const title = document.getElementById('modal-title');
    const favIcon = document.getElementById('modal-fav-icon');

    if (!modalImg || !currentImages[currentIndex]) return;

    modalImg.classList.remove('image-loaded');
    if (spinner) spinner.style.display = 'flex';

    const imgUrl = `/previews/${currentImages[currentIndex].filename}.webp`;
    modalImg.src = imgUrl;
    if (modalBg) modalBg.style.backgroundImage = `url('${imgUrl}')`;
    if (title) title.innerText = currentImages[currentIndex].name || "Image Preview";

    if (favIcon) {
        if (currentImages[currentIndex].is_favorite) favIcon.classList.add('fill-1');
        else favIcon.classList.remove('fill-1');
    }

    const nextIdx = (currentIndex + 1) % currentImages.length;
    if (currentImages[nextIdx]) {
        const img = new Image();
        img.src = `/previews/${currentImages[nextIdx].filename}.webp`;
    }
}

// Modal Actions
async function toggleFavoriteCurrent() {
    const img = currentImages[currentIndex];
    if (!img) return;
    try {
        const response = await fetch(`/favorite/${img.id}`, { method: 'POST' });
        const data = await response.json();
        img.is_favorite = data.is_favorite;
        updateModalImage();
        const cardBtn = document.querySelector(`.image-card[data-id="${img.id}"] .favorite-btn span`);
        if (cardBtn) {
            if (data.is_favorite) cardBtn.classList.add('fill-1');
            else cardBtn.classList.remove('fill-1');
        }
    } catch (e) { console.error(e); }
}

function downloadCurrent() {
    const img = currentImages[currentIndex];
    if (!img) return;
    const a = document.createElement('a');
    a.href = `/uploads/${img.filename}`;
    a.download = img.name || img.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function startSlideshow() {
    if (slideshowInterval) { stopSlideshow(); return; }
    const playIcon = document.querySelector('button[onclick="startSlideshow()"] span');
    if (playIcon) playIcon.innerText = 'pause_circle';
    slideshowInterval = setInterval(() => changeSlide(1), 3000);
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
        const playIcon = document.querySelector('button[onclick="startSlideshow()"] span');
        if (playIcon) playIcon.innerText = 'play_circle';
    }
}

async function deleteCurrent() {
    const img = currentImages[currentIndex];
    if (!img || !confirm('Bist du sicher?')) return;
    try {
        const response = await fetch(`/delete/${img.id}`, { method: 'DELETE' });
        if (response.ok) {
            const card = document.querySelector(`.image-card[data-id="${img.id}"]`);
            if (card) card.remove();
            currentImages.splice(currentIndex, 1);
            if (currentImages.length === 0) closeSlideshow();
            else changeSlide(0);
        }
    } catch (e) { console.error(e); }
}

function shareImage() {
    const img = currentImages[currentIndex];
    if (!img) return;
    if (navigator.share) {
        navigator.share({ title: img.name, url: window.location.origin + `/uploads/${img.filename}` });
    } else {
        alert('Sharing URL: ' + window.location.origin + `/uploads/${img.filename}`);
    }
}

// Global Shortcuts
document.addEventListener('keydown', (e) => {
    if (document.getElementById('slideshow-modal').style.display === 'block') {
        if (e.key === 'ArrowLeft') changeSlide(-1);
        if (e.key === 'ArrowRight') changeSlide(1);
        if (e.key === 'Escape') closeSlideshow();
        if (e.key === 'f') toggleFavoriteCurrent();
    }
});

// Touch & Pinch
let initialPinchDistance = null;
function initPinchToZoom() {
    const gallery = document.getElementById('image-gallery');
    const slider = document.getElementById('zoom-slider');
    if (!gallery || !slider) return;
    gallery.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) initialPinchDistance = Math.hypot(e.touches[1].pageX - e.touches[0].pageX, e.touches[1].pageY - e.touches[0].pageY);
    }, { passive: true });
    gallery.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            const currentDistance = Math.hypot(e.touches[1].pageX - e.touches[0].pageX, e.touches[1].pageY - e.touches[0].pageY);
            const diff = currentDistance - initialPinchDistance;
            if (Math.abs(diff) > 40) {
                let val = parseInt(slider.value);
                if (diff > 0 && val > 1) { val--; initialPinchDistance = currentDistance; }
                else if (diff < 0 && val < 10) { val++; initialPinchDistance = currentDistance; }
                if (val != slider.value) { slider.value = val; updateZoom(val); }
            }
        }
    }, { passive: true });
    gallery.addEventListener('touchend', () => { initialPinchDistance = null; }, { passive: true });
}

// Swipe Navigation for Modal
let touchStartX = 0;
let touchEndX = 0;

function initSwipeNavigation() {
    const modal = document.getElementById('slideshow-modal');
    if (!modal) return;

    modal.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    modal.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const threshold = 50; // pixels

    if (swipeDistance > threshold) {
        // Swipe Right -> Previous Image
        changeSlide(-1);
    } else if (swipeDistance < -threshold) {
        // Swipe Left -> Next Image
        changeSlide(1);
    }
}
