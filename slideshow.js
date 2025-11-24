// Slideshow Player for TV/Display devices
// No authentication required

class SlideshowPlayer {
    constructor() {
        this.mediaItems = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.db = new DatabaseManager();
        this.blobURLs = new Map();
        this.currentVideoLoopCount = 0;
        this.currentZoom = 1;
        this.slideshowSettings = {
            slideDuration: 3000,
            transitionSpeed: 600,
            transitionEffect: 'fade',
            playOrder: 'sequential',
            loopSlideshow: true,
            imageFit: 'contain',
            backgroundColor: '#000000',
            showCounter: true,
            showControls: true
        };
        this.slideshowInterval = null;
        this.controlsTimeout = null;
        this.isSettingsPanelOpen = false;
        this.controlsInitialized = false;

        // Server mode - will be determined after checking API availability
        this.useServer = false;

        this.init();
    }

    async init() {
        try {
            // Check if API server is available
            if (typeof api !== 'undefined') {
                this.useServer = await api.checkAvailability();
            }

            if (this.useServer) {
                // Server mode - load from API
                await this.loadFromServer();
            } else {
                await this.db.init();
                await this.loadMedia();
                await this.loadSettings();
            }

            if (this.mediaItems.length > 0) {
                this.hideLoading();
                this.initControls();
                this.startSlideshow();
            } else {
                this.showEmptyState();
            }

            // Auto-refresh media every 30 seconds to sync
            setInterval(() => this.refreshMedia(), 30000);

        } catch (error) {
            console.error('Lỗi khởi tạo slideshow:', error);
            this.showEmptyState();
        }
    }

    async loadFromServer() {
        try {
            this.mediaItems = await api.getAllMedia();

            // Get category filter from URL if provided
            const urlParams = new URLSearchParams(window.location.search);
            const category = urlParams.get('category');

            if (category && category !== 'all') {
                this.mediaItems = this.mediaItems.filter(item => item.category === category);
            }

            // Sort by upload date
            this.mediaItems.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

            // Load settings
            const settings = await api.getSettings();
            if (settings) {
                if (settings.slideDuration) this.slideshowSettings.slideDuration = settings.slideDuration;
                if (settings.transitionEffect) this.slideshowSettings.transitionEffect = settings.transitionEffect;
                if (settings.transitionSpeed) this.slideshowSettings.transitionSpeed = settings.transitionSpeed;
                if (settings.playOrder) this.slideshowSettings.playOrder = settings.playOrder;
                if (settings.loopSlideshow !== undefined) this.slideshowSettings.loopSlideshow = settings.loopSlideshow;
                if (settings.imageFit) this.slideshowSettings.imageFit = settings.imageFit;
                if (settings.backgroundColor) this.slideshowSettings.backgroundColor = settings.backgroundColor;
                if (settings.showCounter !== undefined) this.slideshowSettings.showCounter = settings.showCounter;
                if (settings.showControls !== undefined) this.slideshowSettings.showControls = settings.showControls;
            }
        } catch (e) {
            console.error('Lỗi tải từ server:', e);
        }
    }

    initControls() {
        // Prevent multiple initializations (would create duplicate event listeners)
        if (this.controlsInitialized) {
            return;
        }
        this.controlsInitialized = true;

        // Navigation controls
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const playPauseBtn = document.getElementById('playPauseBtn');

        prevBtn.addEventListener('click', () => this.previousSlide());
        nextBtn.addEventListener('click', () => this.nextSlide());
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');

        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomResetBtn.addEventListener('click', () => this.zoomReset());

        // Settings controls
        const settingsBtn = document.getElementById('slideshowSettingsBtn');
        const settingsPanel = document.getElementById('slideshowSettingsPanel');
        const transitionEffect = document.getElementById('transitionEffect');
        const slideDuration = document.getElementById('slideDuration');
        const slideDurationValue = document.getElementById('slideDurationValue');
        const transitionSpeed = document.getElementById('transitionSpeed');
        const transitionSpeedValue = document.getElementById('transitionSpeedValue');

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
            settingsPanel.classList.toggle('active');

            // When closing settings panel, restart auto-hide countdown
            if (!this.isSettingsPanelOpen) {
                // Force new timeout by clearing first
                if (this.controlsTimeout) {
                    clearTimeout(this.controlsTimeout);
                    this.controlsTimeout = null;
                }
                this.showControls();
            } else {
                // When opening settings, clear timeout so controls stay visible
                if (this.controlsTimeout) {
                    clearTimeout(this.controlsTimeout);
                    this.controlsTimeout = null;
                }
            }
        });

        // Prevent clicks inside settings panel from bubbling up
        settingsPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        settingsPanel.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
        settingsPanel.addEventListener('mousemove', (e) => {
            e.stopPropagation();
        });

        transitionEffect.addEventListener('change', (e) => {
            this.slideshowSettings.transitionEffect = e.target.value;
            this.saveSettings();
        });

        slideDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.slideshowSettings.slideDuration = value * 1000;
            slideDurationValue.textContent = `${value}s`;
            this.saveSettings();

            // Restart slideshow if playing
            if (this.isPlaying) {
                this.stopSlideshow();
                this.startSlideshow();
            }
        });

        transitionSpeed.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.slideshowSettings.transitionSpeed = value;
            transitionSpeedValue.textContent = `${(value / 1000).toFixed(1)}s`;
            this.saveSettings();
            this.applyTransitionSpeed();
        });

        // Video loop setting
        const videoLoopCount = document.getElementById('videoLoopCount');
        const videoLoopValue = document.getElementById('videoLoopValue');
        const saveVideoLoopBtn = document.getElementById('saveVideoLoopBtn');

        videoLoopCount.addEventListener('input', (e) => {
            videoLoopValue.textContent = e.target.value;
        });

        saveVideoLoopBtn.addEventListener('click', () => {
            this.saveCurrentVideoLoop();
        });

        // New settings controls
        const playOrder = document.getElementById('playOrder');
        const loopSlideshow = document.getElementById('loopSlideshow');
        const imageFit = document.getElementById('imageFit');
        const backgroundColor = document.getElementById('backgroundColor');
        const showCounter = document.getElementById('showCounter');
        const showControls = document.getElementById('showControls');

        playOrder.addEventListener('change', (e) => {
            this.slideshowSettings.playOrder = e.target.value;
            this.saveSettings();
        });

        loopSlideshow.addEventListener('change', (e) => {
            this.slideshowSettings.loopSlideshow = e.target.checked;
            this.saveSettings();
        });

        imageFit.addEventListener('change', (e) => {
            this.slideshowSettings.imageFit = e.target.value;
            this.applyImageFit();
            this.saveSettings();
        });

        backgroundColor.addEventListener('input', (e) => {
            this.slideshowSettings.backgroundColor = e.target.value;
            this.applyBackgroundColor();
            this.saveSettings();
        });

        showCounter.addEventListener('change', (e) => {
            this.slideshowSettings.showCounter = e.target.checked;
            this.applyShowCounter();
            this.saveSettings();
        });

        showControls.addEventListener('change', (e) => {
            this.slideshowSettings.showControls = e.target.checked;
            this.applyShowControls();
            this.saveSettings();
        });

        // Close settings panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
                if (this.isSettingsPanelOpen) {
                    this.isSettingsPanelOpen = false;
                    settingsPanel.classList.remove('active');
                    // Force new timeout by clearing first
                    if (this.controlsTimeout) {
                        clearTimeout(this.controlsTimeout);
                        this.controlsTimeout = null;
                    }
                    // Restart auto-hide countdown when closing settings panel
                    this.showControls();
                }
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                    this.previousSlide();
                    break;
                case 'ArrowRight':
                    this.nextSlide();
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case '+':
                case '=':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
                case '0':
                    this.zoomReset();
                    break;
            }
        });

        // Show controls on user interaction (mouse, touch, click)
        // This ensures controls work on TV browsers where mousemove may not fire
        const container = document.getElementById('slideshowContainer');

        // Helper to show controls only when settings panel is closed
        const showControlsIfNotInSettings = () => {
            if (!this.isSettingsPanelOpen) {
                this.showControls();
            }
        };

        container.addEventListener('mousemove', showControlsIfNotInSettings);
        container.addEventListener('click', showControlsIfNotInSettings);
        container.addEventListener('touchstart', showControlsIfNotInSettings, { passive: true });
        container.addEventListener('touchmove', showControlsIfNotInSettings, { passive: true });

        // Also listen on document for remote control navigation on TV
        document.addEventListener('keydown', showControlsIfNotInSettings);

        // Initialize settings values
        this.updateSettingsUI();
    }

    updateSettingsUI() {
        const transitionEffect = document.getElementById('transitionEffect');
        const slideDuration = document.getElementById('slideDuration');
        const slideDurationValue = document.getElementById('slideDurationValue');
        const transitionSpeed = document.getElementById('transitionSpeed');
        const transitionSpeedValue = document.getElementById('transitionSpeedValue');
        const playOrder = document.getElementById('playOrder');
        const loopSlideshow = document.getElementById('loopSlideshow');
        const imageFit = document.getElementById('imageFit');
        const backgroundColor = document.getElementById('backgroundColor');
        const showCounter = document.getElementById('showCounter');
        const showControls = document.getElementById('showControls');

        transitionEffect.value = this.slideshowSettings.transitionEffect;
        slideDuration.value = this.slideshowSettings.slideDuration / 1000;
        slideDurationValue.textContent = `${this.slideshowSettings.slideDuration / 1000}s`;
        transitionSpeed.value = this.slideshowSettings.transitionSpeed;
        transitionSpeedValue.textContent = `${(this.slideshowSettings.transitionSpeed / 1000).toFixed(1)}s`;
        playOrder.value = this.slideshowSettings.playOrder;
        loopSlideshow.checked = this.slideshowSettings.loopSlideshow;
        imageFit.value = this.slideshowSettings.imageFit;
        backgroundColor.value = this.slideshowSettings.backgroundColor;
        showCounter.checked = this.slideshowSettings.showCounter;
        showControls.checked = this.slideshowSettings.showControls;

        this.applyTransitionSpeed();
        this.applyImageFit();
        this.applyBackgroundColor();
        this.applyShowCounter();
        this.applyShowControls();
    }

    applyTransitionSpeed() {
        const slide = document.getElementById('currentSlide');
        slide.style.setProperty('--transition-speed', `${this.slideshowSettings.transitionSpeed}ms`);
    }

    applyImageFit() {
        const slide = document.getElementById('currentSlide');
        const media = slide.querySelector('img, video');
        if (media) {
            media.style.objectFit = this.slideshowSettings.imageFit;
        }
    }

    applyBackgroundColor() {
        const container = document.getElementById('slideshowContainer');
        container.style.backgroundColor = this.slideshowSettings.backgroundColor;
    }

    applyShowCounter() {
        const info = document.getElementById('slideshowInfo');
        info.style.display = this.slideshowSettings.showCounter ? 'block' : 'none';
    }

    applyShowControls() {
        const controls = document.getElementById('slideshowControls');
        const zoomControls = document.getElementById('zoomControls');
        // Keep settings button always visible so user can re-enable controls
        // const settingsBtn = document.getElementById('slideshowSettingsBtn');

        if (!this.slideshowSettings.showControls) {
            controls.style.display = 'none';
            zoomControls.style.display = 'none';
        } else {
            controls.style.display = '';
            zoomControls.style.display = '';
        }
    }

    showControls() {
        const controls = document.getElementById('slideshowControls');
        const info = document.getElementById('slideshowInfo');
        const zoomControls = document.getElementById('zoomControls');
        const settingsBtn = document.getElementById('slideshowSettingsBtn');

        controls.classList.add('visible');
        info.classList.add('visible');
        zoomControls.classList.add('visible');
        settingsBtn.classList.add('visible');

        // Don't set auto-hide timeout if settings panel is open
        if (this.isSettingsPanelOpen) {
            return;
        }

        // Debounce: only reset timeout if last interaction was more than 500ms ago
        const now = Date.now();
        if (this.lastControlsInteraction && (now - this.lastControlsInteraction) < 500) {
            return;
        }
        this.lastControlsInteraction = now;

        // Clear existing timeout and set new one
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }

        // Hide controls after 3 seconds
        this.controlsTimeout = setTimeout(() => {
            this.controlsTimeout = null;
            if (this.isSettingsPanelOpen) {
                return;
            }
            controls.classList.remove('visible');
            info.classList.remove('visible');
            zoomControls.classList.remove('visible');
            settingsBtn.classList.remove('visible');
        }, 3000);
    }

    async loadMedia() {
        const allMedia = await this.db.getAllMedia();

        // Get category filter from URL if provided
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');

        if (category && category !== 'all') {
            this.mediaItems = allMedia.filter(item => item.category === category);
        } else {
            this.mediaItems = allMedia;
        }

        // Sort by upload date
        this.mediaItems.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
    }

    async loadSettings() {
        try {
            const duration = await this.db.getSetting('slideDuration');
            if (duration) {
                this.slideshowSettings.slideDuration = duration;
            }

            const transitionEffect = await this.db.getSetting('transitionEffect');
            if (transitionEffect) {
                this.slideshowSettings.transitionEffect = transitionEffect;
            }

            const transitionSpeed = await this.db.getSetting('transitionSpeed');
            if (transitionSpeed) {
                this.slideshowSettings.transitionSpeed = transitionSpeed;
            }

            const playOrder = await this.db.getSetting('playOrder');
            if (playOrder) {
                this.slideshowSettings.playOrder = playOrder;
            }

            const loopSlideshow = await this.db.getSetting('loopSlideshow');
            if (loopSlideshow !== null && loopSlideshow !== undefined) {
                this.slideshowSettings.loopSlideshow = loopSlideshow;
            }

            const imageFit = await this.db.getSetting('imageFit');
            if (imageFit) {
                this.slideshowSettings.imageFit = imageFit;
            }

            const backgroundColor = await this.db.getSetting('backgroundColor');
            if (backgroundColor) {
                this.slideshowSettings.backgroundColor = backgroundColor;
            }

            const showCounter = await this.db.getSetting('showCounter');
            if (showCounter !== null && showCounter !== undefined) {
                this.slideshowSettings.showCounter = showCounter;
            }

            const showControls = await this.db.getSetting('showControls');
            if (showControls !== null && showControls !== undefined) {
                this.slideshowSettings.showControls = showControls;
            }
        } catch (e) {
            console.log('Sử dụng cài đặt mặc định');
        }
    }

    async saveSettings() {
        try {
            if (this.useServer) {
                // Server mode - save to server
                await api.updateSettings({
                    slideDuration: this.slideshowSettings.slideDuration,
                    transitionEffect: this.slideshowSettings.transitionEffect,
                    transitionSpeed: this.slideshowSettings.transitionSpeed,
                    playOrder: this.slideshowSettings.playOrder,
                    loopSlideshow: this.slideshowSettings.loopSlideshow,
                    imageFit: this.slideshowSettings.imageFit,
                    backgroundColor: this.slideshowSettings.backgroundColor,
                    showCounter: this.slideshowSettings.showCounter,
                    showControls: this.slideshowSettings.showControls
                });
            } else {
                // Local mode - save to IndexedDB
                await this.db.saveSetting('slideDuration', this.slideshowSettings.slideDuration);
                await this.db.saveSetting('transitionEffect', this.slideshowSettings.transitionEffect);
                await this.db.saveSetting('transitionSpeed', this.slideshowSettings.transitionSpeed);
                await this.db.saveSetting('playOrder', this.slideshowSettings.playOrder);
                await this.db.saveSetting('loopSlideshow', this.slideshowSettings.loopSlideshow);
                await this.db.saveSetting('imageFit', this.slideshowSettings.imageFit);
                await this.db.saveSetting('backgroundColor', this.slideshowSettings.backgroundColor);
                await this.db.saveSetting('showCounter', this.slideshowSettings.showCounter);
                await this.db.saveSetting('showControls', this.slideshowSettings.showControls);
            }
        } catch (e) {
            console.log('Không thể lưu cài đặt:', e);
        }
    }

    async refreshMedia() {
        const previousCount = this.mediaItems.length;

        if (this.useServer) {
            await this.loadFromServer();
        } else {
            await this.loadMedia();
        }

        // If media changed, update display
        if (this.mediaItems.length !== previousCount) {
            if (this.mediaItems.length === 0) {
                this.stopSlideshow();
                this.showEmptyState();
            } else if (previousCount === 0) {
                this.hideEmptyState();
                this.hideLoading();
                this.initControls();
                this.startSlideshow();
            } else {
                // Adjust current index if needed
                if (this.currentIndex >= this.mediaItems.length) {
                    this.currentIndex = 0;
                }
                this.updateCounter();
            }
        }
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    showEmptyState() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('slideshowContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
    }

    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('slideshowContainer').style.display = 'flex';
    }

    startSlideshow() {
        if (this.mediaItems.length === 0) return;

        this.isPlaying = true;
        this.updatePlayPauseButton();
        this.showSlide(this.currentIndex);
        // Show controls initially then auto-hide after 3s
        this.showControls();
    }

    stopSlideshow() {
        this.isPlaying = false;
        this.updatePlayPauseButton();
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
            this.slideshowInterval = null;
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.stopSlideshow();
        } else {
            this.isPlaying = true;
            this.updatePlayPauseButton();
            this.scheduleNextSlide();
        }
    }

    updatePlayPauseButton() {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');

        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    showSlide(index) {
        if (this.mediaItems.length === 0) return;

        const media = this.mediaItems[index];
        const slideContainer = document.getElementById('currentSlide');

        // Clean up previous blob URL (only for local mode)
        if (!this.useServer) {
            this.cleanupCurrentSlide();
        }

        // Reset zoom
        this.currentZoom = 1;

        // Get media URL
        let blobURL;
        if (this.useServer) {
            blobURL = api.getMediaURL(media);
        } else {
            blobURL = this.db.createBlobURL(media.blob);
            this.blobURLs.set(media.id, blobURL);
        }

        // Apply transition effect
        this.applyTransitionEffect(slideContainer, 'out');

        setTimeout(() => {
            if (media.type === 'video') {
                this.showVideo(slideContainer, blobURL, media);
            } else {
                this.showImage(slideContainer, blobURL, media);
            }

            this.applyTransitionEffect(slideContainer, 'in');
            this.updateCounter();
        }, this.slideshowSettings.transitionSpeed);
    }

    applyTransitionEffect(container, direction) {
        const effect = this.slideshowSettings.transitionEffect;

        // Remove all transition classes
        container.classList.remove(
            'fade-in', 'fade-out',
            'slide-in-right', 'slide-out-left',
            'zoom-in', 'zoom-out',
            'flip-in', 'flip-out',
            'blur-in', 'blur-out',
            'rotate-in', 'rotate-out'
        );

        if (direction === 'out') {
            switch (effect) {
                case 'fade':
                    container.classList.add('fade-out');
                    break;
                case 'slide':
                    container.classList.add('slide-out-left');
                    break;
                case 'zoom':
                    container.classList.add('zoom-out');
                    break;
                case 'flip':
                    container.classList.add('flip-out');
                    break;
                case 'blur':
                    container.classList.add('blur-out');
                    break;
                case 'rotate':
                    container.classList.add('rotate-out');
                    break;
            }
        } else {
            switch (effect) {
                case 'fade':
                    container.classList.add('fade-in');
                    break;
                case 'slide':
                    container.classList.add('slide-in-right');
                    break;
                case 'zoom':
                    container.classList.add('zoom-in');
                    break;
                case 'flip':
                    container.classList.add('flip-in');
                    break;
                case 'blur':
                    container.classList.add('blur-in');
                    break;
                case 'rotate':
                    container.classList.add('rotate-in');
                    break;
            }
        }
    }

    showImage(container, blobURL, media) {
        const imageFit = this.slideshowSettings.imageFit;
        container.innerHTML = `<img src="${blobURL}" alt="${media.name}" style="transform: scale(${this.currentZoom}); object-fit: ${imageFit}">`;

        // Schedule next slide if playing
        if (this.isPlaying) {
            this.scheduleNextSlide();
        }
    }

    showVideo(container, blobURL, media) {
        const loopCount = media.loopCount || 1;
        this.currentVideoLoopCount = 0;
        const imageFit = this.slideshowSettings.imageFit;

        container.innerHTML = `
            <video id="slideshowVideo" autoplay playsinline style="transform: scale(${this.currentZoom}); object-fit: ${imageFit}">
                <source src="${blobURL}" type="${media.mimeType || 'video/mp4'}">
            </video>
        `;

        const video = document.getElementById('slideshowVideo');

        video.addEventListener('ended', () => {
            this.currentVideoLoopCount++;

            if (this.currentVideoLoopCount < loopCount) {
                video.currentTime = 0;
                video.play();
            } else if (this.isPlaying) {
                this.nextSlide();
            }
        });

        video.addEventListener('error', () => {
            console.error('Lỗi phát video:', media.name);
            if (this.isPlaying) {
                this.nextSlide();
            }
        });
    }

    scheduleNextSlide() {
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
        }

        this.slideshowInterval = setTimeout(() => {
            if (this.isPlaying) {
                this.nextSlide();
            }
        }, this.slideshowSettings.slideDuration);
    }

    previousSlide() {
        if (this.mediaItems.length === 0) return;

        if (this.slideshowSettings.playOrder === 'random') {
            this.currentIndex = Math.floor(Math.random() * this.mediaItems.length);
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.mediaItems.length) % this.mediaItems.length;
        }
        this.showSlide(this.currentIndex);
    }

    nextSlide() {
        if (this.mediaItems.length === 0) return;

        if (this.slideshowSettings.playOrder === 'random') {
            // Random mode - pick random slide
            this.currentIndex = Math.floor(Math.random() * this.mediaItems.length);
        } else {
            // Sequential mode
            const nextIndex = this.currentIndex + 1;

            // Check if we've reached the end
            if (nextIndex >= this.mediaItems.length) {
                if (this.slideshowSettings.loopSlideshow) {
                    this.currentIndex = 0; // Loop back to beginning
                } else {
                    this.stopSlideshow(); // Stop at the end
                    return;
                }
            } else {
                this.currentIndex = nextIndex;
            }
        }
        this.showSlide(this.currentIndex);
    }

    // Zoom controls
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom + 0.25, 3);
        this.applyZoom();
    }

    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom - 0.25, 0.5);
        this.applyZoom();
    }

    zoomReset() {
        this.currentZoom = 1;
        this.applyZoom();
    }

    applyZoom() {
        const slide = document.getElementById('currentSlide');
        const media = slide.querySelector('img, video');
        if (media) {
            media.style.transform = `scale(${this.currentZoom})`;
        }
    }

    updateCounter() {
        const counter = document.getElementById('slideCounter');
        counter.textContent = `${this.currentIndex + 1} / ${this.mediaItems.length}`;

        // Update video loop setting visibility
        this.updateVideoLoopSetting();
    }

    updateVideoLoopSetting() {
        const videoLoopSetting = document.getElementById('videoLoopSetting');
        const videoLoopCount = document.getElementById('videoLoopCount');
        const videoLoopValue = document.getElementById('videoLoopValue');

        if (this.mediaItems.length > 0) {
            const currentMedia = this.mediaItems[this.currentIndex];
            if (currentMedia.type === 'video') {
                videoLoopSetting.style.display = 'block';
                const loopCount = currentMedia.loopCount || 1;
                videoLoopCount.value = loopCount;
                videoLoopValue.textContent = loopCount;
            } else {
                videoLoopSetting.style.display = 'none';
            }
        } else {
            videoLoopSetting.style.display = 'none';
        }
    }

    async saveCurrentVideoLoop() {
        if (this.mediaItems.length === 0) return;

        const currentMedia = this.mediaItems[this.currentIndex];
        if (currentMedia.type !== 'video') return;

        const loopCount = parseInt(document.getElementById('videoLoopCount').value);
        currentMedia.loopCount = loopCount;

        try {
            await this.db.updateMedia(currentMedia);

            // Visual feedback
            const saveBtn = document.getElementById('saveVideoLoopBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Đã lưu!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 1500);
        } catch (error) {
            console.error('Lỗi khi lưu loop count:', error);
        }
    }

    cleanupCurrentSlide() {
        // Revoke all stored blob URLs
        for (const [id, url] of this.blobURLs) {
            this.db.revokeBlobURL(url);
        }
        this.blobURLs.clear();

        // Clear interval
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
        }
    }
}

// Initialize player
const slideshowPlayer = new SlideshowPlayer();
