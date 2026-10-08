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
import { createChamberSession, isReadersOwn } from './chamber-session-factory.js';
import { offerLivePlayer } from './live-handoff.js';
import { Chamber } from '../components/read/Chamber.js';
import { voiceReading } from '../audio/plus-voice.js';
import { Voice } from '../audio/voice.js';
import { plusAllowance, plusState } from './plus.js';

vi.mock('../components/read/Chamber.js', () => ({
    Chamber: vi.fn(function Chamber(container, options) { this.options = options; this.announceMovement = vi.fn(); })
}));
vi.mock('../audio/plus-voice.js', async importOriginal => ({ ...await importOriginal(), voiceReading: vi.fn() }));
vi.mock('../audio/voice.js', () => ({
    Voice: vi.fn(function Voice(options) { this.options = options; this.prepare = async () => true; this.destroy = vi.fn(); })
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

describe('the Plus voice at the start of a reading', () => {
    const MANIFEST = { schema: 'rise.recitation-voice-pack.v1', voices: { el_plus: { entries: {} } } };
    const fetchImpl = async () => new Response(new Uint8Array([1]));
    const VOICED = { ok: true, voiceId: 'el_plus', manifest: MANIFEST, fetchImpl, allowance: { used: 18, limit: 105000, periodEnd: 1 } };
    /** A Composer Current: the reader's own material. */
    const reading = (text = 'A phrase of my own') => ({ ...session(), atoms: [{ content: text }], provenance: { currentId: 'cur-1' } });
    /** A voiced reading starts the engine's session, which the plain stub does not have. */
    const voiced = (op = operations()) => {
        const audio = op.getAudioEngine();
        audio.startSession = vi.fn(async () => {});
        return op;
    };

    afterEach(() => localStorage.clear());

    it('is not asked for until Plus is claimed here, or when the reading brings its own', async () => {
        await mount(operations(), reading());
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        vi.clearAllMocks();
        await mount(voiced(), { ...reading(), recitation: { enabled: true, pack: '/audio/recitation/el_reader/0.json' } });
        expect(voiceReading).not.toHaveBeenCalled();
        expect(Chamber.mock.calls[0][1].voice.options.packUrl).toBe('/audio/recitation/el_reader/0.json');
    });

    it('voices the reading once and hands the Chamber the pack as the clock', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue(VOICED);
        const options = await mount(voiced(), reading());

        expect(voiceReading).toHaveBeenCalledTimes(1);
        expect(voiceReading).toHaveBeenCalledWith(expect.any(Array), { voice: 'default' });
        expect(options.session).toMatchObject({
            revealMode: 'progressive', capabilities: ['recitation-audio'],
            recitation: { enabled: true, pack: null }, voiceId: 'el_plus'
        });
        // The kept voicing is handed to the Voice directly: no pack address, no audio URL.
        expect(Voice).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'el_plus', manifest: MANIFEST, fetchImpl }));
        expect(Voice.mock.calls[0][0]).not.toHaveProperty('packUrl');
        expect(plusAllowance()).toEqual({ used: 18, limit: 105000, periodEnd: 1 });
        expect(options.voice.onLapse).toBeTypeOf('function');
        options.voice.onLapse();
        expect(plusState().lapsed).toBe(true);
        expect(Chamber.mock.instances[0].announceMovement).toHaveBeenCalledWith('Plus voice has lapsed. Reading continues silently.');
    });

    it('reads silently, marks the lapse and says so when the Worker refuses', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue({ ok: false, code: 'PLUS_LAPSED', message: 'lapsed' });
        const options = await mount(operations(), reading());
        expect(options.voice).toBeNull();
        expect(options.session.recitation).toBeUndefined();
        expect(plusState().lapsed).toBe(true);
        expect(Chamber.mock.instances[0].announceMovement).toHaveBeenCalledWith('Plus voice has lapsed. Reading continues silently.');

        // Lapsed: not asked again until the reader claims again.
        vi.clearAllMocks();
        await mount(operations(), reading());
        expect(voiceReading).not.toHaveBeenCalled();
    });

    it('keeps the allowance refusal to a notice, and never sends a text past the cap', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue({ ok: false, code: 'PLUS_ALLOWANCE', message: 'used up' });
        await mount(operations(), reading());
        expect(plusState().lapsed).toBe(false);
        expect(Chamber.mock.instances[0].announceMovement).toHaveBeenCalledWith('This month\'s voice allowance is used up. Reading continues silently.');

        vi.clearAllMocks();
        await mount(operations(), reading('word '.repeat(2001)));
        expect(voiceReading).not.toHaveBeenCalled();
        expect(Chamber.mock.instances[0].announceMovement).toHaveBeenCalledWith('This reading is too long for the Plus voice.');
    });

    it('reads silently and says so when the voice could not be rendered (502)', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue({ ok: false, code: 'UPSTREAM', message: 'later' });
        const options = await mount(operations(), reading());
        expect(options.voice).toBeNull();
        expect(plusState().lapsed).toBe(false);
        expect(Chamber.mock.instances[0].announceMovement).toHaveBeenCalledWith('The Plus voice could not be rendered. Reading continues silently.');
    });

    it('voices only the reader\'s own material, never a library or canon reading', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue(VOICED);
        const text = [{ content: 'Sing, goddess, the wrath' }];
        const notOwn = [
            { ...session(), atoms: text },
            { ...session(), atoms: text, provenance: { kind: 'library-work', workId: 'the-iliad' }, origin: { view: 'library' } },
            { ...session(), atoms: text, origin: 'keystones' },
            { ...session(), atoms: text, isCustom: true, provenance: { kind: 'minted-program', slug: 'x' }, sources: [{ providerId: 'archive-ingest' }] },
            { ...session(), atoms: text, isCustom: true, sources: [{ providerId: 'local' }, { providerId: 'library-archive' }] }
        ];
        for (const reading of notOwn) {
            vi.clearAllMocks();
            const options = await mount(operations(), reading);
            expect(voiceReading).not.toHaveBeenCalled();
            expect(options.voice).toBeNull();
            expect(Chamber.mock.instances[0].announceMovement).not.toHaveBeenCalled();
        }

        expect(isReadersOwn({ provenance: { currentId: 'c' } })).toBe(true);
        expect(isReadersOwn({ provenance: { kind: 'personal-generated' } })).toBe(true);
        expect(isReadersOwn({ provenance: { kind: 'local-text' } })).toBe(true);
        expect(isReadersOwn({ isCustom: true, sources: [{ providerId: 'local' }, { providerId: 'recursion' }] })).toBe(true);
        expect(isReadersOwn({ sources: [{ providerId: 'local' }] })).toBe(false);
    });

    it('asks in the reader\'s chosen voice', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        voiceReading.mockResolvedValue(VOICED);
        const op = voiced();
        op.getSettings = () => ({ plusVoiceSlug: 'river' });
        await mount(op, reading());
        expect(voiceReading).toHaveBeenCalledWith(expect.any(Array), { voice: 'river' });
    });

    it('is left off by the reader\'s switch', async () => {
        localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1 }));
        const op = operations();
        op.getSettings = () => ({ plusVoice: false });
        await mount(op, reading());
        expect(voiceReading).not.toHaveBeenCalled();
    });
});
