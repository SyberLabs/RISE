/**
 * Make — the one room for authoring (§8.44). The Workshop, the Vault, the
 * Scriptorium, the Visual Lab and the Visual Catalog each open as a tab,
 * mounted lazily on first show and kept while the reader moves between them.
 */

import { roomHeader } from './room-chrome.js';
import { createPaneHost } from './room-panes.js';
import './Make.css';

const TABS = [
  ['workshop', 'Workshop'],
  ['vault', 'Vault'],
  ['scriptorium', 'Scriptorium'],
  ['visual-lab', 'Visual Lab'],
  ['visual-catalog', 'Visual Catalog']
];

const LOADERS = {
  workshop: () => import('./make/Workshop.js'),
  vault: () => import('./make/Vault.js'),
  scriptorium: () => import('./make/Scriptorium.js'),
  'visual-lab': () => import('./make/VisualLab.js'),
  'visual-catalog': () => import('./make/VisualCatalog.js')
};

/**
 * One factory per tab. `capabilities` is what the app hands that tab
 * (route-manifest.js, `tabCapabilities`); `data` is the address's data
 * (a Vault section, a catalog search, a Workshop blueprint).
 */
const FACTORIES = {
  workshop: (el, { Workshop }, data, capabilities) => {
    const workshop = new Workshop(el, capabilities);
    workshop.update(data);
    return workshop;
  },
  vault: (el, { Vault }, data, capabilities) => new Vault(el, {
    ...capabilities, initialSection: data?.section
  }),
  scriptorium: (el, { Scriptorium }, _data, capabilities) => {
    const room = new Scriptorium(el, capabilities);
    room.mount();
    return room;
  },
  'visual-lab': (el, { VisualLab }, data, capabilities) => new VisualLab(el, {
    ...capabilities, recipe: data?.recipe || null
  }),
  'visual-catalog': (el, { VisualCatalog }, data, capabilities) => new VisualCatalog(el, {
    ...capabilities, search: data?.search ?? globalThis.location?.search ?? ''
  })
};

const DEFAULT_TAB = 'workshop';

export class Make {
  constructor(container, { onNavigate = () => {}, tabCapabilities = {} } = {}) {
    this.container = container;
    this.onNavigate = onNavigate;
    container.innerHTML = `
      <div class="make-room">
        ${roomHeader({ back: 'Home', backClass: 'make-back' })}
        <nav class="make-nav nav" aria-label="Make">
          ${TABS.map(([name, label]) => `<button class="nav-item" type="button" data-tab="${name}">${label}</button>`).join('')}
        </nav>
        <div class="make-tabs"></div>
      </div>
    `;
    container.querySelector('.make-back').addEventListener('click', () => this.onNavigate('portal'));
    container.querySelector('.make-nav').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]')?.dataset.tab;
      if (tab && tab !== this.activeTab) this.onNavigate('make', { pane: tab });
    });
    this.panes = createPaneHost({
      container: container.querySelector('.make-tabs'),
      loaders: LOADERS,
      factories: Object.fromEntries(Object.entries(FACTORIES).map(([name, create]) => [
        // `embedded`: Make's header is the way home, so a tab draws none.
        name, (el, module, data) => create(el, module, data, { ...tabCapabilities[name], embedded: true })
      ]))
    });
  }

  get activeTab() {
    return this.panes.active;
  }

  /** The mounted instance of a tab, or null. */
  tabInstance(name) {
    return this.panes.instance(name);
  }

  async showTab(name, data = {}) {
    const changed = await this.panes.show(name, data);
    for (const button of this.container.querySelectorAll('.make-nav [data-tab]')) {
      const current = button.dataset.tab === this.activeTab;
      button.classList.toggle('active', current);
      if (current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    return changed;
  }

  /** The router's mark of a pane-hosting room (router.js, in place). */
  showPane(name, data) {
    return this.showTab(name, data);
  }

  /**
   * Router entry, re-entry and a move between tabs. The tab is `data.pane`.
   * Entered again on the same address, the open tab still gets its
   * re-entry refresh (the Vault's list, the Scriptorium's estimates).
   */
  async update(data = {}) {
    const tab = LOADERS[data?.pane] ? data.pane : DEFAULT_TAB;
    const { pane: _pane, ...rest } = data || {};
    if (!(await this.showTab(tab, rest))) await this.tabInstance(tab)?.update?.(rest);
  }

  activate() {
    this.panes.activate();
  }

  deactivate() {
    this.panes.deactivate();
  }

  destroy() {
    this.panes.destroy();
  }
}
