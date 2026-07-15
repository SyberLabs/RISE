/**
 * R.I.S.E. Pacing Engine
 * Computes atom durations based on type, complexity, weight, and state curves
 */

/**
 * Modality types for atoms
 */
export const Modality = {
    TEXT: 'text',
    IMAGE: 'image',
    SYMBOL: 'symbol',
    AUDIO: 'audio',
    COMPOSITE: 'composite'
};

/**
 * Session intent types - shapes pacing and sequencing
 */
export const IntentType = {
    INDUCTION: 'induction',       // Prepare mental state
    INSTALLATION: 'installation', // Inscribe patterns
    INGESTION: 'ingestion',       // Absorb material
    SYNTHESIS: 'synthesis',       // Generate connections
    RECURSION: 'recursion'        // Process own productions
};

/**
 * State curve presets for pacing variation
 */
export class StateCurve {
    constructor(curveFunction) {
        this.curveFunction = curveFunction;
    }

    /**
     * Get multiplier at position
     * @param {number} position - 0.0 to 1.0 progress through session
     * @returns {number} Duration multiplier
     */
    at(position) {
        return this.curveFunction(Math.max(0, Math.min(1, position)));
    }

    /**
     * Induction curve: fast → slow (descending)
     * Induces settling, receptivity
     */
    static induction() {
        // Start at 0.8x (slightly fast), end at 2.0x (very slow)
        return new StateCurve(p => 0.8 + p * 1.2);
    }

    /**
     * Ascent curve: slow → fast (ascending)
     * Builds energy, momentum
     */
    static ascent() {
        // Start at 1.8x (very slow), end at 0.5x (very fast)
        return new StateCurve(p => 1.8 - p * 1.3);
    }

    /**
     * Wave curve: oscillating rhythm
     * Maintains engagement through variation
     * @param {number} frequency - Number of cycles (default 3)
     */
    static wave(frequency = 3.0) {
        // Base 1.0, swing from 0.4 to 1.6
        return new StateCurve(p => 1.0 + 0.6 * Math.sin(p * frequency * 2 * Math.PI));
    }

    /**
     * Climax curve: narrative arc
     * Build to peak, then resolve
     * @param {number} peakPosition - Where the peak occurs (default 0.75)
     */
    static climax(peakPosition = 0.75) {
        return new StateCurve(p => {
            if (p < peakPosition) {
                // Accelerate towards peak: from 1.5x down to 0.4x speed
                return 1.5 - 1.1 * (p / peakPosition);
            } else {
                // Decelerate after peak: from 0.4x back up to 1.5x speed
                return 0.4 + 1.1 * ((p - peakPosition) / (1 - peakPosition));
            }
        });
    }

    /**
     * Flat curve: constant pacing
     */
    static flat() {
        return new StateCurve(() => 1.0);
    }

    /**
     * Get curve by intent type
     * @param {string} intentType 
     */
    static forIntent(intentType) {
        switch (intentType) {
            case IntentType.INDUCTION:
                return StateCurve.induction();
            case IntentType.INSTALLATION:
                return StateCurve.wave(2);
            case IntentType.INGESTION:
                return StateCurve.flat();
            case IntentType.SYNTHESIS:
                return StateCurve.climax(0.6);
            case IntentType.RECURSION:
                return StateCurve.wave(4);
            default:
                return StateCurve.flat();
        }
    }
}

/**
 * Pacing Engine
 * Computes atom durations based on multiple factors
 */
export class PacingEngine {
    constructor(config = {}) {
        this.baseWpm = this.normalizeWpm(config.baseWpm);
        this.stateCurve = config.stateCurve || StateCurve.flat();

        // Modifier toggles
        this.modifiers = {
            complexity: config.useComplexity !== false,
            weight: config.useWeight !== false,
            position: config.usePosition !== false
        };

        // Duration limits
        this.minDuration = config.minDuration || 100;   // ms
        this.maxDuration = config.maxDuration || 10000; // ms

        // Image defaults
        this.imageDurations = {
            flash: 100,      // Subliminal
            glimpse: 500,    // Recognition
            view: 2000,      // Contemplation
            hold: 5000       // Absorption
        };

        // Symbol defaults
        this.symbolDuration = config.symbolDuration || 400;
    }

    /**
     * Compute duration for an atom
     * @param {Object} atom - The atom to pace
     * @param {number} position - Session progress 0.0 → 1.0
     * @returns {number} Duration in milliseconds
     */
    computeDuration(atom, position = 0.5) {
        const authoredDuration = Number(atom?.duration);
        if (atom?.timingLocked && Number.isFinite(authoredDuration)) {
            // Structural pauses and authored markers are contracts, not hints.
            // Keep very short intentional markers (for example [FLASH]=50ms)
            // while still rejecting zero/negative and runaway values.
            return Math.round(Math.max(16, Math.min(this.maxDuration, authoredDuration)));
        }

        let baseDuration;

        // Base duration from modality
        switch (atom.modality) {
            case Modality.TEXT:
                if (Number.isFinite(authoredDuration) && authoredDuration > 0) {
                    // chunkText already accounts for WPM, word length,
                    // punctuation, phrase size, and paragraph breathing.
                    baseDuration = authoredDuration;
                } else {
                    const wordCount = (atom.content || '').split(/\s+/).filter(w => w).length || 1;
                    baseDuration = (wordCount / this.baseWpm) * 60 * 1000;
                }
                break;

            case Modality.IMAGE:
                baseDuration = atom.duration || this.imageDurations.view;
                break;

            case Modality.SYMBOL:
                baseDuration = atom.duration || this.symbolDuration;
                break;

            case Modality.AUDIO:
                baseDuration = atom.duration || 1000;
                break;

            default:
                baseDuration = atom.duration || 500;
        }

        let duration = baseDuration;

        // Apply complexity modifier
        if (this.modifiers.complexity && atom.complexity !== undefined) {
            duration *= (1.0 + atom.complexity * 0.5);
        }

        // Apply weight modifier
        if (this.modifiers.weight && atom.weight !== undefined) {
            duration *= (1.0 + atom.weight * 0.3);
        }

        // Apply state curve based on position
        if (this.modifiers.position) {
            const curveMultiplier = this.stateCurve.at(position);
            duration *= curveMultiplier;
        }

        // Clamp to limits
        return Math.round(Math.max(this.minDuration, Math.min(this.maxDuration, duration)));
    }

    /**
     * Set the state curve
     * @param {StateCurve} curve 
     */
    setStateCurve(curve) {
        this.stateCurve = curve;
    }

    /**
     * Set base WPM
     * @param {number} wpm 
     */
    setWpm(wpm) {
        this.baseWpm = this.normalizeWpm(wpm);
    }

    normalizeWpm(wpm) {
        const value = Number(wpm);
        return Number.isFinite(value) ? Math.max(50, Math.min(1000, value)) : 220;
    }

    /**
     * Apply pacing to a list of atoms
     * @param {Array} atoms 
     * @returns {Array} Atoms with computed durations
     */
    paceAtoms(atoms) {
        const total = atoms.length;
        return atoms.map((atom, index) => {
            const position = total > 1 ? index / (total - 1) : 0.5;
            return {
                ...atom,
                duration: this.computeDuration(atom, position)
            };
        });
    }
}

/**
 * Interleaving patterns for multi-modal sessions
 */
export const InterleavePattern = {
    PUNCTUATION: 'punctuation',   // Text with periodic visual breaks
    ALTERNATION: 'alternation',   // Regular rhythm of text and image
    SANDWICH: 'sandwich',         // Visual bookends around text
    LAYERED: 'layered',           // Text with background audio
    FUGUE: 'fugue'                // Complex counterpoint of sources
};

/**
 * Interleaver
 * Weaves atoms of different types into unified streams
 */
export class Interleaver {
    /**
     * Interleave atoms according to pattern
     * @param {Object} atomGroups - { text: [], image: [], symbol: [] }
     * @param {string} pattern - InterleavePattern
     * @param {Object} config - Pattern-specific config
     * @returns {Array} Interleaved atom sequence
     */
    interleave(atomGroups, pattern, config = {}) {
        switch (pattern) {
            case InterleavePattern.PUNCTUATION:
                return this.punctuation(
                    atomGroups.text || [],
                    atomGroups.image || [],
                    atomGroups.symbol || [],
                    config.interval || 8
                );

            case InterleavePattern.ALTERNATION:
                return this.alternation(
                    atomGroups.text || [],
                    atomGroups.image || [],
                    config.textPerImage || 4
                );

            case InterleavePattern.SANDWICH:
                return this.sandwich(
                    atomGroups.text || [],
                    atomGroups.image || []
                );

            case InterleavePattern.LAYERED:
                return this.layered(
                    atomGroups.text || [],
                    atomGroups.audio || []
                );

            case InterleavePattern.FUGUE:
                return this.fugue(atomGroups);

            default:
                // Linear: just concatenate all
                return Object.values(atomGroups).flat();
        }
    }

    /**
     * Punctuation pattern: T T T T T [I] T T T T T [S] ...
     * Images/symbols punctuate at intervals
     */
    punctuation(textAtoms, imageAtoms, symbolAtoms, interval) {
        const result = [];
        const punctuators = [...imageAtoms, ...symbolAtoms];
        let punctIndex = 0;

        textAtoms.forEach((atom, i) => {
            result.push(atom);

            // Insert punctuator at intervals
            if ((i + 1) % interval === 0 && punctIndex < punctuators.length) {
                result.push(punctuators[punctIndex]);
                punctIndex++;
            }
        });

        return result;
    }

    /**
     * Alternation pattern: T T T [I] T T T [I] ...
     * Regular rhythm of text and image
     */
    alternation(textAtoms, imageAtoms, textPerImage) {
        const result = [];
        let imageIndex = 0;

        textAtoms.forEach((atom, i) => {
            result.push(atom);

            // Insert image after every N text atoms
            if ((i + 1) % textPerImage === 0 && imageIndex < imageAtoms.length) {
                result.push(imageAtoms[imageIndex]);
                imageIndex++;
            }
        });

        return result;
    }

    /**
     * Sandwich pattern: [I] T T T T T T T [I]
     * Visual bookends around text
     */
    sandwich(textAtoms, imageAtoms) {
        const result = [];

        // Opening image
        if (imageAtoms.length > 0) {
            result.push(imageAtoms[0]);
        }

        // All text
        result.push(...textAtoms);

        // Closing image
        if (imageAtoms.length > 1) {
            result.push(imageAtoms[imageAtoms.length - 1]);
        } else if (imageAtoms.length === 1) {
            result.push(imageAtoms[0]); // Repeat if only one
        }

        return result;
    }

    /**
     * Layered pattern: Text with background audio markers
     * Returns atoms with audio sync info
     */
    layered(textAtoms, audioAtoms) {
        const result = [];
        const audioDuration = audioAtoms.reduce((sum, a) => sum + (a.duration || 0), 0);
        const textDuration = textAtoms.reduce((sum, a) => sum + (a.duration || 0), 0);

        // Add audio start marker
        if (audioAtoms.length > 0) {
            result.push({
                ...audioAtoms[0],
                syncType: 'start',
                modality: Modality.AUDIO
            });
        }

        // Add all text
        result.push(...textAtoms);

        return result;
    }

    /**
     * Fugue pattern: Complex counterpoint from multiple sources
     * Weaves sources in round-robin with variation
     */
    fugue(atomGroups) {
        const sources = Object.entries(atomGroups)
            .filter(([_, atoms]) => atoms.length > 0)
            .map(([type, atoms]) => ({ type, atoms: [...atoms], index: 0 }));

        if (sources.length === 0) return [];

        const result = [];
        let activeSourceCount = sources.length;

        // Round-robin through sources
        while (activeSourceCount > 0) {
            for (const source of sources) {
                if (source.index < source.atoms.length) {
                    result.push(source.atoms[source.index]);
                    source.index++;

                    if (source.index >= source.atoms.length) {
                        activeSourceCount--;
                    }
                }
            }
        }

        return result;
    }
}

// Export singleton instances
export const pacingEngine = new PacingEngine();
export const interleaver = new Interleaver();
