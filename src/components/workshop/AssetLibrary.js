import { escapeHtml } from '../../core/sanitize.js';

export function renderAssetLibrary(view) {
  return `
    <aside class="studio-pane studio-asset-library" aria-label="Source and Asset Library" data-studio-pane="assets">
      <div class="studio-pane-title"><span><span class="studio-eyebrow">Library</span><strong>Source & Assets</strong></span>
        <button type="button" class="btn-ghost btn-compact studio-pane-close" data-action="close-studio-surface"
                aria-label="Close Library">Close</button></div>
      <section class="studio-library-section studio-source-library" aria-labelledby="studio-sources-title">
        <div class="studio-section-heading">
          <div><span class="studio-kicker">Reading</span><h2 id="studio-sources-title">Sources</h2></div>
          <span class="studio-count" data-studio-source-count="number">${view.sourceCount}</span>
        </div>
        <div class="sources-list" id="sources-list">
          ${view.sourceCount === 0 ? '<div class="empty-sources text-fog">No sources added yet</div>' : view.sourcesHtml}
        </div>
        <div class="source-actions studio-inline-actions studio-choice-grid studio-choice-grid-2">
          <button type="button" class="btn-secondary" data-action="open-browser">Browse</button>
          <button type="button" class="btn-secondary" data-action="import-file">Import</button>
        </div>
      </section>

      <section class="studio-library-section studio-visual-library" aria-labelledby="studio-assets-title">
        <div class="studio-section-heading">
          <div><span class="studio-kicker">Unified registry</span><h2 id="studio-assets-title">Assets</h2></div>
          <div class="studio-asset-add-actions studio-choice-grid studio-choice-grid-2" ${view.activeAssetLane === 'visual' ? '' : 'hidden'}>
            <button type="button" class="btn-secondary btn-compact" data-action="upload-image">+ Project media</button>
            <button type="button" class="btn-secondary btn-compact" data-action="upload-global-image">+ Shared</button>
          </div>
        </div>
        <div class="studio-library-tabs studio-choice-grid studio-choice-grid-2" role="tablist" aria-label="Asset library">
          <button type="button" class="studio-library-tab ${view.activeAssetLane === 'visual' ? 'active' : ''}"
                  role="tab" aria-selected="${view.activeAssetLane === 'visual'}" tabindex="${view.activeAssetLane === 'visual' ? '0' : '-1'}"
                  aria-controls="studio-visual-library-panel" data-action="set-asset-lane" data-asset-lane="visual">Visual</button>
          <button type="button" class="studio-library-tab ${view.activeAssetLane === 'audio' ? 'active' : ''}"
                  role="tab" aria-selected="${view.activeAssetLane === 'audio'}" tabindex="${view.activeAssetLane === 'audio' ? '0' : '-1'}"
                  aria-controls="studio-audio-library-panel" data-action="set-asset-lane" data-asset-lane="audio">Audio</button>
        </div>

        <div id="studio-visual-library-panel" class="studio-library-lane-panel" role="tabpanel" ${view.activeAssetLane === 'visual' ? '' : 'hidden'}>
          <div class="studio-asset-tools">
            <label class="studio-asset-search"><span class="sr-only">Search visual assets</span>
              <input type="search" id="visual-asset-search" class="input" placeholder="Search visual assets" value="${escapeHtml(view.assetSearch)}" />
            </label>
            <div class="studio-asset-filters studio-choice-grid studio-choice-grid-6" aria-label="Visual asset filters">${view.assetFiltersHtml}</div>
            <p class="input-note text-fog">Passage visuals score selected text. Whole-reading visuals establish the sequence field.</p>
          </div>
          <div class="studio-asset-registry-scroll visual-drop-zone" id="visual-drop-zone">
            <div class="studio-asset-registry" id="visual-assets-list" role="listbox" aria-label="Visual assets" aria-live="polite">${view.assetsHtml}</div>
          </div>
          <div id="studio-visual-presentation">${view.visualPresentationHtml}</div>
        </div>

        <div id="studio-audio-library-panel" class="studio-library-lane-panel" role="tabpanel" ${view.activeAssetLane === 'audio' ? '' : 'hidden'}>
          <div class="studio-audio-library-heading">
            <p class="input-note text-fog">Passage clips score selected text. Atmosphere remains the whole-reading default.</p>
            <button type="button" class="btn-secondary btn-compact" data-action="upload-personal-swell">+ Personal audio</button>
          </div>
          <div class="studio-asset-registry-scroll">
            <div class="studio-audio-registry" id="audio-assets-list" role="listbox" aria-label="Audio assets">${view.audioAssetsHtml}</div>
          </div>
          <div class="studio-personal-audio"><span class="studio-kicker">Personal audio</span>
            <div class="personal-swell-list" id="personal-swell-list"></div></div>
        </div>
      </section>
    </aside>`;
}
