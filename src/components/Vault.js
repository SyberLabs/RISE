import { STARTER_SEQUENCES } from '../content/starters.js';
import { MemoryCore } from '../core/memory.js';
import { VAULT_A_SEQUENCES, VAULT_A_ARCHETYPE } from '../content/personalized/vault-a.js';
import { escapeHtml } from '../core/sanitize.js';
import './Library.css';

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

export class Vault {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onSelectSequence = options.onSelectSequence || (() => {});
    this.onSelectBlueprint = options.onSelectBlueprint || (() => {});
    this.onLaunchArchetype = options.onLaunchArchetype || (() => {});
    this.getAudioEngine = options.getAudioEngine || (() => null);

    // Check for personalized vault
    this.personalizedVaultId = options.personalizedVault || null;
    this.personalizedVault = this.personalizedVaultId ? PERSONALIZED_VAULTS[this.personalizedVaultId] : null;

    this.currentSection = this.personalizedVault ? 'personalized' : 'sequences';
    this.blueprints = MemoryCore.getWorkshopBlueprints();
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

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

          <!-- Section Navigation -->
          <nav class="library-nav nav" aria-label="Vault sections">
            ${isPersonalized ? `
              <button class="nav-item ${this.currentSection === 'personalized' ? 'active' : ''}" data-section="personalized">For You</button>
              <button class="nav-item ${this.currentSection === 'custom' ? 'active' : ''}" data-section="custom">Custom</button>
            ` : `
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
        <!-- Individual Sequences. The heading alone carries this: the
             invitation and the section title have already said the
             readings were chosen for this reader. -->
        <div class="section-header">
          <h2 class="text-light">Curated Sequences</h2>
        </div>
        <div class="sequences-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 1rem;">
          ${sequences.map(seq => this.renderPersonalizedSequenceCard(seq, archetype)).join('')}
        </div>
      </div>
    `;
  }

  renderPersonalizedSequenceCard(seq, archetype) {
    const wordCount = seq.content.split(/\s+/).length;
    // The sequence's own pace wins — it is what actually launches
    const wpm = seq.wpm || archetype?.config?.wpm || 200;
    const duration = Math.floor((wordCount / wpm) * 60 * 1000);

    // Provenance is part of the reading, not a footnote: a vault of
    // someone's own work must say which paper each passage came from.
    const source = seq.source
      ? `
        <p class="sequence-source text-mist font-mono">
          <span class="sequence-source-title">${escapeHtml(seq.source.title)}</span>
          <span class="meta-separator">·</span>
          <span>${escapeHtml(String(seq.source.venue || ''))}</span>
          ${seq.source.year ? `<span class="meta-separator">·</span><span>${escapeHtml(String(seq.source.year))}</span>` : ''}
        </p>`
      : '';

    return `
      <div class="sequence-card card card-interactive" data-personalized-seq="${seq.id}">
        <div class="sequence-header">
          <h3 class="sequence-title text-light">${escapeHtml(seq.name)}</h3>
          <span class="sequence-intent text-threshold text-uppercase">${escapeHtml(seq.category || 'curated')}</span>
        </div>
        <p class="sequence-description text-fog">${escapeHtml(seq.description)}</p>
        ${source}
        <div class="sequence-meta text-fog font-mono" style="margin-top: 1rem; align-items: center; display: flex; gap: 0.5rem;">
          <span>${this.formatDuration(duration)}</span>
          <span class="meta-separator">·</span>
          <span>${wpm} WPM</span>
          <span class="meta-separator">·</span>
          <span>${escapeHtml(seq.curve || archetype?.config?.curve || 'wave')}</span>
        </div>
        <div class="sequence-actions" style="margin-top: 1.5rem;">
          <button class="btn-primary" data-action="launch-personalized" data-seq-id="${seq.id}">Experience</button>
        </div>
      </div>
    `;
  }

  renderSequencesSection() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">All Sequences</h2>
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

       const duration = Math.floor((words / (bp.wpm || 200)) * 60 * 1000);

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
            <span>${bp.wpm || 200} WPM</span>
            <span class="meta-separator">·</span>
            <span style="text-transform: capitalize;">${bp.curve || 'Flat'}</span>
          </div>
          <div class="sequence-actions" style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button class="btn-primary" data-action="begin-custom" data-id="${bp.id}">Launch</button>
              <button class="btn-secondary" data-action="edit-custom" data-id="${bp.id}">Edit</button>
            </div>
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

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.getAudioEngine()?.playClick();
      this.onNavigate('portal');
    });

    this.container.querySelector('[data-nav="journeys"]')?.addEventListener('click', () => {
      this.getAudioEngine()?.playClick();
      this.onNavigate('journeys');
    });

    // Section navigation
    const navItems = this.container.querySelectorAll('[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        this.getAudioEngine()?.playHiss();
        this.currentSection = item.dataset.section;
        this.updateContent();
        this.updateActiveNav();
      });
    });

    // Global click delegate
    this.container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      if (action === 'launch-personalized') {
        this.getAudioEngine()?.playClick();
        const seqId = target.dataset.seqId;
        if (this.personalizedVault) {
          this.launchPersonalizedSequence(seqId);
        }
      } else if (action === 'begin-starter') {
         this.getAudioEngine()?.playClick();
         this.onSelectSequence(target.dataset.id);
      } else if (action === 'begin-custom') {
         this.getAudioEngine()?.playClick();
         const bp = this.blueprints.find(b => b.id === target.dataset.id);
         if (bp) this.onSelectBlueprint(bp);
      } else if (action === 'edit-custom') {
         this.getAudioEngine()?.playHiss();
         this.onNavigate('workshop', { blueprintId: target.dataset.id });
      } else if (action === 'delete-custom') {
         this.getAudioEngine()?.playHiss();
         MemoryCore.deleteWorkshopBlueprint(target.dataset.id);
         this.blueprints = MemoryCore.getWorkshopBlueprints();
         this.updateContent();
      } else if (action === 'route-workshop') {
         this.getAudioEngine()?.playHiss();
         this.onNavigate('workshop');
      }
    });

  }

  launchPersonalizedSequence(sequenceId) {
    if (!this.personalizedVault) return;

    const vault = this.personalizedVault;
    const sequence = vault.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;

    const archetype = vault.archetype;

    // Merge archetype config with sequence. A personalized sequence may
    // carry its own sensory identity — the archetype is the house style,
    // the sequence is the specific room. Anything the sequence states
    // explicitly wins; anything it omits inherits.
    const mergedConfig = {
      ...archetype.config,
      wpm: sequence.wpm || archetype.config.wpm,
      curve: sequence.curve || archetype.config.curve,
      audioPreset: sequence.audioPreset || archetype.config.audioPreset,
      ...(sequence.soundscape ? { soundscape: sequence.soundscape } : {}),
      ...(sequence.chunkMode ? { chunkMode: sequence.chunkMode } : {}),
      ...(sequence.visualConfig ? { visualConfig: sequence.visualConfig } : {})
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
    void MemoryCore.getWorkshopBlueprintsHydrated().then((views) => {
      this.blueprints = views;
      if (this.currentSection === 'custom') this.updateContent();
    });
  }

  activate() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.deactivate();
  }
}
