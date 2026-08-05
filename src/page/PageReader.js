/**
 * The Page Reader — Page Mode, Layer 3 (PAGE-MODE-SPEC §3.3).
 *
 * Composition → the illuminated scrolling column. The thinnest layer:
 * all typesetting decisions were already made upstream, so this file
 * only builds DOM, lazy-loads figures, and reveals them after decode.
 *
 * It is a SPATIAL projection and therefore has, by construction:
 *   • no flash economy, no VisualFlashGate, no advance clock (§4)
 *   • no new source machinery — figures resolve through an injected
 *     resolver backed by the cortex's own provider dispatch (§5)
 *   • reverent degradation — a work that will not resolve or decode is
 *     simply absent; the text composes without it, never a broken frame.
 */

import './page.css';
import { compileFlow, flowCollections, focalOf } from './flow.js';
import { compose, PLACEMENT, RHYTHM } from './compositor.js';
import { paginate, pageOfItem } from './paginator.js';
import { normalizeArtworkLabel, displayedArtworkLabel, artworkMayBeShown } from '../visuals/artwork-label.js';

const OBSERVER_MARGIN = '600px';   // begin resolving well before view

/**
 * The standard focal glyphs, as the visual panel names them. The Page
 * states a focal rather than animating it: a spatial projection has no
 * clock, so the mark stands still.
 */
const FOCAL_MARKS = Object.freeze({
    breath: '◯', anchor: '⚓', lotus: '❀', eye: '◉',
    star: '✦', wave: '≈', void: '●', rose: '❂'
});

export class PageReader {
    /**
     * @param {HTMLElement} host
     * @param {Object} options
     *   - session: { atoms, visualProgram }
     *   - resolveCollection: (collectionId) => Promise<Array<work>>
     *   - title / source: heading copy (optional)
     *   - signal: AbortSignal revoking this reader's async work
     *   - showOptionalLabels: honour the reader's artwork-label preference
     *     (required credits are shown regardless)
     */
    constructor(host, options = {}) {
        this.host = host;
        this.session = options.session || null;
        this.resolveCollection = typeof options.resolveCollection === 'function'
            ? options.resolveCollection
            : async () => [];
        this.title = options.title || '';
        this.source = options.source || '';
        this.signal = options.signal || null;
        // Supplied by the Chamber from the cortex's live setting, so the
        // Page agrees with the flash economy and the Gallery instead of
        // hardcoding labels on. Required credits ignore this.
        this.showOptionalLabels = options.showOptionalLabels !== false;
        // The reading's held focal, shown once at the head of the page.
        this.focal = options.focal !== undefined ? options.focal : focalOf(this.session);

        this._observer = null;
        this._destroyed = false;
        this._figureSeq = 0;
        // One in-flight resolution per collection, shared by every figure
        // that references it — a page never asks the same pool twice.
        this._pending = new Map();
        this._resolved = new Map();

        this.composition = null;

        // PAGINATION (PAGE-MODE-SPEC §9, "an alternate renderer over the
        // same Composition"). One unbounded column laid the whole reading
        // out at once; paged, it arrives in divisible chunks and the DOM
        // holds one page's worth. Opt OUT rather than in, because a
        // caller that wants the whole column — printing, most obviously —
        // is asking for something specific and should say so.
        // PROJECTION BY LENGTH (see render()). `paginated: false` is a
        // hard opt-out for callers that need the whole column — print,
        // most obviously. Left alone, the reading's own length decides.
        this.paginated = options.paginated !== false;
        this.scrollUnderPages = Number.isFinite(options.scrollUnderPages)
            ? options.scrollUnderPages
            : 4;
        // The Chamber draws the turn in its own control bar, so the
        // reader does not float a second one. Standalone callers keep it.
        this.showPager = options.showPager !== false;
        this.onPageChange = typeof options.onPageChange === 'function'
            ? options.onPageChange
            : null;
        this.linesPerPage = options.linesPerPage;
        this.pages = [];
        this.pageIndex = 0;
        this._onKey = null;
    }

    /** Compile, compose, cut into pages, and render the first. */
    render() {
        if (!this.host) return;
        const flow = compileFlow(this.session);
        this.composition = compose(flow);

        this.host.classList.add('page-reader');

        // ══ PROJECTION BY LENGTH ══
        //
        // Pagination was made the only projection, and reading real
        // pages showed the cost: a page boundary is a constraint the
        // compositor does not model, so a margin figure can land beside
        // a chapter opening and a heading can wrap where the column had
        // room to breathe before. In a short reading that is pure loss —
        // there was nothing to bound.
        //
        // So the length decides. A reading that scrolls comfortably
        // scrolls, and one long enough that its overhead matters is cut.
        // Both are the same Composition; §9's whole point is that the
        // renderer may choose. The threshold is in PAGES rather than
        // characters because the cut already knows the frame, the
        // measure and the figures, and a page count is what "long"
        // actually means to a reader.
        const cut = this.paginated
            ? paginate(this.composition, this._budget())
            : { pages: [] };
        const wholeColumn = () =>
            ({ pages: [{ index: 0, items: this.composition.items, weight: 0 }] });

        // Kept so the projection can be changed on the fly without
        // recompiling the flow or re-composing anything (see setPaged).
        this._cut = cut;
        this._wholeColumn = wholeColumn;
        this.canPage = this.paginated && cut.pages.length > 1;
        // Item → position in the reading, built once. Used to stamp the
        // DOM so a projection change can restore the reader; an
        // indexOf() per element would be quadratic on a long book.
        this._itemIndex = new Map();
        this.composition.items.forEach((item, i) => {
            if (!this._itemIndex.has(item)) this._itemIndex.set(item, i);
        });

        this.isPaged = this.paginated && cut.pages.length > this.scrollUnderPages;
        const chosen = this.isPaged ? cut : wholeColumn();
        // A reading with nothing in it still needs a page to be on.
        this.pages = chosen.pages.length
            ? chosen.pages
            : [{ index: 0, items: [], weight: 0 }];

        this._bindKeys();
        this._renderPage(0);
        return this.composition;
    }

    /**
     * The budget, measured from the frame the reading is actually in.
     *
     * The paginator is pure and must stay that way, so the measuring
     * happens here and is handed across as two numbers. It matters more
     * than it looks: `charsPerLine: 66` is a DESKTOP measure, and using
     * it on a phone — where the column fits nearer 40 — told the
     * paginator each paragraph was two thirds its real height, so pages
     * were cut over-full and overflowed their own frame by 250px.
     */
    _budget() {
        const w = this.host?.clientWidth || 390;
        const h = this.host?.clientHeight || 664;
        const narrow = w < 640;

        const font = narrow ? 18 : 20;
        const measure = Math.min(544, Math.max(220, w - 32));
        // ~0.5em average advance for this literary face.
        const charsPerLine = Math.max(24, Math.round(measure / (font * 0.5)));

        // What the frame leaves after the fixed furniture: the running
        // head and the pager. The column's own padding is NOT subtracted
        // again here — doing both is what cut the reading into 28 pages
        // of one paragraph.
        const furniture = narrow ? 130 : 170;
        const lineHeight = font * 1.72;

        // A PAGE MAY OVERRUN ITS FRAME A LITTLE, and should. Budgeting
        // for a perfect fit produced pages holding a single paragraph on
        // a phone, which is a page turn every few seconds; budgeting for
        // a comfortable scroll holds a readable amount and still ends
        // somewhere deliberate. The reader scrolls a page, then turns it.
        const OVERRUN = 1.45;
        const usable = Math.max(lineHeight * 8, (h - furniture) * OVERRUN);
        const linesPerPage = Math.max(10, Math.floor(usable / lineHeight));

        return {
            charsPerLine,
            linesPerPage: Number.isFinite(this.linesPerPage) ? this.linesPerPage : linesPerPage
        };
    }

    /**
     * Render one page's items. The masthead belongs to the first page
     * only — a title repeated at the head of every page is a running
     * header, which is a different typographic object and one this
     * reader has not earned yet.
     */
    _renderPage(index) {
        if (!this.host || !this.pages.length) return;
        const clamped = Math.max(0, Math.min(this.pages.length - 1, index | 0));
        this.pageIndex = clamped;

        // The observer belongs to the page it armed; a new page gets a
        // new one, or figures from the old DOM keep a detached observer
        // alive and the next arm double-counts.
        this._disarmObserver();
        this.host.replaceChildren();
        this.host.classList.toggle('is-paginated', this.pages.length > 1);

        const article = document.createElement('article');
        article.className = 'page-article';

        if (clamped === 0 && (this.title || this.source || this.focal)) {
            article.appendChild(this._buildMasthead());
        } else if (clamped > 0 && this.title) {
            // A RUNNING HEAD, WHICH I PREVIOUSLY ARGUED AGAINST.
            //
            // The first cut of this said a title repeated at the head of
            // every page is a running header, "a different typographic
            // object and one this reader has not earned yet", and showed
            // the masthead on page one alone. That was wrong in practice:
            // past the first page a reader has nothing on screen naming
            // what they are reading, and a book solves this with a
            // running head for exactly that reason. It is small, quiet,
            // set in the display face, and it is not the masthead — the
            // focal and the source line still belong to the opening.
            this.host.appendChild(this._buildRunningHead());
        }

        // A WRAPPED figure and the prose that flows beside it must share a
        // containing block: a float only wraps text that follows it in the
        // same parent, and confining them together scopes the wrap so it
        // cannot leak down the rest of the column. Everything else is a
        // plain sibling in the article.
        const items = this.pages[clamped].items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type === 'figure' && item.placement === PLACEMENT.MARGIN && item.wrapBlocks > 0) {
                const group = document.createElement('div');
                group.className = `page-wrap side-${item.side || 'right'}`;
                const groupAt = this._itemIndex?.get(item);
                if (groupAt !== undefined) group.dataset.item = String(groupAt);
                const fig = this._buildItem(item);
                if (fig) group.appendChild(fig);
                // Gather the prose the compositor assigned. Non-text items
                // that merely punctuate the run (a pause) travel WITH the
                // group rather than ending it — otherwise the float takes
                // one paragraph and strands itself, which is exactly the
                // ragged hole the reader saw. Anything structural (a
                // figure, a chapter, an episode break) does end the band,
                // matching the compositor's own proseAfter().
                let taken = 0;
                while (taken < item.wrapBlocks && i + 1 < items.length) {
                    const next = items[i + 1];
                    if (next.type === 'text') {
                        const el = this._buildItem(items[++i]);
                        if (el) group.appendChild(el);
                        taken += 1;
                        continue;
                    }
                    if (next.type === 'pause') {
                        const el = this._buildItem(items[++i]);
                        if (el) group.appendChild(el);
                        continue;
                    }
                    break;
                }
                // Close the float so following content starts a clean line.
                const clear = document.createElement('div');
                clear.className = 'page-wrap-clear';
                clear.setAttribute('aria-hidden', 'true');
                group.appendChild(clear);
                article.appendChild(group);
                continue;
            }
            const el = this._buildItem(item);
            if (el) {
                // Stamped so a projection change can find its way back to
                // the passage the reader was on. See setPaged().
                const at = this._itemIndex?.get(item);
                if (at !== undefined) el.dataset.item = String(at);
                article.appendChild(el);
            }
        }

        this.host.appendChild(article);
        if (this.showPager && this.pages.length > 1) {
            this.host.appendChild(this._buildPager());
        }
        // ONE OBJECT, NOT FOUR POSITIONS. The host renders its projection
        // controls from this, and when it was a positional signature the
        // Chamber took the first two arguments and inferred the rest —
        // so an elongated reading (one page) looked like a reading with
        // nothing to paginate, and the control that would have brought
        // the pages back hid itself. A field cannot be silently dropped
        // the way a trailing argument can.
        this.onPageChange?.({
            index: clamped,
            total: this.pages.length,
            isPaged: this.isPaged,
            canPage: this.canPage
        });
        this._armObserver();
        // A new page starts at its own beginning, not at the scroll
        // offset the previous one happened to leave behind.
        try { this.host.scrollTop = 0; } catch { /* detached */ }
    }

    /**
     * ELONGATE — change projection at runtime.
     *
     * The length rule picks a projection; the reader overrules it. This
     * costs nothing but a re-render: the flow and the Composition are
     * already built, and pagination is only a view over them, so the
     * two projections are two ways of reading the same object rather
     * than two objects.
     *
     * AND IT KEEPS THE READER'S PLACE. Sending someone back to the first
     * page for changing how the same reading is drawn is the same fault
     * the Page↔Stream toggle already had: two views of one reading that
     * disagree about where the reader is. The anchor is an ITEM, not an
     * offset, because only the item means the same thing in both.
     */
    setPaged(next) {
        const wanted = !!next && this.canPage;
        if (wanted === this.isPaged) return this.isPaged;
        const anchor = this._visibleItem();
        this.isPaged = wanted;
        const chosen = wanted ? this._cut : this._wholeColumn();
        this.pages = chosen.pages.length
            ? chosen.pages
            : [{ index: 0, items: [], weight: 0 }];
        this._renderPage(wanted ? pageOfItem(this.pages, anchor) : 0);
        if (!wanted) this._scrollToItem(anchor);
        return this.isPaged;
    }

    /**
     * The item the reader is actually looking at: the first one whose
     * foot is still below the top of the frame. In a paged projection
     * that is the page's opening item; in a scroll it is wherever they
     * scrolled to, which is the case that matters.
     */
    _visibleItem() {
        const page = this.pages?.[this.pageIndex];
        const first = page?.items?.[0] || null;
        if (!this.host) return first;
        const top = this.host.scrollTop || 0;
        if (!top) return first;
        const items = this.composition?.items;
        if (!Array.isArray(items)) return first;
        for (const el of this.host.querySelectorAll('.page-article > [data-item]')) {
            if (el.offsetTop + el.offsetHeight <= top) continue;
            const at = Number(el.dataset.item);
            return Number.isInteger(at) && items[at] ? items[at] : first;
        }
        return first;
    }

    /** Bring an anchor item back under the reader's eye after a re-render. */
    _scrollToItem(item) {
        const at = this._itemIndex?.get(item);
        if (at === undefined || !this.host) return;
        const el = this.host.querySelector(`.page-article > [data-item="${at}"]`);
        if (!el) return;
        try { this.host.scrollTop = el.offsetTop; } catch { /* detached */ }
    }

    /** Move by pages. Out-of-range is a no-op, not an error. */
    goToPage(index) {
        if (index === this.pageIndex) return this.pageIndex;
        if (index < 0 || index >= this.pages.length) return this.pageIndex;
        this._renderPage(index);
        return this.pageIndex;
    }

    nextPage() { return this.goToPage(this.pageIndex + 1); }
    prevPage() { return this.goToPage(this.pageIndex - 1); }

    _buildRunningHead() {
        const head = document.createElement('div');
        head.className = 'page-runner';
        head.setAttribute('aria-hidden', 'true'); // the article is titled already
        head.textContent = this.title;
        return head;
    }

    _buildPager() {
        const nav = document.createElement('nav');
        nav.className = 'page-pager';
        nav.setAttribute('aria-label', 'Pages');

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'page-pager-btn';
        prev.dataset.pageNav = 'prev';
        prev.textContent = '←';
        prev.setAttribute('aria-label', 'Previous page');
        prev.disabled = this.pageIndex === 0;
        prev.addEventListener('click', () => this.prevPage());

        const count = document.createElement('span');
        count.className = 'page-pager-count';
        // aria-live so a page turn is announced to a reader who cannot
        // see the column change.
        count.setAttribute('aria-live', 'polite');
        count.textContent = `${this.pageIndex + 1} / ${this.pages.length}`;

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'page-pager-btn';
        next.dataset.pageNav = 'next';
        next.textContent = '→';
        next.setAttribute('aria-label', 'Next page');
        next.disabled = this.pageIndex >= this.pages.length - 1;
        next.addEventListener('click', () => this.nextPage());

        nav.append(prev, count, next);
        return nav;
    }

    /**
     * Arrow keys turn pages. Escape is NOT taken: it belongs to the
     * Chamber's exit flow and the router's dispatch, and a reader
     * pressing it in Page Mode means to leave, not to turn back.
     */
    _bindKeys() {
        if (this._onKey || typeof document === 'undefined') return;
        this._onKey = (e) => {
            if (this._destroyed || this.pages.length < 2) return;
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                this.nextPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                this.prevPage();
            }
        };
        document.addEventListener('keydown', this._onKey);
    }

    _disarmObserver() {
        if (this._observer) {
            try { this._observer.disconnect(); } catch { /* detached */ }
            this._observer = null;
        }
    }

    /**
     * The reading's held focal, shown ONCE above the title.
     *
     * A focal is a thing to rest on, not a series, so the Page states it
     * at the head rather than placing it through the body. A Chapel icon
     * or a personal image renders as itself; a standard glyph renders as
     * its mark; the rose names itself, since it is a generated window
     * rather than a character.
     */
    _buildFocal(focal) {
        if (!focal) return null;
        const el = document.createElement('div');
        el.className = `page-focal focal-${focal.type}`;
        el.setAttribute('aria-hidden', 'true');

        if (focal.type === 'personal' && focal.image) {
            const img = document.createElement('img');
            img.className = 'page-focal-image';
            img.src = focal.image;
            img.alt = '';
            img.decoding = 'async';
            el.appendChild(img);
            return el;
        }
        if (focal.type === 'icon') {
            // The Chapel's held icon: named rather than drawn, since its
            // artwork is pinned and belongs to the Chapel's own surface.
            el.textContent = '✛';
            el.classList.add('is-mark');
            return el;
        }
        if (focal.type === 'rose') {
            el.textContent = '❂';
            el.classList.add('is-mark');
            return el;
        }
        const mark = FOCAL_MARKS[focal.glyph] || FOCAL_MARKS.breath;
        el.textContent = mark;
        el.classList.add('is-mark');
        return el;
    }

    _buildMasthead() {
        const head = document.createElement('header');
        head.className = 'page-masthead';
        // The focal sits ABOVE the title — the first thing the page holds.
        const focal = this._buildFocal(this.focal);
        if (focal) head.appendChild(focal);
        if (this.title) {
            const h = document.createElement('h1');
            h.className = 'page-title';
            h.textContent = this.title;
            head.appendChild(h);
        }
        if (this.source) {
            const s = document.createElement('p');
            s.className = 'page-source';
            s.textContent = this.source;
            head.appendChild(s);
        }
        return head;
    }

    _buildItem(item) {
        switch (item.type) {
            case 'chapter': return this._buildChapter(item);
            case 'break': return this._buildBreak(item);
            case 'pause': return this._buildPause(item);
            case 'figure': return this._buildFigure(item);
            case 'symbol': return this._buildSymbol(item);
            case 'text': return this._buildText(item);
            default: return null;
        }
    }

    _buildChapter(item) {
        const el = document.createElement('h2');
        el.className = `page-chapter rhythm-${item.rhythm}`;
        el.textContent = Number.isInteger(item.chapter) ? String(item.chapter) : '';
        return el;
    }

    _buildBreak(item) {
        const el = document.createElement('div');
        // A works-less episode's stillness is a deliberate register, and
        // the class names it rather than hiding it.
        el.className = `page-break rhythm-${item.rhythm}`
            + (item.rhythm === RHYTHM.STILL ? ' page-break-still' : '');
        el.setAttribute('role', 'separator');
        el.innerHTML = '<span class="page-break-mark" aria-hidden="true">❧</span>';
        return el;
    }

    _buildPause(item) {
        const el = document.createElement('div');
        el.className = `page-pause rhythm-${item.rhythm}`;
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    /**
     * A glyph the reading authored (a symbol atom) — carried into the
     * spatial projection rather than dropped, so a Page shows what the
     * Stream would have played.
     */
    _buildSymbol(item) {
        const el = document.createElement('p');
        el.className = `page-symbol rhythm-${item.rhythm}`;
        el.textContent = item.symbol;
        return el;
    }

    _buildText(item) {
        const p = document.createElement('p');
        p.className = `page-text rhythm-${item.rhythm}`
            + (item.heading ? ' is-heading' : '');
        if (Number.isInteger(item.verse)) {
            const mark = document.createElement('span');
            mark.className = 'page-verse';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = String(item.verse);
            p.appendChild(mark);
        }
        p.appendChild(document.createTextNode(item.text));
        return p;
    }

    /**
     * A figure is built EMPTY and filled only when it nears the viewport
     * and its work decodes. Until then it occupies no visual weight —
     * so a page whose imagery never resolves reads as text alone.
     */
    _buildFigure(item) {
        const fig = document.createElement('figure');
        fig.className = `page-figure placement-${item.placement} rhythm-${item.rhythm} is-pending`;
        fig.dataset.pageFigure = String(this._figureSeq++);
        fig.dataset.collections = (item.collections || []).join(',');
        // An AUTHORED image carries its own URL: the reading supplied the
        // work, so there is no collection to resolve and no provider to
        // ask. It still decodes before it is revealed.
        if (item.url) {
            fig.dataset.url = item.url;
            if (item.title) fig.dataset.title = item.title;
        }
        // Reserve nothing until an image actually arrives (no placeholder,
        // no broken frame — the reverent contract).
        return fig;
    }

    _armObserver() {
        const figures = this.host.querySelectorAll('[data-page-figure]');
        if (!figures.length) return;

        if (typeof IntersectionObserver !== 'function') {
            // No observer (older engine / jsdom): resolve eagerly but
            // still asynchronously, so render() never blocks.
            figures.forEach(fig => this._fillFigure(fig));
            return;
        }

        this._observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                this._observer.unobserve(entry.target);
                this._fillFigure(entry.target);
            }
        }, { rootMargin: OBSERVER_MARGIN });

        figures.forEach(fig => this._observer.observe(fig));
    }

    /** How many figures on this page reference a given collection. */
    _figureDemand(collectionId) {
        let n = 0;
        // THE WHOLE READING, NOT THIS PAGE. Scoping demand to the current
        // page looked like an optimisation and was a defect: demand tells
        // the resolver how many DISTINCT works to draw, the pool is shared
        // across every page, and asking for one per page handed all six
        // figures the same image. Caught by the fields test asserting that
        // each procedural sample is a different state.
        for (const item of this.composition?.items || []) {
            if (item.type === 'figure' && (item.collections || []).includes(collectionId)) n += 1;
        }
        return Math.max(1, n);
    }

    /**
     * Resolve a collection once; every figure on the page shares it.
     *
     * The demand is passed along because a DYNAMIC field is sampled, not
     * drawn from a pool: asking for as many samples as there are figures
     * is what makes each figure a different state of the same system
     * rather than the same frame repeated.
     */
    async _worksFor(collectionId) {
        if (this._resolved.has(collectionId)) return this._resolved.get(collectionId);
        if (this._pending.has(collectionId)) return this._pending.get(collectionId);
        const p = Promise.resolve(this.resolveCollection(collectionId, this._figureDemand(collectionId)))
            .then(works => {
                const list = Array.isArray(works) ? works : [];
                this._resolved.set(collectionId, list);
                this._pending.delete(collectionId);
                return list;
            })
            .catch(() => {
                this._resolved.set(collectionId, []);
                this._pending.delete(collectionId);
                return [];
            });
        this._pending.set(collectionId, p);
        return p;
    }

    async _fillFigure(fig) {
        if (this._destroyed || this._aborted() || !fig || fig.dataset.filled === '1') return;
        fig.dataset.filled = '1';

        let work = null;

        // An authored image resolves without a provider: the reading
        // already named the work.
        if (fig.dataset.url) {
            work = {
                name: fig.dataset.title || '',
                data: { url: fig.dataset.url, title: fig.dataset.title || '' }
            };
        }

        const ids = work ? [] : (fig.dataset.collections || '').split(',').filter(Boolean);
        for (const id of ids) {
            const works = await this._worksFor(id);
            if (this._destroyed || this._aborted()) return;
            // Deterministic: a page is re-readable, so the same figure
            // shows the same work — index by the figure's ordinal within
            // its collection, never at random.
            if (works.length) {
                const seq = Number(fig.dataset.pageFigure) || 0;
                work = works[seq % works.length];
                break;
            }
        }

        // Reverent degradation: nothing resolved → the figure stays empty
        // and collapses; the text composes without it.
        if (!work?.data?.url) {
            fig.classList.remove('is-pending');
            fig.classList.add('is-absent');
            return;
        }

        // DECODE-BEFORE-REVEAL, on the element that is actually shown.
        // Decoding a detached probe and then creating a SECOND <img> only
        // proves the URL was once decodable — the displayed element could
        // still fail (a one-use/signed URL, an evicted cache, an engine
        // without Image.decode), and a lazy-loaded image is not even
        // fetched at that point. So the real element is built, decoded,
        // and only then revealed.
        const img = document.createElement('img');
        img.className = 'page-figure-image';
        img.decoding = 'async';
        img.alt = '';
        img.draggable = false;
        img.src = work.data.url;

        const ok = await this._settleImage(img);
        if (this._destroyed || this._aborted()) return;
        if (!ok) {
            // Reverent degradation: no broken frame, no placeholder.
            fig.classList.remove('is-pending');
            fig.classList.add('is-absent');
            return;
        }
        fig.appendChild(img);

        const label = normalizeArtworkLabel(work);
        // A credit is owed and none can be composed: the figure is
        // ABSENT rather than shown bare. Same treatment as a work that
        // will not resolve, for the same reason.
        if (!artworkMayBeShown(label)) {
            fig.replaceChildren();
            fig.classList.remove('is-pending');
            fig.classList.add('is-absent');
            return;
        }
        if (label) {
            const cap = document.createElement('figcaption');
            cap.className = 'page-figure-caption';
            // A credit-required work (CC-BY) MUST show its attribution —
            // the obligation from SOURCE-EXPANSION-SPEC §3 — regardless of
            // the reader's optional-label preference. Ordinary title/artist
            // labels honour that preference, as the cortex and Gallery do.
            cap.textContent = label.creditRequired
                ? label.requiredText
                : displayedArtworkLabel(label, this.showOptionalLabels);
            if (label.creditRequired) cap.classList.add('is-required-credit');
            if (cap.textContent) fig.appendChild(cap);
        }

        fig.classList.remove('is-pending');
        fig.classList.add('is-shown');
    }

    /**
     * Resolve true once THIS element has decoded (or loaded, where
     * decode() is unavailable); false if it errors. Never rejects.
     */
    _settleImage(img) {
        return new Promise(resolve => {
            let done = false;
            const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
            img.addEventListener('error', () => finish(false), { once: true });
            if (typeof img.decode === 'function') {
                img.decode().then(() => finish(true)).catch(() => {
                    // Some engines reject decode() after a successful load;
                    // fall back to the load event rather than withholding.
                    if (img.complete && img.naturalWidth > 0) finish(true);
                    else img.addEventListener('load', () => finish(true), { once: true });
                });
                return;
            }
            if (img.complete) { finish(img.naturalWidth > 0); return; }
            img.addEventListener('load', () => finish(true), { once: true });
        });
    }

    /** True once the owning activation has been revoked. */
    _aborted() {
        return this.signal?.aborted === true;
    }

    /** Decode-before-reveal (SacredImage's contract). */
    async _decode(url) {
        try {
            const probe = new Image();
            probe.decoding = 'async';
            probe.src = url;
            if (typeof probe.decode === 'function') await probe.decode();
            return true;
        } catch {
            return false;
        }
    }

    /** The collections this page will need — for optional pre-warming. */
    collections() {
        return flowCollections(compileFlow(this.session));
    }

    destroy() {
        this._destroyed = true;
        this._disarmObserver();
        if (this._onKey) {
            try { document.removeEventListener('keydown', this._onKey); } catch { /* detached */ }
            this._onKey = null;
        }
        this._pending.clear();
        this._resolved.clear();
        if (this.host) {
            this.host.classList.remove('page-reader');
            this.host.replaceChildren();
        }
    }
}

export { PLACEMENT, RHYTHM };
