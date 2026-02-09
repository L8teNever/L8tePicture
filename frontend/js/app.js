/**
 * P.I.X.I. Main Application
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 P.I.X.I. Material You Design UI Initialized');

    // Rescan Button Logic
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.addEventListener('click', async () => {
            rescanBtn.disabled = true;
            rescanBtn.textContent = 'Scanning...';
            try {
                await fetch('/api/scan', { method: 'POST' });
                // Reload gallery after scan
                if (window.galleryManager) {
                    await window.galleryManager.loadPhotos();
                }
            } catch (err) {
                console.error('Scan failed:', err);
            } finally {
                rescanBtn.disabled = false;
                rescanBtn.textContent = 'Scan';
            }
        });
    }

    // Global scroll handler for header effect
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });
});
