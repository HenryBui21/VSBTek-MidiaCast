class MediaCast {
    constructor() {
        this.mediaItems = [];
        this.categories = ['Chung', 'Sản phẩm', 'Sự kiện', 'Khuyến mãi'];
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.currentSlideIndex = 0;
        this.slideshowInterval = null;
        this.isPlaying = false;
        this.controlsTimeout = null;
        this.db = new DatabaseManager();
        this.blobURLs = new Map(); // Track blob URLs for cleanup
        this.currentVideoLoopCount = 0; // Track current video loop count
        this.isWaitingForVideo = false; // Flag to indicate waiting for video to finish
        this.currentZoom = 1; // Track current zoom level
        this.isAuthenticated = false; // Authentication status
        this.currentUser = null; // Current logged in user
        this.isInitialized = false; // Flag to prevent multiple initializations

        // Server mode - will be determined after checking API availability
        this.useServer = false;
        this.isAuthReady = false; // Flag to indicate auth system is ready
        this.initAuthPromise = null; // Promise for initAuth completion

        // Slideshow settings
        this.slideshowSettings = {
            transitionEffect: 'fade',
            slideDuration: 3000, // milliseconds
            transitionSpeed: 600, // milliseconds
            playOrder: 'sequential',
            autoPlay: true,
            loopSlideshow: true,
            imageFit: 'contain',
            backgroundColor: '#000000',
            showCounter: true,
            showControls: true
        };

        // Setup listeners first, then start auth initialization
        this.setupAuthListeners();
        this.initAuthPromise = this.initAuth();
    }

    async initApp() {
        try {
            // Check if API server is available
            if (typeof api !== 'undefined') {
                this.useServer = await api.checkAvailability();
            }

            if (this.useServer) {
                // Server mode - load from API
                await this.loadFromServer();
            } else {
                // Local mode - use IndexedDB
                await this.db.init();
                await this.migrateFromLocalStorage();
                await this.loadFromStorage();
            }

            // Only initialize event listeners once
            if (!this.isInitialized) {
                this.init();
                this.isInitialized = true;
            }

            this.renderCategorySelect();
            this.renderCategoryFilters();
            this.renderGallery();
        } catch (error) {
            console.error('Lỗi khi khởi tạo ứng dụng:', error);
            alert('Có lỗi khi khởi động ứng dụng. Vui lòng thử lại!');
        }
    }

    async loadFromServer() {
        try {
            this.mediaItems = await api.getAllMedia();
            this.categories = await api.getCategories();
            const settings = await api.getSettings();
            if (settings) {
                this.slideshowSettings = { ...this.slideshowSettings, ...settings };
            }
        } catch (e) {
            console.error('Lỗi khi tải từ server:', e);
        }
    }

    init() {
        // Upload area elements
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Category elements
        const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
        const categoryModal = document.getElementById('categoryModal');
        const closeCategoryModal = document.getElementById('closeCategoryModal');
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        const newCategoryInput = document.getElementById('newCategoryInput');

        // Search and filter elements
        const searchInput = document.getElementById('searchInput');

        // Gallery elements
        const clearAllBtn = document.getElementById('clearAllBtn');
        const slideshowBtn = document.getElementById('slideshowBtn');
        const shareLinkBtn = document.getElementById('shareLinkBtn');

        // Slideshow elements
        const slideshowModal = document.getElementById('slideshowModal');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const closeSlideshow = document.getElementById('closeSlideshow');

        // Slideshow settings elements
        const slideshowSettingsBtn = document.getElementById('slideshowSettingsBtn');
        const slideshowSettingsPanel = document.getElementById('slideshowSettingsPanel');
        const transitionEffect = document.getElementById('transitionEffect');
        const slideDuration = document.getElementById('slideDuration');
        const slideDurationValue = document.getElementById('slideDurationValue');
        const transitionSpeed = document.getElementById('transitionSpeed');
        const transitionSpeedValue = document.getElementById('transitionSpeedValue');

        // Upload area click
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = ''; // Reset input
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Category management
        manageCategoriesBtn.addEventListener('click', () => {
            this.openCategoryModal();
        });

        closeCategoryModal.addEventListener('click', () => {
            categoryModal.classList.remove('active');
        });

        addCategoryBtn.addEventListener('click', () => {
            const categoryName = newCategoryInput.value.trim();
            if (categoryName) {
                this.addCategory(categoryName);
                newCategoryInput.value = '';
            }
        });

        newCategoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const categoryName = newCategoryInput.value.trim();
                if (categoryName) {
                    this.addCategory(categoryName);
                    newCategoryInput.value = '';
                }
            }
        });

        // Search functionality
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderGallery();
        });

        // Gallery controls
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn xóa tất cả media?')) {
                this.clearAll();
            }
        });

        slideshowBtn.addEventListener('click', () => {
            if (this.mediaItems.length > 0) {
                this.openSlideshow();
            } else {
                alert('Chưa có media nào để trình chiếu!');
            }
        });

        // Slideshow controls
        prevBtn.addEventListener('click', () => this.previousSlide());
        nextBtn.addEventListener('click', () => this.nextSlide());
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        closeSlideshow.addEventListener('click', () => this.closeSlideshow());

        // Share link button
        shareLinkBtn.addEventListener('click', () => this.openShareLinkModal());
        this.initShareLinkListeners();

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');

        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomResetBtn.addEventListener('click', () => this.zoomReset());

        // Slideshow settings
        slideshowSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            slideshowSettingsPanel.classList.toggle('active');
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
        const saveVideoLoopBtn = document.getElementById('saveVideoLoopBtn');
        saveVideoLoopBtn.addEventListener('click', () => {
            this.saveCurrentVideoLoop();
        });

        // New settings controls
        const playOrder = document.getElementById('playOrder');
        const autoPlay = document.getElementById('autoPlay');
        const loopSlideshow = document.getElementById('loopSlideshow');
        const imageFit = document.getElementById('imageFit');
        const backgroundColor = document.getElementById('backgroundColor');
        const backgroundColorValue = document.getElementById('backgroundColorValue');
        const showCounter = document.getElementById('showCounter');

        playOrder.addEventListener('change', (e) => {
            this.slideshowSettings.playOrder = e.target.value;
            this.saveSettings();
        });

        autoPlay.addEventListener('change', (e) => {
            this.slideshowSettings.autoPlay = e.target.checked;
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
            backgroundColorValue.textContent = e.target.value;
            this.applyBackgroundColor();
            this.saveSettings();
        });

        showCounter.addEventListener('change', (e) => {
            this.slideshowSettings.showCounter = e.target.checked;
            this.applyShowCounter();
            this.saveSettings();
        });

        const showControls = document.getElementById('showControls');
        showControls.addEventListener('change', (e) => {
            this.slideshowSettings.showControls = e.target.checked;
            this.applyShowControls();
            this.saveSettings();
        });

        // Close settings panel when clicking outside
        slideshowModal.addEventListener('click', (e) => {
            if (!slideshowSettingsPanel.contains(e.target) &&
                !slideshowSettingsBtn.contains(e.target)) {
                slideshowSettingsPanel.classList.remove('active');
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (slideshowModal.classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.previousSlide();
                if (e.key === 'ArrowRight') this.nextSlide();
                if (e.key === ' ') {
                    e.preventDefault();
                    this.togglePlayPause();
                }
                if (e.key === 'Escape') this.closeSlideshow();
            }
        });
    }

    async handleFiles(files) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
        const selectedCategory = document.getElementById('uploadCategory').value;

        for (const file of Array.from(files)) {
            if (!validTypes.includes(file.type)) {
                alert(`File ${file.name} không được hỗ trợ!`);
                continue;
            }

            try {
                if (this.useServer) {
                    // Upload to server
                    await api.uploadMedia(file, selectedCategory);
                    await this.loadFromServer();
                } else {
                    // Local IndexedDB
                    const mediaItem = {
                        id: Date.now() + Math.random(),
                        name: file.name,
                        type: file.type.startsWith('image') ? 'image' : 'video',
                        category: selectedCategory,
                        blob: file,
                        mimeType: file.type,
                        uploadedAt: new Date().toISOString(),
                        videoLoopCount: 1
                    };

                    await this.db.addMedia(mediaItem);
                    await this.loadFromStorage();
                }
                this.renderGallery();
            } catch (error) {
                console.error('Lỗi khi thêm media:', error);
                alert(`Không thể thêm file ${file.name}`);
            }
        }
    }

    // Category Management
    renderCategorySelect() {
        const select = document.getElementById('uploadCategory');
        select.innerHTML = this.categories.map(cat =>
            `<option value="${cat}">${cat}</option>`
        ).join('');
    }

    renderCategoryFilters() {
        const container = document.getElementById('categoryFilters');
        const allBtn = `<button class="category-filter ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">Tất cả</button>`;
        const categoryBtns = this.categories.map(cat =>
            `<button class="category-filter ${this.currentCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`
        ).join('');

        container.innerHTML = allBtn + categoryBtns;

        // Add event listeners
        container.querySelectorAll('.category-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentCategory = btn.dataset.category;
                this.renderCategoryFilters();
                this.renderGallery();
            });
        });
    }

    openCategoryModal() {
        const modal = document.getElementById('categoryModal');
        modal.classList.add('active');
        this.renderCategoriesList();
    }

    renderCategoriesList() {
        const container = document.getElementById('categoriesList');

        container.innerHTML = this.categories.map(cat => {
            const count = this.mediaItems.filter(item => item.category === cat).length;
            const isDefault = cat === 'Chung';

            return `
                <div class="category-list-item">
                    <div>
                        <span class="category-list-name">${cat}</span>
                        <span class="category-list-count">(${count} media)</span>
                    </div>
                    <button class="category-delete-btn"
                            onclick="mediaApp.deleteCategory('${cat}')"
                            ${isDefault ? 'disabled' : ''}>
                        Xóa
                    </button>
                </div>
            `;
        }).join('');
    }

    async addCategory(categoryName) {
        if (this.categories.includes(categoryName)) {
            alert('Danh mục này đã tồn tại!');
            return;
        }

        if (this.useServer) {
            this.categories = await api.addCategory(categoryName);
        } else {
            this.categories.push(categoryName);
            await this.saveCategories();
        }
        this.renderCategorySelect();
        this.renderCategoryFilters();
        this.renderCategoriesList();
    }

    async deleteCategory(categoryName) {
        if (categoryName === 'Chung') {
            alert('Không thể xóa danh mục mặc định!');
            return;
        }

        const itemsInCategory = this.mediaItems.filter(item => item.category === categoryName);

        if (itemsInCategory.length > 0) {
            if (!confirm(`Có ${itemsInCategory.length} media trong danh mục này. Chuyển sang danh mục "Chung"?`)) {
                return;
            }
        }

        if (this.useServer) {
            this.categories = await api.deleteCategory(categoryName);
            await this.loadFromServer();
        } else {
            // Move items to "Chung"
            for (const item of this.mediaItems) {
                if (item.category === categoryName) {
                    item.category = 'Chung';
                    await this.db.updateMedia(item);
                }
            }
            this.categories = this.categories.filter(cat => cat !== categoryName);
            await this.saveCategories();
            await this.loadFromStorage();
        }
        this.renderCategorySelect();
        this.renderCategoryFilters();
        this.renderCategoriesList();
        this.renderGallery();
    }

    renderGallery() {
        const galleryGrid = document.getElementById('galleryGrid');

        // Clean up old blob URLs (only for local mode)
        if (!this.useServer) {
            this.blobURLs.forEach(url => URL.revokeObjectURL(url));
            this.blobURLs.clear();
        }

        // Filter items based on category and search
        let filteredItems = this.mediaItems;

        // Filter by category
        if (this.currentCategory !== 'all') {
            filteredItems = filteredItems.filter(item => item.category === this.currentCategory);
        }

        // Filter by search query
        if (this.searchQuery) {
            filteredItems = filteredItems.filter(item =>
                item.name.toLowerCase().includes(this.searchQuery)
            );
        }

        if (filteredItems.length === 0) {
            const message = this.mediaItems.length === 0
                ? 'Chưa có media nào. Hãy tải lên file đầu tiên!'
                : 'Không tìm thấy media nào phù hợp.';

            galleryGrid.innerHTML = `
                <div class="empty-state">
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        galleryGrid.innerHTML = filteredItems.map((item) => {
            const originalIndex = this.mediaItems.indexOf(item);
            let mediaURL;

            if (this.useServer) {
                // Server mode - use URL from server
                mediaURL = api.getMediaURL(item);
            } else {
                // Local mode - create blob URL
                mediaURL = URL.createObjectURL(item.blob);
                this.blobURLs.set(item.id, mediaURL);
            }

            const itemId = this.useServer ? `'${item.id}'` : item.id;

            return `
                <div class="media-item" data-id="${item.id}" onclick="mediaApp.viewMedia(${originalIndex})">
                    ${item.type === 'image'
                        ? `<img src="${mediaURL}" alt="${item.name}">`
                        : `<video src="${mediaURL}" muted></video>`
                    }
                    <div class="media-item-overlay">
                        <div class="media-item-info">
                            <div class="media-item-name">${item.name}</div>
                            <div class="media-item-category">${item.category}</div>
                        </div>
                    </div>
                    <div class="media-item-actions">
                        <button class="delete-btn" onclick="event.stopPropagation(); mediaApp.deleteMedia(${itemId})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async deleteMedia(id) {
        try {
            if (this.useServer) {
                await api.deleteMedia(id);
                await this.loadFromServer();
            } else {
                await this.db.deleteMedia(id);
                await this.loadFromStorage();
            }
            this.renderGallery();
            this.renderCategoryFilters();
        } catch (error) {
            console.error('Lỗi khi xóa media:', error);
            alert('Không thể xóa media!');
        }
    }

    async clearAll() {
        try {
            if (this.useServer) {
                await api.clearAllMedia();
                await this.loadFromServer();
            } else {
                await this.db.clearAllMedia();
                await this.loadFromStorage();
            }
            this.renderGallery();
            this.renderCategoryFilters();
        } catch (error) {
            console.error('Lỗi khi xóa tất cả media:', error);
            alert('Không thể xóa tất cả media!');
        }
    }

    viewMedia(index) {
        this.currentSlideIndex = index;
        this.openSlideshow();
    }

    openSlideshow() {
        const modal = document.getElementById('slideshowModal');
        modal.classList.add('active');
        this.loadSettings();
        this.applyTransitionSpeed();
        this.showSlide(this.currentSlideIndex);
        this.setupSlideshowControls();
    }

    closeSlideshow() {
        const modal = document.getElementById('slideshowModal');
        const settingsPanel = document.getElementById('slideshowSettingsPanel');
        modal.classList.remove('active');
        modal.classList.remove('show-controls');
        settingsPanel.classList.remove('active');
        this.stopSlideshow();
        this.clearControlsTimeout();

        // Reset zoom
        this.currentZoom = 1;

        // Pause any playing videos
        const videos = document.querySelectorAll('.slideshow-content video');
        videos.forEach(video => video.pause());

        // Clear slideshow content to free memory
        const content = document.getElementById('slideshowContent');
        content.innerHTML = '';
    }

    setupSlideshowControls() {
        const modal = document.getElementById('slideshowModal');

        // Show controls initially
        modal.classList.add('show-controls');
        this.resetControlsTimeout();

        // Show controls on mouse move
        modal.addEventListener('mousemove', () => {
            modal.classList.add('show-controls');
            this.resetControlsTimeout();
        });

        // Hide controls after 3 seconds of inactivity
        modal.addEventListener('mouseleave', () => {
            this.resetControlsTimeout();
        });
    }

    resetControlsTimeout() {
        const modal = document.getElementById('slideshowModal');
        this.clearControlsTimeout();

        this.controlsTimeout = setTimeout(() => {
            modal.classList.remove('show-controls');
        }, 3000);
    }

    clearControlsTimeout() {
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
            this.controlsTimeout = null;
        }
    }

    showSlide(index) {
        if (this.mediaItems.length === 0) return;

        this.currentSlideIndex = index;

        // Wrap around
        if (this.currentSlideIndex < 0) {
            this.currentSlideIndex = this.mediaItems.length - 1;
        }
        if (this.currentSlideIndex >= this.mediaItems.length) {
            this.currentSlideIndex = 0;
        }

        const item = this.mediaItems[this.currentSlideIndex];
        const content = document.getElementById('slideshowContent');
        const counter = document.getElementById('slideshowCounter');

        // Show/hide video loop setting
        this.updateVideoLoopSettingVisibility();

        // Get media URL
        let blobURL;
        if (this.useServer) {
            blobURL = api.getMediaURL(item);
        } else {
            // Reuse cached blob URL if available, otherwise create new one
            blobURL = this.blobURLs.get(item.id);
            if (!blobURL) {
                blobURL = URL.createObjectURL(item.blob);
                this.blobURLs.set(item.id, blobURL);
            }
        }

        // Update counter
        counter.textContent = `${this.currentSlideIndex + 1} / ${this.mediaItems.length}`;

        if (item.type === 'image') {
            // Preload image before showing
            const img = new Image();
            img.onload = () => {
                // Get existing elements
                const existingElements = content.querySelectorAll('img, video');

                // Create new image element with opacity 0
                const newImg = document.createElement('img');
                newImg.src = blobURL;
                newImg.alt = item.name;
                newImg.className = 'slideshow-media';
                newImg.style.opacity = '0';
                newImg.style.objectFit = this.slideshowSettings.imageFit;

                // Add to DOM
                content.appendChild(newImg);

                // Force reflow
                void newImg.offsetHeight;

                // Apply transition effect and fade in
                requestAnimationFrame(() => {
                    // Add transition effect class to content container
                    content.classList.remove('transition-fade', 'transition-slide', 'transition-zoom', 'transition-flip');
                    content.classList.add(`transition-${this.slideshowSettings.transitionEffect}`);

                    newImg.style.opacity = '1';

                    // Fade out and remove old elements
                    existingElements.forEach(el => {
                        el.style.opacity = '0';
                        setTimeout(() => {
                            if (el.parentNode === content) {
                                content.removeChild(el);
                            }
                        }, this.slideshowSettings.transitionSpeed);
                    });
                });
            };
            img.src = blobURL;
        } else {
            // Get existing elements
            const existingElements = content.querySelectorAll('img, video');

            // For videos
            const video = document.createElement('video');
            video.src = blobURL;
            video.controls = true;
            video.autoplay = true;
            video.className = 'slideshow-media';
            video.style.opacity = '0';
            video.style.objectFit = this.slideshowSettings.imageFit;

            // Get video loop count (default to 1 if not set)
            const loopCount = item.videoLoopCount || 1;
            this.currentVideoLoopCount = 0;

            // Handle video ended event
            video.addEventListener('ended', () => {
                this.currentVideoLoopCount++;

                if (this.currentVideoLoopCount < loopCount) {
                    // Play again if we haven't reached loop count
                    video.currentTime = 0;
                    video.play();
                } else {
                    // Move to next slide after all loops complete
                    if (this.isPlaying) {
                        this.nextSlide();
                    }
                }
            });

            content.appendChild(video);
            void video.offsetHeight;

            requestAnimationFrame(() => {
                // Add transition effect class to content container
                content.classList.remove('transition-fade', 'transition-slide', 'transition-zoom', 'transition-flip');
                content.classList.add(`transition-${this.slideshowSettings.transitionEffect}`);

                video.style.opacity = '1';

                // Fade out and remove old elements
                existingElements.forEach(el => {
                    if (el.tagName === 'VIDEO') {
                        el.pause();
                    }
                    el.style.opacity = '0';
                    setTimeout(() => {
                        if (el.parentNode === content) {
                            content.removeChild(el);
                        }
                    }, this.slideshowSettings.transitionSpeed);
                });
            });
        }
    }

    previousSlide() {
        this.currentZoom = 1; // Reset zoom when changing slide
        this.showSlide(this.currentSlideIndex - 1);
    }

    nextSlide() {
        this.currentZoom = 1; // Reset zoom when changing slide
        this.showSlide(this.currentSlideIndex + 1);
    }

    togglePlayPause() {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');

        if (this.isPlaying) {
            this.stopSlideshow();
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        } else {
            this.startSlideshow();
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        }
    }

    startSlideshow() {
        this.isPlaying = true;
        this.slideshowInterval = setInterval(() => {
            // Only auto-advance for images, not videos
            const currentItem = this.mediaItems[this.currentSlideIndex];
            if (currentItem && currentItem.type === 'image') {
                this.nextSlide();
            }
            // Videos will advance automatically when they finish (handled in showSlide)
        }, this.slideshowSettings.slideDuration);
    }

    stopSlideshow() {
        this.isPlaying = false;
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
        }
    }

    applyTransitionSpeed() {
        const content = document.getElementById('slideshowContent');
        content.style.setProperty('--transition-speed', `${this.slideshowSettings.transitionSpeed}ms`);
    }

    applyImageFit() {
        const content = document.getElementById('slideshowContent');
        const media = content?.querySelector('img, video');
        if (media) {
            media.style.objectFit = this.slideshowSettings.imageFit;
        }
    }

    applyBackgroundColor() {
        const modal = document.getElementById('slideshowModal');
        if (modal) {
            modal.style.backgroundColor = this.slideshowSettings.backgroundColor;
        }
    }

    applyShowCounter() {
        const counter = document.getElementById('slideshowCounter');
        if (counter) {
            counter.style.display = this.slideshowSettings.showCounter ? 'block' : 'none';
        }
    }

    applyShowControls() {
        const prevBtn = document.getElementById('slideshowPrevBtn');
        const nextBtn = document.getElementById('slideshowNextBtn');
        const playPauseBtn = document.getElementById('slideshowPlayPauseBtn');
        const zoomControls = document.querySelector('.slideshow-zoom-controls');
        // Keep settings button always visible so user can re-enable controls

        if (!this.slideshowSettings.showControls) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (playPauseBtn) playPauseBtn.style.display = 'none';
            if (zoomControls) zoomControls.style.display = 'none';
        } else {
            if (prevBtn) prevBtn.style.display = '';
            if (nextBtn) nextBtn.style.display = '';
            if (playPauseBtn) playPauseBtn.style.display = '';
            if (zoomControls) zoomControls.style.display = '';
        }
    }

    updateVideoLoopSettingVisibility() {
        const currentItem = this.mediaItems[this.currentSlideIndex];
        const videoLoopSetting = document.getElementById('videoLoopSetting');
        const currentVideoLoopCount = document.getElementById('currentVideoLoopCount');

        if (currentItem && currentItem.type === 'video') {
            videoLoopSetting.style.display = 'block';
            currentVideoLoopCount.value = currentItem.videoLoopCount || 1;
        } else {
            videoLoopSetting.style.display = 'none';
        }
    }

    async saveCurrentVideoLoop() {
        const currentItem = this.mediaItems[this.currentSlideIndex];
        if (!currentItem || currentItem.type !== 'video') return;

        const loopInput = document.getElementById('currentVideoLoopCount');
        const loopCount = parseInt(loopInput.value) || 1;

        if (loopCount < 1 || loopCount > 100) {
            alert('Số lần lặp phải từ 1 đến 100!');
            return;
        }

        currentItem.videoLoopCount = loopCount;
        await this.db.updateMedia(currentItem);
        await this.loadFromStorage();
        alert('Đã lưu cài đặt loop!');
    }

    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom + 0.25, 3); // Max zoom 3x
        this.applyZoom();
    }

    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom - 0.25, 0.5); // Min zoom 0.5x
        this.applyZoom();
    }

    zoomReset() {
        this.currentZoom = 1;
        this.applyZoom();
    }

    applyZoom() {
        const content = document.getElementById('slideshowContent');
        const media = content.querySelector('.slideshow-media');

        if (media) {
            media.style.transform = `scale(${this.currentZoom})`;
            media.style.transition = 'transform 0.3s ease';
        }
    }

    async saveSettings() {
        try {
            if (this.useServer) {
                await api.updateSettings(this.slideshowSettings);
            } else {
                await this.db.saveSetting('slideshow_settings', this.slideshowSettings);
            }
        } catch (e) {
            console.error('Lỗi khi lưu settings:', e);
        }
    }

    async loadSettings() {
        try {
            const stored = await this.db.getSetting('slideshow_settings');
            if (stored) {
                this.slideshowSettings = { ...this.slideshowSettings, ...stored };
            }

            // Update UI - Basic settings
            const transitionEffect = document.getElementById('transitionEffect');
            const slideDuration = document.getElementById('slideDuration');
            const slideDurationValue = document.getElementById('slideDurationValue');
            const transitionSpeed = document.getElementById('transitionSpeed');
            const transitionSpeedValue = document.getElementById('transitionSpeedValue');

            transitionEffect.value = this.slideshowSettings.transitionEffect;
            slideDuration.value = this.slideshowSettings.slideDuration / 1000;
            slideDurationValue.textContent = `${this.slideshowSettings.slideDuration / 1000}s`;
            transitionSpeed.value = this.slideshowSettings.transitionSpeed;
            transitionSpeedValue.textContent = `${(this.slideshowSettings.transitionSpeed / 1000).toFixed(1)}s`;

            // Update UI - New settings
            const playOrder = document.getElementById('playOrder');
            const autoPlay = document.getElementById('autoPlay');
            const loopSlideshow = document.getElementById('loopSlideshow');
            const imageFit = document.getElementById('imageFit');
            const backgroundColor = document.getElementById('backgroundColor');
            const backgroundColorValue = document.getElementById('backgroundColorValue');
            const showCounter = document.getElementById('showCounter');
            const showControls = document.getElementById('showControls');

            if (playOrder) playOrder.value = this.slideshowSettings.playOrder;
            if (autoPlay) autoPlay.checked = this.slideshowSettings.autoPlay;
            if (loopSlideshow) loopSlideshow.checked = this.slideshowSettings.loopSlideshow;
            if (imageFit) imageFit.value = this.slideshowSettings.imageFit;
            if (backgroundColor) backgroundColor.value = this.slideshowSettings.backgroundColor;
            if (backgroundColorValue) backgroundColorValue.textContent = this.slideshowSettings.backgroundColor;
            if (showCounter) showCounter.checked = this.slideshowSettings.showCounter;
            if (showControls) showControls.checked = this.slideshowSettings.showControls;
        } catch (e) {
            console.error('Lỗi khi tải settings:', e);
        }
    }

    async saveCategories() {
        try {
            await this.db.saveCategories(this.categories);
        } catch (e) {
            console.error('Lỗi khi lưu categories:', e);
        }
    }

    async loadFromStorage() {
        try {
            // Load media items
            this.mediaItems = await this.db.getAllMedia();

            // Migration: Add videoLoopCount to existing videos
            let needsUpdate = false;
            for (const item of this.mediaItems) {
                if (item.type === 'video' && !item.videoLoopCount) {
                    item.videoLoopCount = 1;
                    needsUpdate = true;
                }
            }

            // Save updates if needed
            if (needsUpdate) {
                for (const item of this.mediaItems) {
                    if (item.type === 'video' && item.videoLoopCount) {
                        await this.db.updateMedia(item);
                    }
                }
            }

            // Load categories
            const storedCategories = await this.db.getCategories();
            if (storedCategories && storedCategories.length > 0) {
                this.categories = storedCategories;
            }
        } catch (e) {
            console.error('Lỗi khi tải từ IndexedDB:', e);
        }
    }

    // Authentication methods
    async initAuth() {
        try {
            // Check if API server is available first
            if (typeof api !== 'undefined') {
                this.useServer = await api.checkAvailability();
            }

            if (!this.useServer) {
                await this.db.init();
            }

            this.isAuthReady = true; // Mark auth system as ready
            await this.checkUsersExist();
            await this.checkAuth();
        } catch (error) {
            console.error('Lỗi khởi tạo auth:', error);
            this.isAuthReady = true; // Still mark as ready so user can try again
            this.showLoginModal();
        }
    }

    async checkUsersExist() {
        // Check if any users exist, update login hint accordingly
        let usersCount;
        if (this.useServer) {
            usersCount = await api.getUsersCount();
        } else {
            // Ensure db is initialized
            if (!this.db.db) {
                await this.db.init();
            }
            usersCount = await this.db.getUsersCount();
        }
        const loginHint = document.getElementById('loginHint');
        if (usersCount === 0) {
            loginHint.textContent = 'Lần đầu sử dụng? Nhập thông tin để tạo tài khoản admin.';
        } else {
            loginHint.textContent = '';
        }
    }

    async checkAuth() {
        // Check if user is authenticated
        const sessionAuth = sessionStorage.getItem('mediacast_auth');
        const sessionUserId = sessionStorage.getItem('mediacast_user_id');

        if (sessionAuth === 'true' && sessionUserId) {
            let user = null;
            if (this.useServer) {
                // Server mode - get user from API
                try {
                    const users = await api.getAllUsers();
                    user = users.find(u => u.id === sessionUserId);
                } catch (e) {
                    console.error('Lỗi khi lấy user từ server:', e);
                }
            } else {
                // Local mode - get user from IndexedDB
                // Ensure db is initialized
                if (!this.db.db) {
                    await this.db.init();
                }
                user = await this.db.getUserById(parseInt(sessionUserId));
            }

            if (user) {
                this.isAuthenticated = true;
                this.currentUser = user;
                this.hideLoginModal();
                this.updateUserDisplay();
                await this.initApp();
                return;
            }
        }
        this.showLoginModal();
    }

    setupAuthListeners() {
        const loginForm = document.getElementById('loginForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const manageUsersBtn = document.getElementById('manageUsersBtn');
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        const headerLogo = document.getElementById('headerLogo');
        const userDropdownMenu = document.getElementById('userDropdownMenu');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        logoutBtn.addEventListener('click', () => {
            this.closeDropdownMenu();
            this.handleLogout();
        });

        // Logo click to toggle dropdown menu
        headerLogo.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdownMenu.contains(e.target) && e.target !== headerLogo) {
                userDropdownMenu.classList.remove('active');
            }
        });

        // User management listeners
        manageUsersBtn.addEventListener('click', () => {
            this.closeDropdownMenu();
            this.openUserModal();
        });

        changePasswordBtn.addEventListener('click', () => {
            this.closeDropdownMenu();
            this.openChangePasswordModal();
        });

        // User modal listeners
        document.getElementById('closeUserModal').addEventListener('click', () => {
            document.getElementById('userModal').classList.remove('active');
        });

        document.getElementById('addUserBtn').addEventListener('click', () => {
            this.addNewUser();
        });

        // Change password modal listeners
        document.getElementById('closeChangePasswordModal').addEventListener('click', () => {
            document.getElementById('changePasswordModal').classList.remove('active');
        });

        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

        // Edit user modal listeners
        document.getElementById('closeEditUserModal').addEventListener('click', () => {
            document.getElementById('editUserModal').classList.remove('active');
        });

        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditUser();
        });
    }

    async handleLogin() {
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            alert('Vui lòng nhập tên đăng nhập và mật khẩu!');
            return;
        }

        // Wait for auth system to be ready
        if (!this.isAuthReady) {
            if (this.initAuthPromise) {
                await this.initAuthPromise;
            }
            if (!this.isAuthReady) {
                alert('Hệ thống đang khởi tạo, vui lòng đợi...');
                return;
            }
        }

        try {
            const passwordHash = await this.hashPassword(password);

            if (this.useServer) {
                // Server mode - use API
                const result = await api.login(username, passwordHash);
                if (result.success) {
                    this.authenticateUser(result.user);
                    if (result.isNewUser) {
                        alert('Tài khoản admin đã được tạo thành công!');
                    }
                } else {
                    alert(result.error || 'Đăng nhập thất bại!');
                    if (result.error === 'Tên đăng nhập không tồn tại!') {
                        usernameInput.focus();
                    } else {
                        passwordInput.value = '';
                        passwordInput.focus();
                    }
                }
            } else {
                // Local mode - use IndexedDB
                // Ensure db is initialized
                if (!this.db.db) {
                    await this.db.init();
                }
                const usersCount = await this.db.getUsersCount();

                if (usersCount === 0) {
                    // First time setup - create admin user
                    const newUser = {
                        username: username,
                        passwordHash: passwordHash,
                        role: 'admin',
                        createdAt: new Date().toISOString()
                    };
                    await this.db.addUser(newUser);
                    const user = await this.db.getUserByUsername(username);
                    this.authenticateUser(user);
                    alert('Tài khoản admin đã được tạo thành công!');
                } else {
                    // Verify credentials
                    const user = await this.db.getUserByUsername(username);
                    if (!user) {
                        alert('Tên đăng nhập không tồn tại!');
                        usernameInput.focus();
                        return;
                    }

                    if (passwordHash === user.passwordHash) {
                        this.authenticateUser(user);
                    } else {
                        alert('Mật khẩu không đúng!');
                        passwordInput.value = '';
                        passwordInput.focus();
                    }
                }
            }
        } catch (error) {
            console.error('Lỗi khi xác thực:', error);
            alert('Có lỗi xảy ra khi đăng nhập!');
        }
    }

    async hashPassword(password) {
        // Check if crypto.subtle is available (requires secure context: HTTPS or localhost)
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback: Simple hash for non-secure contexts (HTTP)
            // Note: This is less secure but works on HTTP
            let hash = 0;
            for (let i = 0; i < password.length; i++) {
                const char = password.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            // Convert to hex and add salt for better security
            const salt = 'vsbtek_mediacast_2024';
            const saltedPassword = password + salt;
            let hash2 = 5381;
            for (let i = 0; i < saltedPassword.length; i++) {
                hash2 = ((hash2 << 5) + hash2) + saltedPassword.charCodeAt(i);
            }
            return Math.abs(hash).toString(16) + Math.abs(hash2).toString(16);
        }
    }

    authenticateUser(user) {
        this.isAuthenticated = true;
        this.currentUser = user;
        sessionStorage.setItem('mediacast_auth', 'true');
        sessionStorage.setItem('mediacast_user_id', user.id.toString());
        this.hideLoginModal();
        this.updateUserDisplay();
        this.initApp();
    }

    updateUserDisplay() {
        const currentUserSpan = document.getElementById('currentUser');
        const manageUsersBtn = document.getElementById('manageUsersBtn');

        if (this.currentUser) {
            const roleText = this.currentUser.role === 'admin' ? 'Admin' : 'User';
            currentUserSpan.textContent = `${this.currentUser.username} (${roleText})`;

            // Show manage users button only for admin
            if (this.currentUser.role === 'admin') {
                manageUsersBtn.style.display = 'inline-block';
            } else {
                manageUsersBtn.style.display = 'none';
            }
        }
    }

    handleLogout() {
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            this.isAuthenticated = false;
            this.currentUser = null;
            sessionStorage.removeItem('mediacast_auth');
            sessionStorage.removeItem('mediacast_user_id');
            this.showLoginModal();
            // Clear content
            document.getElementById('galleryGrid').innerHTML = '<div class="empty-state"><p>Vui lòng đăng nhập để xem nội dung</p></div>';
        }
    }

    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.add('active');
        document.body.classList.add('locked');
        // Focus on username input
        setTimeout(() => {
            document.getElementById('loginUsername').focus();
        }, 100);
    }

    hideLoginModal() {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.remove('active');
        document.body.classList.remove('locked');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    }

    // Dropdown Menu
    closeDropdownMenu() {
        document.getElementById('userDropdownMenu').classList.remove('active');
    }

    // Share Link Methods
    initShareLinkListeners() {
        const closeBtn = document.getElementById('closeShareLinkModal');
        const copyBtn = document.getElementById('copyLinkBtn');
        const openBtn = document.getElementById('openLinkBtn');
        const categorySelect = document.getElementById('shareLinkCategory');

        closeBtn.addEventListener('click', () => {
            document.getElementById('shareLinkModal').classList.remove('active');
        });

        copyBtn.addEventListener('click', async () => {
            const input = document.getElementById('shareLinkInput');
            try {
                await navigator.clipboard.writeText(input.value);
                // Visual feedback
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Đã sao chép!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            } catch (err) {
                // Fallback for older browsers
                input.select();
                document.execCommand('copy');
            }
        });

        openBtn.addEventListener('click', () => {
            const link = document.getElementById('shareLinkInput').value;
            window.open(link, '_blank');
        });

        categorySelect.addEventListener('change', () => {
            this.updateShareLink();
        });
    }

    openShareLinkModal() {
        const modal = document.getElementById('shareLinkModal');
        const categorySelect = document.getElementById('shareLinkCategory');

        // Populate category select
        categorySelect.innerHTML = '<option value="all">Tất cả</option>' +
            this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        // Generate initial link
        this.updateShareLink();

        modal.classList.add('active');
    }

    updateShareLink() {
        const category = document.getElementById('shareLinkCategory').value;
        const input = document.getElementById('shareLinkInput');

        // Build slideshow URL
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        let slideshowUrl = `${baseUrl}slideshow.html`;

        if (category !== 'all') {
            slideshowUrl += `?category=${encodeURIComponent(category)}`;
        }

        input.value = slideshowUrl;
    }

    // User Management Methods
    openUserModal() {
        if (this.currentUser?.role !== 'admin') {
            alert('Bạn không có quyền truy cập tính năng này!');
            return;
        }
        document.getElementById('userModal').classList.add('active');
        this.renderUsersList();
    }

    async renderUsersList() {
        const container = document.getElementById('usersList');
        const users = this.useServer ? await api.getAllUsers() : await this.db.getAllUsers();

        container.innerHTML = users.map(user => {
            const isCurrentUser = user.id === this.currentUser?.id;
            const roleClass = user.role === 'admin' ? 'admin' : 'user';
            const roleText = user.role === 'admin' ? 'Quản trị viên' : 'Người dùng';

            return `
                <div class="user-list-item">
                    <div class="user-info">
                        <span class="user-name">${user.username}</span>
                        <span class="user-role ${roleClass}">${roleText}</span>
                    </div>
                    <div class="user-actions">
                        <button class="user-edit-btn" onclick="mediaApp.openEditUserModal(${user.id})">
                            Sửa
                        </button>
                        <button class="user-delete-btn"
                                onclick="mediaApp.deleteUser(${user.id})"
                                ${isCurrentUser ? 'disabled title="Không thể xóa tài khoản đang đăng nhập"' : ''}>
                            Xóa
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async addNewUser() {
        const usernameInput = document.getElementById('newUsername');
        const passwordInput = document.getElementById('newUserPassword');
        const roleSelect = document.getElementById('newUserRole');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const role = roleSelect.value;

        if (!username || !password) {
            alert('Vui lòng nhập đầy đủ thông tin!');
            return;
        }

        if (username.length < 3) {
            alert('Tên đăng nhập phải có ít nhất 3 ký tự!');
            return;
        }

        if (password.length < 4) {
            alert('Mật khẩu phải có ít nhất 4 ký tự!');
            return;
        }

        try {
            const passwordHash = await this.hashPassword(password);
            const newUser = {
                username: username,
                passwordHash: passwordHash,
                role: role,
                createdAt: new Date().toISOString()
            };

            if (this.useServer) {
                await api.addUser(newUser);
            } else {
                // Check if username already exists (local mode)
                const existingUser = await this.db.getUserByUsername(username);
                if (existingUser) {
                    alert('Tên đăng nhập đã tồn tại!');
                    return;
                }
                await this.db.addUser(newUser);
            }

            // Clear inputs
            usernameInput.value = '';
            passwordInput.value = '';
            roleSelect.value = 'user';

            this.renderUsersList();
            alert('Đã thêm người dùng thành công!');
        } catch (error) {
            console.error('Lỗi khi thêm người dùng:', error);
            alert('Có lỗi xảy ra khi thêm người dùng!');
        }
    }

    async deleteUser(userId) {
        if (userId === this.currentUser?.id) {
            alert('Không thể xóa tài khoản đang đăng nhập!');
            return;
        }

        if (!confirm('Bạn có chắc muốn xóa người dùng này?')) {
            return;
        }

        try {
            if (this.useServer) {
                await api.deleteUser(userId);
            } else {
                await this.db.deleteUser(userId);
            }
            this.renderUsersList();
            alert('Đã xóa người dùng thành công!');
        } catch (error) {
            console.error('Lỗi khi xóa người dùng:', error);
            alert('Có lỗi xảy ra khi xóa người dùng!');
        }
    }

    async openEditUserModal(userId) {
        const user = this.useServer ? await api.getUserById(userId) : await this.db.getUserById(userId);
        if (!user) {
            alert('Không tìm thấy người dùng!');
            return;
        }

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editUserRole').value = user.role;
        document.getElementById('editUserPassword').value = '';

        document.getElementById('editUserModal').classList.add('active');
    }

    async handleEditUser() {
        const userId = parseInt(document.getElementById('editUserId').value);
        const role = document.getElementById('editUserRole').value;
        const newPassword = document.getElementById('editUserPassword').value;

        try {
            const user = this.useServer ? await api.getUserById(userId) : await this.db.getUserById(userId);
            if (!user) {
                alert('Không tìm thấy người dùng!');
                return;
            }

            user.role = role;

            if (newPassword) {
                if (newPassword.length < 4) {
                    alert('Mật khẩu phải có ít nhất 4 ký tự!');
                    return;
                }
                user.passwordHash = await this.hashPassword(newPassword);
            }

            if (this.useServer) {
                await api.updateUser(userId, { role: user.role, passwordHash: user.passwordHash });
            } else {
                await this.db.updateUser(user);
            }

            // Update current user if editing self
            if (userId === this.currentUser?.id) {
                this.currentUser = user;
                this.updateUserDisplay();
            }

            document.getElementById('editUserModal').classList.remove('active');
            this.renderUsersList();
            alert('Đã cập nhật người dùng thành công!');
        } catch (error) {
            console.error('Lỗi khi cập nhật người dùng:', error);
            alert('Có lỗi xảy ra khi cập nhật người dùng!');
        }
    }

    // Change Password Methods
    openChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.add('active');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    async handleChangePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('Mật khẩu mới không khớp!');
            return;
        }

        if (newPassword.length < 4) {
            alert('Mật khẩu mới phải có ít nhất 4 ký tự!');
            return;
        }

        try {
            // Verify current password
            const currentHash = await this.hashPassword(currentPassword);
            if (currentHash !== this.currentUser.passwordHash) {
                alert('Mật khẩu hiện tại không đúng!');
                return;
            }

            // Update password
            const newHash = await this.hashPassword(newPassword);
            this.currentUser.passwordHash = newHash;
            await this.db.updateUser(this.currentUser);

            document.getElementById('changePasswordModal').classList.remove('active');
            alert('Đã đổi mật khẩu thành công!');
        } catch (error) {
            console.error('Lỗi khi đổi mật khẩu:', error);
            alert('Có lỗi xảy ra khi đổi mật khẩu!');
        }
    }

    async migrateFromLocalStorage() {
        try {
            // Check if migration has already been done
            const migrated = await this.db.getSetting('migrated_from_localstorage');
            if (migrated) {
                return;
            }

            // Check if there's data in localStorage
            const storedItems = localStorage.getItem('mediacast_items');
            const storedCategories = localStorage.getItem('mediacast_categories');

            if (storedItems) {
                const items = JSON.parse(storedItems);

                for (const item of items) {
                    // Convert base64 data URL to Blob
                    if (item.data && item.data.startsWith('data:')) {
                        const response = await fetch(item.data);
                        const blob = await response.blob();

                        const newItem = {
                            id: item.id,
                            name: item.name,
                            type: item.type,
                            category: item.category || 'Chung',
                            blob: blob,
                            mimeType: blob.type,
                            uploadedAt: item.uploadedAt || new Date().toISOString()
                        };

                        await this.db.addMedia(newItem);
                    }
                }
            }

            if (storedCategories) {
                const categories = JSON.parse(storedCategories);
                await this.db.saveCategories(categories);
            }

            // Mark migration as complete
            await this.db.saveSetting('migrated_from_localstorage', true);

            // Optional: Clear localStorage after successful migration
            // localStorage.removeItem('mediacast_items');
            // localStorage.removeItem('mediacast_categories');

        } catch (e) {
            console.error('Lỗi khi migrate từ LocalStorage:', e);
        }
    }
}

// Initialize app
const mediaApp = new MediaCast();
