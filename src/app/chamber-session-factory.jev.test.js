import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requestJevSession: vi.fn(),
    Player: vi.fn(),
    Chamber: vi.fn()
}));

vi.mock('../components/JevGate.js', () => ({ requestJevSession: mocks.requestJevSession }));
vi.mock('../core/player.js', () => ({
    Player: mocks.Player,
    estimateInterlocutionCount: vi.fn(() => 0)
}));
vi.mock('../components/Chamber.js', () => ({ Chamber: mocks.Chamber }));

import { createChamberSession } from './chamber-session-factory.js';

function deferred() {
    let resolve;
    const promise = new Promise(res => { resolve = res; });
    return { promise, resolve };
}

function setup() {
    const events = [];
    const conductor = { destroy: vi.fn() };
    const cortex = {
        warmImagery: vi.fn(), resetSessionVisualIdentity: vi.fn(),
        updateConfig: vi.fn()
    };
    const audio = { stopAmbient: vi.fn(), stopSession: vi.fn(), sessionActive: false };
    const operations = {
        getCurrentSession: vi.fn(), router: { back: vi.fn() },
        ensureVisualCortex: vi.fn(async () => { events.push('visual'); return cortex; }),
        ensureAudioEngine: vi.fn(async () => { events.push('audio'); }),
        getAudioEngine: vi.fn(() => audio), getVisualCortex: vi.fn(() => cortex),
        getSettings: vi.fn(() => ({})), updateLoadingStatus: vi.fn(),
        showLoading: vi.fn(), hideLoading: vi.fn(), showToast: vi.fn(),
        handleSettingsChange: vi.fn(), handleDataCleared: vi.fn()
    };
    const session = {
        name: 'Test reading', wpm: 200, totalDuration: 1000, atoms: [{ content: 'First passage.' }],
        visualConfig: { visualMode: 'off' }, sources: []
    };
    mocks.Player.mockImplementation(function (_session, options) {
        events.push('player');
        this.options = options;
        this.on = vi.fn();
        this.stop = vi.fn();
    });
    mocks.Chamber.mockImplementation(function (_container, options) {
        events.push('chamber');
        this.options = options;
    });
    return { events, conductor, operations, session, audio, cortex };
}

describe('createChamberSession Jev gate', () => {
    afterEach(() => document.body.replaceChildren());

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('waits for consent before initializing engines, Player, or Chamber', async () => {
        const state = setup();
        const gate = deferred();
        mocks.requestJevSession.mockReturnValue(gate.promise);

        const container = document.createElement('div');
        document.body.append(container);
        const pending = createChamberSession(state.operations, container, state.session);
        await Promise.resolve();
        expect(mocks.requestJevSession).toHaveBeenCalledWith(container, {
            mode: 'reading', pace: 200, onExit: expect.any(Function)
        });
        expect(state.operations.ensureVisualCortex).not.toHaveBeenCalled();
        expect(state.operations.ensureAudioEngine).not.toHaveBeenCalled();
        expect(mocks.Player).not.toHaveBeenCalled();
        expect(mocks.Chamber).not.toHaveBeenCalled();

        gate.resolve(state.conductor);
        const instance = await pending;
        expect(state.events.indexOf('visual')).toBeGreaterThan(-1);
        expect(state.events.indexOf('player')).toBeGreaterThan(state.events.indexOf('audio'));
        expect(state.events.indexOf('chamber')).toBeGreaterThan(state.events.indexOf('player'));
        expect(mocks.Player).toHaveBeenCalledWith(state.session, { jevConductor: state.conductor });
        expect(instance.options.player.options.jevConductor).toBe(state.conductor);
    });

    it('exits without initializing anything when the reader declines consent', async () => {
        const state = setup();
        state.session.wpm = null;
        mocks.requestJevSession.mockImplementation((_container, { onExit }) => {
            onExit();
            return Promise.resolve(null);
        });

        await createChamberSession(state.operations, document.createElement('div'), state.session);
        expect(state.operations.router.back).toHaveBeenCalledOnce();
        expect(mocks.requestJevSession.mock.calls[0][1].pace).toBe(200);
        expect(state.operations.ensureVisualCortex).not.toHaveBeenCalled();
        expect(state.operations.ensureAudioEngine).not.toHaveBeenCalled();
        expect(mocks.Player).not.toHaveBeenCalled();
        expect(mocks.Chamber).not.toHaveBeenCalled();
    });

    it('discards consent if its route container was removed while the prompt was open', async () => {
        const state = setup();
        const gate = deferred();
        const container = document.createElement('div');
        document.body.append(container);
        mocks.requestJevSession.mockReturnValue(gate.promise);
        const pending = createChamberSession(state.operations, container, state.session);
        container.remove();
        gate.resolve(state.conductor);

        await pending;
        expect(state.conductor.destroy).toHaveBeenCalledOnce();
        expect(state.operations.ensureVisualCortex).not.toHaveBeenCalled();
        expect(state.operations.ensureAudioEngine).not.toHaveBeenCalled();
        expect(mocks.Player).not.toHaveBeenCalled();
        expect(mocks.Chamber).not.toHaveBeenCalled();
    });
});
