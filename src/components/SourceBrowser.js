/**
 * Source Browser
 * Slide-in panel for exploring and selecting content from providers
 * Supports both text and visual content with appropriate rendering
 */

import { SourceRegistry } from '../sources/index.js';

export class SourceBrowser {
    constructor(options = {}) {
        this.onSelect = options.onSelect || (() => { });
        this.onClose = options.onClose || (() => { });

        // Mode: 'all' shows both text and visual, 'text' shows only text providers
        this.browserMode = options.mode || 'all';

        this.element = null;
        this.activeProvider = null;
        this.contentItems = [];
        this.searchQuery = '';
        this.isLoading = false;

        // Track expanded visual categories for browsing individual images
        this.expandedCategory = null;
        this.categoryImages = [];

        // Mode: 'categories' or 'images' (for visual providers)
        this.viewMode = 'categories';

        this.create();
    }

    create() {
        // Create overlay
        this.element = document.createElement('div');
        this.element.className = 'source-browser-overlay';
        this.element.innerHTML = `
            <div class="source-browser">
                <header class="sb-header">
                    <h2 class="sb-title">Source Browser</h2>
                    <button class="sb-close" type="button" aria-label="Close">✕</button>
                </header>

                <div class="sb-body">
                    <!-- Sidebar: Provider list -->
                    <aside class="sb-sidebar">
                        <div class="sb-search">
                            <input type="text" class="sb-search-input" placeholder="Search...">
                        </div>
                        <nav class="sb-providers">
                            <div class="sb-provider-group">
                                <span class="sb-group-label">Text</span>
                                <ul class="sb-provider-list" data-type="text"></ul>
                            </div>
                            <div class="sb-provider-group">
                                <span class="sb-group-label">Visual</span>
                                <ul class="sb-provider-list" data-type="visual"></ul>
                            </div>
                        </nav>
                    </aside>

                    <!-- Content area -->
                    <main class="sb-content">
                        <div class="sb-content-header">
                            <button class="sb-back-btn" hidden>← Back</button>
                            <span class="sb-content-title">Select a provider</span>
                        </div>
                        <div class="sb-content-list"></div>
                    </main>
                </div>
            </div>
        `;

        document.body.appendChild(this.element);

        this.renderProviders();
        this.attachEvents();

        // Animate in
        requestAnimationFrame(() => {
            this.element.classList.add('open');
        });
    }

    renderProviders() {
        const textList = this.element.querySelector('[data-type="text"]');
        const visualList = this.element.querySelector('[data-type="visual"]');
        const visualGroup = this.element.querySelector('.sb-provider-group:has([data-type="visual"])');

        const textProviders = SourceRegistry.getTextProviders();
        const visualProviders = SourceRegistry.getVisualProviders();

        textList.innerHTML = textProviders.map(p => `
            <li>
                <button class="sb-provider-btn" data-provider="${p.id}">
                    <span class="sb-provider-name">${p.name}</span>
                    <span class="sb-provider-tier tier-${p.tier}">${p.tier}</span>
                </button>
            </li>
        `).join('');

        // Hide visual providers in text-only mode
        if (this.browserMode === 'text') {
            if (visualGroup) visualGroup.hidden = true;
        } else {
            visualList.innerHTML = visualProviders.map(p => `
                <li>
                    <button class="sb-provider-btn" data-provider="${p.id}">
                        <span class="sb-provider-name">${p.name}</span>
                        <span class="sb-provider-tier tier-${p.tier}">${p.tier}</span>
                    </button>
                </li>
            `).join('');
        }
    }

    /**
     * Check if provider is visual type
     */
    isVisualProvider(provider) {
        return provider && ['image', 'diagram', 'fractal'].includes(provider.contentType);
    }

    async loadProviderContent(providerId) {
        this.activeProvider = SourceRegistry.get(providerId);
        if (!this.activeProvider) return;

        // Reset view mode
        this.viewMode = 'categories';
        this.expandedCategory = null;

        // Update header
        const header = this.element.querySelector('.sb-content-title');
        header.textContent = this.activeProvider.name;

        // Hide back button
        const backBtn = this.element.querySelector('.sb-back-btn');
        if (backBtn) backBtn.hidden = true;

        // Update active state
        this.element.querySelectorAll('.sb-provider-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === providerId);
        });

        // Load content
        const contentList = this.element.querySelector('.sb-content-list');
        contentList.innerHTML = '<div class="sb-loading"><div class="sb-loading-spinner"></div>Loading...</div>';
        this.isLoading = true;

        try {
            let items;
            if (this.searchQuery && this.activeProvider.supportsSearch) {
                items = await this.activeProvider.search(this.searchQuery);
            } else {
                items = await this.activeProvider.list({ limit: 50 });
            }

            this.contentItems = items;
            this.isLoading = false;
            this.renderContent();
        } catch (error) {
            this.isLoading = false;
            contentList.innerHTML = `<div class="sb-error">Failed to load content: ${error.message || 'Unknown error'}</div>`;
            console.error('[SourceBrowser] Load error:', error);
        }
    }

    /**
     * Load individual images from a visual category
     */
    async loadCategoryImages(categoryId) {
        const contentList = this.element.querySelector('.sb-content-list');
        contentList.innerHTML = '<div class="sb-loading"><div class="sb-loading-spinner"></div>Loading images...</div>';

        try {
            const categoryData = await this.activeProvider.get(categoryId);

            if (categoryData?.data?.images) {
                this.categoryImages = categoryData.data.images;
                this.expandedCategory = categoryId;
                this.viewMode = 'images';
                this.renderCategoryImages(categoryData.name);
            } else {
                contentList.innerHTML = '<div class="sb-empty">No images found in this category</div>';
            }
        } catch (error) {
            contentList.innerHTML = `<div class="sb-error">Failed to load images: ${error.message || 'Unknown error'}</div>`;
            console.error('[SourceBrowser] Category load error:', error);
        }
    }

    /**
     * Go back from image view to category view
     */
    goBackToCategories() {
        this.viewMode = 'categories';
        this.expandedCategory = null;
        this.categoryImages = [];

        const backBtn = this.element.querySelector('.sb-back-btn');
        if (backBtn) backBtn.hidden = true;

        const header = this.element.querySelector('.sb-content-title');
        header.textContent = this.activeProvider.name;

        this.renderContent();
    }

    renderContent() {
        const contentList = this.element.querySelector('.sb-content-list');

        if (this.contentItems.length === 0) {
            contentList.innerHTML = '<div class="sb-empty">No content available</div>';
            return;
        }

        // Check if this is a visual provider
        if (this.isVisualProvider(this.activeProvider)) {
            contentList.innerHTML = this.renderVisualContent();
        } else {
            contentList.innerHTML = this.renderTextContent();
        }
    }

    /**
     * Render text-based content (books, articles, etc.)
     */
    renderTextContent() {
        return this.contentItems.map((item, index) => `
            <div class="sb-item sb-item-text" data-index="${index}">
                <div class="sb-item-info">
                    <span class="sb-item-name">${item.name}</span>
                    ${item.metadata?.author ? `<span class="sb-item-author">${item.metadata.author}</span>` : ''}
                    ${item.metadata?.tradition ? `<span class="sb-item-category">${item.metadata.tradition}</span>` : ''}
                    ${item.metadata?.category ? `<span class="sb-item-category">${item.metadata.category}</span>` : ''}
                    ${item.metadata?.description ? `<span class="sb-item-desc">${this.truncate(item.metadata.description, 80)}</span>` : ''}
                    ${item.metadata?.verseCount ? `<span class="sb-item-count">${item.metadata.verseCount} verses</span>` : ''}
                </div>
                <button class="sb-item-add" type="button" data-index="${index}">
                    Add
                </button>
            </div>
        `).join('');
    }

    /**
     * Render visual content with thumbnails
     */
    renderVisualContent() {
        return `
            <div class="sb-visual-grid">
                ${this.contentItems.map((item, index) => this.renderVisualItem(item, index)).join('')}
            </div>
        `;
    }

    /**
     * Render a single visual item card
     */
    renderVisualItem(item, index) {
        const isGenerative = item.metadata?.generative || item.data?.isGenerative;
        const isCategory = item.metadata?.isCategory || item.data?.isCategory;
        const previewUrl = item.metadata?.previewUrl || item.data?.previewUrl;
        const previewGradient = item.metadata?.previewGradient || item.data?.previewGradient;
        const previewIcon = item.metadata?.previewIcon || item.data?.previewIcon;

        let previewStyle = '';
        let previewContent = '';

        if (previewUrl) {
            previewStyle = `background-image: url('${previewUrl}'); background-size: cover; background-position: center;`;
        } else if (previewGradient) {
            previewStyle = `background: ${previewGradient};`;
            previewContent = `<span class="sb-visual-icon">${previewIcon || '◈'}</span>`;
        } else {
            previewStyle = 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);';
            previewContent = `<span class="sb-visual-icon">◈</span>`;
        }

        const typeLabel = isGenerative ? 'Procedural' : (isCategory ? 'Category' : 'Image');
        const actionLabel = isCategory ? 'Browse' : 'Add';
        const actionClass = isCategory ? 'sb-visual-browse' : 'sb-visual-add';

        return `
            <div class="sb-visual-card" data-index="${index}" data-type="${isCategory ? 'category' : 'item'}">
                <div class="sb-visual-preview" style="${previewStyle}">
                    ${previewContent}
                    ${isGenerative ? '<span class="sb-visual-badge">Procedural</span>' : ''}
                    ${isCategory ? '<span class="sb-visual-badge sb-badge-category">Collection</span>' : ''}
                </div>
                <div class="sb-visual-info">
                    <span class="sb-visual-name">${item.name}</span>
                    <span class="sb-visual-type">${typeLabel}</span>
                </div>
                <button class="${actionClass}" type="button" data-index="${index}" data-category="${item.id || ''}">
                    ${actionLabel}
                </button>
            </div>
        `;
    }

    /**
     * Render individual images from a category
     */
    renderCategoryImages(categoryName) {
        const contentList = this.element.querySelector('.sb-content-list');
        const header = this.element.querySelector('.sb-content-title');
        const backBtn = this.element.querySelector('.sb-back-btn');

        header.textContent = categoryName;
        if (backBtn) backBtn.hidden = false;

        if (this.categoryImages.length === 0) {
            contentList.innerHTML = '<div class="sb-empty">No images found</div>';
            return;
        }

        contentList.innerHTML = `
            <div class="sb-visual-grid sb-image-grid">
                ${this.categoryImages.map((img, index) => `
                    <div class="sb-visual-card sb-image-card" data-img-index="${index}">
                        <div class="sb-visual-preview" style="background-image: url('${img.url}'); background-size: cover; background-position: center;">
                        </div>
                        <div class="sb-visual-info">
                            <span class="sb-visual-name">${this.truncate(img.title, 30)}</span>
                            ${img.artist ? `<span class="sb-visual-artist">${this.truncate(img.artist.replace(/<[^>]*>/g, ''), 25)}</span>` : ''}
                        </div>
                        <button class="sb-visual-add" type="button" data-img-index="${index}">
                            Add
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    truncate(text, maxLen) {
        if (!text || text.length <= maxLen) return text || '';
        return text.substring(0, maxLen).trim() + '...';
    }

    attachEvents() {
        // Close button
        this.element.querySelector('.sb-close')?.addEventListener('click', () => {
            this.close();
        });

        // Overlay click to close
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });

        // Escape key
        this.keyHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.viewMode === 'images') {
                    this.goBackToCategories();
                } else {
                    this.close();
                }
            }
        };
        document.addEventListener('keydown', this.keyHandler);

        // Back button
        this.element.querySelector('.sb-back-btn')?.addEventListener('click', () => {
            this.goBackToCategories();
        });

        // Provider selection and item actions
        this.element.addEventListener('click', (e) => {
            const providerBtn = e.target.closest('[data-provider]');
            if (providerBtn) {
                this.loadProviderContent(providerBtn.dataset.provider);
                return;
            }

            // Text item add
            const addBtn = e.target.closest('.sb-item-add');
            if (addBtn) {
                const index = parseInt(addBtn.dataset.index);
                this.selectItem(index);
                return;
            }

            // Visual category browse
            const browseBtn = e.target.closest('.sb-visual-browse');
            if (browseBtn) {
                const categoryId = browseBtn.dataset.category;
                if (categoryId && this.activeProvider.id === 'wikimedia-commons') {
                    this.loadCategoryImages(categoryId);
                }
                return;
            }

            // Visual item add (procedural or image)
            const visualAddBtn = e.target.closest('.sb-visual-add');
            if (visualAddBtn) {
                if (visualAddBtn.dataset.imgIndex !== undefined) {
                    // Adding individual image from category
                    const imgIndex = parseInt(visualAddBtn.dataset.imgIndex);
                    this.selectCategoryImage(imgIndex, visualAddBtn);
                } else {
                    // Adding visual item (procedural)
                    const index = parseInt(visualAddBtn.dataset.index);
                    this.selectVisualItem(index, visualAddBtn);
                }
                return;
            }
        });

        // Search
        const searchInput = this.element.querySelector('.sb-search-input');
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            this.searchQuery = e.target.value;
            searchTimeout = setTimeout(() => {
                if (this.activeProvider) {
                    this.loadProviderContent(this.activeProvider.id);
                }
            }, 300);
        });
    }

    async selectItem(index) {
        const item = this.contentItems[index];
        if (!item) return;

        // Visual feedback
        const itemEl = this.element.querySelector(`[data-index="${index}"]`);
        const addBtn = itemEl?.querySelector('.sb-item-add');
        if (addBtn) {
            addBtn.textContent = 'Loading...';
            addBtn.disabled = true;
        }

        try {
            // Fetch the full content payload
            const fullItem = await this.activeProvider.get(item.id);
            if (fullItem) {
                this.onSelect(fullItem, this.activeProvider);
            } else {
                this.onSelect(item, this.activeProvider); // Fallback
            }

            if (itemEl) {
                itemEl.classList.add('added');
                if (addBtn) addBtn.textContent = 'Added';
                setTimeout(() => itemEl.classList.remove('added'), 500);
            }
        } catch (error) {
            console.error('[SourceBrowser] Failed to fetch full item data:', error);
            if (addBtn) {
                addBtn.textContent = 'Error';
                addBtn.disabled = false;
            }
        }
    }

    /**
     * Select a visual item (procedural generator)
     */
    async selectVisualItem(index, btn) {
        const item = this.contentItems[index];
        if (!item) return;

        btn.textContent = 'Adding...';
        btn.disabled = true;

        try {
            const fullItem = await this.activeProvider.get(item.id);
            this.onSelect(fullItem || item, this.activeProvider);

            btn.textContent = 'Added';
            btn.closest('.sb-visual-card')?.classList.add('added');
        } catch (error) {
            console.error('[SourceBrowser] Failed to add visual item:', error);
            btn.textContent = 'Error';
            btn.disabled = false;
        }
    }

    /**
     * Select an individual image from a category
     */
    async selectCategoryImage(imgIndex, btn) {
        const img = this.categoryImages[imgIndex];
        if (!img) return;

        btn.textContent = 'Adding...';
        btn.disabled = true;

        try {
            // Create a visual item from the image
            const visualItem = {
                id: img.id,
                type: 'image',
                name: img.title,
                data: {
                    url: img.url,
                    fullUrl: img.fullUrl,
                    isImage: true
                },
                providerId: this.activeProvider.id,
                tier: this.activeProvider.tier,
                metadata: {
                    url: img.url,
                    artist: img.artist,
                    license: img.license,
                    categoryId: this.expandedCategory
                }
            };

            this.onSelect(visualItem, this.activeProvider);

            btn.textContent = 'Added';
            btn.closest('.sb-visual-card')?.classList.add('added');
        } catch (error) {
            console.error('[SourceBrowser] Failed to add image:', error);
            btn.textContent = 'Error';
            btn.disabled = false;
        }
    }

    close() {
        this.element.classList.remove('open');

        setTimeout(() => {
            document.removeEventListener('keydown', this.keyHandler);
            this.element.remove();
            this.onClose();
        }, 300);
    }

    destroy() {
        this.close();
    }
}
