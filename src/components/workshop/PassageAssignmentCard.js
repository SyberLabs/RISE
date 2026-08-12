import { escapeHtml } from '../../core/sanitize.js';

export function renderCombinedPassageAssignment(view) {
  const conflictLane = ['visual', 'audio'].includes(view.conflictLane) ? view.conflictLane : '';
  const laneLabel = conflictLane || 'media';
  return `<section class="studio-passage-popover combined-passage-popover ${view.hasConflict ? 'has-conflict' : ''}"
      role="dialog" aria-label="Assign visual and audio to the selected passage">
    <div class="studio-passage-popover-heading">
      <span class="studio-passage-swatch is-combined" aria-hidden="true"></span>
      <p><span class="studio-kicker">Selected passage · Combined score</span>
        <strong>“${escapeHtml(view.excerpt)}${view.excerptTruncated ? '…' : ''}”</strong>
        <small>${view.hasConflict
          ? `Overlaps an existing passage ${laneLabel} clip`
          : 'Assign either lane without selecting the passage again'}</small></p>
    </div>
    <div class="studio-combined-pickers">
      <div class="studio-combined-picker ${conflictLane === 'visual' ? 'has-conflict' : ''}">
        <label class="studio-passage-picker"><span>Passage visual</span>
          <select class="input-select" data-passage-asset-picker data-focus-key="passage-asset-picker">${view.visualOptionsHtml}</select>
        </label>
        ${view.visualStyleHtml || ''}
        <button type="button" class="btn-ghost btn-compact" data-action="choose-score-asset" data-score-lane="visual">Browse visuals</button>
        ${view.canAuthorStillness && !view.hasConflict
          ? '<button type="button" class="btn-ghost btn-compact" data-action="assign-score-stillness">Intentional stillness</button>'
          : ''}
      </div>
      <div class="studio-combined-picker ${conflictLane === 'audio' ? 'has-conflict' : ''}">
        <label class="studio-passage-picker"><span>Passage audio</span>
          <select class="input-select" data-passage-audio-picker data-focus-key="passage-audio-picker">${view.audioOptionsHtml}</select>
        </label>
        <button type="button" class="btn-ghost btn-compact" data-action="choose-score-asset" data-score-lane="audio">Browse audio</button>
      </div>
    </div>
    <div class="studio-passage-actions combined-passage-actions ${view.hasConflict ? 'is-conflict' : ''}">
      <button type="button" class="btn-ghost btn-compact" data-action="cancel-score-selection">${view.exactVisual || view.exactAudio ? 'Done' : 'Cancel'}</button>
      ${view.hasConflict
        ? `<button type="button" class="btn-primary btn-compact" data-action="replace-score-overlap" data-score-lane="${escapeHtml(conflictLane || view.defaultLane)}">Replace ${laneLabel} overlap</button>`
        : `<button type="button" class="btn-secondary btn-compact" data-action="assign-score-lane" data-score-lane="visual" ${view.canAssignVisual ? '' : 'disabled'}>${view.exactVisual ? 'Visual assigned' : 'Assign visual'}</button>
          <button type="button" class="btn-primary btn-compact" data-action="assign-score-lane" data-score-lane="audio" ${view.canAssignAudio ? '' : 'disabled'}>${view.exactAudio ? 'Audio assigned' : 'Assign audio'}</button>`}
    </div>
  </section>`;
}
