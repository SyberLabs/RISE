import { sameData } from '../core/same-data.js';

/**
 * The panes of a room (the Library, Make): each program mounts once,
 * lazily, into its own child element, and only one shows at a time.
 *
 * `loaders[name]()` imports a pane's module; `factories[name](element,
 * module, data)` builds its instance. `home` is the room's own content,
 * hidden while a pane shows. `onKeyboard(on)` turns the room's own keyboard
 * handler on or off: it is on only while the room is active and no pane is.
 *
 * Shown again with new data, a pane that has `update(data)` receives it;
 * one without is destroyed and built again, so a Rosary opened through its
 * door is a door Rosary. The router changes a pane in place by calling the
 * room's `update(data)`, with the pane's name under `data.pane`.
 */
export function createPaneHost({ container, loaders, factories, home = null, onKeyboard = () => {} }) {
  // name -> { element, instance, data }
  const panes = new Map();
  let active = null;
  let activated = false;

  const instance = name => panes.get(name)?.instance || null;

  async function mount(name, data) {
    let entry = panes.get(name);
    if (!entry) {
      const element = document.createElement('div');
      element.className = 'room-pane';
      element.dataset.pane = name;
      element.hidden = true;
      container.appendChild(element);
      entry = { element, instance: null, data: null };
      panes.set(name, entry);
    }
    if (entry.instance && !sameData(entry.data, data)) {
      if (typeof entry.instance.update === 'function') {
        await entry.instance.update(data);
      } else {
        entry.instance.destroy?.();
        entry.instance = null;
      }
    }
    if (!entry.instance) {
      const module = await loaders[name]();
      entry.instance = factories[name](entry.element, module, data);
    }
    entry.data = data;
  }

  const host = {
    get active() {
      return active;
    },

    instance,

    /** Show a pane, or the room's home when `name` is not a pane. */
    async show(name, data = {}) {
      if (!loaders[name]) name = null;
      const { pane: _pane, ...next } = data || {};
      if (active === name && (!name || sameData(panes.get(name)?.data, next))) return;

      const wasActive = activated;
      host.deactivate();
      try {
        if (name) await mount(name, next);
        active = name;
        if (home) home.hidden = Boolean(name);
        for (const [paneName, pane] of panes) pane.element.hidden = paneName !== name;
      } finally {
        if (wasActive) host.activate();
      }
    },

    update(data) {
      return host.show(data?.pane, data);
    },

    activate() {
      if (activated) return;
      activated = true;
      if (active) instance(active)?.activate?.();
      else onKeyboard(true);
    },

    deactivate() {
      if (!activated) return;
      activated = false;
      if (active) instance(active)?.deactivate?.();
      else onKeyboard(false);
    },

    destroy() {
      host.deactivate();
      for (const pane of panes.values()) pane.instance?.destroy?.();
      panes.clear();
    }
  };
  return host;
}
