import { STARTER_SEQUENCES } from '../content/starters.js';
import { PORTABLE_EXAMPLES } from '../content/portable-examples.js';
import { MemoryCore } from '../core/memory.js';
import { VAULT_A_SEQUENCES, VAULT_A_ARCHETYPE } from '../content/personalized/vault-a.js';
import { escapeHtml } from '../core/sanitize.js';
import { isPersonalProject } from '../core/personal-identity.js';
import { personalSession } from '../core/personal-project.js';
import { compileSession } from '../core/session-compiler.js';
import { downloadJsonFile } from '../core/experience-program-io.js';
import {
  exportPortableSequence,
  inspectPortableSequence,
  PORTABLE_SEQUENCE_MAX_BYTES
} from '../core/portable-sequence.js';
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

    this.currentSection = options.initialSection === 'custom' ? 'custom' : this.personalizedVault ? 'personalized' : 'sequences';
    this.blueprints = MemoryCore.getWorkshopBlueprints();
    this.pendingPortable = null;
    this.portableNotice = '';
    this.portableBusy = false;
    this.portableGeneration = 0;
    this.portableCredits = new Map();
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
              <span class="icon" aria-hidden="true">←</span>
              <span>Home</span>
            </button>
            <h1>${isPersonalized ? 'Your sequences' : 'Sequences'}</h1>
          </div>

          <!-- Section Navigation -->
          <nav class="library-nav nav" aria-label="Sequence sections">
            ${isPersonalized ? `
              <button class="nav-item" data-section="personalized">For You</button>
              <button class="nav-item" data-section="custom">Custom</button>
            ` : `
              <button class="nav-item" data-section="sequences">All Sequences</button>
              <button class="nav-item" data-section="custom">Custom</button>
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
          <span class="sequence-intent text-uppercase">${escapeHtml(seq.category || 'curated')}</span>
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
          <button class="btn-secondary" data-action="launch-personalized" data-seq-id="${seq.id}">Experience</button>
        </div>
      </div>
    `;
  }

  renderSequencesSection() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">Authored examples</h2>
          <p class="text-fog">Try a short Archive score without saving it. Keep opens a review before it joins your Vault.</p>
        </div>
        <div class="sequences-grid vault-examples" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          ${PORTABLE_EXAMPLES.map(example => `
            <div class="sequence-card card" data-portable-example="${example.id}">
              <div class="sequence-header">
                <h3 class="sequence-title text-light">${escapeHtml(example.bundle.title)}</h3>
                <span class="sequence-intent text-uppercase">${escapeHtml(example.tone)}</span>
              </div>
              <p class="sequence-description text-fog">${escapeHtml(example.description)}</p>
              <p class="text-fog">${escapeHtml(example.bundle.sources[0].title)} · ${example.bundle.reading.wpm} WPM · visual and audio score</p>
              <div class="sequence-actions">
                <button class="btn-primary" data-action="try-example" data-example-id="${example.id}">Try</button>
                <button class="btn-secondary" data-action="keep-example" data-example-id="${example.id}">Keep</button>
              </div>
              <p role="status" data-example-status></p>
            </div>`).join('')}
        </div>
        <div class="section-header" style="margin-top: 3rem;">
          <h2 class="text-light">Starter readings</h2>
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
            <span class="sequence-intent text-uppercase">${seq.category || seq.curve}</span>
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
            <button class="btn-secondary" data-action="begin-starter" data-id="${seq.id}">Launch</button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCustomSection() {
    return `
      <div class="library-section">
        <div class="section-header">
          <h2 class="text-light">Kept work</h2>
          <p class="text-fog">Your personal readings and saved sequences</p>
        </div>
        <div class="vault-portable card">
          <label class="text-light">Bring in a sequence
            <input data-portable-file type="file" accept=".json,application/json"
              ${this.portableBusy ? 'disabled' : ''}>
          </label>
          <p class="text-fog">A portable score names an exact Archive edition. It includes authored labels and visual settings, and may include short Archive quotes as position anchors (up to 500 characters each). It does not bundle the full reading or local media. Its rights basis is United States public domain.</p>
          ${this.pendingPortable ? `
            <div class="vault-portable-review">
              <h3>${escapeHtml(this.pendingPortable.title)}</h3>
              <p>Creator credit: ${escapeHtml(this.pendingPortable.creatorCredit || 'Unattributed')} (declared, unverified)</p>
              <p>Source: ${this.pendingPortable.sources.map(source => escapeHtml(source.title)).join(', ')}</p>
              ${this.pendingPortable.parentPortableId ? `<p class="sequence-parent-reference">Parent score ID: ${escapeHtml(this.pendingPortable.parentPortableId)}. This is a structural reference, not an endorsement by its creator.</p>` : ''}
              <p>Inspect this proposed score before keeping it in this browser. Your own reading settings may change its presentation.</p>
              <button class="btn-primary" data-action="keep-portable" ${this.portableBusy ? 'disabled' : ''}>Keep in this browser</button>
              <button class="btn-secondary" data-action="cancel-portable">Cancel</button>
            </div>` : ''}
          <p role="status" class="text-fog">${escapeHtml(this.portableNotice)}</p>
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
          <button class="btn-ghost" data-action="route-workshop" style="margin-top: 1rem;">Go to Compose</button>
        </div>
     `;
  }

  renderCustomItems() {
    return this.blueprints.map(bp => {
       if (isPersonalProject(bp.project || bp)) {
         let duration = 'Unavailable';
         try { duration = this.formatDuration(compileSession(personalSession(bp.project || bp)).totalDuration); } catch { /* Refuse invalid saved data at launch. */ }
         return `<div class="sequence-card card" data-id="${escapeHtml(bp.id)}">
           <h3 class="sequence-title text-light">${escapeHtml(bp.title)}</h3>
           <p>Personal reading · Revision ${Number(bp.revision)} · Kept in this browser</p>
           <p>${duration} · 160 WPM · Sound off</p>
           <p>Writer provenance is declared, not independently verified.</p>
           <div class="sequence-actions">
             <button class="btn-primary" data-action="begin-custom" data-id="${escapeHtml(bp.id)}">Launch</button>
             <button class="btn-secondary" data-action="export-personal-json" data-id="${escapeHtml(bp.id)}">Export JSON</button>
             <button class="btn-secondary" data-action="export-personal-text" data-id="${escapeHtml(bp.id)}">Export text</button>
             <button class="btn-secondary" data-action="delete-custom" data-id="${escapeHtml(bp.id)}">Delete</button>
           </div><p role="status" data-personal-status></p>
         </div>`;
       }
       let words = 0;
       if (bp.sources) {
          words = bp.sources.reduce((acc, src) => acc + (src.words || 0), 0);
       }

       const duration = Math.floor((words / (bp.wpm || 200)) * 60 * 1000);

       return `
        <div class="sequence-card card card-interactive" data-id="${escapeHtml(bp.id)}" style="position: relative;">
          <div class="sequence-header" style="justify-content: space-between;">
            <h3 class="sequence-title text-light">${escapeHtml(bp.title) || 'Untitled Sequence'}</h3>
            <span class="sequence-intent text-uppercase">${escapeHtml(bp.intent) || 'Custom'}</span>
          </div>
          <p class="sequence-description text-fog">Compiled from ${bp.sources?.length || 0} modular textual sources.</p>
          ${bp.provenance?.portableId && bp.provenance.creatorCredit ? `<p class="text-fog">Creator credit: ${escapeHtml(bp.provenance.creatorCredit)} (declared, unverified)</p>` : ''}
          ${bp.provenance?.parentPortableId ? `<p class="sequence-parent-reference text-fog">Variation of ${escapeHtml(bp.provenance.parentPortableId)} · relationship unverified, not an endorsement</p>` : ''}
          <div class="sequence-meta text-fog font-mono" style="margin-top: 1rem; align-items: center; display: flex; gap: 0.5rem;">
            <span>${this.formatDuration(duration)}</span>
            <span class="meta-separator">·</span>
            <span>${bp.wpm || 200} WPM</span>
            <span class="meta-separator">·</span>
            <span style="text-transform: capitalize;">${escapeHtml(bp.curve || 'Flat')}</span>
          </div>
          <div class="sequence-actions" style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
              <button class="btn-secondary" data-action="begin-custom" data-id="${escapeHtml(bp.id)}">Launch</button>
              <button class="btn-secondary" data-action="edit-custom" data-id="${escapeHtml(bp.id)}">${bp.provenance?.portableId ? 'Preview / edit' : 'Edit'}</button>
              ${bp.provenance?.portableId ? `<button class="btn-secondary" data-action="vary-portable" data-id="${escapeHtml(bp.id)}">Vary as new</button>` : ''}
            </div>
            <button class="btn-icon" data-action="delete-custom" data-id="${escapeHtml(bp.id)}" aria-label="Delete Blueprint">
               <span class="icon text-error">✕</span>
            </button>
          </div>
          ${bp.experienceProgram && !bp.provenance?.portableId ? `
            <label class="vault-portable-credit">Creator credit (optional)
              <input data-portable-credit maxlength="120" autocomplete="off" placeholder="Name to show the recipient" value="${escapeHtml(this.portableCredits.get(bp.id) || '')}">
            </label>
            <button class="btn-secondary" data-action="export-portable" data-id="${escapeHtml(bp.id)}">Export portable score</button>
            <p role="status" data-portable-status></p>` : ''}
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
    this.container.addEventListener('input', (event) => {
      if (!event.target.matches('[data-portable-credit]')) return;
      const id = event.target.closest('.sequence-card')?.dataset.id;
      if (id) this.portableCredits.set(id, event.target.value);
    });

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

    this.container.addEventListener('change', async (event) => {
      if (!event.target.matches('[data-portable-file]')) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const generation = ++this.portableGeneration;
      if (file.size > PORTABLE_SEQUENCE_MAX_BYTES) {
        this.pendingPortable = null;
        this.portableNotice = 'Portable sequence file exceeds the 2 MB limit.';
        this.updateContent();
        return;
      }
      try {
        const text = await file.text();
        if (generation !== this.portableGeneration) return;
        await this.stagePortableSequence(text);
      } catch (error) {
        if (generation !== this.portableGeneration) return;
        this.pendingPortable = null;
        this.portableNotice = error.message || 'Could not read this file.';
        this.updateContent();
      }
    });

    // Global click delegate
    this.container.addEventListener('click', async (e) => {
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
      } else if (action === 'try-example' || action === 'keep-example') {
         const example = PORTABLE_EXAMPLES.find(item => item.id === target.dataset.exampleId);
         if (!example) return;
         const text = JSON.stringify(example.bundle);
         if (action === 'keep-example') {
           this.currentSection = 'custom';
           this.updateActiveNav();
           await this.stagePortableSequence(text);
           return;
         }
         const generation = ++this.portableGeneration;
         const status = target.closest('[data-portable-example]')?.querySelector('[data-example-status]');
         if (status) status.textContent = 'Checking the exact Archive score…';
         target.disabled = true;
         try {
           const candidate = await inspectPortableSequence(text);
           if (generation !== this.portableGeneration) return;
           const launched = await this.onSelectBlueprint(candidate.project);
           if (launched === false && status) status.textContent = 'This example could not play.';
         } catch (error) {
           if (generation === this.portableGeneration && status) {
             status.textContent = error.message || 'This example could not play.';
           }
         } finally { target.disabled = false; }
      } else if (action === 'begin-custom') {
         this.getAudioEngine()?.playClick();
         const bp = this.blueprints.find(b => b.id === target.dataset.id);
         if (bp) this.onSelectBlueprint(isPersonalProject(bp.project || bp) ? (bp.project || bp) : bp);
      } else if (action === 'export-personal-json' || action === 'export-personal-text') {
         const bp = this.blueprints.find(b => b.id === target.dataset.id);
         try {
           const { exportPersonalProject } = await import('../core/personal-project.js');
           if (bp) await exportPersonalProject(bp.project || bp, action.endsWith('text') ? 'text' : 'json');
         } catch (error) {
           const status = target.closest('.sequence-card')?.querySelector('[data-personal-status]');
           if (status) status.textContent = error.message || 'Export failed.';
         }
      } else if (action === 'export-portable') {
         const bp = this.blueprints.find(item => item.id === target.dataset.id);
         const status = target.closest('.sequence-card')?.querySelector('[data-portable-status]');
         const creatorCredit = target.closest('.sequence-card')?.querySelector('[data-portable-credit]')?.value.trim() || null;
         try {
           if (!bp) throw new Error('Saved sequence was not found.');
           target.disabled = true;
           const text = await exportPortableSequence(bp.project || bp, { creatorCredit });
           downloadJsonFile(`${bp.id}.portable-sequence.json`, text);
           if (status) status.textContent = 'Portable score exported. Review its authored labels and any short Archive quote anchors before sharing.';
         } catch (error) {
           if (status) status.textContent = error.message || 'Could not export this score.';
         } finally { target.disabled = false; }
      } else if (action === 'keep-portable') {
         await this.acceptPortableSequence();
      } else if (action === 'cancel-portable') {
         this.portableGeneration += 1;
         this.pendingPortable = null;
         this.portableNotice = 'Import cancelled.';
         this.updateContent();
      } else if (action === 'edit-custom') {
         this.getAudioEngine()?.playHiss();
         this.onNavigate('workshop', { blueprintId: target.dataset.id });
      } else if (action === 'vary-portable') {
         const bp = this.blueprints.find(item => item.id === target.dataset.id);
         if (bp?.provenance?.portableId) {
           this.onNavigate('workshop', { varyBlueprintId: bp.id });
         }
      } else if (action === 'delete-custom') {
         this.getAudioEngine()?.playHiss();
         if (await MemoryCore.deleteWorkshopBlueprintAsync(target.dataset.id)) {
           this.blueprints = MemoryCore.getWorkshopBlueprints();
           this.updateContent();
         }
      } else if (action === 'route-workshop') {
         this.getAudioEngine()?.playHiss();
         this.onNavigate('workshop');
      }
    });

  }

  async stagePortableSequence(text) {
    const generation = ++this.portableGeneration;
    this.pendingPortable = null;
    this.portableNotice = 'Checking score and exact Archive sources…';
    this.updateContent();
    try {
      const candidate = await inspectPortableSequence(text);
      if (generation !== this.portableGeneration) return;
      this.pendingPortable = candidate;
      this.portableNotice = 'Ready for your review. Nothing has been saved.';
    } catch (error) {
      if (generation !== this.portableGeneration) return;
      this.portableNotice = error.message || 'This sequence could not be admitted.';
    }
    this.updateContent();
  }

  async acceptPortableSequence() {
    const candidate = this.pendingPortable;
    if (!candidate || this.portableBusy) return;
    if (MemoryCore.getWorkshopBlueprints().some(item => item.id === candidate.id)) {
      this.pendingPortable = null;
      this.portableNotice = 'This sequence is already in this browser.';
      this.updateContent();
      return;
    }
    this.portableBusy = true;
    this.updateContent();
    try {
      const saved = await MemoryCore.saveWorkshopBlueprintAsync(candidate.project, { createOnly: true });
      if (saved?.id) this.pendingPortable = null;
      if (saved?.id) {
        this.portableNotice = 'Sequence kept in this browser. Preview / edit it, Vary as new, or Launch to play.';
      } else if (MemoryCore.getWorkshopBlueprints().some(item => item.id === candidate.id)) {
        this.pendingPortable = null;
        this.portableNotice = 'This sequence is already in this browser.';
      } else {
        this.portableNotice = 'Could not keep this sequence. Try again.';
      }
    } catch (error) {
      this.portableNotice = error.message || 'Could not keep this sequence. Try again.';
    }
    this.portableBusy = false;
    this.refreshBlueprints();
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
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
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
    this.refreshBlueprints();
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  update(data) {
    if (data?.section === 'custom') this.currentSection = 'custom';
    this.refreshBlueprints();
    this.updateActiveNav();
  }

  deactivate() {
    this.portableGeneration += 1;
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.deactivate();
  }
}
