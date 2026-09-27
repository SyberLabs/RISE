import { requestPersonalPiece } from '../core/personal-piece-client.js';
import { createPersonalProject, validatePersonalProject, importPersonalProject, personalSession, exportPersonalProject, readablePersonalText } from '../core/personal-project.js';
import { compileSession } from '../core/session-compiler.js';
import { MemoryCore } from '../core/memory.js';
import { canonicalPersonal } from '../core/personal-identity.js';
import { roomHeader, roomEyebrow } from './room-chrome.js';
import './Create.css';

export class Create {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onCreateSession = options.onCreateSession || (async () => false);
    this.request = options.request || requestPersonalPiece;
    this.operation = 0;
    this.actionOperation = 0;
    this.history = [];
    this.kept = new Set();
    this.render();
    this.update(options.data);
  }

  render() {
    this.container.innerHTML = `${roomHeader({ back: 'Home', action: 'home' })}<main class="personal-create">
      ${roomEyebrow('Create')}
      <h1 class="room-title">Create a personal reading</h1>
      <p class="personal-links"><button data-action="vault">Vault</button></p>
      <p>A thought can become a short original piece. You can read the whole text before deciding what to keep.</p>
      <form data-form="create">
        <label>Your thought <textarea name="thought" maxlength="500" required rows="3"></textarea></label>
        <label>Optional detail <textarea name="detail" maxlength="500" rows="2"></textarea></label>
        <p class="personal-disclosure">When you submit, OpenRouter and its Darkbloom provider receive your thought and detail to run the Qwen writer. For a revision they receive the current piece and your instruction. RISE does not store this content on its server. Keep saves the piece in this browser; it does not save your thought, detail, or revision instruction.</p>
        <button type="submit">Write a piece</button><button type="button" data-action="cancel">Cancel request</button>
      </form>
      <p role="status" aria-live="polite" data-status></p>
      <section data-draft aria-label="Your personal reading" hidden>
        <h2 data-title></h2><p>An original piece inspired by your thought. Details may be imagined.</p>
        <div data-text></div><p data-duration></p>
        <p>Quiet presentation · Sound off</p>
        <div class="personal-actions">
          <button data-action="start">Start</button><button data-action="keep">Keep</button>
          <button data-action="copy">Copy</button><button data-action="change">Change something</button>
          <button data-action="export-text">Export text</button><button data-action="export-json">Export JSON</button>
          <button data-action="previous" hidden>Return to previous version</button>
        </div>
        <form data-form="revise" hidden>
          <label>What would you change? <textarea name="instruction" maxlength="500" required rows="3"></textarea></label>
          <p>The configured writer receives this piece and your instruction. Your current version remains available.</p>
          <button type="submit">Make a revision</button>
        </form>
      </section>
      <section><h2>Import a kept reading</h2><label>Personal reading JSON (up to 64 KiB)
        <input type="file" accept=".json,application/json" data-import></label>
        <p>Imported provenance is declared by the file, not verified. Import opens a draft; choose Keep to save it.</p></section>
    </main>`;
    this.container.querySelector('[data-form="create"]').onsubmit = event => {
      event.preventDefault(); void this.generate(false);
    };
    this.container.querySelector('[data-form="revise"]').onsubmit = event => {
      event.preventDefault(); void this.generate(true);
    };
    this.container.onclick = event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action) void this.act(action);
    };
    this.container.querySelector('[data-import]').onchange = event => {
      const file = event.target.files?.[0];
      if (file) void this.importFile(file);
      event.target.value = '';
    };
  }

  status(text) { this.container.querySelector('[data-status]').textContent = text; }
  setWriting(writing) {
    this.writing = writing;
    this.container.querySelectorAll('form button[type="submit"], [data-action="start"], [data-action="previous"], [data-import]')
      .forEach(button => { button.disabled = writing; });
  }
  invalidate() { ++this.operation; ++this.actionOperation; this.controller?.abort(); this.controller = null; this.setWriting(false); }
  navigationIntent() { this.refreshUnkept(); this.invalidate(); }
  deactivate() { this.refreshUnkept(); this.invalidate(); }
  activate() { this.refreshUnkept(); }
  destroy() { this.invalidate(); this.container.onclick = null; }
  update(data) {
    if (data?.project) {
      this.invalidate();
      try { this.setDraft(validatePersonalProject(data.project)); }
      catch (error) { this.status(error.message); }
    }
  }

  setDraft(project) {
    if (this.draft && this.draft.id !== project.id) {
      // Another composition drops only work that is already kept; an unkept
      // paid draft stays reachable through Return to previous version.
      if (this.draft.provenance.compositionId !== project.provenance.compositionId) {
        const saved = this.savedPieces();
        this.history = [...this.history, this.draft].filter(p => saved.get(p.id) !== canonicalPersonal(p));
      } else this.history.push(this.draft);
    }
    this.draft = project;
    this.showDraft();
  }

  showDraft() {
    const project = this.draft;
    if (!project) return;
    this.container.querySelector('[data-draft]').hidden = false;
    this.container.querySelector('[data-title]').textContent = project.title;
    const text = this.container.querySelector('[data-text]');
    text.replaceChildren(...project.sources[0].data.split('\n\n').map(value => {
      const p = document.createElement('p'); p.textContent = value; return p;
    }));
    const seconds = Math.ceil(compileSession(personalSession(project)).totalDuration / 1000);
    this.container.querySelector('[data-duration]').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} at 160 words per minute`;
    this.container.querySelector('[data-action="keep"]').textContent = this.kept.has(project.id) ? 'Kept' : 'Keep';
    this.container.querySelector('[data-action="previous"]').hidden = !this.history.length;
    this.container.querySelector('[data-form="revise"]').hidden = true;
    this.refreshUnkept();
  }

  savedPieces() {
    return new Map(MemoryCore.getWorkshopBlueprints().map(p => [p.id, canonicalPersonal(p.project || p)]));
  }

  refreshUnkept() {
    const saved = this.savedPieces();
    this.container.dataset.unkept = String([...this.history, this.draft].filter(Boolean)
      .some(p => saved.get(p.id) !== canonicalPersonal(p)));
  }

  async generate(revise) {
    if (this.writing) return;
    this.invalidate();
    const operation = this.operation;
    const parent = revise ? this.draft : null;
    const field = name => this.container.querySelector(`[name="${name}"]`).value.trim();
    const thought = field('thought'), detail = field('detail'), instruction = field('instruction');
    if (revise ? (!parent || !instruction || instruction.length > 500)
      : (!thought || thought.length > 500 || detail.length > 500)) {
      this.status('Please use 1–500 characters, with optional detail up to 500 characters.'); return;
    }
    this.controller = new AbortController();
    this.setWriting(true);
    this.status('Writing… You can cancel or leave this page.');
    try {
      const result = await this.request(revise
        ? { mode: 'revise', parent: { title: parent.title, paragraphs: parent.sources[0].data.split('\n\n') }, instruction }
        : { mode: 'create', thought, ...(detail ? { detail } : {}) }, { signal: this.controller.signal });
      if (operation !== this.operation) return;
      this.setDraft(createPersonalProject(result, parent));
      // Release reload protection for submitted inputs, never for edits typed
      // while the provider was working.
      for (const [name, submitted] of revise ? [['instruction', instruction]] : [['thought', thought], ['detail', detail]]) {
        if (field(name) === submitted) this.container.querySelector(`[name="${name}"]`).value = '';
      }
      this.status('Your draft is ready. Nothing has been saved.');
    } catch (error) {
      if (operation === this.operation) this.status(error.message || 'The writer is unavailable.');
    } finally {
      if (operation === this.operation) { this.controller = null; this.setWriting(false); }
    }
  }

  async importFile(file) {
    if (this.writing) return;
    this.invalidate();
    const operation = this.operation;
    try {
      if (file.size > 65536) throw new Error('Personal reading imports are limited to 64 KiB.');
      const text = await file.text();
      if (operation !== this.operation) return;
      const { project, notice } = importPersonalProject(text);
      // An import collision must be refused before it appears as a usable draft.
      const { guardPersonalOverwrite } = await import('../core/personal-identity.js');
      if (operation !== this.operation) return;
      guardPersonalOverwrite(MemoryCore.getWorkshopBlueprints().map(p => p.project || p), project);
      this.setDraft(project); this.status(notice);
    } catch (error) { if (operation === this.operation) this.status(error.message); }
  }

  async act(action) {
    if (action === 'home' || action === 'vault') { this.invalidate(); this.onNavigate(action === 'home' ? 'portal' : 'vault', action === 'vault' ? { section: 'custom' } : undefined); return; }
    if (action === 'cancel') { this.invalidate(); this.status('Request cancelled. This attempt may still count against your limit. Your existing draft is still available.'); return; }
    if (!this.draft) return;
    if (this.writing && (action === 'start' || action === 'previous')) return;
    if (action === 'change') {
      this.container.querySelector('[data-form="revise"]').hidden = false;
      this.container.querySelector('[name="instruction"]').focus(); return;
    }
    if (action === 'previous') {
      this.invalidate(); const previous = this.history.pop();
      if (previous) { this.draft = previous; this.showDraft(); this.status('Previous version restored.'); } return;
    }
    const operation = ++this.actionOperation, project = this.draft;
    try {
      if (action === 'keep') {
        let saved;
        try { saved = await MemoryCore.saveWorkshopBlueprintAsync(project); } catch { /* Show recovery actions below. */ }
        // A committed save is recorded even when a later action owns the status.
        if (saved) this.kept.add(project.id);
        if (operation !== this.actionOperation || this.draft !== project) {
          if (saved && this.draft) this.showDraft();
          return;
        }
        if (!saved) throw new Error('This browser could not keep the piece. You can still copy or export it.');
        this.showDraft(); this.status('Kept in this browser’s Vault.');
      } else if (action === 'start') {
        const started = await this.onCreateSession(project);
        // Navigation owns cancellation; returning false keeps the original text visible.
        if (started !== true && this.draft === project) this.status('Playback could not start. Your full text is still available here.');
      } else if (action === 'copy') {
        await navigator.clipboard.writeText(readablePersonalText(project));
        if (operation === this.actionOperation) this.status(this.writing ? 'Copied. Your revision is still being written.' : 'Copied.');
      } else if (action === 'export-text' || action === 'export-json') {
        await exportPersonalProject(project, action === 'export-text' ? 'text' : 'json');
      }
    } catch (error) { if (operation === this.actionOperation) this.status(error.message || 'This action could not be completed. Your text is still available.'); }
  }
}
