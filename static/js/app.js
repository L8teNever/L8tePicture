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

    // Initial zoom trigger
    updateZoom(document.getElementById('zoom-slider').value);
});

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

    label.innerText = `${value} ${value == 1 ? 'Spalte' : 'Spalten'}`;

    if (gallery.classList.contains('grid-view')) {
        // In grid view we translate the slider value to column count
        gallery.style.setProperty('--grid-cols', value);
        // Also adjust minmax size to prevent too small items or too large ones
        const minSize = Math.max(100, 1000 / value - 20);
        gallery.style.setProperty('--grid-size', `${minSize}px`);
    } else {
        // In masonry view we use columns property
        gallery.style.setProperty('--masonry-cols', value);
    }
}

async function handleUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const container = document.getElementById('upload-progress-container');
    const status = document.getElementById('upload-status');
    const fill = document.getElementById('progress-fill');

    container.style.display = 'block';

    const total = files.length;
    let successCount = 0;

    // We process images one by one as requested for "nacheinander abgearbeitet"
    // even though browsers can handle concurrent uploads, serial processing 
    // satisfies the "nacheinander" requirement and can be more predictable for server load.

    for (let i = 0; i < total; i++) {
        const formData = new FormData();
        formData.append('files', files[i]);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                successCount++;
                const progress = (successCount / total) * 100;
                fill.style.width = `${progress}%`;
                status.innerText = `${successCount} / ${total} abgeschlossen`;
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    }

    // Refresh page or inject elements
    status.innerText = 'Fertig! Lade Seite neu...';
    setTimeout(() => location.reload(), 1000);
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
    const modalImg = document.getElementById('modal-img');

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
    modalImg.src = `/uploads/${currentImages[currentIndex].filename}`;
}

// Close on background click
window.onclick = function (event) {
    const modal = document.getElementById('slideshow-modal');
    if (event.target == modal) {
        closeSlideshow();
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (document.getElementById('slideshow-modal').style.display === 'flex') {
        if (e.key === 'ArrowLeft') changeSlide(-1);
        if (e.key === 'ArrowRight') changeSlide(1);
        if (e.key === 'Escape') closeSlideshow();
    }
});
