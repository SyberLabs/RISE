// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaneHost } from './room-panes.js';

let container;
let home;

class WithUpdate {
  constructor(el, data) { this.el = el; this.data = data; }
  update(data) { this.data = data; }
  activate() {}
  deactivate() {}
  destroy() {}
}

class WithoutUpdate {
  constructor(el, data) { this.el = el; this.data = data; }
  activate() {}
  deactivate() {}
  destroy() {}
}

function makeHost(extra = {}) {
  return createPaneHost({
    container,
    home,
    loaders: {
      a: async () => ({ Pane: WithUpdate }),
      b: async () => ({ Pane: WithoutUpdate }),
      broken: async () => { throw new Error('chunk missing'); }
    },
    factories: {
      a: (el, { Pane }, data) => new Pane(el, data),
      b: (el, { Pane }, data) => new Pane(el, data),
      broken: () => null
    },
    ...extra
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  home = document.createElement('section');
  container.appendChild(home);
  document.body.appendChild(container);
});

describe('createPaneHost', () => {
  it('hides the home and every other pane when a pane shows', async () => {
    const host = makeHost();
    await host.show('a', {});
    expect(home.hidden).toBe(true);
    await host.show('b', {});
    expect(container.querySelector('[data-pane="a"]').hidden).toBe(true);
    expect(container.querySelector('[data-pane="b"]').hidden).toBe(false);
    expect(host.active).toBe('b');
    await host.show(null);
    expect(home.hidden).toBe(false);
    expect(host.active).toBe(null);
  });

  it('hands new data to a pane with update, and remounts one without', async () => {
    const host = makeHost();
    await host.show('a', { x: 1 });
    const a = host.instance('a');
    const update = vi.spyOn(a, 'update');
    await host.show('a', { x: 2, pane: 'a' });
    expect(update).toHaveBeenCalledWith({ x: 2 });
    expect(host.instance('a')).toBe(a);

    await host.show('b', { y: 1, z: 2 });
    const b = host.instance('b');
    await host.show('b', { z: 2, y: 1 });
    expect(host.instance('b')).toBe(b);
    const destroy = vi.spyOn(b, 'destroy');
    await host.show('b', { y: 3 });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(host.instance('b')).not.toBe(b);
  });

  it('opens the pane named under data.pane on update', async () => {
    const host = makeHost();
    await host.update({ pane: 'a', x: 1 });
    expect(host.active).toBe('a');
    expect(host.instance('a').data).toEqual({ x: 1 });
  });

  it('forwards deactivate to the active pane, and the keyboard to the room when no pane shows', async () => {
    const onKeyboard = vi.fn();
    const host = makeHost({ onKeyboard });
    host.activate();
    expect(onKeyboard).toHaveBeenLastCalledWith(true);
    await host.show('a', {});
    expect(onKeyboard).toHaveBeenLastCalledWith(false);
    const deactivate = vi.spyOn(host.instance('a'), 'deactivate');
    host.deactivate();
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('destroys every mounted pane', async () => {
    const host = makeHost();
    await host.show('a', {});
    await host.show('b', {});
    const a = vi.spyOn(host.instance('a'), 'destroy');
    const b = vi.spyOn(host.instance('b'), 'destroy');
    host.destroy();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(host.instance('a')).toBe(null);
  });

  it('leaves the active pane alone and rejects when a loader throws', async () => {
    const host = makeHost();
    host.activate();
    await host.show('a', {});
    const activate = vi.spyOn(host.instance('a'), 'activate');
    await expect(host.show('broken', {})).rejects.toThrow('chunk missing');
    expect(host.active).toBe('a');
    expect(container.querySelector('[data-pane="a"]').hidden).toBe(false);
    expect(activate).toHaveBeenCalledTimes(1);
  });
});
