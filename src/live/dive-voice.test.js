/**
 * The text and the voice, through a Dive and back, and through a second one.
 *
 * The whole runtime, the Player and the browser voice, on a fake speech device,
 * with a voice that reports word boundaries and one that never does (the
 * network voices of Chrome and the online "Natural" voices of Edge). What is
 * held: when the reader surfaces, the voice takes up at the start of the phrase
 * on screen, and that phrase is shown again and is timed by the voice, so the
 * two begin it together; and all of it holds for a second Dive and Surface.
 * A voice with no boundaries has no known speed until it has said a whole
 * passage, so in the first one nothing is changed from what it always did.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createFakeSpeech } from '../test/fake-speech.js';
import { createMockAdapter } from './adapters/mock.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createBrowserVoice } from './voices/browser.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const clock = createRealClock();
const tick = ms => vi.advanceTimersByTimeAsync(ms);
const MS_PER_CHAR = 65;
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

function build({ boundaries, paced = false }) {
    const synth = createFakeSpeech(clock, { msPerChar: MS_PER_CHAR, latencyMs: 30, boundaries });
    const spoken = [];
    const speak = synth.speak.bind(synth);
    synth.speak = utterance => { spoken.push({ at: performance.now(), text: utterance.text }); speak(utterance); };
    const atoms = [];
    runtime = createLiveRuntime({
        adapter: createMockAdapter({ clock }),
        clock,
        createPlayer: (session, { role }) => {
            const player = new Player(session);
            player.on('atom', ({ index, atom, concealed }) => {
                if (!concealed) atoms.push({ at: performance.now(), role, index, text: atom?.content ?? '' });
            });
            return player;
        },
        voices: { create: () => (paced ? createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR }) : createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock })) },
        host: { present: async () => {}, dismiss: () => {} }
    });
    return { atoms, spoken };
}

const main = atoms => atoms.filter(entry => entry.role === 'main');
const passageOf = id => runtime.composed('main').segments.find(segment => segment.id === id).text;

/** Read on until the text is on a later phrase of a passage, not its first; `afterFirst`: and not in the first passage. */
async function readUntilMidPassage(atoms, { afterFirst = false } = {}) {
    for (let waited = 0; waited < 30_000; waited += 100) {
        await tick(100);
        const first = runtime.composed('main')?.segments[0]?.id;
        const here = main(atoms).at(-1);
        const segment = runtime.snapshot().main?.segmentId;
        if (afterFirst && segment === first) continue;
        if (here && segment && passageOf(segment).indexOf(here.text) > 0) return { segment, atom: here };
    }
    throw new Error('the text never reached a later phrase of a passage');
}

for (const boundaries of [true, false]) {
    describe(boundaries ? 'a voice that reports word boundaries' : 'a voice that reports none', () => {
        it('takes up again at the start of the phrase on screen when the reader surfaces, and shows that phrase again', async () => {
            const { atoms, spoken } = build({ boundaries });
            await runtime.start('Explain black holes.');
            const { segment, atom } = await readUntilMidPassage(atoms, { afterFirst: true });
            const phraseStart = passageOf(segment).indexOf(atom.text);

            await runtime.dive({ question: 'dive on event horizon' });
            await tick(3_000);
            const before = { spoken: spoken.length, atoms: main(atoms).length };
            await runtime.surface();
            await tick(200);

            // The voice re-speaks from that phrase's first character, not the passage's, and not the last word it happened to hear.
            const resumed = spoken.slice(before.spoken).find(entry => passageOf(segment).endsWith(entry.text) && entry.text.length > 0);
            expect(resumed?.text).toBe(passageOf(segment).slice(phraseStart));
            // And the same phrase is on screen again, from its start.
            const again = main(atoms).slice(before.atoms);
            expect(again[0]).toMatchObject({ index: atom.index, text: atom.text });
        });

        it('does not flash a phrase past unread after surfacing, through a second Dive and Surface as well', async () => {
            const { atoms } = build({ boundaries });
            await runtime.start('Explain black holes.');
            await readUntilMidPassage(atoms, { afterFirst: true });
            for (let round = 0; round < 2; round += 1) {
                await runtime.dive({ question: 'dive on event horizon' });
                await tick(3_000);
                const at = main(atoms).length;
                await runtime.surface();
                await tick(6_000);
                // Phrases only: the empty atom between two passages lasts until the voice begins the next, by design.
                const after = main(atoms).slice(at).filter(entry => entry.text !== '');
                for (let i = 1; i < after.length; i += 1) {
                    // Every phrase is on screen for long enough to be read, however the voice and the text came back together.
                    expect(after[i].at - after[i - 1].at, `round ${round}: atom ${after[i - 1].index} then ${after[i].index}`).toBeGreaterThanOrEqual(300);
                }
                if (round === 0) await readUntilMidPassage(atoms, { afterFirst: true });
            }
        });
    });
}

describe('a voice that reports no boundaries, in the first passage, before its speed is known', () => {
    it('is taken up as it always was: said again from the start, the phrase on screen not shown again', async () => {
        const { atoms, spoken } = build({ boundaries: false });
        await runtime.start('Explain black holes.');
        const { segment, atom } = await readUntilMidPassage(atoms);
        expect(segment).toBe(runtime.composed('main').segments[0].id);
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(3_000);
        const before = { spoken: spoken.length, atoms: main(atoms).length };
        await runtime.surface();
        await tick(200);
        const resumed = spoken.slice(before.spoken).find(entry => passageOf(segment).endsWith(entry.text) && entry.text.length > 0);
        expect(resumed?.text).toBe(passageOf(segment));
        expect(main(atoms).slice(before.atoms).some(entry => entry.index === atom.index && entry.text === atom.text)).toBe(false);
    });
});

describe('a voice that only pauses and carries on (the paced one)', () => {
    it('is not made to start the phrase again: it carries on from where it was, and so does the text, with no atom repeated', async () => {
        const { atoms } = build({ boundaries: true, paced: true });
        await runtime.start('Explain black holes.');
        const { atom } = await readUntilMidPassage(atoms);
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(3_000);
        const before = main(atoms).length;
        await runtime.surface();
        await tick(30_000);
        const after = main(atoms).slice(before).filter(entry => entry.text !== '');
        // The phrase it was on is not shown again; the next one is, and everything after it once each, in order.
        expect(after[0].index).toBeGreaterThan(atom.index);
        const indexes = after.map(entry => entry.index);
        expect(indexes).toEqual([...new Set(indexes)].sort((a, b) => a - b));
    });
});
