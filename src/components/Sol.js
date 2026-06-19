/**
 * SOL Component
 * The pragmatic, diurnal temporal arm of R.I.S.E.
 */

import { SOL_TAXONOMY, SOL_SEQUENCES } from '../content/sol-sequences.js';

export class Sol {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => { });
        this.onLaunchSequence = options.onLaunchSequence || (() => { });

        // State
        this.currentTime = new Date();
        this.activeCategory = 'temporal';
        this.timeUpdateInterval = null;

        this.render();
        this.attachEvents();
        this.startClock();
        
        // Show initial temporal recommendation
        this.updateRecommendation();
    }

    startClock() {
        this.timeUpdateInterval = setInterval(() => {
            this.currentTime = new Date();
            this.updateClockDisplay();
            // Periodically check if recommendation should change (e.g. every hour)
        }, 1000);
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
        let sequenceId = 'sol-midday';
        let greeting = 'Good afternoon';
        let context = 'The day is at its peak.';

        if (hour >= 4 && hour < 8) {
            sequenceId = 'sol-dawn';
            greeting = 'Good morning';
            context = 'The world is just waking up.';
        } else if (hour >= 8 && hour < 11) {
            sequenceId = 'sol-morning';
            greeting = 'Good morning';
            context = 'The day begins its demands.';
        } else if (hour >= 11 && hour < 14) {
            sequenceId = 'sol-midday';
            greeting = 'Good afternoon';
            context = 'The pause at the peak.';
        } else if (hour >= 14 && hour < 18) {
            sequenceId = 'sol-afternoon';
            greeting = 'Good afternoon';
            context = 'The long slope of the day.';
        } else if (hour >= 18 && hour < 22) {
            sequenceId = 'sol-evening';
            greeting = 'Good evening';
            context = 'The unwinding.';
        } else if (hour >= 22 || hour < 2) {
            sequenceId = 'sol-night';
            greeting = 'Good night';
            context = 'The descent into rest.';
        } else {
            sequenceId = 'sol-deepnight';
            greeting = 'Good night';
            context = 'The world is entirely quiet.';
        }

        const sequence = SOL_SEQUENCES.find(s => s.id === sequenceId);
        return { sequence, greeting, context };
    }

    render() {
        this.container.innerHTML = `
            <div class="sol-view">
                <header class="view-header">
                    <button class="nav-back" aria-label="Back to Portal">‹ Return</button>
                    <div class="view-title">
                        <h1>S O L   S E Q U E N C E S</h1>
                        <p class="view-subtitle">Functional content for lived time.</p>
                    </div>
                </header>

                <div class="sol-content">
                    <div class="sol-recommendation-panel card glow-panel">
                        <svg class="sol-sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                        <div class="sol-greeting" id="sol-greeting">...</div>
                        <div class="sol-context" id="sol-context">...</div>
                        
                        <div class="sol-suggested-label">Suggested:</div>
                        <div class="sol-suggested-title" id="sol-suggested-title">...</div>
                        
                        <div class="sol-recommendation-actions">
                            <button class="btn-primary sol-btn-begin" id="sol-btn-begin">Begin Sequence</button>
                        </div>
                    </div>

                    <div class="sol-browser">
                        <div class="sol-tabs">
                            <button class="sol-tab active" data-category="temporal">I. Temporal</button>
                            <button class="sol-tab" data-category="situational">II. Situational</button>
                            <button class="sol-tab" data-category="archetypal">III. Archetypal</button>
                        </div>
                        
                        <div class="sol-grid" id="sol-grid">
                            <!-- Populated via JS -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.updateRecommendation();
        this.renderCategoryGrid('temporal');
    }

    updateRecommendation() {
        const { sequence, greeting, context } = this.getSuggestedSequence();
        
        const greetingEl = this.container.querySelector('#sol-greeting');
        const contextEl = this.container.querySelector('#sol-context');
        const titleEl = this.container.querySelector('#sol-suggested-title');
        const beginBtn = this.container.querySelector('#sol-btn-begin');
        
        if (greetingEl) greetingEl.innerHTML = `${greeting}. It is <span class="sol-current-time">${this.formatTime(this.currentTime)}</span>.`;
        if (contextEl) contextEl.textContent = context;
        if (titleEl && sequence) titleEl.textContent = sequence.title;
        
        if (beginBtn && sequence) {
            beginBtn.onclick = () => {
                this.onLaunchSequence({ sequence, config: sequence.config });
            };
        }
    }

    renderCategoryGrid(categoryId) {
        const grid = this.container.querySelector('#sol-grid');
        if (!grid) return;
        
        const sequences = SOL_SEQUENCES.filter(s => s.category === categoryId);
        
        grid.innerHTML = sequences.map(seq => `
            <div class="card sol-card" data-id="${seq.id}">
                <div class="sol-card-header">
                    <h3 class="sol-card-title">${seq.title}</h3>
                    <span class="sol-card-duration">${seq.durationEst}</span>
                </div>
                <div class="sol-card-subtitle">${seq.subtitle}</div>
                <p class="sol-card-desc">${seq.description}</p>
                <div class="sol-card-footer">
                    <span class="sol-card-tone">${seq.tone}</span>
                    <button class="btn-secondary sol-btn-launch" data-id="${seq.id}">Launch</button>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.sol-btn-launch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const seqId = btn.dataset.id;
                const sequence = SOL_SEQUENCES.find(s => s.id === seqId);
                if (sequence) {
                    this.onLaunchSequence({ sequence, config: sequence.config });
                }
            });
        });
    }

    attachEvents() {
        const backBtn = this.container.querySelector('.nav-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.onNavigate('portal');
            });
        }

        const tabs = this.container.querySelectorAll('.sol-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
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
