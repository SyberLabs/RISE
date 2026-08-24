/**
 * The navigator, walked the way a reader walks it.
 *
 * The model has its own tests; these press the buttons and read what reaches
 * `onChange`. What is guarded is the seam: that descending the columns opens
 * the right entry, that the one rule holds under real clicks, and that every
 * change emits the `visualConfig` the Chamber will actually receive.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';

let nav = null;
let onChange = null;

const mount = (visualConfig = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  onChange = vi.fn();
  nav = new VisualNavigator(container, { visualConfig, onChange });
  return nav;
};
const node = id => nav.container.querySelector(`.vnav-node[data-id="${id}"]`);
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const descend = (...ids) => ids.forEach(id => click(node(id)));   // re-query each step
const lastPatch = () => onChange.mock.calls.at(-1)[0];

afterEach(() => { nav?.destroy(); nav = null; });

describe('walking the tree', () => {
  it('opens with the two roots and no entry', () => {
    mount();
    expect(node('off')).toBeTruthy();
    expect(node('visual')).toBeTruthy();
    expect(nav.container.querySelector('.vnav-empty')).toBeTruthy();
  });

  it('descends Visual → Dynamic → Attractor and opens its bench', () => {
    mount();
    descend('visual', 'dynamic', 'attractor');
    const entry = nav.container.querySelector('.vnav-entry');
    expect(entry.querySelector('h3').textContent).toBe('Attractor');
    // Its three benches, from the shared definitions.
    const labels = [...entry.querySelectorAll('.vnav-bench-label')].map(l => l.textContent);
    expect(labels).toEqual(['System', 'Filament', 'Form']);
  });
});

describe('the one rule, under real clicks', () => {
  it('enables an exclusive Dynamic field and emits its mode', () => {
    mount();
    descend('visual', 'dynamic', 'attractor');
    click(nav.container.querySelector('[data-action="toggle"]'));
    expect(lastPatch()).toMatchObject({ visualMode: 'attractor' });
    expect(nav.selection.enabled.has('attractor')).toBe(true);
  });

  it('accumulates Gallery sources into a Blend', () => {
    mount();
    descend('visual', 'gallery', 'gallery-procedural', 'fractal');
    click(nav.container.querySelector('[data-action="toggle"]'));   // fractal on
    descend('visual', 'gallery', 'gallery-procedural', 'turrell');
    click(nav.container.querySelector('[data-action="toggle"]'));   // turrell on — now a blend
    expect([...nav.selection.enabled].sort()).toEqual(['fractal', 'turrell']);
    expect(nav.container.querySelector('.vnav-field').textContent).toContain('Blend');
    expect(lastPatch().interlocution.sourceFamily).toBe('procedural');   // both procedural, one kind
  });

  it('a Dynamic field clears a standing Gallery', () => {
    mount();
    descend('visual', 'gallery', 'gallery-procedural', 'fractal');
    click(nav.container.querySelector('[data-action="toggle"]'));
    descend('visual', 'dynamic', 'klee');
    click(nav.container.querySelector('[data-action="toggle"]'));
    expect([...nav.selection.enabled]).toEqual(['klee']);
    expect(lastPatch()).toMatchObject({ visualMode: 'genesis' });
  });
});

describe('substyles reach the config', () => {
  it('changes a filament and emits it', () => {
    mount({ visualMode: 'attractor', attractor: { system: 'aizawa', palette: 'white', form: 'mirror' } });
    // Boot opened Attractor because it was enabled.
    const gold = nav.container.querySelector('[data-sub="palette"][data-val="gold"]');
    expect(gold).toBeTruthy();
    click(gold);
    expect(lastPatch().attractor.palette).toBe('gold');
  });

  it('toggles the Genesis glass tile', () => {
    mount({ visualMode: 'genesis', genesis: { preset: 'harmonic', glass: true } });
    const glass = nav.container.querySelector('[data-action="glass"]');
    expect(glass.checked).toBe(true);
    glass.checked = false;
    glass.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lastPatch().genesis.glass).toBe(false);
  });

  it('picks a Sourced pool and writes it into sourced[]', () => {
    mount();
    descend('visual', 'gallery', 'gallery-sourced', 'by-manner');
    click(nav.container.querySelector('[data-action="toggle"]'));    // enable the leaf
    const pool = nav.container.querySelector('[data-pool="aic-ukiyoe"]');
    expect(pool).toBeTruthy();
    click(pool);
    expect(lastPatch().interlocution.sourced).toContain('aic-ukiyoe');
  });
});

describe('reopening a saved reading', () => {
  it('arrives on the field it was saved in', () => {
    mount({ visualMode: 'genesis', genesis: { preset: 'gravitational', glass: false } });
    expect(nav.selection.enabled.has('klee')).toBe(true);
    expect(nav.container.querySelector('.vnav-entry h3').textContent).toBe('Genesis');
    // The saved preset survives to the config it would re-emit.
    click(nav.container.querySelector('[data-sub="preset"][data-val="chaotic"]'));
    expect(lastPatch().genesis).toMatchObject({ preset: 'chaotic', glass: false });
  });
});
