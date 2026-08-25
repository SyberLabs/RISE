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
const touch = el => {
  const event = new Event('pointerup', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  el.dispatchEvent(event);
};
const descend = (...ids) => ids.forEach(id => click(node(id)));   // re-query each step
const lastPatch = () => onChange.mock.calls.at(-1)[0];
const unmount = () => {
  nav?.destroy();
  nav?.container.remove();
  nav = null;
};

afterEach(() => {
  unmount();
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

  it('makes Fit one canonical text-material transaction', () => {
    const onTextMaterialTransaction = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount({}, { onTextMaterialTransaction });
    click(node('size'));
    click(nav.container.querySelector('[data-font-size="fit"]'));
    expect(onTextMaterialTransaction).toHaveBeenCalledOnce();
    expect(onTextMaterialTransaction).toHaveBeenCalledWith(expect.objectContaining({
      settings: { chamberFace: 'literary', fontSize: 'fit', chamberMask: false },
      temporal: { chunkMode: 'word', recitation: false },
      visualConfig: expect.objectContaining({
        visualMode: 'interlocution',
        interlocution: expect.objectContaining({ presentation: 'continuous' })
      })
    }));
    expect(window.rise.handleSettingsChange).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps Accent available before Fit and opens visual-mask engine benches at Fit', () => {
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount();
    click(node('ink'));
    expect(nav.container.querySelector('[data-word-fill="accent"]')).toBeTruthy();
    expect(nav.container.querySelector('[data-word-fill="procedural:attractor"]')?.getAttribute('aria-disabled'))
      .toBe('true');

    window.rise.settings.fontSize = 'fit';
    click(node('ink'));
    click(nav.container.querySelector('[data-word-fill="procedural:attractor"]'));
    expect(nav.container.querySelector('[data-sub="system"][data-val="thomas"]')).toBeTruthy();
  });

  it('keeps Accent available at every Face and Size, and toggles it to Plain in one transaction', () => {
    const onTextMaterialTransaction = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount({}, { onTextMaterialTransaction });

    for (const chamberFace of ['literary', 'display', 'thick', 'jp']) {
      for (const fontSize of ['small', 'medium', 'large', 'fit']) {
        window.rise.settings = { chamberFace, fontSize };
        nav.render();
        click(node('ink'));
        expect(nav.container.querySelector('[data-word-fill="accent"]')).toBeTruthy();
        expect(nav.container.querySelector('[data-word-fill="plain"]')).toBeNull();
      }
    }

    window.rise.settings = { chamberFace: 'literary', fontSize: 'medium' };
    nav.render();
    const accent = nav.container.querySelector('[data-word-fill="accent"]');
    expect(accent?.textContent.trim()).toBe('Accent');
    click(accent);

    expect(onTextMaterialTransaction).toHaveBeenCalledWith(expect.objectContaining({
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      temporal: null,
      visualConfig: expect.objectContaining({
        interlocution: expect.objectContaining({ wordFill: { mode: 'accent' } })
      })
    }));
    click(nav.container.querySelector('[data-word-fill="accent"]'));
    expect(onTextMaterialTransaction).toHaveBeenLastCalledWith(expect.objectContaining({
      visualConfig: expect.objectContaining({
        interlocution: expect.objectContaining({ wordFill: { mode: 'plain' } })
      })
    }));
  });

  it('explains a locked mask and activates Thick + Fit as one transaction', () => {
    const onTextMaterialTransaction = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount({}, { onTextMaterialTransaction });
    click(node('ink'));
    const mask = nav.container.querySelector('[data-word-fill="same"]');
    expect(mask?.getAttribute('aria-disabled')).toBe('true');
    click(mask);
    expect(nav.container.querySelector('[role="dialog"]')?.textContent)
      .toContain('Visual masks require Thick + Fit.');
    expect(nav.container.querySelector('[data-action="use-thick-fit"]')?.textContent)
      .toBe('Use Thick + Fit');
    expect(nav.container.querySelector('.vnav-dialog p')?.textContent)
      .toBe('Bold, chamber-filling words provide enough surface for imagery.');

    click(nav.container.querySelector('[data-action="use-thick-fit"]'));
    expect(onTextMaterialTransaction).toHaveBeenCalledOnce();
    expect(onTextMaterialTransaction).toHaveBeenCalledWith({
      settings: { chamberFace: 'thick', fontSize: 'fit' },
      temporal: { chunkMode: 'word', recitation: false },
      visualConfig: expect.objectContaining({
        visualMode: 'interlocution',
        interlocution: expect.objectContaining({
          presentation: 'continuous',
          wordFill: { mode: 'same', border: 'cream' }
        })
      })
    });
  });

  it('confirms before either Face or Size invalidates an active mask', () => {
    for (const change of [
      { entry: 'face', selector: '[data-chamber-face="display"]', settings: { chamberFace: 'display', fontSize: 'fit' } },
      { entry: 'size', selector: '[data-font-size="m"]', settings: { chamberFace: 'thick', fontSize: 'medium' } }
    ]) {
      const onTextMaterialTransaction = vi.fn();
      window.rise = {
        settings: { chamberFace: 'thick', fontSize: 'fit' },
        handleSettingsChange: vi.fn()
      };
      mount({
        visualMode: 'interlocution',
        interlocution: { wordFill: { mode: 'same', border: 'accent' } }
      }, { onTextMaterialTransaction });
      click(node(change.entry));
      click(nav.container.querySelector(change.selector));
      expect(nav.container.querySelector('[role="dialog"]')?.textContent)
        .toContain('This change cannot keep the current visual mask. Continue with Accent ink?');
      click(nav.container.querySelector('[data-action="dialog-cancel"]'));
      expect(onTextMaterialTransaction).not.toHaveBeenCalled();
      expect(window.rise.handleSettingsChange).not.toHaveBeenCalled();

      click(nav.container.querySelector(change.selector));
      click(nav.container.querySelector('[data-action="dialog-confirm"]'));
      expect(onTextMaterialTransaction).toHaveBeenCalledOnce();
      expect(onTextMaterialTransaction).toHaveBeenCalledWith(expect.objectContaining({
        settings: change.settings,
        temporal: null,
        visualConfig: expect.objectContaining({
          interlocution: expect.objectContaining({ wordFill: { mode: 'accent' } })
        })
      }));
      unmount();
    }
  });

  it('renders Thick in an even 2x2 Face grid and explains it independently for hover, focus, and touch', () => {
    const reveal = [
      control => control.dispatchEvent(new Event('pointerenter')),
      control => control.focus(),
      control => touch(control)
    ];

    for (const interact of reveal) {
      window.rise = { settings: { chamberFace: 'literary', fontSize: 'medium' } };
      mount();
      click(node('face'));
      const grid = nav.container.querySelector('.vnav-face-grid .vnav-opts');
      const thick = nav.container.querySelector('[data-chamber-face="thick"]');
      expect(grid?.children).toHaveLength(4);
      expect([...grid.children].map(control => control.textContent.trim()))
        .toEqual(['Literary', 'Display', 'Thick ★', 'Japanese']);
      expect(thick?.textContent.trim()).toBe('Thick ★');
      expect(thick?.getAttribute('aria-describedby')).toBe('vnav-thick-explanation');
      expect(nav.container.querySelector('#vnav-thick-explanation')?.hidden).toBe(true);

      interact(thick);

      const liveThick = nav.container.querySelector('[data-chamber-face="thick"]');
      expect(nav.container.querySelector(`#${liveThick.getAttribute('aria-describedby')}`)?.hidden)
        .toBe(false);
      expect(nav.container.querySelector('#vnav-thick-explanation')?.textContent)
        .toBe('Thick is the mask-ready face.');
      unmount();
    }
  });

  it('keeps the revealed Thick control stable for keyboard activation', () => {
    const handleSettingsChange = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange
    };
    mount();
    click(node('face'));
    nav.container.querySelector('[data-chamber-face="thick"]').focus();

    const liveThick = nav.container.querySelector('[data-chamber-face="thick"]');
    liveThick.focus();
    expect(nav.container.querySelector('[data-chamber-face="thick"]')).toBe(liveThick);
    click(liveThick);
    expect(handleSettingsChange).toHaveBeenCalledWith('chamberFace', 'thick');
  });

  it('shows mask borders only for a valid mask and preserves the selected border when replacing its source', () => {
    window.rise = { settings: { chamberFace: 'thick', fontSize: 'fit' } };
    mount({
      visualMode: 'interlocution',
      interlocution: { wordFill: { mode: 'plain' } }
    });
    click(node('ink'));
    expect(nav.container.querySelectorAll('[data-word-fill-border]')).toHaveLength(0);
    click(nav.container.querySelector('[data-word-fill="accent"]'));
    expect(nav.container.querySelectorAll('[data-word-fill-border]')).toHaveLength(0);
    click(nav.container.querySelector('[data-word-fill="same"]'));
    expect(nav.container.querySelectorAll('[data-word-fill-border]')).toHaveLength(3);
    expect(nav.container.querySelector('[data-word-fill-border="cream"]')?.classList.contains('is-selected')).toBe(true);
    click(nav.container.querySelector('[data-word-fill-border="accent"]'));
    click(nav.container.querySelector('[data-word-fill="procedural:fractal"]'));
    expect(lastPatch().interlocution.wordFill).toMatchObject({ border: 'accent' });
  });

  it('keeps program-owned material controls read-only and explains ownership independently for hover, focus, and touch', () => {
    const explain = [
      control => control.dispatchEvent(new Event('pointerenter')),
      control => control.focus(),
      control => touch(control)
    ];

    for (const interact of explain) {
      window.rise = { settings: { chamberFace: 'thick', fontSize: 'fit' } };
      mount({}, { programInfo: { episodes: 2 } });
      click(node('ink'));
      const accent = nav.container.querySelector('[data-word-fill="accent"]');
      expect(accent?.disabled).toBe(false);
      expect(accent?.getAttribute('aria-disabled')).toBe('true');
      expect(nav.container.querySelector('[role="dialog"]')).toBeNull();

      interact(accent);

      expect(nav.container.querySelector('[role="dialog"]')?.textContent).toContain('curated program');
      unmount();
    }
  });

  it('dismisses a keyboard-opened program ownership dialog without reopening on restored focus', async () => {
    for (const close of ['cancel', 'escape', 'primary']) {
      window.rise = { settings: { chamberFace: 'thick', fontSize: 'fit' } };
      mount({}, { programInfo: { episodes: 2 } });
      click(node('ink'));
      const trigger = nav.container.querySelector('[data-word-fill="accent"]');

      trigger.focus();
      await Promise.resolve();
      const primary = nav.container.querySelector('[data-dialog-primary]');
      expect(document.activeElement).toBe(primary);

      if (close === 'cancel') {
        click(nav.container.querySelector('[data-action="dialog-cancel"]'));
      } else if (close === 'escape') {
        primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else {
        click(primary);
      }

      expect(nav.container.querySelector('[role="dialog"]')).toBeNull();
      const liveTrigger = nav.container.querySelector('[data-word-fill="accent"]');
      expect(document.activeElement).toBe(liveTrigger);

      node('face').focus();
      liveTrigger.focus();
      expect(nav.container.querySelector('[role="dialog"]')).toBeTruthy();
      unmount();
    }
  });

  it('focuses the primary dialog action and restores the live trigger after Cancel, Escape, and primary action', async () => {
    const onTextMaterialTransaction = vi.fn();
    window.rise = {
      settings: { chamberFace: 'literary', fontSize: 'medium' },
      handleSettingsChange: vi.fn()
    };
    mount({}, { onTextMaterialTransaction });
    click(node('ink'));

    for (const close of ['cancel', 'escape', 'primary']) {
      const trigger = nav.container.querySelector('[data-word-fill="same"]');
      trigger.focus();
      click(trigger);
      await Promise.resolve();

      const primary = nav.container.querySelector('[data-dialog-primary]');
      expect(document.activeElement).toBe(primary);
      if (close === 'cancel') {
        click(nav.container.querySelector('[data-action="dialog-cancel"]'));
      } else if (close === 'escape') {
        primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else {
        click(primary);
      }

      expect(nav.container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement)
        .toBe(nav.container.querySelector('[data-word-fill="same"]'));
    }
    expect(onTextMaterialTransaction).toHaveBeenCalledOnce();
  });

  it('omits Neural, Rock Garden, and Spectral from visual-mask choices', () => {
    window.rise = { settings: { chamberFace: 'thick', fontSize: 'fit' } };
    mount();
    click(node('ink'));
    expect(nav.container.textContent).not.toContain('Neural Networks');
    expect(nav.container.textContent).not.toContain('Rock Garden');
    expect(nav.container.textContent).not.toContain('Spectral Plates');
  });
});

describe('reader-facing state', () => {
  it('keeps its place and keeps focus across a choice', () => {
    // render() replaces the whole panel's innerHTML on every selection, so
    // the pane scrolled back to the top and focus fell to the body — a
    // keyboard reader was ejected from the panel on every single choice.
    mount({});
    click(nav.container.querySelector('.vnav-node[data-id="ink"]'));

    const scroller = nav.container.querySelector('.vnav-entry');
    Object.defineProperty(scroller, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 300, configurable: true });
    scroller.scrollTop = 240;

    const chip = nav.container.querySelector('[data-word-fill="accent"]');
    chip.focus();
    click(chip);

    // the same control is focused again, in a freshly built DOM
    const after = nav.container.querySelector('[data-word-fill="accent"]');
    expect(after).not.toBe(chip);                       // it really was rebuilt
    expect(document.activeElement).toBe(after);
    expect(nav.container.querySelector('.vnav-entry').scrollTop).toBe(240);
  });

  it('separates the size scale from the reading mode Fit really is', () => {
    // S, M and L are three points on one continuum. Fit is not a fourth
    // point: it forces chunking to one word and stands recitation aside.
    // Its cost also used to appear only once it was already chosen.
    mount({});
    click(nav.container.querySelector('.vnav-node[data-id="size"]'));

    const benchFor = name => [...nav.container.querySelectorAll('.vnav-bench')]
      .find(b => b.querySelector('.vnav-bench-label')?.textContent.trim() === name);
    const scale = benchFor('Scale');
    expect(scale).toBeTruthy();
    expect([...scale.querySelectorAll('.vnav-opt')].map(b => b.dataset.fontSize))
      .toEqual(['s', 'm', 'l']);
    expect(scale.querySelector('[data-font-size="fit"]')).toBeNull();

    // Fit stands on its own, still reachable, still the same control.
    const fit = nav.container.querySelector('[data-font-size="fit"]');
    expect(fit).toBeTruthy();
    expect(benchFor('Scale').contains(fit)).toBe(false);

    // and the consequence is legible BEFORE the choice, not after it
    const explained = nav.container.querySelector('.vnav-fit-consequence');
    expect(explained).toBeTruthy();
    expect(explained.hidden).toBe(false);
    expect(explained.textContent.replace(/\s+/g, ' ')).toMatch(/one at a time/i);
  });

  it('names the ink by what it gives, not by how it is drawn', () => {
    // "Visual Mask" named the mechanism, and did not even distinguish: every
    // option in the group produces a mask. What this one actually means is
    // "whatever the Field is showing".
    mount({});
    click(nav.container.querySelector('.vnav-node[data-id="ink"]'));
    const same = nav.container.querySelector('[data-word-fill="same"]');
    expect(same.textContent.trim()).toBe('Same as the Field');
    expect(nav.container.textContent).not.toContain('Visual Mask');
  });

  it('subordinates Border to the ink it modifies', () => {
    // Border is the only row that does not write data-word-fill: it is a
    // property of the choice above it, not another candidate for it.
    mount({ visualMode: 'interlocution', interlocution: { wordFill: { mode: 'pick', procedural: ['klee'] } } });
    click(nav.container.querySelector('.vnav-node[data-id="ink"]'));
    const border = [...nav.container.querySelectorAll('.vnav-bench')]
      .find(b => b.querySelector('.vnav-bench-label')?.textContent.trim() === 'Border');
    if (border) expect(border.classList.contains('is-property')).toBe(true);
  });

  it('keeps the four pool families apart in Ink', () => {
    // inkPoolOptions used to flatMap manner, subject, science and personal
    // into one undifferentiated row — a taxonomy the config already holds,
    // discarded one line before it reached the screen.
    mount({});
    click(nav.container.querySelector('.vnav-node[data-id="ink"]'));
    const labels = [...nav.container.querySelectorAll('.vnav-bench-label')]
      .map(el => el.textContent.trim());
    expect(labels).toEqual(expect.arrayContaining(
      ['By manner', 'By subject', 'Science', 'Yours']
    ));
    expect(labels).not.toContain('Pools');

    // and each family holds its own members, not a shared pile
    const benchFor = name => [...nav.container.querySelectorAll('.vnav-bench')]
      .find(b => b.querySelector('.vnav-bench-label')?.textContent.trim() === name);
    const chips = name => [...benchFor(name).querySelectorAll('.vnav-opt')]
      .map(b => b.textContent.trim());
    expect(chips('Yours')).toEqual(['Shared pool', 'This session']);
    expect(chips('Science')).toEqual(['Astronomy']);
    expect(chips('By subject')).toContain('Landscapes');
    expect(chips('By subject')).not.toContain('Shared pool');
  });

  it('offers the stream glass as a reader control, and emits it', () => {
    // The glass tile survived the port from VIP; its switch did not. The
    // renderer still honours interlocution.streamGlass and a Stance still
    // sets it, so without a control a preset can put the reading behind
    // glass and no reader can take it away.
    mount({ interlocution: { streamGlass: true } });
    const toggle = nav.container.querySelector('[data-action="stream-glass"]');
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(true);

    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lastPatch().interlocution.streamGlass).toBe(false);

    const back = nav.container.querySelector('[data-action="stream-glass"]');
    back.checked = true;
    back.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lastPatch().interlocution.streamGlass).toBe(true);
  });

  it('reopens on the glass the reading was saved with', () => {
    mount({ interlocution: { streamGlass: false } });
    expect(nav.container.querySelector('[data-action="stream-glass"]').checked).toBe(false);
  });

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
      .every(control => control.getAttribute('aria-disabled') === 'true')).toBe(true);

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
