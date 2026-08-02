/**
 * Library Component
 * Four subsections: Archive, Sequences, Personal, History
 *
 * Design principles:
 * - Cards for browsing
 * - Metadata-rich presentation
 * - Quick preview before commitment
 */

import { LIBRARY_TEXTS, LIBRARY_CATEGORIES, DIVISIONS } from '../content/library.js';
import { escapeHtml } from '../core/sanitize.js';
import { MemoryCore } from '../core/memory.js';

/**
 * An edition statement, as a reader should see it.
 *
 * `tradition` carries the edition, and for two works it carries a
 * SOURCING MEMO instead — written for a provenance ledger and shown on
 * a card by accident:
 *
 *   trans. C. H. Brewitt-Taylor, Kelly & Walsh, Shanghai, 2 vols., 1925;
 *   scan-backed Wikisource [vol. I](https://en.wikisource.org/wiki/File:
 *   Romance_of_the_Three_Kingdoms_-_tr._Brewitt-Taylor_-_Volume_1.djvu)
 *   and [vol. II](...); `author-death-70`
 *
 * The card printed all of it, markdown and URLs and rights vocabulary,
 * because escapeHtml renders markup literally rather than resolving it.
 *
 * NOTHING TRUE IS REMOVED HERE. The link text stays and the URL goes;
 * the rights basis goes because `author-death-70` is machine
 * vocabulary that the provenance record already holds and a reader has
 * no use for. What remains is the edition, which §"every text says
 * which edition you are reading" requires and which was always the
 * point of the field.
 *
 * Applied at DISPLAY rather than in the data: the catalog is generated
 * and says so, and a statement arriving with a URL in it is a shape to
 * survive rather than an incident to patch. Two works have one today.
 */
export function editionStatement(tradition) {
    return String(tradition ?? '')
        // [label](url) → label
        .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
        // A bare URL with no link text has no label to keep.
        .replace(/\bhttps?:\/\/\S+/g, '')
        // `author-death-70` and friends: the rights basis lives in
        // provenance, where it is checked. It is not a credit.
        .replace(/`[^`]*`/g, '')
        .replace(/\s*;\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([;,.])/g, '$1')
        .trim();
}

/**
 * What to call the things in a contents sheet.
 *
 * `divisions.noun` is null whenever a work divides by TITLE rather than
 * by a counting word — Ross names his parts "The Order Of Harmony",
 * Jünger names his "Orainville" — and that null is deliberate. The
 * divider refuses to invent "Chapter" for a work that never said it,
 * and the division index test states the rule outright: "demanding one
 * would push the divider back into inventing Chapter for a work that
 * never said it."
 *
 * The sheet then called `.toLowerCase()` on it and threw, so ELEVEN
 * works could not be opened at all — Ross, Kandinsky, Okakura, the
 * Cherokee myths, the Anansi stories, Marcus Aurelius, and The Storm of
 * Steel among them. A reader clicking any of those got nothing and no
 * explanation.
 *
 * The answer is not to invent a noun here either. It is to name what is
 * actually being counted: rows in a list this Archive built, not units
 * the author declared. "11 entries" claims nothing about Ross's
 * structure; "11 chapters" would claim something false.
 */
export function contentsNoun(divisions) {
    const noun = typeof divisions?.noun === 'string' ? divisions.noun.trim() : '';
    if (noun) {
        const lower = noun.toLowerCase();
        return { one: lower, many: `${lower}s`, find: `Find a ${lower}…` };
    }
    // A titled scheme. The list is ours; the titles are the work's.
    return { one: 'entry', many: 'entries', find: 'Find a title…' };
}

export class Library {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onSelectText = options.onSelectText || (() => { });

    this.currentSection = 'archive'; // archive, sequences, personal
    this.currentFilter = 'all';
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

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
            <button class="nav-item ${this.currentSection === 'history' ? 'active' : ''}" data-section="history">Reflections</button>
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
      case 'history':
        return this.renderHistory();
      default:
        return '<p class="text-fog">Section not found</p>';
    }
  }

  /**
   * Reflections — the post-session journals sealed in the Chamber's
   * Synthesis stage. This is the read-side of the Recursion loop.
   */
  renderHistory() {
    const entries = MemoryCore.getRecursions();

    const body = entries.length === 0
      ? `
        <div class="reflections-empty">
          <span class="reflections-empty-sigil" aria-hidden="true">◌</span>
          <p class="text-fog">The archive of reflections is empty.</p>
          <p class="text-mist">Complete a session and seal a reflection in the Synthesis stage — it will be kept here.</p>
        </div>
      `
      : entries.map(entry => `
        <article class="card reflection-card">
          <div class="reflection-meta font-mono">
            <span class="reflection-date">${new Date(entry.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <span class="reflection-title text-fog">${escapeHtml(entry.sequenceTitle)}</span>
            <button class="btn-ghost-sm reflection-delete" data-action="delete-recursion" data-id="${escapeHtml(entry.id)}" title="Delete this reflection">✕</button>
          </div>
          <p class="reflection-text">${escapeHtml(entry.journal)}</p>
        </article>
      `).join('');

    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">Reflections</h2>
          <p class="text-fog">What you wrote after each session. Output becomes input; the spiral continues.</p>
        </div>
        <div class="reflections-list">
          ${body}
        </div>
      </div>
    `;
  }

  renderArchive() {
    // A shelf states its own orienting line when the reader is standing
    // in front of it; the general statement covers "All".
    const orientation = LIBRARY_CATEGORIES
      .find(c => c.id === this.currentFilter)?.orientation || '';
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">The Archive</h2>
          <p class="text-fog">Organised by resonance rather than genre — by what a work does to a reader, not the shelf a bookshop would file it on. Every text here is public domain, and says which edition you are reading.</p>
          ${this.currentFilter !== 'all' && orientation
            ? `<p class="archive-orientation text-mist">${escapeHtml(orientation)}</p>`
            : ''}
        </div>

        <!-- Two axes, as the Collections panel does for imagery: a
             reader is asking either where a work is FROM or what it is
             ABOUT, and one row of buttons would make those look like
             alternatives. Vitruvius is Western and a book about form. -->
        <div class="archive-axes">
          <div class="archive-axis">
            <div class="archive-axis-label">By tradition</div>
            <div class="section-filters">
              <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
              ${LIBRARY_CATEGORIES.filter(c => c.axis === 'tradition').map(c => `
                <button class="filter-btn ${this.currentFilter === c.id ? 'active' : ''}"
                  data-filter="${c.id}" title="${escapeHtml(c.description)}">${escapeHtml(c.name)}</button>
              `).join('')}
            </div>
          </div>
          <div class="archive-axis">
            <div class="archive-axis-label">By subject</div>
            <div class="section-filters">
              ${LIBRARY_CATEGORIES.filter(c => c.axis !== 'tradition').map(c => `
                <button class="filter-btn ${this.currentFilter === c.id ? 'active' : ''}"
                  data-filter="${c.id}" title="${escapeHtml(c.description)}">${escapeHtml(c.name)}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Grouped by division when standing at one shelf, so the
             wrapper must not impose a grid over the group headings;
             each division carries its own grid. -->
        <div class="${this.currentFilter === 'all' ? 'archive-grid' : 'archive-divisions'}">
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

    // Standing in front of ONE shelf, a reader sees its divisions:
    // classical, then literary, then esoteric — a canon in reading
    // order. Across all shelves at once the divisions would interleave
    // four traditions and say nothing, so "All" stays a flat list.
    if (this.currentFilter !== 'all') {
      const grouped = DIVISIONS
        .map(d => ({ d, items: texts.filter(t => t.division === d.id) }))
        .filter(g => g.items.length);
      // A work with no division would vanish from a grouped view —
      // the same silent-absence failure the shelves themselves guard
      // against — so anything unplaced is shown under its own heading.
      const unplaced = texts.filter(t => !t.division);
      if (unplaced.length) {
        grouped.push({ d: { id: 'other', name: 'Other', description: 'Not yet placed within this canon' }, items: unplaced });
      }
      if (grouped.length > 1) {
        return grouped.map(({ d, items }) => `
          <div class="archive-division" data-division="${d.id}">
            <div class="archive-division-head">
              <span class="archive-division-name">${escapeHtml(d.name)}</span>
              <span class="archive-division-note text-mist">${escapeHtml(d.description)}</span>
            </div>
            <div class="archive-grid">${this.renderArchiveCards(items)}</div>
          </div>
        `).join('');
      }
    }

    return this.renderArchiveCards(texts);
  }

  /**
   * What a card says the work holds.
   *
   * In the work's OWN noun where it has one — 365 chapters, 48 books,
   * 187 essays — because "verses" applied to Homer is the kind of small
   * wrongness that reads as carelessness. Every archive card used to
   * say "0 verses": a count that was wrong because the payload had not
   * loaded, in a noun that was wrong because there was only one.
   *
   * A work whose divisions could not be verified says how long it is
   * instead, which is the honest remaining fact.
   */
  holdingsPhrase(text) {
    const n = text.chapterCount;
    if (Number.isFinite(n) && n > 0) {
      // ALWAYS A COUNT AND A NOUN. Falling back to a duration for
      // undivided works put "5.2 hours" beside "12 books" in the same
      // row, and a shelf scanned by eye wants one unit, not two.
      // "Reading" is the Archive's own word where a work has none of
      // its own — still a count of things a reader can enter.
      //
      // A TITLED work has no counting word at all: Jünger's divisions
      // are Orainville and Guillemont, not "Chapter 1". "Sections" is
      // the generic that claims nothing; the contents sheet shows the
      // names themselves, which is where they belong.
      const noun = text.chapterTitled
        ? 'section'
        : (text.chapterNoun || 'verse').toLowerCase();
      return `${n} ${noun}${n === 1 ? '' : 's'}`;
    }
    if (Number.isFinite(text.wordCount) && text.wordCount > 0) {
      const hours = text.wordCount / 200 / 60;
      return hours >= 1
        ? `${hours.toFixed(hours < 10 ? 1 : 0)} hours`
        : `${Math.max(1, Math.round(hours * 60))} min`;
    }
    return '';
  }

  renderArchiveCards(texts) {
    return texts.map(text => {
      const shelf = LIBRARY_CATEGORIES.find(c => c.id === text.category);
      // Provenance is part of the reading, not a footnote: a world-class
      // housing of public-domain texts says which EDITION you are
      // holding, because a translation carries its own copyright.
      const p = text.provenance;
      const edition = p
        ? [p.translator ? `trans. ${p.translator}` : null, p.year || null]
          .filter(Boolean).join(', ')
        : '';
      return `
      <div class="archive-card card card-interactive" data-text-id="${text.id}">
        <div class="archive-card-header">
          <span class="archive-status">${shelf?.icon || '◇'}</span>
          <span class="archive-type text-fog text-uppercase">${escapeHtml(shelf?.name || text.category)}</span>
        </div>
        <h3 class="archive-title text-light">${escapeHtml(text.title)}</h3>
        <p class="archive-subtitle text-fog">${escapeHtml(text.author)} · ${escapeHtml(editionStatement(text.tradition))}</p>
        ${text.why
          ? `<p class="archive-why">${escapeHtml(text.why)}</p>`
          : `<p class="archive-description text-fog">${escapeHtml(text.description) || ''}</p>`}
        <div class="archive-card-foot">
          <div class="archive-meta text-mist font-mono">
            ${this.holdingsPhrase(text)}${edition ? ` · ${escapeHtml(edition)}` : ''}
          </div>
          <button class="btn-primary btn-sm archive-open" data-action="select-text" data-id="${text.id}">
            ${text.chapterCount > 1 ? 'Open' : 'Load Text'}
          </button>
        </div>
      </div>
    `;
    }).join('');
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
      } else if (action === 'delete-recursion' && id) {
        if (window.confirm('Delete this reflection? This cannot be undone.')) {
          MemoryCore.deleteRecursion(id);
          this.updateContent();
        }
      }
    });

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
          this.onSelectText(paper.content, `${paper.name} — Abstract`, {
            wpm: text.defaultWpm,
            curve: text.defaultCurve
          });
        } catch (err) {
          console.error('[Library] Failed to fetch ArXiv category:', err);
          if (btn) btn.textContent = 'Error';
        }
        return;
      }

      // A long work opens at its contents, not at its first word.
      // openWork returns false for anything with no verified divisions,
      // which falls through to the whole-text path below unchanged.
      if (await this.openWork(textId)) return;

      // Handle standard texts. Ingested Archive works resolve their
      // payload lazily — a reader who never opens Vitruvius should not
      // download half a megabyte of him — so this may be a promise.
      const sequences = await (typeof text.getSequences === 'function'
        ? text.getSequences()
        : (text.verses || []));

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
      this.onSelectText(fullText, text.title, {
        wpm: text.defaultWpm,
        curve: text.defaultCurve
      });

    } catch (error) {
      console.error('[Library] Failure during text selection processing:', error);
    }
  }


  // ── The table of contents ──────────────────────────────────────
  //
  // A long work is entered at a division, not at its first word. Before
  // this, choosing Moby-Dick handed the Chamber every word of it at
  // once — and choosing the Mahabharata handed it 2.9 million. The
  // reader now opens the book and chooses where to begin.
  //
  // The sheet is deliberately not a modal dialog with a list in it. It
  // is the work presenting itself: its own division noun, its own
  // numerals, and the weight of each division stated honestly in
  // minutes, so a reader can tell a two-minute lyric from an hour of
  // Montaigne before committing to it.

  /** Minutes of reading, at the work's own pace. */
  contentsMinutes(words, wpm = 200) {
    return Math.max(1, Math.round(words / wpm));
  }

  contentsDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  /**
   * Open a work. Divided works show their contents; undivided ones go
   * straight to the Chamber, because a table of contents with one row
   * is a door with a sign on it saying "door".
   */
  async openWork(textId) {
    const text = (LIBRARY_TEXTS || []).find(t => t.id === textId);
    if (!text || typeof text.getDivisions !== 'function') return false;

    const card = this.container.querySelector(`[data-text-id="${textId}"]`);
    card?.classList.add('is-opening');
    try {
      const divisions = await text.getDivisions();
      card?.classList.remove('is-opening');
      if (!divisions?.divided) return false;
      this._contents = { text, divisions, query: '' };
      this.renderContents();
      return true;
    } catch (error) {
      card?.classList.remove('is-opening');
      console.error('[Library] Could not open work:', textId, error);
      return false;
    }
  }

  contentsEntries() {
    const { divisions, query } = this._contents;
    if (!query) return divisions.entries;
    const q = query.toLowerCase();
    return divisions.entries.filter(e =>
      e.label.toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q));
  }

  renderContents() {
    const { text, divisions, query } = this._contents;
    const entries = this.contentsEntries();
    const totalWords = divisions.entries.reduce((n, e) => n + e.words, 0);
    const totalMin = this.contentsMinutes(totalWords, text.defaultWpm || 200);
    const p = text.provenance;
    const edition = p
      ? [p.translator ? `trans. ${p.translator}` : null, p.year || null].filter(Boolean).join(', ')
      : '';

    // A work with many divisions needs a way in that is not scrolling.
    // Below that count the search field is clutter.
    const searchable = divisions.entries.length > 12;

    let sheet = document.querySelector('.toc-scrim');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'toc-scrim';
      document.body.appendChild(sheet);
    }

    // A titled work has no counting word, and that null is the divider
    // keeping faith with the text rather than an omission to paper over.
    const noun = contentsNoun(divisions);

    sheet.innerHTML = `
      <div class="toc-sheet" role="dialog" aria-modal="true" aria-label="Contents of ${escapeHtml(text.title)}">
        <header class="toc-head">
          <button class="btn-ghost toc-close" data-toc="close" aria-label="Close contents">
            <span class="icon" aria-hidden="true">←</span> Shelf
          </button>
          <div class="toc-identity">
            <h2 class="toc-title text-light">${escapeHtml(text.title)}</h2>
            <p class="toc-byline text-fog">${escapeHtml(text.author)}${edition ? ` · ${escapeHtml(edition)}` : ''}</p>
          </div>
          <div class="toc-weight font-mono text-mist">
            <span class="toc-weight-count">${divisions.entries.length}</span>
            <span class="toc-weight-noun">${escapeHtml(divisions.entries.length === 1 ? noun.one : noun.many)}</span>
            <span class="toc-weight-time">${this.contentsDuration(totalMin)}</span>
          </div>
        </header>

        ${divisions.reason === 'measured' ? `
          <p class="toc-note text-mist">
            This edition carries no division scheme this Archive can verify,
            so it is offered in readings of even length rather than under
            chapter names it does not have.
          </p>` : ''}

        ${searchable ? `
          <div class="toc-search">
            <input type="search" class="toc-search-input" data-toc="search"
                   placeholder="${escapeHtml(noun.find)}"
                   value="${escapeHtml(query)}" aria-label="Filter contents">
            ${query ? `<span class="toc-search-count font-mono text-mist">${entries.length} of ${divisions.entries.length}</span>` : ''}
          </div>` : ''}

        <div class="toc-list" role="list">
          ${entries.length === 0
            ? `<p class="toc-empty text-fog">Nothing here matches “${escapeHtml(query)}”.</p>`
            : entries.map(e => {
              const min = this.contentsMinutes(e.words, text.defaultWpm || 200);
              return `
              <button class="toc-entry" role="listitem" data-toc="read" data-entry="${e.id}">
                <span class="toc-entry-mark font-mono" aria-hidden="true">${escapeHtml(this.contentsMark(e, divisions))}</span>
                <span class="toc-entry-body">
                  <span class="toc-entry-label">${escapeHtml(e.label)}</span>
                  ${e.title ? `<span class="toc-entry-title text-fog">${escapeHtml(e.title)}</span>` : ''}
                </span>
                <span class="toc-entry-time font-mono text-mist">${this.contentsDuration(min)}</span>
              </button>`;
            }).join('')}
        </div>

        <footer class="toc-foot">
          <button class="btn-ghost toc-whole" data-toc="whole">
            Read the whole work · ${this.contentsDuration(totalMin)}
          </button>
        </footer>
      </div>
    `;

    requestAnimationFrame(() => sheet.classList.add('is-open'));
    if (searchable && query) {
      const input = sheet.querySelector('.toc-search-input');
      input?.focus();
      input?.setSelectionRange(query.length, query.length);
    } else {
      sheet.querySelector('.toc-entry')?.focus();
    }
    this.attachContentsEvents(sheet);
  }

  /** The mark in the margin — the work's own numeral where it has one. */
  contentsMark(entry, divisions) {
    const m = entry.label.match(/\s([IVXLCDM]+|\d+)(?:\s|$|\()/i);
    if (m) return m[1];
    return divisions.noun === 'Reading' ? String(entry.id + 1) : '·';
  }

  attachContentsEvents(sheet) {
    if (sheet._wired) return;
    sheet._wired = true;

    sheet.addEventListener('click', (e) => {
      // The scrim closes; the sheet does not close when clicked through.
      if (e.target === sheet) return this.closeContents();
      const el = e.target.closest('[data-toc]');
      if (!el) return;
      const what = el.dataset.toc;
      window.rise?.audioEngine?.playClick?.();

      if (what === 'close') return this.closeContents();
      if (what === 'whole') return this.readWhole();
      if (what === 'read') return this.readEntry(Number(el.dataset.entry));
    });

    // Debounced so a 807-entry list is not re-rendered per keystroke.
    let timer = null;
    sheet.addEventListener('input', (e) => {
      const input = e.target.closest('[data-toc="search"]');
      if (!input) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        this._contents.query = input.value;
        this.renderContents();
      }, 120);
    });

    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.closeContents(); }
    });
  }

  closeContents() {
    const sheet = document.querySelector('.toc-scrim');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    const done = () => sheet.remove();
    sheet.addEventListener('transitionend', done, { once: true });
    // A missed transitionend must not leave a scrim over the Library.
    setTimeout(done, 400);
    this._contents = null;
  }

  readEntry(entryId) {
    const { text, divisions } = this._contents || {};
    const entry = divisions?.entries.find(e => e.id === entryId);
    if (!entry) return;
    const label = entry.title ? `${entry.label} — ${entry.title}` : entry.label;
    this.closeContents();
    this.onSelectText(entry.content, `${text.title} · ${label}`, {
      wpm: text.defaultWpm,
      curve: text.defaultCurve
    });
  }

  readWhole() {
    const { text, divisions } = this._contents || {};
    if (!divisions) return;
    const full = divisions.entries.map(e => e.content).join('\n\n');
    this.closeContents();
    this.onSelectText(full, text.title, {
      wpm: text.defaultWpm,
      curve: text.defaultCurve
    });
  }

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  activate() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.deactivate();
  }
}
