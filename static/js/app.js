let currentImages = [];
let currentIndex = 0;

// Initialize images from DOM
function updateImageList() {
    const cards = document.querySelectorAll('.image-card');
    currentImages = Array.from(cards).map(card => ({
        id: card.dataset.id,
        filename: card.dataset.filename
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    updateImageList();

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', handleUpload);

    // Initial zoom trigger based on screen width
    const slider = document.getElementById('zoom-slider');
    if (window.innerWidth < 768) {
        slider.value = 2; // Default 2 columns on mobile
    }
    updateZoom(slider.value);

    // Enable transitions after initial set to avoid flickering
    setTimeout(() => {
        const gallery = document.getElementById('image-gallery');
        if (gallery) gallery.style.transition = 'all 0.4s ease';
    }, 100);

    // Pinch to Zoom implementation for mobile
    initPinchToZoom();
});

let initialPinchDistance = null;

function initPinchToZoom() {
    const gallery = document.getElementById('image-gallery');
    const slider = document.getElementById('zoom-slider');
    if (!gallery) return;

    gallery.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        }
    }, { passive: true });

    gallery.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const diff = currentDistance - initialPinchDistance;

            if (Math.abs(diff) > 50) {
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

    if (mode === 'grid') {
        gallery.classList.remove('masonry-view');
        gallery.classList.add('grid-view');
        gridBtn.classList.add('active');
        masonryBtn.classList.remove('active');
    } else {
        gallery.classList.remove('grid-view');
        gallery.classList.add('masonry-view');
        masonryBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
    updateZoom(document.getElementById('zoom-slider').value);
}

function updateZoom(value) {
    const gallery = document.getElementById('image-gallery');
    const label = document.getElementById('zoom-label');
    if (!gallery || !label) return;

    label.innerText = `${value} ${value == 1 ? 'Column' : 'Columns'}`;

    if (gallery.classList.contains('grid-view')) {
        gallery.style.setProperty('--grid-cols', value);
        const minSize = Math.max(100, 1000 / value - 20);
        gallery.style.setProperty('--grid-size', `${minSize}px`);
    } else {
        gallery.style.setProperty('--masonry-cols', value);
    }
}

// PREMIUM UPLOAD LOGIC with Progress Tracking
function uploadFile(file, index, total) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('files', file);

        const fill = document.getElementById('progress-fill');
        const percentLabel = document.getElementById('current-percent');
        const fileNameLabel = document.getElementById('current-file-name');
        const countLabel = document.getElementById('file-count');

        fileNameLabel.innerText = file.name;
        countLabel.innerText = `${index + 1} of ${total} images`;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                fill.style.width = `${percent}%`;
                percentLabel.innerText = `${percent}%`;
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
    const dotsContainer = document.getElementById('overall-progress-dots');
    const overallStatus = document.getElementById('overall-status');

    modal.style.display = 'flex';
    dotsContainer.innerHTML = '';
    overallStatus.innerText = 'Uploading...';

    // Create dots for overall progress
    for (let i = 0; i < files.length; i++) {
        const dot = document.createElement('div');
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.background = 'rgba(255,255,255,0.2)';
        dot.style.transition = 'all 0.3s';
        dot.id = `dot-${i}`;
        dotsContainer.appendChild(dot);
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const dot = document.getElementById(`dot-${i}`);
        dot.style.background = 'var(--ios-accent)';
        dot.style.transform = 'scale(1.2)';

        try {
            await uploadFile(files[i], i, files.length);
            successCount++;
            dot.style.background = '#34C759'; // Apple Success Green
            dot.style.transform = 'scale(1)';
        } catch (error) {
            console.error(error);
            dot.style.background = '#FF3B30'; // Apple Error Red
            dot.style.transform = 'scale(1)';
        }
    }

    overallStatus.innerText = 'Success!';
    setTimeout(() => {
        location.reload();
    }, 1000);
}

async function toggleFavorite(id, btn) {
    try {
        const response = await fetch(`/favorite/${id}`, { method: 'POST' });
        const data = await response.json();
        if (data.is_favorite) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

async function deleteImage(id) {
    if (!confirm('Bist du sicher, dass du dieses Bild löschen möchtest?')) return;

    try {
        const response = await fetch(`/delete/${id}`, { method: 'DELETE' });
        if (response.ok) {
            const card = document.querySelector(`.image-card[data-id="${id}"]`);
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.remove();
                updateImageList();
            }, 300);
        }
    } catch (error) {
        console.error('Error deleting image:', error);
    }
}

// Slideshow Functions
function openSlideshow(index) {
    currentIndex = index;
    const modal = document.getElementById('slideshow-modal');
    updateModalImage();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeSlideshow() {
    document.getElementById('slideshow-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function changeSlide(direction) {
    currentIndex += direction;
    if (currentIndex >= currentImages.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = currentImages.length - 1;
    updateModalImage();
}

function updateModalImage() {
    const modalImg = document.getElementById('modal-img');
    if (modalImg && currentImages[currentIndex]) {
        modalImg.src = `/uploads/${currentImages[currentIndex].filename}`;
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('slideshow-modal');
    if (event.target == modal) {
        closeSlideshow();
    }
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('slideshow-modal').style.display === 'flex') {
        if (e.key === 'ArrowLeft') changeSlide(-1);
        if (e.key === 'ArrowRight') changeSlide(1);
        if (e.key === 'Escape') closeSlideshow();
    }
});
