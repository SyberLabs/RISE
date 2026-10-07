/**
 * The text and the voice, through a Dive and back, and through a second one.
 *
 * The whole runtime, the Player and the browser voice, on a fake speech device,
 * with a voice that reports word boundaries and one that never does (the
 * network voices of Chrome and the online "Natural" voices of Edge). What is
 * held: when the reader surfaces, the voice takes up at the start of the phrase
 * on screen, and that phrase is shown again and is timed by the voice, so the
 * two begin it together; that holds for a second Dive and Surface, and for the
 * other ways back from a Dive (one that fails to open, then a resume), and a
 * Dive landing in a flash between two phrases leaves the voice where it was.
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
    delete document.hidden;
    delete document.visibilityState;
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/** Hide or show the page, as a switch of tab does, and as a frame that is taken away does on its way out. */
function setHidden(hidden) {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
}

function build({ boundaries, paced = false, failDive = false, flash = false }) {
    const synth = createFakeSpeech(clock, { msPerChar: MS_PER_CHAR, latencyMs: 30, boundaries });
    const spoken = [];
    const speak = synth.speak.bind(synth);
    synth.speak = utterance => { spoken.push({ at: performance.now(), text: utterance.text }); speak(utterance); };
    const atoms = [];
    const players = [];
    const mock = createMockAdapter({ clock });
    const adapter = { ...mock, open: async input => { if (failDive && input.intent === 'dive') throw new Error('no route'); return mock.open(input); } };
    runtime = createLiveRuntime({
        adapter,
        clock,
        createPlayer: (session, { role }) => {
            const player = new Player(session);
            if (role === 'main') players.push(player);
            if (role === 'main' && flash) {
                // A flash of moving imagery between phrases, as the Chamber shows during a Live reading.
                session.visualConfig = { visualMode: 'interlocution', interlocution: { frequency: 1 } };
                player.setInterlocutionHandler(() => new Promise(resolve => setTimeout(() => resolve({ presented: true, durationMs: 1_200 }), 1_200)));
            }
            player.on('atom', ({ index, atom, concealed }) => {
                if (!concealed) atoms.push({ at: performance.now(), role, index, text: atom?.content ?? '' });
            });
            return player;
        },
        voices: { create: () => (paced ? createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR }) : createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock })) },
        host: { present: async () => {}, dismiss: () => {} }
    });
    return { atoms, spoken, players, synth };
}

const main = atoms => atoms.filter(entry => entry.role === 'main');
const passageOf = id => runtime.composed('main').segments.find(segment => segment.id === id).text;

/** How long after the voice reached the start of a phrase the text showed it, in ms (negative: the text was ahead of the voice). */
function lagOf(spoken, segment, shown) {
    const passage = passageOf(segment);
    const start = passage.indexOf(shown.text);
    // Said from some character on: what the voice spoke is always the rest of the passage from there.
    const said = spoken.filter(entry => entry.at <= shown.at && entry.text.length > 0 && passage.endsWith(entry.text) && passage.length - entry.text.length <= start).at(-1);
    return shown.at - (said.at + 30 + (start - (passage.length - said.text.length)) * MS_PER_CHAR);
}

/** The first new phrase shown after the reader came back, in the passage they were in. */
const nextPhrase = (atoms, since, passageId, after) => main(atoms).slice(since)
    .find(entry => entry.index > after.index && entry.text !== '' && passageOf(passageId).includes(entry.text));

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

/** The voice said the phrase that was on screen again from its first character, and the same phrase was shown again from its start. */
function expectTakenUpTogether({ atoms, spoken }, before, { segment, atom }) {
    const resumed = spoken.slice(before.spoken).find(entry => passageOf(segment).endsWith(entry.text) && entry.text.length > 0);
    expect(resumed?.text).toBe(passageOf(segment).slice(passageOf(segment).indexOf(atom.text)));
    expect(main(atoms).slice(before.atoms)[0]).toMatchObject({ index: atom.index, text: atom.text });
}

for (const boundaries of [true, false]) {
    describe(`${boundaries ? 'a voice that reports word boundaries' : 'a voice that reports none'}, held and taken up again without a Dive`, () => {
        it('takes up the phrase on screen again, the voice and the words together, when the reader pauses and plays', async () => {
            const built = build({ boundaries });
            await runtime.start('Explain black holes.');
            const at = await readUntilMidPassage(built.atoms, { afterFirst: true });
            await runtime.interrupt();
            await tick(2_000);
            const before = { spoken: built.spoken.length, atoms: main(built.atoms).length };
            runtime.resume();
            await tick(200);
            expectTakenUpTogether(built, before, at);
        });

        it('leaves nothing holding the speech engine while the page is hidden, and takes up the phrase on screen with the voice when it is shown', async () => {
            const built = build({ boundaries });
            await runtime.start('Explain black holes.');
            const at = await readUntilMidPassage(built.atoms, { afterFirst: true });
            setHidden(true);
            // The engine is the whole browser's: a page that is hidden may be taken away, and a pause would outlive it.
            expect(built.synth.paused).toBe(false);
            expect(built.synth.speaking).toBe(false);
            await tick(5_000);
            const before = { spoken: built.spoken.length, atoms: main(built.atoms).length };
            setHidden(false);
            await tick(200);
            expectTakenUpTogether(built, before, at);
            expect(runtime.snapshot().status).toBe('live');
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

for (const boundaries of [true, false]) {
    describe(`${boundaries ? 'a voice that reports word boundaries' : 'a voice that reports none'}, on the other ways back from a Dive`, () => {
        it('keeps the text and the voice together after a Dive that fails to open', async () => {
            const { atoms, spoken } = build({ boundaries, failDive: true });
            await runtime.start('Explain black holes.');
            const { segment, atom } = await readUntilMidPassage(atoms, { afterFirst: true });
            // Well into the phrase, so that a text clock left running from before would be well ahead of the voice.
            await tick(Math.round(atom.text.length * MS_PER_CHAR * 0.6));
            const since = main(atoms).length;
            await expect(runtime.dive({ question: 'dive on event horizon' })).rejects.toThrow();
            await tick(8_000);
            const next = nextPhrase(atoms, since, segment, atom);
            expect(Math.abs(lagOf(spoken, segment, next))).toBeLessThan(400);
        });

        it('keeps them together on a resume, after the reader held the reading and the Dive failed to open', async () => {
            const { atoms, spoken } = build({ boundaries, failDive: true });
            await runtime.start('Explain black holes.');
            const { segment, atom } = await readUntilMidPassage(atoms, { afterFirst: true });
            await tick(Math.round(atom.text.length * MS_PER_CHAR * 0.6));
            runtime.hold();
            await expect(runtime.dive({ question: 'dive on event horizon' })).rejects.toThrow();
            expect(runtime.snapshot().status).toBe('interrupted');
            await tick(2_000);
            const since = main(atoms).length;
            runtime.resume();
            await tick(8_000);
            const next = nextPhrase(atoms, since, segment, atom);
            expect(Math.abs(lagOf(spoken, segment, next))).toBeLessThan(400);
        });

        // A voice with no boundaries has no place in the phrase to be left at: it says its passage again from the start, as it always did.
        for (const how of ['directly', 'after the reader held the reading']) it.runIf(boundaries)(`leaves the voice where it was when the Dive lands in a flash between two phrases, ${how}`, async () => {
            const { atoms, spoken, players } = build({ boundaries, flash: true });
            Math.random.mockReturnValue(0);
            await runtime.start('Explain black holes.');
            const { segment, atom } = await readUntilMidPassage(atoms, { afterFirst: true });
            for (let waited = 0; players[0].sessionState.state !== 'interlocuting' && waited < 20_000; waited += 20) await tick(20);
            expect(players[0].sessionState.state).toBe('interlocuting');
            const flashed = main(atoms).at(-1);
            if (how !== 'directly') {
                runtime.hold();
                expect(players[0].sessionState.state).toBe('paused');
            }
            await runtime.dive({ question: 'dive on event horizon' });
            await tick(3_000);
            const since = main(atoms).length;
            await runtime.surface();
            await tick(10_000);
            // The phrase that had finished is not shown again, and the next one is not shown ahead of the voice.
            const next = nextPhrase(atoms, since, segment, flashed);
            expect(main(atoms).slice(since).some(entry => entry.index === flashed.index && entry.text === flashed.text)).toBe(false);
            expect(lagOf(spoken, segment, next)).toBeGreaterThan(-400);
            expect(atom.index).toBeLessThanOrEqual(flashed.index);
        });
    });
}
