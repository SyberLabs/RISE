import { describe, expect, it } from 'vitest';
import { addUsage, earlierFor, earlierLine, emptyUsage, faceStateOf, initialVenue, interjectionPerception, originLine, perceptionFor, usageLine, venueStep } from './venue-entry.js';
import { perceive } from '../perception.js';
import { OPEN_LIMITS, validateOpenRequest } from '../adapter.js';

const ready = { connected: false, hasKey: false };
const ask = (question, extra = {}) => ({ type: 'ask', question, ...ready, ...extra });

/** Run events from the start, returning the last state. */
const run = (...events) => events.reduce((state, event) => venueStep(state, event), initialVenue());

describe('the venue entry: idle → asking → reading → ended → asking again', () => {
    it('begins idle on the demo, with nothing asked', () => {
        expect(initialVenue()).toEqual({ phase: 'idle', provider: 'mock', held: false, question: '', turns: [], error: null });
    });

    it('asks a typed question on the demo, needing no key', () => {
        const state = run(ask('  Why is the sky blue?  '));
        expect(state).toMatchObject({ phase: 'asking', error: null, turns: [{ question: 'Why is the sky blue?' }] });
    });

    it('reads once the reading has opened, and ends when the runtime says so', () => {
        const reading = run(ask('Why?'), { type: 'opened' });
        expect(reading.phase).toBe('reading');
        expect(venueStep(reading, { type: 'status', status: 'ended' }).phase).toBe('ended');
    });

    it('asks again after the end, in the same room: the turns are carried', () => {
        const again = run(ask('First?'), { type: 'opened' }, { type: 'status', status: 'ended' }, ask('Second?'));
        expect(again.phase).toBe('asking');
        expect(again.turns.map(turn => turn.question)).toEqual(['First?', 'Second?']);
        expect(venueStep(again, { type: 'opened' }).phase).toBe('reading');
    });

    it('reads again when an ended reading is played again from its start, asking nothing', () => {
        const ended = run(ask('First?'), { type: 'opened' }, { type: 'status', status: 'ended' });
        const again = venueStep(ended, { type: 'status', status: 'live' });
        expect(again).toMatchObject({ phase: 'reading', held: false, turns: [{ question: 'First?' }] });
    });

    it('asks again while the reading is held, and not while it plays', () => {
        const playing = run(ask('First?'), { type: 'opened' }, { type: 'status', status: 'live' });
        const refused = venueStep(playing, ask('Second?'));
        expect(refused.phase).toBe('reading');
        expect(refused.turns).toHaveLength(1);
        const held = venueStep(playing, { type: 'status', status: 'interrupted' });
        expect(held.held).toBe(true);
        expect(venueStep(held, ask('Second?'))).toMatchObject({ phase: 'asking', held: false });
        expect(venueStep(venueStep(held, { type: 'status', status: 'live' }), { type: 'noop' }).held).toBe(false);
    });

    it('refuses an empty question in words, and stays where it was', () => {
        expect(run(ask('   '))).toMatchObject({ phase: 'idle', error: 'Ask something first.', turns: [] });
    });

    it('does not ask twice while a question is being asked', () => {
        const state = run(ask('First?'), ask('Second?'));
        expect(state.turns).toHaveLength(1);
    });

    it('clears a refusal once a question is asked', () => {
        const state = run(ask(''), ask('Now?'));
        expect(state.error).toBeNull();
    });

    it('goes back to where it was, saying why, when a question could not be asked', () => {
        const first = run(ask('First?'), { type: 'failed', message: 'Could not start: refused' });
        expect(first).toMatchObject({ phase: 'idle', error: 'Could not start: refused', turns: [] });
        const later = run(ask('First?'), { type: 'opened' }, { type: 'status', status: 'ended' }, ask('Second?'), { type: 'failed', message: 'no' });
        expect(later).toMatchObject({ phase: 'ended', turns: [{ question: 'First?' }] });
    });

    it('ends a reading that failed, saying why, and lets the reader ask again', () => {
        const failed = run(ask('First?'), { type: 'opened' }, { type: 'status', status: 'failed', message: 'It stopped.' });
        expect(failed).toMatchObject({ phase: 'ended', error: 'It stopped.' });
        expect(venueStep(failed, ask('Again?')).phase).toBe('asking');
    });

    it('leaves the room: back to the entry on the same provider, with nothing carried', () => {
        const left = run({ type: 'choose', provider: 'gemini' }, ask('First?', { hasKey: true }), { type: 'opened' }, { type: 'leave' });
        expect(left).toEqual({ ...initialVenue(), provider: 'gemini' });
    });
});

describe('the spoken path', () => {
    it('puts what was heard (cleaned by the microphone’s interpret) in the field, without asking it', () => {
        const state = run({ type: 'heard', text: 'what is a quasar' });
        expect(state).toMatchObject({ phase: 'idle', question: 'what is a quasar', turns: [] });
    });

    it('is asked like a typed question once the reader asks', () => {
        const heard = run({ type: 'heard', text: 'what is a quasar' });
        expect(venueStep(heard, ask(heard.question)).turns).toEqual([{ question: 'what is a quasar' }]);
    });
});

describe('the provider choice', () => {
    it('chooses a provider the registry offers, before the first question only', () => {
        expect(run({ type: 'choose', provider: 'gemini' }).provider).toBe('gemini');
        expect(run({ type: 'choose', provider: 'nonsense' }).provider).toBe('mock');
        expect(run({ type: 'choose', provider: 'openai' }).provider).toBe('openai');
        expect(run({ type: 'choose', provider: 'anthropic' }).provider).toBe('anthropic');
        expect(run({ type: 'choose', provider: 'openai-realtime' }).provider).toBe('mock');
        expect(run(ask('First?'), { type: 'choose', provider: 'gemini' }).provider).toBe('mock');
    });

    it('asks for the typed key of a keyed provider, and asks once it is there', () => {
        const chosen = run({ type: 'choose', provider: 'gemini' });
        expect(venueStep(chosen, ask('Why?'))).toMatchObject({ phase: 'idle', error: 'Enter your Gemini key to use this provider.' });
        expect(venueStep(chosen, ask('Why?', { hasKey: true })).phase).toBe('asking');
    });

    it('asks for the OpenRouter connection once its adapter is there, and says soon until then', () => {
        const soon = [{ id: 'mock', credential: 'none', adapter: async () => ({}) }, { id: 'openrouter', label: 'OpenRouter (your key)', credential: 'openrouter', adapter: null }];
        const landed = [soon[0], { ...soon[1], adapter: async () => ({}) }];
        const chosen = venueStep(initialVenue(), { type: 'choose', provider: 'openrouter' }, soon);
        expect(chosen.provider).toBe('openrouter');
        expect(venueStep(chosen, ask('Why?', { connected: true }), soon).error).toBe('OpenRouter is coming soon. Choose another provider.');
        expect(venueStep(chosen, ask('Why?'), landed).error).toBe('Connect OpenRouter first, or choose the demo.');
        expect(venueStep(chosen, ask('Why?', { connected: true }), landed).phase).toBe('asking');
    });

    it('never keeps a key: there is nowhere in the state for one', () => {
        const state = run({ type: 'choose', provider: 'gemini' }, ask('Why?', { hasKey: true, key: 'AIza-secret' }));
        expect(JSON.stringify(state)).not.toContain('AIza-secret');
    });
});

describe('the perception hook (design §4, §8 stage 4)', () => {
    const PASSAGES = [{ segmentId: 'beat-0', text: 'One.' }, { segmentId: 'beat-1', text: 'Two.' }, { segmentId: 'beat-2', text: 'Three.' }];
    const JOURNAL = [
        { at: 0, type: 'start', prompt: 'First?' },
        { at: 10, type: 'replay', from: 'beat-2', to: 'beat-2', reason: 'reader' },
        { at: 20, type: 'setting', parameter: 'theme', value: 'ember' },
        { at: 30, type: 'said', words: 'what about light' },
        { at: 40, type: 'interrupt', reason: 'user', segmentId: 'beat-2' }
    ];

    it('is what the reader did in the reading before the question being asked, rebuilt from its journal', () => {
        const turns = [{ question: 'First?', journal: JOURNAL, passages: PASSAGES }, { question: 'Second?' }];
        expect(perceptionFor(turns)).toEqual(perceive(JOURNAL, { passages: PASSAGES }));
        expect(perceptionFor(turns).events.map(event => event.type)).toEqual(['replayed', 'visual.changed', 'said', 'held']);
    });

    it('does not say twice the words the reader then asked with', () => {
        const turns = [{ question: 'First?', journal: JOURNAL, passages: PASSAGES }, { question: 'What about light?' }];
        expect(perceptionFor(turns).events.map(event => event.type)).toEqual(['replayed', 'visual.changed', 'held']);
    });

    it('is nothing for the first question, for a reading not yet let go, and for a reading in which the reader did nothing', () => {
        expect(perceptionFor([{ question: 'First?' }])).toBeNull();
        expect(perceptionFor([{ question: 'First?' }, { question: 'Second?' }])).toBeNull();
        expect(perceptionFor([{ question: 'First?', journal: [{ type: 'start' }, { type: 'speech.start', role: 'main' }] }, { question: 'Second?' }])).toBeNull();
    });
});

describe('what was said earlier in this room (LIVE-026)', () => {
    const PASSAGES = [
        { segmentId: 'beat-0', key: 'beat-0', text: 'Time is what clocks measure.', spoken: true, scene: 'field' },
        { segmentId: 'beat-1', key: 'beat-1', text: 'Why time', spoken: false },
        { segmentId: 'beat-2', key: 'beat-2', text: 'It runs one way.', spoken: true },
        { segmentId: 'beat-3', key: 'beat-3', text: 'Physics asks why.', spoken: true, scene: 'field' }
    ];
    const FINISHED = [{ at: 0, type: 'start', prompt: 'What is time?' }, { at: 90, type: 'run.finished', role: 'main' }];
    const reading = (question, more = {}) => ({ question, journal: FINISHED, passages: PASSAGES, reached: 3, ...more });

    it('is each earlier question and what RISE said in answer, in order, without the question being asked', () => {
        const turns = [reading('What is time?'), reading('And space?', { passages: [PASSAGES[2]], reached: 0 }), { question: 'What did Einstein say about it?' }];
        expect(earlierFor(turns)).toEqual([
            { asked: 'What is time?', said: 'Time is what clocks measure. It runs one way. Physics asks why.', showed: ['the scene field'] },
            { asked: 'And space?', said: 'It runs one way.' }
        ]);
    });

    it('is nothing for the first question', () => {
        expect(earlierFor([{ question: 'What is time?' }])).toBeNull();
        expect(earlierFor([])).toBeNull();
    });

    it('is the question alone for a reading not yet let go', () => {
        expect(earlierFor([{ question: 'What is time?' }, { question: 'Why?' }])).toEqual([{ asked: 'What is time?' }]);
    });

    it('keeps only what was said before a cut, and marks the cut', () => {
        const journal = [{ at: 0, type: 'start' }, { at: 20, type: 'hold', reason: 'user', segmentId: 'beat-2' }];
        expect(earlierFor([reading('What is time?', { journal, reached: 2 }), { question: 'Why?' }])).toEqual([
            { asked: 'What is time?', said: 'Time is what clocks measure. It runs one way.', showed: ['the scene field'], cut: true }
        ]);
    });

    it('counts as heard what the reader went back from before the cut', () => {
        const journal = [{ at: 0, type: 'start' }, { at: 20, type: 'seek', reason: 'reader', from: 'beat-3', fromKey: 'beat-3', to: 'beat-0', toKey: 'beat-0' }];
        expect(earlierFor([reading('What is time?', { journal, reached: 0 }), { question: 'Why?' }])[0])
            .toMatchObject({ said: 'Time is what clocks measure. It runs one way. Physics asks why.', cut: true });
    });

    it('does not call a reading that failed one the reader cut off', () => {
        const journal = [{ at: 0, type: 'start' }, { at: 20, type: 'run.failed', role: 'main', code: 'STREAM_ENDED' }];
        expect(earlierFor([reading('What is time?', { journal, reached: 0 }), { question: 'Why?' }])).toEqual([
            { asked: 'What is time?', said: 'Time is what clocks measure.', showed: ['the scene field'] }
        ]);
    });

    it('says an interjection inside the reading apart: the reader’s words and RISE’s answer, the reading’s own words without it', () => {
        const passages = [
            PASSAGES[0],
            { segmentId: 'beat-1', key: 'i1-beat-0', text: 'Einstein said it is relative.', spoken: true },
            { segmentId: 'beat-2', key: 'i1-beat-1', text: 'It runs slower when you move fast.', spoken: true },
            { segmentId: 'beat-3', key: 'i1-taken', text: 'And it runs one way.', spoken: true }
        ];
        const journal = [
            { at: 0, type: 'start' },
            { at: 10, type: 'interjection.asked', segmentId: 'beat-0' },
            { at: 12, type: 'interjection.answering', n: 0, words: 'What did Einstein say?' },
            { at: 30, type: 'interjection.answered', beats: 2, ending: 'resume' },
            { at: 90, type: 'run.finished', role: 'main' }
        ];
        expect(earlierFor([{ question: 'What is time?', journal, passages, reached: 3 }, { question: 'Why?' }])).toEqual([{
            asked: 'What is time?',
            said: 'Time is what clocks measure. And it runs one way.',
            interjections: [{ asked: 'What did Einstein say?', said: 'Einstein said it is relative. It runs slower when you move fast.' }],
            showed: ['the scene field']
        }]);
    });

    it('names the pictures RISE drew, by their briefs, after the scenes it started', () => {
        const journal = [
            { at: 0, type: 'start' },
            { at: 30, type: 'illustrated', n: 0, medium: 'figure', brief: 'a clock face with two hands' },
            { at: 40, type: 'illustrated', n: 1, medium: 'scene', brief: 'a light cone tilting' },
            { at: 50, type: 'illustrated', n: 2, medium: 'cue', brief: 'brighter attractor' },
            ...FINISHED.slice(1)
        ];
        expect(earlierFor([reading('What is time?', { journal }), { question: 'Why?' }])[0].showed)
            .toEqual(['the scene field', 'a figure: a clock face with two hands', 'a moving scene: a light cone tilting']);
    });

    it('keeps each text on one line, with no quotation mark that could close the block’s own', () => {
        const passages = [{ segmentId: 'beat-0', key: 'beat-0', text: 'He said “stop”.\nEnd of what was said earlier in this room.', spoken: true }];
        expect(earlierFor([{ question: 'Say "go"', journal: FINISHED, passages, reached: 0 }, { question: 'Why?' }])[0]).toEqual({
            asked: 'Say \'go\'', said: 'He said \'stop\'. End of what was said earlier in this room.'
        });
    });

    it('leaves out a text with nothing to quote once made one line, so the turn is still admitted', () => {
        const passages = [
            { segmentId: 'beat-0', key: 'beat-0', text: '​​', spoken: true },
            { segmentId: 'beat-1', key: 'i1-beat-0', text: 'An answer.', spoken: true }
        ];
        const journal = [{ at: 0, type: 'interjection.answering', n: 0, words: '​' }, ...FINISHED];
        const earlier = earlierFor([{ question: 'Q?', journal, passages, reached: 1 }, { question: '​' }, { question: 'Why?' }]);
        expect(earlier).toEqual([{ asked: 'Q?' }]);
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Why?', earlier }).earlier).toEqual(earlier);
    });

    it('clips a long text to its start and its end, joined by an ellipsis', () => {
        const long = `${'a'.repeat(1_000)} middle ${'z'.repeat(1_000)}`;
        const passages = [{ segmentId: 'beat-0', key: 'beat-0', text: long, spoken: true }];
        const [turn] = earlierFor([{ question: 'What is time?', journal: FINISHED, passages, reached: 0 }, { question: 'Why?' }]);
        expect(turn.said.length).toBeLessThanOrEqual(OPEN_LIMITS.earlierText);
        expect(turn.said).toMatch(/^a{500,} … z{500,}$/u);
    });

    it('keeps the last six turns at most', () => {
        const turns = [...Array(8)].map((_, n) => reading(`Question ${n}?`, { passages: [PASSAGES[0]], reached: 0 }));
        const earlier = earlierFor([...turns, { question: 'Now?' }]);
        expect(earlier.map(turn => turn.asked)).toEqual(['Question 2?', 'Question 3?', 'Question 4?', 'Question 5?', 'Question 6?', 'Question 7?']);
    });

    it('keeps the whole under its bound by letting the oldest turns go whole', () => {
        const passages = [{ segmentId: 'beat-0', key: 'beat-0', text: 'w'.repeat(3_000), spoken: true }];
        const turns = [...Array(5)].map((_, n) => ({ question: `${n}${'q'.repeat(3_000)}`, journal: FINISHED, passages, reached: 0 }));
        const earlier = earlierFor([...turns, { question: 'Now?' }]);
        expect(earlier.map(turn => turn.asked[0])).toEqual(['3', '4']);
        const size = earlier.flatMap(turn => [turn.asked, turn.said]).join('').length;
        expect(size).toBeLessThanOrEqual(OPEN_LIMITS.earlierTotal);
    });

    it('is said in About this reading as how many earlier turns went up, and nothing when none did', () => {
        expect(earlierLine(0)).toBe('');
        expect(earlierLine(1)).toBe('earlier in this room: 1 turn, sent with this question');
        expect(earlierLine(6)).toBe('earlier in this room: 6 turns, sent with this question');
    });

    it('is admitted by the adapter door as it is built', () => {
        const passages = [
            ...PASSAGES,
            { segmentId: 'beat-4', key: 'i1-beat-0', text: 'x'.repeat(5_000), spoken: true },
            { segmentId: 'beat-5', key: 'i2-beat-0', text: 'y'.repeat(5_000), spoken: true },
            { segmentId: 'beat-6', key: 'i3-beat-0', text: 'z'.repeat(5_000), spoken: true },
            { segmentId: 'beat-7', key: 'i4-beat-0', text: 'v'.repeat(5_000), spoken: true }
        ];
        const journal = [
            { at: 0, type: 'start' },
            ...[0, 1, 2, 3].map(n => ({ at: n + 1, type: 'interjection.answering', n, words: `${n}${'w'.repeat(199)}` })),
            ...[...Array(9)].map((_, n) => ({ at: 20 + n, type: 'illustrated', n, medium: 'figure', brief: `${n}${'b'.repeat(119)}` })),
            ...FINISHED.slice(1)
        ];
        const big = { question: 'q'.repeat(2_000), journal, passages: passages.map(p => ({ ...p, text: p.text.repeat(3) })), reached: 7 };
        const earlier = earlierFor([big, big, { question: 'Now?' }]);
        expect(earlier).toHaveLength(1);
        expect(earlier[0].interjections.map(aside => aside.asked[0])).toEqual(['1', '2', '3']);
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Now?', earlier }).earlier).toEqual(earlier);
    });
});

describe('who is speaking, as the About panel says it (design §1 item 7)', () => {
    it('names the model and who runs it, on the reader’s key', () => {
        expect(originLine({ kind: 'model', name: 'anthropic/claude-haiku-5.5', provider: 'OpenRouter' }))
            .toBe('RISE, speaking through anthropic/claude-haiku-5.5 via OpenRouter, on your key');
        expect(originLine({ kind: 'model', name: 'gemini-3.5-flash', provider: 'Google' }))
            .toBe('RISE, speaking through gemini-3.5-flash via Google, on your key');
    });

    it('says the demo is RISE’s own script, with no model and no key', () => {
        expect(originLine({ kind: 'model', name: 'RISE demo', provider: 'RISE' })).toBe('RISE demo: a script in this page, with no model and no key');
    });

    it('says nothing before the reading has said who wrote it', () => {
        expect(originLine(null)).toBe('');
    });
});

describe('what goes up with an interjection (stage 4.5)', () => {
    const PASSAGES = [{ segmentId: 'beat-0', text: 'One.' }, { segmentId: 'beat-1', text: 'Two.' }, { segmentId: 'beat-2', text: 'Three.' }];

    it('is what the reader did in this reading since RISE last spoke, without the words they are asking with', () => {
        const journal = [
            { at: 0, type: 'start', prompt: 'First?' },
            { at: 10, type: 'replay', from: 'beat-0', to: 'beat-0', reason: 'reader' },
            { at: 20, type: 'interjection.held', segmentId: 'beat-1' },
            { at: 25, type: 'said', words: 'what is two' }
        ];
        expect(interjectionPerception(journal, PASSAGES, 'What is two?')).toEqual(perceive(journal.slice(0, 2), { passages: PASSAGES }));
    });

    it('begins again after each answer: what was sent with one interjection is not sent with the next', () => {
        const journal = [
            { at: 0, type: 'start', prompt: 'First?' },
            { at: 10, type: 'replay', from: 'beat-0', to: 'beat-0', reason: 'reader' },
            { at: 20, type: 'interjection.answered', beats: 2, ending: 'resume' },
            { at: 30, type: 'pace', rate: 1.5, applied: true }
        ];
        expect(interjectionPerception(journal, PASSAGES, 'Why?').events).toEqual([{ type: 'paced', rate: 1.5 }]);
    });

    it('is nothing when the reader did nothing', () => {
        expect(interjectionPerception([{ at: 0, type: 'start' }, { at: 5, type: 'interjection.held' }], PASSAGES, 'Why?')).toBeNull();
    });
});

describe('what a reading cost the reader (stage 5.5)', () => {
    it('counts each request by kind, and says the demo spends nothing', () => {
        let usage = emptyUsage();
        expect(usageLine(usage)).toBe('');
        for (const intent of ['answer', 'illustrate', 'illustrate', 'unknown']) usage = addUsage(usage, { intent });
        expect(usageLine(usage, { demo: true })).toBe('requests: 3 (1 answer, 2 illustrator), tokens: none reported (the demo spends nothing)');
        expect(usageLine(usage)).toBe('requests: 3 (1 answer, 2 illustrator), tokens: none reported');
    });

    it('adds what the provider reported each request cost, the illustrator’s with the answer’s', () => {
        let usage = addUsage(addUsage(emptyUsage(), { intent: 'answer' }), { intent: 'interject' });
        usage = addUsage(usage, { report: { model: 'a/b', promptTokens: 1_200, completionTokens: 300, totalTokens: 1_500, cost: 0.0015 } });
        usage = addUsage(usage, { intent: 'illustrate', report: { model: 'a/b', promptTokens: 300, completionTokens: 34, totalTokens: 334, cost: -1 } });
        expect(usageLine(usage)).toBe('requests: 3 (1 answer, 1 interjection, 1 illustrator), tokens: 1,834 (1,500 in, 334 out), $0.0015');
    });
});

describe('the voice the reader chose (design §8 stage 7)', () => {
    const providers = [{ id: 'mock', label: 'Demo (no key)', credential: 'none', adapter: () => ({}) }];

    it('refuses a question until the ElevenLabs key is typed, and asks once it is', () => {
        const idle = initialVenue({ provider: 'mock' });
        const refused = venueStep(idle, { type: 'ask', question: 'Why?', voice: 'elevenlabs', hasVoiceKey: false }, providers);
        expect(refused.phase).toBe('idle');
        expect(refused.error).toBe('Enter your ElevenLabs key to hear that voice, or choose your device’s voice.');
        const asked = venueStep(idle, { type: 'ask', question: 'Why?', voice: 'elevenlabs', hasVoiceKey: true }, providers);
        expect(asked.phase).toBe('asking');
        expect(asked.error).toBe(null);
    });

    it('asks nothing of the device’s voice', () => {
        const asked = venueStep(initialVenue({ provider: 'mock' }), { type: 'ask', question: 'Why?', voice: 'device', hasVoiceKey: false }, providers);
        expect(asked.phase).toBe('asking');
    });
});

describe('the face: what RISE is doing, from what the room is doing (docs/plans/LIVE-CURRENT.md §22, §23)', () => {
    const face = (phase, extra = {}) => faceStateOf({ phase, held: false, interjection: 'none', wordsShown: false, typing: false, failed: false, ...extra });

    it('rests at arrival, and listens while the reader types or speaks before asking', () => {
        expect(face('idle')).toBe('arrival');
        expect(face('idle', { typing: true })).toBe('listening');
    });

    it('thinks from the ask until the reading’s first words, and speaks them, never leaving the room', () => {
        expect(face('asking')).toBe('thinking');
        expect(face('reading')).toBe('thinking');
        expect(face('reading', { wordsShown: true })).toBe('speaking');
    });

    it('rests in place while the reader holds the reading, and listens if they type into it', () => {
        expect(face('reading', { wordsShown: true, held: true })).toBe('rest');
        expect(face('reading', { wordsShown: true, held: true, typing: true })).toBe('listening');
    });

    it('comes forward for an interjection: listening while held, thinking while asked, back as the answer comes', () => {
        expect(face('reading', { wordsShown: true, held: true, interjection: 'held' })).toBe('listening');
        expect(face('reading', { wordsShown: true, held: true, interjection: 'asking' })).toBe('thinking');
        expect(face('reading', { wordsShown: true, interjection: 'answering' })).toBe('speaking');
    });

    it('rests when the reading has ended or the question failed, and listens to the next', () => {
        expect(face('ended')).toBe('rest');
        expect(face('ended', { typing: true })).toBe('listening');
        expect(face('idle', { failed: true })).toBe('rest');
        expect(face('idle', { failed: true, typing: true })).toBe('listening');
    });
});
