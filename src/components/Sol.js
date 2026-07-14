/**
 * SOL Component
 * The pragmatic, diurnal temporal arm of R.I.S.E.
 *
 * Top of view: a live solar dial + the sequence aligned with this hour.
 * Below: the full catalog in three registers (Temporal / Situational / Archetypal).
 *
 * Durations are computed honestly from sequence content + wpm via the
 * same chunker the session player uses — not hardcoded estimates.
 */

import { SOL_SEQUENCES } from '../content/sol-sequences.js';
import { chunkText } from '../core/chunker.js';
import { MemoryCore } from '../core/memory.js';
import { escapeHtml } from '../core/sanitize.js';

// Temporal windows of the day — single source of truth for
// greeting, context line, the default sequence, and the My Day plan.
const SOL_WINDOWS = [
    { key: 'dawn', name: 'Dawn', range: '04–08', from: 4, to: 8, sequenceId: 'sol-dawn', greeting: 'Good morning', context: 'The world is just waking up.' },
    { key: 'morning', name: 'Morning', range: '08–11', from: 8, to: 11, sequenceId: 'sol-morning', greeting: 'Good morning', context: 'The day begins its demands.' },
    { key: 'midday', name: 'Midday', range: '11–14', from: 11, to: 14, sequenceId: 'sol-midday', greeting: 'Good afternoon', context: 'The pause at the peak.' },
    { key: 'afternoon', name: 'Afternoon', range: '14–18', from: 14, to: 18, sequenceId: 'sol-afternoon', greeting: 'Good afternoon', context: 'The long slope of the day.' },
    { key: 'evening', name: 'Evening', range: '18–22', from: 18, to: 22, sequenceId: 'sol-evening', greeting: 'Good evening', context: 'The unwinding.' },
    { key: 'night', name: 'Night', range: '22–02', from: 22, to: 26, sequenceId: 'sol-night', greeting: 'Good night', context: 'The descent into rest.' }, // 22:00–02:00
    { key: 'deepnight', name: 'Deep Night', range: '02–04', from: 2, to: 4, sequenceId: 'sol-deepnight', greeting: 'Good night', context: 'The world is entirely quiet.' }
];

const SOL_CATEGORIES = [
    { id: 'temporal', numeral: 'I', name: 'Temporal' },
    { id: 'situational', numeral: 'II', name: 'Situational' },
    { id: 'archetypal', numeral: 'III', name: 'Archetypal' },
    { id: 'myday', numeral: 'IV', name: 'My Day' }
];

export class Sol {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => { });
        this.onLaunchSequence = options.onLaunchSequence || (() => { });
        this.onLaunchBlueprint = options.onLaunchBlueprint || (() => { });

        // State
        this.currentTime = new Date();
        this.activeCategory = 'temporal';
        this.timeUpdateInterval = null;
        this.suggestedId = null;
        this.durationCache = new Map();

        this.render();
        this.attachEvents();
        this.startClock();
    }

    // ─── Time & suggestion model ───

    startClock() {
        this.timeUpdateInterval = setInterval(() => {
            // The router keeps view instances alive when hidden — skip all
            // work until the view is visible again (refresh() runs on re-entry)
            if (this.container.offsetParent === null) return;
            this.refresh();
        }, 1000);
    }

    /**
     * Bring the clock, dial, and recommendation up to date.
     * Called every visible tick and by the router on re-entry (update).
     */
    refresh() {
        this.currentTime = new Date();
        this.updateClockDisplay();
        this.updateSolarArc();

        // Re-evaluate the temporal window; refresh panel + NOW badge on boundary cross
        const { suggestion } = this.getSuggestedSequence();
        if (suggestion && suggestion.id !== this.suggestedId) {
            this.updateRecommendation();
            if (this.activeCategory === 'temporal' || this.activeCategory === 'myday') {
                this.renderCategoryGrid(this.activeCategory);
            }
        }
    }

    /**
     * Router re-entry hook — the instance was preserved while hidden,
     * so the display may be minutes or hours stale.
     */
    update() {
        this._lastMinuteKey = null; // force the solar arc to reposition
        this.refresh();
        this.updateRecommendation();
    }

    updateClockDisplay() {
        const timeDisplay = this.container.querySelector('.sol-current-time');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(this.currentTime);
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    getCurrentWindow() {
        const hour = this.currentTime.getHours();
        // Normalize into [2, 26) so the 22:00–02:00 night window is contiguous
        const h = hour < 2 ? hour + 24 : hour;
        return SOL_WINDOWS.find(w => h >= w.from && h < w.to) || SOL_WINDOWS[2];
    }

    /**
     * Resolve a window through the user's My Day plan.
     * Returns a normalized suggestion the panel and Begin button can use
     * regardless of kind, plus provenance flags. A dangling blueprint
     * reference (deleted in the Workshop) degrades to the canonical
     * default and is reported via `missing` for the My Day view.
     */
    resolveWindow(window) {
        const plan = MemoryCore.getSolPlan();
        const entry = plan[window.key];
        const fallback = () => {
            const sequence = SOL_SEQUENCES.find(s => s.id === window.sequenceId);
            return {
                kind: 'sol', payload: sequence, id: sequence.id,
                title: sequence.title, subtitle: sequence.subtitle,
                config: sequence.config, isCustom: false, missing: false
            };
        };

        if (!entry) return fallback();

        if (entry.kind === 'sol') {
            const sequence = SOL_SEQUENCES.find(s => s.id === entry.id);
            if (!sequence) return { ...fallback(), missing: true };
            return {
                kind: 'sol', payload: sequence, id: sequence.id,
                title: sequence.title, subtitle: sequence.subtitle,
                config: sequence.config, isCustom: true, missing: false
            };
        }

        if (entry.kind === 'blueprint') {
            const blueprint = MemoryCore.getWorkshopBlueprints().find(bp => bp.id === entry.id);
            if (!blueprint) return { ...fallback(), missing: true };
            return {
                kind: 'blueprint', payload: blueprint, id: blueprint.id,
                title: blueprint.title || 'Untitled Sequence',
                subtitle: 'From your Workshop',
                config: {
                    wpm: blueprint.wpm || 220,
                    curve: blueprint.curve || 'flat',
                    audioPreset: blueprint.audioPreset || 'silent',
                    visualConfig: blueprint.visualConfig
                },
                isCustom: true, missing: false
            };
        }

        return fallback();
    }

    getSuggestedSequence() {
        const window = this.getCurrentWindow();
        const suggestion = this.resolveWindow(window);
        return {
            suggestion,
            window,
            // Kept for callers that only need the canonical shape
            sequence: suggestion.kind === 'sol' ? suggestion.payload : null,
            greeting: window.greeting,
            context: window.context
        };
    }

    launchSuggestion(suggestion) {
        if (window.rise?.audioEngine) {
            window.rise.audioEngine.playClick();
        }
        if (suggestion.kind === 'blueprint') {
            this.onLaunchBlueprint(suggestion.payload);
        } else {
            this.onLaunchSequence({ sequence: suggestion.payload, config: suggestion.payload.config });
        }
    }

    /**
     * Honest duration estimate: chunk the actual content at the sequence's
     * wpm (same engine as the player) and sum atom durations.
     */
    getDurationLabel(seq) {
        if (this.durationCache.has(seq.id)) return this.durationCache.get(seq.id);

        let label = seq.durationEst || '';
        try {
            const atoms = chunkText(seq.content, { mode: 'word', wpm: seq.config?.wpm || 220 });
            const totalMs = atoms.reduce((sum, a) => sum + (a.duration || 0), 0);
            const min = totalMs / 60000;
            if (min < 0.75) label = '< 1 min';
            else if (min < 1.5) label = '≈ 1 min';
            else label = `≈ ${Math.round(min)} min`;
        } catch (e) {
            console.warn('[Sol] Duration estimate failed for', seq.id, e);
        }

        this.durationCache.set(seq.id, label);
        return label;
    }

    /**
     * Glyph + label for a sequence's visual mode
     */
    getVisualBadge(config) {
        const vc = config?.visualConfig;
        if (!vc || !vc.visualMode || vc.visualMode === 'off') {
            return { icon: '○', label: 'still' };
        }
        if (vc.visualMode === 'focals') {
            return { icon: '◯', label: `focal · ${vc.focals?.standardGlyph || 'breath'}` };
        }
        if (vc.visualMode === 'attractor') {
            return { icon: '∮', label: `attractor · ${vc.attractor?.system || 'aizawa'}` };
        }
        return { icon: '◈', label: 'rhythmic' };
    }

    // ─── Solar dial ───

    /**
     * Position of the orb along the dial for the current time.
     * Day (06–18): upper arc, ember sun. Night (18–06): lower arc, pale moon.
     */
    getSolarPosition() {
        const t = this.currentTime.getHours() + this.currentTime.getMinutes() / 60;
        const CX = 120, CY = 86;
        const isDay = t >= 6 && t < 18;
        if (isDay) {
            const theta = Math.PI * (1 - (t - 6) / 12);
            return { x: CX + 82 * Math.cos(theta), y: CY - 62 * Math.sin(theta), isDay };
        }
        const tn = (t - 18 + 24) % 24; // 0..12 across the night
        const theta = Math.PI * (1 - tn / 12);
        return { x: CX + 82 * Math.cos(theta), y: CY + 26 * Math.sin(theta), isDay };
    }

    renderSolarArc() {
        const { x, y, isDay } = this.getSolarPosition();
        return `
            <svg class="sol-arc ${isDay ? 'is-day' : 'is-night'}" viewBox="0 0 240 110" aria-hidden="true">
                <!-- day arc -->
                <path class="sol-arc-day" d="M 38 86 A 82 62 0 0 1 202 86" fill="none" />
                <!-- night arc -->
                <path class="sol-arc-night" d="M 38 86 A 82 26 0 0 0 202 86" fill="none" />
                <!-- horizon -->
                <line class="sol-arc-horizon" x1="16" y1="86" x2="224" y2="86" />
                <!-- solstice ticks: dawn / noon / dusk -->
                <line class="sol-arc-tick" x1="38" y1="82" x2="38" y2="90" />
                <line class="sol-arc-tick" x1="120" y1="20" x2="120" y2="28" />
                <line class="sol-arc-tick" x1="202" y1="82" x2="202" y2="90" />
                <!-- the orb -->
                <circle class="sol-arc-orb" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" />
                <circle class="sol-arc-orb-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" />
            </svg>
        `;
    }

    updateSolarArc() {
        // Only reposition on minute changes — the orb moves ~0.2px/min
        const minuteKey = this.currentTime.getHours() * 60 + this.currentTime.getMinutes();
        if (minuteKey === this._lastMinuteKey) return;
        this._lastMinuteKey = minuteKey;

        const svg = this.container.querySelector('.sol-arc');
        if (!svg) return;
        const { x, y, isDay } = this.getSolarPosition();
        svg.classList.toggle('is-day', isDay);
        svg.classList.toggle('is-night', !isDay);
        const orb = svg.querySelector('.sol-arc-orb');
        const halo = svg.querySelector('.sol-arc-orb-halo');
        [orb, halo].forEach(el => {
            if (!el) return;
            el.setAttribute('cx', x.toFixed(1));
            el.setAttribute('cy', y.toFixed(1));
        });
    }

    // ─── Rendering ───

    render() {
        this.container.innerHTML = `
            <div class="sol-view">
                <header class="sol-header">
                    <button class="sol-back" aria-label="Back to Portal">‹ Return</button>
                    <div class="sol-title-block">
                        <h1 class="sol-title">S O L</h1>
                        <p class="sol-subtitle">Functional content for lived time.</p>
                    </div>
                </header>

                <div class="sol-content">
                    <section class="sol-now-panel" aria-label="Current recommendation" aria-live="polite">
                        <div class="sol-arc-wrap" id="sol-arc-wrap">${this.renderSolarArc()}</div>

                        <div class="sol-greeting" id="sol-greeting">...</div>
                        <div class="sol-context" id="sol-context">...</div>

                        <div class="sol-now-divider" aria-hidden="true"></div>

                        <div class="sol-suggested-label">Aligned with this hour</div>
                        <h2 class="sol-suggested-title" id="sol-suggested-title">...</h2>
                        <div class="sol-suggested-sub" id="sol-suggested-sub"></div>
                        <div class="sol-suggested-meta" id="sol-suggested-meta"></div>

                        <button class="sol-btn-begin" id="sol-btn-begin">Begin Sequence</button>
                    </section>

                    <section class="sol-browser" aria-label="Sequence catalog">
                        <div class="sol-tabs" role="tablist" aria-label="Sequence categories">
                            ${SOL_CATEGORIES.map(cat => {
                                const count = cat.id === 'myday'
                                    ? Object.keys(MemoryCore.getSolPlan()).length
                                    : SOL_SEQUENCES.filter(s => s.category === cat.id).length;
                                const active = this.activeCategory === cat.id;
                                return `
                                    <button class="sol-tab ${active ? 'active' : ''}"
                                        role="tab" aria-selected="${active}"
                                        id="sol-tab-${cat.id}" aria-controls="sol-grid"
                                        data-category="${cat.id}">
                                        <span class="sol-tab-numeral">${cat.numeral}.</span>
                                        <span class="sol-tab-name">${cat.name}</span>
                                        <span class="sol-tab-count">${count}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>

                        <div class="sol-grid" id="sol-grid" role="tabpanel" aria-labelledby="sol-tab-${this.activeCategory}">
                            <!-- Populated via JS -->
                        </div>
                    </section>
                </div>
            </div>
        `;

        this.updateRecommendation();
        this.renderCategoryGrid(this.activeCategory);
    }

    /**
     * Duration label for a suggestion of either kind — SOL sequences chunk
     * their content; blueprints join their sources' text.
     */
    getSuggestionDuration(suggestion) {
        if (suggestion.kind === 'sol') return this.getDurationLabel(suggestion.payload);

        const bp = suggestion.payload;
        const cacheKey = `bp:${bp.id}:${bp.updatedAt || 0}`;
        if (this.durationCache.has(cacheKey)) return this.durationCache.get(cacheKey);
        let label = '';
        try {
            const text = (bp.sources || [])
                .map(s => (typeof s.data === 'string' ? s.data : ''))
                .join('\n\n');
            if (text.trim()) {
                const atoms = chunkText(text, { mode: bp.chunkMode || 'word', wpm: bp.wpm || 220 });
                const min = atoms.reduce((sum, a) => sum + (a.duration || 0), 0) / 60000;
                label = min < 0.75 ? '< 1 min' : min < 1.5 ? '≈ 1 min' : `≈ ${Math.round(min)} min`;
            }
        } catch (e) {
            console.warn('[Sol] Blueprint duration estimate failed:', e);
        }
        this.durationCache.set(cacheKey, label);
        return label;
    }

    updateRecommendation() {
        const { suggestion, greeting, context } = this.getSuggestedSequence();
        this.suggestedId = suggestion?.id || null;

        const greetingEl = this.container.querySelector('#sol-greeting');
        const contextEl = this.container.querySelector('#sol-context');
        const labelEl = this.container.querySelector('.sol-suggested-label');
        const titleEl = this.container.querySelector('#sol-suggested-title');
        const subEl = this.container.querySelector('#sol-suggested-sub');
        const metaEl = this.container.querySelector('#sol-suggested-meta');
        const beginBtn = this.container.querySelector('#sol-btn-begin');

        if (greetingEl) greetingEl.innerHTML = `${greeting}. It is <span class="sol-current-time">${this.formatTime(this.currentTime)}</span>.`;
        if (contextEl) contextEl.textContent = context;
        if (labelEl) labelEl.textContent = suggestion?.isCustom ? 'From your plan' : 'Aligned with this hour';

        if (suggestion) {
            if (titleEl) titleEl.textContent = suggestion.title;
            if (subEl) subEl.textContent = suggestion.subtitle;
            if (metaEl) {
                const badge = this.getVisualBadge(suggestion.config);
                const duration = this.getSuggestionDuration(suggestion);
                metaEl.innerHTML = `
                    ${duration ? `<span>${duration}</span><span class="sol-meta-sep">·</span>` : ''}
                    <span>${suggestion.config?.curve || 'flat'} curve</span>
                    <span class="sol-meta-sep">·</span>
                    <span>${suggestion.config?.audioPreset || 'silent'} audio</span>
                    <span class="sol-meta-sep">·</span>
                    <span class="sol-meta-visual">${badge.icon} ${badge.label}</span>
                `;
            }
            if (beginBtn) {
                beginBtn.onclick = () => this.launchSuggestion(suggestion);
            }
        }
    }

    renderCategoryGrid(categoryId) {
        const grid = this.container.querySelector('#sol-grid');
        if (!grid) return;

        grid.setAttribute('aria-labelledby', `sol-tab-${categoryId}`);

        if (categoryId === 'myday') {
            this.renderMyDay(grid);
            return;
        }

        const sequences = SOL_SEQUENCES.filter(s => s.category === categoryId);

        grid.innerHTML = sequences.map((seq, i) => {
            const isNow = seq.id === this.suggestedId;
            const badge = this.getVisualBadge(seq.config);
            return `
                <article class="sol-card ${isNow ? 'sol-card--now' : ''}"
                    data-id="${seq.id}" tabindex="0" role="button"
                    aria-label="Launch ${seq.title} — ${seq.subtitle}"
                    style="animation-delay: ${i * 55}ms">
                    ${isNow ? '<span class="sol-card-now-badge">now</span>' : ''}
                    <div class="sol-card-header">
                        <h3 class="sol-card-title">${seq.title}</h3>
                        <span class="sol-card-duration">${this.getDurationLabel(seq)}</span>
                    </div>
                    <div class="sol-card-subtitle">${seq.subtitle}</div>
                    <p class="sol-card-desc">${seq.description}</p>
                    <div class="sol-card-meta">
                        <span class="sol-card-visual" title="Visual mode">${badge.icon} ${badge.label}</span>
                        <span class="sol-meta-sep">·</span>
                        <span>${seq.config?.wpm || 220} wpm</span>
                        <span class="sol-meta-sep">·</span>
                        <span>${seq.config?.curve || 'flat'}</span>
                        <span class="sol-meta-sep">·</span>
                        <span>${seq.config?.audioPreset || 'silent'}</span>
                    </div>
                    <div class="sol-card-footer">
                        <span class="sol-card-tone" title="${seq.tone}">${seq.tone}</span>
                        <button class="sol-btn-launch" data-id="${seq.id}" aria-hidden="true" tabindex="-1">Launch</button>
                    </div>
                </article>
            `;
        }).join('');

        const launch = (seqId) => {
            const sequence = SOL_SEQUENCES.find(s => s.id === seqId);
            if (!sequence) return;
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playClick();
            }
            this.onLaunchSequence({ sequence, config: sequence.config });
        };

        grid.querySelectorAll('.sol-card').forEach(card => {
            card.addEventListener('click', () => launch(card.dataset.id));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    launch(card.dataset.id);
                }
            });
        });
    }

    /**
     * My Day — the user's plan: each canonical window can hold its default,
     * any curated SOL sequence, or any Workshop blueprint. The windows
     * themselves are fixed; only their contents are yours.
     */
    renderMyDay(grid) {
        const plan = MemoryCore.getSolPlan();
        const blueprints = MemoryCore.getWorkshopBlueprints();
        const currentWindow = this.getCurrentWindow();

        grid.innerHTML = `
            <div class="sol-myday">
                <p class="sol-myday-intro text-fog">
                    Assign any sequence — curated, or compiled in your Workshop — to the
                    hours of your day. The dial's suggestion follows your plan.
                </p>
                ${SOL_WINDOWS.map(w => {
                    const entry = plan[w.key];
                    const resolved = this.resolveWindow(w);
                    const defaultSeq = SOL_SEQUENCES.find(s => s.id === w.sequenceId);
                    const isNow = w.key === currentWindow.key;
                    return `
                        <div class="sol-myday-row ${entry ? 'customized' : ''} ${isNow ? 'now' : ''}">
                            <div class="sol-myday-window">
                                <span class="sol-myday-name">${w.name}</span>
                                <span class="sol-myday-range font-mono">${w.range}</span>
                                ${isNow ? '<span class="sol-myday-nowdot" title="Current window">●</span>' : ''}
                            </div>
                            <div class="sol-myday-assignment">
                                <select class="sol-myday-select" data-window="${w.key}" aria-label="Sequence for ${w.name}">
                                    <option value="" ${!entry ? 'selected' : ''}>Default · ${defaultSeq.title}</option>
                                    <optgroup label="SOL Sequences">
                                        ${SOL_SEQUENCES.map(s => `
                                            <option value="sol:${s.id}"
                                                ${entry?.kind === 'sol' && entry.id === s.id ? 'selected' : ''}>
                                                ${s.title}
                                            </option>
                                        `).join('')}
                                    </optgroup>
                                    ${blueprints.length ? `
                                        <optgroup label="My Sequences">
                                            ${blueprints.map(bp => `
                                                <option value="blueprint:${escapeHtml(bp.id)}"
                                                    ${entry?.kind === 'blueprint' && entry.id === bp.id ? 'selected' : ''}>
                                                    ${escapeHtml(bp.title || 'Untitled Sequence')}
                                                </option>
                                            `).join('')}
                                        </optgroup>
                                    ` : ''}
                                </select>
                                ${resolved.missing ? '<span class="sol-myday-missing">missing — default restored</span>' : ''}
                                ${entry ? `<button type="button" class="sol-myday-reset" data-reset-window="${w.key}" title="Restore default">↺</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
                ${!blueprints.length ? `
                    <p class="sol-myday-hint text-mist">
                        Compile your own sequences in the Workshop to schedule them here.
                    </p>
                ` : ''}
            </div>
        `;

        grid.querySelectorAll('.sol-myday-select').forEach(select => {
            select.addEventListener('change', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                const value = select.value;
                const entry = value
                    ? { kind: value.split(':')[0], id: value.slice(value.indexOf(':') + 1) }
                    : null;
                MemoryCore.setSolPlanEntry(select.dataset.window, entry);
                this.render();
                this.attachEvents();
            });
        });

        grid.querySelectorAll('[data-reset-window]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playClick();
                }
                MemoryCore.setSolPlanEntry(btn.dataset.resetWindow, null);
                this.render();
                this.attachEvents();
            });
        });
    }

    attachEvents() {
        const backBtn = this.container.querySelector('.sol-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playClick();
                }
                this.onNavigate('portal');
            });
        }

        const tabs = this.container.querySelectorAll('.sol-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.category === this.activeCategory) return;
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                this.activeCategory = tab.dataset.category;
                this.renderCategoryGrid(this.activeCategory);
            });
        });
    }

    destroy() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
    }
}
