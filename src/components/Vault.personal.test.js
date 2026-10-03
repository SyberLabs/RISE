import { afterEach, it, expect } from 'vitest';
import { Vault } from './Vault.js';
import { MemoryCore } from '../core/memory.js';
import { createPersonalProject } from '../core/personal-project.js';
import { chamberExitTarget } from '../app/chamber-exit.js';
afterEach(() => localStorage.clear());
it('refreshes a cached Vault with newly kept work', () => {
  const container = document.createElement('div');
  const vault = new Vault(container);
  const project = createPersonalProject({ title: 'Recently kept', paragraphs: ['A quiet word. '.repeat(20).trim(), 'Another moment. '.repeat(20).trim()], writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' });
  MemoryCore.saveWorkshopBlueprint(project);
  vault.update?.({ section: 'custom' });
  expect(container.textContent).toContain('Recently kept');
  expect(container.querySelector('[data-action="export-personal-json"]')).not.toBeNull();
  vault.destroy();
});
it('returns a personal reading to the Vault on exit', () => {
  expect(chamberExitTarget('exit', { provenance: {kind:'personal-generated'}, origin:{view:'vault'} })).toMatchObject({view:'vault'});
  expect(chamberExitTarget('back', { provenance: {kind:'personal-generated'} })).toMatchObject({view:'vault'});
});
