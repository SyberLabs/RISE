/**
 * The interjection in the runtime (docs/plans/LIVE-CURRENT.md §17): the reader speaks mid-reading, the voice holds at
 * the phrase, one new request goes up on the room's adapter, the answer is grafted into the same run after the held
 * passage and said by the same voice, and the ending it named takes the reading on.
 *
 * The whole runtime on one time source (vitest's fake timers): a text-stream adapter reading a scripted model through
 * the real parser, the real reducer, Player, speech governor, beat conductor and synthetic voice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const MS_PER_CHAR = 20;
const HELD = 'Its edge is the event horizon. Past it, escaping would take more than the speed of light.';
const ROOM = [
    '@say A black hole is a region of space where gravity is so strong that nothing escapes.',
    '@scene field attractor palette=purple',
    '@hold 1200 scene=field cue=calm',
    `@say ${HELD}`,
    '@hold 1500 cue=calm',
    '@say The black hole itself stays dark.',
    ''
].join('\n');
const ANSWERS = {
    resume: '@say The horizon is not a surface.\n@say Nothing there would stop you.\n@then resume\n',
    replace: '@say In short, light cannot leave it.\n@say That is the whole of it.\n@then replace\n',
    end: '@say That is all there is to say.\n@then end\n',
    unnamed: '@say The horizon is not a surface.\n'
};

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime = null;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
    await runtime?.stop();
    runtime = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/**
 * A room on the scripted model. `answer(request)` is what the model writes to an interjection, after `latencyMs`; a
 * function returning { fail } makes the provider fail instead. What the voice was given and said is recorded.
 */
async function open({ answer = () => ANSWERS.resume, latencyMs = 400 } = {}) {
    const clock = createRealClock();
    const requests = [];
    const closed = [];
    const adapter = createTextStreamAdapter({
        id: 'scripted', provider: 'test',
        connect: async (request, sink) => {
            requests.push(request);
            const text = request.intent === 'interject' ? answer(request) : ROOM;
            const index = requests.length - 1;
            const timer = setTimeout(() => {
                if (text?.fail) { sink.error({ code: text.fail, message: 'The provider failed.', recoverable: false }); return; }
                sink.delta(text);
                sink.done();
            }, request.intent === 'interject' ? latencyMs : 50);
            return { cancel: () => clearTimeout(timer), close: () => { clearTimeout(timer); closed.push(index); } };
        }
    });
    const given = new Map();
    const said = [];
    let voices = 0;
    let speaking = 0;
    let overlaps = 0;
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => new Player(session),
        voices: {
            create: () => {
                voices += 1;
                const voice = createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 50 });
                const attach = voice.attach.bind(voice);
                voice.attach = callbacks => attach({
                    ...callbacks,
                    start: id => { speaking += 1; if (speaking > 1) overlaps += 1; said.push({ at: performance.now(), id, text: given.get(id) }); callbacks.start(id); },
                    end: (id, durationMs) => { speaking = Math.max(0, speaking - 1); callbacks.end(id, durationMs); }
                });
                // A voice silenced (held, sought, cancelled) is saying nothing.
                for (const name of ['hold', 'seek', 'cancel']) {
                    const original = voice[name].bind(voice);
                    voice[name] = (...args) => { speaking = 0; return original(...args); };
                }
                const enqueue = voice.enqueue.bind(voice);
                voice.enqueue = item => { given.set(item.id, item.text); return enqueue(item); };
                return voice;
            }
        },
        host: { present: async () => {}, dismiss: () => {} }
    });
    await runtime.start('Explain black holes.');
    await tick(100);
    return {
        requests, closed, said,
        voices: () => voices,
        overlaps: () => overlaps,
        journal: type => runtime.journal().filter(entry => entry.type === type),
        texts: () => runtime.passages().map(passage => passage.text)
    };
}

/** Play until the voice is part way into the passage `id`: some words of it said, its first phrase behind it. */
async function into(id, { chars = 40 } = {}) {
    for (let waited = 0; waited < 60_000; waited += 20) {
        if (runtime.position()?.segmentId === id && runtime.position().atomIndex > 0) break;
        await tick(20);
    }
    await tick(chars * MS_PER_CHAR);
    expect(runtime.position().segmentId).toBe(id);
}

async function until(test, limitMs = 60_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 50) await tick(50);
    expect(test()).toBe(true);
}

/** The passages spoken from `from` on, as the voice was given them. */
const spokenAfter = (said, from) => said.filter(entry => entry.at >= from).map(entry => entry.text);

describe('held at the boundary', () => {
    it('holds the voice and the words where they are, and cancels nothing', async () => {
        const room = await open();
        await into('beat-2');
        const before = runtime.position();
        runtime.beginInterjection();
        expect(runtime.status).toBe('interrupted');
        expect(runtime.snapshot().interjection).toEqual({ state: 'held', failed: null });
        const heldAt = room.said.length;
        await tick(3_000);
        expect(room.said).toHaveLength(heldAt);
        expect(runtime.position()).toEqual(before);
        expect(room.journal('interjection.held')).toEqual([expect.objectContaining({ segmentId: 'beat-2' })]);
        // The interjection's own hold is not a pause the reader made: nothing of it goes up as perception.
        expect(room.journal('hold')).toEqual([]);
    });

    it('is refused when the reading is not playing, and twice', async () => {
        await open();
        await into('beat-2');
        runtime.hold();
        expect(() => runtime.beginInterjection()).toThrow(expect.objectContaining({ code: 'NOT_LIVE' }));
        runtime.resume();
        runtime.beginInterjection();
        expect(() => runtime.beginInterjection()).toThrow(expect.objectContaining({ code: 'INTERJECTING' }));
        await expect(runtime.dive({ question: 'Why?' })).rejects.toMatchObject({ code: 'INTERJECTING' });
    });
});

describe('the question goes up with the room', () => {
    it('is one new request on the room’s adapter: the words, the reading so far with the place marked, and the reader’s actions', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        const perception = { events: [{ type: 'replayed', from: 1, to: 1, times: 1, quote: 'A black hole.' }], earlier: 0 };
        await runtime.interject('What is the horizon, really?', { perception });
        expect(runtime.snapshot().interjection.state).toBe('asking');
        expect(room.requests).toHaveLength(2);
        expect(room.requests[1]).toEqual({
            intent: 'interject', prompt: 'What is the horizon, really?', perception,
            reading: { passages: [ROOM.split('\n')[0].slice(5), HELD, 'The black hole itself stays dark.'], at: 1 }
        });
        expect(room.journal('interjection.asked')).toEqual([expect.objectContaining({ segmentId: 'beat-2' })]);
        expect(room.journal('perception.sent')).toEqual([expect.objectContaining({ count: 1, kinds: ['replayed'] })]);
    });

    it('keeps the voice held through the request: nothing is said until the answer’s first beat', async () => {
        const room = await open({ latencyMs: 2_000 });
        await into('beat-2');
        runtime.beginInterjection();
        const asked = performance.now();
        await runtime.interject('What is the horizon?');
        await until(() => room.said.some(entry => entry.at > asked));
        const first = room.said.find(entry => entry.at > asked);
        expect(first.text).toBe('The horizon is not a surface.');
        expect(first.at - asked).toBeGreaterThanOrEqual(2_000);
    });
});

describe('the answer inside the room, and resume', () => {
    it('is said after the held passage by the same voice, then the held passage is taken up from its phrase, then the rest', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        const asked = performance.now();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.status === 'ended');

        const spoken = spokenAfter(room.said, asked);
        expect(spoken.slice(0, 2)).toEqual(['The horizon is not a surface.', 'Nothing there would stop you.']);
        expect(spoken[2]).not.toBe(HELD);
        expect(HELD.endsWith(spoken[2])).toBe(true);
        expect(spoken.at(-1)).toBe('The black hole itself stays dark.');
        expect(room.voices()).toBe(1);
        expect(room.overlaps()).toBe(0);
        expect(room.journal('interjection.answered')).toEqual([expect.objectContaining({ beats: 2, ending: 'resume' })]);
        expect(runtime.snapshot().interjection).toEqual({ state: 'none', failed: null });
    });

    it('numbers every beat of the run by its place, the answer’s among them', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.snapshot().interjection.state === 'none');
        const passages = runtime.passages();
        expect(passages.map(passage => passage.segmentId)).toEqual(passages.map((_, n) => `beat-${n}`));
        expect(room.texts().slice(3, 5)).toEqual(['The horizon is not a surface.', 'Nothing there would stop you.']);
    });

    it('resumes when the answer names no ending', async () => {
        const room = await open({ answer: () => ANSWERS.unnamed });
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.status === 'ended');
        expect(room.journal('interjection.answered')).toEqual([expect.objectContaining({ beats: 1, ending: 'resume' })]);
        expect(room.said.at(-1).text).toBe('The black hole itself stays dark.');
    });
});

describe('the reader’s controls hold throughout', () => {
    it('Back from the first answer passage returns to the held passage', async () => {
        await open();
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.position()?.segmentId === 'beat-3');
        runtime.seek({ delta: -1 });
        expect(runtime.position().segmentId).toBe('beat-2');
        expect(runtime.passages()[2].text).toBe(HELD);
    });

    it('Pause during the answer holds the answer, and Play takes it up', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.position()?.segmentId === 'beat-3');
        await tick(100);
        runtime.hold();
        const at = runtime.position();
        const count = room.said.length;
        await tick(3_000);
        expect(runtime.position()).toEqual(at);
        expect(room.said).toHaveLength(count);
        runtime.resume();
        await until(() => room.said.length > count);
        expect(room.overlaps()).toBe(0);
    });
});

describe('replace and end', () => {
    it('replace: the rest of the reading never plays, and the reading ends with the answer', async () => {
        const room = await open({ answer: () => ANSWERS.replace });
        await into('beat-2');
        runtime.beginInterjection();
        const asked = performance.now();
        await runtime.interject('Skip the rest.');
        await until(() => runtime.status === 'ended');
        expect(spokenAfter(room.said, asked)).toEqual(['In short, light cannot leave it.', 'That is the whole of it.']);
        expect(room.texts()).toHaveLength(5);
        expect(room.journal('interjection.answered')).toEqual([expect.objectContaining({ beats: 2, ending: 'replace' })]);
    });

    it('end: the answer is the end of the reading', async () => {
        const room = await open({ answer: () => ANSWERS.end });
        await into('beat-2');
        runtime.beginInterjection();
        const asked = performance.now();
        await runtime.interject('Is that all?');
        await until(() => runtime.status === 'ended');
        expect(spokenAfter(room.said, asked)).toEqual(['That is all there is to say.']);
        expect(room.journal('interjection.answered')).toEqual([expect.objectContaining({ beats: 1, ending: 'end' })]);
    });
});

describe('when it does not go as asked', () => {
    it('a failed request gives the held reading back from the held passage, and says why', async () => {
        const room = await open({ answer: () => ({ fail: 'PROVIDER_FAILED' }) });
        await into('beat-2');
        runtime.beginInterjection();
        const asked = performance.now();
        await runtime.interject('What is the horizon?');
        await until(() => room.journal('interjection.failed').length > 0);
        expect(room.journal('interjection.failed')).toEqual([expect.objectContaining({ reason: 'PROVIDER_FAILED' })]);
        expect(runtime.snapshot().interjection).toEqual({ state: 'none', failed: 'PROVIDER_FAILED' });
        expect(runtime.status).toBe('live');
        expect(runtime.position().segmentId).toBe('beat-2');
        await until(() => runtime.status === 'ended');
        expect(spokenAfter(room.said, asked)).toEqual(['The black hole itself stays dark.']);
        expect(room.texts()).toHaveLength(5);
    });

    it('cancelled before the answer, the reading plays on and the answer is never heard', async () => {
        const room = await open({ latencyMs: 2_000 });
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        runtime.cancelInterjection();
        expect(runtime.status).toBe('live');
        expect(room.closed).toContain(1);
        await until(() => runtime.status === 'ended');
        expect(room.said.map(entry => entry.text)).not.toContain('The horizon is not a surface.');
        expect(room.journal('interjection.cancelled')).toHaveLength(1);
        expect(room.journal('resume')).toEqual([]);
    });

    it('Play on a held interjection cancels it, as Escape does', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        runtime.resume();
        expect(runtime.status).toBe('live');
        expect(runtime.snapshot().interjection.state).toBe('none');
        expect(room.journal('interjection.cancelled')).toHaveLength(1);
        expect(room.requests).toHaveLength(1);
    });

    it('a second interjection, after the first was answered, cuts the arranged reading where the reader is', async () => {
        const room = await open();
        await into('beat-2');
        runtime.beginInterjection();
        await runtime.interject('What is the horizon?');
        await until(() => runtime.position()?.segmentId === 'beat-4');
        await tick(200);
        runtime.beginInterjection();
        await runtime.interject('Why not?');
        await until(() => runtime.status === 'ended');
        expect(room.journal('interjection.answered')).toHaveLength(2);
        expect(room.texts().slice(3, 7)).toEqual(['The horizon is not a surface.', 'Nothing there would stop you.', 'The horizon is not a surface.', 'Nothing there would stop you.']);
        expect(room.overlaps()).toBe(0);
        expect(room.voices()).toBe(1);
    });
});
