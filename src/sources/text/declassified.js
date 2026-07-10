/**
 * R.I.S.E. Source System
 * Declassified Documents Provider (CIA/DIA)
 * 
 * Curated collection of declassified documents focusing on:
 * - Consciousness modification
 * - Parapsychology
 * - Bio-energetics
 * - Holographic Universe theory
 */

import { SourceProvider } from '../provider.js';

// Embedded content for immediate access (no external API needed for these static assets)
export const DECLASSIFIED_LIBRARY = {
    'gateway-process': {
        title: 'Analysis and Assessment of Gateway Process',
        author: 'US Army Intelligence / Lt. Col. Wayne McDonnell',
        date: '1983-06-09',
        summary: 'Investigation into the Monroe Institute\'s Hemi-Sync technique and its ability to alter consciousness, time-space perception, and physical reality.',
        tags: ['consciousness', 'holographic', 'hemi-sync', 'absolute'],
        content: `
SUBJECT: Analysis and Assessment of Gateway Process

1. INTRODUCTION. In order to describe the Monroe Institute technique for achieving altered states of consciousness (the "Gateway" experience) involving brain hemisphere synchronization or "Hemi-Sync", the most effective way to begin is to briefly profile the basic mechanics which run through the Monroe Institute creation. 

2. HYPNOSIS. Basically, the Gateway experience is a training system designed to bring enhanced strength, focus and coherence to the amplitude and frequency of brainwave output between the left and right hemispheres so as to alter consciousness, moving it outside the physical sphere so as to ultimately escape even the restrictions of time and space.

3. HOLOGRAPHIC UNIVERSE. Energy creates, stores and retrieves meaning in the universe by projecting or expanding at certain frequencies in a three-dimensional mode that creates a living pattern called a hologram. The concept of the holographic universe states that the piece is equal to the whole. If we perceive the universe as composed of interacting energy fields, any part of that field contains the information of the whole.

4. THE ABSOLUTE. To the extent that Gateway succeeds in bringing about a refinement in energy matrix of the mind, it succeeds in expanding or altering human consciousness so that it can perceive without recourse to the intercession of the physical senses such that ever more of the universal hologram (not of course accessible by sense perception) can ultimately be perceived and understood.

5. BRAIN PHASE IN PHASE. The Hemi-Sync technique uses a Frequency Following Response (FFR). If a subject hears a sound at a frequency which emulates one of those associated with the operation of the human brain, the brain will try to mimic the same frequency pattern by adjusting its brainwave output.

6. CONCLUSION. There is a sound, rational basis in terms of physical science parameters for considering Gateway to be plausible in terms of its essential objectives. Intuitional insights of not only personal but of a practical and professional nature seem to be within bounds of reasonable expectations.
        `
    },

    'project-stargate': {
        title: 'Project Stargate: Coordinate Remote Viewing',
        author: 'CIA / SRI International',
        date: '1985',
        summary: 'Protocols and operational theories for Coordinate Remote Viewing (CRV), the process of perceiving information from a distant target.',
        tags: ['remote-viewing', 'sri', 'psionics', 'perception'],
        content: `
PROJECT STARGATE: COORDINATE REMOTE VIEWING (CRV)

1. DEFINITION. Remote Viewing (RV) is the acquisition of information concerning a target (person, place, or thing) effectively missing from the viewer's physical environment. Coordinate Remote Viewing (CRV) utilizes a specific coordinate system to target the viewer's attention.

2. PROTOCOLS. The viewer is kept "blind" to the target. A monitor provides only coordinates (e.g., 80W 45N). The viewer then proceeds through specific stages of ideogram generation:
   - Stage 1: Major Gestalt (Land, Water, Structure)
   - Stage 2: Sensory Data (Smell, Touch, Temperature)
   - Stage 3: Dimensional Data (Size, Shape)
   - Stage 4: Qualitative Data (Function, Purpose)

3. THE SIGNAL LINE. The theory posits a "Signal Line" or carrier wave of information that is omnipresent. The trained viewer learns to couple their autonomic nervous system to this line, converting the signal into objectified data before the analytical mind can distort it (Analytical Overlay or AOL).

4. APPLICATIONS. Intelligence collection against denied areas, locating missing personnel, and technical analysis of foreign facilities.
        `
    },

    'soviet-psychotronics': {
        title: 'Soviet Psychotronics: Controlled Offensive Behavior',
        author: 'Defense Intelligence Agency (DIA)',
        date: '1972',
        summary: 'Analysis of Soviet research into "Psychotronics" - the study of bio-energy, telekinesis, and mind-matter interaction for military application.',
        tags: ['psychotronics', 'bio-energy', 'soviet', 'cybernetics'],
        content: `
CONTROLLED OFFENSIVE BEHAVIOR - USSR

1. SUMMARY. The Soviet Union is well aware of the benefits and applications of parapsychology research. The term "Psychotronics" was coined to distance this research from western occult associations, framing it instead as the study of "bio-energetics" and "biocommunication".

2. BIO-ENERGY. Soviet scientists (e.g., Dr. Genady Sergeyev) are investigating the existence of a new form of energy, bioplasm, which exists in all living matter. Kirlian photography is heavily used to image this field.

3. TELEKINESIS. Experiments with Nina Kulagina suggest the ability to move non-magnetic objects via focused bio-energy. Measurement devices detected strong electrostatic fields and pulse synchronicity during these events.

4. THREAT ASSESSMENT. The scope of this research suggests a strategic intent to define the parameters of human energetic influence, with potential applications in cybernetics, communication, and direct biological interaction.
        `
    },

    'holographic-matrices': {
        title: 'Holographic Matrices & Time-Space',
        author: 'CIA Reading Room Excerpts',
        date: '1984',
        summary: 'Compilation of theoretical frameworks found in Stargate files regarding the nature of reality as a frequency hologram.',
        tags: ['hologram', 'quantum', 'time-space', 'reality'],
        content: `
HOLOGRAPHIC MATRICES

1. THE COMPACT. Conciousness is the organizing principle of the universe. Matter is merely energy condensed to a slow vibration. Time is a measurement of energy change. 

2. THE INTERVENTION. To enter the "out-of-body" state is essentially to separate the consciousness matrix from the physical body matrix. Since consciousness is non-local, once separated, it is free to interact with the larger Universal Hologram.

3. FREQUENCY DOMAINS. Perception is Tuned Frequency. We perceive "reality" because our nervous system is tuned to this specific channel. By altering the frequency of the brain (via meditation, Hemi-Sync, or sensory deprivation), we tune into other channels of the hologram—other realities.

4. IMPLICATIONS. If the universe is a hologram, then every point in space-time contains information about every other point. Remote viewing is simply accessing this non-local data storage.
        `
    }
};

export class DeclassifiedProvider extends SourceProvider {
    constructor() {
        super({
            id: 'cia-declassified',
            name: 'Declassified CIA',
            contentType: 'text',
            tier: 3, // Research tier
            description: 'Curated declassified documents on consciousness and phenomena',
            supportsSearch: true,
            supportsPreload: true
        });
    }

    async list(filter = {}) {
        // Return list of available curated docs
        return Object.entries(DECLASSIFIED_LIBRARY).map(([id, doc]) => ({
            id: id,
            type: 'text',
            name: doc.title,
            data: null,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: doc.author,
                date: doc.date,
                tags: doc.tags,
                category: 'Declassified'
            }
        }));
    }

    async get(id) {
        if (!DECLASSIFIED_LIBRARY[id]) {
            // If ID is just "Declassified", return list of docs? 
            // Better to handle in getTexts by category
            return null;
        }

        const doc = DECLASSIFIED_LIBRARY[id];

        return {
            id: id,
            type: 'text',
            name: doc.title,
            content: doc.content,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: doc.author,
                date: doc.date,
                tags: doc.tags,
                summary: doc.summary
            }
        };
    }

    async search(query, filter = {}) {
        const q = query.toLowerCase();

        return Object.entries(DECLASSIFIED_LIBRARY)
            .filter(([id, doc]) => {
                return doc.title.toLowerCase().includes(q) ||
                    doc.summary.toLowerCase().includes(q) ||
                    doc.tags.some(t => t.includes(q));
            })
            .map(([id, doc]) => ({
                id: id,
                type: 'text',
                name: doc.title,
                metadata: {
                    snippet: doc.summary,
                    tags: doc.tags
                }
            }));
    }
}
