/**
 * Source Browser
 * Slide-in panel for exploring and selecting content from providers
 * Supports both text and visual content with appropriate rendering
 */

import { SourceRegistry } from '../sources/index.js';
import { escapeHtml, safeUrl } from '../core/sanitize.js';
import { isAbortError } from '../sources/visual/request.js';

export class SourceBrowser {
    constructor(options = {}) {
        this.onSelect = options.onSelect || (() => { });
        this.onClose = options.onClose || (() => { });

        // Mode: 'all' shows both text and visual, 'text' shows only text providers
        this.browserMode = options.mode || 'all';
        this.providerIds = Array.isArray(options.providerIds) ? new Set(options.providerIds) : null;
        this.autoSelectProviderId = options.autoSelectProviderId || null;

        this.element = null;
        this.activeProvider = null;
        this.contentItems = [];
        this.searchQuery = '';
        this.activeCategory = 'all';
        this.isLoading = false;
        this._requestVersion = 0;
        this._requestController = null;
        this._selectionController = null;
        this._searchTimer = null;
        this._closeTimer = null;
        this._destroyed = false;
        this.returnFocus = document.activeElement;

        // Track expanded visual categories for browsing individual images
        this.expandedCategory = null;
        this.categoryImages = [];
        this.activeTextItem = null;
        this.textContents = null;
        this.contentsQuery = '';

        // Mode: provider items, visual-category images, or a work's contents
        this.viewMode = 'categories';

        this.create();
    }

    _beginRequest() {
        this._requestController?.abort();
        this._selectionController?.abort();
        this._requestController = new AbortController();
        return {
            version: ++this._requestVersion,
            signal: this._requestController.signal
        };
    }

    _isCurrentRequest(version, provider) {
        return !this._destroyed
            && version === this._requestVersion
            && provider === this.activeProvider;
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'source-browser-overlay';
        this.element.innerHTML = `
            <div class="source-browser" role="dialog" aria-modal="true" aria-labelledby="source-browser-title">
                <header class="sb-header">
                    <h2 class="sb-title" id="source-browser-title">Source Library</h2>
                    <button class="sb-close" type="button" aria-label="Close">✕</button>
                </header>

                <div class="sb-body">
                    <!-- Sidebar: Provider list -->
                    <aside class="sb-sidebar">
                        <div class="sb-search">
                            <label class="sr-only" for="sb-source-search">Search the source library</label>
                            <input type="search" id="sb-source-search" class="sb-search-input"
                                   placeholder="Search titles, authors, ideasâ€¦">
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
                        <nav class="sb-library-navigation" aria-label="Archive shelves" hidden></nav>
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

        if (this.autoSelectProviderId && SourceRegistry.get(this.autoSelectProviderId)) {
            void this.loadProviderContent(this.autoSelectProviderId);
        }

        // Animate in
        requestAnimationFrame(() => {
            this.element.classList.add('open');
            this.element.querySelector('.sb-search-input, .sb-close')?.focus({ preventScroll: true });
        });
    }

    renderProviders() {
        const textList = this.element.querySelector('[data-type="text"]');
        const visualList = this.element.querySelector('[data-type="visual"]');
        const visualGroup = this.element.querySelector('.sb-provider-group:has([data-type="visual"])');

        const includeProvider = provider => !this.providerIds || this.providerIds.has(provider.id);
        const textProviders = SourceRegistry.getTextProviders().filter(includeProvider);
        const visualProviders = SourceRegistry.getVisualProviders().filter(includeProvider);

        textList.innerHTML = textProviders.map(p => `
            <li>
                <button class="sb-provider-btn" data-provider="${p.id}">
                    <span class="sb-provider-name">${p.name}</span>
                    <span class="sb-provider-tier tier-${p.tier}">${p.isLibraryRegistry ? p.count : p.tier}</span>
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

    renderLibraryNavigation(provider = this.activeProvider) {
        const navigation = this.element.querySelector('.sb-library-navigation');
        const providerNavigation = this.element.querySelector('.sb-providers');
        if (!navigation) return;
        if (!provider?.isLibraryRegistry || typeof provider.getFacets !== 'function') {
            navigation.hidden = true;
            if (providerNavigation) providerNavigation.hidden = false;
            return;
        }

        const { shelves = [] } = provider.getFacets();
        const renderShelf = shelf => `<button type="button"
            class="sb-shelf-btn ${this.activeCategory === shelf.id ? 'active' : ''}"
            data-library-category="${escapeHtml(shelf.id)}"
            aria-pressed="${this.activeCategory === shelf.id}">
              <span aria-hidden="true">${escapeHtml(shelf.icon || '◇')}</span>
              <span><strong>${escapeHtml(shelf.name)}</strong><small>${escapeHtml(shelf.description || '')}</small></span>
              <em>${shelf.count}</em>
            </button>`;
        navigation.innerHTML = `
            <span class="sb-group-label">Browse the Archive</span>
            <button type="button" class="sb-shelf-btn ${this.activeCategory === 'all' ? 'active' : ''}"
                    data-library-category="all" aria-pressed="${this.activeCategory === 'all'}">
              <span aria-hidden="true">◌</span><span><strong>All works</strong><small>The complete curated registry</small></span>
              <em>${provider.count}</em>
            </button>
            ${shelves.map(renderShelf).join('')}`;
        navigation.hidden = false;
        if (providerNavigation) providerNavigation.hidden = true;
    }

    /**
     * Check if provider is visual type
     */
    isVisualProvider(provider) {
        return provider && ['image', 'diagram', 'fractal'].includes(provider.contentType);
    }

    async loadProviderContent(providerId) {
        const provider = SourceRegistry.get(providerId);
        if (!provider || this._destroyed) return;
        const providerChanged = provider !== this.activeProvider;
        this.activeProvider = provider;
        if (providerChanged) this.activeCategory = 'all';
        const { version, signal } = this._beginRequest();

        // Reset view mode
        this.viewMode = 'categories';
        this.expandedCategory = null;

        // Update header
        const header = this.element.querySelector('.sb-content-title');
        header.textContent = provider.name;

        // Hide back button
        const backBtn = this.element.querySelector('.sb-back-btn');
        if (backBtn) backBtn.hidden = true;

        // Update active state
        this.element.querySelectorAll('.sb-provider-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === providerId);
        });
        this.renderLibraryNavigation(provider);

        // Load content
        const contentList = this.element.querySelector('.sb-content-list');
        contentList.innerHTML = '<div class="sb-loading"><div class="sb-loading-spinner"></div>Loading...</div>';
        this.isLoading = true;

        try {
            let items;
            const libraryFilter = provider.isLibraryRegistry && this.activeCategory !== 'all'
                ? { category: this.activeCategory }
                : {};
            if (this.searchQuery && provider.supportsSearch) {
                items = await provider.search(this.searchQuery, { ...libraryFilter, signal });
            } else {
                items = await provider.list({
                    ...libraryFilter,
                    limit: provider.isLibraryRegistry ? 250 : 50,
                    signal
                });
            }

            if (!this._isCurrentRequest(version, provider)) return;
            this.contentItems = items;
            this.isLoading = false;
            header.textContent = provider.isLibraryRegistry
                ? `${provider.name} · ${items.length} work${items.length === 1 ? '' : 's'}`
                : provider.name;
            this.renderContent();
        } catch (error) {
            if (isAbortError(error) || !this._isCurrentRequest(version, provider)) return;
            this.isLoading = false;
            contentList.textContent = `Failed to load content: ${error.message || 'Unknown error'}`;
            contentList.className = 'sb-content-list sb-error';
            console.error('[SourceBrowser] Load error:', error);
        }
    }

    /**
     * Load individual images from a visual category
     */
    async loadCategoryImages(categoryId) {
        if (!this.activeProvider || this._destroyed) return;
        const provider = this.activeProvider;
        const { version, signal } = this._beginRequest();
        const contentList = this.element.querySelector('.sb-content-list');
        contentList.innerHTML = '<div class="sb-loading"><div class="sb-loading-spinner"></div>Loading images...</div>';

        try {
            const categoryData = await provider.get(categoryId, { signal });

            if (!this._isCurrentRequest(version, provider)) return;
            if (categoryData?.data?.images) {
                this.categoryImages = categoryData.data.images;
                this.expandedCategory = categoryId;
                this.viewMode = 'images';
                this.renderCategoryImages(categoryData.name);
            } else {
                contentList.innerHTML = '<div class="sb-empty">No images found in this category</div>';
            }
        } catch (error) {
            if (isAbortError(error) || !this._isCurrentRequest(version, provider)) return;
            contentList.textContent = `Failed to load images: ${error.message || 'Unknown error'}`;
            contentList.className = 'sb-content-list sb-error';
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

    goBack() {
        if (this.viewMode !== 'contents') {
            this.goBackToCategories();
            return;
        }
        this.viewMode = 'categories';
        this.activeTextItem = null;
        this.textContents = null;
        this.contentsQuery = '';
        const backBtn = this.element.querySelector('.sb-back-btn');
        if (backBtn) backBtn.hidden = true;
        const search = this.element.querySelector('.sb-search');
        if (search) search.hidden = false;
        const header = this.element.querySelector('.sb-content-title');
        header.textContent = this.activeProvider?.isLibraryRegistry
            ? `${this.activeProvider.name} · ${this.contentItems.length} work${this.contentItems.length === 1 ? '' : 's'}`
            : this.activeProvider?.name || 'Select a provider';
        this.renderContent();
    }

    renderContent() {
        const contentList = this.element.querySelector('.sb-content-list');

        if (this.contentItems.length === 0) {
            contentList.innerHTML = '<div class="sb-empty">No content available</div>';
            return;
        }

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
        return this.contentItems.map((item, index) => {
            const metadata = item.metadata || {};
            const holdings = metadata.holdings || (metadata.verseCount ? `${metadata.verseCount} verses` : '');
            const opensContents = metadata.canBrowseParts
                && typeof this.activeProvider?.getContents === 'function';
            return `
            <article class="sb-item sb-item-text ${metadata.rightsBasis ? 'is-verified-edition' : ''}" data-index="${index}">
                <div class="sb-item-info">
                    <span class="sb-item-name">${escapeHtml(item.name)}</span>
                    ${metadata.author ? `<span class="sb-item-author">${escapeHtml(metadata.author)}</span>` : ''}
                    <span class="sb-item-taxonomy">
                      ${metadata.shelf ? `<span>${escapeHtml(metadata.shelfIcon || '◇')} ${escapeHtml(metadata.shelf)}</span>` : ''}
                      ${metadata.division ? `<span>${escapeHtml(metadata.division)}</span>` : ''}
                      ${holdings ? `<span>${escapeHtml(holdings)}</span>` : ''}
                      ${!metadata.shelf && metadata.tradition ? `<span>${escapeHtml(metadata.tradition)}</span>` : ''}
                      ${!metadata.shelf && metadata.category ? `<span>${escapeHtml(metadata.category)}</span>` : ''}
                    </span>
                    ${metadata.description ? `<span class="sb-item-desc">${escapeHtml(this.truncate(metadata.description, 130))}</span>` : ''}
                    ${metadata.edition ? `<span class="sb-item-edition"><span aria-hidden="true">✓</span>${escapeHtml(metadata.edition)}</span>` : ''}
                </div>
                <button class="${opensContents ? 'sb-item-open' : 'sb-item-add'}" type="button" data-index="${index}"
                        aria-label="${opensContents ? 'Open chapters of' : 'Add'} ${escapeHtml(item.name)}">
                    ${opensContents ? 'Open' : 'Add'}
                </button>
            </article>`;
        }).join('');
    }

    contentsDuration(words) {
        const minutes = Math.max(1, Math.round((Number(words) || 0) / 200));
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
    }

    filteredContentsEntries() {
        const entries = this.textContents?.entries || [];
        const query = this.contentsQuery.trim().toLocaleLowerCase();
        if (!query) return entries;
        return entries.filter(entry => [entry.label, entry.title]
            .filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
    }

    renderTextContents() {
        const contentList = this.element.querySelector('.sb-content-list');
        const header = this.element.querySelector('.sb-content-title');
        const backBtn = this.element.querySelector('.sb-back-btn');
        const search = this.element.querySelector('.sb-search');
        const contents = this.textContents;
        const item = this.activeTextItem;
        if (!contentList || !contents || !item) return;

        const entries = this.filteredContentsEntries();
        const totalWords = contents.entries.reduce((sum, entry) => sum + (Number(entry.words) || 0), 0);
        const metadata = item.metadata || {};
        const noun = contents.noun || metadata.chapterNoun || 'section';
        header.textContent = item.name;
        if (backBtn) backBtn.hidden = false;
        if (search) search.hidden = true;
        contentList.className = 'sb-content-list';
        contentList.innerHTML = `
          <section class="sb-contents" aria-labelledby="sb-contents-title">
            <header class="sb-contents-identity">
              <span class="studio-kicker">Contents</span>
              <h3 id="sb-contents-title">${escapeHtml(item.name)}</h3>
              ${metadata.author ? `<p>${escapeHtml(metadata.author)}</p>` : ''}
              <div class="sb-contents-weight">
                <span>${contents.entries.length} ${escapeHtml(contents.entries.length === 1 ? noun : `${noun}s`)}</span>
                <span>${this.contentsDuration(totalWords)}</span>
                ${metadata.edition ? `<span>✓ ${escapeHtml(metadata.edition)}</span>` : ''}
              </div>
            </header>
            ${contents.entries.length > 12 ? `
              <label class="sb-contents-search">
                <span class="sr-only">Filter chapters</span>
                <input type="search" value="${escapeHtml(this.contentsQuery)}"
                       placeholder="Find a chapter or section" data-contents-search>
                ${this.contentsQuery ? `<small>${entries.length} of ${contents.entries.length}</small>` : ''}
              </label>` : ''}
            ${contents.reason === 'measured' ? `<p class="sb-contents-note">This edition has no verifiable named division scheme, so the Archive offers measured readings.</p>` : ''}
            <div class="sb-chapter-list" role="list">
              ${entries.length ? entries.map((entry, index) => `
                <article class="sb-chapter-item" role="listitem">
                  <span class="sb-chapter-mark" aria-hidden="true">${index + 1}</span>
                  <span class="sb-chapter-copy"><strong>${escapeHtml(entry.label)}</strong>
                    ${entry.title ? `<small>${escapeHtml(entry.title)}</small>` : ''}</span>
                  <span class="sb-chapter-time">${this.contentsDuration(entry.words)}</span>
                  <button type="button" class="sb-chapter-add" data-entry-id="${escapeHtml(String(entry.id))}"
                          aria-label="Add ${escapeHtml(entry.title || entry.label)}">Add</button>
                </article>`).join('') : '<p class="sb-empty">No chapters match this search.</p>'}
            </div>
            <footer class="sb-contents-footer">
              <button type="button" class="sb-whole-add">Add complete work · ${this.contentsDuration(totalWords)}</button>
            </footer>
          </section>`;

        if (this.contentsQuery) {
            requestAnimationFrame(() => {
                const input = this.element.querySelector('[data-contents-search]');
                input?.focus();
                input?.setSelectionRange(this.contentsQuery.length, this.contentsQuery.length);
            });
        }
    }

    async openTextItem(index, button) {
        const item = this.contentItems[index];
        const provider = this.activeProvider;
        if (!item || !provider || typeof provider.getContents !== 'function') return;
        if (button) {
            button.textContent = 'Opening…';
            button.disabled = true;
        }
        try {
            const contents = await provider.getContents(item.id);
            if (this._destroyed) return;
            if (!contents?.divided) {
                await this.selectItem(index);
                return;
            }
            this.activeTextItem = item;
            this.textContents = contents;
            this.contentsQuery = '';
            this.viewMode = 'contents';
            this.renderTextContents();
        } catch (error) {
            console.error('[SourceBrowser] Failed to open work contents:', error);
            if (button) {
                button.textContent = 'Retry';
                button.disabled = false;
            }
        }
    }

    async selectTextEntry(entryId, button) {
        const provider = this.activeProvider;
        const item = this.activeTextItem;
        if (!provider || !item || typeof provider.getEntry !== 'function') return;
        if (button) {
            button.textContent = 'Adding…';
            button.disabled = true;
        }
        try {
            const selected = await provider.getEntry(item.id, entryId);
            if (this._destroyed || !selected) return;
            this.onSelect(selected, provider);
        } catch (error) {
            console.error('[SourceBrowser] Failed to add chapter:', error);
            if (button) {
                button.textContent = 'Retry';
                button.disabled = false;
            }
        }
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

        const cleanPreviewUrl = safeUrl(previewUrl);
        if (cleanPreviewUrl) {
            previewStyle = `background-image: url('${cleanPreviewUrl}'); background-size: cover; background-position: center;`;
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
                    <span class="sb-visual-name">${escapeHtml(item.name)}</span>
                    <span class="sb-visual-type">${typeLabel}</span>
                </div>
                <button class="${actionClass}" type="button" data-index="${index}" data-category="${escapeHtml(item.id || '')}">
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
                        <div class="sb-visual-preview" style="background-image: url('${safeUrl(img.url)}'); background-size: cover; background-position: center;">
                        </div>
                        <div class="sb-visual-info">
                            <span class="sb-visual-name">${escapeHtml(this.truncate(img.title, 30))}</span>
                            ${img.artist ? `<span class="sb-visual-artist">${escapeHtml(this.truncate(img.artist.replace(/<[^>]*>/g, ''), 25))}</span>` : ''}
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
            if (e.key === 'Tab') {
                const focusable = [...this.element.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
                    .filter(node => !node.hidden && node.getClientRects().length);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
                return;
            }
            if (e.key === 'Escape') {
                if (this.viewMode === 'images' || this.viewMode === 'contents') {
                    this.goBack();
                } else {
                    this.close();
                }
            }
        };
        document.addEventListener('keydown', this.keyHandler);

        // Back button
        this.element.querySelector('.sb-back-btn')?.addEventListener('click', () => {
            this.goBack();
        });

        // Provider selection and item actions
        this.element.addEventListener('click', (e) => {
            const shelfBtn = e.target.closest('[data-library-category]');
            if (shelfBtn && this.activeProvider?.isLibraryRegistry) {
                this.activeCategory = shelfBtn.dataset.libraryCategory || 'all';
                this.renderLibraryNavigation();
                void this.loadProviderContent(this.activeProvider.id);
                return;
            }

            const providerBtn = e.target.closest('[data-provider]');
            if (providerBtn) {
                this.loadProviderContent(providerBtn.dataset.provider);
                return;
            }

            const openBtn = e.target.closest('.sb-item-open');
            if (openBtn) {
                void this.openTextItem(parseInt(openBtn.dataset.index), openBtn);
                return;
            }

            const chapterBtn = e.target.closest('.sb-chapter-add');
            if (chapterBtn) {
                void this.selectTextEntry(chapterBtn.dataset.entryId, chapterBtn);
                return;
            }

            const wholeBtn = e.target.closest('.sb-whole-add');
            if (wholeBtn && this.activeTextItem) {
                const index = this.contentItems.indexOf(this.activeTextItem);
                if (index >= 0) void this.selectItem(index);
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
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this._searchTimer);
            this.searchQuery = e.target.value;
            this._searchTimer = setTimeout(() => {
                if (this.activeProvider) {
                    this.loadProviderContent(this.activeProvider.id);
                }
            }, 300);
        });

        this.element.addEventListener('input', (e) => {
            const input = e.target.closest('[data-contents-search]');
            if (!input) return;
            clearTimeout(this._searchTimer);
            this.contentsQuery = input.value;
            this._searchTimer = setTimeout(() => this.renderTextContents(), 120);
        });
    }

    async selectItem(index) {
        const item = this.contentItems[index];
        if (!item) return;
        const provider = this.activeProvider;
        if (!provider) return;
        this._selectionController?.abort();
        const selectionController = new AbortController();
        this._selectionController = selectionController;

        // Visual feedback
        const itemEl = this.element.querySelector(`[data-index="${index}"]`);
        const addBtn = itemEl?.querySelector('.sb-item-add');
        if (addBtn) {
            addBtn.textContent = 'Loading...';
            addBtn.disabled = true;
        }

        try {
            // Fetch the full content payload
            const fullItem = await provider.get(item.id, { signal: selectionController.signal });
            if (this._destroyed || selectionController.signal.aborted) return;
            if (fullItem) {
                this.onSelect(fullItem, provider);
            } else {
                this.onSelect(item, provider); // Fallback
            }

            if (itemEl) {
                itemEl.classList.add('added');
                if (addBtn) addBtn.textContent = 'Added';
                setTimeout(() => itemEl.classList.remove('added'), 500);
            }
        } catch (error) {
            if (isAbortError(error)) return;
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
        const provider = this.activeProvider;
        if (!provider) return;
        this._selectionController?.abort();
        const selectionController = new AbortController();
        this._selectionController = selectionController;

        btn.textContent = 'Adding...';
        btn.disabled = true;

        try {
            const fullItem = await provider.get(item.id, { signal: selectionController.signal });
            if (this._destroyed || selectionController.signal.aborted) return;
            this.onSelect(fullItem || item, provider);

            btn.textContent = 'Added';
            btn.closest('.sb-visual-card')?.classList.add('added');
        } catch (error) {
            if (isAbortError(error)) return;
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
        const provider = this.activeProvider;
        if (!provider) return;

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
                providerId: provider.id,
                tier: provider.tier,
                metadata: {
                    url: img.url,
                    artist: img.artist,
                    license: img.license,
                    categoryId: this.expandedCategory
                }
            };

            this.onSelect(visualItem, provider);

            btn.textContent = 'Added';
            btn.closest('.sb-visual-card')?.classList.add('added');
        } catch (error) {
            console.error('[SourceBrowser] Failed to add image:', error);
            btn.textContent = 'Error';
            btn.disabled = false;
        }
    }

    close() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._requestVersion++;
        this._requestController?.abort();
        this._selectionController?.abort();
        clearTimeout(this._searchTimer);
        document.removeEventListener('keydown', this.keyHandler);
        this.element.classList.remove('open');

        this._closeTimer = setTimeout(() => {
            this.element.remove();
            this.onClose();
            if (this.returnFocus?.isConnected && document.activeElement === document.body) {
                this.returnFocus.focus?.({ preventScroll: true });
            }
        }, 300);
    }

    destroy() {
        if (!this._destroyed) this.close();
        clearTimeout(this._closeTimer);
        this.element?.remove();
    }
}
