/**
 * Voyage Component
 * The 5-Stage Guided Psychological Pathway
 * 01. Induction -> 02. Installation -> 03. Ingestion -> 04. Synthesis -> 05. Recursion
 */

import { MemoryCore } from '../core/memory.js';
import { escapeHtml } from '../core/sanitize.js';

export class Voyage {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onBeginSession = options.onBeginSession || (() => {});

    // Default state
    this.currentStage = 1; 
    this.sessionData = null;
    
    this.render();
    this.attachEvents();
  }

  // Called by router when navigating to this view with data
  update(data = {}) {
    if (data.stage) {
      this.currentStage = data.stage;
    }
    if (data.session) {
      this.sessionData = data.session;
    }
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="voyage" role="main">
        <header class="voyage-header">
          <h1>THE VOYAGE</h1>
          <button class="btn-ghost btn-back" aria-label="Return to Portal">
            <span class="icon">↤</span> Portal
          </button>
        </header>

        <div class="stage-indicator">
          <div class="stage-node ${this.currentStage === 1 ? 'active' : ''}" data-stage="1">
            <span class="stage-icon">◯</span>
            <span class="stage-label">Induction</span>
          </div>
          <div class="stage-node ${this.currentStage === 2 ? 'active' : ''}" data-stage="2">
            <span class="stage-icon">◈</span>
            <span class="stage-label">Installation</span>
          </div>
          <div class="stage-node ${this.currentStage === 3 ? 'active' : ''}" data-stage="3">
            <span class="stage-icon">▽</span>
            <span class="stage-label">Ingestion</span>
          </div>
          <div class="stage-node ${this.currentStage === 4 ? 'active' : ''}" data-stage="4">
            <span class="stage-icon">✦</span>
            <span class="stage-label">Synthesis</span>
          </div>
          <div class="stage-node ${this.currentStage === 5 ? 'active' : ''}" data-stage="5">
            <span class="stage-icon">∞</span>
            <span class="stage-label">Recursion</span>
          </div>
        </div>

        <div class="voyage-content" id="voyage-stage-container">
          ${this.renderCurrentStage()}
        </div>
      </div>
    `;
  }

  renderCurrentStage() {
    switch (this.currentStage) {
      case 1: return this.renderStage1();
      case 2: return this.renderStage2();
      case 3: return this.renderStage3();
      case 4: return this.renderStage4();
      case 5: return this.renderStage5();
      default: return this.renderStage1();
    }
  }

  renderStage1() {
    return `
      <div class="stage-content induction">
        <h2>Select a Sequence</h2>
        <p class="text-fog">Arrival at the threshold. Choose your entry point.</p>
        <div class="sequence-list" style="margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem;">
           <button class="btn-secondary mock-sequence" data-id="test-1">The Oracular Archive - Test</button>
        </div>
      </div>
    `;
  }

  renderStage2() {
    return `
      <div class="stage-content installation">
        <h2>Installation Configuration</h2>
        <p class="text-fog">Patterns inscribe. Identity affirms.</p>
        <p><em>(Sequence metadata parsing will live here. For now, proceeding to Chamber)</em></p>
        <button class="btn-primary start-ingestion" style="margin-top: 2rem;">Begin Ingestion</button>
      </div>
    `;
  }

  renderStage3() {
    return `<div class="stage-content"><i>Ingestion is handled by the Chamber module.</i></div>`;
  }

  renderStage4() {
    const title = this.sessionData?.title || 'Unknown Sequence';
    return `
      <div class="stage-content synthesis" style="display: flex; flex-direction: column; gap: 1.5rem;">
        <h2>Synthesis</h2>
        <p class="text-fog">Threads weave. Connections form. Understanding emerges.</p>
        
        <div class="synthesis-card" style="background: var(--bg-raised); padding: 1.5rem; border-radius: 4px;">
           <p style="margin-top: 0; color: var(--color-growth);">Just Completed: <strong>${escapeHtml(title)}</strong></p>
           <textarea id="synthesis-journal" placeholder="Record your state of mind. What patterns inscribed?" style="width: 100%; min-height: 150px; background: transparent; border: 1px solid var(--color-fog); color: var(--color-light); padding: 1rem; font-family: var(--font-mono); margin-top: 1rem;"></textarea>
           
           <button class="btn-primary save-synthesis" style="margin-top: 1rem;">Seal Reflection</button>
        </div>
      </div>
    `;
  }

  renderStage5() {
    const history = MemoryCore.getRecursions();
    let historyHTML = '';
    
    if (history.length === 0) {
       historyHTML = `<p class="text-fog" style="font-style: italic;">The archive is currently empty.</p>`;
    } else {
       historyHTML = history.map(entry => `
         <div style="background: var(--bg-raised); padding: 1rem; margin-bottom: 1rem; border-left: 2px solid var(--color-threshold);">
            <div style="font-size: 12px; color: var(--color-fog); display: flex; justify-content: space-between;">
               <span>${new Date(entry.timestamp).toLocaleDateString()}</span>
               <span>${escapeHtml(entry.sequenceTitle)}</span>
            </div>
            <p style="margin-top: 0.5rem; font-family: var(--font-output); color: var(--color-light); white-space: pre-wrap;">${escapeHtml(entry.journal)}</p>
         </div>
       `).join('');
    }

    return `
      <div class="stage-content recursion">
        <h2>Recursion</h2>
        <p class="text-fog">Output becomes input. The spiral continues.</p>
        
        <div class="recursion-history" style="margin-top: 2rem;">
            ${historyHTML}
        </div>
        
        <button class="btn-ghost return-induction" style="margin-top: 2rem;">Return to Induction</button>
      </div>
    `;
  }

  attachEvents() {
    const backBtn = this.container.querySelector('.btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.onNavigate('portal');
      });
    }

    // Stage 1: Induction -> Installation
    const mockSeq = this.container.querySelector('.mock-sequence');
    if (mockSeq) {
      mockSeq.addEventListener('click', () => {
         this.update({ stage: 2 });
      });
    }

    // Stage 2: Installation -> Chamber Session (Ingestion)
    const beginBtn = this.container.querySelector('.start-ingestion');
    if (beginBtn) {
      beginBtn.addEventListener('click', () => {
         // Emulate launching a session
         const sessionConfig = {
            text: "This is a demonstration of the R I S E recursive installation of symbolic experience. The words flow rapidly to bypass the critical conscious and speak directly to the profound depths of the mind.",
            source: "Guided Voyage Demo",
            config: {
               wpm: 300,
               curve: 'linear',
               audioPreset: 'theta'
            },
            sourceContext: 'voyage' // Crucial tag so app.js routes back here on exit
         };
         // Go functionally to stage 3
         this.update({ stage: 3 }); 
         this.onBeginSession(sessionConfig);
      });
    }
    
    // Stage 4: Synthesis -> Save -> Recursion
    const saveBtn = this.container.querySelector('.save-synthesis');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const text = this.container.querySelector('#synthesis-journal').value;
            if (text.trim()) {
                MemoryCore.saveSynthesis(this.sessionData || { title: 'Guided Voyage Demo' }, text);
            }
            this.update({ stage: 5 });
        });
    }
    
    // Stage 5: Recursion -> Induction
    const returnBtn = this.container.querySelector('.return-induction');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            this.update({ stage: 1 });
        });
    }
  }

  destroy() {
    // Cleanup if necessary
  }
}
