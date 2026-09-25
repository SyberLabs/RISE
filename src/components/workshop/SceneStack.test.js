/**
 * The Scene Stack is a view: every press becomes one call on its api, and
 * nothing it shows is its own opinion of the sequence.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIVIDE_OFFER_WORDS, SceneStack, snapPace } from './SceneStack.js';

let stack = null;

const scene = (id, index, extra = {}) => ({
  id, index, name: `Scene ${id}`, excerpt: `Words of ${id}.`, words: 3,
  written: true, editable: true, visual: null, sound: null, layers: 0, ...extra
});

function mount({ scenes = [], ...overrides } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const state = { scenes, pace: { wpm: 200, chunkMode: 'word' } };
  const api = {
    scenes: () => state.scenes,
    sceneText: id => `The whole text of ${id}.`,
    title: () => 'My sequence',
    dirty: () => true,
    pace: () => state.pace,
    sequences: () => [{ id: 'bp-1', title: 'An older one' }],
    soundOptions: () => [{ id: 'soundscape:aurora', name: 'Aurora' }, { id: 'tone:deep', name: 'Deep' }],
    visualConfig: () => ({}),
    pickableLeaves: () => new Set(['off', 'fractal']),
    back: vi.fn(),
    addWritten: vi.fn(() => ({ ok: true })),
    divideAndAdd: vi.fn(),
    openLibrary: vi.fn(),
    importFile: vi.fn(),
    editScene: vi.fn(() => ({ ok: true })),
    removeScene: vi.fn(),
    moveScene: vi.fn(),
    setSceneVisual: vi.fn(() => ({ ok: true })),
    setSceneSound: vi.fn(),
    setPace: vi.fn(patch => { state.pace = { ...state.pace, ...patch }; }),
    rename: vi.fn(),
    openSequence: vi.fn(),
    save: vi.fn(),
    exportJson: vi.fn(),
    importJson: vi.fn(),
    playScene: vi.fn(),
    playAll: vi.fn(),
    reset: vi.fn(),
    openStudio: vi.fn(),
    ...overrides
  };
  const pickers = [];
  class FakePicker {
    constructor(el, options) {
      this.el = el;
      this.options = options;
      this.destroy = vi.fn();
      pickers.push(this);
    }
  }
  stack = new SceneStack(host, api, { Picker: FakePicker });
  return { api, host, state, pickers };
}

const $ = selector => stack.host.querySelector(selector);
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const type = (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  vi.useRealTimers();
  stack?.destroy();
  stack?.host.remove();
  stack = null;
});

describe('an empty sequence', () => {
  it('offers one verb and two doors, and nothing else', () => {
    mount();
    const buttons = [...stack.host.querySelectorAll('.scenes-list button')].map(b => b.textContent.trim());
    expect(buttons).toEqual(['Write the first scene', 'From the Library', 'From a file']);
    expect($('[data-sa="play-all"]').disabled).toBe(true);
  });

  it('writing a scene hands the words to the Workshop', () => {
    const { api } = mount();
    click($('[data-sa="write"]'));
    type($('[data-write-draft]'), 'Light enters form.');
    expect($('[data-write-count]').textContent).toBe('3 words');
    click($('[data-sa="write-done"]'));
    expect(api.addWritten).toHaveBeenCalledWith('Light enters form.');
    expect($('.scene-sheet')).toBeNull();
  });

  it('a refused scene says why and keeps the words', () => {
    mount({ addWritten: vi.fn(() => ({ ok: false, message: 'Write something first.' })) });
    click($('[data-sa="write"]'));
    type($('[data-write-draft]'), '   ');
    click($('[data-sa="write-done"]'));
    expect($('.scene-error').textContent).toBe('Write something first.');
    expect($('[data-write-draft]')).toBeTruthy();
  });

  it('a long paste is offered as several scenes', () => {
    const { api } = mount();
    click($('[data-sa="write"]'));
    const long = Array.from({ length: DIVIDE_OFFER_WORDS + 5 }, (_, i) => `w${i}`).join(' ');
    expect($('[data-write-divide]').hidden).toBe(true);
    type($('[data-write-draft]'), long);
    expect($('[data-write-divide]').hidden).toBe(false);
    click($('[data-sa="write-divide"]'));
    expect(api.divideAndAdd).toHaveBeenCalledWith(long);
  });

  it('the Library and a file are the other doors', () => {
    const { api } = mount();
    click($('[data-sa="library"]'));
    click($('[data-sa="file"]'));
    expect(api.openLibrary).toHaveBeenCalled();
    expect(api.importFile).toHaveBeenCalled();
  });
});

describe('a stack of scenes', () => {
  const two = () => [
    scene('a', 0, { visual: { assetId: 'procedural:fractal', name: 'Fractal Flames', whole: true, passages: 0 } }),
    scene('b', 1, { written: false, editable: false, sound: { assetId: 'soundscape:aurora', name: 'Aurora', whole: true, passages: 0 } })
  ];

  it('each card shows its words, its visual and its sound', () => {
    mount({ scenes: two() });
    const cards = [...stack.host.querySelectorAll('.scene-card')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Words of a.');
    expect(cards[0].textContent).toContain('Fractal Flames');
    expect(cards[0].textContent).toContain('Same as the sequence');
    expect(cards[1].textContent).toContain('Aurora');
    expect(cards[0].querySelector('.scene-card-open').getAttribute('aria-label')).toBe('Scene 1 of 2: Scene a');
  });

  it('▶ plays one scene; Play plays them all', () => {
    const { api } = mount({ scenes: two() });
    click(stack.host.querySelectorAll('[data-sa="play-scene"]')[1]);
    expect(api.playScene).toHaveBeenCalledWith('b');
    click($('[data-sa="play-all"]'));
    expect(api.playAll).toHaveBeenCalled();
  });

  it('a scene opens full screen and returns to the stack', () => {
    mount({ scenes: two() });
    click($('.scene-card[data-scene-id="a"] .scene-card-open'));
    expect($('.scene-view').getAttribute('aria-label')).toBe('Scene 1: Scene a');
    expect($('[data-scene-editor]').value).toBe('The whole text of a.');
    click($('[data-sa="close-scene"]'));
    expect($('.scene-view')).toBeNull();
  });

  it('a written scene saves its new words on the way out', () => {
    const { api } = mount({ scenes: two() });
    click($('.scene-card[data-scene-id="a"] .scene-card-open'));
    type($('[data-scene-editor]'), 'New words.');
    click($('[data-sa="close-scene"]'));
    expect(api.editScene).toHaveBeenCalledWith('a', 'New words.');
  });

  it('a refused edit keeps the author in the scene', () => {
    const { api } = mount({ scenes: two(), editScene: vi.fn(() => ({ ok: false, message: 'Changing its words would move them.' })) });
    click($('.scene-card[data-scene-id="a"] .scene-card-open'));
    type($('[data-scene-editor]'), 'New words.');
    click($('[data-sa="close-scene"]'));
    expect(api.editScene).toHaveBeenCalled();
    expect($('.scene-view')).toBeTruthy();
    expect($('.scene-error').textContent).toContain('move them');
  });

  it('a Library scene is read, not edited', () => {
    mount({ scenes: two() });
    click($('.scene-card[data-scene-id="b"] .scene-card-open'));
    expect($('[data-scene-editor]')).toBeNull();
    expect($('.scene-view-note').textContent).toContain('published');
  });

  it('Visual opens the picker for this scene and a choice reaches the Workshop', () => {
    const { api, pickers } = mount({ scenes: two() });
    click($('.scene-card[data-scene-id="a"] .scene-card-open'));
    click($('[data-sa="visual"]'));
    return Promise.resolve().then(() => {
      expect(pickers).toHaveLength(1);
      expect(pickers[0].options.mode).toBe('pick');
      expect([...pickers[0].options.pickable]).toEqual(['off', 'fractal']);
      pickers[0].options.onPick({ leafId: 'fractal', style: {}, pool: null });
      expect(api.setSceneVisual).toHaveBeenCalledWith('a', { leafId: 'fractal', style: {}, pool: null });
      pickers[0].options.onClose();
      expect(pickers[0].destroy).toHaveBeenCalled();
      expect($('.scene-sheet')).toBeNull();
    });
  });

  it('replacing passage visuals asks first', async () => {
    const scenes = [scene('a', 0, { visual: { assetId: 'procedural:fractal', name: 'Fractal', whole: false, passages: 3 } })];
    const { api, pickers } = mount({ scenes });
    click($('.scene-card-open'));
    click($('[data-sa="visual"]'));
    await Promise.resolve();
    pickers[0].options.onPick({ leafId: 'turrell', style: {}, pool: null });
    expect(api.setSceneVisual).not.toHaveBeenCalled();
    expect($('.scene-sheet[data-sheet="confirm"]').textContent).toContain('Replace 3 passage visuals?');
    click($('[data-sa="confirm-yes"]'));
    expect(api.setSceneVisual).toHaveBeenCalledWith('a', { leafId: 'turrell', style: {}, pool: null });
  });

  it('Sound lists the sequence first, and a choice is one call', () => {
    const { api } = mount({ scenes: two() });
    click($('.scene-card[data-scene-id="b"] .scene-card-open'));
    click($('[data-sa="sound"]'));
    const rows = [...stack.host.querySelectorAll('[data-sa="choose-sound"]')];
    expect(rows.map(r => r.querySelector('strong').textContent)).toEqual(['Same as the sequence', 'Aurora', 'Deep']);
    expect(rows[1].getAttribute('aria-pressed')).toBe('true');
    click(rows[0]);
    expect(api.setSceneSound).toHaveBeenCalledWith('b', null);
    expect($('.scene-sheet')).toBeNull();
  });

  it('the card menu moves and removes, and Remove asks', () => {
    const { api } = mount({ scenes: two() });
    click($('.scene-card[data-scene-id="a"] [data-sa="card-more"]'));
    expect($('[data-sa="move"][data-dir="-1"]').disabled).toBe(true);
    click($('[data-sa="move"][data-dir="1"]'));
    expect(api.moveScene).toHaveBeenCalledWith(0, 1);
    click($('.scene-card[data-scene-id="b"] [data-sa="card-more"]'));
    click($('[data-sa="remove"]'));
    expect(api.removeScene).not.toHaveBeenCalled();
    click($('[data-sa="confirm-yes"]'));
    expect(api.removeScene).toHaveBeenCalledWith('b');
  });

  it('a long press on the handle lifts the card and a drag reorders it', () => {
    vi.useFakeTimers();
    const { api } = mount({ scenes: two() });
    const handle = $('.scene-card[data-scene-id="a"] [data-sa="drag"]');
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }));
    vi.advanceTimersByTime(260);
    expect($('.scene-card[data-scene-id="a"]').classList.contains('is-lifted')).toBe(true);
    window.dispatchEvent(new MouseEvent('pointermove', { clientY: 190 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientY: 190 }));
    expect(api.moveScene).toHaveBeenCalledTimes(1);
    expect(api.moveScene).toHaveBeenCalledWith(0, 1);
  });

  it('a quick scroll across the handle is not a drag', () => {
    vi.useFakeTimers();
    const { api } = mount({ scenes: two() });
    const handle = $('.scene-card[data-scene-id="a"] [data-sa="drag"]');
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientY: 160 }));
    vi.advanceTimersByTime(300);
    window.dispatchEvent(new MouseEvent('pointerup', { clientY: 160 }));
    expect(api.moveScene).not.toHaveBeenCalled();
  });
});

describe('pace', () => {
  it('snaps near the marked paces and stays inside the range', () => {
    expect(snapPace(205)).toBe(200);
    expect(snapPace(230)).toBe(230);
    expect(snapPace(20)).toBe(120);
    expect(snapPace(900)).toBe(400);
  });

  it('the sheet writes pace and how the words arrive', () => {
    const { api } = mount({ scenes: [scene('a', 0)] });
    click($('[data-sa="pace"]'));
    type($('[data-pace-slider]'), '263');
    expect(api.setPace).toHaveBeenCalledWith({ wpm: 260 });
    expect($('.scenes-pace strong').textContent).toBe('260');
    click($('[data-sa="chunk"][data-chunk="phrase"]'));
    expect(api.setPace).toHaveBeenCalledWith({ chunkMode: 'phrase' });
    expect($('[data-sa="chunk"][data-chunk="phrase"]').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the sequence menu', () => {
  it('every command is one call', () => {
    const { api } = mount({ scenes: [scene('a', 0)] });
    for (const [action, fn] of [['save', 'save'], ['export', 'exportJson'],
      ['import', 'importJson'], ['studio', 'openStudio']]) {
      click($('[data-sa="more"]'));
      click($(`[data-sa="${action}"]`));
      expect(api[fn], action).toHaveBeenCalled();
    }
    click($('[data-sa="more"]'));
    click($('[data-sa="open-sequence"]'));
    expect(api.openSequence).toHaveBeenCalledWith('bp-1');
  });

  it('renames as you type, and Start over asks', () => {
    const { api } = mount({ scenes: [scene('a', 0)] });
    click($('[data-sa="more"]'));
    type($('[data-rename]'), 'Meditations at dawn');
    expect(api.rename).toHaveBeenCalledWith('Meditations at dawn');
    click($('[data-sa="reset"]'));
    expect(api.reset).not.toHaveBeenCalled();
    click($('[data-sa="confirm-yes"]'));
    expect(api.reset).toHaveBeenCalled();
  });

  it('the title shows unsaved work', () => {
    mount();
    expect($('.scenes-dirty')).toBeTruthy();
  });
});

describe('keys and focus', () => {
  it('Escape closes the sheet, then the scene', () => {
    mount({ scenes: [scene('a', 0)] });
    click($('.scene-card-open'));
    click($('[data-sa="sound"]'));
    stack.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('.scene-sheet')).toBeNull();
    expect($('.scene-view')).toBeTruthy();
    stack.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('.scene-view')).toBeNull();
  });

  it('Escape closes the picker, unless the picker used it for its own sheet', async () => {
    const { pickers } = mount({ scenes: [scene('a', 0)] });
    click($('.scene-card-open'));
    click($('[data-sa="visual"]'));
    await Promise.resolve();
    const inner = document.createElement('div');
    pickers[0].el.appendChild(inner);
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    inner.dispatchEvent(handled);
    expect($('.scene-sheet[data-sheet="visual"]')).toBeTruthy();
    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect($('.scene-sheet')).toBeNull();
    expect(pickers[0].destroy).toHaveBeenCalled();
    expect($('.scene-view')).toBeTruthy();
  });

  it('a refresh never takes a field from under the author', () => {
    mount({ scenes: [scene('a', 0)] });
    click($('[data-sa="more"]'));
    const input = $('[data-rename]');
    input.focus();
    stack.refresh();
    expect($('[data-rename]')).toBe(input);
    expect(document.activeElement).toBe(input);
    click($('[data-sa="pace"]'));
    const slider = $('[data-pace-slider]');
    slider.focus();
    stack.refresh();
    expect($('[data-pace-slider]')).toBe(slider);
  });

  it('closing a sheet returns focus to what opened it', async () => {
    mount({ scenes: [scene('a', 0)] });
    click($('[data-sa="pace"]'));
    click($('[data-sa="close-sheet"]'));
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe($('[data-sa="pace"]'));
  });
});
