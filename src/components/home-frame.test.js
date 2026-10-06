/**
 * Home's frame: six permanent regions in a fixed order, each with its hook
 * attributes. docs/product/discussions/2026-10-05-canonical-home-design.md
 * §2 names them; §7 criterion 7 is the rule this file enforces: Home's
 * structure changes only by a joint dated decision, recorded under
 * docs/product/discussions/ before the edit that changes this file. A future
 * experiment (a chooser, an object, a request) is content of the Featured
 * slot or the Field, never a new region.
 *
 * It pins the order of the regions and the hooks (data-home, data-nav,
 * data-action, class hooks), never the words, so copy changes stay cheap. It
 * guards structure that already exists: a first run passes, and a swapped,
 * added or removed region fails it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from './Home.js';
import { acceptOpenRouterKey, resetConnectionForTests } from '../core/ai-connection.js';

// The engine is stood in for; the stage's own tests hold it to its contract.
vi.mock('./reading-backdrop.js', () => ({
  ReadingStage: class { show() {} pause() {} resume() {} destroy() {} }
}));

const KEY = 'sk-or-v1-frame-test-key-0123456789';
/** A reading begun and left unfinished, as the app holds it (src/core/models.js Session). */
const held = () => ({ name: 'Meditations · Book 1', wpm: 250, totalDuration: 60_000, visualConfig: null, presentation: null });

/** The permanent regions, by selector, as §2 names them. */
const REGIONS = [
  ['field', '.home-engine[aria-hidden="true"]'],
  ['rooms', '.sl-header .home-rooms'],
  ['menu', '.sl-header .portal-menu-toggle'],
  ['window', 'main .home > .home-window'],
  ['label', '.home-featured > p.home-label'],
  ['title', '.home-featured > h1#home-title.home-title'],
  ['meta', '.home-featured > p.home-meta'],
  ['note', '.home-featured > p.home-note[role="note"]'],
  ['epigraph', '.home-featured > p.home-epigraph'],
  ['actions', 'main .home > .home-actions'],
  ['legal', '.portal-footer .portal-legal']
];

beforeEach(() => {
  sessionStorage.clear();
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => {
  resetConnectionForTests();
  document.body.innerHTML = '';
  sessionStorage.clear();
});

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const portal = new Home(container, options);
  return { portal, container };
}

/** The regions present, in document order, by name. */
function regions(container) {
  const found = REGIONS.map(([name, selector]) => [name, container.querySelector(selector)]);
  for (const [name, node] of found) expect(node, name).not.toBeNull();
  return found
    .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map(([name]) => name);
}

/** Every key under the slot, by hook, hidden ones included. */
const hooks = container => [...container.querySelectorAll('.home-actions [data-home]')].map(node => node.dataset.home);
const visible = container => [...container.querySelectorAll('.home-actions [data-home]:not([hidden])')].map(node => node.dataset.home);
const primary = container => [...container.querySelectorAll('.home .btn-primary')].map(node => node.dataset.home);

describe('the frame', () => {
  it('is the field, the header rooms and the Menu, the window, the slot, the actions and the legal line, in that order', () => {
    const { portal, container } = mount();
    expect(regions(container)).toEqual(['field', 'rooms', 'menu', 'window', 'label', 'title', 'meta', 'note', 'epigraph', 'actions', 'legal']);
    expect(container.querySelectorAll('.home-featured > *')).toHaveLength(5);
    // The Aside (p.home-about, the owners' one line) is reserved between the actions and the
    // legal line for PR 8; it joins the list above when it lands.
    expect(container.querySelector('.home-about')).toBeNull();
    portal.destroy();
  });

  it('keeps the header rooms as Library, Make and Settings hooks beside one Menu, outside the nav', () => {
    const { portal, container } = mount();
    const rooms = container.querySelector('.sl-header .home-rooms');
    expect(rooms.closest('nav')).toBeNull();
    expect([...rooms.querySelectorAll('button.home-room')].map(node => node.dataset.nav || node.dataset.action))
      .toEqual(['library', 'make', 'settings']);
    expect(container.querySelectorAll('.sl-header .portal-menu-toggle')).toHaveLength(1);
    expect(container.querySelectorAll('.sl-header nav.portal-nav')).toHaveLength(1);
    portal.destroy();
  });

  it('offers enter, roll, adjust and ask-open under the slot, enter the one primary, Ask only once connected', () => {
    const { portal, container } = mount();
    expect(hooks(container)).toEqual(['enter', 'roll', 'adjust', 'ask-open']);
    expect(visible(container)).toEqual(['enter', 'roll', 'adjust']);
    expect(primary(container)).toEqual(['enter']);
    acceptOpenRouterKey(KEY);
    expect(visible(container)).toEqual(['enter', 'roll', 'adjust', 'ask-open']);
    portal.destroy();
  });

  it('with a reading to resume offers continue, roll and ask-open, then enter on the line; Adjust withdrawn', async () => {
    acceptOpenRouterKey(KEY);
    const session = held();
    const { portal, container } = mount({ getCurrentSession: () => session });
    portal.activate();
    await vi.waitFor(() => expect(container.querySelector('.home-actions > .home-line')).not.toBeNull());
    expect(visible(container)).toEqual(['continue', 'roll', 'ask-open', 'enter']);
    expect(primary(container)).toEqual(['continue']);
    expect(container.querySelector('.home-actions [data-home="adjust"]').hidden).toBe(true);
    expect(container.querySelector('.home-actions [data-home="enter"]').classList.contains('home-line')).toBe(true);
    expect(regions(container)).toEqual(['field', 'rooms', 'menu', 'window', 'label', 'title', 'meta', 'note', 'epigraph', 'actions', 'legal']);
    portal.destroy();
  });
});
