/**
 * What the factory hands the Chamber for a live reading and for the reader's own.
 *
 * A live reading is shown by a host that draws its own controls, so its Chamber
 * is built without chrome; a reading of the reader's own keeps the Chamber's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChamberSession } from './chamber-session-factory.js';
import { offerLivePlayer } from './live-handoff.js';
import { Chamber } from '../components/read/Chamber.js';

vi.mock('../components/read/Chamber.js', () => ({
    Chamber: vi.fn(function Chamber(container, options) { this.options = options; })
}));

const session = () => ({ atoms: [{}], visualConfig: { visualMode: 'off' } });

function operations() {
    const cortex = { warmImagery: vi.fn(), resetSessionVisualIdentity: vi.fn(), updateConfig: vi.fn() };
    const audio = { stopAmbient: vi.fn(), stopSession: vi.fn() };
    return {
        router: { navigationRevision: 1, back: vi.fn(), getViewInstance: () => null },
        ensureVisualCortex: async () => cortex,
        ensureAudioEngine: async () => audio,
        getVisualCortex: () => cortex,
        getAudioEngine: () => audio,
        getSettings: () => ({}),
        showLoading: vi.fn(), updateLoadingStatus: vi.fn(), hideLoading: vi.fn(), showToast: vi.fn(),
        handleSettingsChange: vi.fn(), handleDataCleared: vi.fn()
    };
}

afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe('the Chamber a live reading gets', () => {
    it('adopts the live Player and is built without chrome', async () => {
        const live = session();
        const player = { stop: vi.fn(), on: vi.fn() };
        offerLivePlayer(live, player);

        await createChamberSession(operations(), document.createElement('div'), live);

        expect(Chamber).toHaveBeenCalledTimes(1);
        expect(Chamber.mock.calls[0][1]).toMatchObject({ player, hostPlays: true, chrome: 'none' });
    });

    it('leaves the chrome to a reading of the reader\'s own', async () => {
        vi.useFakeTimers();
        const pending = createChamberSession(operations(), document.createElement('div'), session());
        await vi.advanceTimersByTimeAsync(300);
        await pending;

        expect(Chamber).toHaveBeenCalledTimes(1);
        const options = Chamber.mock.calls[0][1];
        expect(options.hostPlays).toBe(false);
        expect(options).not.toHaveProperty('chrome');
    });
});
