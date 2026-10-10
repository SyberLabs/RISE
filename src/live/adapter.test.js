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
