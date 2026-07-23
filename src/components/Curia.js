/**
 * The Curia — the room where the visual canon is governed.
 *
 * A permanent curation surface over the museum categories: every work
 * a category can serve, with full provenance and origin, and the
 * verbs the curation workflow proved out across the audit cycles —
 * exclude, re-assign, promote. Replaces the era of one-off contact
 * sheets.
 *
 * PERSISTENCE: edits queue into a changeset. On the dev server the
 * "Apply" button POSTs it to /__curia/apply, which rewrites
 * museum-pins.js (the one machine-writable curation canon) —
 * instant git-visible edits. On a production build that endpoint
 * does not exist, so the Curia degrades to "Copy changeset":
 * the same JSON, applied later via the dev server or by hand.
 *
 * ORIGINS a card can carry:
 *   live — served by the category's AIC live-search clauses
 *   pin  — a pinned work (any institution), from museum-pins.js
 *   excluded — a live work currently held out by CATEGORY_EXCLUSIONS
 */

import { escapeHtml } from '../core/sanitize.js';

const VERB_LABELS = {
    exclude: 'exclude',
    unexclude: 'restore',
    addPin: 'pin',
    removePin: 'unpin',
    movePin: 'move',
    setLiveSearch: 'live-search'
};

export class Curia {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => {});
        this.categories = null;      // [{ id, name, mode }]
        this.inventory = new Map();  // categoryId -> { live: [], pins: [], excluded: [] }
        this.changeset = { exclude: [], unexclude: [], addPin: [], removePin: [], movePin: [], setLiveSearch: [] };
        this.openCategory = null;
        this._devWrite = null;       // tri-state: null unknown, true, false
        this.render();
        this.load();
    }

    // ---------- data ----------

    async load() {
        const [museumMod, pinsMod] = await Promise.all([
            import('../sources/visual/museum.js'),
            import('../sources/visual/museum-pins.js')
        ]);
        const MUSEUM_CATEGORIES = museumMod.MUSEUM_CATEGORIES || {};
        const MUSEUM_CATEGORY_PINS = pinsMod.MUSEUM_CATEGORY_PINS || {};
        const CATEGORY_EXCLUSIONS = pinsMod.CATEGORY_EXCLUSIONS || {};
        this._liveSearch = pinsMod.LIVE_SEARCH_ENABLED || {};
        this.categories = Object.entries(MUSEUM_CATEGORIES).map(([id, cat]) => ({
            id,
            name: cat.name,
            hasClauses: !!cat.clauses,
            liveOn: this._liveSearch[id] === true,
            mode: (cat.clauses && this._liveSearch[id] === true) ? 'live+pins' : 'pinned-only',
            pinCount: (MUSEUM_CATEGORY_PINS[id] || []).length,
            exclusionCount: (CATEGORY_EXCLUSIONS[id] || []).length
        }));
        this._pins = MUSEUM_CATEGORY_PINS;
        this._exclusions = CATEGORY_EXCLUSIONS;
        this.renderBoard();
        // probe dev-write availability quietly
        fetch('/__curia/apply', { method: 'GET' })
            .then(r => { this._devWrite = r.status === 405; this.renderBar(); })
            .catch(() => { this._devWrite = false; this.renderBar(); });
    }

    async loadCategory(categoryId) {
        if (this.inventory.has(categoryId)) return this.inventory.get(categoryId);
        const inv = { live: [], pins: [], excluded: [], loading: true };
        this.inventory.set(categoryId, inv);

        const { MuseumProvider, MUSEUM_CATEGORIES } = await import('../sources/visual/museum.js');
        const cat = MUSEUM_CATEGORIES[categoryId];
        const provider = new MuseumProvider();

        // live surface (clauses categories only) — WITHOUT exclusions,
        // so excluded works remain visible here, badged, restorable
        if (cat?.clauses) {
            try {
                const raw = await this._fetchLiveUnfiltered(provider, categoryId, cat);
                const excludedIds = new Set((this._exclusions[categoryId] || []).map(String));
                for (const w of raw) {
                    (excludedIds.has(String(w.id)) ? inv.excluded : inv.live).push({
                        key: `aic:${w.id}`, source: 'aic', id: w.id,
                        title: w.title, artist: w.artist, date: w.date,
                        img: w.url, sourceName: 'Art Institute of Chicago'
                    });
                }
            } catch (e) { inv.liveError = String(e.message || e); }
        }

        // pins — resolved through the imagery service for real metadata
        const pins = this._pins[categoryId] || [];
        if (pins.length) {
            try {
                const { resolveCollection } = await import('../content/atrium/imagery/service.js');
                const CHUNK = 10;
                for (let i = 0; i < pins.length; i += CHUNK) {
                    const batch = await resolveCollection({ works: pins.slice(i, i + CHUNK) }, {});
                    for (const w of batch) {
                        const [source, id] = String(w.id).split(':');
                        inv.pins.push({
                            key: w.id, source, id,
                            title: w.title, artist: w.artist, date: w.date,
                            img: w.imageUrl, sourceName: w.sourceName
                        });
                    }
                    inv.loading = i + CHUNK < pins.length;
                    if (this.openCategory === categoryId) this.renderDetail();
                }
            } catch (e) { inv.pinError = String(e.message || e); }
        }
        inv.loading = false;
        if (this.openCategory === categoryId) this.renderDetail();
        return inv;
    }

    async _fetchLiveUnfiltered(provider, categoryId, cat) {
        // the provider bakes exclusions in; the Curia needs the raw
        // surface, so it queries the same clauses directly
        const params = new URLSearchParams({
            'query[bool][must][0][term][is_public_domain]': 'true',
            limit: '100',
            fields: 'id,title,image_id,artist_display,date_display'
        });
        const flatten = (v, p) => {
            if (Array.isArray(v)) v.forEach((x, i) => flatten(x, `${p}[${i}]`));
            else if (v && typeof v === 'object') {
                for (const [k, x] of Object.entries(v)) flatten(x, `${p}[${k}]`);
            } else params.set(p, String(v));
        };
        cat.clauses.forEach((c, i) => flatten(c, `query[bool][must][${i + 1}]`));
        const r = await fetch(`https://api.artic.edu/api/v1/artworks/search?${params}`);
        const j = await r.json();
        return (j.data || []).filter(d => d.image_id).map(d => ({
            id: String(d.id), title: d.title, artist: d.artist_display,
            date: d.date_display,
            url: `https://www.artic.edu/iiif/2/${d.image_id}/full/400,/0/default.jpg`
        }));
    }

    // ---------- changeset ----------

    _queue(verb, entry) {
        this.changeset[verb].push(entry);
        this.renderBar();
    }

    changeCount() {
        return Object.values(this.changeset).reduce((n, a) => n + a.length, 0);
    }

    async applyChangeset() {
        const status = this.container.querySelector('.curia-status');
        try {
            const r = await fetch('/__curia/apply', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(this.changeset)
            });
            const j = await r.json();
            if (!j.ok) throw new Error(j.error || 'apply failed');
            status.textContent = `written to canon: ${Object.entries(j.applied)
                .filter(([, n]) => n > 0).map(([k, n]) => `${VERB_LABELS[k]} ${n}`).join(', ') || 'no changes'}`;
            this.changeset = { exclude: [], unexclude: [], addPin: [], removePin: [], movePin: [], setLiveSearch: [] };
            this.inventory.clear();
            // re-import fresh canon (dev server serves the new module)
            this.categories = null;
            await this.load();
            if (this.openCategory) this.openDetail(this.openCategory);
        } catch (e) {
            status.textContent = `write failed: ${e.message}`;
        }
    }

    async copyChangeset() {
        const payload = JSON.stringify(this.changeset);
        try { await navigator.clipboard.writeText(payload); }
        catch { prompt('copy this changeset:', payload); }
        const status = this.container.querySelector('.curia-status');
        status.textContent = `changeset copied (${this.changeCount()} edits) — apply via the dev server`;
    }

    // ---------- render ----------

    render() {
        this.container.innerHTML = `
            <div class="curia">
                <div class="curia-scroll">
                    <header class="curia-header">
                        <button class="curia-back" data-nav="portal">← Portal</button>
                        <h1>The Curia</h1>
                        <p class="curia-sub">The visual canon, governed. Every work each category can
                        serve — live search and pins alike — with the verbs the audits proved:
                        exclude, restore, move, unpin.</p>
                    </header>
                    <div class="curia-board"></div>
                    <div class="curia-detail" hidden></div>
                </div>
                <footer class="curia-bar">
                    <span class="curia-count"></span>
                    <button class="curia-apply" hidden>Apply to canon</button>
                    <button class="curia-copy" hidden>Copy changeset</button>
                    <span class="curia-status"></span>
                </footer>
            </div>`;
        this.container.querySelector('.curia-back')
            .addEventListener('click', () => this.onNavigate('portal'));
        this.container.querySelector('.curia-apply')
            .addEventListener('click', () => this.applyChangeset());
        this.container.querySelector('.curia-copy')
            .addEventListener('click', () => this.copyChangeset());
        this.container.querySelector('.curia-board')
            .addEventListener('click', (e) => {
                const card = e.target.closest('[data-category]');
                if (card) this.openDetail(card.dataset.category);
            });
        this.container.querySelector('.curia-detail')
            .addEventListener('click', (e) => this._onDetailClick(e));
    }

    renderBoard() {
        const board = this.container.querySelector('.curia-board');
        if (!this.categories) { board.innerHTML = '<p class="curia-loading">reading the canon…</p>'; return; }
        board.innerHTML = this.categories.map(c => `
            <button class="curia-cat" data-category="${c.id}">
                <span class="curia-cat-name">${escapeHtml(c.name)}</span>
                <span class="curia-cat-mode ${c.mode === 'pinned-only' ? 'is-pinned' : 'is-live'}">${c.mode}</span>
                <span class="curia-cat-stats">${c.pinCount} pins${c.exclusionCount ? ` · ${c.exclusionCount} excluded` : ''}</span>
            </button>`).join('');
        this.renderBar();
    }

    renderBar() {
        const n = this.changeCount();
        this.container.querySelector('.curia-count').textContent =
            n ? `${n} pending edit${n === 1 ? '' : 's'}` : '';
        this.container.querySelector('.curia-apply').hidden = !(n && this._devWrite === true);
        this.container.querySelector('.curia-copy').hidden = !(n && this._devWrite !== true);
    }

    async openDetail(categoryId) {
        this.openCategory = categoryId;
        this.container.querySelector('.curia-board').hidden = true;
        const detail = this.container.querySelector('.curia-detail');
        detail.hidden = false;
        detail.innerHTML = '<p class="curia-loading">assembling the inventory…</p>';
        await this.loadCategory(categoryId);
        this.renderDetail();
    }

    renderDetail() {
        const categoryId = this.openCategory;
        const inv = this.inventory.get(categoryId);
        const cat = this.categories.find(c => c.id === categoryId);
        const detail = this.container.querySelector('.curia-detail');
        if (!inv || !cat) return;

        const moveTargets = this.categories.filter(c => c.id !== categoryId);
        const card = (w, origin) => `
            <div class="curia-work" data-key="${escapeHtml(w.key)}" data-origin="${origin}">
                <img loading="lazy" src="${escapeHtml(w.img || '')}" alt="">
                <div class="curia-work-meta">
                    <div class="curia-work-title">${escapeHtml(w.title || '(untitled)')}</div>
                    <div class="curia-work-artist">${escapeHtml((w.artist || '').split('\n')[0])}</div>
                    <div class="curia-work-src">${escapeHtml(w.sourceName || '')} · <span class="curia-origin curia-origin-${origin}">${origin}</span></div>
                </div>
                <div class="curia-work-verbs">
                    ${origin === 'live' ? `<button data-verb="exclude">exclude</button>` : ''}
                    ${origin === 'excluded' ? `<button data-verb="unexclude">restore</button>` : ''}
                    ${origin === 'pin' ? `<button data-verb="removePin">unpin</button>
                        <select data-verb="movePin"><option value="">move →</option>
                        ${moveTargets.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
                        </select>` : ''}
                </div>
            </div>`;

        detail.innerHTML = `
            <div class="curia-detail-head">
                <button class="curia-detail-back">← categories</button>
                <h2>${escapeHtml(cat.name)}</h2>
                <span class="curia-detail-stats">
                    ${inv.live.length} live · ${inv.pins.length} pins · ${inv.excluded.length} excluded
                    ${inv.loading ? ' · resolving…' : ''}
                </span>
                ${cat.hasClauses ? `
                <label class="curia-live-toggle" title="Serve this category's AIC live-search results alongside the pins (canon-wide, default off)">
                    <input type="checkbox" data-verb="setLiveSearch" ${cat.liveOn ? 'checked' : ''}>
                    <span>Live-AIC ${cat.liveOn ? 'on' : 'off'}</span>
                </label>` : ''}
            </div>
            ${inv.pins.length ? `<h3>Pinned (${inv.pins.length})</h3>
                <div class="curia-grid">${inv.pins.map(w => card(w, 'pin')).join('')}</div>` : ''}
            ${inv.live.length ? `<h3>Live search (${inv.live.length})</h3>
                <div class="curia-grid">${inv.live.map(w => card(w, 'live')).join('')}</div>` : ''}
            ${inv.excluded.length ? `<h3>Excluded (${inv.excluded.length})</h3>
                <div class="curia-grid">${inv.excluded.map(w => card(w, 'excluded')).join('')}</div>` : ''}
            ${inv.liveError ? `<p class="curia-error">live surface unavailable: ${escapeHtml(inv.liveError)}</p>` : ''}`;
        detail.querySelector('.curia-detail-back').addEventListener('click', () => {
            this.openCategory = null;
            detail.hidden = true;
            this.container.querySelector('.curia-board').hidden = false;
        });
        detail.addEventListener('change', (e) => this._onDetailChange(e), { once: false });
    }

    _onDetailClick(e) {
        const btn = e.target.closest('button[data-verb]');
        if (!btn) return;
        const workEl = btn.closest('.curia-work');
        const key = workEl.dataset.key;
        const [source, id] = key.split(':');
        const category = this.openCategory;
        const verb = btn.dataset.verb;
        if (verb === 'exclude') this._queue('exclude', { category, source, id });
        if (verb === 'unexclude') this._queue('unexclude', { category, id });
        if (verb === 'removePin') this._queue('removePin', { category, source, id });
        workEl.classList.add(`curia-marked-${verb}`);
        btn.disabled = true;
    }

    _onDetailChange(e) {
        const toggle = e.target.closest('input[data-verb="setLiveSearch"]');
        if (toggle) {
            this._queue('setLiveSearch', {
                category: this.openCategory, enabled: toggle.checked
            });
            toggle.closest('.curia-live-toggle').querySelector('span').textContent =
                `Live-AIC ${toggle.checked ? 'on' : 'off'} (pending)`;
            return;
        }
        const sel = e.target.closest('select[data-verb="movePin"]');
        if (!sel || !sel.value) return;
        const workEl = sel.closest('.curia-work');
        const [source, id] = workEl.dataset.key.split(':');
        this._queue('movePin', { from: this.openCategory, to: sel.value, source, id });
        workEl.classList.add('curia-marked-movePin');
        sel.disabled = true;
    }

    destroy() {
        this.container.innerHTML = '';
    }
}
