import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryCore } from '../core/memory.js';
import { resolveLibrarySourceIds } from '../core/scriptorium-resolve.js';
import { validateWorkshopProject, WORKSHOP_PROJECT_SCHEMA } from '../core/workshop-project.js';
import { exportPortableSequence, inspectPortableSequence } from '../core/portable-sequence.js';
import quietExample from '../content/portable-examples/quiet.json' with { type: 'json' };

if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
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
