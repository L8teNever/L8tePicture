let currentImages = [];
let currentIndex = 0;

// Initialize images from DOM
function updateImageList() {
    const cards = document.querySelectorAll('.image-card');
    currentImages = Array.from(cards).map(card => ({
        id: card.dataset.id,
        filename: card.dataset.filename,
        name: card.dataset.name
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    updateImageList();

    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.addEventListener('change', handleUpload);

    // Initial zoom trigger based on screen width
    const slider = document.getElementById('zoom-slider');
    if (slider) {
        if (window.innerWidth < 768) {
            slider.value = 2; // Default 2 columns on mobile
        } else {
            slider.value = 3;
        }
        updateZoom(slider.value);
    }

    // Pinch to Zoom implementation for mobile
    initPinchToZoom();
});

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

    gallery.addEventListener('touchend', () => {
        initialPinchDistance = null;
    }, { passive: true });
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

function filterImages(query) {
    const q = query.toLowerCase();
    const cards = document.querySelectorAll('.image-card');
    cards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        if (name.includes(q)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
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

    // Create rows for each file
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
    setTimeout(() => {
        location.reload();
    }, 1000);
}

async function toggleFavorite(id, btn) {
    try {
        const response = await fetch(`/favorite/${id}`, { method: 'POST' });
        const data = await response.json();
        const icon = btn.querySelector('.material-symbols-outlined');
        if (data.is_favorite) {
            icon.classList.add('fill-1');
        } else {
            icon.classList.remove('fill-1');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
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
                setTimeout(() => {
                    card.remove();
                    updateImageList();
                }, 300);
            }
        }
    } catch (error) {
        console.error('Error deleting image:', error);
    }
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

    // Reset loading state
    modalImg.classList.remove('image-loaded');
    if (spinner) spinner.style.display = 'flex';

    // Set source to optimized preview
    modalImg.src = `/previews/${currentImages[currentIndex].filename}.webp`;

    // Smart Pre-loading: Load the next image in the background
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
