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
import { escapeHtml, safeUrl } from '../core/sanitize.js';
import {
    hasVisualSelectionFields,
    isPersonalVisualSource,
    normalizeGlobalPoolSelection,
    normalizeVisualSelection
} from '../core/visual-selection.js';
import {
    hasVisualInterlocutionConsent,
    requestVisualInterlocutionConsent
} from '../core/visual-safety.js';
import {
    VISUAL_PRESENCE_DEFAULT_MS,
    VISUAL_PRESENCE_STEPS_MS,
    formatVisualPresence,
    nearestVisualPresenceStep,
    normalizeVisualPresence,
    visualPresenceStepIndex,
    visualPresenceValueText
} from '../core/visual-presence.js';

// The five curated Klee presets (shared by Rhythmic chips and Genesis chips)
const KLEE_PRESET_CHIP_IDS = ['architectural', 'chaotic', 'harmonic', 'gravitational', 'twittering'];

// The personal focal image persists inside the settings payload in
// localStorage (~5MB quota shared with everything else), so uploads
// are downscaled to fit comfortably: longest edge 1024px, JPEG 0.85.
// Small files pass through untouched; any failure falls back to the
// original so the feature never breaks on an exotic format.
const FOCAL_MAX_DIM = 1024;
const FOCAL_PASSTHROUGH_BYTES = 150 * 1024;

function migrateRetiredMetSelection(proceduralValue, sourcedValue) {
    const procedural = Array.isArray(proceduralValue)
        ? [...new Set(proceduralValue)]
        : [];
    const sourcedInput = Array.isArray(sourcedValue) ? sourcedValue : [];
    const sourced = [...new Set(sourcedInput.filter(id =>
        typeof id === 'string' && !id.startsWith('met-')))];
    const hadRetiredMet = sourcedInput.some(id =>
        typeof id === 'string' && id.startsWith('met-'));

    if (hadRetiredMet && sourced.length === 0 && procedural.length === 0) {
        procedural.push('klee');
    }
    return { procedural, sourced };
}

function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function compressFocalImage(file) {
    const raw = await readAsDataURL(file);
    if (file.size <= FOCAL_PASSTHROUGH_BYTES) return raw;
    try {
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Image decode failed'));
            image.src = raw;
        });
        const scale = Math.min(1, FOCAL_MAX_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpeg = canvas.toDataURL('image/jpeg', 0.85);
        // A blank canvas exports 'data:,'; only keep a real, smaller win
        return jpeg && jpeg.length > 64 && jpeg.length < raw.length ? jpeg : raw;
    } catch (e) {
        console.warn('[VIPanel] Focal image compression failed, using original:', e);
        return raw;
    }
}

export class VisualInterlocutionPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.onChange = options.onChange || (() => { });
        this.onRequestSafetyModal = options.onRequestSafetyModal || null;

        const incomingProcedural = options.interlocution?.procedural ?? options.procedural ?? [];
        const incomingSourced = options.interlocution?.sourced ?? options.sourced ?? [];
        const { procedural, sourced } = migrateRetiredMetSelection(
            incomingProcedural,
            incomingSourced
        );
        const selection = normalizeVisualSelection({
            sourceFamily: options.interlocution?.sourceFamily ?? options.sourceFamily,
            procedural,
            sourced
        });

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

            // Genesis config ("Motion Klee": a composition grows
            // continuously around the token stream)
            genesis: options.genesis || {
                preset: 'random', // 'random' | klee preset name
                glass: true       // glass tile behind the text
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
                ...selection,
                globalPool: normalizeGlobalPoolSelection(
                    options.interlocution?.globalPool ?? options.globalPool
                ),
                frequency: options.interlocution?.frequency ?? options.frequency ?? 0.2,
                duration: normalizeVisualPresence(
                    options.interlocution?.duration
                    ?? options.duration
                    ?? VISUAL_PRESENCE_DEFAULT_MS
                ),
                renderLanguage: (options.interlocution?.renderLanguage ?? options.renderLanguage) === 'ascii'
                    ? 'ascii'
                    : 'native',
                kleePreset: options.interlocution?.kleePreset ?? options.kleePreset ?? 'random',
                harmonographClimate: options.interlocution?.harmonographClimate ?? 'auto',
                // Responsive: the semantic conductor drives the flashes.
                // Two independently gated intents beneath the master switch:
                // mood (imagery character) and rhythm (density/sharpness).
                responsive: options.interlocution?.responsive ?? false,
                responsiveMood: options.interlocution?.responsiveMood ?? true,
                responsiveRhythm: options.interlocution?.responsiveRhythm ?? true
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
        this.hasConsent = hasVisualInterlocutionConsent();
        this._destroyed = false;

        this.render();
        this.attachEvents();
    }

    async showSafetyModal() {
        const accepted = await requestVisualInterlocutionConsent();
        if (this._destroyed) return;
        this.hasConsent = accepted || hasVisualInterlocutionConsent();
        this.config.visualMode = accepted ? 'interlocution' : 'off';
        if (accepted) this.emitChange();
        this.render();
        this.attachEvents();
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            ...this.config,
            interlocution: {
                ...this.config.interlocution,
                procedural: [...this.config.interlocution.procedural],
                sourced: [...this.config.interlocution.sourced],
                globalPool: {
                    ...this.config.interlocution.globalPool,
                    assetIds: [...this.config.interlocution.globalPool.assetIds]
                }
            },
            customVisuals: [...this.config.customVisuals]
        };
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
     * Safety consent remains a separate launch-time requirement.
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

        // Apply Genesis config
        if (visualConfig.genesis) {
            this.config.genesis = {
                ...this.config.genesis,
                ...visualConfig.genesis
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
            const incomingInterlocution = visualConfig.interlocution;
            const mergedInterlocution = {
                ...this.config.interlocution,
                ...incomingInterlocution
            };
            // A preset/import that supplies any source-selection field owns
            // the complete selection. Missing sibling arrays mean empty,
            // never "preserve whatever paintings were selected before".
            const selectionInput = hasVisualSelectionFields(incomingInterlocution)
                ? {
                    sourceFamily: incomingInterlocution.sourceFamily,
                    procedural: Object.hasOwn(incomingInterlocution, 'procedural')
                        ? incomingInterlocution.procedural
                        : [],
                    sourced: Object.hasOwn(incomingInterlocution, 'sourced')
                        ? incomingInterlocution.sourced
                        : []
                }
                : this.config.interlocution;
            const migrated = migrateRetiredMetSelection(
                selectionInput.procedural,
                selectionInput.sourced
            );
            this.config.interlocution = {
                ...mergedInterlocution,
                duration: normalizeVisualPresence(mergedInterlocution.duration),
                renderLanguage: mergedInterlocution.renderLanguage === 'ascii' ? 'ascii' : 'native',
                globalPool: normalizeGlobalPoolSelection(mergedInterlocution.globalPool),
                ...normalizeVisualSelection({
                    ...selectionInput,
                    ...migrated
                })
            };
        }

        this.render();
        this.attachEvents();
        this.emitChange();
    }

    /**
     * Refresh shared-pool thumbnails after Workshop import/delete actions.
     * Deleted IDs are removed from the active draft, while saved blueprints
     * remain independently diagnosable until the user opens them for editing.
     */
    refreshGlobalAssets() {
        const availableIds = new Set(MemoryCore.getGlobalImageAssets().map(asset => asset.id));
        const current = this.config.interlocution.globalPool;
        const assetIds = current.assetIds.filter(id => availableIds.has(id));
        const changed = assetIds.length !== current.assetIds.length;
        this.config.interlocution.globalPool = { ...current, assetIds };
        this.render();
        this.attachEvents();
        if (changed) this.emitChange();
    }

    /**
     * Update the list of custom visuals from the Workshop
     */
    updateCustomVisuals(visuals) {
        this.config.customVisuals = Array.isArray(visuals) ? [...visuals] : [];
        // Auto-enable 'custom' in sourced if this was the first image added
        if (this.config.customVisuals.length > 0 && !this.config.interlocution.sourced.includes('custom')) {
            const family = this.config.interlocution.sourceFamily === 'blend' ? 'blend' : 'personal';
            this.config.interlocution = {
                ...this.config.interlocution,
                ...normalizeVisualSelection({
                    ...this.config.interlocution,
                    sourceFamily: family,
                    sourced: [...this.config.interlocution.sourced, 'custom']
                })
            };
        } else if (this.config.customVisuals.length === 0 && this.config.interlocution.sourced.includes('custom')) {
            this.config.interlocution = {
                ...this.config.interlocution,
                ...normalizeVisualSelection({
                    ...this.config.interlocution,
                    sourced: this.config.interlocution.sourced.filter(id => id !== 'custom')
                })
            };
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

        const selection = normalizeVisualSelection(this.config.interlocution);
        const types = [...selection.procedural];
        const sourced = selection.sourced;
        
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
            { id: 'rockgarden', name: 'Rock Garden', icon: '◯' },
            { id: 'harmonograph', name: 'Harmonograph', icon: '∿' }
        ];

        const kleePresets = [
            { id: 'random', name: 'Random' },
            { id: 'architectural', name: 'Architectural' },
            { id: 'chaotic', name: 'Chaotic' },
            { id: 'harmonic', name: 'Harmonic' },
            { id: 'gravitational', name: 'Gravitational' },
            { id: 'twittering', name: 'Twittering' }
        ];

        // Harmonograph climates — same grammar as the Klee chips: Auto
        // lets the conductor (or, unresponsive, chance) choose; an
        // explicit climate pins palette + chord family, while mood keeps
        // its say over the pendulum's energy
        const harmonographClimates = [
            { id: 'auto', name: 'Auto' },
            { id: 'emberDawn', name: 'Ember' },
            { id: 'solarFlare', name: 'Solar' },
            { id: 'midnightWater', name: 'Midnight' },
            { id: 'stormViolet', name: 'Storm' },
            { id: 'jadeVeil', name: 'Jade' },
            { id: 'whiteHeat', name: 'White' }
        ];

        // Standard focal glyphs for neurosensitive-friendly viewing
        const focalGlyphs = [
            { id: 'breath', name: 'Breath', icon: '◯', dynamic: true, description: 'Gentle pulsing circle' },
            { id: 'anchor', name: 'Anchor', icon: '⚓', dynamic: false, description: 'Stable grounding point' },
            { id: 'lotus', name: 'Lotus', icon: '❀', dynamic: false, description: 'Centered bloom' },
            { id: 'eye', name: 'Eye', icon: '◉', dynamic: true, description: 'Soft focus ring' },
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

        // (The Met section was retired: its public API serves ~750px
        // primaryImageSmall derivatives from pools too shallow to
        // sustain themed categories — quality and coherence both fell
        // below the AIC/Wikimedia floor. Saved met-* ids degrade
        // gracefully in the cortex.)

        // Retrieve saved personal sequences containing explicit visuals
        const personalBlueprints = MemoryCore.getWorkshopBlueprints().filter(bp => bp.customVisuals && bp.customVisuals.length > 0);
        const globalAssets = MemoryCore.getGlobalImageAssets();
        const globalPool = normalizeGlobalPoolSelection(this.config.interlocution.globalPool);
        const availableGlobalIds = new Set(globalAssets.map(asset => asset.id));
        const selectedGlobalCount = globalPool.assetIds.filter(id => availableGlobalIds.has(id)).length;
        const unavailableGlobalCount = globalPool.assetIds.length - selectedGlobalCount;

        const mode = this.config.visualMode;
        const sourceFamily = this.config.interlocution.sourceFamily;
        // A valid persisted non-step value remains authoritative until the
        // user moves the curated control; presentation snaps to the nearest
        // visible step without silently rewriting storage.
        const displayedPresence = nearestVisualPresenceStep(
            this.config.interlocution.duration
        );

        this.container.innerHTML = `
            <div class="vi-panel ${this.expanded ? 'expanded' : ''}" role="region" aria-label="Visual Settings">
                <!-- Header -->
                <button class="vi-header" type="button" aria-expanded="${this.expanded}">
                    <span class="vi-title">Visual Settings</span>
                    <span class="vi-status ${mode !== 'off' ? 'enabled' : ''}">
                        ${mode === 'off' ? 'Off'
                            : mode === 'focals' ? 'Focals'
                            : mode === 'attractor' ? 'Attractor'
                            : mode === 'genesis' ? 'Genesis'
                            : 'Rhythmic'}
                    </span>
                    <span class="vi-chevron">${this.expanded ? '▲' : '▼'}</span>
                </button>

                <div class="vi-content" ${this.expanded ? '' : 'hidden'}>
                    <!-- 5-Way Mode Selection -->
                    <div class="vi-mode-selector vi-mode-selector-5">
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
                        <button type="button" class="vi-mode-btn ${mode === 'genesis' ? 'active' : ''}" data-visual-mode="genesis" title="A Klee composition grows continuously around the text">
                            <span class="vi-mode-icon">✎</span>
                            <span class="vi-mode-name">Genesis</span>
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

                    <!-- GENESIS: continuously growing Klee composition -->
                    <div class="vi-genesis-panel" ${mode === 'genesis' ? '' : 'hidden'}>
                        <div class="vi-focals-description text-fog">
                            A Klee composition draws itself continuously around the text stream —
                            growing, resting, dissolving into the next. The words sit on glass.
                            No flashes, no interruption. With Living Text on, each new composition
                            follows the mood of the passage.
                        </div>
                        <div class="vi-preset-chips vi-genesis-presets">
                            ${['random', ...KLEE_PRESET_CHIP_IDS].map(presetId => `
                                <button type="button"
                                    class="vi-preset-chip ${this.config.genesis.preset === presetId ? 'active' : ''}"
                                    data-genesis-preset="${presetId}">
                                    ${presetId.charAt(0).toUpperCase() + presetId.slice(1)}
                                </button>
                            `).join('')}
                        </div>

                        <div class="vi-genesis-glass">
                            <label class="toggle vi-semantic-toggle">
                                <input type="checkbox" data-genesis-glass ${this.config.genesis.glass !== false ? 'checked' : ''}>
                                <span class="toggle-switch"></span>
                                <span class="vi-semantic-label">Glass Tile</span>
                            </label>
                            <p class="vi-semantic-hint text-mist">
                                A soft pane behind the words keeps them legible over the drawing.
                                Turn off for sparse compositions that never cross the text.
                            </p>
                        </div>
                    </div>

                    <!-- INTERLOCUTION: Probabilistic interrupts -->
                    <div class="vi-accordions" ${mode === 'interlocution' ? '' : 'hidden'}>
                        <div class="vi-source-family vi-render-language" role="group" aria-label="Render language">
                            <div class="vi-source-family-label">Render</div>
                            <div class="vi-source-family-options">
                                ${[
                                    ['native', 'Native'],
                                    ['ascii', 'ASCII']
                                ].map(([id, label]) => `
                                    <button type="button"
                                        class="vi-source-family-btn ${this.config.interlocution.renderLanguage === id ? 'active' : ''}"
                                        data-render-language="${id}"
                                        aria-pressed="${this.config.interlocution.renderLanguage === id}">
                                        ${label}
                                    </button>
                                `).join('')}
                            </div>
                            <p class="vi-source-family-hint text-mist">
                                ${this.config.interlocution.renderLanguage === 'ascii'
                                    ? 'Pure printable ASCII preserves the selected source, palette, and responsive timing.'
                                    : 'Original procedural fields, canvases, and collection imagery.'}
                            </p>
                        </div>

                        <div class="vi-source-family" role="group" aria-label="Rhythmic source family">
                            <div class="vi-source-family-label">Source</div>
                            <div class="vi-source-family-options">
                                ${[
                                    ['procedural', 'Procedural'],
                                    ['collections', 'Collections'],
                                    ['personal', 'Personal'],
                                    ['blend', 'Blend']
                                ].map(([id, label]) => `
                                    <button type="button"
                                        class="vi-source-family-btn ${sourceFamily === id ? 'active' : ''}"
                                        data-source-family="${id}"
                                        aria-pressed="${sourceFamily === id}">
                                        ${label}
                                    </button>
                                `).join('')}
                            </div>
                            <p class="vi-source-family-hint text-mist">
                                ${sourceFamily === 'blend'
                                    ? 'Blend intentionally combines generated work, collections, and personal imagery.'
                                    : 'This source is exclusive. Choose Blend only when you want categories to intermingle.'}
                            </p>
                        </div>

                        <!-- 1. Procedural Patterns -->
                        <div class="vi-accordion ${this.activeAccordions.includes('procedural') ? 'active' : ''}"
                            ${sourceFamily === 'procedural' || sourceFamily === 'blend' ? '' : 'hidden'}>
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
                                            ${p.id === 'harmonograph' && this.config.interlocution.procedural.includes(p.id) ? `
                                                <div class="vi-preset-chips" data-preset-group="harmonograph">
                                                    ${harmonographClimates.map(climate => `
                                                        <button type="button"
                                                            class="vi-preset-chip ${this.config.interlocution.harmonographClimate === climate.id ? 'active' : ''}"
                                                            data-preset="${climate.id}"
                                                            data-for="harmonograph">
                                                            ${climate.name}
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
                        <div class="vi-accordion ${this.activeAccordions.includes('universal') ? 'active' : ''}"
                            ${sourceFamily === 'collections' || sourceFamily === 'blend' ? '' : 'hidden'}>
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
                        <div class="vi-accordion ${this.activeAccordions.includes('aic') ? 'active' : ''}"
                            ${sourceFamily === 'collections' || sourceFamily === 'blend' ? '' : 'hidden'}>
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

                        <!-- 3. Personal Architecture -->
                        <div class="vi-accordion ${this.activeAccordions.includes('personal') ? 'active' : ''}"
                            ${sourceFamily === 'personal' || sourceFamily === 'blend' ? '' : 'hidden'}>
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

                                    ${this.config.interlocution.sourced.includes('global-pool') ? `
                                        <div class="vi-global-picker">
                                            <div class="vi-global-picker-header">
                                                <span class="vi-global-picker-title">Global Pool</span>
                                                <span class="vi-global-picker-count text-mist">
                                                    ${globalPool.mode === 'all'
                                                        ? `${globalAssets.length} available`
                                                        : `${selectedGlobalCount} of ${globalAssets.length} selected`}
                                                </span>
                                            </div>
                                            ${globalAssets.length > 0 ? `
                                                <div class="vi-global-mode" role="group" aria-label="Global Pool selection mode">
                                                    <button type="button"
                                                        class="vi-global-mode-btn ${globalPool.mode === 'all' ? 'active' : ''}"
                                                        data-global-pool-mode="all"
                                                        aria-pressed="${globalPool.mode === 'all'}">All Images</button>
                                                    <button type="button"
                                                        class="vi-global-mode-btn ${globalPool.mode === 'selected' ? 'active' : ''}"
                                                        data-global-pool-mode="selected"
                                                        aria-pressed="${globalPool.mode === 'selected'}">Selected Images</button>
                                                </div>
                                                ${globalPool.mode === 'selected' ? `
                                                    <div class="vi-global-thumbnails" role="group" aria-label="Choose images from the Global Pool">
                                                        ${globalAssets.map(asset => {
                                                            const selected = globalPool.assetIds.includes(asset.id);
                                                            return `
                                                                <button type="button"
                                                                    class="vi-global-thumbnail ${selected ? 'selected' : ''}"
                                                                    data-global-asset-id="${escapeHtml(asset.id)}"
                                                                    aria-pressed="${selected}"
                                                                    title="${escapeHtml(asset.name)}">
                                                                    <img src="${safeUrl(asset.uri)}" alt="${escapeHtml(asset.name)}" loading="lazy" />
                                                                    <span class="vi-global-thumbnail-mark" aria-hidden="true">✓</span>
                                                                </button>
                                                            `;
                                                        }).join('')}
                                                    </div>
                                                    ${selectedGlobalCount === 0 ? `
                                                        <p class="vi-global-picker-note text-mist">No images selected. Global Pool flashes will remain still.</p>
                                                    ` : ''}
                                                    ${unavailableGlobalCount > 0 ? `
                                                        <p class="vi-global-picker-note vi-global-picker-note--warning">${unavailableGlobalCount} saved ${unavailableGlobalCount === 1 ? 'image is' : 'images are'} no longer available.</p>
                                                    ` : ''}
                                                ` : `
                                                    <p class="vi-global-picker-note text-mist">New images added to the shared pool will join this sequence automatically.</p>
                                                `}
                                            ` : `
                                                <p class="vi-global-picker-note text-mist">The shared pool is empty. Add images from the Workshop’s Studio Shelf.</p>
                                            `}
                                        </div>
                                    ` : ''}

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
                            <label class="vi-slider-label" for="vi-presence-slider">Presence</label>
                            <input id="vi-presence-slider" type="range" class="slider" min="0"
                                max="${VISUAL_PRESENCE_STEPS_MS.length - 1}" step="1"
                                value="${visualPresenceStepIndex(displayedPresence)}"
                                data-slider="duration"
                                aria-valuetext="${visualPresenceValueText(displayedPresence)}">
                            <span class="vi-slider-value vi-slider-value--presence" data-value="duration">${formatVisualPresence(displayedPresence)}</span>
                        </div>
                        <p class="vi-rhythm-hint text-mist">
                            Frequency sets how often a visual may appear between text units.
                            Longer presences automatically create more space between appearances.
                        </p>
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
                                <span class="vi-semantic-label">Responsive Presence</span>
                            </label>
                            <p class="vi-semantic-hint text-mist">
                                ${mode === 'interlocution'
                                    ? 'The text conducts each presence. Your settings above are the envelope — responsiveness only moves within them.'
                                    : 'Available in Rhythmic mode — visuals follow the mood and intensity of the text.'}
                            </p>

                            ${mode === 'interlocution' && this.config.interlocution.responsive ? `
                                <div class="vi-semantic-subrows">
                                    <div class="vi-semantic-subrow">
                                        <label class="toggle vi-semantic-toggle">
                                            <input type="checkbox" data-responsive-mood
                                                ${this.config.interlocution.responsiveMood ? 'checked' : ''}>
                                            <span class="toggle-switch"></span>
                                            <span class="vi-semantic-sublabel">Mood → Imagery</span>
                                        </label>
                                        <p class="vi-semantic-subhint text-mist">
                                            Which pattern fires, its preset, and its palette follow the
                                            feeling of the passage — only among the patterns you've selected.
                                        </p>
                                    </div>
                                    <div class="vi-semantic-subrow">
                                        <label class="toggle vi-semantic-toggle">
                                            <input type="checkbox" data-responsive-rhythm
                                                ${this.config.interlocution.responsiveRhythm ? 'checked' : ''}>
                                            <span class="toggle-switch"></span>
                                            <span class="vi-semantic-sublabel">Intensity → Rhythm</span>
                                        </label>
                                        <p class="vi-semantic-subhint text-mist">
                                            Visual density and sharpness follow the passage's energy —
                                            never exceeding the frequency set above.
                                        </p>
                                    </div>
                                </div>
                            ` : ''}
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

        this.container.querySelectorAll('[data-render-language]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.config.interlocution.renderLanguage = btn.dataset.renderLanguage === 'ascii'
                    ? 'ascii'
                    : 'native';
                if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

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

        // Rhythmic source family. Every family is exclusive except Blend;
        // normalization clears incompatible arrays immediately so the UI and
        // the persisted config cannot disagree.
        this.container.querySelectorAll('[data-source-family]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.config.interlocution = {
                    ...this.config.interlocution,
                    ...normalizeVisualSelection({
                        ...this.config.interlocution,
                        sourceFamily: btn.dataset.sourceFamily
                    })
                };
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
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
                const current = this.config.interlocution;
                const procedural = cb.checked
                    ? [...current.procedural, id]
                    : current.procedural.filter(p => p !== id);
                const sourceFamily = cb.checked && current.sourceFamily !== 'blend'
                    ? 'procedural'
                    : current.sourceFamily;
                this.config.interlocution = {
                    ...current,
                    ...normalizeVisualSelection({ ...current, sourceFamily, procedural })
                };
                
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
                } else if (target === 'harmonograph') {
                    this.config.interlocution.harmonographClimate = presetId;
                }

                this.render();
                this.attachEvents();
                this.emitChange();
            });
        });

        this.container.querySelectorAll('[data-sourced]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.sourced;
                const current = this.config.interlocution;
                const sourced = cb.checked
                    ? [...current.sourced, id]
                    : current.sourced.filter(s => s !== id);
                const sourceFamily = cb.checked && current.sourceFamily !== 'blend'
                    ? (isPersonalVisualSource(id) ? 'personal' : 'collections')
                    : current.sourceFamily;
                this.config.interlocution = {
                    ...current,
                    ...normalizeVisualSelection({ ...current, sourceFamily, sourced })
                };
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        this.container.querySelectorAll('[data-global-pool-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.config.interlocution.globalPool = normalizeGlobalPoolSelection({
                    ...this.config.interlocution.globalPool,
                    mode: btn.dataset.globalPoolMode
                });
                if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
                this.emitChange();
                this.render();
                this.attachEvents();
            });
        });

        this.container.querySelectorAll('[data-global-asset-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.globalAssetId;
                const current = this.config.interlocution.globalPool;
                const assetIds = current.assetIds.includes(id)
                    ? current.assetIds.filter(assetId => assetId !== id)
                    : [...current.assetIds, id];
                this.config.interlocution.globalPool = normalizeGlobalPoolSelection({
                    mode: 'selected',
                    assetIds
                });
                if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
                this.emitChange();
                this.render();
                this.attachEvents();
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
            const stepIndex = Math.max(
                0,
                Math.min(VISUAL_PRESENCE_STEPS_MS.length - 1, parseInt(e.target.value, 10) || 0)
            );
            const duration = VISUAL_PRESENCE_STEPS_MS[stepIndex];
            this.config.interlocution.duration = duration;
            e.target.setAttribute('aria-valuetext', visualPresenceValueText(duration));
            this.container.querySelector('[data-value="duration"]').textContent = formatVisualPresence(duration);
            this.emitChange();
        });

        // ─── Responsive Interlocutions Handlers ───
        this.container.querySelector('[data-responsive]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.responsive = e.target.checked;
            this.emitChange();
            // Re-render to reveal/hide the mood/rhythm sub-toggles
            this.render();
            this.attachEvents();
        });

        this.container.querySelector('[data-responsive-mood]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.responsiveMood = e.target.checked;
            this.emitChange();
        });

        this.container.querySelector('[data-responsive-rhythm]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.interlocution.responsiveRhythm = e.target.checked;
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

        // ─── Genesis Handlers ───
        this.container.querySelector('[data-genesis-glass]')?.addEventListener('change', (e) => {
            if (window.rise?.audioEngine) {
                window.rise.audioEngine.playHiss();
            }
            this.config.genesis.glass = e.target.checked;
            this.emitChange();
        });

        this.container.querySelectorAll('[data-genesis-preset]').forEach(chip => {
            chip.addEventListener('click', () => {
                if (window.rise?.audioEngine) {
                    window.rise.audioEngine.playHiss();
                }
                this.config.genesis.preset = chip.dataset.genesisPreset;
                this.emitChange();
                this.render();
                this.attachEvents();
            });
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
            personalInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                this.config.focals.personalImage = await compressFocalImage(file);
                this.emitChange();
                this.render();
                this.attachEvents();
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
        this._destroyed = true;
        this.container.innerHTML = '';
    }
}
