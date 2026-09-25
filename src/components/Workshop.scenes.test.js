/**
 * The phone Workshop is the same Workshop: scenes written, scored and played
 * through the Scene Stack land in the one draft the studio edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { Workshop } = await import('./Workshop.js');
const { WorkshopMedia } = await import('../core/workshop-media.js');
const { MemoryCore } = await import('../core/memory.js');

beforeEach(() => {
  vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(true);
  vi.spyOn(WorkshopMedia, 'getAllIds').mockResolvedValue([]);
  vi.spyOn(WorkshopMedia, 'delete').mockResolvedValue(undefined);
});

let current = null;

afterEach(async () => {
  current?.workshop.destroy();
  current?.container.remove();
  current = null;
  await MemoryCore._workshopMutationTail;
  vi.restoreAllMocks();
  localStorage.clear();
  MemoryCore._stopWorkshopLeaseHeartbeat();
  MemoryCore._stopWorkshopDeferredAssetRetries();
  MemoryCore._workshopAssetReferenceProviders = new Set();
});

function phone(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onCreateSession = vi.fn();
  const onNavigate = vi.fn();
  const workshop = new Workshop(container, { onNavigate, onCreateSession, viewportWidth: 390, ...options });
  current = { workshop, container };
  return { workshop, container, onCreateSession, onNavigate, api: workshop.sceneApi };
}

describe('the phone Workshop', () => {
  it('opens on the Scene Stack, with the studio kept but put away', () => {
    const { container } = phone();
    expect(container.querySelector('.scene-stack-host .scenes')).toBeTruthy();
    expect(container.querySelector('.workshop-studio').dataset.phoneMode).toBe('scenes');
  });

  it('a desk never sees it', () => {
    const { container } = phone({ viewportWidth: 1280 });
    expect(container.querySelector('.scene-stack-host')).toBeNull();
  });

  it('a written scene is a local source that says it was written here', () => {
    const { workshop, api, container } = phone();
    expect(api.addWritten('Light enters form. It stays.')).toEqual({ ok: true });
    const [source] = workshop.sessionData.sources;
    expect(source.id.startsWith('written-')).toBe(true);
    expect(source).toMatchObject({ providerId: 'local', metadata: { source: 'written' }, data: 'Light enters form. It stays.' });
    expect(workshop.isCurrentDraftDirty()).toBe(true);
    expect(container.querySelectorAll('.scene-card')).toHaveLength(1);
  });

  it('an empty scene is refused with a reason', () => {
    const { workshop, api } = phone();
    expect(api.addWritten('  ')).toMatchObject({ ok: false });
    expect(workshop.sessionData.sources).toHaveLength(0);
  });

  it('a chosen visual becomes one whole-scene clip and wakes the scored surface', () => {
    const { workshop, api } = phone();
    api.addWritten('Waste no more time arguing what a good man should be.');
    const id = workshop.sessionData.sources[0].id;
    expect(api.setSceneVisual(id, { leafId: 'klee', style: { preset: 'chaotic' }, pool: null })).toEqual({ ok: true });
    const [clip] = workshop.sessionData.visualScoreAssignments;
    expect(clip).toMatchObject({ sourceId: id, assetId: 'surface:genesis', fromCharacter: 0 });
    expect(clip.cue.config.preset).toBe('chaotic');
    expect(workshop.sessionData.visualConfig.visualMode).toBe('interlocution');
    const scene = api.scenes()[0];
    expect(scene.visual).toMatchObject({ whole: true, name: 'Genesis', leafId: 'klee' });
  });

  it('a visual the Workshop cannot hold is refused, not guessed', () => {
    const { workshop, api } = phone();
    api.addWritten('Some words to score.');
    const id = workshop.sessionData.sources[0].id;
    expect(api.setSceneVisual(id, { leafId: 'science', style: {}, pool: 'sci-astronomy' }).ok).toBe(false);
    expect(workshop.sessionData.visualScoreAssignments).toHaveLength(0);
  });

  it('a scene sound keeps time with the scene visual', () => {
    const { workshop, api } = phone();
    api.addWritten('Begin the morning by saying to thyself.');
    const id = workshop.sessionData.sources[0].id;
    api.setSceneVisual(id, { leafId: 'fractal', style: {}, pool: null });
    api.setSceneSound(id, 'soundscape:aurora');
    const [visual] = workshop.sessionData.visualScoreAssignments;
    const [sound] = workshop.sessionData.audioScoreAssignments;
    expect(sound).toMatchObject({ assetId: 'soundscape:aurora', syncGroup: `sync-${visual.id}` });
    expect(api.soundOptions().map(option => option.id)).toContain('soundscape:aurora');
    api.setSceneSound(id, null);
    expect(workshop.sessionData.audioScoreAssignments).toHaveLength(0);
  });

  it('a new scene continues the one before it', () => {
    const { workshop, api } = phone();
    api.addWritten('The first scene.');
    const first = workshop.sessionData.sources[0].id;
    api.setSceneVisual(first, { leafId: 'turrell', style: {}, pool: null });
    api.setSceneSound(first, 'tone:deep');
    api.addWritten('The second scene.');
    const [, second] = api.scenes();
    expect(second.visual).toMatchObject({ assetId: 'procedural:turrell', whole: true });
    expect(second.sound).toMatchObject({ assetId: 'tone:deep', whole: true });
  });

  it('reorders, rewrites and removes through the one draft', () => {
    const { workshop, api } = phone();
    api.addWritten('Alpha words here.');
    api.addWritten('Beta words here.');
    const [alpha, beta] = workshop.sessionData.sources.map(source => source.id);
    workshop.editorDirty = false;
    api.moveScene(0, 1);
    expect(workshop.sessionData.sources.map(source => source.id)).toEqual([beta, alpha]);
    expect(workshop.isCurrentDraftDirty()).toBe(true);
    expect(api.editScene(alpha, 'Alpha, rewritten.')).toEqual({ ok: true });
    expect(workshop.sessionData.sources[1].data).toBe('Alpha, rewritten.');
    api.removeScene(beta);
    expect(workshop.sessionData.sources.map(source => source.id)).toEqual([alpha]);
  });

  it('pace and title are the sequence\'s own', () => {
    const { workshop, api } = phone();
    api.setPace({ wpm: 260 });
    api.setPace({ chunkMode: 'phrase' });
    api.rename('Morning');
    expect(workshop.sessionData).toMatchObject({ wpm: 260, chunkMode: 'phrase', title: 'Morning' });
  });

  it('Play this scene previews that scene alone, through the Chamber', () => {
    const { workshop, api, onCreateSession } = phone();
    api.addWritten('One scene.');
    api.addWritten('Another scene.');
    const [, second] = workshop.sessionData.sources.map(source => source.id);
    api.setSceneVisual(second, { leafId: 'fractal', style: {}, pool: null });
    api.playScene(second);
    const payload = onCreateSession.mock.calls[0][0];
    expect(payload.isPreview).toBe(true);
    expect(payload.sources.map(source => source.id)).toEqual([second]);
    expect(payload.experienceProgram).toBeTruthy();
    expect(workshop.sessionData.sources).toHaveLength(2);
    api.playAll();
    expect(onCreateSession.mock.calls[1][0].sources).toHaveLength(2);
  });

  it('comes back to the scene it left for a preview', () => {
    const { workshop, api, container } = phone();
    api.addWritten('One scene.');
    const id = workshop.sessionData.sources[0].id;
    workshop.sceneStack.openScene(id);
    api.playScene(id);
    workshop.deactivate();
    workshop.update();
    workshop.activate();
    expect(container.querySelector('.scene-view')).toBeTruthy();
  });

  it('Full studio shows the studio on the same draft, and Scenes returns', () => {
    const { workshop, api, container } = phone();
    api.addWritten('Words for both.');
    api.openStudio();
    expect(container.querySelector('.workshop-studio').dataset.phoneMode).toBe('studio');
    expect(container.querySelector('.scene-stack-host')).toBeNull();
    expect(container.querySelector('#visual-score-text')?.textContent).toContain('Words for both.');
    // The conductor stays in the one-row header, as the way to pace and curve.
    expect(container.querySelector('.studio-header [data-action="focus-reading-inspector"]')).toBeTruthy();
    container.querySelector('[data-action="show-scenes"]').click();
    expect(container.querySelector('.workshop-studio').dataset.phoneMode).toBe('scenes');
    expect(container.querySelectorAll('.scene-card')).toHaveLength(1);
    expect(workshop.sessionData.sources).toHaveLength(1);
  });

  it('a whole Library work arrives as one text, its parts parted by a blank line', () => {
    const { workshop } = phone();
    workshop.addSource({
      id: 'starter-creator-affirmations', name: 'Creator Affirmations', type: 'text/plain',
      data: ['I am a creator.', 'Creation flows through me.']
    }, { id: 'library-archive', name: 'Archive' });
    expect(workshop.sessionData.sources[0].data).toBe('I am a creator.\n\nCreation flows through me.');
  });

  it('keys pressed in the stack stay in the stack', () => {
    const { container, onNavigate } = phone();
    container.querySelector('[data-sa="add"]').click();
    const sheet = container.querySelector('.scene-sheet');
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(container.querySelector('.scene-sheet')).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
