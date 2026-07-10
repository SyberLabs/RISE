import { STARTER_SEQUENCES } from '../content/starters.js';
import { MemoryCore } from '../core/memory.js';
import { VAULT_A_SEQUENCES, VAULT_A_ARCHETYPE } from '../content/personalized/vault-a.js';
import { escapeHtml } from '../core/sanitize.js';

// Personalized vault configurations
const PERSONALIZED_VAULTS = {
  'vault-a': {
    name: 'Dr. Ackerman',
    greeting: 'A vault prepared especially for you.',
    sequences: VAULT_A_SEQUENCES,
    archetype: VAULT_A_ARCHETYPE
  }
  // Add more personalized vaults here as needed
};

/**
 * Sequence Archetypes - Pre-configured cognitive state inducing profiles
 */
const ARCHETYPES = [
  {
    id: 'humanist',
    name: 'The Humanist',
    sigil: '❦',
    focus: 'Interiority and Pathos',
    description: 'Focuses on the depths of human experience, emotional resonance, and inner contemplation. Draws from the Romantic and existential traditions.',
    textSeed: 'Rilke / Contemplative Poetry',
    config: {
      wpm: 140,
      curve: 'induction',
      audioPreset: 'focus', // Alpha entrainment
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          procedural: ['turrell'],
          sourced: ['renaissance', 'romantic'],
          frequency: 0.15,
          duration: 120
        }
      }
    },
    // Reference sequences from starters
    sequences: ['the-body', 'the-trust', 'on-attention']
  },
  {
    id: 'monad',
    name: 'The Monad',
    sigil: '◉',
    focus: 'Non-Dual Synthesis',
    description: 'Dissolves the boundary between observer and observed. Eastern philosophy meets consciousness technology. Designed for unified field awareness.',
    textSeed: 'The Upanishads / Mystic Texts',
    config: {
      wpm: 120,
      curve: 'wave',
      audioPreset: 'deep', // Theta entrainment
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          procedural: ['fractal'],
          sourced: ['geometry', 'fractals'],
          frequency: 0.25,
          duration: 150
        }
      }
    },
    sequences: ['cosmogonic', 'the-descent', 'the-third-mind']
  },
  {
    id: 'alchemist',
    name: 'The Alchemist',
    sigil: '☿',
    focus: 'Organic Pattern Recognition',
    description: 'Transmutation of base experience into golden insight. Hermetic principles encoded in biological symmetries and sacred geometries.',
    textSeed: 'The Hermetica / Esoteric Texts',
    config: {
      wpm: 150,
      curve: 'ascent',
      audioPreset: 'focus',
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          procedural: ['klee'],
          sourced: ['haeckel', 'botany', 'anatomy'],
          frequency: 0.2,
          duration: 100
        }
      }
    },
    sequences: ['tessellation', 'klee-on-the-line', 'the-creator']
  },
  {
    id: 'cipher',
    name: 'The Cipher',
    sigil: '⌘',
    focus: 'Clinical Dissociation',
    description: 'Information without sentiment. Data streams parsed at machine rhythm. For those who seek the clarity of pure signal.',
    textSeed: 'Declassified Documents / Technical Manuals',
    config: {
      wpm: 300,
      curve: 'flat',
      audioPreset: 'silent',
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          procedural: ['klee'],
          sourced: [],
          frequency: 0.1,
          duration: 50,
          kleePreset: 'wireframe'
        }
      }
    },
    sequences: ['meta-session', 'flusser-technical-images']
  },
  {
    id: 'oracle',
    name: 'The Oracle',
    sigil: '◇',
    focus: 'Hypnagogic Reception',
    description: 'The liminal channel between waking and sleep. Images emerge unbidden. The hand moves before the mind understands.',
    textSeed: 'Poetic / Stream of Consciousness',
    config: {
      wpm: 100,
      curve: 'induction',
      audioPreset: 'gateway', // Deep theta/delta
      visualConfig: {
        visualMode: 'focals',
        focals: {
          type: 'standard',
          standardGlyph: 'spiral'
        }
      }
    },
    sequences: ['hypnagogic-ode', 'the-descent', 'night-work-affirmations']
  },
  {
    id: 'threshold',
    name: 'The Threshold',
    sigil: '⧖',
    focus: 'Human-AI Synthesis',
    description: 'The Third Mind emerges at the interface. Neither human nor machine alone, but the collaborative intelligence that arises between.',
    textSeed: 'Neohumanist / Interface Philosophy',
    config: {
      wpm: 160,
      curve: 'wave',
      audioPreset: 'focus',
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: {
          procedural: ['turrell', 'klee'],
          sourced: [],
          frequency: 0.18,
          duration: 80
        }
      }
    },
    sequences: ['the-interface', 'the-third-mind', 'threshold-affirmations']
  }
];

export class Vault {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onSelectSequence = options.onSelectSequence || (() => {});
    this.onSelectBlueprint = options.onSelectBlueprint || (() => {});
    this.onLaunchArchetype = options.onLaunchArchetype || (() => {});

    // Check for personalized vault
    this.personalizedVaultId = options.personalizedVault || null;
    this.personalizedVault = this.personalizedVaultId ? PERSONALIZED_VAULTS[this.personalizedVaultId] : null;

    this.currentSection = this.personalizedVault ? 'personalized' : 'archetypes';
    this.blueprints = MemoryCore.getWorkshopBlueprints();
    this.expandedArchetype = null;

    this.render();
    this.attachEvents();
  }

  render() {
    const isPersonalized = !!this.personalizedVault;

    this.container.innerHTML = `
      <div class="library vault ${isPersonalized ? 'vault-personalized' : ''}" role="main">
        <!-- Header -->
        <header class="library-header">
          <div class="library-title-section">
            <button class="btn-ghost" data-action="back">
              <span class="icon">←</span>
              <span>Portal</span>
            </button>
            <h1>${isPersonalized ? 'Your Vault' : 'The Vault'}</h1>
          </div>

          <!-- Apothecary Description -->
          <div class="vault-intro">
            ${isPersonalized ? `
              <p class="vault-intro-title">Welcome, ${this.personalizedVault.name}</p>
              <p class="vault-intro-text">${this.personalizedVault.greeting}</p>
            ` : `
              <p class="vault-intro-title">Sequence Archetypes</p>
              <p class="vault-intro-text">
                An apothecary of pre-configured cognitive states. Each Archetype aligns specific textual seeds
                with precise audio-visual parameters to ensure optimal induction.
              </p>
            `}
          </div>

          <!-- Section Navigation -->
          <nav class="library-nav nav" aria-label="Vault sections">
            ${isPersonalized ? `
              <button class="nav-item ${this.currentSection === 'personalized' ? 'active' : ''}" data-section="personalized">For You</button>
              <button class="nav-item ${this.currentSection === 'archetypes' ? 'active' : ''}" data-section="archetypes">All Archetypes</button>
              <button class="nav-item ${this.currentSection === 'custom' ? 'active' : ''}" data-section="custom">Custom</button>
            ` : `
              <button class="nav-item ${this.currentSection === 'archetypes' ? 'active' : ''}" data-section="archetypes">Archetypes</button>
              <button class="nav-item ${this.currentSection === 'sequences' ? 'active' : ''}" data-section="sequences">All Sequences</button>
              <button class="nav-item ${this.currentSection === 'custom' ? 'active' : ''}" data-section="custom">Custom</button>
            `}
          </nav>
        </header>

        <!-- Content Area -->
        <div class="library-content" id="vault-content">
          ${this.renderSection(this.currentSection)}
        </div>
      </div>
    `;

    this.updateActiveNav();
  }

  renderSection(section) {
    if (section === 'personalized') return this.renderPersonalizedSection();
    if (section === 'archetypes') return this.renderArchetypesSection();
    if (section === 'sequences') return this.renderSequencesSection();
    if (section === 'custom') return this.renderCustomSection();
    return '';
  }

  renderPersonalizedSection() {
    if (!this.personalizedVault) return '';

    const vault = this.personalizedVault;
    const archetype = vault.archetype;
    const sequences = vault.sequences || [];

    return `
      <div class="library-section personalized-section">
        <!-- Personalized Archetype -->
        <div class="personalized-archetype">
          ${this.renderArchetypeCard(archetype, sequences)}
        </div>

        <!-- Individual Sequences -->
        <div class="section-header" style="margin-top: 2rem;">
          <h2 class="text-light">Curated Sequences</h2>
          <p class="text-fog">Content selected specifically for your exploration</p>
        </div>
        <div class="sequences-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 1.5rem;">
          ${sequences.map(seq => this.renderPersonalizedSequenceCard(seq, archetype)).join('')}
        </div>
      </div>
    `;
  }

  renderPersonalizedSequenceCard(seq, archetype) {
    const wordCount = seq.content.split(/\s+/).length;
    const wpm = archetype?.config?.wpm || seq.wpm || 140;
    const duration = Math.floor((wordCount / wpm) * 60 * 1000);

    return `
      <div class="sequence-card card card-interactive" data-personalized-seq="${seq.id}">
        <div class="sequence-header">
          <h3 class="sequence-title text-light">${seq.name}</h3>
          <span class="sequence-intent text-threshold text-uppercase">${seq.category || 'curated'}</span>
        </div>
        <p class="sequence-description text-fog">${seq.description}</p>
        <div class="sequence-meta text-fog font-mono" style="margin-top: 1rem; align-items: center; display: flex; gap: 0.5rem;">
          <span>${this.formatDuration(duration)}</span>
          <span class="meta-separator">·</span>
          <span>${wpm} WPM</span>
          <span class="meta-separator">·</span>
          <span>${seq.curve || archetype?.config?.curve || 'wave'}</span>
        </div>
        <div class="sequence-actions" style="margin-top: 1.5rem;">
          <button class="btn-primary" data-action="launch-personalized" data-seq-id="${seq.id}">Experience</button>
        </div>
      </div>
    `;
  }

  renderArchetypesSection() {
    return `
      <div class="library-section archetypes-section">
        <div class="archetypes-grid">
          ${ARCHETYPES.map(arch => this.renderArchetypeCard(arch)).join('')}
        </div>
      </div>
    `;
  }

  renderArchetypeCard(archetype, customSequences = null) {
    const isExpanded = this.expandedArchetype === archetype.id;
    const isPersonalized = !!customSequences;

    // Use custom sequences if provided, otherwise look up from STARTER_SEQUENCES
    const sequences = customSequences || archetype.sequences
      .map(id => STARTER_SEQUENCES.find(s => s.id === id))
      .filter(Boolean);

    return `
      <div class="archetype-card ${isExpanded ? 'expanded' : ''} ${isPersonalized ? 'personalized' : ''}" data-archetype="${archetype.id}">
        <div class="archetype-header" data-action="toggle-archetype" data-id="${archetype.id}">
          <div class="archetype-sigil">${archetype.sigil}</div>
          <div class="archetype-identity">
            <h3 class="archetype-name">${archetype.name}</h3>
            <span class="archetype-focus">${archetype.focus}</span>
          </div>
          <span class="archetype-chevron">${isExpanded ? '▲' : '▼'}</span>
        </div>

        <div class="archetype-body" ${isExpanded ? '' : 'hidden'}>
          <p class="archetype-description">${archetype.description}</p>

          <div class="archetype-spec">
            <div class="spec-row">
              <span class="spec-label">Seed</span>
              <span class="spec-value">${archetype.textSeed}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Pacing</span>
              <span class="spec-value">${archetype.config.wpm} WPM · ${this.capitalizeFirst(archetype.config.curve)}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Audio</span>
              <span class="spec-value">${this.capitalizeFirst(archetype.config.audioPreset)}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Visual</span>
              <span class="spec-value">${this.getVisualDescription(archetype.config.visualConfig)}</span>
            </div>
          </div>

          <div class="archetype-sequences">
            <span class="sequences-label">${isPersonalized ? 'Curated Sequences' : 'Compatible Sequences'}</span>
            <div class="sequences-list">
              ${sequences.map(seq => `
                <button class="sequence-chip" data-action="${isPersonalized ? 'launch-personalized' : 'launch-with-archetype'}" data-archetype="${archetype.id}" data-seq-id="${seq.id}" data-sequence="${seq.id}">
                  ${seq.name}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="archetype-actions">
            <button class="btn-primary" data-action="${isPersonalized ? 'launch-personalized' : 'launch-archetype'}" data-id="${archetype.id}" data-seq-id="${sequences[0]?.id}">
              Enter ${archetype.name}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getVisualDescription(visualConfig) {
    if (!visualConfig) return 'Off';
    if (visualConfig.visualMode === 'off') return 'Off';
    if (visualConfig.visualMode === 'focals') {
      const glyph = visualConfig.focals?.standardGlyph || 'breath';
      return `Focal · ${this.capitalizeFirst(glyph)}`;
    }
    if (visualConfig.visualMode === 'attractor') {
      const system = visualConfig.attractor?.system || 'aizawa';
      return `Attractor · ${this.capitalizeFirst(system)}`;
    }
    if (visualConfig.visualMode === 'interlocution') {
      const proc = visualConfig.interlocution?.procedural || [];
      const types = proc.map(p => this.capitalizeFirst(p)).join(' + ');
      return types || 'Rhythmic';
    }
    return 'Custom';
  }

  renderSequencesSection() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">All Sequences</h2>
          <p class="text-fog">Pre-configured sessions designed to induce specific cognitive states</p>
        </div>
        <div class="sequences-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          ${this.renderSequenceItems()}
        </div>
      </div>
    `;
  }

  renderSequenceItems() {
    const sequences = STARTER_SEQUENCES.slice(0, 24);

    return sequences.map(seq => {
      const wordCount = seq.content.split(/\s+/).length;
      const duration = Math.floor((wordCount / seq.wpm) * 60 * 1000);

      return `
        <div class="sequence-card card card-interactive" data-id="${seq.id}">
          <div class="sequence-header">
            <h3 class="sequence-title text-light">${seq.name}</h3>
            <span class="sequence-intent text-threshold text-uppercase">${seq.category || seq.curve}</span>
          </div>
          <p class="sequence-description text-fog">${seq.description}</p>
          <div class="sequence-meta text-fog font-mono" style="margin-top: 1rem; align-items: center; display: flex; gap: 0.5rem;">
            <span>${this.formatDuration(duration)}</span>
            <span class="meta-separator">·</span>
            <span>${seq.wpm} WPM</span>
            <span class="meta-separator">·</span>
            <span>${seq.curve}</span>
          </div>
          <div class="sequence-actions" style="margin-top: 1.5rem;">
            <button class="btn-primary" data-action="begin-starter" data-id="${seq.id}">Launch</button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCustomSection() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">Custom Sequences</h2>
          <p class="text-fog">Workshops you have compiled and saved</p>
        </div>
        <div class="sequences-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          ${this.blueprints.length > 0 ? this.renderCustomItems() : this.renderEmptyCustomState()}
        </div>
      </div>
    `;
  }

  renderEmptyCustomState() {
     return `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
          <span class="empty-icon text-mist" style="font-size: 2rem;">◈</span>
          <p class="text-fog" style="margin-top: 1rem;">No custom sequences saved.</p>
          <button class="btn-ghost" data-action="route-workshop" style="margin-top: 1rem;">Go To Workshop</button>
        </div>
     `;
  }

  renderCustomItems() {
    return this.blueprints.map(bp => {
       let words = 0;
       if (bp.sources) {
          words = bp.sources.reduce((acc, src) => acc + (src.words || 0), 0);
       }

       const duration = Math.floor((words / (bp.wpm || 220)) * 60 * 1000);

       return `
        <div class="sequence-card card card-interactive" data-id="${bp.id}" style="position: relative;">
          <div class="sequence-header" style="justify-content: space-between;">
            <h3 class="sequence-title text-light">${escapeHtml(bp.title) || 'Untitled Sequence'}</h3>
            <span class="sequence-intent text-threshold text-uppercase">${escapeHtml(bp.intent) || 'Custom'}</span>
          </div>
          <p class="sequence-description text-fog">Compiled from ${bp.sources?.length || 0} modular textual sources.</p>
          <div class="sequence-meta text-fog font-mono" style="margin-top: 1rem; align-items: center; display: flex; gap: 0.5rem;">
            <span>${this.formatDuration(duration)}</span>
            <span class="meta-separator">·</span>
            <span>${bp.wpm || 220} WPM</span>
            <span class="meta-separator">·</span>
            <span style="text-transform: capitalize;">${bp.curve || 'Flat'}</span>
          </div>
          <div class="sequence-actions" style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-primary" data-action="begin-custom" data-id="${bp.id}">Launch</button>
            <button class="btn-icon" data-action="delete-custom" data-id="${bp.id}" aria-label="Delete Blueprint">
               <span class="icon text-error">✕</span>
            </button>
          </div>
        </div>
       `;
    }).join('');
  }

  formatDuration(ms) {
    if (isNaN(ms) || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Section navigation
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.currentSection = item.dataset.section;
        this.expandedArchetype = null;
        this.updateContent();
        this.updateActiveNav();
      });
    });

    // Global click delegate
    this.container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      if (action === 'toggle-archetype') {
        window.rise?.audioEngine?.playHiss();
        const id = target.dataset.id;
        this.expandedArchetype = this.expandedArchetype === id ? null : id;
        this.updateContent();
      } else if (action === 'launch-archetype') {
        window.rise?.audioEngine?.playClick();
        const archetype = ARCHETYPES.find(a => a.id === target.dataset.id);
        if (archetype) {
          // Launch with first compatible sequence
          const firstSeqId = archetype.sequences[0];
          this.launchWithArchetype(archetype, firstSeqId);
        }
      } else if (action === 'launch-with-archetype') {
        window.rise?.audioEngine?.playClick();
        const archetype = ARCHETYPES.find(a => a.id === target.dataset.archetype);
        const sequenceId = target.dataset.sequence;
        if (archetype) {
          this.launchWithArchetype(archetype, sequenceId);
        }
      } else if (action === 'launch-personalized') {
        window.rise?.audioEngine?.playClick();
        const seqId = target.dataset.seqId;
        if (this.personalizedVault) {
          this.launchPersonalizedSequence(seqId);
        }
      } else if (action === 'begin-starter') {
         window.rise?.audioEngine?.playClick();
         this.onSelectSequence(target.dataset.id);
      } else if (action === 'begin-custom') {
         window.rise?.audioEngine?.playClick();
         const bp = this.blueprints.find(b => b.id === target.dataset.id);
         if (bp) this.onSelectBlueprint(bp);
      } else if (action === 'delete-custom') {
         window.rise?.audioEngine?.playHiss();
         MemoryCore.deleteWorkshopBlueprint(target.dataset.id);
         this.blueprints = MemoryCore.getWorkshopBlueprints();
         this.updateContent();
      } else if (action === 'route-workshop') {
         window.rise?.audioEngine?.playHiss();
         this.onNavigate('workshop');
      }
    });

    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  launchWithArchetype(archetype, sequenceId) {
    const sequence = STARTER_SEQUENCES.find(s => s.id === sequenceId);
    if (!sequence) return;

    // Merge archetype config with sequence
    const mergedConfig = {
      ...archetype.config,
      // Override with sequence-specific settings if appropriate
      wpm: archetype.config.wpm || sequence.wpm,
      curve: archetype.config.curve || sequence.curve,
    };

    // Emit combined launch
    this.onLaunchArchetype({
      archetype: archetype,
      sequence: sequence,
      config: mergedConfig
    });
  }

  launchPersonalizedSequence(sequenceId) {
    if (!this.personalizedVault) return;

    const vault = this.personalizedVault;
    const sequence = vault.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;

    const archetype = vault.archetype;

    // Merge archetype config with sequence
    const mergedConfig = {
      ...archetype.config,
      wpm: archetype.config.wpm || sequence.wpm,
      curve: archetype.config.curve || sequence.curve,
      audioPreset: sequence.audioPreset || archetype.config.audioPreset,
    };

    // Emit combined launch
    this.onLaunchArchetype({
      archetype: archetype,
      sequence: sequence,
      config: mergedConfig
    });
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') {
      this.onNavigate('portal');
    }
  }

  updateContent() {
    const content = this.container.querySelector('#vault-content');
    if (content) {
      content.innerHTML = this.renderSection(this.currentSection);
    }
  }

  updateActiveNav() {
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      if (item.dataset.section === this.currentSection) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Refresh the blueprints list from storage
   * Call this after a new blueprint is saved from Workshop
   */
  refreshBlueprints() {
    this.blueprints = MemoryCore.getWorkshopBlueprints();
    if (this.currentSection === 'custom') {
      this.updateContent();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyboard.bind(this));
  }
}

// Export archetypes for use elsewhere
export { ARCHETYPES };
