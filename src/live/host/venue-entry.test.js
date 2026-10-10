import { describe, expect, it } from 'vitest';
import { initialVenue, perceptionFor, venueStep } from './venue-entry.js';

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
        expect(run({ type: 'choose', provider: 'openai' }).provider).toBe('mock');
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

describe('the perception hook', () => {
    it('sends nothing up yet, whatever the carried turns hold (design §8 stage 4)', () => {
        expect(perceptionFor([{ question: 'First?', journal: [{ type: 'interrupt' }] }])).toEqual([]);
    });
});
