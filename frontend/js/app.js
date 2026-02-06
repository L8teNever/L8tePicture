/**
 * P.I.X.I. Main Application
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 P.I.X.I. Initializing...');

    // Rescan Button Logic
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.onclick = async () => {
            rescanBtn.classList.add('pulse');
            try {
                const response = await fetch('/api/rescan');
                const result = await response.json();
                console.log('Rescan completed:', result);

                // Refresh gallery
                if (window.galleryManager) {
                    await window.galleryManager.loadImages();
                }
            } catch (error) {
                console.error('Rescan failed:', error);
            } finally {
                rescanBtn.classList.remove('pulse');
            }
        };
    }

    // Handle offline status
    window.addEventListener('online', () => {
        document.body.classList.remove('offline');
        console.log('Back online');
    });

    window.addEventListener('offline', () => {
        document.body.classList.add('offline');
        console.log('Working offline');
    });
});
