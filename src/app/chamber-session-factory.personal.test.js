import { describe, it, expect, vi } from 'vitest';
import { createChamberSession } from './chamber-session-factory.js';

const session = { atoms: [{}], provenance: { kind: 'personal-generated' }, visualConfig: { visualMode: 'off' } };
function operations() {
  return { router: { navigationRevision: 1, back: vi.fn() }, ensureVisualCortex: vi.fn(), ensureAudioEngine: vi.fn(),
    getVisualCortex: () => null, getAudioEngine: () => null, getSettings: () => ({}), hideLoading: vi.fn(), showToast: vi.fn() };
}
describe('personal launch preparation', () => {
  it('rejects media failure so the router can restore the original draft', async () => {
    const op = operations(); op.ensureVisualCortex.mockRejectedValue(new Error('media unavailable'));
    await expect(createChamberSession(op, document.createElement('div'), session)).rejects.toThrow('playback unavailable');
    expect(op.router.back).not.toHaveBeenCalled();
  });
  it('does not initialize audio after navigation supersedes pending visual preparation', async () => {
    const op = operations(); let release;
    op.ensureVisualCortex.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = createChamberSession(op, document.createElement('div'), session);
    op.router.navigationRevision++;
    release({});
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(op.ensureAudioEngine).not.toHaveBeenCalled();
    expect(op.router.back).not.toHaveBeenCalled();
  });
});
