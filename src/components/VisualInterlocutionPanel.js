/**
 * Visual Settings Panel
 * Configuration for visual experience during sessions
 *
 * Mutually exclusive modes:
 * - FOCALS: Persistent, gentle focal point (neurosensitive-friendly)
 * - ATTRACTOR: Persistent strange-attractor field orbiting the text stream
 * - INTERLOCUTION: Probabilistic visual interrupts
 *
 * Includes photosensitivity warning for Interlocution mode
 */

import { WIKIMEDIA_CATEGORIES } from '../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { MemoryCore } from '../core/memory.js';
import { ATTRACTOR_SYSTEMS } from '../visuals/attractor.js';
import { escapeHtml } from '../core/sanitize.js';

// Session storage key for safety consent
const SAFETY_CONSENT_KEY = 'rise-visual-interlocution-consent';

export class VisualInterlocutionPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.onChange = options.onChange || (() => { });
        this.onRequestSafetyModal = options.onRequestSafetyModal || null;

        // Configuration state
        this.config = {
            // Top-level mode: 'off' | 'focals' | 'attractor' | 'interlocution'
            visualMode: options.visualMode || 'off',

            // Focals config (persistent gentle focal point)
            focals: options.focals || {
                type: 'standard', // 'standard' | 'personal'
                standardGlyph: 'breath',
                personalImage: null
            },

            // Attractor config (persistent strange-attractor field)
            attractor: options.attractor || {
                system: 'aizawa' // 'aizawa' | 'thomas' | 'halvorsen'
            },

            // Living Text (semantic conductor subscriber) — independent of
            // the visual mode; hue/glow of the text stream follow the
            // emotional valence of the passage. Off by default.
            livingText: options.livingText || {
                enabled: false
            },

            // Callers pass visualConfig spread, so interlocution settings
            // arrive nested under options.interlocution; flattened keys are
            // honored as a fallback for legacy call sites.
            interlocution: {
                procedural: options.interlocution?.procedural ?? options.procedural ?? [],
                sourced: options.interlocution?.sourced ?? options.sourced ?? [],
                frequency: options.interlocution?.frequency ?? options.frequency ?? 0.2,
                duration: options.interlocution?.duration ?? options.duration ?? 80,
                kleePreset: options.interlocution?.kleePreset ?? options.kleePreset ?? 'random',
                // Responsive: the semantic conductor scales flash frequency
                // with passage arousal and picks generator/preset by mood
                responsive: options.interlocution?.responsive ?? false
            },
            
            // Session-local visuals
            customVisuals: options.customVisuals || []
        };

        // UI State
        this.activeAccordions = []; // 'procedural', 'universal', 'personal'

        this.locked = options.locked ?? false;
        this.lockedMessage = options.lockedMessage || 'Load text to configure visuals.';

        this.expanded = options.expanded ?? false;

        // Check if user has already given consent this session
        this.hasConsent = sessionStorage.getItem(SAFETY_CONSENT_KEY) === 'true';

        this.render();
        this.attachEvents();
        this.setupSafetyModal();
    }

    /**
     * Setup safety modal event listeners
     */
    setupSafetyModal() {
        const modal = document.getElementById('photosensitivity-modal');
        const cancelBtn = document.getElementById('safety-cancel');
        const acceptBtn = document.getElementById('safety-accept');

        if (!modal || !cancelBtn || !acceptBtn) return;

        cancelBtn.addEventListener('click', () => {
            this.hideSafetyModal();
            this.config.visualMode = 'off';
            this.render();
            this.attachEvents();
        });

        acceptBtn.addEventListener('click', () => {
            sessionStorage.setItem(SAFETY_CONSENT_KEY, 'true');
            this.hasConsent = true;
            this.hideSafetyModal();
            this.config.visualMode = 'interlocution';
            this.emitChange();
            this.render();
            this.attachEvents();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideSafetyModal();
                this.config.visualMode = 'off';
                this.render();
                this.attachEvents();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.hideSafetyModal();
                this.config.visualMode = 'off';
                this.render();
                this.attachEvents();
            }
        });
    }

    showSafetyModal() {
        const modal = document.getElementById('photosensitivity-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Focus the cancel button for accessibility
            const cancelBtn = document.getElementById('safety-cancel');
            cancelBtn?.focus();
        }
    }

    hideSafetyModal() {
        const modal = document.getElementById('photosensitivity-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update locked state
     */
    setLocked(locked) {
        this.locked = locked;
        if (this.locked) {
            this.config.visualMode = 'off';
            this.emitChange();
        }
        this.render();
        this.attachEvents();
    }

    /**
     * Programmatically update the visual mode
     */
    setVisualMode(mode) {
        if (this.locked) return;
        this.config.visualMode = mode;
        this.render();
        this.attachEvents();
        // Skip safety check here as it's assumed to be triggered by explicit logic
        // But we still emit the change
        this.emitChange();
    }

    /**
     * Programmatically set the full configuration (e.g., from archetype)
     * This bypasses the safety modal since archetype launch implies consent
     * Note: Does NOT check locked state - programmatic config should always apply
     */
    setConfig(visualConfig) {
        console.log('[VisualInterlocutionPanel] setConfig called:', visualConfig);

        // Apply visual mode
        if (visualConfig.visualMode) {
            this.config.visualMode = visualConfig.visualMode;
        }

        // Apply focals config
        if (visualConfig.focals) {
            this.config.focals = {
                ...this.config.focals,
                ...visualConfig.focals
            };
        }

        // Apply attractor config
        if (visualConfig.attractor) {
            this.config.attractor = {
                ...this.config.attractor,
                ...visualConfig.attractor
            };
        }

        // Apply Living Text config
        if (visualConfig.livingText) {
            this.config.livingText = {
                ...this.config.livingText,
                ...visualConfig.livingText
            };
        }

        // Apply interlocution config
        if (visualConfig.interlocution) {
            this.config.interlocution = {
                ...this.config.interlocution,
                ...visualConfig.interlocution
            };
        }

        // When setting interlocution mode via archetype, grant consent automatically
        // (User explicitly chose an archetype with interlocution, implying consent)
        if (visualConfig.visualMode === 'interlocution') {
            sessionStorage.setItem(SAFETY_CONSENT_KEY, 'true');
            this.hasConsent = true;
        }

        this.render();
        this.attachEvents();
        this.emitChange();
    }

    /**
     * Update the list of custom visuals from the Workshop
     */
    updateCustomVisuals(visuals) {
        this.config.customVisuals = visuals || [];
        // Auto-enable 'custom' in sourced if this was the first image added
        if (this.config.customVisuals.length > 0 && !this.config.interlocution.sourced.includes('custom')) {
            this.config.interlocution.sourced.push('custom');
        }
        this.render();
        this.attachEvents();
        this.emitChange();
    }

    /**
     * Get active types for Visual Cortex (interlocution mode only)
     */
    getActiveTypes() {
        if (this.config.visualMode !== 'interlocution') return [];

        const types = [...this.config.interlocution.procedural];
        const sourced = this.config.interlocution.sourced;
        
        // If 'custom' (active sequence) or any 'personal:' sequences are selected, add generic flags
        if (sourced.length > 0) {
            // Check for wikimedia diagrams (generic categories)
            if (sourced.some(s => s !== 'global-pool' && s !== 'custom' && !s.startsWith('personal:'))) {
                types.push('diagram');
            }
            // Check for active session images
            if (sourced.includes('custom')) {
                types.push('custom');
            }
            // Check for global pool
            if (sourced.includes('global-pool')) {
                types.push('global-pool');
            }
            // Personal blueprints are handled by their personal:ID in App.js
        }
        
        return types;
    }

    render() {
        if (this.locked) {
            this.container.innerHTML = `
                <div class="vi-panel ${this.expanded ? 'expanded' : ''}" role="region" aria-label="Rhythmic Settings">
                    <!-- Header (always visible) -->
                    <button class="vi-header" type="button" aria-expanded="${this.expanded}">
                        <span class="vi-title">Rhythmic Settings</span>
                        <span class="vi-status vi-status-sealed">⊘ Sealed</span>
                        <span class="vi-chevron">${this.expanded ? '▲' : '▼'}</span>
                    </button>
                    
                    <!-- Expandable Content -->
                        <div class="vi-locked-chamber">
                            <div class="vi-locked-sigil" aria-hidden="true">
                                <div class="vi-sigil-ring vi-sigil-ring--outer"></div>
                                <div class="vi-sigil-ring vi-sigil-ring--inner"></div>
                                <div class="vi-sigil-core">◈</div>
                            </div>
                            <p class="vi-locked-label">CHAMBER INACTIVE</p>
                            <p class="vi-locked-sub">${this.lockedMessage}</p>
                        </div>
                </div>
            `;
            return;
        }

        const proceduralPatterns = [
            { id: 'klee', name: 'Klee Lines', icon: '╱', hasPresets: true },
            { id: 'turrell', name: 'Turrell Fields', icon: '◈' },
            { id: 'fractal', name: 'Fractal Flames', icon: '✧' },
            { id: 'neural', name: 'Neural Networks', icon: '◉' },
            { id: 'rockgarden', name: 'Rock Garden', icon: '◯' }
        ];

        const kleePresets = [
            { id: 'random', name: 'Random' },
            { id: 'corporeal', name: 'Corporeal' },
            { id: 'structural', name: 'Structural' },
            { id: 'mythic', name: 'Mythic' },
            { id: 'volatile', name: 'Volatile' },
            { id: 'centered', name: 'Centered' }
        ];

        // Standard focal glyphs for neurosensitive-friendly viewing
        const focalGlyphs = [
            { id: 'breath', name: 'Breath', icon: '◯', dynamic: true, description: 'Gentle pulsing circle' },
            { id: 'anchor', name: 'Anchor', icon: '⚓', dynamic: false, description: 'Stable grounding point' },
            { id: 'lotus', name: 'Lotus', icon: '❀', dynamic: false, description: 'Centered bloom' },
            { id: 'eye', name: 'Eye', icon: '◉', dynamic: true, description: 'Soft focus ring' },
            { id: 'spiral', name: 'Spiral', icon: '◌', dynamic: true, description: 'Slow unwinding path' },
            { id: 'star', name: 'Star', icon: '✦', dynamic: false, description: 'Fixed point of light' },
            { id: 'wave', name: 'Wave', icon: '≈', dynamic: true, description: 'Gentle oscillation' },
            { id: 'void', name: 'Void', icon: '●', dynamic: false, description: 'Pure stillness' }
        ];

        // Universal Diagrams — generated from the Wikimedia provider registry
        // so the panel always shows exactly the categories that exist
        // (presets like SOL's 'solar' stay visible and modifiable).
        // Bare ids that the cortex legacy-routes to the Art Institute are
        // excluded here (only 'romantic' collides) — they live in the AIC
        // section below under their namespaced 'aic-' ids.
        const LEGACY_AIC_IDS = ['renaissance', 'romantic', 'impressionism', 'photography', 'surrealism', 'landscapes'];
        const diagramCategories = Object.entries(WIKIMEDIA_CATEGORIES)
            .filter(([id]) => !LEGACY_AIC_IDS.includes(id))
            .map(([id, cat]) => ({ id, name: cat.name }));

        // Art Institute of Chicago — generated from the museum provider
        // registry; ids namespaced 'aic-*' so they never collide with
        // Wikimedia category names
        const aicCategories = Object.entries(MUSEUM_CATEGORIES)
            .map(([id, cat]) => ({ id: `aic-${id}`, name: cat.name }));

        // Metropolitan Museum of Art — verified public domain departments
        const metCategories = [
            { id: 'met-greek-roman',  name: 'Greek & Roman Antiquities' },
            { id: 'met-egyptian',     name: 'Egyptian Antiquities' },
            { id: 'met-medieval',     name: 'Medieval Collection' },
            { id: 'met-japanese',     name: 'Japanese Woodblock Prints' },
            { id: 'met-islamic',      name: 'Islamic Arts' },
            { id: 'met-european',     name: 'European Masters' }
        ];

        // Retrieve saved personal sequences containing explicit visuals
        const personalBlueprints = MemoryCore.getWorkshopBlueprints().filter(bp => bp.customVisuals && bp.customVisuals.length > 0);

        const mode = this.config.visualMode;

        this.container.innerHTML = `
            <div class="vi-panel ${this.expanded ? 'expanded' : ''}" role="region" aria-label="Visual Settings">
                <!-- Header -->
                <button class="vi-header" type="button" aria-expanded="${this.expanded}">
                    <span class="vi-title">Visual Settings</span>
                    <span class="vi-status ${mode !== 'off' ? 'enabled' : ''}">
                        ${mode === 'off' ? 'Off' : mode === 'focals' ? 'Focals' : mode === 'attractor' ? 'Attractor' : 'Rhythmic'}
                    </span>
                    <span class="vi-chevron">${this.expanded ? '▲' : '▼'}</span>
                </button>

                <div class="vi-content" ${this.expanded ? '' : 'hidden'}>
                    <!-- 4-Way Mode Selection -->
                    <div class="vi-mode-selector vi-mode-selector-4">
                        <button type="button" class="vi-mode-btn ${mode === 'off' ? 'active' : ''}" data-visual-mode="off">
                            <span class="vi-mode-icon">○</span>
                            <span class="vi-mode-name">Off</span>
                        </button>
                        <button type="button" class="vi-mode-btn ${mode === 'focals' ? 'active' : ''}" data-visual-mode="focals" title="Persistent gentle focal point">
                            <span class="vi-mode-icon">◯</span>
                            <span class="vi-mode-name">Focals</span>
                        </button>
                        <button type="button" class="vi-mode-btn ${mode === 'attractor' ? 'active' : ''}" data-visual-mode="attractor" title="Persistent strange-attractor field around the text">
                            <span class="vi-mode-icon">∮</span>
                            <span class="vi-mode-name">Attractor</span>
                        </button>
                        <button type="button" class="vi-mode-btn ${mode === 'interlocution' ? 'active' : ''}" data-visual-mode="interlocution" title="Rhythmic visual interrupts">
                            <span class="vi-mode-icon">◈</span>
                            <span class="vi-mode-name">Rhythmic</span>
                        </button>
                    </div>

                    <!-- FOCALS: Persistent focal point (neurosensitive-friendly) -->
                    <div class="vi-focals-panel" ${mode === 'focals' ? '' : 'hidden'}>
                        <div class="vi-focals-description text-fog">
                            A persistent, gentle focal point displayed throughout your session. Designed for stillness and neurosensitive users.
                        </div>

                        <div class="vi-focals-modes">
                            <label class="vi-radio ${this.config.focals.type === 'standard' ? 'selected' : ''}">
                                <input type="radio" name="focals-type" value="standard" ${this.config.focals.type === 'standard' ? 'checked' : ''} data-focals-type="standard">
                                <span class="vi-radio-label">Standard</span>
                                <span class="vi-radio-desc text-mist">Curated glyphs</span>
                            </label>
                            <label class="vi-radio ${this.config.focals.type === 'personal' ? 'selected' : ''}">
                                <input type="radio" name="focals-type" value="personal" ${this.config.focals.type === 'personal' ? 'checked' : ''} data-focals-type="personal">
                                <span class="vi-radio-label">Personal</span>
                                <span class="vi-radio-desc text-mist">Your image</span>
                            </label>
                        </div>

                        <div class="vi-focals-standard" ${this.config.focals.type === 'standard' ? '' : 'hidden'}>
                            <div class="vi-glyph-grid">
                                ${focalGlyphs.map(g => `
                                    <button type="button" class="vi-glyph-btn ${this.config.focals.standardGlyph === g.id ? 'selected' : ''} ${g.dynamic ? 'dynamic' : ''}" data-glyph="${g.id}" title="${g.description}">
                                        <span class="vi-glyph-icon">${g.icon}</span>
                                        <span class="vi-glyph-name">${g.name}</span>
                                        ${g.dynamic ? '<span class="vi-glyph-badge">Dynamic</span>' : ''}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="vi-focals-personal" ${this.config.focals.type === 'personal' ? '' : 'hidden'}>
                            <div class="vi-personal-upload">
                                ${this.config.focals.personalImage ? `
                                    <div class="vi-personal-preview">
                                        <img src="${this.config.focals.personalImage}" alt="Personal focal" />
                                        <button type="button" class="vi-personal-remove" data-action="remove-personal-focal">✕</button>
                                    </div>
                                ` : `
                                    <label class="vi-personal-dropzone" data-action="upload-personal-focal">
                                        <span class="vi-dropzone-icon">⬆</span>
                                        <span class="vi-dropzone-text">Upload focal image</span>
                                        <input type="file" accept="image/*" hidden data-input="personal-focal">
                                    </label>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- ATTRACTOR: Persistent strange-attractor field -->
                    <div class="vi-attractor-panel" ${mode === 'attractor' ? '' : 'hidden'}>
                        <div class="vi-focals-description text-fog">
                            A strange attractor orbits constantly around the centered text stream — a continuous field of light tracing chaotic flow. Gentle motion, no interrupts.
                        </div>

                        <div class="vi-attractor-grid">
                            ${ATTRACTOR_SYSTEMS.map(s => `
                                <button type="button" class="vi-attractor-btn ${this.config.attractor.system === s.id ? 'selected' : ''}" data-attractor-system="${s.id}" title="${s.description}">
                                    <span class="vi-attractor-icon">${s.icon}</span>
                                    <span class="vi-attractor-name">${s.name}</span>
                                    <span class="vi-attractor-desc text-mist">${s.description.split('—')[0].trim()}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- INTERLOCUTION: Probabilistic interrupts -->
                    <div class="vi-accordions" ${mode === 'interlocution' ? '' : 'hidden'}>
                        <!-- 1. Procedural Patterns -->
                        <div class="vi-accordion ${this.activeAccordions.includes('procedural') ? 'active' : ''}">
                            <button type="button" class="vi-accordion-header" data-toggle="procedural">
                                <span>Procedural Patterns</span>
                                <span class="vi-chevron">${this.activeAccordions.includes('procedural') ? '▲' : '▼'}</span>
                            </button>
                            <div class="vi-accordion-body" ${this.activeAccordions.includes('procedural') ? '' : 'hidden'}>
                                <div class="vi-checkbox-grid">
                                    ${proceduralPatterns.map(p => `
                                        <div class="vi-checkbox-wrapper">
                                            <label class="vi-checkbox">
                                                <input type="checkbox" 
                                                    ${this.config.interlocution.procedural.includes(p.id) ? 'checked' : ''} 
                                                    data-procedural="${p.id}">
                                                <span class="vi-checkbox-icon">${p.icon}</span>
                                                <span class="vi-checkbox-label">${p.name}</span>
                                            </label>
                                            ${p.hasPresets && this.config.interlocution.procedural.includes(p.id) ? `
                                                <div class="vi-preset-chips" data-preset-group="${p.id}">
                                                    ${kleePresets.map(preset => `
                                                        <button type="button" 
                                                            class="vi-preset-chip ${this.config.interlocution.kleePreset === preset.id ? 'active' : ''}" 
                                                            data-preset="${preset.id}" 
                                                            data-for="${p.id}">
                                                            ${preset.name}
                                                        </button>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- 2. Universal Diagrams -->
                        <div class="vi-accordion ${this.activeAccordions.includes('universal') ? 'active' : ''}">
                            <button type="button" class="vi-accordion-header" data-toggle="universal">
                                <span>Universal Diagrams</span>
                                <span class="vi-chevron">${this.activeAccordions.includes('universal') ? '▲' : '▼'}</span>
                            </button>
                            <div class="vi-accordion-body" ${this.activeAccordions.includes('universal') ? '' : 'hidden'}>
                                <div class="vi-checkbox-grid vi-checkbox-grid-3">
                                    ${diagramCategories.map(c => `
                                        <label class="vi-checkbox">
                                            <input type="checkbox" 
                                                ${this.config.interlocution.sourced.includes(c.id) ? 'checked' : ''} 
                                                data-sourced="${c.id}">
                                            <span class="vi-checkbox-label">${c.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- 2b. Art Institute of Chicago -->
                        <div class="vi-accordion ${this.activeAccordions.includes('aic') ? 'active' : ''}">
                            <button type="button" class="vi-accordion-header" data-toggle="aic">
                                <span>Art Institute Collection</span>
                                <span class="vi-chevron">${this.activeAccordions.includes('aic') ? '▲' : '▼'}</span>
                            </button>
                            <div class="vi-accordion-body" ${this.activeAccordions.includes('aic') ? '' : 'hidden'}>
                                <div class="vi-checkbox-grid vi-checkbox-grid-2">
                                    ${aicCategories.map(c => `
                                        <label class="vi-checkbox">
                                            <input type="checkbox"
                                                ${this.config.interlocution.sourced.includes(c.id) ? 'checked' : ''}
                                                data-sourced="${c.id}">
                                            <span class="vi-checkbox-label">${c.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- 2c. Met Museum Collection -->
                        <div class="vi-accordion ${this.activeAccordions.includes('met') ? 'active' : ''}">
                            <button type="button" class="vi-accordion-header" data-toggle="met">
                                <span>Met Museum Collection</span>
                                <span class="vi-chevron">${this.activeAccordions.includes('met') ? '▲' : '▼'}</span>
                            </button>
                            <div class="vi-accordion-body" ${this.activeAccordions.includes('met') ? '' : 'hidden'}>
                                <div class="vi-checkbox-grid vi-checkbox-grid-2">
                                    ${metCategories.map(c => `
                                        <label class="vi-checkbox">
                                            <input type="checkbox" 
                                                ${this.config.interlocution.sourced.includes(c.id) ? 'checked' : ''} 
                                                data-sourced="${c.id}">
                                            <span class="vi-checkbox-label">${c.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- 3. Personal Architecture -->
                        <div class="vi-accordion ${this.activeAccordions.includes('personal') ? 'active' : ''}">
                            <button type="button" class="vi-accordion-header" data-toggle="personal">
                                <span>Personal Architecture</span>
                                <span class="vi-chevron">${this.activeAccordions.includes('personal') ? '▲' : '▼'}</span>
                            </button>
                            <div class="vi-accordion-body" ${this.activeAccordions.includes('personal') ? '' : 'hidden'}>
                                <div class="vi-checkbox-grid vi-checkbox-grid-2">
                                    <label class="vi-checkbox">
                                        <input type="checkbox" 
                                            ${this.config.interlocution.sourced.includes('global-pool') ? 'checked' : ''} 
                                            data-sourced="global-pool">
                                        <span class="vi-checkbox-label text-threshold">Global Custom Pool</span>
                                    </label>

                                    <!-- Active Workshop Sequence Bundle -->
                                    ${this.config.customVisuals.length > 0 ? `
                                        <label class="vi-checkbox">
                                            <input type="checkbox" 
                                                ${this.config.interlocution.sourced.includes('custom') ? 'checked' : ''} 
                                                data-sourced="custom">
                                            <span class="vi-checkbox-label text-light">Active Sequence Assets (${this.config.customVisuals.length})</span>
                                        </label>
                                    ` : ''}
                                    
                                    ${personalBlueprints.map(bp => {
                                        const bpId = `personal:${bp.id}`;
                                        return `
                                        <label class="vi-checkbox">
                                            <input type="checkbox" 
                                                ${this.config.interlocution.sourced.includes(bpId) ? 'checked' : ''} 
                                                data-sourced="${bpId}">
                                            <span class="vi-checkbox-label" title="Compiled in Workshop">${escapeHtml(bp.title) || 'Untitled Sequence'} Images</span>
                                        </label>
                                    `}).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Rhythm: temporal parameters of the flashes (interlocution only) -->
                    <div class="vi-sliders" ${mode === 'interlocution' ? '' : 'hidden'}>
                        <div class="vi-group-label">Rhythm</div>
                        <div class="vi-slider-row">
                            <label class="vi-slider-label">Frequency</label>
                            <input type="range" class="slider" min="0" max="100"
                                value="${Math.round(this.config.interlocution.frequency * 100)}" data-slider="frequency">
                            <span class="vi-slider-value" data-value="frequency">${Math.round(this.config.interlocution.frequency * 100)}%</span>
                        </div>
                        <div class="vi-slider-row">
                            <label class="vi-slider-label">Duration</label>
                            <input type="range" class="slider" min="16" max="200"
                                value="${this.config.interlocution.duration}" data-slider="duration">
                            <span class="vi-slider-value" data-value="duration">${this.config.interlocution.duration}ms</span>
                        </div>
                    </div>

                    <!-- Safety Warning (Interlocution only) -->
                    <div class="vi-warning" ${mode === 'interlocution' ? '' : 'hidden'}>
                        <span class="vi-warning-icon">⚠</span>
                        <p class="vi-warning-text">Visual interrupts may affect photosensitive individuals.</p>
                    </div>

                    <!-- LIVING RESPONSE: the semantic conductor's subscribers.
                         A persistent section, independent of the mode above —
                         these controls decide whether the text drives the visuals. -->
                    <div class="vi-semantic">
                        <div class="vi-semantic-header">
                            <span class="vi-semantic-title">Living Response</span>
                            <span class="vi-semantic-sub text-mist">The text conducts the visuals</span>
                        </div>

                        <div class="vi-semantic-row">
                            <label class="toggle vi-semantic-toggle">
                                <input type="checkbox" data-livingtext ${this.config.livingText.enabled ? 'checked' : ''}>
                                <span class="toggle-switch"></span>
                                <span class="vi-semantic-label">Living Text</span>
                            </label>
                            <p class="vi-semantic-hint text-mist">
                                Hue and glow of the text stream drift with the emotional
                                valence of the passage. Works in any visual mode.
                            </p>
                        </div>

                        <div class="vi-semantic-row ${mode === 'interlocution' ? '' : 'vi-semantic-row--disabled'}">
                            <label class="toggle vi-semantic-toggle">
                                <input type="checkbox" data-responsive
                                    ${this.config.interlocution.responsive ? 'checked' : ''}
                                    ${mode === 'interlocution' ? '' : 'disabled'}>
                                <span class="toggle-switch"></span>
                                <span class="vi-semantic-label">Responsive Flashes</span>
                            </label>
                            <p class="vi-semantic-hint text-mist">
                                ${mode === 'interlocution'
                                    ? `Passage intensity scales flash frequency and sharpness; its mood
                                       selects the pattern and its palette. Frequency never exceeds the
                                       Rhythm setting above.`
                                    : 'Available in Rhythmic mode — flashes follow the mood and intensity of the text.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEvents() {
        // Header toggle
        this.container.querySelector('.vi-header')?.addEventListener('click', () => {
            this.expanded = !this.expanded;
            this.render();
            this.attachEvents();
        });

        if (this.locked) return;

        // 3-way mode selector (Off / Focals / Interlocution)
        this.container.querySelectorAll('[data-visual-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const newMode = btn.dataset.visualMode;
                if (newMode === 'interlocution' && !this.hasConsent) {
                    this.showSafetyModal();
                    return;
                }

                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playClick();
                }

                this.config.visualMode = newMode;

                // Clear procedural if switching from focals to interlocution for the first time
                // to prevent unexpected flashes, but keep if user has explicitly selected them
                if (newMode === 'interlocution' && !this.hasConsent) {
                    this.showSafetyModal();
                    return;
                }

                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        // Accordion toggles
        this.container.querySelectorAll('[data-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.toggle;
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                if (this.activeAccordions.includes(section)) {
                    this.activeAccordions = this.activeAccordions.filter(s => s !== section);
                } else {
                    this.activeAccordions.push(section);
                }
                this.render();
                this.attachEvents();
            });
        });

        // ─── Interlocution Handlers ───
        this.container.querySelectorAll('[data-procedural]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.procedural;
                const proc = this.config.interlocution.procedural;
                if (cb.checked) {
                    if (!proc.includes(id)) proc.push(id);
                } else {
                    this.config.interlocution.procedural = proc.filter(p => p !== id);
                }
                
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                
                // If this results in zero selected visuals, maybe warn or switch? 
                // For now, allow valid empty state (pure stillness interlocution)
                
                this.render();
                this.attachEvents();
                this.emitChange();
            });
        });

        this.container.querySelectorAll('.vi-preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const presetId = chip.dataset.preset;
                const target = chip.dataset.for;

                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }

                if (target === 'klee') {
                    this.config.interlocution.kleePreset = presetId;
                }

                this.render();
                this.attachEvents();
                this.emitChange();
            });
        });

        this.container.querySelectorAll('[data-sourced]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.sourced;
                const src = this.config.interlocution.sourced;
                if (cb.checked) {
                    if (!src.includes(id)) src.push(id);
                } else {
                    this.config.interlocution.sourced = src.filter(s => s !== id);
                }
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.emitChange();
            });
        });

        this.container.querySelector('[data-slider="frequency"]')?.addEventListener('input', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.frequency = parseInt(e.target.value) / 100;
            this.container.querySelector('[data-value="frequency"]').textContent = `${e.target.value}%`;
            this.emitChange();
        });

        this.container.querySelector('[data-slider="duration"]')?.addEventListener('input', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.duration = parseInt(e.target.value);
            this.container.querySelector('[data-value="duration"]').textContent = `${e.target.value}ms`;
            this.emitChange();
        });

        // ─── Responsive Interlocutions Handler ───
        this.container.querySelector('[data-responsive]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.responsive = e.target.checked;
            this.emitChange();
        });

        // ─── Living Text Handler ───
        this.container.querySelector('[data-livingtext]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.livingText.enabled = e.target.checked;
            this.emitChange();
        });

        // ─── Attractor Handlers ───
        this.container.querySelectorAll('[data-attractor-system]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.config.attractor.system = btn.dataset.attractorSystem;
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        // ─── Focals Handlers ───
        this.container.querySelectorAll('[data-focals-type]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.config.focals.type = radio.value;
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        this.container.querySelectorAll('[data-glyph]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.config.focals.standardGlyph = btn.dataset.glyph;
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        const personalInput = this.container.querySelector('[data-input="personal-focal"]');
        const personalDropzone = this.container.querySelector('[data-action="upload-personal-focal"]');
        if (personalDropzone && personalInput) {
            personalDropzone.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                personalInput.click();
            });
            personalInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    this.config.focals.personalImage = evt.target.result;
                    this.emitChange();
                    this.render();
                    this.attachEvents();
                };
                reader.readAsDataURL(file);
            });
        }

        this.container.querySelector('[data-action="remove-personal-focal"]')?.addEventListener('click', () => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.focals.personalImage = null;
            this.emitChange();
            this.render();
            this.attachEvents();
        });
    }

    emitChange() {
        this.onChange(this.getConfig(), this.getActiveTypes());
    }

    destroy() {
        this.container.innerHTML = '';
    }
}
