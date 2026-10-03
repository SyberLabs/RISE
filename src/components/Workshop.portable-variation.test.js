import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryCore } from '../core/memory.js';
import { resolveLibrarySourceIds } from '../core/scriptorium-resolve.js';
import { validateWorkshopProject, WORKSHOP_PROJECT_SCHEMA } from '../core/workshop-project.js';
import { exportPortableSequence, inspectPortableSequence } from '../core/portable-sequence.js';
import quietExample from '../content/portable-examples/quiet.json' with { type: 'json' };

if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

if (typeof URL.createObjectURL !== 'function') {
  let objectUrlId = 0;
  URL.createObjectURL = () => `blob:${location.origin}/workshop-test-${++objectUrlId}`;
  URL.revokeObjectURL = () => {};
}

const { Workshop } = await import('./Workshop.js');
const { WorkshopMedia } = await import('../core/workshop-media.js');

beforeEach(() => {
  vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(true);
  vi.spyOn(WorkshopMedia, 'getAllIds').mockResolvedValue([]);
  vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockResolvedValue(null);
  vi.spyOn(WorkshopMedia, 'delete').mockResolvedValue(undefined);
  vi.spyOn(WorkshopMedia, 'deleteByProject').mockResolvedValue(undefined);
  vi.spyOn(WorkshopMedia, 'revokeObjectUrl').mockImplementation(() => {});
});

afterEach(async () => {
  for (let pass = 0; pass < 8; pass += 1) {
    const tail = MemoryCore._workshopMutationTail;
    await tail;
    await Promise.resolve();
    if (tail === MemoryCore._workshopMutationTail) break;
  }
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
  MemoryCore._stopWorkshopLeaseHeartbeat();
  MemoryCore._stopWorkshopDeferredAssetRetries();
  MemoryCore._workshopAssetReferenceProviders = new Set();
});

async function importedParent() {
  const { sources } = await resolveLibrarySourceIds(['spoon-river-anthology#12']);
  const project = validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA, id: 'author-project', title: 'Original reading',
    sources, assets: [], defaults: { reading: { wpm: 220 } },
    experienceProgram: {
      schema: 'rise.experience-program.v1', id: 'original-score', authority: 'user',
      editable: true, tracks: [{ id: 'movement', kind: 'movement', clips: [{
        id: 'first', anchor: { sourceIds: ['spoon-river-anthology#12'] },
        data: { index: 0, title: 'First' }
      }] }]
    }
  });
  const inspected = await inspectPortableSequence(await exportPortableSequence(project, {
    creatorCredit: 'Original creator'
  }));
  await MemoryCore.saveWorkshopBlueprintAsync(inspected.project);
  return inspected;
}

function makeWorkshop(onCreateSession = vi.fn(), options = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  return { workshop: new Workshop(container, { onCreateSession, ...options }), container };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

it('opens a local child draft and leaves the original untouched on cancellation', async () => {
  const parent = await importedParent();
  const before = MemoryCore.getWorkshopBlueprints()[0].project;
  const { workshop } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  expect(workshop.activeBlueprintId).toBeNull();
  expect(workshop.sessionData.provenance.creatorCredit).toBeUndefined();
  workshop.destroy();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  expect(MemoryCore.getWorkshopBlueprints()[0].project).toEqual(before);
});

it('previews an unsaved variation without creating a Vault child', async () => {
  const parent = await importedParent();
  const onCreateSession = vi.fn().mockResolvedValue(true);
  const { workshop } = makeWorkshop(onCreateSession);
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  expect(await workshop.createSession()).toBe(true);
  expect(onCreateSession).toHaveBeenCalledOnce();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  workshop.destroy();
});

it('keeps an imported parent eligible for variation after its Workshop preview', async () => {
  const parent = await importedParent();
  const onCreateSession = vi.fn().mockResolvedValue(true);
  const { workshop } = makeWorkshop(onCreateSession);
  workshop.update({ blueprintId: parent.id });
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.portableId).toBe(parent.id));
  expect(await workshop.createSession()).toBe(true);
  const saved = MemoryCore.getWorkshopBlueprints();
  expect(saved).toHaveLength(1);
  expect(saved[0].provenance.portableId).toBe(parent.id);
  workshop.destroy();
});

it('saves a changed title and pace as a distinct proposed child with parent lineage', async () => {
  const parent = await importedParent();
  const before = MemoryCore.getWorkshopBlueprints()[0].project;
  const { workshop } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  workshop.sessionData.title = 'My slower reading';
  workshop.sessionData.wpm = 180;
  const saved = await workshop.saveSequenceToVault();
  expect(saved.id).not.toBe(parent.id);
  const projects = MemoryCore.getWorkshopBlueprints().map(item => item.project);
  expect(projects).toHaveLength(2);
  expect(projects.find(item => item.id === parent.id)).toEqual(before);
  const child = projects.find(item => item.id === saved.id);
  expect(child.title).toBe('My slower reading');
  expect(child.defaults.reading.wpm).toBe(180);
  expect(child.experienceProgram.authority).toBe('proposed');
  expect(child.provenance).toEqual({
    kind: 'portable-sequence-variation', parentPortableId: parent.id
  });
  const carried = await inspectPortableSequence(await exportPortableSequence(child));
  expect(carried.parentPortableId).toBe(parent.id);
  expect(carried.creatorCredit).toBeNull();
  expect(carried.id).not.toBe(parent.id);
  workshop.destroy();
});

it('locks a variation editor until its selected parent is loaded', async () => {
  const parent = await importedParent();
  const parentProject = MemoryCore.getWorkshopBlueprints()[0].project;
  const pendingLookup = deferred();
  const onCreateSession = vi.fn();
  const { workshop, container } = makeWorkshop(onCreateSession);
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);

  workshop.update({ varyBlueprintId: parent.id });

  expect(container.querySelector('#workshop-sequence-status').textContent).toContain('Loading selected sequence');
  expect(container.querySelector('#session-title').disabled).toBe(true);
  expect(container.querySelector('[data-action="save-draft"]').disabled).toBe(true);
  expect(container.querySelector('[data-action="preview"]').disabled).toBe(true);
  expect(await workshop.saveSequenceToVault()).toBeNull();
  expect(await workshop.createSession()).toBe(false);
  expect(workshop.previewSession()).toBe(false);
  expect(onCreateSession).not.toHaveBeenCalled();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);

  workshop.refreshContextualInspector();
  const redrawnTitle = container.querySelector('#session-title');
  expect(redrawnTitle.disabled).toBe(true);
  const titleBeforeLoad = workshop.sessionData.title;
  redrawnTitle.value = 'Must not land';
  redrawnTitle.dispatchEvent(new Event('input', { bubbles: true }));
  expect(workshop.sessionData.title).toBe(titleBeforeLoad);

  workshop.setInspectorContext({ kind: 'pacing' });
  const loadingPace = container.querySelector('#wpm-slider');
  expect(loadingPace.disabled).toBe(true);
  const paceBeforeLoad = workshop.sessionData.wpm;
  loadingPace.value = '240';
  loadingPace.dispatchEvent(new Event('input', { bubbles: true }));
  expect(workshop.sessionData.wpm).toBe(paceBeforeLoad);

  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await vi.waitFor(() => expect(container.querySelector('#workshop-sequence-status').textContent)
    .toContain('Variation of an imported score'));

  const title = container.querySelector('#session-title');
  title.value = 'A Palace Variation';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  workshop.setInspectorContext({ kind: 'pacing' });
  const pace = container.querySelector('#wpm-slider');
  pace.value = '240';
  pace.dispatchEvent(new Event('input', { bubbles: true }));
  expect(pace.disabled).toBe(false);

  const saved = await workshop.saveSequenceToVault();
  const projects = MemoryCore.getWorkshopBlueprints().map(item => item.project);
  expect(projects).toHaveLength(2);
  expect(projects.find(item => item.id === parent.id)).toEqual(parentProject);
  const child = projects.find(item => item.id === saved.id);
  expect(child.title).toBe('A Palace Variation');
  expect(child.defaults.reading.wpm).toBe(240);
  expect(child.experienceProgram.authority).toBe('proposed');
  expect(child.provenance).toEqual({
    kind: 'portable-sequence-variation', parentPortableId: parent.id
  });
  const exported = await inspectPortableSequence(await exportPortableSequence(child));
  expect(exported.parentPortableId).toBe(parent.id);
  expect(exported.project.defaults.reading.wpm).toBe(240);
  workshop.destroy();
});

it('keeps the pace slider in place when activation refreshes an unchanged inspector', async () => {
  const parent = await importedParent();
  const { workshop, container } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#workshop-sequence-status').textContent)
    .toContain('Variation of an imported score'));
  // The router activates Workshop after its fade; activation looks up the Vault again.
  const activationLookup = deferred();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValueOnce(activationLookup.promise);
  workshop.activate();
  container.querySelector('[data-action="focus-reading-inspector"]').click();
  const pace = container.querySelector('#wpm-slider');

  // The lookup lands while the reader holds the slider. activate() subscribed
  // first, so its refresh has run once this await returns.
  activationLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await activationLookup.promise;
  expect(container.querySelector('#wpm-slider')).toBe(pace);

  pace.value = '240';
  pace.dispatchEvent(new Event('input', { bubbles: true }));
  const saved = await workshop.saveSequenceToVault();
  const child = MemoryCore.getWorkshopBlueprints().map(item => item.project)
    .find(item => item.id === saved.id);
  const exported = await inspectPortableSequence(await exportPortableSequence(child));
  expect(exported.project.defaults.reading.wpm).toBe(240);
  workshop.destroy();
});

it('keeps the pace slider in step with the sequence, so a later refresh leaves it in place', async () => {
  const parent = await importedParent();
  const { workshop, container } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#workshop-sequence-status').textContent)
    .toContain('Variation of an imported score'));
  container.querySelector('[data-action="focus-reading-inspector"]').click();
  const pace = container.querySelector('#wpm-slider');

  // After the reader moves the slider, a refresh that changes nothing else keeps it.
  pace.value = '260';
  pace.dispatchEvent(new Event('input', { bubbles: true }));
  workshop.refreshContextualInspector();
  expect(container.querySelector('#wpm-slider')).toBe(pace);

  // A pace set elsewhere (the phone scene stack) moves the slider the reader sees.
  workshop.sceneApi.setPace({ wpm: 200 });
  workshop.refreshContextualInspector();
  expect(container.querySelector('#wpm-slider').value).toBe('200');
  expect(workshop.sessionData.wpm).toBe(200);
  workshop.destroy();
});


it('keeps the held pace slider when curve and chunk changes are followed by a late inspector refresh', async () => {
  const parent = await importedParent();
  const { workshop, container } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#workshop-sequence-status').textContent)
    .toContain('Variation of an imported score'));
  container.querySelector('[data-action="focus-reading-inspector"]').click();
  const pace = container.querySelector('#wpm-slider');

  const curve = [...container.querySelectorAll('[data-action="set-reading-curve"]')]
    .find(button => button.getAttribute('aria-pressed') === 'false');
  const chunk = [...container.querySelectorAll('[data-action="set-reading-chunk"]')]
    .find(button => button.getAttribute('aria-pressed') === 'false');
  expect(curve).toBeTruthy();
  expect(chunk).toBeTruthy();
  curve.click();
  chunk.click();
  expect(container.querySelector('#wpm-slider')).toBe(pace);

  workshop.refreshContextualInspector();
  expect(container.querySelector('#wpm-slider')).toBe(pace);

  pace.value = '240';
  pace.dispatchEvent(new Event('input', { bubbles: true }));
  const saved = await workshop.saveSequenceToVault();
  const child = MemoryCore.getWorkshopBlueprints().map(item => item.project)
    .find(item => item.id === saved.id);
  const exported = await inspectPortableSequence(await exportPortableSequence(child));
  expect(exported.project.defaults.reading.wpm).toBe(240);
  workshop.destroy();
});

it('keeps the phone Back control available and exposes loading while a sequence hydrates', async () => {
  const parent = await importedParent();
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 390 });
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);

  expect(container.querySelector('.workshop-studio').dataset.phoneMode).toBe('scenes');
  workshop.update({ blueprintId: parent.id });

  const phoneHost = container.querySelector('.scene-stack-host');
  const back = phoneHost.querySelector('[data-sa="back"]');
  expect(back.disabled).toBe(false);
  expect(phoneHost.getAttribute('aria-busy')).toBe('true');
  expect(phoneHost.querySelector('[data-blueprint-loading]').textContent)
    .toContain('Loading selected sequence');
  expect(phoneHost.querySelector('[data-scenes-status]').textContent)
    .toContain('Loading selected sequence');

  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await vi.waitFor(() => expect(workshop.blueprintLoadInProgress).toBe(false));
  const settledPhoneHost = container.querySelector('.scene-stack-host');
  if (settledPhoneHost) expect(settledPhoneHost.hasAttribute('aria-busy')).toBe(false);
  else expect(container.querySelector('.workshop-studio').dataset.phoneMode).not.toBe('scenes');
  expect(container.querySelector('[data-blueprint-loading]')).toBeNull();
  workshop.destroy();
});

it('clears the loading state when a saved sequence lookup fails', async () => {
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const originallyDisabledPreview = container.querySelector('[data-action="preview"]');
  originallyDisabledPreview.disabled = true;

  workshop.update({ blueprintId: 'missing-blueprint' });
  expect(container.querySelector('#session-title').disabled).toBe(true);
  expect(originallyDisabledPreview.disabled).toBe(true);
  pendingLookup.reject(new Error('Vault unavailable'));

  await vi.waitFor(() => expect(container.querySelector('#workshop-sequence-status').textContent)
    .not.toContain('Loading selected sequence'));
  expect(container.querySelector('#session-title').disabled).toBe(false);
  expect(container.querySelector('[data-action="save-draft"]').disabled).toBe(false);
  expect(originallyDisabledPreview.disabled).toBe(true);
  expect(workshop.activeBlueprintId).toBeNull();
  expect(workshop.activeDraftKind).toBe('new');
  workshop.destroy();
});

it('ignores an older variation lookup after a newer parent is selected', async () => {
  const firstParent = await importedParent();
  const secondParent = await importedQuietExample();
  const firstLookup = deferred();
  const secondLookup = deferred();
  const { workshop, container } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints')
    .mockReturnValueOnce(firstLookup.promise)
    .mockReturnValueOnce(secondLookup.promise);

  workshop.update({ varyBlueprintId: firstParent.id });
  workshop.update({ varyBlueprintId: secondParent.id });
  firstLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await Promise.resolve();

  expect(workshop.sessionData.provenance?.parentPortableId).toBeUndefined();
  expect(container.querySelector('#workshop-sequence-status').textContent)
    .toContain('Loading selected sequence');

  secondLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId)
    .toBe(secondParent.id));
  expect(workshop.activeDraftKind).toBe('variation');
  workshop.destroy();
});

it('cancels a pending saved selection when the active saved sequence is reselected', async () => {
  const firstParent = await importedParent();
  const secondParent = await importedQuietExample();
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop();
  workshop.update({ blueprintId: firstParent.id });
  await vi.waitFor(() => expect(workshop.activeBlueprintId).toBe(firstParent.id));
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);

  workshop.handleSequenceSelection(`saved:${secondParent.id}`);
  expect(workshop.blueprintLoadInProgress).toBe(true);
  workshop.handleSequenceSelection(`saved:${firstParent.id}`);
  const firstSession = workshop.sessionData;

  expect(workshop.blueprintLoadInProgress).toBe(false);
  expect(container.querySelector('#workshop-sequence-status').textContent)
    .not.toContain('Loading selected sequence');
  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await Promise.resolve();

  expect(workshop.activeBlueprintId).toBe(firstParent.id);
  expect(workshop.sessionData).toBe(firstSession);
  expect(workshop.blueprintLoadInProgress).toBe(false);
  workshop.destroy();
});

it('ignores a file-picker video probe after another saved sequence is selected', async () => {
  const firstParent = await importedParent();
  const secondParent = await importedQuietExample();
  const { workshop } = makeWorkshop();
  workshop.update({ blueprintId: firstParent.id });
  await vi.waitFor(() => expect(workshop.activeBlueprintId).toBe(firstParent.id));
  const createElement = document.createElement.bind(document);
  let metadataVideo;
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = createElement(tagName, options);
    if (tagName === 'video') {
      metadataVideo = element;
      vi.spyOn(element, 'load').mockImplementation(() => {});
    }
    return element;
  });
  const file = new File([new Uint8Array([0, 0, 0, 24])], 'upload.mp4', { type: 'video/mp4' });
  const input = { files: [file], value: 'fake-path' };
  const upload = workshop.handleFileUpload({ target: input });
  expect(metadataVideo).toBeTruthy();

  workshop.handleSequenceSelection(`saved:${secondParent.id}`);
  await vi.waitFor(() => expect(workshop.activeBlueprintId).toBe(secondParent.id));
  Object.defineProperty(metadataVideo, 'duration', { configurable: true, value: 12 });
  metadataVideo.onloadedmetadata();
  await upload;

  expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(0);
  expect(workshop.pendingMediaBlobs.size).toBe(0);
  expect(input.value).toBe('');
  workshop.destroy();
});

it('still adds a valid MP4 selected through the file picker', async () => {
  const { workshop } = makeWorkshop();
  const createElement = document.createElement.bind(document);
  let metadataVideo;
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = createElement(tagName, options);
    if (tagName === 'video') {
      metadataVideo = element;
      vi.spyOn(element, 'load').mockImplementation(() => {});
    }
    return element;
  });
  const file = new File([new Uint8Array([0, 0, 0, 24])], 'upload.mp4', { type: 'video/mp4' });
  const input = { files: [file], value: 'fake-path' };
  const upload = workshop.handleFileUpload({ target: input });
  expect(metadataVideo).toBeTruthy();
  Object.defineProperty(metadataVideo, 'duration', { configurable: true, value: 12 });
  metadataVideo.onloadedmetadata();
  await upload;

  expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(1);
  expect(workshop.pendingMediaBlobs.size).toBe(1);
  expect(input.value).toBe('');
  workshop.destroy();
});

it('keeps a new draft selected while an older saved sequence lookup is pending', async () => {
  const parent = await importedParent();
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);

  workshop.update({ varyBlueprintId: parent.id });
  workshop.handleSequenceSelection('new');
  const newDraft = workshop.sessionData;
  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await Promise.resolve();

  expect(workshop.sessionData).toBe(newDraft);
  expect(workshop.activeDraftKind).toBe('new');
  expect(workshop.blueprintLoadInProgress).toBe(false);
  expect(container.querySelector('#workshop-sequence-status').textContent)
    .toBe('A clean canvas for a new sequence');
  workshop.destroy();
});

it('does not install a selected project after Workshop is destroyed during loading', async () => {
  const parent = await importedParent();
  const pendingLookup = deferred();
  const { workshop } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);
  const originalSession = workshop.sessionData;

  workshop.update({ varyBlueprintId: parent.id });
  workshop.destroy();
  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await Promise.resolve();

  expect(workshop.sessionData).toBe(originalSession);
  expect(workshop.activeDraftKind).toBe('new');
  expect(workshop.activeBlueprintId).toBeNull();
});

it('ignores image files dropped while a saved sequence is loading', async () => {
  const parent = await importedParent();
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);
  workshop.update({ varyBlueprintId: parent.id });
  const file = new File([new Uint8Array([1])], 'dropped.png', { type: 'image/png' });
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });

  container.querySelector('#visual-drop-zone').dispatchEvent(drop);

  expect(drop.defaultPrevented).toBe(true);
  expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(0);
  expect(workshop.pendingMediaBlobs.size).toBe(0);
  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(0);
  workshop.destroy();
});

it('does not apply a dropped video probe to a newly selected project', async () => {
  const parent = await importedParent();
  const pendingLookup = deferred();
  const { workshop, container } = makeWorkshop();
  vi.spyOn(workshop, 'loadSavedBlueprints').mockReturnValue(pendingLookup.promise);
  const createElement = document.createElement.bind(document);
  let metadataVideo;
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = createElement(tagName, options);
    if (tagName === 'video') {
      metadataVideo = element;
      vi.spyOn(element, 'load').mockImplementation(() => {});
    }
    return element;
  });
  const file = new Blob([new Uint8Array([0, 0, 0, 24])], { type: 'video/mp4' });
  const processing = workshop.processDroppedVideo(file);
  expect(metadataVideo).toBeTruthy();

  workshop.update({ varyBlueprintId: parent.id });
  pendingLookup.resolve(MemoryCore.getWorkshopBlueprints());
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  Object.defineProperty(metadataVideo, 'duration', { configurable: true, value: 12 });
  metadataVideo.onloadedmetadata();
  await processing;

  expect(workshop.sessionData.sequenceVisualAssets).toHaveLength(0);
  expect(workshop.pendingMediaBlobs.size).toBe(0);
  workshop.destroy();
});

async function importedQuietExample() {
  const inspected = await inspectPortableSequence(JSON.stringify(quietExample));
  await MemoryCore.saveWorkshopBlueprintAsync(inspected.project);
  return inspected;
}

function choose(container, selector, value) {
  const select = container.querySelector(selector);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

const passageCues = program => ['visual', 'audio'].map(kind => program.tracks
  .find(track => track.kind === kind).clips.map(clip => clip.cue.collections?.[0] ?? clip.cue.soundscapeId));

it('replaces the inert score editor with a passage remix for a proposed score', async () => {
  const parent = await importedQuietExample();
  const { workshop, container } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#passage-remix')).not.toBeNull());
  expect(container.querySelector('.media-score-editor')).toBeNull();
  expect([...container.querySelectorAll('[data-remix-passage] option')].map(option => option.textContent))
    .toEqual(['Passage 1 · the first 50%', 'Passage 2 · the last 50%']);
  expect(container.querySelector('[data-remix-visual]').value).toBe('turrell');
  expect(container.querySelector('[data-remix-soundscape]').value).toBe('aurora');
  const lineage = container.querySelector('[data-remix-lineage]').textContent;
  expect(lineage).toContain(parent.title);
  expect(lineage).toContain('RISE');
  expect(lineage).toMatch(/your credit/i);
  workshop.destroy();
});

it('previews a remixed passage, resets it, and keeps it only on request', async () => {
  const parent = await importedQuietExample();
  const before = MemoryCore.getWorkshopBlueprints()[0].project;
  const onCreateSession = vi.fn().mockResolvedValue(true);
  const { workshop, container } = makeWorkshop(onCreateSession);
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#passage-remix')).not.toBeNull());
  expect(container.querySelector('[data-action="keep-remix"]').disabled).toBe(true);

  choose(container, '[data-remix-passage]', 'visual-2');
  expect(container.querySelector('[data-remix-visual]').value).toBe('rockgarden');
  choose(container, '[data-remix-visual]', 'klee');
  choose(container, '[data-remix-soundscape]', 'soft-rain');
  expect(passageCues(workshop.sessionData.experienceProgram))
    .toEqual([['turrell', 'klee'], ['aurora', 'soft-rain']]);
  expect(container.querySelector('[data-remix-passage]').value).toBe('visual-2');
  expect(container.querySelector('[data-action="keep-remix"]').disabled).toBe(false);

  container.querySelector('[data-action="preview"]').click();
  await vi.waitFor(() => expect(onCreateSession).toHaveBeenCalledOnce());
  expect(passageCues(onCreateSession.mock.calls[0][0].experienceProgram))
    .toEqual([['turrell', 'klee'], ['aurora', 'soft-rain']]);
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);

  container.querySelector('[data-action="reset-remix"]').click();
  expect(workshop.sessionData.experienceProgram).toEqual(before.experienceProgram);
  choose(container, '[data-remix-visual]', 'harmonograph');
  container.querySelector('[data-action="keep-remix"]').click();
  await vi.waitFor(() => expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(2));

  const projects = MemoryCore.getWorkshopBlueprints().map(item => item.project);
  expect(projects.find(item => item.id === parent.id)).toEqual(before);
  const child = projects.find(item => item.id !== parent.id);
  expect(child.provenance).toEqual({ kind: 'portable-sequence-variation', parentPortableId: parent.id });
  expect(passageCues(child.experienceProgram))
    .toEqual([['turrell', 'harmonograph'], ['aurora', 'nocturne']]);
  const carried = await inspectPortableSequence(
    await exportPortableSequence(child, { creatorCredit: 'Remixer' }));
  expect(carried.parentPortableId).toBe(parent.id);
  expect(carried.creatorCredit).toBe('Remixer');
  expect(passageCues(carried.project.experienceProgram)).toEqual(passageCues(child.experienceProgram));
  workshop.destroy();
});

it('shows the remix on a phone instead of hiding the studio behind absent scenes', async () => {
  const parent = await importedQuietExample();
  const { workshop, container } = makeWorkshop(vi.fn(), { viewportWidth: 390 });
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#passage-remix')).not.toBeNull());
  expect(container.querySelector('.workshop-studio').dataset.phoneMode).toBe('studio');
  expect(container.querySelector('.scene-stack-host')).toBeNull();
  expect(container.querySelector('[data-action="show-scenes"]')).toBeNull();
  workshop.destroy();
});

it('lets a kept remix be reopened, reset, and saved back to the original cues', async () => {
  const parent = await importedQuietExample();
  const { workshop, container } = makeWorkshop();
  workshop.update({ varyBlueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#passage-remix')).not.toBeNull());
  choose(container, '[data-remix-visual]', 'klee');
  container.querySelector('[data-action="keep-remix"]').click();
  await vi.waitFor(() => expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(2));
  const childId = MemoryCore.getWorkshopBlueprints().find(item => item.id !== parent.id).id;

  workshop.update({ blueprintId: childId });
  await vi.waitFor(() => expect(container.querySelector('[data-action="keep-remix"]')?.textContent)
    .toBe('Save remix'));
  expect(container.querySelector('[data-action="keep-remix"]').disabled).toBe(true);
  container.querySelector('[data-action="reset-remix"]').click();
  expect(document.activeElement?.id).toBe('remix-passage');
  expect(container.querySelector('[data-action="keep-remix"]').disabled).toBe(false);
  container.querySelector('[data-action="keep-remix"]').click();
  await vi.waitFor(() => expect(passageCues(MemoryCore.getWorkshopBlueprints()
    .find(item => item.id === childId).project.experienceProgram))
    .toEqual([['turrell', 'rockgarden'], ['aurora', 'nocturne']]));
  workshop.destroy();
});

it('offers Vary as new instead of inert editing when an imported score is opened', async () => {
  const parent = await importedQuietExample();
  const { workshop, container } = makeWorkshop();
  workshop.update({ blueprintId: parent.id });
  await vi.waitFor(() => expect(container.querySelector('#passage-remix')).not.toBeNull());
  expect(container.querySelector('.media-score-editor')).toBeNull();
  expect(container.querySelector('[data-remix-visual]')).toBeNull();
  container.querySelector('[data-action="vary-as-new"]').click();
  await vi.waitFor(() => expect(workshop.sessionData.provenance?.parentPortableId).toBe(parent.id));
  expect(container.querySelector('[data-remix-visual]')).not.toBeNull();
  workshop.destroy();
});
