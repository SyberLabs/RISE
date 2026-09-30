import { afterEach, expect, it, vi } from 'vitest';
import { Vault } from './Vault.js';
import { MemoryCore } from '../core/memory.js';
import { resolveLibrarySourceIds } from '../core/scriptorium-resolve.js';
import { exportPortableSequence, inspectPortableSequence } from '../core/portable-sequence.js';
import { validateWorkshopProject, WORKSHOP_PROJECT_SCHEMA } from '../core/workshop-project.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

async function bundle() {
  const { sources } = await resolveLibrarySourceIds(['spoon-river-anthology#12']);
  const project = validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: 'portable-test-author', title: 'From the Archive', intent: 'custom',
    sources, assets: [],
    experienceProgram: {
      schema: 'rise.experience-program.v1', id: 'portable-test',
      authority: 'user', editable: true,
      tracks: [{ id: 'movement', kind: 'movement', clips: [{
        id: 'opening', anchor: { sourceIds: ['spoon-river-anthology#12'] },
        data: { index: 0, title: 'Opening' }
      }] }]
    },
    defaults: { reading: { wpm: 220 } }
  });
  return { project, text: await exportPortableSequence(project, { creatorCredit: 'A. Reader' }) };
}

it('offers file import in Custom and export only for a saved authored score', async () => {
  const { project } = await bundle();
  MemoryCore.saveWorkshopBlueprint(project);
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  expect(container.querySelector('[data-portable-file]')).not.toBeNull();
  expect(container.querySelector('[data-action="export-portable"]')).not.toBeNull();
  expect(container.textContent).toContain('United States');
  vault.destroy();
});

it('retains typed creator credit when asynchronous Vault hydration redraws the card', async () => {
  const { project } = await bundle();
  MemoryCore.saveWorkshopBlueprint(project);
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  const credit = container.querySelector('[data-portable-credit]');
  credit.value = 'A. Reader';
  credit.dispatchEvent(new Event('input', { bubbles: true }));
  vault.refreshBlueprints();
  expect(container.querySelector('[data-portable-credit]').value).toBe('A. Reader');
  await MemoryCore.getWorkshopBlueprintsHydrated();
  await Promise.resolve();
  expect(container.querySelector('[data-portable-credit]').value).toBe('A. Reader');
  expect(vault.portableCredits.get(project.id)).toBe('A. Reader');
  vault.destroy();
});

it('inspects without saving, cancels, and saves only on an explicit second gesture', async () => {
  const { text } = await bundle();
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  const initial = MemoryCore.getWorkshopBlueprints().length;

  await vault.stagePortableSequence(text);
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(initial);
  expect(container.textContent).toContain('A. Reader');
  expect(container.textContent).toContain('Spoon River Anthology');
  expect(container.textContent).toContain('declared');
  expect(container.querySelector('[data-action="keep-portable"]')).not.toBeNull();

  container.querySelector('[data-action="cancel-portable"]').click();
  expect(container.querySelector('[data-action="keep-portable"]')).toBeNull();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(initial);

  await vault.stagePortableSequence(text);
  await vault.acceptPortableSequence();
  const saved = MemoryCore.getWorkshopBlueprints();
  expect(saved).toHaveLength(initial + 1);
  expect(saved[0].project.experienceProgram.authority).toBe('proposed');
  expect(container.querySelector('[data-action="begin-custom"]')).not.toBeNull();
  expect(container.querySelector('[data-action="edit-custom"]')?.textContent).toBe('Preview / edit');
  vault.destroy();
});

it('rejects a duplicate import and keeps the existing sequence unchanged', async () => {
  const { text } = await bundle();
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  await vault.stagePortableSequence(text);
  await vault.acceptPortableSequence();
  const first = MemoryCore.getWorkshopBlueprints()[0].project;
  await vault.stagePortableSequence(text);
  await vault.acceptPortableSequence();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  expect(MemoryCore.getWorkshopBlueprints()[0].project).toEqual(first);
  expect(container.textContent).toContain('already in this browser');
  vault.destroy();
});

it('routes an imported score to an explicit new variation draft', async () => {
  const { text } = await bundle();
  const container = document.createElement('div');
  document.body.append(container);
  const routes = [];
  const vault = new Vault(container, {
    initialSection: 'custom', onNavigate: (...args) => routes.push(args)
  });
  await vault.stagePortableSequence(text);
  await vault.acceptPortableSequence();
  const card = container.querySelector('.sequence-card');
  expect(card.querySelector('[data-action="edit-custom"]').textContent).toBe('Preview / edit');
  card.querySelector('[data-action="vary-portable"]').click();
  expect(routes).toEqual([['workshop', { varyBlueprintId: vault.blueprints[0].id }]]);
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  vault.destroy();
});

it('shows a child parent reference without treating it as creator approval', async () => {
  const { text } = await bundle();
  const parent = await inspectPortableSequence(text);
  const child = structuredClone(parent.project);
  child.title = 'Child reading';
  child.defaults.reading.wpm = 180;
  child.provenance = { kind: 'portable-sequence-variation', parentPortableId: parent.id };
  const childText = await exportPortableSequence(child);
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  await vault.stagePortableSequence(childText);
  expect(container.textContent).toContain(parent.id);
  expect(container.textContent).toContain('not an endorsement');
  await vault.acceptPortableSequence();
  expect(container.textContent).toContain(parent.id);
  vault.destroy();
});

it('does not overwrite the first import when two Vaults accept the same score together', async () => {
  const { text } = await bundle();
  const alternate = JSON.parse(text);
  alternate.title = 'Second title';
  const firstContainer = document.createElement('div');
  const secondContainer = document.createElement('div');
  document.body.append(firstContainer, secondContainer);
  const first = new Vault(firstContainer, { initialSection: 'custom' });
  const second = new Vault(secondContainer, { initialSection: 'custom' });
  await first.stagePortableSequence(text);
  await second.stagePortableSequence(JSON.stringify(alternate));
  await Promise.all([first.acceptPortableSequence(), second.acceptPortableSequence()]);
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  expect(MemoryCore.getWorkshopBlueprints()[0].project.title).toBe('From the Archive');
  expect(secondContainer.textContent).toContain('already in this browser');
  first.destroy();
  second.destroy();
});

it('shows a refusal without writing a malformed sequence', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  await vault.stagePortableSequence('{');
  expect(container.textContent).toContain('valid JSON');
  expect(container.querySelector('[data-action="keep-portable"]')).toBeNull();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(0);
  vault.destroy();
});

it('retains the review when browser storage refuses the save', async () => {
  const { text } = await bundle();
  const container = document.createElement('div');
  document.body.append(container);
  const vault = new Vault(container, { initialSection: 'custom' });
  await vault.stagePortableSequence(text);
  vi.spyOn(MemoryCore, 'saveWorkshopBlueprintAsync').mockRejectedValue(new Error('Storage full'));
  await vault.acceptPortableSequence();
  expect(container.textContent).toContain('Storage full');
  expect(container.querySelector('[data-action="keep-portable"]')).not.toBeNull();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(0);
  vault.destroy();
});
