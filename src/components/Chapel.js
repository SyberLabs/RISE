/**
 * The Chapel — Scripture, read as an act.
 *
 * Deliberately quieter than every other browse surface: no search, no
 * view modes, no filters. The Church's own groupings ARE the browse
 * structure — Pentateuch through Apocalypse, in canonical order. One
 * named translation, displayed as provenance on the header and never
 * mixed (spec non-negotiable #1).
 *
 * The view is metadata-only (payload-boundary rules): book text loads
 * lazily through the handoff, which verifies its checksum before it
 * can enter a session.
 */

import {
  CHAPEL_TRANSLATION,
  CHAPEL_GROUPINGS,
  CHAPEL_BOOKS,
  chapelBooksInGrouping
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
    this.onLaunchBook = options.onLaunchBook || (() => {});
    // Return-from-Chamber wayfinding: softly mark the last-read book
    this.lastBookId = typeof options.bookId === 'string' ? options.bookId : null;
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
              <p class="chapel-deck">${CHAPEL_BOOKS.length} books, read slowly. Choose one; it becomes the session.</p>
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
  }

  renderGrouping(grouping) {
    const books = chapelBooksInGrouping(grouping.id).map(book => `
      <button
        class="chapel-book${book.id === this.lastBookId ? ' chapel-book-last' : ''}"
        data-book-id="${escapeHtml(book.id)}"
        aria-label="Read ${escapeHtml(book.name)} — ${book.chapters} chapter${book.chapters === 1 ? '' : 's'}"
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
    if (bookId && !this._launching) {
      // One launch at a time — a double-click must not race two handoffs
      this._launching = true;
      window.rise?.audioEngine?.playClick();
      button.classList.add('chapel-book-loading');
      Promise.resolve(this.onLaunchBook(bookId)).finally(() => {
        this._launching = false;
        button.classList.remove('chapel-book-loading');
      });
    }
  }

  /** Router re-entry: refresh the last-read marker */
  update(data) {
    if (typeof data?.bookId === 'string' && data.bookId !== this.lastBookId) {
      this.lastBookId = data.bookId;
      this.container.querySelectorAll('.chapel-book').forEach(button => {
        button.classList.toggle('chapel-book-last', button.dataset.bookId === this.lastBookId);
      });
    }
  }

  activate() {}
  deactivate() {}

  destroy() {
    this._abortController.abort();
    this.container.innerHTML = '';
  }
}
