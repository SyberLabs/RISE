/**
 * Library Component
 * Four subsections: Archive, Sequences, Personal, History
 *
 * Design principles:
 * - Cards for browsing
 * - Metadata-rich presentation
 * - Quick preview before commitment
 */

import { LIBRARY_TEXTS } from '../content/library.js';

export class Library {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onSelectText = options.onSelectText || (() => { });

    this.currentSection = 'archive'; // archive, sequences, personal
    this.currentFilter = 'all';

    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="library" role="main">
        <!-- Header -->
        <header class="library-header">
          <div class="library-title-section">
            <button class="btn-ghost" data-action="back">
              <span class="icon">←</span>
              <span>Portal</span>
            </button>
            <h1>Library</h1>
          </div>

          <!-- Top Explanatory Panel -->
          <div class="library-intro-panel text-fog">
            The Library contains foundational texts, historical literature, and modular content blocks. 
            Choose a source text to configure its playback parameters in the Chamber.
          </div>

          <!-- Section Navigation -->
          <nav class="library-nav nav" aria-label="Library sections">
            <button class="nav-item ${this.currentSection === 'archive' ? 'active' : ''}" data-section="archive">The Archive</button>
            <button class="nav-item ${this.currentSection === 'personal' ? 'active' : ''}" data-section="personal">Local Files</button>
          </nav>
        </header>

        <!-- Content Area -->
        <div class="library-content" id="library-content">
          ${this.renderSection(this.currentSection)}
        </div>
      </div>
    `;

    this.updateActiveNav();
  }

  renderSection(section) {
    switch (section) {
      case 'archive':
        return this.renderArchive();
      case 'personal':
        return this.renderPersonal();
      default:
        return '<p class="text-fog">Section not found</p>';
    }
  }

  renderArchive() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">The Archive</h2>
          <p class="text-fog">Foundational texts, wisdom traditions, and research</p>
        </div>

        <div class="section-filters" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem;">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="foundational">Foundational</button>
          <button class="filter-btn" data-filter="sacred">Sacred</button>
          <button class="filter-btn" data-filter="literary">Literary</button>
          <button class="filter-btn" data-filter="research">Research</button>
          <button class="filter-btn" data-filter="declassified">Declassified</button>
        </div>

        <div class="archive-grid">
          ${this.renderArchiveItems()}
        </div>
      </div>
    `;
  }

  renderArchiveItems() {
    // Get library texts
    let texts = LIBRARY_TEXTS || [];

    // Filter by category
    if (this.currentFilter !== 'all') {
      texts = texts.filter(t => t.category.toLowerCase() === this.currentFilter.toLowerCase());
    }

    if (texts.length === 0) {
      return '<div class="empty-state"><p class="text-fog">No texts in this category</p></div>';
    }

    return texts.map(text => `
      <div class="archive-card card card-interactive" data-text-id="${text.id}">
        <div class="archive-card-header">
          <span class="archive-status">◇</span>
          <span class="archive-type text-fog text-uppercase">${text.category}</span>
        </div>
        <h3 class="archive-title text-light">${text.title}</h3>
        <p class="archive-subtitle text-fog">${text.author} · ${text.tradition}</p>
        <p class="archive-description text-fog" style="font-size: 0.9rem; margin-top: 0.5rem;">
          ${text.description || ''}
        </p>
        <div class="archive-meta text-mist font-mono" style="margin-top: 0.75rem; font-size: 0.85rem;">
          ${text.chapterCount || 0} ${text.chapterCount === 1 ? 'chapter' : 'verses'}
        </div>
        <button class="btn-primary btn-sm" style="margin-top: 1rem;" data-action="select-text" data-id="${text.id}">
          Load Text
        </button>
      </div>
    `).join('');
  }

  renderPersonal() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">Local Experience Files</h2>
          <p class="text-fog">Your own content added to the library</p>
        </div>

        <div class="personal-upload-zone" id="personal-upload-zone">
          <input type="file" id="local-file-input" accept=".txt,.md" hidden />
          <label for="local-file-input" class="upload-zone-label">
            <span class="upload-icon">◇</span>
            <p class="upload-text text-light">Drop file here or click to browse</p>
            <p class="upload-hint text-fog">Supports .txt and .md files</p>
          </label>
        </div>

        <div class="personal-instructions text-fog">
          Upload your own text files to experience them through R.I.S.E.'s
          audiovisual reading interface. All processing happens locally.
        </div>
      </div>
    `;
  }

  attachFileUploadEvents() {
    const fileInput = this.container.querySelector('#local-file-input');
    const uploadZone = this.container.querySelector('#personal-upload-zone');

    if (!fileInput || !uploadZone) return;

    // Click to upload
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileUpload(file);
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFileUpload(file);
    });
  }

  async handleFileUpload(file) {
    const validTypes = ['text/plain', 'text/markdown', ''];
    const validExtensions = ['.txt', '.md'];

    // Validate file
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      console.error('[Library] Invalid file type:', file.type);
      return;
    }

    try {
      const text = await file.text();
      if (text.trim().length === 0) {
        console.error('[Library] File is empty');
        return;
      }

      // Use filename as source name
      const sourceName = file.name.replace(/\.[^.]+$/, '');
      this.onSelectText(text, `Local: ${sourceName}`);
    } catch (err) {
      console.error('[Library] Failed to read file:', err);
    }
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      if (window.rise?.audioEngine) {
        window.rise.audioEngine.playClick();
      }
      this.onNavigate('portal');
    });

    // Section navigation
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.playHiss();
        }
        this.currentSection = item.dataset.section;
        this.updateContent();
        this.updateActiveNav();
      });
    });

    // Category filters (delegated or direct)
    this.container.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.filter-btn');
      if (filterBtn) {
        // Only trigger update if it's a new filter
        if (this.currentFilter !== filterBtn.dataset.filter) {
          if (window.rise?.audioEngine) {
            window.rise.audioEngine.playHiss();
          }
          this.currentFilter = filterBtn.dataset.filter;
          this.updateContent();

          // Must re-query since DOM was just replaced by updateContent
          const parent = this.container.querySelector('.section-filters');
          if (parent) {
            parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const newActive = parent.querySelector(`[data-filter="${this.currentFilter}"]`);
            if (newActive) newActive.classList.add('active');
          }
        }
        return;
      }

      const target = e.target.closest('[data-action]');
      if (!target) return;

      if (window.rise?.audioEngine) {
        window.rise.audioEngine.playClick();
      }

      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'preview' && id) {
        console.log('Preview sequence:', id);
      } else if (action === 'select-text' && id) {
        this.handleTextSelection(id);
      }
    });

    // Keyboard
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') {
      this.onNavigate('portal');
    }
  }

  updateContent() {
    const content = this.container.querySelector('#library-content');
    if (content) {
      content.innerHTML = this.renderSection(this.currentSection);
      // Re-attach file upload events if in personal section
      if (this.currentSection === 'personal') {
        this.attachFileUploadEvents();
      }
    }
  }

  updateActiveNav() {
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      if (item.dataset.section === this.currentSection) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  async handleTextSelection(textId) {
    try {
      // Import library utilities dynamically
      const { getTextById } = await import('../content/library.js');
      const text = getTextById(textId);

      if (!text) {
        console.error('[Library] Text not found:', textId);
        return;
      }

      // Handle async collections (e.g. ArXiv)
      if (text.isCollection && text.provider === 'arxiv-research') {
        const btn = this.container.querySelector(`button[data-id="${textId}"]`);
        const originalText = btn ? btn.textContent : 'Load Text';
        if (btn) btn.textContent = 'Fetching...';

        const { ArxivProvider } = await import('../sources/text/arxiv.js');
        const provider = new ArxivProvider();

        try {
          const result = await provider.get(text.arxivCategory);
          if (btn) btn.textContent = originalText;

          if (!result || !result.data || result.data.length === 0) {
            console.error('[Library] No papers found in category:', text.arxivCategory);
            return;
          }

          // Just picking the first recent paper for the chamber
          const paper = result.data[0];
          this.onSelectText(paper.content, `${paper.name} — Abstract`);
        } catch (err) {
          console.error('[Library] Failed to fetch ArXiv category:', err);
          if (btn) btn.textContent = 'Error';
        }
        return;
      }

      // Handle standard texts
      const sequences = typeof text.getSequences === 'function' ? text.getSequences() : (text.verses || []);

      if (!sequences || sequences.length === 0) {
        console.error('[Library] No verses available for text:', textId);
        return;
      }

      // Concatenate ALL sequences into full text for complete experience
      const fullText = sequences
        .map(verse => verse.content || verse)
        .filter(content => content && content.trim())
        .join('\n\n');

      if (!fullText) {
        console.error('[Library] Extracted text is empty or invalid');
        return;
      }

      const wordCount = fullText.split(/\s+/).filter(w => w).length;
      console.log(`[Library] Selected full text: ${wordCount} words from ${sequences.length} segments`);

      // Call the callback with full text and source
      this.onSelectText(fullText, text.title);

    } catch (error) {
      console.error('[Library] Failure during text selection processing:', error);
    }
  }

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyboard.bind(this));
  }
}
