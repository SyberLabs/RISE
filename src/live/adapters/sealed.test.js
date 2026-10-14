/**
 * The room's third source: a sealed Current already admitted on the page. What must be true of it: it opens no
 * request of any kind (nothing here calls a model), it gives the runtime the whole Current to compile, it reads in
 * the reducer as the Current it is, under the Current's own origin, and it takes no scene that is not the Current's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createCurrentStream } from '../stream.js';
import { validateRiseCurrent } from '../../core/rise-current.js';
import { changesDigestFixture, REFUSED_SCENE } from '../../test/changes-digest.fixture.js';
import { createSealedAdapter } from './sealed.js';

const ASK = { intent: 'answer', prompt: 'What changed in RISE, 12–13 October' };

afterEach(() => vi.unstubAllGlobals());

async function read(connection) {
    const stream = createCurrentStream();
    for await (const event of connection.events) stream.apply(event);
    return stream;
}

describe('a sealed Current already admitted on the page', () => {
    it('reads whole, under its own origin, and never opens a request', async () => {
        const fetcher = vi.fn();
        const sockets = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        vi.stubGlobal('XMLHttpRequest', sockets);
        vi.stubGlobal('WebSocket', sockets);
        vi.stubGlobal('EventSource', sockets);
        const { current } = changesDigestFixture();
        const adapter = createSealedAdapter({ current, clock: createVirtualClock() });
        expect(adapter.capabilities).toMatchObject({ dives: false, microphone: false, providerAudio: false });
        const connection = await adapter.open(ASK);
        const view = (await read(connection)).snapshot();
        expect(view.phase).toBe('complete');
        expect(view.origin).toEqual(current.origin);
        expect(view.segments).toHaveLength(validateRiseCurrent(current).beats.length);
        expect(view.segments[0].text).toBe(current.beats[0].say);
        expect(connection.sealed).toBe(current);
        await adapter.open(ASK);
        expect(fetcher).not.toHaveBeenCalled();
        expect(sockets).not.toHaveBeenCalled();
    });

    it('has no Dive to ask for: no model is there to answer one', async () => {
        const adapter = createSealedAdapter({ current: changesDigestFixture().current, clock: createVirtualClock() });
        await expect(adapter.open({ intent: 'dive', prompt: 'Why?', parent: { currentId: 'answer-mcp-0', segmentId: 'beat-0', atCharacter: 0, context: ['x'] } }))
            .rejects.toMatchObject({ code: 'DIVE_UNAVAILABLE' });
    });

    it('takes only the scenes of the Current it was given, and refuses a Current that is not admissible', () => {
        const { current } = changesDigestFixture();
        const adapter = createSealedAdapter({ current, clock: createVirtualClock() });
        expect(adapter.admitScene(REFUSED_SCENE)).toMatch(/was refused/u);
        expect(() => createSealedAdapter({ current: { ...current, beats: [] }, clock: createVirtualClock() })).toThrow();
    });
});
