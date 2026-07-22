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

        <div class="chapel-body">
          ${testaments}
        </div>

        <footer class="chapel-footer">
          <p class="chapel-provenance font-mono">
            ${escapeHtml(CHAPEL_TRANSLATION.name)} · ${escapeHtml(CHAPEL_TRANSLATION.edition)} —
            public domain · <a href="${escapeHtml(CHAPEL_TRANSLATION.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(CHAPEL_TRANSLATION.source)}</a>
          </p>
        </footer>
      </main>
    `;

    if (this.openBookId) this.mountChapterPanel(this.openBookId);
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
    Promise.resolve(this.onLaunchReading(bookId, chapter)).finally(() => {
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
