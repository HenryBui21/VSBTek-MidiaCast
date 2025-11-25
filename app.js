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
        this.isSettingsPanelOpen = false;
        this.currentVideoLoopCount = 0;
        this.currentZoom = 1;
        this.isAuthenticated = false;
        this.currentUser = null;
        this.isInitialized = false;
        this.isAuthReady = false;
        this.initAuthPromise = null;
        this.slideshowEventListeners = null;

        // Slideshow settings
        this.slideshowSettings = {
            transitionEffect: 'fade',
            slideDuration: 3000,
            transitionSpeed: 600,
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
            // Server mode only - load from API
            await this.loadFromServer();

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
            alert('Có lỗi khi khởi động ứng dụng. Vui lòng đảm bảo server đang chạy!');
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
            throw e;
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
            fileInput.value = '';
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
            this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
            slideshowSettingsPanel.classList.toggle('active');

            this.clearControlsTimeout();

            if (!this.isSettingsPanelOpen) {
                this.resetControlsTimeout();
            }
        });

        // Prevent clicks inside settings panel from bubbling up
        slideshowSettingsPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        slideshowSettingsPanel.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
        slideshowSettingsPanel.addEventListener('mousemove', (e) => {
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
                if (this.isSettingsPanelOpen) {
                    this.isSettingsPanelOpen = false;
                    slideshowSettingsPanel.classList.remove('active');
                    this.clearControlsTimeout();
                    this.resetControlsTimeout();
                }
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
        // Removed WEBP and WEBM for better TV compatibility - older TVs often don't support these formats
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
        const selectedCategory = document.getElementById('uploadCategory').value;
        const validFiles = Array.from(files).filter(file => {
            if (!validTypes.includes(file.type)) {
                alert(`File ${file.name} không được hỗ trợ! Chỉ hỗ trợ: JPG, PNG, GIF, MP4`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        for (const file of validFiles) {
            try {
                await api.uploadMedia(file, selectedCategory);
            } catch (error) {
                console.error('Lỗi khi thêm media:', error);
                alert(`Không thể thêm file ${file.name}`);
            }
        }

        // Reload data once after all uploads complete
        await this.loadFromServer();
        this.renderGallery();
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
                        <span class="category-list-name">${this.escapeHtml(cat)}</span>
                        <span class="category-list-count">(${count} media)</span>
                    </div>
                    <button class="category-delete-btn" data-category="${this.escapeHtml(cat)}"
                            ${isDefault ? 'disabled' : ''}>
                        Xóa
                    </button>
                </div>
            `;
        }).join('');

        // Event delegation for delete buttons
        container.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this.deleteCategory(category);
            });
        });
    }

    async addCategory(categoryName) {
        if (this.categories.includes(categoryName)) {
            alert('Danh mục này đã tồn tại!');
            return;
        }

        this.categories = await api.addCategory(categoryName);
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

        this.categories = await api.deleteCategory(categoryName);
        await this.loadFromServer();
        this.renderCategorySelect();
        this.renderCategoryFilters();
        this.renderCategoriesList();
        this.renderGallery();
    }

    renderGallery() {
        const galleryGrid = document.getElementById('galleryGrid');

        let filteredItems = this.mediaItems;

        if (this.currentCategory !== 'all') {
            filteredItems = filteredItems.filter(item => item.category === this.currentCategory);
        }

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
            const mediaURL = api.getMediaURL(item);

            return `
                <div class="media-item" data-id="${this.escapeHtml(item.id)}" data-index="${originalIndex}">
                    ${item.type === 'image'
                        ? `<img src="${mediaURL}" alt="${this.escapeHtml(item.name)}">`
                        : `<video src="${mediaURL}" muted></video>`
                    }
                    <div class="media-item-overlay">
                        <div class="media-item-info">
                            <div class="media-item-name">${this.escapeHtml(item.name)}</div>
                            <div class="media-item-category">${this.escapeHtml(item.category)}</div>
                        </div>
                    </div>
                    <div class="media-item-actions">
                        <button class="delete-btn" data-id="${this.escapeHtml(item.id)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event delegation for media items
        galleryGrid.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    const index = parseInt(item.dataset.index);
                    this.viewMedia(index);
                }
            });
        });

        galleryGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deleteMedia(id);
            });
        });
    }

    async deleteMedia(id) {
        try {
            await api.deleteMedia(id);
            await this.loadFromServer();
            this.renderGallery();
            this.renderCategoryFilters();
        } catch (error) {
            console.error('Lỗi khi xóa media:', error);
            alert('Không thể xóa media!');
        }
    }

    async clearAll() {
        try {
            await api.clearAllMedia();
            await this.loadFromServer();
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
        this.isSettingsPanelOpen = false;
        this.stopSlideshow();
        this.clearControlsTimeout();

        // Cleanup slideshow event listeners
        this.removeSlideshowEventListeners();

        this.currentZoom = 1;

        const videos = document.querySelectorAll('.slideshow-content video');
        videos.forEach(video => video.pause());

        const content = document.getElementById('slideshowContent');
        content.innerHTML = '';
    }

    removeSlideshowEventListeners() {
        if (this.slideshowEventListeners) {
            const modal = document.getElementById('slideshowModal');
            const listeners = this.slideshowEventListeners;

            modal.removeEventListener('mousemove', listeners.showAndResetControls);
            modal.removeEventListener('click', listeners.showAndResetControls);
            modal.removeEventListener('touchstart', listeners.showAndResetControls);
            modal.removeEventListener('touchmove', listeners.showAndResetControls);
            modal.removeEventListener('keydown', listeners.showAndResetControls);
            modal.removeEventListener('mouseleave', listeners.mouseLeave);

            this.slideshowEventListeners = null;
        }
    }

    setupSlideshowControls() {
        const modal = document.getElementById('slideshowModal');

        // Cleanup previous listeners if any
        this.removeSlideshowEventListeners();

        modal.classList.add('show-controls');
        this.resetControlsTimeout();

        // Create bound functions to allow proper removal
        const showAndResetControls = () => {
            if (!this.isSettingsPanelOpen) {
                modal.classList.add('show-controls');
                this.resetControlsTimeout();
            }
        };

        const mouseLeave = () => {
            if (!this.isSettingsPanelOpen) {
                this.resetControlsTimeout();
            }
        };

        // Store references for cleanup
        this.slideshowEventListeners = {
            showAndResetControls: showAndResetControls,
            mouseLeave: mouseLeave
        };

        modal.addEventListener('mousemove', showAndResetControls);
        modal.addEventListener('click', showAndResetControls);
        modal.addEventListener('touchstart', showAndResetControls, { passive: true });
        modal.addEventListener('touchmove', showAndResetControls, { passive: true });
        modal.addEventListener('keydown', showAndResetControls);
        modal.addEventListener('mouseleave', mouseLeave);
    }

    resetControlsTimeout() {
        const modal = document.getElementById('slideshowModal');

        if (this.isSettingsPanelOpen) {
            return;
        }

        const now = Date.now();
        if (this.lastControlsInteraction && (now - this.lastControlsInteraction) < 500) {
            return;
        }
        this.lastControlsInteraction = now;

        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }

        this.controlsTimeout = setTimeout(() => {
            this.controlsTimeout = null;
            if (this.isSettingsPanelOpen) {
                return;
            }
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

        if (this.currentSlideIndex < 0) {
            this.currentSlideIndex = this.mediaItems.length - 1;
        }
        if (this.currentSlideIndex >= this.mediaItems.length) {
            this.currentSlideIndex = 0;
        }

        const item = this.mediaItems[this.currentSlideIndex];
        const content = document.getElementById('slideshowContent');
        const counter = document.getElementById('slideshowCounter');

        this.updateVideoLoopSettingVisibility();

        const mediaURL = api.getMediaURL(item);

        counter.textContent = `${this.currentSlideIndex + 1} / ${this.mediaItems.length}`;

        if (item.type === 'image') {
            const img = new Image();
            img.onload = () => {
                const existingElements = content.querySelectorAll('img, video');

                const newImg = document.createElement('img');
                newImg.src = mediaURL;
                newImg.alt = item.name;
                newImg.className = 'slideshow-media';
                newImg.style.opacity = '0';
                newImg.style.objectFit = this.slideshowSettings.imageFit;

                content.appendChild(newImg);
                void newImg.offsetHeight;

                requestAnimationFrame(() => {
                    content.classList.remove('transition-fade', 'transition-slide', 'transition-zoom', 'transition-flip');
                    content.classList.add(`transition-${this.slideshowSettings.transitionEffect}`);

                    newImg.style.opacity = '1';

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
            img.src = mediaURL;
        } else {
            const existingElements = content.querySelectorAll('img, video');

            const video = document.createElement('video');
            video.src = mediaURL;
            video.controls = true;
            video.autoplay = true;
            video.className = 'slideshow-media';
            video.style.opacity = '0';
            video.style.objectFit = this.slideshowSettings.imageFit;

            const loopCount = item.videoLoopCount || item.loopCount || 1;
            this.currentVideoLoopCount = 0;

            video.addEventListener('ended', () => {
                this.currentVideoLoopCount++;

                if (this.currentVideoLoopCount < loopCount) {
                    video.currentTime = 0;
                    video.play();
                } else {
                    if (this.isPlaying) {
                        this.nextSlide();
                    }
                }
            });

            content.appendChild(video);
            void video.offsetHeight;

            requestAnimationFrame(() => {
                content.classList.remove('transition-fade', 'transition-slide', 'transition-zoom', 'transition-flip');
                content.classList.add(`transition-${this.slideshowSettings.transitionEffect}`);

                video.style.opacity = '1';

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
        this.currentZoom = 1;
        this.showSlide(this.currentSlideIndex - 1);
    }

    nextSlide() {
        this.currentZoom = 1;
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
            const currentItem = this.mediaItems[this.currentSlideIndex];
            if (currentItem && currentItem.type === 'image') {
                this.nextSlide();
            }
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
        const media = content && content.querySelector('img, video');
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
            currentVideoLoopCount.value = currentItem.videoLoopCount || currentItem.loopCount || 1;
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

        try {
            await api.updateMedia(currentItem.id, { loopCount: loopCount });
            await this.loadFromServer();
            alert('Đã lưu cài đặt loop!');
        } catch (error) {
            console.error('Lỗi khi lưu loop:', error);
            alert('Không thể lưu cài đặt loop!');
        }
    }

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
        const content = document.getElementById('slideshowContent');
        const media = content.querySelector('.slideshow-media');

        if (media) {
            media.style.transform = `scale(${this.currentZoom})`;
            media.style.transition = 'transform 0.3s ease';
        }
    }

    async saveSettings() {
        try {
            await api.updateSettings(this.slideshowSettings);
        } catch (e) {
            console.error('Lỗi khi lưu settings:', e);
        }
    }

    async loadSettings() {
        try {
            const stored = await api.getSettings();
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

    // Authentication methods
    async initAuth() {
        try {
            // Check if API server is available
            if (typeof api !== 'undefined') {
                const isAvailable = await api.checkAvailability();
                if (!isAvailable) {
                    alert('Không thể kết nối đến server. Vui lòng đảm bảo server đang chạy!');
                    this.showLoginModal();
                    return;
                }
            }

            this.isAuthReady = true;
            await this.checkUsersExist();
            await this.checkAuth();
        } catch (error) {
            console.error('Lỗi khởi tạo auth:', error);
            this.isAuthReady = true;
            this.showLoginModal();
        }
    }

    async checkUsersExist() {
        try {
            const usersCount = await api.getUsersCount();
            const adminInitialized = await api.getAdminInitialized();

            const loginHint = document.getElementById('loginHint');
            if (usersCount === 0 && !adminInitialized) {
                loginHint.textContent = 'Lần đầu sử dụng? Nhập thông tin để tạo tài khoản admin.';
                loginHint.style.color = '';
            } else if (usersCount === 0 && adminInitialized) {
                loginHint.textContent = 'Không có tài khoản nào. Vui lòng liên hệ quản trị viên.';
                loginHint.style.color = '#e74c3c';
            } else {
                loginHint.textContent = '';
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra users:', error);
        }
    }

    async checkAuth() {
        const sessionAuth = sessionStorage.getItem('mediacast_auth');
        const sessionUserId = sessionStorage.getItem('mediacast_user_id');

        if (sessionAuth === 'true' && sessionUserId) {
            try {
                const users = await api.getAllUsers();
                const user = users.find(u => u.id === sessionUserId);

                if (user) {
                    this.isAuthenticated = true;
                    this.currentUser = user;
                    this.hideLoginModal();
                    this.updateUserDisplay();
                    await this.initApp();
                    return;
                }
            } catch (e) {
                console.error('Lỗi khi lấy user từ server:', e);
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

        headerLogo.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userDropdownMenu.contains(e.target) && e.target !== headerLogo) {
                userDropdownMenu.classList.remove('active');
            }
        });

        manageUsersBtn.addEventListener('click', () => {
            this.closeDropdownMenu();
            this.openUserModal();
        });

        changePasswordBtn.addEventListener('click', () => {
            this.closeDropdownMenu();
            this.openChangePasswordModal();
        });

        document.getElementById('closeUserModal').addEventListener('click', () => {
            document.getElementById('userModal').classList.remove('active');
        });

        document.getElementById('addUserBtn').addEventListener('click', () => {
            this.addNewUser();
        });

        document.getElementById('closeChangePasswordModal').addEventListener('click', () => {
            document.getElementById('changePasswordModal').classList.remove('active');
        });

        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleChangePassword();
        });

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
        } catch (error) {
            console.error('Lỗi khi xác thực:', error);
            alert('Có lỗi xảy ra khi đăng nhập. Vui lòng kiểm tra kết nối server!');
        }
    }

    async hashPassword(password) {
        // Try WebCrypto API with better error handling for TV browsers
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (error) {
                console.warn('WebCrypto API failed, using fallback hash:', error);
                // Fall through to fallback implementation
            }
        }

        // Fallback hash implementation for older TV browsers
        // Using a more robust hashing algorithm (DJB2 + salt)
        const salt = 'vsbtek_mediacast_2024';
        const saltedPassword = password + salt;

        let hash = 5381;
        for (let i = 0; i < saltedPassword.length; i++) {
            hash = ((hash << 5) + hash) + saltedPassword.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }

        // Add additional mixing for better security
        let hash2 = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash2 = ((hash2 << 5) - hash2) + char;
            hash2 = hash2 & hash2;
        }

        return Math.abs(hash).toString(16) + Math.abs(hash2).toString(16);
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
            document.getElementById('galleryGrid').innerHTML = '<div class="empty-state"><p>Vui lòng đăng nhập để xem nội dung</p></div>';
        }
    }

    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.add('active');
        document.body.classList.add('locked');
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
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Đã sao chép!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            } catch (err) {
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

        categorySelect.innerHTML = '<option value="all">Tất cả</option>' +
            this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        this.updateShareLink();
        modal.classList.add('active');
    }

    updateShareLink() {
        const category = document.getElementById('shareLinkCategory').value;
        const input = document.getElementById('shareLinkInput');

        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        let slideshowUrl = `${baseUrl}slideshow.html`;

        if (category !== 'all') {
            slideshowUrl += `?category=${encodeURIComponent(category)}`;
        }

        input.value = slideshowUrl;
    }

    // User Management Methods
    openUserModal() {
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            alert('Bạn không có quyền truy cập tính năng này!');
            return;
        }
        document.getElementById('userModal').classList.add('active');
        this.renderUsersList();
    }

    async renderUsersList() {
        const container = document.getElementById('usersList');
        const users = await api.getAllUsers();

        container.innerHTML = users.map(user => {
            const isCurrentUser = this.currentUser && user.id === this.currentUser.id;
            const roleClass = user.role === 'admin' ? 'admin' : 'user';
            const roleText = user.role === 'admin' ? 'Quản trị viên' : 'Người dùng';

            return `
                <div class="user-list-item">
                    <div class="user-info">
                        <span class="user-name">${this.escapeHtml(user.username)}</span>
                        <span class="user-role ${roleClass}">${roleText}</span>
                    </div>
                    <div class="user-actions">
                        <button class="user-edit-btn" data-user-id="${this.escapeHtml(user.id)}">
                            Sửa
                        </button>
                        <button class="user-delete-btn" data-user-id="${this.escapeHtml(user.id)}"
                                ${isCurrentUser ? 'disabled title="Không thể xóa tài khoản đang đăng nhập"' : ''}>
                            Xóa
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event delegation for user actions
        container.querySelectorAll('.user-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                this.openEditUserModal(userId);
            });
        });

        container.querySelectorAll('.user-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                this.deleteUser(userId);
            });
        });
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

            await api.addUser(newUser);

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
        if (this.currentUser && userId === this.currentUser.id) {
            alert('Không thể xóa tài khoản đang đăng nhập!');
            return;
        }

        if (!confirm('Bạn có chắc muốn xóa người dùng này?')) {
            return;
        }

        try {
            await api.deleteUser(userId);
            this.renderUsersList();
            alert('Đã xóa người dùng thành công!');
        } catch (error) {
            console.error('Lỗi khi xóa người dùng:', error);
            alert('Có lỗi xảy ra khi xóa người dùng!');
        }
    }

    async openEditUserModal(userId) {
        const user = await api.getUserById(userId);
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
        const userId = document.getElementById('editUserId').value;
        const role = document.getElementById('editUserRole').value;
        const newPassword = document.getElementById('editUserPassword').value;

        try {
            const updates = { role: role };

            if (newPassword) {
                if (newPassword.length < 4) {
                    alert('Mật khẩu phải có ít nhất 4 ký tự!');
                    return;
                }
                updates.passwordHash = await this.hashPassword(newPassword);
            }

            await api.updateUser(userId, updates);

            if (this.currentUser && userId === this.currentUser.id) {
                this.currentUser.role = role;
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

    // Utility method to escape HTML and prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            const currentHash = await this.hashPassword(currentPassword);
            if (currentHash !== this.currentUser.passwordHash) {
                alert('Mật khẩu hiện tại không đúng!');
                return;
            }

            const newHash = await this.hashPassword(newPassword);
            await api.updateUser(this.currentUser.id, { passwordHash: newHash });
            this.currentUser.passwordHash = newHash;

            document.getElementById('changePasswordModal').classList.remove('active');
            alert('Đã đổi mật khẩu thành công!');
        } catch (error) {
            console.error('Lỗi khi đổi mật khẩu:', error);
            alert('Có lỗi xảy ra khi đổi mật khẩu!');
        }
    }
}

// Initialize app
const mediaApp = new MediaCast();
