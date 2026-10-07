/**
 * What the factory hands the Chamber for a live reading and for the reader's own.
 *
 * A live reading is shown by a host that draws its own controls, so its Chamber
 * is built without chrome; a reading of the reader's own keeps the Chamber's.
 *
 * And when the factory lets go of the session: a finished reading and a launch
 * that failed are released, so Home offers Continue only for a begun,
 * unfinished one.
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
        handleSettingsChange: vi.fn(), handleDataCleared: vi.fn(), handleNavigate: vi.fn(),
        releaseSession: vi.fn()
    };
}

/** Mounts a reading of the reader's own and returns what the Chamber was given. */
async function mount(op, reading) {
    vi.useFakeTimers();
    const pending = createChamberSession(op, document.createElement('div'), reading);
    await vi.advanceTimersByTimeAsync(300);
    await pending;
    return Chamber.mock.calls[0][1];
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

describe('when the factory lets go of the session', () => {
    it('releases a reading that completed, before the Player is reset by stop', async () => {
        const op = operations();
        const reading = session();
        const options = await mount(op, reading);
        options.player.sessionState.state = 'complete';

        options.onExit('close');

        expect(op.releaseSession).toHaveBeenCalledWith(reading);
    });

    it('keeps a reading left part-way', async () => {
        const op = operations();
        const options = await mount(op, session());
        options.player.sessionState.state = 'paused';

        options.onExit('close');

        expect(op.releaseSession).not.toHaveBeenCalled();
    });

    it('releases a reading whose launch failed, before going back', async () => {
        const op = operations();
        op.ensureVisualCortex = async () => { throw new Error('media unavailable'); };
        const reading = session();

        await createChamberSession(op, document.createElement('div'), reading);

        expect(op.releaseSession).toHaveBeenCalledWith(reading);
        expect(op.releaseSession.mock.invocationCallOrder[0])
            .toBeLessThan(op.router.back.mock.invocationCallOrder[0]);
    });
});

describe('a reading begun from Home', () => {
    // Home's own field is the ground the router holds under the Read view, so
    // the preparation overlay and its settle have nothing to cover (RDR-015).
    it('raises no preparation overlay and does not settle', async () => {
        const op = operations();
        vi.useFakeTimers();

        await createChamberSession(op, document.createElement('div'), { ...session(), origin: { view: 'home' } });

        expect(Chamber).toHaveBeenCalledTimes(1);
        expect(op.showLoading).not.toHaveBeenCalled();
        expect(op.updateLoadingStatus).not.toHaveBeenCalled();
        expect(op.hideLoading).not.toHaveBeenCalled();
    });

    it('leaves the overlay and the settle to a reading begun anywhere else', async () => {
        const op = operations();
        vi.useFakeTimers();

        const pending = createChamberSession(op, document.createElement('div'), { ...session(), origin: { view: 'library' } });
        await vi.advanceTimersByTimeAsync(299);
        expect(Chamber).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await pending;

        expect(Chamber).toHaveBeenCalledTimes(1);
        expect(op.showLoading).toHaveBeenCalledWith('Preparing Session');
        expect(op.hideLoading).toHaveBeenCalledTimes(1);
    });

    it('is as quiet as a live reading', async () => {
        const op = operations();
        const live = session();
        offerLivePlayer(live, { stop: vi.fn(), on: vi.fn() });

        await createChamberSession(op, document.createElement('div'), live);

        expect(op.showLoading).not.toHaveBeenCalled();
        expect(op.hideLoading).not.toHaveBeenCalled();
    });
});
