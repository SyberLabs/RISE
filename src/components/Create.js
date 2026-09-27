import { requestPersonalPiece } from '../core/personal-piece-client.js';
import { createPersonalProject, validatePersonalProject, importPersonalProject, personalSession, exportPersonalProject, readablePersonalText } from '../core/personal-project.js';
import { compileSession } from '../core/session-compiler.js';
import { MemoryCore } from '../core/memory.js';
import './Create.css';

export class Create {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onCreateSession = options.onCreateSession || (async () => false);
    this.request = options.request || requestPersonalPiece;
    this.operation = 0;
    this.generation = 0;
    this.history = [];
    this.kept = new Set();
    this.render();
    this.update(options.data);
  }

  render() {
    this.container.innerHTML = `<main class="personal-create">
      <nav><button data-action="home">Home</button><button data-action="vault">Vault</button></nav>
      <h1>Create a personal reading</h1>
      <p>A thought can become a short original piece. You can read the whole text before deciding what to keep.</p>
      <form data-form="create">
        <label>Your thought <textarea name="thought" maxlength="500" required rows="3"></textarea></label>
        <label>Optional detail <textarea name="detail" maxlength="500" rows="2"></textarea></label>
        <p class="personal-disclosure">When you submit, the configured writer (Qwen through OpenRouter) receives your thought and detail. For a revision it receives the current piece and your instruction. RISE does not store this content on its server. Keep saves the piece in this browser; it does not save your thought, detail, or revision instruction.</p>
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
  // Actions (Keep, Copy, Start, export, import) and paid generation have separate
  // ownership: an action must never cancel a request that is already being paid for.
  invalidate() { ++this.operation; }
  cancelGeneration() {
    ++this.generation; this.controller?.abort(); this.controller = null; this.setWriting(false);
  }
  setWriting(busy) {
    this.writing = busy;
    for (const button of this.container.querySelectorAll('form [type="submit"]')) button.disabled = busy;
  }
  navigationIntent() { this.invalidate(); this.cancelGeneration(); }
  deactivate() { this.invalidate(); this.cancelGeneration(); }
  destroy() { this.invalidate(); this.cancelGeneration(); this.container.onclick = null; }
  update(data) {
    if (data?.project) {
      this.invalidate(); this.cancelGeneration();
      // Opening another kept piece starts a new history; "previous" never crosses pieces.
      if (this.draft?.provenance?.compositionId !== data.project?.provenance?.compositionId) {
        this.history = []; this.draft = null;
      }
      try { this.setDraft(validatePersonalProject(data.project)); }
      catch (error) { this.status(error.message); }
    }
  }

  setDraft(project) {
    if (this.draft && this.draft.id !== project.id) this.history.push(this.draft);
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
    // Read by the stale-build guard: only an unkept draft blocks automatic reloads.
    this.container.querySelector('.personal-create').dataset.unsaved = String(!this.kept.has(project.id));
    this.container.querySelector('[data-action="previous"]').hidden = !this.history.length;
    this.container.querySelector('[data-form="revise"]').hidden = true;
  }

  async generate(revise) {
    this.cancelGeneration();
    const generation = this.generation;
    const parent = revise ? this.draft : null;
    const field = name => this.container.querySelector(`[name="${name}"]`).value.trim();
    const thought = field('thought'), detail = field('detail'), instruction = field('instruction');
    if (revise ? (!parent || !instruction || instruction.length > 500)
      : (!thought || thought.length > 500 || detail.length > 500)) {
      this.status('Please use 1–500 characters, with optional detail up to 500 characters.'); return;
    }
    this.controller = new AbortController();
    this.setWriting(true);
    this.status('Writing… Cancelling or leaving this page discards this attempt; it still counts toward your writing limit.');
    try {
      const result = await this.request(revise
        ? { mode: 'revise', parent: { title: parent.title, paragraphs: parent.sources[0].data.split('\n\n') }, instruction }
        : { mode: 'create', thought, ...(detail ? { detail } : {}) }, { signal: this.controller.signal });
      if (generation !== this.generation) return;
      this.setWriting(false); this.controller = null;
      this.setDraft(createPersonalProject(result, parent));
      this.container.querySelector('[name="instruction"]').value = '';
      this.status('Your draft is ready. Nothing has been saved.');
    } catch (error) {
      if (generation !== this.generation) return;
      this.setWriting(false); this.controller = null;
      this.status(error.message || 'The writer is unavailable.');
    }
  }

  async importFile(file) {
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
    if (action === 'home' || action === 'vault') { this.invalidate(); this.cancelGeneration(); this.onNavigate(action === 'home' ? 'portal' : 'vault', action === 'vault' ? { section: 'custom' } : undefined); return; }
    if (action === 'cancel') {
      if (!this.writing) return;
      this.cancelGeneration();
      this.status('Stopped waiting. This attempt still counts toward your writing limit. Your existing draft is still available.');
      return;
    }
    if (!this.draft) return;
    if (action === 'change') {
      this.container.querySelector('[data-form="revise"]').hidden = false;
      this.container.querySelector('[name="instruction"]').focus(); return;
    }
    if (action === 'previous') {
      this.invalidate(); const previous = this.history.pop();
      if (previous) { this.draft = previous; this.showDraft(); this.status('Previous version restored.'); } return;
    }
    this.invalidate();
    const operation = this.operation, project = this.draft;
    try {
      if (action === 'keep') {
        const saved = await MemoryCore.saveWorkshopBlueprintAsync(project);
        if (operation !== this.operation) return;
        if (!saved) throw new Error('keep');
        this.kept.add(project.id); this.showDraft(); this.status('Kept in this browser’s Vault.');
      } else if (action === 'start') {
        const started = await this.onCreateSession(project);
        // Navigation owns cancellation; returning false keeps the original text visible.
        if (started !== true && this.draft === project) this.status('Playback could not start. Your full text is still available here.');
      } else if (action === 'copy') {
        await navigator.clipboard.writeText(readablePersonalText(project));
        if (operation === this.operation) this.status('Copied.');
      } else if (action === 'export-text' || action === 'export-json') {
        await exportPersonalProject(project, action === 'export-text' ? 'text' : 'json');
      }
    } catch (error) {
      if (operation !== this.operation) return;
      this.status(action === 'keep'
        ? `This browser could not keep the piece${/different content|cannot be overwritten/u.test(error?.message || '') ? `: ${error.message}` : '.'} You can still copy or export it.`
        : 'This action could not be completed. Your text is still available.');
    }
  }
}
