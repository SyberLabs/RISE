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
import { MemoryCore } from '../core/memory.js';

let nav = null;
let onChange = null;

const mount = (visualConfig = {}, options = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  onChange = vi.fn();
  nav = new VisualNavigator(container, { visualConfig, onChange, ...options });
  return nav;
};
const node = id => nav.container.querySelector(`.vnav-node[data-id="${id}"]`);
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const descend = (...ids) => ids.forEach(id => click(node(id)));   // re-query each step
const lastPatch = () => onChange.mock.calls.at(-1)[0];

afterEach(() => {
  nav?.destroy();
  nav = null;
  delete window.rise;
  localStorage.removeItem('rise_global_images_v1');
  localStorage.removeItem('rise_workshop_v1');
});

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

  it('keeps Field and Text as two named groups in the root column', () => {
    mount();
    expect(nav.container.querySelector('[data-group="field"]')?.textContent).toBe('Field');
    expect(nav.container.querySelector('[data-group="text"]')?.textContent).toBe('Text');
    expect(node('face')).toBeTruthy();
    expect(node('size')).toBeTruthy();
    expect(node('ink')).toBeTruthy();
  });
});

describe('the text', () => {
  it('writes Face through the app settings seam', () => {
    const handleSettingsChange = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange
    };
    mount();
    click(node('face'));
    click(nav.container.querySelector('[data-chamber-face="display"]'));
    expect(handleSettingsChange).toHaveBeenCalledWith('chamberFace', 'display');
  });

  it('makes Fit explicit, canonicalises Gallery, and fires the temporal coupling', () => {
    const onFitRequested = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount({}, { onFitRequested });
    click(node('size'));
    click(nav.container.querySelector('[data-font-size="fit"]'));
    expect(window.rise.handleSettingsChange).toHaveBeenCalledWith('fontSize', 'fit');
    expect(onFitRequested).toHaveBeenCalledOnce();
    expect(lastPatch()).toMatchObject({
      visualMode: 'interlocution',
      interlocution: { presentation: 'continuous' }
    });
  });

  it('locks Ink until Fit and reuses an engine full style bench when opened', () => {
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount();
    click(node('ink'));
    expect(nav.container.querySelector('.vnav-text-locked')?.textContent).toContain('Size');
    expect(nav.container.querySelector('[data-word-fill="procedural:attractor"]')).toBeNull();

    window.rise.settings.fontSize = 'fit';
    click(node('ink'));
    click(nav.container.querySelector('[data-word-fill="procedural:attractor"]'));
    expect(nav.container.querySelector('[data-sub="system"][data-val="thomas"]')).toBeTruthy();
  });
});

describe('reader-facing state', () => {
  it('emits Living Text as an independent visual setting', () => {
    mount({ livingText: { enabled: false } });
    const toggle = nav.container.querySelector('[data-action="living-text"]');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lastPatch().livingText).toEqual({ enabled: true });
  });

  it('offers one Gallery cadence control and emits the chosen pace', () => {
    mount();
    descend('visual', 'gallery', 'gallery-procedural', 'fractal');
    expect(nav.container.querySelectorAll('[data-gallery-cadence]')).toHaveLength(3);
    click(nav.container.querySelector('[data-gallery-cadence="1"]'));
    expect(lastPatch().interlocution.galleryCadence).toBe(1);
  });

  it('reuses the shared Global Pool picker for an exact personal subset', () => {
    MemoryCore.saveGlobalImage('data:image/png;base64,AAAA', { name: 'Alpha' });
    MemoryCore.saveGlobalImage('data:image/png;base64,BBBB', { name: 'Beta' });
    mount({
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'personal',
        sourced: ['global-pool'],
        globalPool: { mode: 'all', assetIds: [] }
      }
    });
    descend('visual', 'gallery', 'personal');
    click(nav.container.querySelector('[data-global-pool-mode="selected"]'));
    const assets = nav.container.querySelectorAll('[data-global-asset-id]');
    expect(assets).toHaveLength(2);
    click(assets[0]);
    expect(lastPatch().interlocution.globalPool).toEqual({
      mode: 'selected', assetIds: [assets[0].dataset.globalAssetId]
    });
  });

  it('reuses saved Workshop image bundles in the Personal leaf', () => {
    const saved = MemoryCore.saveWorkshopBlueprint({
      title: 'Night garden',
      sources: [{ id: 'source-1', name: 'Source', data: 'Text.' }],
      visualConfig: { visualMode: 'off' },
      customVisuals: ['data:image/png;base64,AAAA']
    });
    mount();
    descend('visual', 'gallery', 'personal');
    const choice = nav.container.querySelector(`[data-pool="personal:${saved.id}"]`);
    expect(choice?.textContent).toContain('Night garden');
    click(choice);
    click(nav.container.querySelector('[data-action="toggle"]'));
    expect(lastPatch().interlocution.sourced).toEqual([`personal:${saved.id}`]);
  });

  it('names a curated program and makes every field-owned control read-only', () => {
    window.rise = { settings: { fontSize: 'fit' } };
    mount({
      visualMode: 'interlocution',
      livingText: { enabled: true, intensity: 0.4 },
      interlocution: {
        sourceFamily: 'collections',
        sourced: ['aic-impressionism'],
        galleryCadence: 0.5
      }
    }, { programInfo: { episodes: 4 } });
    expect(nav.container.querySelector('[data-program-lock]')?.textContent)
      .toContain('Special Collection · 4 episodes');
    descend('visual', 'gallery', 'gallery-sourced', 'by-manner');
    expect(nav.container.querySelector('[data-pool="aic-ukiyoe"]')?.disabled).toBe(true);
    expect([...nav.container.querySelectorAll('[data-gallery-cadence]')]
      .every(control => control.disabled)).toBe(true);
    expect(nav.container.querySelector('[data-action="living-text"]')?.disabled).toBe(true);

    nav.setCadence(1);
    nav.setLivingText(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(nav.getConfig()).toMatchObject({
      livingText: { enabled: true, intensity: 0.4 },
      interlocution: { galleryCadence: 0.5 }
    });

    nav.setConfig({ visualMode: 'genesis', genesis: { preset: 'harmonic', glass: true } });
    expect([...nav.container.querySelectorAll('[data-sub]')]
      .every(control => control.disabled)).toBe(true);
    expect(nav.container.querySelector('[data-action="glass"]')?.disabled).toBe(true);

    click(node('ink'));
    expect([...nav.container.querySelectorAll('[data-word-fill]')]
      .every(control => control.disabled)).toBe(true);

    nav.setConfig({
      visualMode: 'focals',
      focals: { type: 'personal', personalImage: 'data:image/png;base64,AAAA' }
    });
    expect(nav.container.querySelector('[data-action="remove-personal-focal"]')?.disabled).toBe(true);
  });

  it('releases a launch-held focal directly into its curated program', () => {
    mount({
      visualMode: 'focals',
      focals: { type: 'icon', iconId: 'icon-transfiguration' },
      interlocution: {
        sourceFamily: 'collections',
        procedural: [],
        sourced: ['chapel-gospel-transfiguration']
      }
    }, { programInfo: { episodes: 1 } });
    click(nav.container.querySelector('[data-action="release-to-program"]'));
    expect(lastPatch()).toMatchObject({
      visualMode: 'interlocution',
      focals: { type: 'standard', iconId: null },
      interlocution: { sourced: ['chapel-gospel-transfiguration'] }
    });
  });

  it('names a launch-held focal and releases it when a glyph is chosen', () => {
    mount({ visualMode: 'focals', focals: { type: 'rose', roseMode: 'verbum' } });
    expect(nav.container.querySelector('[data-held-focal]')?.textContent)
      .toContain('Rosa Mystica · Verbum');
    click(nav.container.querySelector('[data-glyph="breath"]'));
    expect(lastPatch().focals).toMatchObject({ type: 'standard', standardGlyph: 'breath' });
  });

  it('shows and removes a user-owned personal focal', () => {
    mount({
      visualMode: 'focals',
      focals: { type: 'personal', personalImage: 'data:image/png;base64,AAAA' }
    });
    expect(nav.container.querySelector('[data-personal-focal-preview]')).toBeTruthy();
    click(nav.container.querySelector('[data-action="remove-personal-focal"]'));
    expect(lastPatch().focals).toMatchObject({ type: 'personal', personalImage: null });
    expect(nav.container.querySelector('[data-input="personal-focal"]')).toBeTruthy();
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
