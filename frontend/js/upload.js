/**
 * P.I.X.I. Upload Manager
 * Handles bulk image uploads with progress tracking
 */

class UploadManager {
    constructor() {
        this.uploadDialog = null;
        this.uploadInput = null;
        this.uploadQueue = [];
        this.uploading = false;
        this.currentBatch = 0;
        this.totalFiles = 0;
        this.uploadedCount = 0;
        this.failedCount = 0;
        this.batchSize = 10; // Upload 10 files at a time

        this.init();
    }

    init() {
        this.createUploadUI();
        this.attachEventListeners();
    }

    createUploadUI() {
        // Create upload dialog
        const dialog = document.createElement('div');
        dialog.id = 'uploadDialog';
        dialog.className = 'dialog-container';
        dialog.innerHTML = `
            <div class="material-dialog" style="max-width: 600px;">
                <h3 class="text-3xl font-black mb-6 tracking-tight">Bilder hochladen</h3>
                
                <!-- Drop Zone -->
                <div id="dropZone" class="upload-drop-zone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p class="text-lg font-bold mb-2">Bilder hierher ziehen</p>
                    <p class="text-sm opacity-70 mb-4">oder</p>
                    <button id="selectFilesBtn" class="click-feedback px-8 py-4 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold rounded-3xl shadow-lg">
                        Dateien auswählen
                    </button>
                    <p class="text-xs opacity-50 mt-4">Unterstützt: JPG, PNG, WEBP, HEIC • Bis zu 1000+ Bilder gleichzeitig</p>
                </div>

                <!-- Upload Progress -->
                <div id="uploadProgress" class="hidden mt-6">
                    <div class="flex justify-between text-sm font-bold mb-2">
                        <span id="uploadStatus">Hochladen...</span>
                        <span id="uploadCount">0 / 0</span>
                    </div>
                    <div class="w-full bg-[var(--md-sys-color-surface-container)] rounded-full h-3 overflow-hidden">
                        <div id="uploadProgressBar" class="bg-[var(--md-sys-color-primary)] h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <div id="uploadDetails" class="mt-4 text-xs opacity-70">
                        <div class="flex justify-between mb-1">
                            <span>Erfolgreich:</span>
                            <span id="uploadSuccess" class="text-green-600 font-bold">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Fehler:</span>
                            <span id="uploadFailed" class="text-red-600 font-bold">0</span>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-4 mt-8">
                    <button id="closeUploadBtn" class="click-feedback flex-1 py-4 text-[var(--md-sys-color-primary)] font-bold rounded-3xl border-2 border-[var(--md-sys-color-outline)]">
                        Abbrechen
                    </button>
                    <button id="startUploadBtn" class="click-feedback flex-1 py-4 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold rounded-3xl shadow-lg hidden">
                        Upload starten
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        this.uploadDialog = dialog;

        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'uploadInput';
        input.multiple = true;
        input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif';
        input.style.display = 'none';
        document.body.appendChild(input);
        this.uploadInput = input;
    }

    attachEventListeners() {
        // Open upload dialog
        const uploadBtn = document.createElement('button');
        uploadBtn.id = 'uploadBtn';
        uploadBtn.className = 'click-feedback p-2 sm:p-3 hover:bg-black/5 rounded-full transition-all';
        uploadBtn.innerHTML = `
            <svg class="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        `;
        uploadBtn.addEventListener('click', () => this.open());

        // Insert upload button before settings button
        const settingsBtn = document.getElementById('settingsBtn');
        settingsBtn.parentNode.insertBefore(uploadBtn, settingsBtn);

        // File input change
        this.uploadInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Select files button
        document.getElementById('selectFilesBtn').addEventListener('click', () => {
            this.uploadInput.click();
        });

        // Close dialog
        document.getElementById('closeUploadBtn').addEventListener('click', () => this.close());

        // Start upload
        document.getElementById('startUploadBtn').addEventListener('click', () => this.startUpload());

        // Drag and drop
        const dropZone = document.getElementById('dropZone');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });
    }

    open() {
        this.uploadDialog.classList.add('active');
        this.reset();
    }

    close() {
        if (this.uploading) {
            if (!confirm('Upload läuft noch. Wirklich abbrechen?')) {
                return;
            }
        }
        this.uploadDialog.classList.remove('active');
        this.reset();
    }

    reset() {
        this.uploadQueue = [];
        this.uploading = false;
        this.currentBatch = 0;
        this.totalFiles = 0;
        this.uploadedCount = 0;
        this.failedCount = 0;

        document.getElementById('uploadProgress').classList.add('hidden');
        document.getElementById('dropZone').classList.remove('hidden');
        document.getElementById('startUploadBtn').classList.add('hidden');
        document.getElementById('uploadProgressBar').style.width = '0%';
        this.uploadInput.value = '';
    }

    handleFileSelect(files) {
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(f =>
            f.type.startsWith('image/') ||
            f.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|heic|heif)$/)
        );

        if (validFiles.length === 0) {
            alert('Keine gültigen Bilddateien ausgewählt.');
            return;
        }

        this.uploadQueue = validFiles;
        this.totalFiles = validFiles.length;

        // Show preview
        document.getElementById('dropZone').classList.add('hidden');
        document.getElementById('uploadProgress').classList.remove('hidden');
        document.getElementById('startUploadBtn').classList.remove('hidden');
        document.getElementById('uploadStatus').textContent = `${this.totalFiles} Bilder bereit zum Upload`;
        document.getElementById('uploadCount').textContent = `0 / ${this.totalFiles}`;
    }

    async startUpload() {
        this.uploading = true;
        document.getElementById('startUploadBtn').disabled = true;
        document.getElementById('startUploadBtn').classList.add('opacity-50');
        document.getElementById('uploadStatus').textContent = 'Hochladen...';

        // Process in batches
        for (let i = 0; i < this.uploadQueue.length; i += this.batchSize) {
            const batch = this.uploadQueue.slice(i, i + this.batchSize);
            await this.uploadBatch(batch);
        }

        // Complete
        this.uploading = false;
        document.getElementById('uploadStatus').textContent = 'Upload abgeschlossen!';
        document.getElementById('closeUploadBtn').textContent = 'Fertig';

        // Reload gallery
        if (window.galleryManager) {
            await window.galleryManager.loadPhotos();
        }
    }

    async uploadBatch(files) {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            this.uploadedCount += result.uploaded;
            this.failedCount += result.failed;

            this.updateProgress();
        } catch (error) {
            console.error('Upload error:', error);
            this.failedCount += files.length;
            this.updateProgress();
        }
    }

    updateProgress() {
        const total = this.uploadedCount + this.failedCount;
        const percentage = (total / this.totalFiles) * 100;

        document.getElementById('uploadProgressBar').style.width = `${percentage}%`;
        document.getElementById('uploadCount').textContent = `${total} / ${this.totalFiles}`;
        document.getElementById('uploadSuccess').textContent = this.uploadedCount;
        document.getElementById('uploadFailed').textContent = this.failedCount;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});
