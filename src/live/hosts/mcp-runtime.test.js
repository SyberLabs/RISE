/**
 * The same runtime, in an MCP host.
 *
 * Nothing in the runtime knows a host is an MCP host: it is handed an adapter.
 * This drives the real runtime, Player, speech clock and a voice with the MCP
 * adapter over a fake host model, and holds the canonical flow to what it is
 * everywhere else: the answer is read, a Dive is asked of the model and answered
 * with its reference, Surface returns to the same atom, and it all ends clean.
 * A whole answer arrives at once, so the first words wait for it; that is the
 * one thing a host's model changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { createFakeMcpPort } from '../../test/fake-mcp-port.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';
import { createMcpAppAdapter } from '../adapters/mcp-app.js';
import { createRealClock } from '../clock.js';
import { createLiveRuntime } from '../runtime.js';
import { createSyntheticVoice } from '../voices/synthetic.js';

const clock = createRealClock();
const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});
afterEach(async () => {
    await runtime?.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

function build() {
    const shown = [];
    const port = createFakeMcpPort({ clock, answerAfterMs: 300 });
    runtime = createLiveRuntime({
        adapter: createMcpAppAdapter({ port, clock }),
        clock,
        createPlayer: session => {
            const player = new Player(session);
            player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
            return player;
        },
        voices: { create: () => createSyntheticVoice({ clock, msPerChar: 20 }) }
    });
    return { port, shown };
}

const once = list => list.every((index, i) => i === 0 || index === list[i - 1] + 1);

describe('the canonical flow through a host’s model', () => {
    it('reads the answer once it arrives, every atom once, in order', async () => {
        const { port, shown } = build();
        await runtime.start('Explain black holes.');
        await tick(250);
        expect(shown).toEqual([]);
        port.deliver({ current: BLACK_HOLES_CURRENT });
        await tick(200);
        expect(shown.length).toBeGreaterThan(0);
        await tick(120_000);
        expect(runtime.status).toBe('ended');
        expect(once(shown)).toBe(true);
        expect(runtime.composed().phase).toBe('complete');
    });

    it('takes a Dive by asking the model, holds the parent, and returns to the same atom', async () => {
        const { port, shown } = build();
        await runtime.start('Explain black holes.');
        port.deliver({ current: BLACK_HOLES_CURRENT });
        await tick(5_000);
        const before = runtime.snapshot().main;
        const parentShown = shown.length;

        await runtime.dive({ question: 'dive on event horizon' });
        expect(port.messages).toHaveLength(1);
        expect(port.messages[0]).toMatch(/rise_present/u);
        await tick(3_000);
        expect(runtime.snapshot().side.committedSegments).toBeGreaterThan(0);
        await tick(20_000);
        expect(runtime.snapshot().main.atomIndex).toBe(before.atomIndex);
        expect(shown.length).toBeGreaterThanOrEqual(parentShown);

        await runtime.surface();
        expect(runtime.snapshot().main.atomIndex).toBe(before.atomIndex);
        await tick(120_000);
        expect(runtime.status).toBe('ended');
    });

    it('says the Dive could not be answered, and leaves the parent where it was, when the model does not reply', async () => {
        const { port } = build();
        port.answers.silent = true;
        await runtime.start('Explain black holes.');
        port.deliver({ current: BLACK_HOLES_CURRENT });
        await tick(3_000);
        const before = runtime.snapshot().main.atomIndex;
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(70_000);
        expect(runtime.snapshot().side.error.code).toBe('NO_ANSWER');
        expect(runtime.snapshot().main.atomIndex).toBe(before);
        await runtime.surface();
        await tick(120_000);
        expect(runtime.status).toBe('ended');
    });

    it('releases every timer when stopped, from any moment', async () => {
        for (const moment of [0, 100, 400, 3_000]) {
            const { port } = build();
            await runtime.start('Explain black holes.');
            await tick(moment);
            if (moment >= 300) port.deliver({ current: BLACK_HOLES_CURRENT });
            await tick(moment >= 300 ? 100 : 0);
            await runtime.stop();
            expect(vi.getTimerCount(), `after ${moment} ms`).toBe(0);
        }
    });
});
