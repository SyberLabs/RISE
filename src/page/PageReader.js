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
import { compileFlow, flowCollections } from './flow.js';
import { compose, PLACEMENT, RHYTHM } from './compositor.js';
import { normalizeArtworkLabel, displayedArtworkLabel } from '../visuals/artwork-label.js';

const OBSERVER_MARGIN = '600px';   // begin resolving well before view

export class PageReader {
    /**
     * @param {HTMLElement} host
     * @param {Object} options
     *   - session: { atoms, visualProgram }
     *   - resolveCollection: (collectionId) => Promise<Array<work>>
     *   - title / source: heading copy (optional)
     */
    constructor(host, options = {}) {
        this.host = host;
        this.session = options.session || null;
        this.resolveCollection = typeof options.resolveCollection === 'function'
            ? options.resolveCollection
            : async () => [];
        this.title = options.title || '';
        this.source = options.source || '';

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

        if (this.title || this.source) {
            article.appendChild(this._buildMasthead());
        }

        for (const item of this.composition.items) {
            const el = this._buildItem(item);
            if (el) article.appendChild(el);
        }

        this.host.appendChild(article);
        this._armObserver();
        return this.composition;
    }

    _buildMasthead() {
        const head = document.createElement('header');
        head.className = 'page-masthead';
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
        fig.dataset.collections = item.collections.join(',');
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

    /** Resolve a collection once; every figure on the page shares it. */
    async _worksFor(collectionId) {
        if (this._resolved.has(collectionId)) return this._resolved.get(collectionId);
        if (this._pending.has(collectionId)) return this._pending.get(collectionId);
        const p = Promise.resolve(this.resolveCollection(collectionId))
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
        if (this._destroyed || !fig || fig.dataset.filled === '1') return;
        fig.dataset.filled = '1';

        const ids = (fig.dataset.collections || '').split(',').filter(Boolean);
        let work = null;
        for (const id of ids) {
            const works = await this._worksFor(id);
            if (this._destroyed) return;
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

        const ok = await this._decode(work.data.url);
        if (this._destroyed) return;
        if (!ok) {
            fig.classList.remove('is-pending');
            fig.classList.add('is-absent');
            return;
        }

        const img = document.createElement('img');
        img.className = 'page-figure-image';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.src = work.data.url;
        img.alt = '';
        img.draggable = false;
        fig.appendChild(img);

        const label = normalizeArtworkLabel(work);
        if (label) {
            const cap = document.createElement('figcaption');
            cap.className = 'page-figure-caption';
            // A credit-required work (CC-BY) MUST show its attribution —
            // the obligation from SOURCE-EXPANSION-SPEC §3.
            cap.textContent = label.creditRequired
                ? label.requiredText
                : displayedArtworkLabel(label, true);
            if (label.creditRequired) cap.classList.add('is-required-credit');
            fig.appendChild(cap);
        }

        fig.classList.remove('is-pending');
        fig.classList.add('is-shown');
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
