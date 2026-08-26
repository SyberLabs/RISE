/**
 * Chapel collection tray. Names live in chapel/imagery; this only draws them.
 */
import { escapeHtml } from '../../core/sanitize.js';
import { selectionFromConfig } from '../../core/visual-taxonomy-config.js';
import {
  chapelCollectionIds,
  isChapelCollection,
  readingCollectionLabel
} from '../../content/chapel/imagery/labels.js';
import { readingCollections } from './markup.js';

export const chapelMethods = {
  renderReadingCollections() {
    if (this.programInfo) return '';
    const curated = readingCollections(this.selection.config);
    if (!curated.length && !this._chapelLaunch) return '';
    if (!this._chapelLaunch && !curated.every(isChapelCollection)) {
      return `<div class="vnav-reading-collections" role="group" aria-label="Collections curated for this reading">
        <b>From this reading</b><div class="vnav-reading-chips">${curated.map(id =>
          `<span>${escapeHtml(readingCollectionLabel(id))}</span>`).join('')}</div></div>`;
    }

    const active = curated.filter(isChapelCollection);
    const available = chapelCollectionIds().concat(['dore:all']).filter(id =>
      !active.includes(id)
      && !(id === 'dore:all' && active.some(item => item.startsWith('dore:'))));
    return `<div class="vnav-reading-collections vnav-chapel-collections" role="group"
      aria-label="Chapel collections for this reading">
      <b>From this reading</b><div class="vnav-reading-chips">${active.map(id => `
        <span>${escapeHtml(readingCollectionLabel(id))}<button type="button"
          data-chapel-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(readingCollectionLabel(id))}">×</button></span>`).join('')}
        ${available.length ? `<button type="button" class="vnav-chapel-add" data-action="chapel-add-toggle"
          aria-label="Add a Chapel collection" aria-expanded="${this._chapelTrayOpen}">+</button>` : ''}</div>
      ${available.length ? `<div class="vnav-chapel-menu" ${this._chapelTrayOpen ? '' : 'hidden'}>${available.map(id =>
        `<button type="button" data-chapel-add="${escapeHtml(id)}">+ ${escapeHtml(readingCollectionLabel(id))}</button>`).join('')}</div>` : ''}
      <p>Sacred collections for this reading. Remove one or draw another in.</p></div>`;
  },

  editChapelCollections(mutate) {
    const current = readingCollections(this.selection.config).filter(isChapelCollection);
    const next = mutate(current);
    const config = this.patch();
    config.interlocution = {
      ...(config.interlocution || {}),
      sourceFamily: next.length ? 'collections' : 'procedural',
      atriumCollections: next,
      sourced: next
    };
    this.selection = selectionFromConfig(config);
    this.emit();
    this.render();
  },
};
