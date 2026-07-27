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
import { normalizeArtworkLabel, displayedArtworkLabel } from '../visuals/artwork-label.js';

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
    }

    /** Compile, compose, and render. Safe to call once. */
    render() {
        if (!this.host) return;
        const flow = compileFlow(this.session);
        this.composition = compose(flow);

        this.host.classList.add('page-reader');
        this.host.replaceChildren();

        const article = document.createElement('article');
        article.className = 'page-article';

        if (this.title || this.source || this.focal) {
            article.appendChild(this._buildMasthead());
        }

        // A WRAPPED figure and the prose that flows beside it must share a
        // containing block: a float only wraps text that follows it in the
        // same parent, and confining them together scopes the wrap so it
        // cannot leak down the rest of the column. Everything else is a
        // plain sibling in the article.
        const items = this.composition.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type === 'figure' && item.placement === PLACEMENT.MARGIN && item.wrapBlocks > 0) {
                const group = document.createElement('div');
                group.className = `page-wrap side-${item.side || 'right'}`;
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
            if (el) article.appendChild(el);
        }

        this.host.appendChild(article);
        this._armObserver();
        return this.composition;
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
        p.className = `page-text rhythm-${item.rhythm}`;
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
        if (this._observer) {
            try { this._observer.disconnect(); } catch { /* detached */ }
            this._observer = null;
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
