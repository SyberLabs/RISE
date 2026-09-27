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
import { mostlyVerse } from '../content/archive/divisions.js';
// The shelf says which state a reader is in. It asks per work, so the
// line shrinks and then disappears as certifications land.
import { escapeHtml } from '../core/sanitize.js';
import { MemoryCore } from '../core/memory.js';
import { LocalWorks } from '../core/local-work-store.js';
import { localWorkRuntime } from '../core/local-works.js';
import { Admit } from './Admit.js';
import { attachJevDictation } from './jev-dictation.js';
import { drawRiseSigil } from './atlas.js';
import './Library.css';

/**
 * Edition statement for display: keep link labels, drop URLs and
 * machine rights tokens (`author-death-70`); provenance already holds
 * those. Applied at display, not in generated catalog data.
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
 * One edition line per work: who published this text, and which edition it
 * is, with ONE year.
 *
 * The catalog's `tradition` reads "Standard Ebooks, 1870" while the
 * provenance record — the field that carries its evidence — says the Lang,
 * Leaf and Myers Iliad is the 1883 edition. Showing both put two years on one
 * card. Where a provenance record exists its year wins, because it is the one
 * that was checked; the publisher keeps its name and loses its year.
 */
export function editionLine(text) {
    const statement = editionStatement(text?.tradition);
    const p = text?.provenance;
    if (!p || !p.year) return statement;
    const publisher = statement.replace(/,\s*\d{3,4}(?:[–-]\d{2,4})?$/, '').trim();
    const year = String(p.year);
    let edition = typeof p.edition === 'string' && p.edition.trim()
        ? p.edition.trim()
        : [p.translator ? `trans. ${p.translator}` : null, year].filter(Boolean).join(', ');
    if (!edition.includes(year) && !/\d{4}/.test(edition)) edition = `${edition}, ${year}`;
    return [publisher, edition].filter(Boolean).join(' · ');
}

const ICON = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const ARROW_LEFT = `<svg ${ICON}><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>`;
const ARROW_RIGHT = `<svg class="archive-arrow" ${ICON}><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;
const SPINNER = `<svg class="library-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" stroke-opacity=".25"></circle><path d="M21 12a9 9 0 0 0-9-9"></path></svg>`;
const ALERT_ICON = `<svg ${ICON}><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`;
const CLOSE_ICON = `<svg ${ICON}><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;

/** An inline alert: icon, one plain sentence, no coloured background. */
function alertHtml(message) {
    return `<div class="library-alert" role="alert">${ALERT_ICON}<p>${escapeHtml(message)}</p></div>`;
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
    this.readingPreferences = options.readingPreferences || null;
    const selectText = options.onSelectText || (() => { });
    this.onSelectText = (...args) => {
      const preferences = this.readingPreferences;
      if (!preferences) return selectText(...args);
      const [text, source, config = {}] = args;
      const { visualMode, ...reading } = preferences;
      return selectText(text, source, {
        ...config,
        ...reading,
        visualConfig: visualMode
          ? { ...config.visualConfig, visualMode }
          : config.visualConfig
      });
    };
    this.getAudioEngine = options.getAudioEngine || (() => null);

    this.currentSection = 'archive'; // archive, sequences, personal
    // A SHELF IS ALWAYS CHOSEN. There are two, and "All" over two shelves
    // renders one flat list of unlike things — a Wordsworth ballad beside an
    // induction written here — which is the distinction the shelves exist to
    // make.
    this.currentFilter = 'received';
    this.localWorks = [];
    // 'loading' until the first IndexedDB read lands, then 'ready' or
    // 'error'. Each is drawn: a tab never shows a blank where a state is.
    this.localState = 'loading';
    this.localAlert = '';
    this.jevRecommendation = null;
    this.jevIntent = options.initialIntent || '';
    this.jevAbort = null;
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

    this.render();
    this.attachEvents();
    this.attachJevDictation();
    this.refreshLocalWorks();
    if (this.jevIntent) {
      void this.recommendWithJev(this.container.querySelector('[data-jev-form]'));
    }
  }

  update(data) {
    this.readingPreferences = data?.readingPreferences || null;
    if (!data?.jevIntent) return;
    this.jevIntent = data.jevIntent;
    this.updateContent();
    const form = this.container.querySelector('[data-jev-form]');
    if (form) void this.recommendWithJev(form);
  }

  render() {
    this.container.innerHTML = `
      <div class="library library-room">
        <header class="sl-header">
          <div class="sl-header-inner">
            <span class="sl-lockup" role="img" aria-label="SyberLabs RISE">
              <img class="sl-mark" src="/syberlabs-mark.webp" alt="" width="18" height="20" decoding="async">
              <span class="sl-wordmark" aria-hidden="true">SYBERLABS<span class="sl-divider"> / </span>RISE</span>
              <canvas class="sl-sigil" aria-hidden="true"></canvas>
            </span>
          </div>
        </header>

        <!-- ONE COLUMN. The back link, the title, the tabs and every row
             share the same left edge; the header used to start at 32px and
             the content at 120px. -->
        <div class="library-page" role="main">
          <div class="library-head">
            <button class="library-back" type="button" data-action="back">${ARROW_LEFT}<span>Home</span></button>
            <h1>Library</h1>
            <p class="library-intro-panel">
              Works in named editions, texts written for RISE, and files on this device. Open a work to read it whole or choose where to begin.
            </p>
            <nav class="library-nav nav" aria-label="Library sections">
              <button class="nav-item" type="button" data-section="archive">Works</button>
              <button class="nav-item" type="button" data-section="personal">Your files</button>
              <button class="nav-item" type="button" data-section="history">Reflections</button>
            </nav>
          </div>

          <div class="library-content" id="library-content">
            ${this.renderSection(this.currentSection)}
          </div>
        </div>
      </div>
    `;

    drawRiseSigil(this.container.querySelector('.sl-sigil'), { animate: false });
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
        return '<p class="library-note">Section not found.</p>';
    }
  }

  /**
   * Reflections — the post-session journals sealed in the Chamber's
   * Synthesis stage. This is the read-side of the Recursion loop.
   */
  renderHistory() {
    let entries;
    try {
      entries = MemoryCore.getRecursions();
    } catch (error) {
      console.error('[Library] Could not read reflections:', error);
      return `<div class="library-section">${alertHtml('Your reflections could not be read in this browser.')}</div>`;
    }

    if (!entries.length) {
      return `
        <div class="library-section">
          <div class="library-empty">
            <h2>No reflections yet.</h2>
            <p>Save a reflection after a reading and it will appear here.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="library-section">
        <ul class="reflections-list">
          ${entries.map(entry => `
          <li class="reflection-card">
            <div class="reflection-meta">
              <span class="reflection-date">${new Date(entry.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              <span class="reflection-title">${escapeHtml(entry.sequenceTitle)}</span>
              <button class="library-icon-btn reflection-delete" type="button" data-action="delete-recursion" data-id="${escapeHtml(entry.id)}" aria-label="Delete this reflection">${CLOSE_ICON}</button>
            </div>
            <p class="reflection-text">${escapeHtml(entry.journal)}</p>
          </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderArchive() {
    // A shelf states its own orienting line when the reader is standing
    // in front of it.
    const shelf = LIBRARY_CATEGORIES.find(c => c.id === this.currentFilter);
    return `
      <div class="library-section">
        <!-- The tabs already say where the reader is; a heading repeating
             them, and paragraphs describing the pipeline, were deleted. -->

        <section class="library-jev" aria-labelledby="library-jev-title">
          <h2 id="library-jev-title">Find your next reading with Jev</h2>
          <p>Describe what you want to explore. Jev chooses from the Standard Ebooks editions already held by RISE.</p>
          <form data-jev-form>
            <label for="library-jev-intent">What are you in the mood to read?</label>
            <div class="library-jev-controls">
              <input id="library-jev-intent" name="intent" type="text" minlength="3" maxlength="240" required
                value="${escapeHtml(this.jevIntent)}"
                placeholder="A thoughtful book about change and courage">
              <button class="library-jev-dictate" data-jev-dictate="icon" type="button" aria-label="Speak your Jev request" aria-pressed="false"></button>
              <button class="btn-primary" type="submit">Ask Jev</button>
            </div>
            <p class="library-jev-voice-note">Voice input may use your browser’s speech service. Review the text before asking Jev.</p>
            <span data-jev-dictation-status role="status" aria-live="polite"></span>
          </form>
          <div class="library-jev-result" data-jev-result aria-live="polite">${this.renderJevRecommendation()}</div>
        </section>

        <!-- ONE QUESTION, ASKED FIRST: did RISE receive this work, or write
             it? Provenance is what the Archive promises to keep, so it is the
             cut a reader makes before any other. -->
        <div class="archive-axes">
          <div class="archive-axis">
            <div class="section-filters" role="group" aria-label="Shelf">
              ${LIBRARY_CATEGORIES.map(c => `
                <button class="filter-btn ${this.currentFilter === c.id ? 'active' : ''}" type="button"
                  data-filter="${c.id}" aria-pressed="${this.currentFilter === c.id}" title="${escapeHtml(c.description)}">${escapeHtml(c.name)}</button>
              `).join('')}
            </div>
          </div>
          ${shelf?.orientation
            ? `<p class="archive-orientation">${escapeHtml(shelf.orientation)}</p>`
            : ''}
        </div>

        <div class="library-alert-slot" data-archive-alert></div>

        <!-- Always grouped by division, so the wrapper must not impose a
             grid over the group headings; each division carries its own. -->
        <div class="archive-divisions">
          ${this.renderArchiveItems()}
        </div>
      </div>
    `;
  }

  renderJevRecommendation() {
    const choice = this.jevRecommendation;
    if (!choice) return '';
    const book = LIBRARY_TEXTS.find(text => text.id === choice.workId
      && text.provider === 'archive-ingest'
      && text.editionId === choice.editionId
      && text.sourceRevision === choice.sourceRevision);
    if (!book) return '';
    return `<div class="library-jev-choice">
      <span class="library-jev-kicker">Jev chose</span>
      <h3>${escapeHtml(book.title)}</h3>
      <p class="library-jev-author">${escapeHtml(book.author)} · Standard Ebooks</p>
      <p>About this book: ${escapeHtml(choice.reason || book.description)}</p>
      <button class="btn-primary" data-action="open-jev" data-id="${escapeHtml(book.id)}">Open this book</button>
      <details><summary>Decision details</summary>
        <p>Model: ${escapeHtml(choice.model)} · Request: ${escapeHtml(choice.requestId)} · ${choice.decisionCacheStatus === 'hit' ? 'Reused cached Jev choice' : 'New Jev choice'}</p>
      </details>
    </div>`;
  }

  async recommendWithJev(form) {
    const input = form.elements.namedItem('intent');
    const intent = String(input?.value || '').trim();
    if (intent.length < 3 || intent.length > 240) return;
    this.jevIntent = intent;
    this.jevRecommendation = null;
    this.jevAbort?.abort();
    const controller = new AbortController();
    this.jevAbort = controller;
    const button = form.querySelector('button[type="submit"]');
    const result = this.container.querySelector('[data-jev-result]');
    if (button) button.disabled = true;
    if (result) result.innerHTML = `<p class="library-status" role="status">${SPINNER}<span>Jev is choosing your reading…</span></p>`;
    if (button) button.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/jev-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, schemaVersion: 3 }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error?.message || 'Jev is unavailable right now.');
      const { validateJevRecommendation } = await import('../app/jev-reading.js');
      validateJevRecommendation(data);
      const book = LIBRARY_TEXTS.find(text => text.id === data.workId
        && text.provider === 'archive-ingest'
        && text.editionId === data.editionId
        && text.sourceRevision === data.sourceRevision);
      if (!book || typeof data.model !== 'string' || typeof data.requestId !== 'string') {
        throw new Error('The selected edition is not available in this RISE release.');
      }
      if (this.jevAbort !== controller) return;
      this.jevRecommendation = data;
      if (result) result.innerHTML = this.renderJevRecommendation();
    } catch (error) {
      if (error?.name === 'AbortError' || this.jevAbort !== controller) return;
      // A network failure reads "Failed to fetch"; that is the browser's
      // sentence, not ours.
      const plain = error instanceof TypeError || error instanceof SyntaxError
        ? 'Jev is unavailable right now. Try again.'
        : (error.message || 'Jev is unavailable right now.');
      if (result) result.innerHTML = alertHtml(plain);
    } finally {
      if (this.jevAbort === controller) {
        this.jevAbort = null;
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
      }
    }
  }

  renderArchiveItems() {
    let texts = LIBRARY_TEXTS || [];

    texts = texts.filter(t => t.category === this.currentFilter);

    if (texts.length === 0) {
      return `<div class="library-empty">
        <h2>Nothing on this shelf yet.</h2>
        <p>Works appear here once their editions are checked.</p>
      </div>`;
    }

    // A reader standing at a shelf sees its forms in reading order: what
    // was sung, then staged, then taught, then argued, then told at length.
    {
      const grouped = DIVISIONS
        .filter(d => d.shelf === this.currentFilter)
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
              <h2 class="archive-division-name">${escapeHtml(d.name)}</h2>
              <p class="archive-division-note">${escapeHtml(d.description)}</p>
            </div>
            <ul class="archive-list">${this.renderArchiveCards(items)}</ul>
          </div>
        `).join('');
      }
    }

    return `<ul class="archive-list">${this.renderArchiveCards(texts)}</ul>`;
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
    // No counting word and one division: "1 entry" says nothing, so the
    // length is the honest fact instead.
    if (Number.isFinite(n) && (n > 1 || (n === 1 && text.chapterNoun))) {
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
      //
      // NO COUNTING WORD IS NOT "VERSE". The division index records none
      // for most received works, and the fallback printed "24 verses" for
      // the Iliad and "87 verses" for Middlemarch. The row now uses the
      // contents sheet's own word, so row and sheet agree.
      const noun = contentsNoun({ noun: text.chapterTitled ? null : text.chapterNoun });
      return `${n} ${n === 1 ? noun.one : noun.many}`;
    }
    if (Number.isFinite(text.wordCount) && text.wordCount > 0) {
      const hours = text.wordCount / 200 / 60;
      return this.contentsDuration(Math.max(1, Math.round(hours * 60)));
    }
    return '';
  }

  /**
   * One hairline row per work. The title is the button, and its hit area is
   * stretched over the whole row, so the row opens the work while a screen
   * reader hears one control named for the book. No per-row button: sixteen
   * filled "Open" buttons on one screen was sixteen primary actions.
   */
  renderArchiveCards(texts) {
    return texts.map(text => {
      const holdings = this.holdingsPhrase(text);
      const blurb = text.why || text.description || '';
      return `
      <li class="archive-card" data-text-id="${escapeHtml(text.id)}">
        <h3 class="archive-title">
          <button class="archive-open" type="button" data-action="select-text" data-id="${escapeHtml(text.id)}">${escapeHtml(text.title)}</button>
        </h3>
        <p class="archive-subtitle">${escapeHtml(text.author)}${editionLine(text) ? ` · ${escapeHtml(editionLine(text))}` : ''}</p>
        ${blurb ? `<p class="archive-why">${escapeHtml(blurb)}</p>` : ''}
        ${holdings ? `<span class="archive-meta">${escapeHtml(holdings)}</span>` : ''}
        <span class="archive-go" aria-hidden="true">${ARROW_RIGHT}${SPINNER}</span>
      </li>
    `;
    }).join('');
  }

  renderPersonal() {
    const empty = this.localState === 'ready' && !this.localWorks.length;
    return `
      <div class="library-section">
        <div class="personal-upload-zone" id="personal-upload-zone">
          <input type="file" id="local-file-input" accept=".txt,.md" hidden />
          <h2 class="upload-text">${empty ? 'No files yet.' : 'Add a file'}</h2>
          <p class="upload-hint">Drop a .txt or .md file here, or choose one. It stays on this device; you can name its parts or read it straight through.</p>
          <button class="btn-secondary" type="button" data-action="choose-file">Choose a file</button>
        </div>

        <div class="library-alert-slot" data-local-alert>${this.localAlert ? alertHtml(this.localAlert) : ''}</div>

        ${this.renderLocalShelf()}
      </div>
    `;
  }

  /**
   * The shelf — works a reader admitted, with what the Scriptorium can see.
   *
   * The part count is shown because it is the thing that makes a work
   * addressable: a score can name `#4` of a work with four parts and cannot
   * name anything at all in a work with one.
   */
  renderLocalShelf() {
    if (this.localState === 'loading') {
      return `<p class="library-status" role="status">${SPINNER}<span>Loading your files…</span></p>`;
    }
    if (this.localState === 'error') {
      return alertHtml('Saved files cannot be shown in this browser. You can still choose a file to read it.');
    }
    if (!this.localWorks.length) return '';
    const items = this.localWorks.map(work => {
      const parts = work.labels.length;
      return `
        <li class="local-work" data-local-id="${escapeHtml(work.id)}">
          <div class="local-work-body">
            <h3>${escapeHtml(work.title)}</h3>
            <p>${parts} ${parts === 1 ? 'part' : 'parts'} · ${escapeHtml(work.id)}</p>
          </div>
          <div class="local-work-actions">
            <button class="btn-ghost" type="button" data-action="drop-local">Remove</button>
            <button class="btn-ghost" type="button" data-action="edit-local">Divide</button>
            <button class="btn-secondary" type="button" data-action="open-local">Read</button>
          </div>
        </li>
      `;
    }).join('');
    return `<ul class="local-work-shelf">${items}</ul>`;
  }

  /**
   * The shelf is read from IndexedDB and the section renders synchronously,
   * so the list arrives on a second paint. An empty shelf renders as nothing
   * at all rather than as "no texts" — a reader who has never added a file is
   * being told about an absence they already know about.
   */
  async refreshLocalWorks() {
    try {
      this.localWorks = await LocalWorks.all();
      this.localState = 'ready';
    } catch {
      // No IndexedDB (private mode, an old browser): the drop zone still
      // works and still reaches the Chamber. Only the shelf is unavailable,
      // and the tab says so rather than showing nothing.
      this.localWorks = [];
      this.localState = 'error';
    }
    if (this.currentSection === 'personal') this.updateContent();
  }

  /**
   * The room a dropped file opens into.
   *
   * Both exits are wired here because both are real: admitting puts the work
   * on the shelf where a score can point at its parts, and reading goes
   * straight to the Chamber the way a dropped file always has.
   */
  openAdmit(options) {
    return new Admit({
      ...options,
      onReadNow: (text, title) => this.onSelectText(text, `Local: ${title}`),
      onAdmit: async record => {
        try {
          await LocalWorks.save(record);
          await this.refreshLocalWorks();
        } catch (error) {
          console.error('[Library] Could not shelve this work:', error);
          // The work is not lost for being unshelvable: the reader still
          // gets the reading they asked for.
          this.onSelectText(record.text, `Local: ${record.title}`);
        }
      }
    });
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
    const validExtensions = ['.txt', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    this.setLocalAlert('');
    if (!validExtensions.includes(ext)) {
      console.error('[Library] Invalid file type:', file.type);
      this.setLocalAlert('That file type cannot be read. Choose a .txt or .md file.');
      return;
    }

    try {
      const text = await file.text();
      if (text.trim().length === 0) {
        console.error('[Library] File is empty');
        this.setLocalAlert('That file is empty. Choose a file with text in it.');
        return;
      }
      this.openAdmit({ text, sourceName: file.name });
    } catch (err) {
      console.error('[Library] Failed to read file:', err);
      this.setLocalAlert('That file could not be read. Try again.');
    }
  }

  /** Say what went wrong with a file, in the tab, where the reader is looking. */
  setLocalAlert(message) {
    this.localAlert = message;
    const slot = this.container.querySelector('[data-local-alert]');
    if (slot) slot.innerHTML = message ? alertHtml(message) : '';
  }

  /** Say that a work would not open, above the shelf it was chosen from. */
  setArchiveAlert(message) {
    const slot = this.container.querySelector('[data-archive-alert]');
    if (slot) slot.innerHTML = message ? alertHtml(message) : '';
  }

  attachEvents() {
    // Back button
    this.container.querySelector('.library-back[data-action="back"]')?.addEventListener('click', () => {
      this.getAudioEngine()?.playClick();
      this.onNavigate('portal');
    });

    // Section navigation
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        this.getAudioEngine()?.playHiss();
        this.currentSection = item.dataset.section;
        this.updateContent();
        this.updateActiveNav();
        if (this.currentSection === 'personal') this.refreshLocalWorks();
      });
    });

    // Category filters (delegated or direct)
    this.container.querySelector('#library-content')?.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-jev-form]');
      if (!form) return;
      e.preventDefault();
      this.recommendWithJev(form);
    });
    this.container.querySelector('#library-content')?.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.filter-btn');
      if (filterBtn) {
        // Only trigger update if it's a new filter
        if (this.currentFilter !== filterBtn.dataset.filter) {
          this.getAudioEngine()?.playHiss();
          this.currentFilter = filterBtn.dataset.filter;
          this.updateContent();
        }
        return;
      }

      const target = e.target.closest('[data-action]');
      if (!target) return;

      this.getAudioEngine()?.playClick();

      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'choose-file') {
        this.container.querySelector('#local-file-input')?.click();
      } else if (action === 'preview' && id) {
        console.log('Preview sequence:', id);
      } else if (action === 'open-jev' && id && this.jevRecommendation?.workId === id) {
        this.handleTextSelection(id);
      } else if (action === 'select-text' && id) {
        this.handleTextSelection(id);
      } else if (action === 'open-local' || action === 'edit-local' || action === 'drop-local') {
        this.handleLocalWork(action, target.closest('[data-local-id]')?.dataset.localId);
      } else if (action === 'delete-recursion' && id) {
        if (window.confirm('Delete this reflection? This cannot be undone.')) {
          MemoryCore.deleteRecursion(id);
          this.updateContent();
        }
      }
    });

  }

  /**
   * The shelf's three verbs. The id is read off the card rather than off the
   * button, so a card's buttons cannot disagree about which work they are on.
   */
  async handleLocalWork(action, id) {
    const work = this.localWorks.find(record => record.id === id);
    if (!work) return;

    if (action === 'open-local') {
      // A divided work opens at its contents, exactly as a divided archive
      // work does — the parts are named and addressable, and handing back the
      // whole text would be showing a reader a book they had already indexed
      // as one undifferentiated run. `openWork` returns false for a work of
      // one part, which falls through to the whole text below.
      if (await this.openWork(id)) return;
      return this.onSelectText(work.text, work.title);
    }
    if (action === 'edit-local') return void this.openAdmit({ record: work });
    if (action === 'drop-local') {
      // A reader's own writing, and the only copy this device holds of the
      // joints they placed in it. Ask.
      if (!window.confirm(`Remove "${work.title}" from your Library? The file on your computer is untouched.`)) return;
      await LocalWorks.drop(id);
      await this.refreshLocalWorks();
    }
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') {
      this.onNavigate('portal');
    }
  }

  updateContent() {
    this.stopJevDictation?.();
    const content = this.container.querySelector('#library-content');
    if (content) {
      content.innerHTML = this.renderSection(this.currentSection);
      // Re-attach file upload events if in personal section
      if (this.currentSection === 'personal') {
        this.attachFileUploadEvents();
      }
      this.attachJevDictation();
    }
  }

  attachJevDictation() {
    const form = this.container.querySelector('[data-jev-form]');
    this.stopJevDictation = form ? attachJevDictation(form) : null;
  }

  updateActiveNav() {
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      if (item.dataset.section === this.currentSection) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });
  }

  async handleTextSelection(textId) {
    const failed = 'This work could not be opened. Try again.';
    // The row acknowledges the click while the payload is fetched — these
    // are whole books and the wait is real.
    const card = this.container.querySelector(`[data-text-id="${textId}"]`);
    card?.classList.add('is-opening');
    card?.setAttribute('aria-busy', 'true');
    this.setArchiveAlert('');
    try {
      const { getTextById } = await import('../content/library.js');
      const text = getTextById(textId);

      if (!text) {
        console.error('[Library] Text not found:', textId);
        this.setArchiveAlert(failed);
        return;
      }

      // Handle async collections (e.g. ArXiv)
      if (text.isCollection && text.provider === 'arxiv-research') {
        const btn = this.container.querySelector(`button[data-id="${textId}"]`);
        const originalText = btn ? btn.textContent : '';
        if (btn) btn.textContent = 'Fetching...';

        const { ArxivProvider } = await import('../sources/text/arxiv.js');
        const provider = new ArxivProvider();

        try {
          const result = await provider.get(text.arxivCategory);
          if (btn) btn.textContent = originalText;

          if (!result || !result.data || result.data.length === 0) {
            console.error('[Library] No papers found in category:', text.arxivCategory);
            this.setArchiveAlert(failed);
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
          if (btn) btn.textContent = originalText;
          this.setArchiveAlert(failed);
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
        this.setArchiveAlert(failed);
        return;
      }

      // Concatenate ALL sequences into full text for complete experience
      const fullText = sequences
        .map(verse => verse.content || verse)
        .filter(content => content && content.trim())
        .join('\n\n');

      if (!fullText) {
        console.error('[Library] Extracted text is empty or invalid');
        this.setArchiveAlert(failed);
        return;
      }

      const wordCount = fullText.split(/\s+/).filter(w => w).length;
      console.log(`[Library] Selected full text: ${wordCount} words from ${sequences.length} segments`);

      // Call the callback with full text and source
      this.onSelectText(fullText, text.title, {
        wpm: text.defaultWpm,
        curve: text.defaultCurve,
        // Where to look, not a claim: visual direction verifies the exact
        // text against the released work before treating it as catalog.
        provenance: { kind: 'library-work', workId: text.workId || text.id }
      });

    } catch (error) {
      console.error('[Library] Failure during text selection processing:', error);
      this.setArchiveAlert(failed);
    } finally {
      card?.classList.remove('is-opening');
      card?.removeAttribute('aria-busy');
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
  /**
   * A shelved work, in the shape this room already knows how to open.
   *
   * `localWorkRuntime` answers the same questions an archive work answers —
   * that is what it exists for — so the contents sheet, `readEntry` and
   * `readWhole` all work on it unchanged. One code path opening two kinds of
   * work is the only arrangement in which they cannot drift apart.
   */
  localRuntime(id) {
    const record = this.localWorks.find(work => work.id === id);
    return record ? localWorkRuntime(record) : null;
  }

  async openWork(textId) {
    const text = (LIBRARY_TEXTS || []).find(t => t.id === textId)
      || this.localRuntime(textId);
    if (!text || typeof text.getDivisions !== 'function') return false;

    try {
      const divisions = await text.getDivisions();
      if (!divisions?.divided) return false;
      this._contents = { text, divisions, query: '' };
      this.renderContents();
      return true;
    } catch (error) {
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
    const edition = editionLine(text);

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
          <button class="library-back toc-close" type="button" data-toc="close">${ARROW_LEFT}<span>Library</span></button>
          <div class="toc-identity">
            <h2 class="toc-title">${escapeHtml(text.title)}</h2>
            <p class="toc-byline">${escapeHtml(text.author)}${edition ? ` · ${escapeHtml(edition)}` : ''}</p>
          </div>
          <div class="toc-weight">
            <span class="toc-weight-count">${divisions.entries.length}</span>
            <span class="toc-weight-noun">${escapeHtml(divisions.entries.length === 1 ? noun.one : noun.many)}</span>
            <span class="toc-weight-time">${this.contentsDuration(totalMin)}</span>
          </div>
        </header>

        ${divisions.reason === 'measured' ? `
          <p class="toc-note">
            This edition carries no division scheme this Archive can verify,
            so it is offered in readings of even length rather than under
            chapter names it does not have.
          </p>` : ''}

        ${searchable ? `
          <div class="toc-search">
            <input type="search" class="toc-search-input" data-toc="search"
                   placeholder="${escapeHtml(noun.find)}"
                   value="${escapeHtml(query)}" aria-label="Filter contents">
            ${query ? `<span class="toc-search-count">${entries.length} of ${divisions.entries.length}</span>` : ''}
          </div>` : ''}

        <div class="toc-list">
          ${entries.length === 0
            ? `<p class="toc-empty">Nothing here matches “${escapeHtml(query)}”.</p>`
            : entries.map(e => {
              const min = this.contentsMinutes(e.words, text.defaultWpm || 200);
              return `
              <button class="toc-entry" type="button" data-toc="read" data-entry="${e.id}">
                <span class="toc-entry-mark" aria-hidden="true">${escapeHtml(this.contentsMark(e, divisions))}</span>
                <span class="toc-entry-body">
                  <span class="toc-entry-label">${escapeHtml(e.label)}</span>
                  ${e.title ? `<span class="toc-entry-title">${escapeHtml(e.title)}</span>` : ''}
                </span>
                <span class="toc-entry-time">${this.contentsDuration(min)}</span>
              </button>`;
            }).join('')}
        </div>

        <footer class="toc-foot">
          <button class="btn-secondary toc-whole" type="button" data-toc="whole">
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
      this.getAudioEngine()?.playClick?.();

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
    const entryIndex = divisions?.entries.findIndex(e => String(e.id) === String(entryId));
    const entry = entryIndex >= 0 ? divisions.entries[entryIndex] : null;
    if (!entry) return;
    const label = entry.title ? `${entry.label} — ${entry.title}` : entry.label;
    const noun = contentsNoun(divisions).one;
    this.closeContents();
    this.onSelectText(entry.content, `${text.title} · ${label}`, {
      wpm: text.defaultWpm,
      curve: text.defaultCurve,
      // THE DOOR A READER ACTUALLY OPENS. The verse declaration was carried
      // as far as the Scriptorium's resolver, which serves an authored
      // program — not this, which is how someone opens a poem. So Tintern
      // Abbey was still cut at Wordsworth's commas and glued across his line
      // ends after the fix was reported as shipped.
      verseLines: entry.verse === true,
      ...(text.editionId && text.sourceRevision ? { continuation: {
        kind: 'library-division',
        workId: text.workId || text.id,
        editionId: text.editionId,
        sourceRevision: text.sourceRevision,
        entryId: String(entry.id),
        entryIndex,
        entryCount: divisions.entries.length,
        noun
      } } : {})
    });
  }

  readWhole() {
    const { text, divisions } = this._contents || {};
    if (!divisions) return;
    const full = divisions.entries.map(e => e.content).join('\n\n');
    this.closeContents();
    this.onSelectText(full, text.title, {
      wpm: text.defaultWpm,
      curve: text.defaultCurve,
      provenance: { kind: 'library-work', workId: text.workId || text.id },
      // Weighed in words: a work is rarely all one thing, and the line
      // splitter costs a prose paragraph nothing — one long line is handed
      // straight back to the punctuation splitter.
      verseLines: mostlyVerse(divisions.entries)
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
    if (!this.stopJevDictation) this.attachJevDictation();
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    this.stopJevDictation?.();
    this.stopJevDictation = null;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.stopJevDictation?.();
    this.jevAbort?.abort();
    this.deactivate();
  }
}
