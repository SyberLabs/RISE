import { escapeHtml } from '../../core/sanitize.js';

export function renderStudioTransport(view) {
  return `
    <header class="workshop-header studio-header">
      <div class="studio-header-primary">
        <button class="btn-ghost" type="button" data-action="back">
          <span class="icon">←</span><span>Portal</span>
        </button>
        <div class="studio-brand">
          <span class="studio-eyebrow">Workshop</span>
          <h1>Composition Studio</h1>
        </div>
      </div>

      <section class="workshop-sequence-manager studio-project-switcher"
               aria-labelledby="workshop-sequences-label">
        <div class="sequence-manager-copy">
          <label class="input-label" id="workshop-sequences-label"
                 for="workshop-sequence-select">Sequence</label>
          <p class="input-note text-fog" id="workshop-sequence-status">${escapeHtml(view.editorStatus)}</p>
        </div>
        <select class="input-select" id="workshop-sequence-select"
                aria-describedby="workshop-sequence-status">${view.sequenceOptions}</select>
      </section>

      <button type="button" class="studio-conductor" data-action="focus-reading-inspector"
              aria-controls="studio-contextual-inspector">
        <span class="studio-kicker">Conductor</span>
        <strong data-reading-summary>${view.wpm} WPM · ${escapeHtml(view.chunkMode)}</strong>
        <small data-reading-curve>${escapeHtml(view.curve)} curve</small>
      </button>

      <div class="studio-command-cluster">
        <details class="studio-project-menu">
          <summary class="btn-ghost">Project</summary>
          <div class="studio-project-menu-panel studio-choice-grid studio-choice-grid-6" role="group" aria-label="Project commands">
            <button type="button" class="btn-ghost workshop-reset-btn" data-action="reset-workshop" id="reset-workshop-btn">Reset</button>
            <button type="button" class="btn-ghost" data-action="export-curator-context">Export context</button>
            <button type="button" class="btn-ghost" data-action="export-curator-prompt">Export prompt</button>
            <button type="button" class="btn-ghost" data-action="export-experience-program">Export score</button>
            <button type="button" class="btn-ghost" data-action="import-experience-program">Import score</button>
            <button type="button" class="btn-ghost" data-action="show-project-inspector">Details</button>
          </div>
        </details>
        <div class="workshop-actions studio-transport studio-primary-actions" role="toolbar" aria-label="Primary sequence actions">
          <button type="button" class="btn-ghost" data-action="save-draft" id="save-draft-btn">Save</button>
          <button type="button" class="btn-secondary" data-action="preview">Preview</button>
          <button type="submit" class="btn-primary" id="create-btn" form="workshop-form" disabled>Run</button>
        </div>
      </div>
    </header>`;
}
