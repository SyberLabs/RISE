/**
 * Read — the one room for reading (§8.45). Three panes in one container:
 *
 *   setup    the reader setup (ChamberOrbital)
 *   chamber  a compiled session in the Chamber, built by the app's
 *            chamber-session factory, the one place a Player is made
 *   live     the host of a live Current, which presents its readings in the
 *            chamber pane and keeps running while they show
 *
 * The old route ids `chamber`, `chamber-session` and `live` are aliases for
 * these panes (src/core/route-url.js). Setup and chamber once shared one
 * container and could not coexist, so showing one closes the other; the live
 * host had a container of its own and is kept.
 */

import { createPaneHost } from './room-panes.js';

const EXCLUSIVE = { setup: 'chamber', chamber: 'setup' };

export class Read {
  /**
   * @param {HTMLElement} container
   * @param {object} options
   * @param {object} options.setup    what the reader setup is given
   * @param {object} options.chamber  the operations the chamber-session factory takes
   * @param {object} options.live     what the live host is given
   * @param {object} options.load     `chamber()` and `live()` import those panes'
   *   modules; they live outside the components, so the app names them
   */
  constructor(container, { setup = {}, chamber = {}, live = {}, load = {} } = {}) {
    this.container = container;
    this.panes = createPaneHost({
      container,
      loaders: {
        setup: load.setup || (() => import('./read/ChamberOrbital.js')),
        chamber: load.chamber,
        live: load.live,
        'voice-demo': () => import('./read/VoiceDemo.js')
      },
      factories: {
        setup: (element, { ChamberOrbital }, data) => {
          const orbital = new ChamberOrbital(element, setup);
          if (data?.text) orbital.loadText(data.text, data.source || 'Library', data.config);
          return orbital;
        },
        chamber: (element, { createChamberSession }, data) => createChamberSession(chamber, element, data?.session),
        live: (element, { LiveHost }) => new LiveHost(element, live),
        'voice-demo': (element, { VoiceDemo }) => new VoiceDemo(element, {
          onBeginSession: setup.onBeginSession,
          ensureAudioEngine: chamber.ensureAudioEngine,
          getAudioEngine: chamber.getAudioEngine
        })
      }
    });
  }

  get activePane() {
    return this.panes.active;
  }

  /** The mounted instance of a pane, or null. */
  paneInstance(name) {
    return this.panes.instance(name);
  }

  /** The pane `data` names (the router's aliases always name one), else setup. */
  static paneFor(data = {}) {
    return ['setup', 'chamber', 'live', 'voice-demo'].includes(data?.pane) ? data.pane : 'setup';
  }

  async open(data = {}) {
    const name = Read.paneFor(data);
    const changed = await this.panes.show(name, data || {});
    if (EXCLUSIVE[name]) this.panes.close(EXCLUSIVE[name]);
    return changed;
  }

  /** The router's mark of a pane-hosting room (router.js, in place). */
  showPane(name, data = {}) {
    return this.open({ ...data, pane: name });
  }

  update(data) {
    return this.open(data);
  }

  /** Destroy a pane, if it still holds `instance` (see room-panes.js). */
  closePane(name, instance, options) {
    this.panes.close(name, instance, options);
  }

  handleEscape() {
    return this.paneInstance(this.activePane)?.handleEscape?.() === true;
  }

  navigationIntent() {
    this.paneInstance(this.activePane)?.navigationIntent?.();
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
