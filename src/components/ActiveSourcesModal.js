/**
 * Active Sources Modal
 * Shows Wikimedia diagram thumbnails with category browsing
 */

import { WikimediaProvider, WIKIMEDIA_CATEGORIES } from '../sources/visual/wikimedia.js';
import { escapeHtml, safeUrl } from '../core/sanitize.js';

export class ActiveSourcesModal {
    constructor(options = {}) {
        this.onClose = options.onClose || (() => { });
        this.onImageSelect = options.onImageSelect || (() => { });

        // Provider instance
        this._provider = new WikimediaProvider();

        // State
        this.currentCategory = Object.keys(WIKIMEDIA_CATEGORIES)[0];
        this.images = [];
        this.loading = false;
        this.excludedImages = new Set();

        this.element = null;
        this.create();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'active-sources-overlay';
        this.element.innerHTML = this.render();

        document.body.appendChild(this.element);
        this.attachEvents();

        // Animate in
        requestAnimationFrame(() => {
            this.element.classList.add('open');
        });

        // Load initial images
        this.loadImages();
    }

    render() {
        const categories = Object.entries(WIKIMEDIA_CATEGORIES);

        return `
            <div class="active-sources-modal wikimedia-modal">
                <header class="asm-header">
                    <h2 class="asm-title">Visual Sources</h2>
                    <button class="asm-close" type="button" aria-label="Close">✕</button>
                </header>
                
                <!-- Category Tabs -->
                <nav class="asm-categories-nav">
                    <button class="asm-scroll-btn left" data-action="scroll-left" aria-label="Scroll left">‹</button>
                    <div class="asm-categories-scroll">
                        <div class="asm-categories">
                            ${categories.map(([id, cat]) => `
                                <button class="asm-category-tab ${id === this.currentCategory ? 'active' : ''}" 
                                        data-category="${id}">
                                    ${cat.name}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <button class="asm-scroll-btn right" data-action="scroll-right" aria-label="Scroll right">›</button>
                </nav>
                
                <!-- Image Grid -->
                <div class="asm-body">
                    <div class="asm-image-grid" id="image-grid">
                        ${this.loading ? `
                            <div class="asm-loading">
                                <span class="asm-spinner">◌</span>
                                <span>Loading diagrams...</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <footer class="asm-footer">
                    <button class="asm-refresh-btn" data-action="refresh">↻ Load More</button>
                    <button class="asm-done-btn" data-action="done">Done</button>
                </footer>
            </div>
        `;
    }

    renderImages() {
        const grid = this.element.querySelector('#image-grid');
        if (!grid) return;

        if (this.loading) {
            grid.innerHTML = `
                <div class="asm-loading">
                    <span class="asm-spinner">◌</span>
                    <span>Loading diagrams...</span>
                </div>
            `;
            return;
        }

        if (this.images.length === 0) {
            grid.innerHTML = `
                <div class="asm-empty">
                    <p>No diagrams found</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.images.map((img, idx) => `
            <div class="asm-image-card ${this.excludedImages.has(img.title) ? 'excluded' : ''}" 
                 data-index="${idx}" data-title="${escapeHtml(img.title)}">
                <div class="asm-image-thumb">
                    <img src="${safeUrl(img.url)}" alt="${escapeHtml(img.name)}" loading="lazy">
                </div>
                <div class="asm-image-info">
                    <span class="asm-image-name">${escapeHtml(img.name)}</span>
                </div>
                <button class="asm-image-toggle" title="${this.excludedImages.has(img.title) ? 'Include' : 'Exclude'}">
                    ${this.excludedImages.has(img.title) ? '✓' : '✕'}
                </button>
            </div>
        `).join('');

        // Attach toggle events
        grid.querySelectorAll('.asm-image-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.asm-image-card');
                const title = card.dataset.title;

                if (this.excludedImages.has(title)) {
                    this.excludedImages.delete(title);
                    card.classList.remove('excluded');
                    btn.textContent = '✕';
                    btn.title = 'Exclude';
                } else {
                    this.excludedImages.add(title);
                    card.classList.add('excluded');
                    btn.textContent = '✓';
                    btn.title = 'Include';
                }
            });
        });
    }

    async loadImages() {
        this.loading = true;
        this.renderImages();

        try {
            const category = WIKIMEDIA_CATEGORIES[this.currentCategory];
            if (!category) return;

            // Get image titles from category
            const imageTitles = await this._provider.getImagesInCategory(category.category, 20);

            // Fetch info for each (with thumbnail URLs)
            const imageInfoPromises = imageTitles.slice(0, 12).map(async (img) => {
                const info = await this._provider.getImageInfo(img.title);
                if (!info) return null;

                return {
                    title: img.title,
                    name: img.title.replace('File:', '').replace(/_/g, ' ').replace(/\.[^/.]+$/, ''),
                    url: info.url,
                    fullUrl: info.fullUrl,
                    artist: info.artist,
                    license: info.license
                };
            });

            const results = await Promise.all(imageInfoPromises);
            this.images = results.filter(Boolean);

        } catch (error) {
            console.error('[ActiveSources] Failed to load images:', error);
            this.images = [];
        }

        this.loading = false;
        this.renderImages();
    }

    attachEvents() {
        // Close button and overlay
        this.element.querySelector('.asm-close')?.addEventListener('click', () => this.close());
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) this.close();
        });

        // Done button
        this.element.querySelector('[data-action="done"]')?.addEventListener('click', () => this.close());

        // Refresh button
        this.element.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
            this.loadImages();
        });

        // Escape key
        this.keyHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.keyHandler);

        // Category tabs
        this.element.querySelectorAll('.asm-category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active state
                this.element.querySelectorAll('.asm-category-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Load new category
                this.currentCategory = tab.dataset.category;
                this.loadImages();

                // Scroll into view
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });
        });

        // Category scrolling
        const scrollContainer = this.element.querySelector('.asm-categories');
        this.element.querySelector('[data-action="scroll-left"]')?.addEventListener('click', () => {
            scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
        });

        this.element.querySelector('[data-action="scroll-right"]')?.addEventListener('click', () => {
            scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }

    getActiveImages() {
        return this.images.filter(img => !this.excludedImages.has(img.title));
    }

    close() {
        this.element.classList.remove('open');

        setTimeout(() => {
            document.removeEventListener('keydown', this.keyHandler);
            this.element.remove();
            this.onClose({
                excluded: Array.from(this.excludedImages),
                active: this.getActiveImages()
            });
        }, 200);
    }

    destroy() {
        this.close();
    }
}
