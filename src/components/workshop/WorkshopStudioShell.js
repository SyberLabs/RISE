import { escapeHtml } from '../../core/sanitize.js';
import { renderStudioTransport } from './StudioTransport.js';
import { renderAssetLibrary } from './AssetLibrary.js';
import { renderScoreCanvas } from './ScoreCanvas.js';
import { renderStudioInspector } from './StudioInspector.js';

export function renderWorkshopStudioShell(view) {
  return `
    <div class="workshop workshop-studio" role="main"
         data-studio-viewport="${escapeHtml(view.studioViewport)}"
         data-studio-surface="${escapeHtml(view.studioSurface)}">
      ${renderStudioTransport(view)}
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
          ${renderStudioInspector(view)}
          <input type="file" id="file-import-input" accept=".txt,.md" hidden />
          <input type="file" id="image-import-input" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,.mp4" hidden />
          <input type="file" id="personal-focal-import-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
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
