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

// Temporal windows of the day — single source of truth for
// greeting, context line, and the suggested sequence.
const SOL_WINDOWS = [
    { from: 4, to: 8, sequenceId: 'sol-dawn', greeting: 'Good morning', context: 'The world is just waking up.' },
    { from: 8, to: 11, sequenceId: 'sol-morning', greeting: 'Good morning', context: 'The day begins its demands.' },
    { from: 11, to: 14, sequenceId: 'sol-midday', greeting: 'Good afternoon', context: 'The pause at the peak.' },
    { from: 14, to: 18, sequenceId: 'sol-afternoon', greeting: 'Good afternoon', context: 'The long slope of the day.' },
    { from: 18, to: 22, sequenceId: 'sol-evening', greeting: 'Good evening', context: 'The unwinding.' },
    { from: 22, to: 26, sequenceId: 'sol-night', greeting: 'Good night', context: 'The descent into rest.' }, // 22:00–02:00
    { from: 2, to: 4, sequenceId: 'sol-deepnight', greeting: 'Good night', context: 'The world is entirely quiet.' }
];

const SOL_CATEGORIES = [
    { id: 'temporal', numeral: 'I', name: 'Temporal' },
    { id: 'situational', numeral: 'II', name: 'Situational' },
    { id: 'archetypal', numeral: 'III', name: 'Archetypal' }
];

export class Sol {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => { });
        this.onLaunchSequence = options.onLaunchSequence || (() => { });

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
        const { sequence } = this.getSuggestedSequence();
        if (sequence && sequence.id !== this.suggestedId) {
            this.updateRecommendation();
            if (this.activeCategory === 'temporal') {
                this.renderCategoryGrid('temporal');
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

    getSuggestedSequence() {
        const hour = this.currentTime.getHours();
        // Normalize into [2, 26) so the 22:00–02:00 night window is contiguous
        const h = hour < 2 ? hour + 24 : hour;
        const window = SOL_WINDOWS.find(w => h >= w.from && h < w.to) || SOL_WINDOWS[2];
        const sequence = SOL_SEQUENCES.find(s => s.id === window.sequenceId);
        return { sequence, greeting: window.greeting, context: window.context };
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
                                const count = SOL_SEQUENCES.filter(s => s.category === cat.id).length;
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

    updateRecommendation() {
        const { sequence, greeting, context } = this.getSuggestedSequence();
        this.suggestedId = sequence?.id || null;

        const greetingEl = this.container.querySelector('#sol-greeting');
        const contextEl = this.container.querySelector('#sol-context');
        const titleEl = this.container.querySelector('#sol-suggested-title');
        const subEl = this.container.querySelector('#sol-suggested-sub');
        const metaEl = this.container.querySelector('#sol-suggested-meta');
        const beginBtn = this.container.querySelector('#sol-btn-begin');

        if (greetingEl) greetingEl.innerHTML = `${greeting}. It is <span class="sol-current-time">${this.formatTime(this.currentTime)}</span>.`;
        if (contextEl) contextEl.textContent = context;

        if (sequence) {
            if (titleEl) titleEl.textContent = sequence.title;
            if (subEl) subEl.textContent = sequence.subtitle;
            if (metaEl) {
                const badge = this.getVisualBadge(sequence.config);
                metaEl.innerHTML = `
                    <span>${this.getDurationLabel(sequence)}</span>
                    <span class="sol-meta-sep">·</span>
                    <span>${sequence.config?.curve || 'flat'} curve</span>
                    <span class="sol-meta-sep">·</span>
                    <span>${sequence.config?.audioPreset || 'silent'} audio</span>
                    <span class="sol-meta-sep">·</span>
                    <span class="sol-meta-visual">${badge.icon} ${badge.label}</span>
                `;
            }
            if (beginBtn) {
                beginBtn.onclick = () => {
                    if (window.rise?.audioEngine) {
                        window.rise.audioEngine.playClick();
                    }
                    this.onLaunchSequence({ sequence, config: sequence.config });
                };
            }
        }
    }

    renderCategoryGrid(categoryId) {
        const grid = this.container.querySelector('#sol-grid');
        if (!grid) return;

        grid.setAttribute('aria-labelledby', `sol-tab-${categoryId}`);

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
