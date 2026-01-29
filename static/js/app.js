let currentImages = [];
let currentIndex = 0;
let offset = 50;
let limit = 50;
let isLoadingMore = false;
let hasMore = true;
let currentSearch = new URLSearchParams(window.location.search).get('search') || "";
let currentFavoritesOnly = new URLSearchParams(window.location.search).get('favorites') === "true";
let slideshowInterval = null;
let ssConfig = {
    interval: 3000,
    effect: 'slide',
    isPlaying: false
};

// Initialize images from DOM (first batch)
function updateImageList() {
    const cards = document.querySelectorAll('.image-card');
    currentImages = Array.from(cards).map(card => ({
        id: card.dataset.id, // Keep as string for consistent matching
        filename: card.dataset.filename,
        name: card.dataset.name,
        is_favorite: card.querySelector('.favorite-btn span')?.classList.contains('fill-1'),
        media_type: card.dataset.mediaType,
        width: parseInt(card.dataset.width),
        height: parseInt(card.dataset.height),
        tags: card.dataset.tags ? JSON.parse(card.dataset.tags) : [],
        faces_count: parseInt(card.dataset.facesCount || 0),
        pose: card.dataset.pose || ""
    }));
}

function enterGallery() {
    const landing = document.getElementById('landing-overlay');
    if (landing) {
        landing.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateImageList();

    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.addEventListener('change', handleUpload);

    const slider = document.getElementById('zoom-slider');
    if (slider) {
        let val;
        if (window.innerWidth < 768) { val = 2; }
        else if (window.innerWidth < 1280) { val = 4; }
        else { val = 6; }
        slider.value = val;
        updateZoom(val);
    }

    // Initially disable scrolling while on landing
    const isLandingVisible = !document.getElementById('landing-overlay')?.classList.contains('hidden');
    if (isLandingVisible) {
        document.body.style.overflow = 'hidden';
    }

    initPinchToZoom();
    initInfiniteScroll();
    initSwipeNavigation();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW Registered', reg))
                .catch(err => console.log('SW Registration failed', err));
        });
    }
});

// Optimization for 10,000+ images: Infinite Scroll with IntersectionObserver
function initInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.id = 'infinite-scroll-sentinel';
    sentinel.style.height = '10px';
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadNextBatch();
        }
    }, { rootMargin: '1000px' });

    observer.observe(sentinel);
}

function createGalleryItem(img) {
    const item = document.createElement('div');
    item.className = "masonry-item image-card";
    item.dataset.id = img.id;
    item.dataset.filename = img.filename;
    item.dataset.name = img.original_name;
    item.dataset.mediaType = img.media_type;
    item.dataset.tags = JSON.stringify(img.tags || []);
    item.dataset.faceCount = img.face_count || 0;
    item.dataset.analyzed = img.analyzed || false;
    item.onclick = () => openSlideshow(img.id);

    const favoriteClass = img.is_favorite ? 'fill-1' : '';

    const videoIndicator = img.media_type === 'video' ? `
        <div class="video-badge-modern">
            <div class="badge-blur"></div>
            <div class="badge-content">
                <span class="material-symbols-outlined">play_circle</span>
                <span class="badge-text">VIDEO</span>
            </div>
        </div>` : '';

    // AI Analysis Badges
    let aiBadges = '';
    if (img.analyzed && img.media_type === 'image') {
        const badges = [];

        // Face count badge
        if (img.face_count > 0) {
            badges.push(`
                <div class="ai-badge-item ai-badge-faces">
                    <span class="material-symbols-outlined">face</span>
                    <span>${img.face_count}</span>
                </div>
            `);
        }

        // Primary tag badge
        if (img.tags && img.tags.length > 0) {
            badges.push(`
                <div class="ai-badge-item ai-badge-tag">
                    <span>${img.tags[0]}</span>
                </div>
            `);
        }

        if (badges.length > 0) {
            aiBadges = `<div class="ai-badge">${badges.join('')}</div>`;
        }
    }

    const animatedPreview = img.media_type === 'video' ? `
        <img src="/thumbnails/${img.filename}_preview.webp" alt="Preview" 
            class="preview-animated w-full h-full object-cover" loading="lazy">` : '';

    const ar = (img.width && img.height) ? `${img.width} / ${img.height}` : 'auto';
    const blurThumb = `/thumbnails/${img.filename}.webp`;
    const fallbackThumb = `/uploads/${img.filename}`;

    item.innerHTML = `
    <div class="glass-card rounded-[28px] overflow-hidden p-1 relative" style="aspect-ratio: ${ar};">
        ${videoIndicator}
        ${aiBadges}
        <div class="absolute inset-0 z-0 spinner-container" style="background-image: url('${blurThumb}'); background-size: cover; filter: blur(20px) saturate(1.5); transform: scale(1.1); opacity: 0.6;">
        </div>
        <div class="relative rounded-[24px] overflow-hidden w-full h-full z-10 video-preview-container">
            <img src="${blurThumb}" alt="${img.original_name}"
                class="w-full h-full object-cover image-loading" loading="lazy" decoding="async"
                onload="this.classList.add('image-loaded'); this.parentElement.parentElement.querySelector('.spinner-container').style.display='none';"
                onerror="this.onerror=null; this.src='${fallbackThumb}'; this.parentElement.parentElement.querySelector('.spinner-container').style.display='none';">
            ${animatedPreview}
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100 flex items-end justify-end p-4 z-20 text-white">
                <div class="flex gap-2">
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
    return item;
}

async function loadNextBatch(reset = false) {
    if (isLoadingMore || (!hasMore && !reset)) return;
    isLoadingMore = true;

    if (reset) {
        offset = 0;
        hasMore = true;
        currentImages = [];
        const gallery = document.getElementById('image-gallery');
        if (gallery) gallery.innerHTML = '';
    }

    try {
        const response = await fetch(`/api/images?offset=${offset}&limit=${limit}&search=${encodeURIComponent(currentSearch)}&favorites=${currentFavoritesOnly}`);
        const newImages = await response.json();

        if (newImages.length < limit) { hasMore = false; }

        if (newImages.length > 0) {
            const gallery = document.getElementById('image-gallery');
            const fragment = document.createDocumentFragment();

            newImages.forEach(img => {
                if (currentImages.find(existing => existing.id === img.id)) return;

                const item = createGalleryItem(img);
                fragment.appendChild(item);

                currentImages.push({
                    id: img.id,
                    filename: img.filename,
                    name: img.original_name,
                    is_favorite: img.is_favorite,
                    media_type: img.media_type,
                    width: img.width,
                    height: img.height,
                    tags: img.tags || [],
                    faces_count: img.faces_count || 0,
                    pose: img.pose || ""
                });
            });

            gallery.appendChild(fragment);
            offset += newImages.length;
        }
    } catch (e) {
        console.error("Failed to load more images:", e);
    } finally {
        isLoadingMore = false;
    }
}

function toggleFavoritesFilter() {
    currentFavoritesOnly = !currentFavoritesOnly;
    const btn = document.getElementById('favorites-filter-btn');
    if (btn) {
        if (currentFavoritesOnly) {
            btn.classList.add('text-ios-accent', 'bg-white/40');
            btn.querySelector('span').classList.add('fill-1');
        } else {
            btn.classList.remove('text-ios-accent', 'bg-white/40');
            btn.querySelector('span').classList.remove('fill-1');
        }
    }
    loadNextBatch(true);
}

let searchTimeout;
function debounceSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearch = query;
        loadNextBatch(true);
    }, 400);
}

function updateZoom(value) {
    const gallery = document.getElementById('image-gallery');
    const label = document.getElementById('zoom-label');
    if (!gallery) return;
    if (label) label.innerText = value;
    gallery.style.setProperty('--zoom-level', value);
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

    // Fade out current view
    gallery.style.opacity = '0';
    gallery.style.transform = 'scale(0.98)';

    setTimeout(() => {
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

        // Fade in new view
        gallery.style.opacity = '1';
        gallery.style.transform = 'scale(1)';
    }, 300);
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
    if (miniCount) miniCount.innerText = `${index + 1}/${total}`;

    const totalProgress = ((index / total) * 100) + (percent / total);
    const offset = 63 - (63 * totalProgress) / 100;
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
        row.className = "upload-item-row row-animate";
        row.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined status-icon-pending text-[18px]">hourglass_empty</span>
                    <span class="text-sm font-medium text-slate-700 truncate max-w-[240px]">Media Asset ${i + 1}</span>
                </div>
                <span class="row-percent text-[11px] font-bold text-ios-accent">Waiting</span>
            </div>
            <div class="progress-track">
                <div class="row-fill progress-fill" style="width: 0%;"></div>
            </div>`;
        listContainer.appendChild(row);

        const dot = document.createElement('div');
        dot.className = "h-2 w-2 rounded-full bg-slate-200 transition-all duration-300";
        dot.id = `dot-${i}`;
        if (dotsContainer) dotsContainer.appendChild(dot);
    });

    let successCount = 0;
    const concurrencyLimit = 3;
    const queue = files.map((file, index) => ({ file, index }));
    let activeUploads = 0;

    return new Promise((resolve) => {
        // Prevent accidental page reload during active upload
        const beforeUnloadHandler = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', beforeUnloadHandler);

        function startNext() {
            if (queue.length === 0 && activeUploads === 0) {
                window.removeEventListener('beforeunload', beforeUnloadHandler);
                if (overallStatus) overallStatus.innerText = 'Upload Complete! ✨';
                setTimeout(() => { closeUploadModal(); }, 2000);
                return resolve();
            }

            while (activeUploads < concurrencyLimit && queue.length > 0) {
                const { file, index } = queue.shift();
                activeUploads++;
                const dot = document.getElementById(`dot-${index}`);
                if (dot) dot.classList.replace('bg-slate-200', 'bg-ios-accent');

                uploadFile(file, index, files.length)
                    .then((data) => {
                        successCount++;
                        if (dot) dot.classList.replace('bg-ios-accent', 'bg-emerald-500');
                        if (countLabel) countLabel.innerText = `${successCount} of ${files.length} images uploaded`;

                        const row = document.getElementById(`upload-row-${index}`);
                        if (row) {
                            row.classList.add('completed');
                            const icon = row.querySelector('.status-icon-pending');
                            if (icon) {
                                icon.innerText = 'check_circle';
                                icon.className = 'material-symbols-outlined status-icon-check text-[18px]';
                            }
                            const p = row.querySelector('.row-percent');
                            if (p) p.innerText = 'Done';
                        }

                        // LIVE INJECTION: Add the new image to the gallery immediately
                        if (data && data.images && data.images.length > 0) {
                            injectNewImage(data.images[0]);
                        }
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

function injectNewImage(img) {
    const gallery = document.getElementById('image-gallery');
    if (!gallery) return;

    // Check for duplicates
    if (currentImages.find(existing => existing.id === img.id)) return;

    const item = createGalleryItem(img);
    item.classList.add('animate-pop-in');

    // Add to top of gallery and update tracking list
    gallery.prepend(item);
    currentImages.unshift({
        id: img.id,
        filename: img.filename,
        name: img.original_name,
        is_favorite: img.is_favorite,
        media_type: img.media_type,
        width: img.width,
        height: img.height
    });
}

function openSlideshow(id) {
    const index = currentImages.findIndex(img => img.id === id);
    if (index === -1) return;
    currentIndex = index;
    const modal = document.getElementById('slideshow-modal');

    // Inject thumbnails into strip
    const strip = document.getElementById('thumb-strip');
    if (strip) {
        strip.innerHTML = currentImages.map((img, i) => `
            <img src="/thumbnails/${img.filename}.webp" 
                 class="thumb-strip-item ${i === currentIndex ? 'active' : ''}" 
                 onclick="jumpToSlide(${i})" 
                 id="thumb-${i}"
                 loading="lazy">
        `).join('');
    }

    updateModalImage();
    if (modal) {
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
    }
}

function jumpToSlide(index) {
    currentIndex = index;
    updateModalImage();
}

function closeSlideshow() {
    const modal = document.getElementById('slideshow-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 400);
        document.body.style.overflow = 'auto';
    }
    stopSlideshow();
}

async function changeSlide(direction) {
    const card = document.querySelector('.floating-image-card');
    if (card && ssConfig.effect !== 'none') {
        card.classList.remove('slide-next', 'slide-prev', 'fade-in', 'zoom-in');
        void card.offsetWidth; // reflow

        if (ssConfig.effect === 'slide') {
            card.classList.add(direction >= 0 ? 'slide-next' : 'slide-prev');
        } else if (ssConfig.effect === 'fade') {
            card.classList.add('fade-in');
        } else if (ssConfig.effect === 'zoom') {
            card.classList.add('zoom-in');
        }
    }

    let nextIndex = currentIndex + direction;

    // Auto-loading more images if we hit the end
    if (nextIndex >= currentImages.length) {
        if (hasMore) {
            await loadNextBatch();
            // If we successfully loaded more, update index
            if (nextIndex < currentImages.length) {
                currentIndex = nextIndex;
            } else {
                currentIndex = 0; // Truly reached the end, wrap to start
            }
        } else {
            currentIndex = 0; // Wrap to start
        }
    } else if (nextIndex < 0) {
        currentIndex = currentImages.length - 1; // Wrap to end
    } else {
        currentIndex = nextIndex;
    }

    updateModalImage();
}

function updateModalImage() {
    const modalImg = document.getElementById('modal-img');
    const spinner = document.getElementById('modal-spinner');
    const title = document.getElementById('modal-title');
    const favIcon = document.getElementById('modal-fav-icon');

    const media = currentImages[currentIndex];
    if (!media || !modalImg) return;

    const isVideo = media.media_type === 'video';
    const modalVideo = document.getElementById('modal-video');

    if (isVideo) {
        modalImg.classList.add('hidden');
        if (modalVideo) {
            modalVideo.classList.remove('hidden');
            modalVideo.src = `/uploads/${media.filename}`;
            modalVideo.play().catch(e => console.log("Video autoplay blocked", e));
            if (spinner) spinner.style.display = 'none';
        }
    } else {
        if (modalVideo) {
            modalVideo.classList.add('hidden');
            modalVideo.pause();
            modalVideo.src = "";
        }
        modalImg.classList.remove('hidden');
        modalImg.classList.remove('image-loaded');
        if (spinner) spinner.style.display = 'flex';

        // IMMEDIATE PLACEHOLDER: Use the already-cached thumbnail as a background
        modalImg.style.backgroundImage = `url('/thumbnails/${media.filename}.webp')`;
        modalImg.style.backgroundSize = 'contain';
        modalImg.style.backgroundPosition = 'center';
        modalImg.style.backgroundRepeat = 'no-repeat';

        // Improve perceived performance: Set aspect ratio if available to prevent jump
        if (media.width && media.height) {
            modalImg.style.aspectRatio = `${media.width} / ${media.height}`;
        } else {
            modalImg.style.aspectRatio = 'auto';
        }

        modalImg.decoding = "async";

        // Try preview first, fallback to original if it fails
        modalImg.onerror = () => {
            console.log('Preview not found, loading original image');
            modalImg.onerror = null; // Prevent infinite loop
            modalImg.src = `/uploads/${media.filename}`;
        };

        modalImg.src = `/previews/${media.filename}.webp`;
    }

    if (title) title.innerText = "Memory Preview";

    if (favIcon) {
        if (media.is_favorite) favIcon.classList.add('fill-1');
        else favIcon.classList.remove('fill-1');
    }

    // Update AI Tags
    const tagsContainer = document.getElementById('modal-ai-tags');
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (media.faces_count > 0) {
            const badge = document.createElement('span');
            badge.className = "text-[8px] px-1.5 py-0.5 rounded-full bg-ios-accent/10 text-ios-accent font-bold uppercase";
            badge.innerText = `${media.faces_count} ${media.faces_count === 1 ? 'Face' : 'Faces'}`;
            tagsContainer.appendChild(badge);
        }
        if (media.pose && media.pose !== 'unknown') {
            const badge = document.createElement('span');
            badge.className = "text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-bold uppercase";
            badge.innerText = media.pose;
            tagsContainer.appendChild(badge);
        }
        if (media.tags && media.tags.length > 0) {
            media.tags.forEach(tag => {
                const badge = document.createElement('span');
                badge.className = "text-[8px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase";
                badge.innerText = tag;
                tagsContainer.appendChild(badge);
            });
        }
    }

    // Update thumbnail strip
    const strip = document.getElementById('thumb-strip');
    const activeThumb = document.getElementById(`thumb-${currentIndex}`);

    // Check if we need to regenerate/append thumbs (if loadNextBatch was called)
    if (strip && strip.children.length < currentImages.length) {
        const start = strip.children.length;
        for (let i = start; i < currentImages.length; i++) {
            const thumb = document.createElement('img');
            thumb.src = `/thumbnails/${currentImages[i].filename}.webp`;
            thumb.className = 'thumb-strip-item';
            thumb.id = `thumb-${i}`;
            thumb.onclick = () => jumpToSlide(i);
            thumb.loading = 'lazy';
            strip.appendChild(thumb);
        }
    }

    document.querySelectorAll('.thumb-strip-item').forEach((item, i) => {
        if (i === currentIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            item.classList.remove('active');
        }
    });

    // Sync background gallery scroll (Disabled on mobile to prevent layout shifts)
    if (window.innerWidth >= 768) {
        const galleryItem = document.querySelector(`.image-card[data-id="${currentImages[currentIndex].id}"]`);
        if (galleryItem) {
            galleryItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    // Preload next 2 and previous 1 images
    [currentIndex + 1, currentIndex + 2, currentIndex - 1].forEach(idx => {
        const i = (idx + currentImages.length) % currentImages.length;
        if (currentImages[i] && currentImages[i].media_type === 'image') {
            const img = new Image();
            img.src = `/previews/${currentImages[i].filename}.webp`;
        }
    });
}

function handleModalImageLoad() {
    const modalImg = document.getElementById('modal-img');
    const modalBg = document.getElementById('modal-bg');
    const spinner = document.getElementById('modal-spinner');

    if (!modalImg || !modalBg) return;

    // 1. Show the image
    modalImg.classList.add('image-loaded');
    if (spinner) spinner.style.display = 'none';

    // Clear the placeholder background once the high-res image is loaded
    setTimeout(() => {
        modalImg.style.backgroundImage = 'none';
    }, 400);

    // 2. NOW update the background blur using the THUMBNAIL for efficiency
    const media = currentImages[currentIndex];
    if (media) {
        modalBg.style.backgroundImage = `url('/thumbnails/${media.filename}.webp')`;
    }
}

// Modal Actions
async function toggleFavoriteCurrent() {
    const img = currentImages[currentIndex];
    const favIcon = document.getElementById('modal-fav-icon');
    if (!img) return;

    if (favIcon) {
        favIcon.classList.add('heart-pop');
        favIcon.addEventListener('animationend', () => favIcon.classList.remove('heart_pop'), { once: true });
    }

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

    ssConfig.isPlaying = true;
    updateSSUI();

    slideshowInterval = setInterval(async () => {
        await changeSlide(1);
    }, ssConfig.interval);
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
        ssConfig.isPlaying = false;
        updateSSUI();
    }
}

// Slideshow Settings & Control
function toggleSlideshowSettings() {
    const panel = document.getElementById('slideshow-settings');
    if (panel) panel.classList.toggle('hidden');
}

function updateSSLabel(val) {
    const label = document.getElementById('ss-speed-label');
    if (label) label.innerText = val + 's';
    ssConfig.interval = val * 1000;
    if (ssConfig.isPlaying) {
        stopSlideshow();
        startSlideshow();
    }
}

function setSSEffect(fx) {
    ssConfig.effect = fx;
    document.querySelectorAll('.ss-fx-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-white/40');
        btn.classList.add('bg-white/10');
    });
    const activeBtn = document.getElementById(`btn-fx-${fx}`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-white/40');
        activeBtn.classList.remove('bg-white/10');
    }
}

function toggleSlideshow() {
    if (ssConfig.isPlaying) stopSlideshow();
    else startSlideshow();
}

function updateSSUI() {
    const toggle = document.getElementById('ss-autoplay-toggle');
    const playIcon = document.getElementById('ss-play-icon');

    if (toggle) {
        if (ssConfig.isPlaying) toggle.classList.add('active');
        else toggle.classList.remove('active');
    }

    if (playIcon) {
        playIcon.innerText = ssConfig.isPlaying ? 'pause_circle' : 'play_circle';
        if (ssConfig.isPlaying) playIcon.classList.add('text-ios-accent');
        else playIcon.classList.remove('text-ios-accent');
    }
}

async function deleteCurrent() {
    const img = currentImages[currentIndex];
    const card = document.querySelector('.floating-image-card');
    if (!img || !confirm('Bist du sicher?')) return;
    try {
        const response = await fetch(`/delete/${img.id}`, { method: 'DELETE' });
        if (response.ok) {
            if (card) {
                card.classList.add('image-exit');
                setTimeout(() => {
                    const galleryCard = document.querySelector(`.image-card[data-id="${img.id}"]`);
                    if (galleryCard) galleryCard.remove();
                    currentImages.splice(currentIndex, 1);
                    if (currentImages.length === 0) closeSlideshow();
                    else {
                        card.classList.remove('image-exit');
                        changeSlide(0);
                    }
                }, 400);
            } else {
                currentImages.splice(currentIndex, 1);
                if (currentImages.length === 0) closeSlideshow();
                else changeSlide(0);
            }
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
    const modal = document.getElementById('slideshow-modal');
    if (modal && modal.style.display === 'block') {
        if (e.key === 'ArrowLeft') changeSlide(-1);
        if (e.key === 'ArrowRight') changeSlide(1);
        if (e.key === 'Escape') closeSlideshow();
        if (e.key === 'f') toggleFavoriteCurrent();
        if (e.key === ' ') {
            e.preventDefault();
            toggleSlideshow();
        }
        if (e.key === 'd') downloadCurrent();
        if (e.key === 'Delete') deleteCurrent();
    }
});

// Mousewheel navigation in modal
document.getElementById('slideshow-modal')?.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > 30) {
        changeSlide(e.deltaX > 0 ? 1 : -1);
    }
}, { passive: true });

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
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function initSwipeNavigation() {
    const modal = document.getElementById('slideshow-modal');
    if (!modal) return;

    modal.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    modal.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const swipeX = touchEndX - touchStartX;
    const swipeY = touchEndY - touchStartY;
    const threshold = 50;

    // Horizontal Swipe
    if (Math.abs(swipeX) > Math.abs(swipeY)) {
        if (swipeX > threshold) changeSlide(-1);
        else if (swipeX < -threshold) changeSlide(1);
    }
    // Vertical Swipe (Down to close)
    else if (swipeY > threshold * 1.5) {
        closeSlideshow();
    }
}

// Standalone Helper Functions (for Live Injection and Grid)
async function toggleFavorite(id, btn) {
    const icon = btn.querySelector('span');
    if (icon) {
        icon.classList.add('heart-pop');
        icon.addEventListener('animationend', () => icon.classList.remove('heart-pop'), { once: true });
    }

    try {
        const response = await fetch(`/favorite/${id}`, { method: 'POST' });
        const data = await response.json();
        const img = currentImages.find(i => i.id === id);
        if (img) img.is_favorite = data.is_favorite;

        if (data.is_favorite) icon.classList.add('fill-1');
        else icon.classList.remove('fill-1');

        // Sync with modal if open
        const modalFavIcon = document.getElementById('modal-fav-icon');
        if (modalFavIcon && currentImages[currentIndex]?.id === id) {
            if (data.is_favorite) modalFavIcon.classList.add('fill-1');
            else modalFavIcon.classList.remove('fill-1');
        }
    } catch (e) { console.error(e); }
}

async function deleteImage(id) {
    const card = document.querySelector(`.image-card[data-id="${id}"]`);
    if (!card || !confirm('Bist du sicher?')) return;

    try {
        const response = await fetch(`/delete/${id}`, { method: 'DELETE' });
        if (response.ok) {
            card.classList.add('image-exit');
            setTimeout(() => {
                card.remove();
                currentImages = currentImages.filter(img => img.id !== id);
            }, 400);
        }
    } catch (e) { console.error(e); }
}

// AI Filter Dropdown Functions
function toggleAIFilters() {
    const popup = document.getElementById('ai-filter-popup');
    if (!popup) return;
    const isHidden = popup.classList.contains('opacity-0');

    // Close settings if open
    const settingsPopup = document.getElementById('settings-popup');
    if (settingsPopup && !settingsPopup.classList.contains('opacity-0')) {
        toggleSettings();
    }

    if (isHidden) {
        popup.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        popup.classList.add('opacity-100', 'scale-100');
    } else {
        popup.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        popup.classList.remove('opacity-100', 'scale-100');
    }
}

function applyQuickFilter(filterString) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = filterString;
        currentSearch = filterString;
        loadNextBatch(true);
    }

    // Close the popup
    toggleAIFilters();

    // Visual feedback
    const btn = document.getElementById('ai-filter-btn');
    if (btn) {
        btn.classList.add('text-ios-accent', 'bg-white/40');
        setTimeout(() => {
            btn.classList.remove('text-ios-accent', 'bg-white/40');
        }, 2000);
    }
}

function clearFilters() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        currentSearch = '';
        loadNextBatch(true);
    }
    toggleAIFilters();
}

// Close popups when clicking outside
document.addEventListener('click', (e) => {
    const aiFilterBtn = document.getElementById('ai-filter-btn');
    const aiFilterPopup = document.getElementById('ai-filter-popup');
    const settingsBtn = document.querySelector('[onclick="toggleSettings()"]');
    const settingsPopup = document.getElementById('settings-popup');

    // Close AI filter popup if clicking outside
    if (aiFilterPopup && !aiFilterPopup.classList.contains('opacity-0')) {
        if (!aiFilterPopup.contains(e.target) && !aiFilterBtn.contains(e.target)) {
            toggleAIFilters();
        }
    }

    // Close settings popup if clicking outside
    if (settingsPopup && !settingsPopup.classList.contains('opacity-0')) {
        if (!settingsPopup.contains(e.target) && !settingsBtn.contains(e.target)) {
            toggleSettings();
        }
    }
});
