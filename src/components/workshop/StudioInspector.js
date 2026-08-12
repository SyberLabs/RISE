import { escapeHtml } from '../../core/sanitize.js';

export function renderStudioInspector(view) {
  return `
    <aside class="studio-pane studio-inspector" aria-label="Contextual Inspector" data-studio-pane="inspector">
      <div class="studio-pane-title"><span><span class="studio-eyebrow">Inspector</span><strong>${escapeHtml(view.inspectorLabel)}</strong></span>
        <button type="button" class="btn-ghost btn-compact studio-pane-close" data-action="close-studio-surface" aria-label="Close Inspector">Close</button></div>
      <div id="studio-contextual-inspector" class="studio-contextual-inspector" data-inspector-kind="${escapeHtml(view.inspectorKind)}">
        ${view.inspectorHtml}
      </div>
    </aside>`;
}
