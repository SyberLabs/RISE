/**
 * Page Reader — Page Mode Layer 3 (PAGE-MODE-SPEC §3.3).
 * Composition → DOM. No flash economy; figures resolve via injected
 * resolver; unresolved/undecodable works are absent (reverent degradation).
 */

import './page.css';
import { compileFlow, flowCollections, focalOf } from './flow.js';
import { compose, PLACEMENT, RHYTHM } from './compositor.js';
import { paginate, pageOfItem } from './paginator.js';
import { normalizeArtworkLabel, displayedArtworkLabel, artworkMayBeShown } from '../visuals/artwork-label.js';
import { createRemoteImage } from '../visuals/remote-image.js';

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

        // Pagination (§9): opt out for whole-column callers (e.g. print).
        // Otherwise length decides (see render): scrollUnderPages threshold.
        this.paginated = options.paginated !== false;
        // INFINITY IS THE ANSWER TO "NEVER PAGINATE", AND IT WAS BEING REFUSED.
        //
        // The Chamber passes Number.POSITIVE_INFINITY to say the public Page
        // opens as one elongated composition, and has since that was written.
        // Number.isFinite(Infinity) is false, so the value was read as junk
        // and replaced with the default 4 — every reading over four pages
        // opened paginated, and the stated intent never once took effect.
        // The guard's job is to reject what is not a number; Infinity is one,
        // and is the only way to express this threshold's absence.
        this.scrollUnderPages = typeof options.scrollUnderPages === 'number'
            && !Number.isNaN(options.scrollUnderPages)
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
        this._printState = null;
        this._printPreparation = null;
        this._onBeforePrint = () => { void this.prepareForPrint(); };
        this._onAfterPrint = () => { this.restoreAfterPrint(); };
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeprint', this._onBeforePrint);
            window.addEventListener('afterprint', this._onAfterPrint);
        }
    }

    /** Compile, compose, cut into pages, and render the first. */
    render() {
        if (!this.host) return;
        const flow = compileFlow(this.session);
        this.composition = compose(flow);

        this.host.classList.add('page-reader');

        // Projection by length: short readings scroll; longer ones page.
        // Same Composition; threshold is page count (frame-aware), not chars.
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
     * Budget from the live frame. Paginator stays pure; measure here.
     * charsPerLine must reflect the actual column width (not a desktop
     * constant), or pages overflow. Do not subtract column padding twice.
     * Slight overrun is intentional — readable amount per turn.
     */
    _budget() {
        const w = this.host?.clientWidth || 390;
        const h = this.host?.clientHeight || 664;
        const narrow = w < 640;

        const font = narrow ? 18 : 20;
        const measure = Math.min(544, Math.max(220, w - 32));
        // ~0.5em average advance for this literary face.
        const charsPerLine = Math.max(24, Math.round(measure / (font * 0.5)));

        // Furniture only (running head + pager); column padding already in layout.
        const furniture = narrow ? 130 : 170;
        const lineHeight = font * 1.72;

        // Slight overrun: readable amount per turn, still deliberate ends.
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
            // Running head after page 0: names the reading without repeating
            // masthead (focal/source stay on the opening).
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
        // Object report (not positional args) so hosts cannot drop fields.
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
     * Switch projection at runtime over the same Composition.
     * Preserves place by composition item, not scroll offset.
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
            case 'focal': return this._buildPassageFocal(item);
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

    /** A scored focal held at its passage rather than at the book opening. */
    _buildPassageFocal(item) {
        const el = this._buildFocal(item.focal);
        if (!el) return null;
        el.classList.add('page-passage-focal', `rhythm-${item.rhythm}`);
        if (item.episodeId) el.dataset.episode = item.episodeId;
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
        // Demand over the whole reading: pool is shared across pages;
        // per-page demand would repeat the same work on every figure.
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

        // Decode the displayed element before reveal (not a detached probe).
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
     *
     * Bounded on purpose: a figure reaches exactly one terminal state —
     * shown or absent — within `timeoutMs`. A remote request that never
     * loads, errors, or decodes is not allowed to hold Page readiness
     * open (the paginated walk waits on every figure). On the ceiling the
     * image is shown only if its bytes actually arrived, else it degrades
     * to absent; and revoking the activation settles it at once.
     */
    _settleImage(img, timeoutMs = 6000) {
        return new Promise(resolve => {
            let done = false;
            let timer = null;
            const finish = (ok) => {
                if (done) return;
                done = true;
                if (timer) clearTimeout(timer);
                this.signal?.removeEventListener('abort', onAbort);
                resolve(ok);
            };
            const onAbort = () => finish(false);
            timer = setTimeout(() => finish(img.complete && img.naturalWidth > 0), timeoutMs);
            if (this.signal) this.signal.addEventListener('abort', onAbort, { once: true });
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
            const probe = createRemoteImage();
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

    /**
     * Materialize the complete reading and eagerly decode every figure for
     * print. Pagination deliberately keeps only one page in the live DOM;
     * print is the inverse contract and must contain the whole composition.
     *
     * The returned promise lets explicit print commands await hydration.
     * Native `beforeprint` cannot await it, but beginning the work there is
     * still the earliest portable opportunity and cached assets settle fast.
     */
    prepareForPrint() {
        if (this._destroyed || !this.host || !this.composition) {
            return Promise.resolve(false);
        }
        if (this._printPreparation) return this._printPreparation;

        if (!this._printState) {
            this._printState = {
                isPaged: this.isPaged,
                pages: this.pages,
                pageIndex: this.pageIndex,
                scrollTop: this.host.scrollTop || 0
            };
        }

        this.isPaged = false;
        const whole = this._wholeColumn?.();
        this.pages = whole?.pages?.length
            ? whole.pages
            : [{ index: 0, items: this.composition.items || [], weight: 0 }];
        this._renderPage(0);
        this.host.classList.add('is-print-ready');

        const figures = [...this.host.querySelectorAll('[data-page-figure]')];
        this._disarmObserver();
        this._printPreparation = Promise.all(figures.map(fig => this._fillFigure(fig)))
            .then(() => true)
            .finally(() => { this._printPreparation = null; });
        return this._printPreparation;
    }

    /** Restore the exact interactive projection and page after printing. */
    restoreAfterPrint() {
        const state = this._printState;
        if (!state || this._destroyed || !this.host) return false;
        this._printState = null;
        this.host.classList.remove('is-print-ready');
        this.isPaged = state.isPaged;
        this.pages = state.pages;
        this._renderPage(state.pageIndex);
        if (!state.isPaged) {
            try { this.host.scrollTop = state.scrollTop; } catch { /* detached */ }
        }
        return true;
    }

    destroy() {
        this._destroyed = true;
        this._disarmObserver();
        if (this._onKey) {
            try { document.removeEventListener('keydown', this._onKey); } catch { /* detached */ }
            this._onKey = null;
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('beforeprint', this._onBeforePrint);
            window.removeEventListener('afterprint', this._onAfterPrint);
        }
        this._printState = null;
        this._printPreparation = null;
        this._pending.clear();
        this._resolved.clear();
        if (this.host) {
            this.host.classList.remove('page-reader');
            this.host.replaceChildren();
        }
    }
}

export { PLACEMENT, RHYTHM };
