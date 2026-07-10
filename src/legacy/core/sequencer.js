/**
 * R.I.S.E. Sequencer
 * Produces ordered atom sequences from sources using various strategies
 */

import { Modality, IntentType } from './pacing.js';

/**
 * Sequencing strategies
 */
export const SequenceStrategy = {
    LINEAR: 'linear',           // Source order
    THEMATIC: 'thematic',       // Group by theme/tag
    CONTRAPUNTAL: 'contrapuntal', // Weave multiple sources
    RECURSIVE: 'recursive',     // Self-referential
    EMERGENT: 'emergent',       // Let connections guide
    RITUAL: 'ritual'           // Dramatic structure
};

/**
 * Session Intent
 * Shapes sequencing, pacing, and display decisions
 */
export class Intent {
    constructor(config = {}) {
        this.type = config.type || IntentType.INGESTION;
        this.target = config.target || null;  // e.g., "focused_attention"
        this.sources = config.sources || [];
        this.params = config.params || {};
    }

    static induction(target) {
        return new Intent({
            type: IntentType.INDUCTION,
            target,
            params: {
                lowDensity: true,
                rhythmic: true,
                useAmbient: true
            }
        });
    }

    static installation(target) {
        return new Intent({
            type: IntentType.INSTALLATION,
            target,
            params: {
                repetition: true,
                affirmationHeavy: true,
                useAnchors: true
            }
        });
    }

    static ingestion(sources) {
        return new Intent({
            type: IntentType.INGESTION,
            sources,
            params: {
                sourceFaithful: true,
                adaptivePacing: true
            }
        });
    }

    static synthesis(sources, theme) {
        return new Intent({
            type: IntentType.SYNTHESIS,
            target: theme,
            sources,
            params: {
                interleave: true,
                juxtapose: true,
                lowCoherence: true
            }
        });
    }

    static recursion(sources) {
        return new Intent({
            type: IntentType.RECURSION,
            sources,
            params: {
                selfReferential: true,
                temporalLayering: true
            }
        });
    }
}

/**
 * Sequencer
 * Produces ordered atom sequences from sources
 */
export class Sequencer {
    constructor() {
        this.ritualPhases = {
            opening: 0.1,
            body: 0.6,
            climax: 0.15,
            integration: 0.1,
            closing: 0.05
        };
    }

    /**
     * Sequence atoms according to strategy and intent
     * @param {Array} atoms - Atoms to sequence
     * @param {string} strategy - SequenceStrategy
     * @param {Intent} intent - Session intent
     * @returns {Array} Ordered atoms
     */
    sequence(atoms, strategy, intent = null) {
        switch (strategy) {
            case SequenceStrategy.LINEAR:
                return this.sequenceLinear(atoms);

            case SequenceStrategy.THEMATIC:
                return this.sequenceThematic(atoms);

            case SequenceStrategy.CONTRAPUNTAL:
                return this.sequenceContrapuntal(atoms);

            case SequenceStrategy.RECURSIVE:
                return this.sequenceRecursive(atoms, intent);

            case SequenceStrategy.EMERGENT:
                return this.sequenceEmergent(atoms, intent);

            case SequenceStrategy.RITUAL:
                return this.sequenceRitual(atoms, intent);

            default:
                return this.sequenceLinear(atoms);
        }
    }

    /**
     * Linear: Preserve source order
     */
    sequenceLinear(atoms) {
        return [...atoms].sort((a, b) => {
            if (a.sourceId !== b.sourceId) {
                // Prioritize primary source if indicated
                return 0;
            }
            return (a.position || 0) - (b.position || 0);
        });
    }

    /**
     * Thematic: Group atoms by tags/themes
     */
    sequenceThematic(atoms) {
        // Group by first tag
        const groups = new Map();
        const untagged = [];

        for (const atom of atoms) {
            if (atom.tags && atom.tags.length > 0) {
                const key = atom.tags[0];
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(atom);
            } else {
                untagged.push(atom);
            }
        }

        // Flatten groups with untagged at end
        const result = [];
        for (const [_, groupAtoms] of groups) {
            result.push(...groupAtoms);
        }
        result.push(...untagged);

        return result;
    }

    /**
     * Contrapuntal: Weave multiple sources in dialogue
     * Round-robin interleaving
     */
    sequenceContrapuntal(atoms) {
        // Group by source
        const bySource = new Map();
        for (const atom of atoms) {
            const key = atom.sourceId || 'unknown';
            if (!bySource.has(key)) {
                bySource.set(key, []);
            }
            bySource.get(key).push(atom);
        }

        // Create iterators
        const sources = Array.from(bySource.entries()).map(([id, atoms]) => ({
            id,
            atoms,
            index: 0
        }));

        if (sources.length <= 1) {
            return this.sequenceLinear(atoms);
        }

        // Round-robin interleave
        const result = [];
        let active = sources.length;

        while (active > 0) {
            for (const source of sources) {
                if (source.index < source.atoms.length) {
                    result.push(source.atoms[source.index]);
                    source.index++;

                    if (source.index >= source.atoms.length) {
                        active--;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Recursive: Self-referential sequencing
     * Echoes key atoms, creates loops
     */
    sequenceRecursive(atoms, intent) {
        const result = [];
        const keyAtoms = atoms.filter(a => a.weight >= 0.7);
        const normalAtoms = atoms.filter(a => a.weight < 0.7);

        // Interleave with echoes of key content
        let keyIndex = 0;
        for (let i = 0; i < normalAtoms.length; i++) {
            result.push(normalAtoms[i]);

            // Every 5th atom, echo a key atom
            if ((i + 1) % 5 === 0 && keyAtoms.length > 0) {
                result.push({
                    ...keyAtoms[keyIndex % keyAtoms.length],
                    isEcho: true
                });
                keyIndex++;
            }
        }

        // End with key atoms sequence
        result.push(...keyAtoms);

        return result;
    }

    /**
     * Emergent: Let semantic similarity guide order
     * Requires embeddings (placeholder for future)
     */
    sequenceEmergent(atoms, intent) {
        // For now, use a shuffle with some structure
        // When Intelligence Layer is added, this will use embeddings

        const shuffled = [...atoms];

        // Keep first and last in place, shuffle middle
        if (shuffled.length > 2) {
            const first = shuffled[0];
            const last = shuffled[shuffled.length - 1];
            const middle = shuffled.slice(1, -1);

            // Fisher-Yates shuffle
            for (let i = middle.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [middle[i], middle[j]] = [middle[j], middle[i]];
            }

            return [first, ...middle, last];
        }

        return shuffled;
    }

    /**
     * Ritual: Apply dramatic structure
     * Opening → Body → Climax → Integration → Closing
     */
    sequenceRitual(atoms, intent) {
        const total = atoms.length;
        if (total < 5) return this.sequenceLinear(atoms);

        // Allocate to phases
        const phases = {
            opening: [],
            body: [],
            climax: [],
            integration: [],
            closing: []
        };

        let currentIndex = 0;
        for (const [phase, ratio] of Object.entries(this.ritualPhases)) {
            const count = Math.max(1, Math.floor(total * ratio));
            phases[phase] = atoms.slice(currentIndex, currentIndex + count);
            currentIndex += count;
        }

        // Add remaining to body
        if (currentIndex < total) {
            phases.body.push(...atoms.slice(currentIndex));
        }

        // Transform each phase
        const result = [];

        // Opening: slow, symbolic
        result.push(...this.transformOpening(phases.opening));

        // Body: core content
        result.push(...this.transformBody(phases.body));

        // Climax: highest intensity
        result.push(...this.transformClimax(phases.climax));

        // Integration: settling
        result.push(...this.transformIntegration(phases.integration));

        // Closing: return
        result.push(...this.transformClosing(phases.closing));

        return result;
    }

    // Phase transformers
    transformOpening(atoms) {
        return atoms.map(a => ({
            ...a,
            phase: 'opening',
            weight: Math.max(a.weight || 0.5, 0.7)
        }));
    }

    transformBody(atoms) {
        return atoms.map(a => ({
            ...a,
            phase: 'body'
        }));
    }

    transformClimax(atoms) {
        return atoms.map(a => ({
            ...a,
            phase: 'climax',
            weight: 1.0,
            intensity: 'high'
        }));
    }

    transformIntegration(atoms) {
        return atoms.map(a => ({
            ...a,
            phase: 'integration',
            weight: Math.min(a.weight || 0.5, 0.6)
        }));
    }

    transformClosing(atoms) {
        return atoms.map(a => ({
            ...a,
            phase: 'closing',
            weight: 0.8
        }));
    }
}

// Export singleton
export const sequencer = new Sequencer();
