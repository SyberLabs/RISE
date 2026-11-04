import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCore } from './memory.js';
import { personalProject } from '../test/personal-project.fixture.js';
beforeEach(() => localStorage.clear());
describe('immutable personal storage', () => {
  it('same canonical input is idempotent in both entry points and changed generic input is refused', async () => {
    const p = personalProject();
    MemoryCore.saveWorkshopBlueprint(p);
    const before = localStorage.getItem('rise_workshop_v1');
    expect(MemoryCore.saveWorkshopBlueprint(p)).toBeTruthy();
    await MemoryCore.saveWorkshopBlueprintAsync(p);
    expect(localStorage.getItem('rise_workshop_v1')).toBe(before);
    expect(MemoryCore.saveWorkshopBlueprint({ ...p, title: 'changed' })).toBeNull();
    await expect(MemoryCore.saveWorkshopBlueprintAsync({ id: p.id, sources: p.sources, title: 'generic' })).rejects.toThrow();
    expect(localStorage.getItem('rise_workshop_v1')).toBe(before);
  });
});
