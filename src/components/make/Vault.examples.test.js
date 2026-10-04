import { afterEach, expect, it, vi } from 'vitest';
import { Vault } from './Vault.js';
import { MemoryCore } from '../../core/memory.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

function openVault(options = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  return { vault: new Vault(container, options), container };
}

it('offers two clearly labeled authored examples above the plain starter readings', () => {
  const { vault, container } = openVault();
  const examples = container.querySelectorAll('[data-portable-example]');
  expect(examples).toHaveLength(2);
  expect(container.textContent).toContain('Authored examples');
  expect(container.textContent).toContain('Quiet');
  expect(container.textContent).toContain('Energetic');
  expect(container.querySelectorAll('[data-action="try-example"]')).toHaveLength(2);
  vault.destroy();
});

it('tries an admitted example without writing a Vault project', async () => {
  const launched = vi.fn();
  const { vault, container } = openVault({ onSelectBlueprint: launched });
  const tryButton = container.querySelector('[data-portable-example="energetic"] [data-action="try-example"]');
  expect(tryButton).not.toBeNull();
  tryButton?.click();
  await vi.waitFor(() => expect(launched).toHaveBeenCalledOnce());
  const project = launched.mock.calls[0][0];
  expect(project.experienceProgram.authority).toBe('proposed');
  expect(project.sources[0].id).toBe('oedipus-rex#1:200');
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(0);
  vault.destroy();
});

it('reviews an example before Keep, then makes it available to Vary as new', async () => {
  const { vault, container } = openVault();
  const keepButton = container.querySelector('[data-portable-example="quiet"] [data-action="keep-example"]');
  expect(keepButton).not.toBeNull();
  keepButton?.click();
  await vi.waitFor(() => expect(container.querySelector('.vault-portable-review')).not.toBeNull());
  expect(container.textContent).toContain('Spoon River Anthology');
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(0);
  await vault.acceptPortableSequence();
  expect(MemoryCore.getWorkshopBlueprints()).toHaveLength(1);
  expect(container.querySelector('[data-action="vary-portable"]')).not.toBeNull();
  vault.destroy();
});
