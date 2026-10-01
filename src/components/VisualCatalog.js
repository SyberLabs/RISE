import { queryVisualCatalog, admitCatalogVisual } from '../core/visual-catalog.js';
import { safeUrl } from '../core/sanitize.js';
import { stillQueue } from './visual-navigator/preview.js';
import './VisualCatalog.css';

const NO_DRAWING = 'Drawing is unavailable on this device. The reading can continue without imagery.';

function canDraw(env) {
  try {
    const win = env.window ?? env;
    const doc = env.document ?? win.document;
    return Boolean(doc?.createElement?.('canvas')?.getContext?.('2d'));
  } catch {
    return false;
  }
}

export class VisualCatalog {
  constructor(container, { search = globalThis.location?.search ?? '', onNavigate = () => {}, env = globalThis } = {}) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.capabilities = Object.freeze({ canvas: canDraw(env) });
    this.search = search instanceof URLSearchParams
      ? search.get('q') || ''
      : (typeof search === 'string' ? new URLSearchParams(search).get('q') || '' : '');
    this.destroyed = false;
    this.previewController = null;
    this.render();
  }

  render() {
    this.container.replaceChildren();
    const main = document.createElement('main');
    main.className = 'visual-catalog';
    main.setAttribute('aria-labelledby', 'visual-catalog-title');

    const back = document.createElement('a');
    back.href = '/';
    back.textContent = 'Back to RISE';
    back.addEventListener('click', event => {
      event.preventDefault();
      this.onNavigate('portal');
    });
    main.append(back);

    const title = document.createElement('h1');
    title.id = 'visual-catalog-title';
    title.textContent = 'Visual catalog';
    main.append(title);
    const intro = document.createElement('p');
    intro.textContent = 'Explore procedural visuals as specimens. Attractor and Klee can open a live reading; other visuals remain specimen previews.';
    main.append(intro);

    const searchLabel = document.createElement('label');
    searchLabel.htmlFor = 'visual-catalog-search';
    searchLabel.textContent = 'Search visuals';
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'visual-catalog-search';
    search.maxLength = 200;
    search.value = this.search;
    search.addEventListener('input', () => {
      this.search = search.value;
      this.renderCards();
    });
    main.append(searchLabel, search);
    if (!this.capabilities.canvas) {
      const note = document.createElement('p');
      note.className = 'visual-catalog__capability';
      note.textContent = NO_DRAWING;
      main.append(note);
    }
    this.cards = document.createElement('section');
    this.cards.className = 'visual-catalog__cards';
    this.cards.setAttribute('aria-label', 'Procedural visuals');
    main.append(this.cards);
    this.container.append(main);
    this.renderCards();
  }

  renderCards() {
    if (!this.cards || this.destroyed) return;
    this.previewController?.abort();
    this.previewController = null;
    const results = queryVisualCatalog({
      query: this.search,
      capabilities: this.capabilities,
      includeUnavailable: true
    });
    this.cards.replaceChildren();
    for (const item of results) {
      const card = document.createElement('article');
      card.className = 'visual-catalog__card';
      card.dataset.visualId = item.id;
      const heading = document.createElement('h2');
      heading.textContent = item.name;
      card.append(heading);
      const description = document.createElement('p');
      description.textContent = item.description;
      card.append(description);
      const role = document.createElement('p');
      role.className = 'visual-catalog__status';
      role.textContent = 'Specimen preview';
      card.append(role);
      const parameters = document.createElement('p');
      const ranges = Object.entries(item.parameters).map(([name, range]) =>
        `${name}: default ${range.default}; allowed ${range.minimum} to ${range.maximum}.`
      );
      parameters.textContent = ranges.length ? `${item.parameterDescription} ${ranges.join(' ')}` : item.parameterDescription;
      card.append(parameters);
      const cost = document.createElement('p');
      cost.textContent = 'Performance cost: not measured.';
      card.append(cost);

      if (!this.capabilities.canvas) {
        const unavailable = document.createElement('p');
        unavailable.textContent = NO_DRAWING;
        card.append(unavailable);
      }
      const admission = item.liveVisual
        ? admitCatalogVisual(item.id, this.capabilities)
        : { status: 'refused', code: 'NOT_LIVE_SURFACE' };
      if (admission.status === 'accepted') {
        role.textContent = 'Specimen preview and live opening';
        const link = document.createElement('a');
        link.href = `/live?catalog=${encodeURIComponent(item.id)}`;
        link.textContent = 'Open as a live reading';
        card.append(link);
      } else {
        const specimen = document.createElement('p');
        specimen.className = 'visual-catalog__specimen';
        specimen.textContent = item.liveVisual ? 'Specimen only on this device.' : 'Specimen only; no live opening is admitted.';
        card.append(specimen);
      }

      const preview = document.createElement('div');
      preview.className = 'visual-catalog__preview';
      preview.setAttribute('aria-live', 'polite');
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.dataset.preview = item.id;
      previewButton.textContent = 'Preview specimen';
      previewButton.disabled = !this.capabilities.canvas;
      previewButton.addEventListener('click', () => { void this.preview(item.id, preview, previewButton); });
      card.append(previewButton, preview);
      this.cards.append(card);
    }
    if (!results.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No visuals match this search.';
      this.cards.append(empty);
    }
  }

  async preview(id, slot, button) {
    this.previewController?.abort();
    const controller = new AbortController();
    this.previewController = controller;
    button.disabled = true;
    button.textContent = 'Preparing preview…';
    const key = `catalog:specimen:${id}`;
    const url = await stillQueue.request(key, async () => {
      const { visualCortex } = await import('../visuals/visual-cortex.js');
      return (await visualCortex.renderLeafStill(id))?.url;
    }, { serial: true, signal: controller.signal });
    if (this.destroyed || controller.signal.aborted || this.previewController !== controller) return;
    this.previewController = null;
    button.disabled = false;
    button.textContent = 'Preview specimen';
    const safe = safeUrl(url || '');
    if (!safe) {
      slot.textContent = 'This preview is unavailable.';
      return;
    }
    const image = document.createElement('img');
    image.src = safe;
    image.alt = `${id} procedural specimen`;
    slot.replaceChildren(image);
  }

  deactivate() {
    this.previewController?.abort();
    this.previewController = null;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.deactivate();
    this.container.replaceChildren();
  }
}
