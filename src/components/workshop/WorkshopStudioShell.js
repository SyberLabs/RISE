import { escapeHtml } from '../../core/sanitize.js';

function renderStudioHeader(view) {
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
              aria-controls="studio-reading-inspector">
        <span class="studio-kicker">Conductor</span>
        <strong data-reading-summary>${view.wpm} WPM · ${escapeHtml(view.chunkMode)}</strong>
        <small data-reading-curve>${escapeHtml(view.curve)} curve</small>
      </button>

      <div class="workshop-actions studio-transport" role="toolbar" aria-label="Sequence actions">
        <button type="button" class="btn-ghost workshop-reset-btn"
                data-action="reset-workshop" id="reset-workshop-btn">Reset</button>
        <button type="button" class="btn-ghost" data-action="export-curator-context"
                title="Export capability JSON for the Live Curator">Export context</button>
        <button type="button" class="btn-ghost" data-action="export-experience-program"
                title="Export rise.experience-program.v1">Export score</button>
        <button type="button" class="btn-ghost" data-action="import-experience-program"
                title="Import a proposed Experience Program">Import score</button>
        <button type="button" class="btn-ghost" data-action="save-draft" id="save-draft-btn">Save</button>
        <button type="button" class="btn-secondary" data-action="preview">Preview</button>
        <button type="submit" class="btn-primary" id="create-btn"
                form="workshop-form" disabled>Run</button>
      </div>
    </header>`;
}

function renderSourceLibrary(view) {
  return `
    <section class="studio-library-section studio-source-library" aria-labelledby="studio-sources-title">
      <div class="studio-section-heading">
        <div><span class="studio-kicker">Reading</span><h2 id="studio-sources-title">Sources</h2></div>
        <span class="studio-count" data-studio-source-count="number">${view.sourceCount}</span>
      </div>
      <div class="sources-list" id="sources-list">
        ${view.sourceCount === 0 ? '<div class="empty-sources text-fog">No sources added yet</div>' : view.sourcesHtml}
      </div>
      <div class="source-actions studio-inline-actions">
        <button type="button" class="btn-secondary" data-action="open-browser">Browse</button>
        <button type="button" class="btn-secondary" data-action="import-file">Import</button>
      </div>
    </section>`;
}

function renderUnifiedAssetLibrary(view) {
  return `
    <section class="studio-library-section studio-visual-library" aria-labelledby="studio-assets-title">
      <div class="studio-section-heading">
        <div><span class="studio-kicker">Unified registry</span><h2 id="studio-assets-title">Assets</h2></div>
        <div class="studio-asset-add-actions" ${view.activeAssetLane === 'visual' ? '' : 'hidden'}>
          <button type="button" class="btn-secondary btn-compact" data-action="upload-image">+ Project</button>
          <button type="button" class="btn-secondary btn-compact" data-action="upload-global-image">+ Shared</button>
        </div>
      </div>
      <div class="studio-library-tabs" role="tablist" aria-label="Asset library">
        <button type="button" class="studio-library-tab ${view.activeAssetLane === 'visual' ? 'active' : ''}"
                role="tab" aria-selected="${view.activeAssetLane === 'visual'}"
                tabindex="${view.activeAssetLane === 'visual' ? '0' : '-1'}"
                aria-controls="studio-visual-library-panel" data-action="set-asset-lane" data-asset-lane="visual">Visual</button>
        <button type="button" class="studio-library-tab ${view.activeAssetLane === 'audio' ? 'active' : ''}"
                role="tab" aria-selected="${view.activeAssetLane === 'audio'}"
                tabindex="${view.activeAssetLane === 'audio' ? '0' : '-1'}"
                aria-controls="studio-audio-library-panel" data-action="set-asset-lane" data-asset-lane="audio">Audio</button>
      </div>

      <div id="studio-visual-library-panel" role="tabpanel" ${view.activeAssetLane === 'visual' ? '' : 'hidden'}>
        <label class="studio-asset-search">
          <span class="sr-only">Search visual assets</span>
          <input type="search" id="visual-asset-search" class="input" placeholder="Search visual assets"
                 value="${escapeHtml(view.assetSearch)}" />
        </label>
        <div class="studio-asset-filters" aria-label="Visual asset filters">${view.assetFiltersHtml}</div>
        <p class="input-note text-fog">Passage visuals belong to selected text. Whole-reading visuals shape the complete reading.</p>
        <div class="visual-drop-zone" id="visual-drop-zone">
        <div class="studio-asset-registry" id="visual-assets-list" role="listbox"
             aria-label="Visual assets" aria-live="polite">${view.assetsHtml}</div>
        </div>
        <div id="studio-visual-presentation">${view.visualPresentationHtml}</div>
      </div>

      <div id="studio-audio-library-panel" role="tabpanel" ${view.activeAssetLane === 'audio' ? '' : 'hidden'}>
        <div class="studio-audio-library-heading">
          <p class="input-note text-fog">Use beds and swells on selected passages, or keep one as the whole-reading atmosphere.</p>
          <button type="button" class="btn-secondary btn-compact" data-action="upload-personal-swell">+ Entry swell</button>
        </div>
        <div class="studio-audio-registry" id="audio-assets-list" role="listbox"
             aria-label="Audio assets">${view.audioAssetsHtml}</div>
        <div class="studio-personal-audio">
          <span class="studio-kicker">Personal entry events</span>
          <div class="personal-swell-list" id="personal-swell-list"></div>
        </div>
      </div>
    </section>`;
}

function renderAssetLibrary(view) {
  return `
    <aside class="studio-pane studio-asset-library" aria-label="Asset Library" data-studio-pane="assets">
      <div class="studio-pane-title"><span><span class="studio-eyebrow">Library</span><strong>Source & Assets</strong></span>
        <button type="button" class="btn-ghost btn-compact studio-pane-close" data-action="close-studio-surface"
                aria-label="Close Asset Library">Close</button></div>
      ${renderSourceLibrary(view)}
      ${renderUnifiedAssetLibrary(view)}
    </aside>`;
}

function renderScoreCanvas(view) {
  return `
    <main class="studio-pane studio-score-canvas" aria-labelledby="studio-score-title" data-studio-pane="score">
      <div class="studio-canvas-heading">
        <div><span class="studio-eyebrow">Media Score</span><h2 id="studio-score-title">Compose against the text</h2></div>
      </div>
      ${view.scoreHtml}
    </main>`;
}

function renderIntentOptions(view) {
  return ['focus', 'learning', 'exploration', 'reflection', 'custom'].map(intent => `
    <label class="radio">
      <input type="radio" name="intent" value="${intent}" ${view.intent === intent ? 'checked' : ''} />
      <span class="radio-label text-capitalize">${intent}</span>
    </label>`).join('');
}

function renderReadingInspector(view) {
  return `
    <details class="studio-inspector-section" id="studio-reading-inspector" open>
      <summary><span>Reading</span><span class="font-mono" data-reading-inspector-summary>${view.wpm} WPM</span></summary>
      <div class="studio-inspector-body">
        <div class="studio-reading-metrics">
          <span><small>Material</small><strong data-reading-word-count>${view.wordCount} words</strong></span>
          <span><small>Estimate</small><strong data-reading-duration>${escapeHtml(view.readingDuration)}</strong></span>
        </div>
        <div class="input-group">
          <label class="input-label" for="wpm-slider">
            <span>Pacing</span><span class="input-label-value font-mono" id="wpm-value">${view.wpm} WPM</span>
          </label>
          <div class="slider-container">
            <input type="range" id="wpm-slider" class="slider" min="100" max="500"
                   value="${view.wpm}" step="10" aria-describedby="wpm-chamber-note" />
          </div>
          <div class="config-notice text-fog font-mono" id="wpm-chamber-note">◇ Adjustable in Chamber</div>
        </div>
        <div class="input-group">
          <label class="input-label">Pacing Curve</label>
          <div class="curve-options studio-compact-options">
            ${['flat', 'induction', 'ascent', 'wave', 'climax'].map(curve => `
              <button type="button" class="curve-btn ${view.curve === curve ? 'active' : ''}"
                      data-curve="${curve}" aria-pressed="${view.curve === curve}">
                <span class="curve-icon">${view.curveIcon(curve)}</span>
                <span class="curve-label text-capitalize">${curve}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Chunking</label>
          <div class="chunk-options">
            ${['word', 'phrase', 'sentence'].map(mode => `
              <button type="button" class="chunk-btn ${view.chunkMode === mode ? 'active' : ''}"
                      data-chunk="${mode}" aria-pressed="${view.chunkMode === mode}">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}
          </div>
        </div>
      </div>
    </details>`;
}

function renderAudioInspector(view) {
  return `
    <details class="studio-inspector-section" id="studio-audio-inspector">
      <summary><span>Atmosphere</span><span class="text-capitalize" data-audio-summary>${escapeHtml(view.audioSummary)}</span></summary>
      <div class="studio-inspector-body">
        <div class="studio-atmosphere-summary">
          <span><small>Continuous bed</small><strong data-audio-bed>${escapeHtml(view.audioBedLabel)}</strong></span>
          <span><small>Entry event</small><strong data-audio-entry>${escapeHtml(view.audioEntryLabel)}</strong></span>
        </div>
        <div id="studio-audio-selection">${view.audioSelectionHtml}</div>
      </div>
    </details>`;
}

function renderInspector(view) {
  return `
    <aside class="studio-pane studio-inspector" aria-label="Inspector" data-studio-pane="inspector">
      <div class="studio-pane-title"><span><span class="studio-eyebrow">Inspector</span><strong>Sequence Defaults</strong></span>
        <button type="button" class="btn-ghost btn-compact studio-pane-close" data-action="close-studio-surface"
                aria-label="Close Inspector">Close</button></div>
      <details class="studio-inspector-section studio-project-section" id="studio-project-inspector" open>
        <summary><span>Project</span><span data-studio-source-count="label">${view.sourceCount} source${view.sourceCount === 1 ? '' : 's'}</span></summary>
        <div class="studio-inspector-body">
          <div class="input-group">
            <label class="input-label" for="session-title">Sequence Title</label>
            <input type="text" id="session-title" class="input" placeholder="Untitled Sequence" value="${escapeHtml(view.title)}" />
          </div>
          <div class="input-group"><label class="input-label">Category</label><div class="intent-options">${renderIntentOptions(view)}</div></div>
        </div>
      </details>
      ${renderReadingInspector(view)}
      ${view.visualInspectorHtml}
      ${renderAudioInspector(view)}
    </aside>`;
}

export function renderWorkshopStudioShell(view) {
  return `
    <div class="workshop workshop-studio" role="main"
         data-studio-viewport="${escapeHtml(view.studioViewport)}"
         data-studio-surface="${escapeHtml(view.studioSurface)}">
      ${renderStudioHeader(view)}
      <nav class="studio-responsive-nav" aria-label="Studio surfaces">
        ${[
          ['score', 'Score'], ['sources', 'Sources'], ['assets', 'Assets'], ['inspector', 'Inspector']
        ].map(([id, label]) => `<button type="button" data-action="show-studio-surface"
          data-studio-surface-target="${id}" data-focus-key="studio-nav:${id}"
          aria-pressed="${view.studioSurface === id}">${label}</button>`).join('')}
      </nav>
      <div class="workshop-content studio-content">
        <form class="workshop-form studio-grid" id="workshop-form">
          ${renderAssetLibrary(view)}
          ${renderScoreCanvas(view)}
          ${renderInspector(view)}
          <input type="file" id="file-import-input" accept=".txt" hidden />
          <input type="file" id="image-import-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
          <input type="file" id="global-import-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
          <input type="file" id="personal-swell-input" accept="audio/mpeg,audio/wav" hidden />
          <input type="file" id="program-import-input" accept="application/json,.json" hidden />
        </form>
      </div>
      <div id="studio-selection-actions">${view.selectionActionHtml}</div>
      <div id="studio-selection-popover">${view.selectionPopoverHtml}</div>
      <div class="sr-only" id="studio-announcer" role="status" aria-live="polite" aria-atomic="true"></div>
    </div>`;
}
