/**
 * The seam between a provider and the runtime.
 *
 * An adapter is the only thing that knows a provider. It normalises what the
 * provider says into RISE events and numbers them; it is the sole producer of
 * the ordered stream. Host actions reach the stream through it too, so there is
 * one source of order and nothing collides.
 */
import { describe, expect, it } from 'vitest';
import {
    AdapterError,
    OPEN_LIMITS,
    assertAdapter,
    assertConnection,
    createChannel,
    createEventWriter,
    validateOpenRequest
} from './adapter.js';
import { RISE_CURRENT_EVENTS_SCHEMA, validateEvent } from './protocol.js';

const collect = async (iterable, limit = Infinity) => {
    const out = [];
    for await (const item of iterable) {
        out.push(item);
        if (out.length >= limit) break;
    }
    return out;
};

describe('the event writer', () => {
    it('numbers events from zero, and each one validates', () => {
        const writer = createEventWriter('answer-1');
        const open = writer.next('current.open', { title: 'T', origin: { kind: 'human', name: 'A' } });
        const begin = writer.next('segment.begin', { segmentId: 's1' });
        expect([open.seq, begin.seq]).toEqual([0, 1]);
        expect(open.schema).toBe(RISE_CURRENT_EVENTS_SCHEMA);
        expect(open.currentId).toBe('answer-1');
        expect(() => validateEvent(begin)).not.toThrow();
        expect(writer.nextSeq).toBe(2);
    });

    it('can begin partway, for a stream that resumes', () => {
        expect(createEventWriter('a', { start: 7 }).next('current.complete').seq).toBe(7);
    });
});

describe('the channel', () => {
    it('hands events to the consumer in the order they were pushed', async () => {
        const channel = createChannel({ capacity: 8 });
        const reading = collect(channel);
        for (const n of [1, 2, 3]) await channel.push(n);
        channel.close();
        expect(await reading).toEqual([1, 2, 3]);
    });

    it('holds a producer back when it is full, and lets it on as the consumer reads', async () => {
        const channel = createChannel({ capacity: 2 });
        expect(await channel.push('a')).toBe(true);
        expect(await channel.push('b')).toBe(true);
        expect(channel.depth).toBe(2);
        let third = false;
        const pushing = channel.push('c').then(accepted => { third = accepted; });
        await Promise.resolve();
        await Promise.resolve();
        expect(third).toBe(false);
        expect(channel.depth).toBe(2);
        const iterator = channel[Symbol.asyncIterator]();
        expect((await iterator.next()).value).toBe('a');
        await pushing;
        expect(third).toBe(true);
        expect(channel.depth).toBe(2);
    });

    it('never holds more than its capacity through push', async () => {
        const channel = createChannel({ capacity: 3 });
        const iterator = channel[Symbol.asyncIterator]();
        let deepest = 0;
        const producer = (async () => {
            for (let i = 0; i < 50; i += 1) {
                await channel.push(i);
                deepest = Math.max(deepest, channel.depth);
            }
            channel.close();
        })();
        const seen = [];
        for (let step = await iterator.next(); !step.done; step = await iterator.next()) seen.push(step.value);
        await producer;
        expect(seen).toEqual(Array.from({ length: 50 }, (_, i) => i));
        expect(deepest).toBeLessThanOrEqual(3);
    });

    it('accepts a host injection past capacity, up to twice, and then says no', () => {
        const channel = createChannel({ capacity: 2 });
        const results = [1, 2, 3, 4, 5].map(n => channel.pushNow(n));
        expect(results).toEqual([true, true, true, true, false]);
        expect(channel.depth).toBe(4);
    });

    it('ends after draining when it is closed', async () => {
        const channel = createChannel();
        await channel.push('a');
        channel.close();
        expect(await collect(channel)).toEqual(['a']);
        expect(await channel.push('late')).toBe(false);
    });

    it('throws to the consumer after draining when it fails', async () => {
        const channel = createChannel();
        await channel.push('a');
        channel.fail(new AdapterError('PROVIDER_LOST', 'It dropped.', { recoverable: true }));
        const iterator = channel[Symbol.asyncIterator]();
        expect((await iterator.next()).value).toBe('a');
        await expect(iterator.next()).rejects.toMatchObject({ code: 'PROVIDER_LOST', recoverable: true });
    });

    it('closes and frees producers when the consumer walks away', async () => {
        const channel = createChannel({ capacity: 1 });
        await channel.push('a');
        const blocked = channel.push('b');
        // Walking away without reading: the producer must not be left waiting.
        await channel[Symbol.asyncIterator]().return();
        expect(await blocked).toBe(false);
        expect(await channel.push('c')).toBe(false);
        expect(channel.depth).toBe(0);
    });

    it('closes when a for-await loop is left early', async () => {
        const channel = createChannel({ capacity: 4 });
        await channel.push('a');
        await channel.push('b');
        for await (const item of channel) { expect(item).toBe('a'); break; }
        expect(await channel.push('c')).toBe(false);
    });

    it('wakes a consumer that is already waiting', async () => {
        const channel = createChannel();
        const first = channel[Symbol.asyncIterator]().next();
        await channel.push('x');
        expect((await first).value).toBe('x');
    });
});

describe('a request to open', () => {
    it('is a plain, bounded object', () => {
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Explain black holes.' })).toEqual({
            intent: 'answer', prompt: 'Explain black holes.'
        });
    });

    it('carries the parent a Dive was taken from', () => {
        const parent = { currentId: 'a', segmentId: 's2', atCharacter: 12, context: ['A black hole is a region.'] };
        expect(validateOpenRequest({ intent: 'dive', prompt: 'the event horizon', parent }).parent).toEqual(parent);
    });

    it('carries the reader’s actions with an answer, as the perception door admits them (design §4)', () => {
        const perception = { events: [{ type: 'replayed', from: 3, to: 3, times: 2, quote: 'Light bends.' }, { type: 'finished' }], earlier: 0 };
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Again?', perception })).toEqual({ intent: 'answer', prompt: 'Again?', perception });
    });

    it('refuses actions that are not the reader’s, and actions on a Dive', () => {
        const parent = { currentId: 'a', segmentId: 's2', atCharacter: 0, context: [] };
        for (const bad of [
            { intent: 'answer', prompt: 'x', perception: { events: [{ type: 'mood', value: 'confused' }], earlier: 0 } },
            { intent: 'answer', prompt: 'x', perception: { events: [{ type: 'said', words: 'hi', url: 'https://x' }], earlier: 0 } },
            { intent: 'answer', prompt: 'x', perception: 'the reader replayed' },
            { intent: 'dive', prompt: 'x', parent, perception: { events: [], earlier: 0 } }
        ]) {
            expect(() => validateOpenRequest(bad), JSON.stringify(bad)).toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
        }
    });

    it('refuses what it does not define, an unknown intent, and a Dive with no parent', () => {
        for (const bad of [
            { intent: 'answer', prompt: 'x', model: 'other' },
            { intent: 'render', prompt: 'x' },
            { intent: 'answer' },
            { intent: 'answer', prompt: '' },
            { intent: 'answer', prompt: 'x'.repeat(OPEN_LIMITS.prompt + 1) },
            { intent: 'dive', prompt: 'x' },
            { intent: 'answer', prompt: 'x', parent: { currentId: 'a', segmentId: 's', atCharacter: 0, context: [] } },
            { intent: 'dive', prompt: 'x', parent: { currentId: 'a', segmentId: 's', atCharacter: -1, context: [] } },
            { intent: 'dive', prompt: 'x', parent: { currentId: 'a', segmentId: 's', atCharacter: 0, context: Array(OPEN_LIMITS.context + 1).fill('c') } },
            { intent: 'dive', prompt: 'x', parent: { currentId: 'a', segmentId: 's', atCharacter: 0, context: ['x'.repeat(OPEN_LIMITS.contextText + 1)] } },
            'a string', null, []
        ]) {
            expect(() => validateOpenRequest(bad), JSON.stringify(bad)).toThrow(AdapterError);
        }
    });
});

describe('the contract an adapter must meet', () => {
    const goodAdapter = () => ({ id: 'x', capabilities: {}, open: async () => ({}) });
    const goodConnection = () => ({
        events: (async function* () {})(),
        record: () => {},
        interrupt: async () => {},
        resume: async () => {},
        close: async () => {}
    });

    it('accepts one that has an id, capabilities and open', () => {
        expect(() => assertAdapter(goodAdapter())).not.toThrow();
    });

    it('refuses one that lacks any of them', () => {
        expect(() => assertAdapter({ capabilities: {}, open() {} })).toThrow(AdapterError);
        expect(() => assertAdapter({ id: 'x', open() {} })).toThrow(AdapterError);
        expect(() => assertAdapter({ id: 'x', capabilities: {} })).toThrow(AdapterError);
        expect(() => assertAdapter(null)).toThrow(AdapterError);
    });

    it('accepts a connection that yields events and can be recorded to, interrupted, resumed and closed', () => {
        expect(() => assertConnection(goodConnection())).not.toThrow();
    });

    it('refuses a connection missing any of that', () => {
        for (const missing of ['events', 'record', 'interrupt', 'resume', 'close']) {
            const connection = goodConnection();
            delete connection[missing];
            expect(() => assertConnection(connection), missing).toThrow(AdapterError);
        }
    });
});

describe('a request to interject (stage 4.5)', () => {
    const reading = { passages: ['A black hole is a region of space.', 'Its edge is the event horizon.'], at: 0 };

    it('carries the reader’s words, the reading so far with the passage they interrupted, and their actions', () => {
        const perception = { events: [{ type: 'replayed', from: 1, to: 1, times: 1, quote: 'A black hole.' }], earlier: 0 };
        expect(validateOpenRequest({ intent: 'interject', prompt: 'What is a region?', reading, perception }))
            .toEqual({ intent: 'interject', prompt: 'What is a region?', reading, perception });
        expect(validateOpenRequest({ intent: 'interject', prompt: 'Why?', reading })).toEqual({ intent: 'interject', prompt: 'Why?', reading });
    });

    it('is refused without the reading, with a reading that is not bounded, and with a parent', () => {
        const parent = { currentId: 'a', segmentId: 's', atCharacter: 0, context: [] };
        for (const bad of [
            { intent: 'interject', prompt: 'Why?' },
            { intent: 'interject', prompt: 'Why?', reading, parent },
            { intent: 'answer', prompt: 'Why?', reading },
            { intent: 'interject', prompt: 'Why?', reading: { passages: [], at: 0 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: ['A.'], at: 1 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: ['A.'], at: -1 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: ['A.'], at: 0.5 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: [''], at: 0 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: ['x'.repeat(OPEN_LIMITS.readingText + 1)], at: 0 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: Array(OPEN_LIMITS.reading + 1).fill('A.'), at: 0 } },
            { intent: 'interject', prompt: 'Why?', reading: { passages: ['A.'], at: 0, url: 'https://x' } },
            { intent: 'interject', prompt: 'Why?', reading: 'the reading' }
        ]) {
            expect(() => validateOpenRequest(bad), JSON.stringify(bad)).toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
        }
    });
});

describe('what was said earlier in the room (LIVE-026)', () => {
    const turn = {
        asked: 'What is time?', said: 'Time is what clocks measure.',
        interjections: [{ asked: 'Whose clocks?', said: 'Anyone’s.' }], showed: ['the scene field'], cut: true
    };
    const reading = { passages: ['A.'], at: 0 };

    it('goes up with an answer and with an interjection, as a closed copy', () => {
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Why?', earlier: [turn, { asked: 'And space?' }] }))
            .toEqual({ intent: 'answer', prompt: 'Why?', earlier: [turn, { asked: 'And space?' }] });
        expect(validateOpenRequest({ intent: 'interject', prompt: 'Why?', reading, earlier: [turn] }))
            .toEqual({ intent: 'interject', prompt: 'Why?', reading, earlier: [turn] });
    });

    it('is refused on a Dive and to the illustrator', () => {
        const parent = { currentId: 'a', segmentId: 's', atCharacter: 0, context: [] };
        const illustration = { medium: 'figure', attempt: 1, said: [] };
        for (const bad of [
            { intent: 'dive', prompt: 'x', parent, earlier: [turn] },
            { intent: 'illustrate', prompt: 'a clock', illustration, earlier: [turn] }
        ]) {
            expect(() => validateOpenRequest(bad), bad.intent).toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
        }
    });

    it('holds every bound: turns, each text, the whole, and its shape', () => {
        const text = n => 'x'.repeat(n);
        const turns = n => [...Array(n)].map(() => ({ asked: 'Q?' }));
        for (const earlier of [
            [],
            turns(OPEN_LIMITS.earlier + 1),
            [{ asked: text(OPEN_LIMITS.earlierText + 1) }],
            [{ asked: 'Q?', said: text(OPEN_LIMITS.earlierText + 1) }],
            [{ asked: 'Q?', interjections: [] }],
            [{ asked: 'Q?', interjections: [...Array(OPEN_LIMITS.earlierAsides + 1)].map(() => ({ asked: 'W?' })) }],
            [{ asked: 'Q?', interjections: [{ asked: text(OPEN_LIMITS.earlierAsideAsked + 1) }] }],
            [{ asked: 'Q?', interjections: [{ asked: 'W?', said: text(OPEN_LIMITS.earlierAsideSaid + 1) }] }],
            [{ asked: 'Q?', interjections: [{ asked: 'W?', url: 'https://x' }] }],
            [{ asked: 'Q?', showed: [] }],
            [{ asked: 'Q?', showed: Array(OPEN_LIMITS.earlierShown + 1).fill('a figure') }],
            [{ asked: 'Q?', showed: [text(OPEN_LIMITS.earlierShownText + 1)] }],
            [{ asked: 'Q?', cut: false }],
            [{ asked: 'Q?', cut: 'yes' }],
            [...Array(OPEN_LIMITS.earlier)].map(() => ({ asked: text(OPEN_LIMITS.earlierText), said: text(OPEN_LIMITS.earlierText) })),
            [{ said: 'No question.' }],
            [{ asked: '' }],
            [{ asked: '   ' }],
            [{ asked: ' padded' }],
            [{ asked: 'Two\nlines' }],
            [{ asked: 'Q?', said: 'He said “stop”.' }],
            [{ asked: 'Q?', said: 'A "quote".' }],
            [{ asked: 'Q?', role: 'assistant' }],
            [{ asked: 42 }],
            ['What is time?'],
            'What is time?',
            { asked: 'Q?' }
        ]) {
            expect(() => validateOpenRequest({ intent: 'answer', prompt: 'Why?', earlier }), JSON.stringify(earlier).slice(0, 120))
                .toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
        }
    });

    it('admits a whole at its bound', () => {
        const at = n => 'x'.repeat(n);
        const full = { asked: at(OPEN_LIMITS.earlierText), said: at(OPEN_LIMITS.earlierText) };
        const earlier = [full, full, { asked: at(OPEN_LIMITS.earlierTotal - 4 * OPEN_LIMITS.earlierText) }];
        expect(validateOpenRequest({ intent: 'answer', prompt: 'Why?', earlier }).earlier).toEqual(earlier);
        const over = [full, full, { asked: at(OPEN_LIMITS.earlierTotal - 4 * OPEN_LIMITS.earlierText + 1) }];
        expect(() => validateOpenRequest({ intent: 'answer', prompt: 'Why?', earlier: over })).toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
    });
});

describe('a request to illustrate (stage 5.5)', () => {
    const illustration = {
        medium: 'figure', attempt: 1, theme: 'cobalt', look: 'signal', running: { id: 'field', engine: 'attractor' },
        said: ['Water comes in three states.', 'Which one depends on heat.'], asked: 'Show me that as a diagram.'
    };
    const repair = { source: '<svg><script>x</script></svg>', diagnostics: [{ line: 1, column: 6, rule: 'element', message: '<script> is not an element a figure may use' }] };

    it('carries the brief, the medium, the attempt and the room, and on a repair the refused source with its diagnostics', () => {
        const request = { intent: 'illustrate', prompt: 'a labelled diagram of the three states of water', illustration };
        expect(validateOpenRequest(request)).toEqual(request);
        const again = { intent: 'illustrate', prompt: 'water', illustration: { medium: 'scene', attempt: 2, said: [], running: { id: 'fig', form: 'svg' }, repair } };
        expect(validateOpenRequest(again)).toEqual(again);
        const nothing = { intent: 'illustrate', prompt: 'water', illustration: { medium: 'figure', attempt: 3, said: [], repair: { diagnostics: [{ line: null, column: null, rule: 'nothing-drawn', message: 'no scene was drawn' }] } } };
        expect(validateOpenRequest(nothing)).toEqual(nothing);
    });

    it('is refused without its illustration, with anything unbounded, and with what other intents carry', () => {
        const reading = { passages: ['A.'], at: 0 };
        const perception = { events: [{ type: 'finished' }], earlier: 0 };
        const parent = { currentId: 'a', segmentId: 's', atCharacter: 0, context: [] };
        const with_ = patch => ({ intent: 'illustrate', prompt: 'water', illustration: { ...illustration, ...patch } });
        for (const bad of [
            { intent: 'illustrate', prompt: 'water' },
            { intent: 'answer', prompt: 'water', illustration },
            { intent: 'illustrate', prompt: 'water', illustration, reading },
            { intent: 'illustrate', prompt: 'water', illustration, perception },
            { intent: 'illustrate', prompt: 'water', illustration, parent },
            with_({ medium: 'cue' }),
            with_({ medium: 'video' }),
            with_({ attempt: 0 }),
            with_({ attempt: 4 }),
            with_({ attempt: 1.5 }),
            with_({ theme: 'neon' }),
            with_({ look: 'neon' }),
            with_({ running: { id: 'field' } }),
            with_({ running: { id: 'field', engine: 'attractor', form: 'svg' } }),
            with_({ running: { id: 'field', engine: 'teapot' } }),
            with_({ running: { id: 'field', form: 'html' } }),
            with_({ said: ['A.', 'B.', 'C.'] }),
            with_({ said: ['x'.repeat(OPEN_LIMITS.readingText + 1)] }),
            with_({ said: 'A.' }),
            with_({ asked: '' }),
            with_({ url: 'https://x' }),
            with_({ repair: { diagnostics: [] } }),
            with_({ repair: { source: 'x'.repeat(OPEN_LIMITS.source + 1), diagnostics: repair.diagnostics } }),
            with_({ repair: { diagnostics: Array(11).fill(repair.diagnostics[0]) } }),
            with_({ repair: { diagnostics: [{ ...repair.diagnostics[0], rule: 'Not A Rule' }] } }),
            with_({ repair: { diagnostics: [{ ...repair.diagnostics[0], line: -1 }] } }),
            with_({ repair: { diagnostics: [{ ...repair.diagnostics[0], extra: 1 }] } })
        ]) {
            expect(() => validateOpenRequest(bad), JSON.stringify(bad).slice(0, 200)).toThrow(expect.objectContaining({ code: 'OPEN_REQUEST' }));
        }
    });
});
