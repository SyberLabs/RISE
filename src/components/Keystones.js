import {
  KEYSTONE_MANIFESTS,
  keystonePath,
  resolveKeystone
} from '../content/keystones.js';
import { archiveReviewEnabled } from '../content/archive/index.js';
import { escapeHtml } from '../core/sanitize.js';

/** Public threshold for the three canonical launch compositions. */
export class Keystones {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onLaunch = options.onLaunch || (() => {});
    this.initialSlug = options.initialSlug || null;
    this.reviewMode = archiveReviewEnabled();
    this.results = new Map();
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
        ? (result.ready ? 'Ready' : result.reviewable && this.reviewMode ? 'Review build' : 'In preparation')
        : 'Checking…';
      const canLaunch = result?.ready || (this.reviewMode && result?.reviewable);
      const blockers = result?.blockers || [];
      const details = blockers.length
        ? `<ul class="keystone-blockers">${blockers.map(blocker =>
          `<li>${escapeHtml(blocker.message)}</li>`).join('')}</ul>`
        : '<p class="keystone-ready-note">Exact source, media, and recitation admitted.</p>';
      return `
        <article class="keystone-card${active ? ' is-target' : ''}" id="keystone-${item.slug}">
          <div class="keystone-number">0${index + 1}</div>
          <p class="keystone-axis">${escapeHtml(item.axis)}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="keystone-author">${escapeHtml(item.author)} × ${escapeHtml(item.relation)}</p>
          <p class="keystone-state" data-state="${result?.ready ? 'ready' : 'pending'}">${status}</p>
          ${details}
          <button class="btn-primary keystone-launch" data-keystone="${item.slug}"
            ${canLaunch ? '' : 'disabled'}>
            ${result?.ready ? 'Begin' : canLaunch ? 'Review without missing media' : 'Not yet admitted'}
          </button>
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
    const settled = await Promise.all(KEYSTONE_MANIFESTS.map(async item => [
      item.slug,
      await resolveKeystone(item.slug, { allowIncomplete: this.reviewMode })
    ]));
    if (this._refreshToken !== token) return;
    this.results = new Map(settled);
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
