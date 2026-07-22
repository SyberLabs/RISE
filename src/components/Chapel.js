/**
 * The Chapel — Scripture, read as an act.
 *
 * Deliberately quieter than every other browse surface: no search, no
 * view modes, no filters. The Church's own groupings ARE the browse
 * structure — Pentateuch through Apocalypse, in canonical order. One
 * named translation, displayed as provenance on the header and never
 * mixed (spec non-negotiable #1).
 *
 * A book opens into its chapters inline (single-chapter books launch
 * directly). Chapter is the natural session unit — it is how the
 * Church actually reads — and it is the addressing scheme the
 * liturgical features (Rosary, Stations) will build on.
 *
 * The view is metadata-only (payload-boundary rules): book text loads
 * lazily through the handoff, which verifies its checksum before it
 * can enter a session.
 */

import {
  CHAPEL_TRANSLATION,
  CHAPEL_GROUPINGS,
  CHAPEL_BOOKS,
  chapelBooksInGrouping,
  findChapelBook
} from '../content/chapel/corpus/manifest.js';
import { CHAPEL_ICONS } from '../content/chapel/imagery/icons.js';
import { MYSTERY_SETS, mysterySetForDate } from '../content/chapel/liturgy/rosary.js';

/** The reader's chosen icon focal, kept across visits. */
export const CHAPEL_ICON_PREF_KEY = 'rise_chapel_icon_v1';

export function loadChapelIconPref() {
  try {
    const stored = localStorage.getItem(CHAPEL_ICON_PREF_KEY);
    return stored && Object.hasOwn(CHAPEL_ICONS, stored) ? stored : null;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TESTAMENT_TITLES = Object.freeze({
  ot: 'The Old Testament',
  nt: 'The New Testament'
});

export class Chapel {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onLaunchReading = options.onLaunchReading || options.onLaunchBook || (() => {});
    // Return-from-Chamber wayfinding: the last reading, softly marked;
    // its book arrives already open at its chapters
    this.lastBookId = typeof options.bookId === 'string' ? options.bookId : null;
    this.lastChapter = Number.isInteger(options.chapter) ? options.chapter : null;
    // The chosen icon focal, persisted across visits
    this.iconId = loadChapelIconPref();
    this.onLaunchRosary = options.onLaunchRosary || (() => {});
    this.openBookId = this.lastBookId && (findChapelBook(this.lastBookId)?.chapters || 0) > 1
      ? this.lastBookId
      : null;
    this._launching = false;
    this._abortController = new AbortController();

    this.render();
    this.attachEvents();
  }

  render() {
    const testaments = ['ot', 'nt'].map(testament => {
      const groupings = CHAPEL_GROUPINGS
        .filter(grouping => grouping.testament === testament)
        .map(grouping => this.renderGrouping(grouping))
        .join('');
      return `
        <section class="chapel-testament" aria-label="${TESTAMENT_TITLES[testament]}">
          <h2 class="chapel-testament-title">${TESTAMENT_TITLES[testament]}</h2>
          ${groupings}
        </section>
      `;
    }).join('');

    this.container.innerHTML = `
      <main class="chapel" aria-labelledby="chapel-title">
        <div class="chapel-scroll">
          <div class="chapel-inner">
            <header class="chapel-header">
              <div class="chapel-heading-row">
                <button class="btn-ghost chapel-back" data-action="back">
                  <span aria-hidden="true">←</span>
                  <span>Portal</span>
                </button>
                <div class="chapel-heading">
                  <p class="chapel-kicker font-mono">SCRIPTURE · ${escapeHtml(CHAPEL_TRANSLATION.name.toUpperCase())} · ${escapeHtml(CHAPEL_TRANSLATION.edition.toUpperCase())}</p>
                  <h1 id="chapel-title">The Chapel</h1>
                  <p class="chapel-deck">${CHAPEL_BOOKS.length} books, read slowly. Choose one; a chapter becomes the session.</p>
                </div>
              </div>
            </header>

            ${this.renderIconSection()}

            ${this.renderRosarium()}

            <div class="chapel-body">
              ${testaments}
            </div>

            <footer class="chapel-footer">
              <p class="chapel-provenance font-mono">
                ${escapeHtml(CHAPEL_TRANSLATION.name)} · ${escapeHtml(CHAPEL_TRANSLATION.edition)} —
                public domain · <a href="${escapeHtml(CHAPEL_TRANSLATION.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(CHAPEL_TRANSLATION.source)}</a>
              </p>
            </footer>
          </div>
        </div>
      </main>
    `;

    if (this.openBookId) this.mountChapterPanel(this.openBookId);
  }

  /**
   * The Icon focal choice — the three pinned icons, or none. A chosen
   * icon holds the Chamber's focal through every Chapel reading until
   * released; "None" returns each book to its own imagery (the
   * Gospels' Passion collections, stillness elsewhere).
   */
  renderIconSection() {
    const options = Object.entries(CHAPEL_ICONS).map(([id, icon]) => `
      <button
        class="chapel-icon-option${this.iconId === id ? ' chapel-icon-selected' : ''}"
        data-icon-id="${escapeHtml(id)}"
        aria-pressed="${this.iconId === id ? 'true' : 'false'}"
        title="${escapeHtml(icon.attribution)}"
      >
        <img class="chapel-icon-thumb" src="${escapeHtml(icon.image)}" alt="" loading="lazy" decoding="async" />
        <span class="chapel-icon-name">${escapeHtml(icon.name)}</span>
        <span class="chapel-icon-origin font-mono">${escapeHtml(icon.origin)} · ${escapeHtml(icon.date.split(',')[0])}</span>
      </button>
    `).join('');

    return `
      <section class="chapel-icon-section" aria-label="Icon focal">
        <h3 class="chapel-grouping-title font-mono">The Icon</h3>
        <p class="chapel-icon-hint">A written image held at the center of the reading. Choose one, or read with each book’s own imagery.</p>
        <div class="chapel-icon-row">
          <button
            class="chapel-icon-option chapel-icon-none${this.iconId === null ? ' chapel-icon-selected' : ''}"
            data-icon-id=""
            aria-pressed="${this.iconId === null ? 'true' : 'false'}"
          >
            <span class="chapel-icon-none-mark" aria-hidden="true">—</span>
            <span class="chapel-icon-name">None</span>
            <span class="chapel-icon-origin font-mono">each book’s own imagery</span>
          </button>
          ${options}
        </div>
      </section>
    `;
  }

  renderGrouping(grouping) {
    const books = chapelBooksInGrouping(grouping.id).map(book => `
      <button
        class="chapel-book${book.id === this.lastBookId ? ' chapel-book-last' : ''}"
        data-book-id="${escapeHtml(book.id)}"
        aria-expanded="${book.id === this.openBookId ? 'true' : 'false'}"
        aria-label="${book.chapters === 1
          ? `Read ${escapeHtml(book.name)}`
          : `${escapeHtml(book.name)} — choose from ${book.chapters} chapters`}"
      >
        <span class="chapel-book-name">${escapeHtml(book.name)}</span>
        <span class="chapel-book-meta font-mono">${book.chapters} ch</span>
      </button>
    `).join('');

    return `
      <div class="chapel-grouping">
        <h3 class="chapel-grouping-title font-mono">${escapeHtml(grouping.name)}</h3>
        <div class="chapel-grouping-books">${books}</div>
      </div>
    `;
  }

  /**
   * The door to the Rosarium — the Rosary's own room. One quiet card:
   * the calendar's mysteries named (SOL's date-sensing raised to the
   * liturgical week); choosing happens IN the room.
   */
  renderRosarium() {
    const todaySetId = mysterySetForDate();
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return `
      <section class="chapel-rosarium" aria-label="The Rosary">
        <button class="chapel-rosarium-door" data-mystery-set="${escapeHtml(todaySetId)}"
          aria-label="Enter the Rosarium — ${escapeHtml(dayName)} keeps ${escapeHtml(MYSTERY_SETS[todaySetId].name.toLowerCase())}">
          <span class="chapel-rosarium-glyph" aria-hidden="true">📿</span>
          <span class="chapel-rosarium-body">
            <span class="chapel-rosarium-name">The Rosarium</span>
            <span class="chapel-rosarium-detail">${escapeHtml(dayName)} keeps ${escapeHtml(MYSTERY_SETS[todaySetId].name.toLowerCase())}</span>
          </span>
          <span class="chapel-rosarium-enter" aria-hidden="true">enter ›</span>
        </button>
      </section>
    `;
  }

  /**
   * The chapter panel spans the full grouping width directly below its
   * book's row, so the list never reflows around a column-wide insert.
   */
  renderChapterPanel(book) {
    const noun = book.id === 'psalms' ? 'Psalm' : 'Chapter';
    const chapters = Array.from({ length: book.chapters }, (_, index) => {
      const chapter = index + 1;
      const isLast = book.id === this.lastBookId && chapter === this.lastChapter;
      return `
        <button
          class="chapel-chapter${isLast ? ' chapel-chapter-last' : ''}"
          data-book-id="${escapeHtml(book.id)}"
          data-chapter="${chapter}"
          aria-label="Read ${escapeHtml(book.name)}, ${noun.toLowerCase()} ${chapter}"
        >${chapter}</button>
      `;
    }).join('');

    return `
      <div class="chapel-chapter-panel" data-chapter-panel="${escapeHtml(book.id)}">
        <div class="chapel-chapter-head">
          <span class="chapel-chapter-title font-mono">${escapeHtml(book.name)} · ${book.chapters} ${noun.toLowerCase()}${book.chapters === 1 ? '' : 's'}</span>
          <button class="chapel-read-all" data-book-id="${escapeHtml(book.id)}" data-whole-book="true">
            Read the whole book
          </button>
        </div>
        <div class="chapel-chapter-grid">${chapters}</div>
      </div>
    `;
  }

  mountChapterPanel(bookId) {
    this.unmountChapterPanel();
    const book = findChapelBook(bookId);
    const bookButton = this.container.querySelector(`.chapel-book[data-book-id="${bookId}"]`);
    if (!book || !bookButton) return;

    const holder = document.createElement('div');
    holder.innerHTML = this.renderChapterPanel(book);
    const panel = holder.firstElementChild;
    // After the book's grid, spanning the grouping's full width
    bookButton.closest('.chapel-grouping-books').insertAdjacentElement('afterend', panel);
    bookButton.setAttribute('aria-expanded', 'true');
    bookButton.classList.add('chapel-book-open');
  }

  unmountChapterPanel() {
    this.container.querySelector('.chapel-chapter-panel')?.remove();
    this.container.querySelectorAll('.chapel-book-open').forEach(button => {
      button.classList.remove('chapel-book-open');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  attachEvents() {
    const { signal } = this._abortController;
    this.container.addEventListener('click', event => this.handleClick(event), { signal });
  }

  handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !this.container.contains(button)) return;

    if (button.dataset.action === 'back') {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
      return;
    }

    if (button.dataset.mysterySet) {
      // The door to the Rosarium; all choosing happens in the room
      window.rise?.audioEngine?.playClick();
      this.onLaunchRosary(button.dataset.mysterySet, { iconId: this.iconId });
      return;
    }

    if (button.dataset.iconId !== undefined) {
      window.rise?.audioEngine?.playClick();
      this.iconId = button.dataset.iconId || null;
      try {
        if (this.iconId) localStorage.setItem(CHAPEL_ICON_PREF_KEY, this.iconId);
        else localStorage.removeItem(CHAPEL_ICON_PREF_KEY);
      } catch { /* private mode — the choice still applies this visit */ }
      this.container.querySelectorAll('[data-icon-id]').forEach(option => {
        const selected = (option.dataset.iconId || null) === this.iconId;
        option.classList.toggle('chapel-icon-selected', selected);
        option.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      return;
    }

    const bookId = button.dataset.bookId;
    if (!bookId) return;

    // A chapter number, or "Read the whole book" — both launch
    const chapterAttr = button.dataset.chapter;
    if (chapterAttr != null || button.dataset.wholeBook === 'true') {
      this.launch(button, bookId, chapterAttr != null ? Number(chapterAttr) : null);
      return;
    }

    // A book row: single-chapter books launch directly; the rest open
    // (or close) their chapter panel
    const book = findChapelBook(bookId);
    if (!book) return;
    window.rise?.audioEngine?.playClick();
    if (book.chapters === 1) {
      this.launch(button, bookId, null);
      return;
    }
    if (this.openBookId === bookId) {
      this.openBookId = null;
      this.unmountChapterPanel();
    } else {
      this.openBookId = bookId;
      this.mountChapterPanel(bookId);
    }
  }

  launch(button, bookId, chapter) {
    if (this._launching) return;
    // One launch at a time — a double-click must not race two handoffs
    this._launching = true;
    window.rise?.audioEngine?.playClick();
    button.classList.add('chapel-book-loading');
    Promise.resolve(this.onLaunchReading(bookId, chapter, { iconId: this.iconId })).finally(() => {
      this._launching = false;
      button.classList.remove('chapel-book-loading');
    });
  }

  /** Router re-entry: refresh the last-read marker and reopen its book */
  update(data) {
    const bookId = typeof data?.bookId === 'string' ? data.bookId : null;
    if (!bookId) return;
    this.lastBookId = bookId;
    this.lastChapter = Number.isInteger(data?.chapter) ? data.chapter : null;
    this.container.querySelectorAll('.chapel-book').forEach(button => {
      button.classList.toggle('chapel-book-last', button.dataset.bookId === this.lastBookId);
    });
    if ((findChapelBook(bookId)?.chapters || 0) > 1) {
      this.openBookId = bookId;
      this.mountChapterPanel(bookId);
    }
  }

  activate() {}
  deactivate() {}

  destroy() {
    this._abortController.abort();
    this.container.innerHTML = '';
  }
}
