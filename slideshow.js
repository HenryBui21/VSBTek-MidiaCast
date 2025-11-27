// Slideshow Player for TV/Display devices
// Server mode only - No authentication required

class SlideshowPlayer {
    constructor() {
        this.mediaItems = [];
        this.currentIndex = 0;
        this.isPlaying = false;
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
        this.lastInteractionTime = Date.now();
        this.controlsVisible = true;
        this.hasUserInteracted = false;
        this.isProcessingUnmute = false;
        this.currentVideoElement = null; // Track current video element
        this.isTransitioning = false; // Prevent overlapping transitions
        this.nextVideoPreloadTimeout = null; // Timeout for preloading next video
        this.isTogglingPlayPause = false; // Prevent rapid play/pause clicks

        this.init();
    }

    async init() {
        try {
            // Check if API server is available
            if (typeof api !== 'undefined') {
                const isAvailable = await api.checkAvailability();
                if (!isAvailable) {
                    this.showEmptyState('Không thể kết nối đến server. Vui lòng đảm bảo server đang chạy!');
                    return;
                }
            }

            // Load from server
            await this.loadFromServer();

            if (this.mediaItems.length > 0) {
                this.hideLoading();
                this.initControls();
                this.startSlideshow();
            } else {
                this.showEmptyState();
            }

            // Auto-refresh media every 30 seconds to sync
            setInterval(() => this.refreshMedia(), 30000);

            // Auto-hide controls checker - runs every second
            setInterval(() => this.checkAutoHideControls(), 1000);

        } catch (error) {
            console.error('Lỗi khởi tạo slideshow:', error);
            this.showEmptyState('Có lỗi xảy ra. Vui lòng kiểm tra kết nối server!');
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
            throw e;
        }
    }

    initControls() {
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

            if (!this.isSettingsPanelOpen) {
                this.lastInteractionTime = Date.now();
            }
        });

        settingsPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        settingsPanel.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });

        transitionEffect.addEventListener('change', (e) => {
            this.slideshowSettings.transitionEffect = e.target.value;
            this.saveSettings();
        });

        slideDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.slideshowSettings.slideDuration = value * 1000;
            slideDurationValue.textContent = `${value}s`;
            this.saveSettings();

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
                    this.lastInteractionTime = Date.now();
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

        // Show controls on user interaction
        const container = document.getElementById('slideshowContainer');

        const handleUserInteraction = (event) => {
            // Mark that user has interacted (for autoplay with sound)
            if (!this.hasUserInteracted && !this.isProcessingUnmute) {
                this.hasUserInteracted = true;
                this.isProcessingUnmute = true;
                console.log('User interaction detected, audio autoplay enabled');

                // Handle current video for mobile compatibility
                if (this.currentVideoElement && this.currentVideoElement.muted) {
                    console.log('Enabling audio for current video');

                    // Check if video is actually playing before interfering
                    const wasPlaying = !this.currentVideoElement.paused;

                    // Only manipulate playback if video was actually playing
                    if (wasPlaying) {
                        // Mobile-safe approach: pause, unmute, then play in same synchronous block
                        this.currentVideoElement.pause();
                        this.currentVideoElement.muted = false;

                        // Play immediately - must be synchronous with user gesture
                        const playPromise = this.currentVideoElement.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                this.isProcessingUnmute = false;
                            }).catch((error) => {
                                console.warn('Could not play video with audio:', error);
                                // Fallback: stay muted for this video
                                this.currentVideoElement.muted = true;
                                this.currentVideoElement.play().catch((err) => {
                                    console.error('Video playback failed completely:', err);
                                }).finally(() => {
                                    this.isProcessingUnmute = false;
                                });
                            });
                        } else {
                            this.isProcessingUnmute = false;
                        }
                    } else {
                        // Video is paused/loading, just unmute it for when it starts
                        this.currentVideoElement.muted = false;
                        this.isProcessingUnmute = false;
                    }
                } else {
                    this.isProcessingUnmute = false;
                }
            }

            if (!this.isSettingsPanelOpen) {
                this.showControls();
            }
        };

        container.addEventListener('click', handleUserInteraction);
        // Remove passive flag to ensure touch is treated as user gesture for media playback
        // Only use touchstart (not touchend) to avoid duplicate events on mobile
        container.addEventListener('touchstart', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);

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

        this.controlsVisible = true;
        this.lastInteractionTime = Date.now();
    }

    checkAutoHideControls() {
        if (this.isSettingsPanelOpen) {
            return;
        }

        if (!this.controlsVisible) {
            return;
        }

        const now = Date.now();
        if (now - this.lastInteractionTime >= 3000) {
            this.hideControls();
        }
    }

    hideControls() {
        const controls = document.getElementById('slideshowControls');
        const info = document.getElementById('slideshowInfo');
        const zoomControls = document.getElementById('zoomControls');
        const settingsBtn = document.getElementById('slideshowSettingsBtn');

        controls.classList.remove('visible');
        info.classList.remove('visible');
        zoomControls.classList.remove('visible');
        settingsBtn.classList.remove('visible');

        this.controlsVisible = false;
    }

    async saveSettings() {
        try {
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
        } catch (e) {
            console.log('Không thể lưu cài đặt:', e);
        }
    }

    async refreshMedia() {
        const previousCount = this.mediaItems.length;

        try {
            await this.loadFromServer();

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
                    if (this.currentIndex >= this.mediaItems.length) {
                        this.currentIndex = 0;
                    }
                    this.updateCounter();
                }
            }
        } catch (e) {
            console.error('Lỗi refresh media:', e);
        }
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    showEmptyState(message = 'Chưa có media nào. Hãy thêm media từ trang quản lý!') {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('slideshowContainer').style.display = 'none';
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'flex';
        const emptyMessage = emptyState.querySelector('p');
        if (emptyMessage) {
            emptyMessage.textContent = message;
        }
    }

    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('slideshowContainer').style.display = 'flex';
    }

    startSlideshow() {
        if (this.mediaItems.length === 0) return;

        console.log('Starting slideshow with', this.mediaItems.length, 'items');
        this.isPlaying = true;
        this.updatePlayPauseButton();
        this.showSlide(this.currentIndex);
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
        // Prevent rapid clicking
        if (this.isTogglingPlayPause) {
            console.log('Play/pause already in progress, ignoring click');
            return;
        }

        this.isTogglingPlayPause = true;

        try {
            if (this.isPlaying) {
                // Pause slideshow
                console.log('Pausing slideshow');
                this.stopSlideshow();

                // Pause current video if it exists and is playing
                if (this.currentVideoElement && !this.currentVideoElement.paused) {
                    console.log('Pausing current video');
                    this.currentVideoElement.pause();
                }
            } else {
                // Resume slideshow
                console.log('Resuming slideshow');
                this.isPlaying = true;
                this.updatePlayPauseButton();

                // Check if current slide is a video
                if (this.currentVideoElement) {
                    // We have a video - resume it if paused
                    if (this.currentVideoElement.paused) {
                        console.log('Resuming paused video');
                        const playPromise = this.currentVideoElement.play();
                        if (playPromise !== undefined) {
                            playPromise.catch((error) => {
                                console.error('Could not resume video:', error);
                                // If video can't play, skip to next slide
                                this.nextSlide();
                            });
                        }
                    } else {
                        console.log('Video already playing, no action needed');
                    }
                    // Note: Video handles its own timing via 'ended' event
                    // We don't call scheduleNextSlide() for videos
                } else {
                    // Current slide is an image - schedule next slide transition
                    console.log('Resuming image slideshow');
                    this.scheduleNextSlide();
                }
            }
        } finally {
            // Allow next toggle after a short delay to prevent double-clicks
            setTimeout(() => {
                this.isTogglingPlayPause = false;
            }, 300);
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

        // Prevent overlapping transitions
        if (this.isTransitioning) {
            console.log('Transition already in progress, skipping...');
            return;
        }
        this.isTransitioning = true;

        const media = this.mediaItems[index];
        const slideContainer = document.getElementById('currentSlide');

        // Reset zoom
        this.currentZoom = 1;

        // Get media URL from server
        const mediaURL = api.getMediaURL(media);

        // Clear any pending slide transitions
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
            this.slideshowInterval = null;
        }

        // CRITICAL: Stop and cleanup current video before transition
        this.cleanupCurrentVideo();

        // Apply transition effect
        this.applyTransitionEffect(slideContainer, 'out');

        setTimeout(() => {
            if (media.type === 'video') {
                this.showVideo(slideContainer, mediaURL, media);
            } else {
                this.showImage(slideContainer, mediaURL, media);
            }

            this.applyTransitionEffect(slideContainer, 'in');
            this.updateCounter();

            // Reset transitioning flag after media is loaded
            // This prevents rapid clicks during transition
            this.isTransitioning = false;
        }, this.slideshowSettings.transitionSpeed);
    }

    applyTransitionEffect(container, direction) {
        const effect = this.slideshowSettings.transitionEffect;

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

    showImage(container, mediaURL, media) {
        const imageFit = this.slideshowSettings.imageFit;
        const img = document.createElement('img');
        img.src = mediaURL;
        img.alt = media.name;
        img.style.transform = `scale(${this.currentZoom})`;
        img.style.objectFit = imageFit;

        // Clear container safely
        container.innerHTML = '';
        container.appendChild(img);

        // Clear reference to video since we're showing image
        this.currentVideoElement = null;

        // Always schedule next slide if playing, regardless of how we got here
        if (this.isPlaying) {
            console.log('Image loaded, scheduling next slide in', this.slideshowSettings.slideDuration, 'ms');
            this.scheduleNextSlide();
        }
    }

    showVideo(container, mediaURL, media) {
        const loopCount = media.loopCount || 1;
        this.currentVideoLoopCount = 0;
        const imageFit = this.slideshowSettings.imageFit;

        const video = document.createElement('video');
        video.id = 'slideshowVideo';
        video.playsInline = true;
        // Start muted if no user interaction yet, unmuted if user has interacted
        video.muted = !this.hasUserInteracted;

        // Set explicit dimensions for better TV compatibility
        const containerWidth = container.clientWidth || window.innerWidth;
        const containerHeight = container.clientHeight || window.innerHeight;

        // CRITICAL FOR OLD TV: Set both attributes AND inline styles
        video.setAttribute('width', containerWidth);
        video.setAttribute('height', containerHeight);

        // Explicit inline styles for maximum compatibility
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.display = 'block';  // Ensure video is visible
        video.style.position = 'relative'; // Help with layout
        video.style.backgroundColor = '#000'; // Black background for video area

        // Apply object-fit with fallback for older browsers
        video.style.objectFit = imageFit;

        // Only apply transform if zoom is not default (avoid unnecessary GPU operations on old TVs)
        if (this.currentZoom !== 1) {
            video.style.transform = `scale(${this.currentZoom})`;
        } else {
            // Explicitly clear transform for old TVs - don't use translateZ hack
            video.style.transform = 'none';
        }

        // Use simple HTML5 attributes for better TV browser compatibility
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('preload', 'auto');

        // CRITICAL FOR OLD TV: Set src directly on video element instead of using <source>
        // Older TV browsers have better compatibility with direct src attribute
        video.src = mediaURL;
        if (media.mimeType) {
            video.setAttribute('type', media.mimeType);
        }

        // Clear container safely
        container.innerHTML = '';
        container.appendChild(video);

        // Store reference to current video
        this.currentVideoElement = video;

        // CRITICAL: Call load() after appending to DOM for old TV browsers
        // This ensures the video element properly initializes and starts loading
        try {
            video.load();
        } catch (e) {
            console.warn('Video load failed:', e);
        }

        // Apply object-fit polyfill for older TV browsers that don't support it
        this.applyObjectFitPolyfill(video, imageFit, containerWidth, containerHeight);

        // Video event handlers for older TV browsers
        video.addEventListener('loadeddata', () => {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay was blocked, fallback to muted
                    if (!video.muted) {
                        video.muted = true;
                        video.play().catch(() => {
                            console.error('Video playback failed');
                        });
                    }
                });
            }
        }, { once: true });

        // Fallback: If video doesn't load within 3 seconds on old TV, try force play
        setTimeout(() => {
            if (this.currentVideoElement === video && video.paused && video.readyState >= 2) {
                video.play().catch(() => {});
            }
        }, 3000);

        video.addEventListener('ended', () => {
            // Check if this video is still the current one (prevent race condition)
            if (this.currentVideoElement !== video) {
                return;
            }

            this.currentVideoLoopCount++;

            if (this.currentVideoLoopCount < loopCount) {
                video.currentTime = 0;
                const replayPromise = video.play();
                if (replayPromise !== undefined) {
                    replayPromise.catch(() => {
                        // If replay fails, move to next slide
                        if (this.isPlaying && this.currentVideoElement === video) {
                            this.nextSlide();
                        }
                    });
                }
            } else if (this.isPlaying) {
                this.nextSlide();
            }
        });

        video.addEventListener('error', () => {
            // Check if this video is still the current one
            if (this.currentVideoElement !== video) {
                return;
            }
            if (this.isPlaying) {
                this.nextSlide();
            }
        });

        // Safety timeout for videos - force next slide if video doesn't end naturally
        const estimatedDuration = media.duration || 300;

        const setupSafetyTimeout = (duration) => {
            if (video._safetyTimeout) {
                clearTimeout(video._safetyTimeout);
            }
            const maxVideoDuration = duration * loopCount * 1000 + 5000;
            video._safetyTimeout = setTimeout(() => {
                if (this.currentVideoElement === video && this.isPlaying) {
                    this.nextSlide();
                }
            }, maxVideoDuration);
        };

        setupSafetyTimeout(estimatedDuration);

        // Update timeout once we have real duration
        video.addEventListener('loadedmetadata', () => {
            if (video.duration && video.duration !== Infinity && video.duration > 0) {
                setupSafetyTimeout(video.duration);
            }
        }, { once: true });
    }

    cleanupCurrentVideo() {
        // Clean up any existing video element to prevent overlapping playback
        if (this.currentVideoElement) {
            // Clear safety timeout
            if (this.currentVideoElement._safetyTimeout) {
                clearTimeout(this.currentVideoElement._safetyTimeout);
                this.currentVideoElement._safetyTimeout = null;
            }

            // Pause and remove all event listeners
            try {
                this.currentVideoElement.pause();
                this.currentVideoElement.src = '';
                this.currentVideoElement.load();

                // Remove from DOM if still attached
                if (this.currentVideoElement.parentNode) {
                    this.currentVideoElement.parentNode.removeChild(this.currentVideoElement);
                }
            } catch (e) {
                // Silently handle cleanup errors on old TVs
            }

            // Clear reference
            this.currentVideoElement = null;
        }
    }

    applyObjectFitPolyfill(videoElement, fitMode, containerWidth, containerHeight) {
        // Test if object-fit is supported
        if ('objectFit' in document.documentElement.style) {
            return;
        }

        // Polyfill for older TV browsers that don't support object-fit
        // Set default dimensions immediately to ensure video is visible
        videoElement.style.width = containerWidth + 'px';
        videoElement.style.height = containerHeight + 'px';
        videoElement.style.position = 'absolute';
        videoElement.style.top = '0';
        videoElement.style.left = '0';

        // Try to refine positioning once metadata loads (if it ever does)
        videoElement.addEventListener('loadedmetadata', () => {
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;

            if (!videoWidth || !videoHeight) {
                return;
            }

            const containerRatio = containerWidth / containerHeight;
            const videoRatio = videoWidth / videoHeight;

            let width, height, top, left;

            if (fitMode === 'contain') {
                // Contain: fit entire video inside container
                if (videoRatio > containerRatio) {
                    // Video is wider
                    width = containerWidth;
                    height = containerWidth / videoRatio;
                    top = (containerHeight - height) / 2;
                    left = 0;
                } else {
                    // Video is taller
                    height = containerHeight;
                    width = containerHeight * videoRatio;
                    top = 0;
                    left = (containerWidth - width) / 2;
                }
            } else if (fitMode === 'cover') {
                // Cover: fill entire container, crop video if needed
                if (videoRatio > containerRatio) {
                    // Video is wider
                    height = containerHeight;
                    width = containerHeight * videoRatio;
                    top = 0;
                    left = (containerWidth - width) / 2;
                } else {
                    // Video is taller
                    width = containerWidth;
                    height = containerWidth / videoRatio;
                    top = (containerHeight - height) / 2;
                    left = 0;
                }
            } else {
                // fill or stretch
                width = containerWidth;
                height = containerHeight;
                top = 0;
                left = 0;
            }

            // Apply calculated dimensions and position
            videoElement.style.width = width + 'px';
            videoElement.style.height = height + 'px';
            videoElement.style.position = 'absolute';
            videoElement.style.top = top + 'px';
            videoElement.style.left = left + 'px';
            videoElement.style.objectFit = '';
        }, { once: true });
    }

    scheduleNextSlide() {
        // Clear any existing scheduled transition
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
            this.slideshowInterval = null;
        }

        // Only schedule if playing
        // Note: We allow scheduling even during transition because showImage/showVideo
        // are called inside the transition callback and need to schedule the next slide
        if (!this.isPlaying) {
            return;
        }

        this.slideshowInterval = setTimeout(() => {
            // Double-check state before executing transition
            if (this.isPlaying && !this.isTransitioning) {
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
            this.currentIndex = Math.floor(Math.random() * this.mediaItems.length);
        } else {
            const nextIndex = this.currentIndex + 1;

            if (nextIndex >= this.mediaItems.length) {
                if (this.slideshowSettings.loopSlideshow) {
                    this.currentIndex = 0;
                } else {
                    this.stopSlideshow();
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
            // Only apply transform if zoom is not default
            if (this.currentZoom !== 1) {
                media.style.transform = `scale(${this.currentZoom})`;
            } else {
                // Remove transform when at default zoom for better TV compatibility
                media.style.transform = '';
            }
        }
    }

    updateCounter() {
        const counter = document.getElementById('slideCounter');
        counter.textContent = `${this.currentIndex + 1} / ${this.mediaItems.length}`;

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

        try {
            await api.updateMedia(currentMedia.id, { loopCount: loopCount });
            currentMedia.loopCount = loopCount;

            const saveBtn = document.getElementById('saveVideoLoopBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Đã lưu!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 1500);
        } catch (error) {
            console.error('Lỗi khi lưu loop count:', error);
            alert('Không thể lưu cài đặt loop!');
        }
    }
}

// Initialize player
const slideshowPlayer = new SlideshowPlayer();
