import {
  KEYSTONE_MANIFESTS,
  keystonePath,
  resolveKeystone
} from '../content/keystones.js';
import { archiveReviewEnabled } from '../content/archive/index.js';
import { escapeHtml } from '../core/sanitize.js';

const DISTRIBUTION_MANIFEST_PATH = '/media/keystones/distribution.json';

async function loadPublishedMp4s(signal) {
  try {
    const response = await fetch(DISTRIBUTION_MANIFEST_PATH, { signal });
    if (!response.ok) return new Map();
    const manifest = await response.json();
    if (manifest?.schema !== 'rise.keystone-distribution.v1'
      || !Array.isArray(manifest.results)) return new Map();
    const known = new Set(KEYSTONE_MANIFESTS.map(item => item.slug));
    return new Map(manifest.results
      .filter(item => item?.status === 'published'
        && known.has(item.slug)
        && /^\.\/[a-z0-9-]+\.mp4$/u.test(item.url || ''))
      .map(item => [item.slug, {
        ...item,
        url: `/media/keystones/${item.url.slice(2)}`
      }]));
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn('[Keystones] MP4 manifest unavailable:', error);
    return new Map();
  }
}

/** Public threshold for the three canonical launch compositions. */
export class Keystones {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onLaunch = options.onLaunch || (() => {});
    this.initialSlug = options.initialSlug || null;
    this.reviewMode = archiveReviewEnabled();
    this.results = new Map();
    this.publishedMp4s = new Map();
    this._controller = new AbortController();
    this.render();
    this.attachEvents();
    this.refresh();
  }

  render() {
    const cards = KEYSTONE_MANIFESTS.map((item, index) => {
      const result = this.results.get(item.slug);
      const active = item.slug === this.initialSlug;
      const status = result
        ? (result.ready
          ? 'Release certified'
          : result.admitted
            ? 'Admitted'
            : result.reviewable && this.reviewMode ? 'Review build' : 'In preparation')
        : 'Checking…';
      const canLaunch = result?.ready || result?.admitted
        || (this.reviewMode && result?.reviewable);
      const blockers = result?.blockers || [];
      const mp4 = this.publishedMp4s.get(item.slug);
      const certificationOnly = result?.admitted && blockers.length
        && blockers.every(blocker => blocker.code === 'KEYSTONE_SOURCE_UNCERTIFIED');
      const details = certificationOnly
        ? '<p class="keystone-ready-note">Editorially admitted. Exact-edition release certification remains open.</p>'
        : blockers.length
        ? `<ul class="keystone-blockers">${blockers.map(blocker =>
          `<li>${escapeHtml(blocker.message)}</li>`).join('')}</ul>`
        : '<p class="keystone-ready-note">Exact source, media, and recitation admitted.</p>';
      return `
        <article class="keystone-card${active ? ' is-target' : ''}" id="keystone-${item.slug}">
          <div class="keystone-number">0${index + 1}</div>
          <p class="keystone-axis">${escapeHtml(item.axis)}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="keystone-author">${escapeHtml(item.author)} × ${escapeHtml(item.relation)}</p>
          <p class="keystone-state" data-state="${result?.ready ? 'ready' : result?.admitted ? 'admitted' : 'pending'}">${status}</p>
          ${details}
          <button class="btn-primary keystone-launch" data-keystone="${item.slug}"
            ${canLaunch ? '' : 'disabled'}>
            ${result?.ready || result?.admitted ? 'Begin' : canLaunch ? 'Review without missing media' : 'Not yet admitted'}
          </button>
          ${mp4 ? `<a class="btn-ghost keystone-mp4" href="${escapeHtml(mp4.url)}">
            Watch full MP4
          </a>` : ''}
          <a class="keystone-route" href="${keystonePath(item.slug)}">${keystonePath(item.slug)}</a>
        </article>`;
    }).join('');

    this.container.innerHTML = `
      <main class="keystones" id="main-content">
        <header class="keystone-header">
          <button class="keystone-back" data-nav="portal" aria-label="Return to Portal">← Portal</button>
          <p class="keystone-kicker">Try RISE</p>
          <h1>Three canonical readings</h1>
          <p class="keystone-intro">The same reading instrument, composed three ways: mind, transformation, and world.</p>
        </header>
        <section class="keystone-grid" aria-label="Canonical RISE readings">${cards}</section>
        ${this.reviewMode ? '<p class="keystone-review-notice">Review environment: incomplete compositions may be inspected, but public admission remains fail-closed.</p>' : ''}
      </main>`;
  }

  attachEvents() {
    const options = { signal: this._controller.signal };
    this.container.querySelector('[data-nav="portal"]')?.addEventListener(
      'click', () => this.onNavigate('portal'), options
    );
    this.container.querySelectorAll('[data-keystone]').forEach(button => {
      button.addEventListener('click', () => this.onLaunch(button.dataset.keystone), options);
    });
  }

  async refresh() {
    const token = {};
    this._refreshToken = token;
    const [settled, publishedMp4s] = await Promise.all([
      Promise.all(KEYSTONE_MANIFESTS.map(async item => [
        item.slug,
        await resolveKeystone(item.slug, { allowIncomplete: this.reviewMode })
      ])),
      loadPublishedMp4s(this._controller.signal)
    ]);
    if (this._refreshToken !== token) return;
    this.results = new Map(settled);
    this.publishedMp4s = publishedMp4s;
    this._controller.abort();
    this._controller = new AbortController();
    this.render();
    this.attachEvents();
    if (this.initialSlug) {
      requestAnimationFrame(() => {
        this.container.querySelector(`#keystone-${this.initialSlug}`)?.focus?.();
        this.container.querySelector(`#keystone-${this.initialSlug}`)?.scrollIntoView?.({ block: 'center' });
      });
    }
  }

  activate() {}
  deactivate() {}

  destroy() {
    this._refreshToken = null;
    this._controller.abort();
  }
}
