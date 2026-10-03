/**
 * The app's side of an MCP host's messaging, against a fake host.
 *
 * The vocabulary was compared with the MCP Apps specification and the types of
 * its reference package (see mcp-port.js), so this holds what does not depend
 * on a host being right: only the frame's parent is listened to, anything
 * malformed or oversize is ignored, a Current is read only from the two
 * notifications one is expected in and handed over once, the host's own
 * requests are answered, a question to the host's model is asked only where the
 * host said it would take one, and closing lets go of everything.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createMcpGuestPort, currentFrom, METHODS, PORT_LIMITS, PROTOCOL_VERSION } from './mcp-port.js';
import { serializedUtf8Bytes } from './mcp-size.js';

const CURRENT = { schema: 'rise.current.v1', id: 'c', title: 'T', origin: { kind: 'human', name: 'n' }, segments: [{ id: 's', text: 'Words.' }] };

function setup(options = {}) {
    const listeners = new Set();
    const sent = [];
    const host = { postMessage: (message, target) => sent.push({ message, target }) };
    const frame = {
        parent: host,
        addEventListener: (type, fn) => { if (type === 'message') listeners.add(fn); },
        removeEventListener: (type, fn) => { if (type === 'message') listeners.delete(fn); }
    };
    const clock = createVirtualClock();
    const port = createMcpGuestPort({ frame, clock, ...options });
    const from = (source, data) => { for (const fn of [...listeners]) fn({ source, data }); };
    return { port, sent, host, frame, clock, listeners, hostSays: data => from(host, data), from };
}

const notification = (method, params) => ({ jsonrpc: '2.0', method, params });

/** A port that has said hello to a host that does, or does not, take questions for its model. */
async function connected({ sampling = true, ...options } = {}) {
    const made = setup(options);
    const connecting = made.port.connect();
    made.hostSays({ jsonrpc: '2.0', id: made.sent[0].message.id, result: { hostInfo: { name: 'a host' }, hostCapabilities: sampling ? { sampling: {} } : {} } });
    await connecting;
    made.sent.length = 0;
    return made;
}

describe('reading a Current out of what the host sends', () => {
    it('finds one in a tool’s input and in a tool’s structured result, and nowhere else', () => {
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT } })).toEqual({ current: CURRENT });
        expect(currentFrom(METHODS.toolResult, { structuredContent: { current: CURRENT } })).toEqual({ current: CURRENT });
        expect(currentFrom(METHODS.toolResult, { isError: true, structuredContent: { current: CURRENT } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { structuredContent: { current: CURRENT } })).toBeNull();
        expect(currentFrom(METHODS.toolResult, { arguments: { current: CURRENT } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { arguments: { text: CURRENT } })).toBeNull();
        expect(currentFrom('ui/other', { arguments: { current: CURRENT } })).toBeNull();
        for (const junk of [null, undefined, 'x', 3, [], { arguments: null }, { arguments: [] }, { arguments: { current: null } }, { arguments: { current: 'text' } }]) {
            expect(currentFrom(METHODS.toolInput, junk)).toBeNull();
        }
    });

    it('refuses a tool input whose argument envelope contains anything beside current', () => {
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, theme: 'jade' } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, replyTo: 'x', other: { deep: 1 } } })).toBeNull();
        expect(currentFrom(METHODS.toolResult, { structuredContent: { current: CURRENT, other: 'host metadata' } }))
            .toEqual({ current: CURRENT });
    });

    it('does not hand an invalid argument envelope to Begin before the Worker refusal arrives', () => {
        const { port, hostSays } = setup();
        const heard = [];
        const errors = [];
        port.onCurrent(item => heard.push(item));
        port.onError(error => errors.push(error));

        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT, theme: 'jade' } }));
        expect(heard).toEqual([]);

        hostSays(notification(METHODS.toolResult, {
            isError: true,
            content: [{ type: 'text', text: 'RISE refused these arguments' }]
        }));
        expect(heard).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toMatch(/refused/u);
    });
});

describe('what the reference says', () => {
    it('is written against the extension’s current protocol version and the names in its specification', () => {
        expect(PROTOCOL_VERSION).toBe('2026-01-26');
        expect(METHODS).toEqual({
            initialize: 'ui/initialize',
            initialized: 'ui/notifications/initialized',
            toolInput: 'ui/notifications/tool-input',
            toolResult: 'ui/notifications/tool-result',
            sample: 'sampling/createMessage',
            sizeChanged: 'ui/notifications/size-changed',
            ping: 'ping',
            teardown: 'ui/resource-teardown'
        });
    });
});

describe('who it listens to', () => {
    it('listens to the frame’s parent only', () => {
        const { port, from } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        from({ other: 'window' }, notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        from(null, notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toEqual([]);
    });

    it('ignores what is not well-formed JSON-RPC, and what is too large', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        for (const data of [null, undefined, 'text', 5, [], {}, { jsonrpc: '1.0', method: METHODS.toolInput }, { jsonrpc: '2.0' }, { jsonrpc: '2.0', method: 5 },
            notification(METHODS.toolInput, { arguments: { current: { ...CURRENT, title: 'x'.repeat(PORT_LIMITS.message) } } })]) {
            hostSays(data);
        }
        expect(heard).toEqual([]);
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toHaveLength(1);
    });

    it('survives a message that cannot be measured', () => {
        const { port, hostSays } = setup();
        port.onCurrent(() => {});
        const cyclic = notification(METHODS.toolInput, {});
        cyclic.params.self = cyclic;
        expect(() => hostSays(cyclic)).not.toThrow();
    });

    it('reports a trusted oversized Current envelope instead of silently waiting', () => {
        const { port, hostSays } = setup();
        const errors = [];
        port.onError(error => errors.push(error));
        const envelope = notification(METHODS.toolInput, { arguments: { current: CURRENT }, metadata: '界'.repeat(Math.floor(PORT_LIMITS.message / 3) + 100) });
        expect(JSON.stringify(envelope).length).toBeLessThan(PORT_LIMITS.message);
        expect(serializedUtf8Bytes(envelope)).toBeGreaterThan(PORT_LIMITS.message);
        hostSays(envelope);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('too large');
    });

    it('discards buffered content and its duplicate key when an oversized envelope refuses it', () => {
        const { port, hostSays } = setup();
        const envelope = notification(METHODS.toolInput, { arguments: { current: CURRENT }, metadata: 'x'.repeat(PORT_LIMITS.message) });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        hostSays(envelope);
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        expect(heard).toEqual([]);
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toEqual([{ current: CURRENT }]);
    });

    it('discards buffered content and duplicate keys for Current-budget and tool-error refusals', () => {
        const oversized = { ...CURRENT, segments: [{ id: 's', text: '界'.repeat(22_000) }] };
        const refusals = [
            hostSays => hostSays(notification(METHODS.toolInput, { arguments: { current: oversized } })),
            hostSays => hostSays(notification(METHODS.toolResult, { isError: true, content: [{ type: 'text', text: 'refused' }] }))
        ];
        for (const refuse of refusals) {
            const { port, hostSays } = setup();
            const first = CURRENT;
            const second = { ...CURRENT, id: 'buffered-second' };
            hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
            hostSays(notification(METHODS.toolInput, { arguments: { current: second } }));
            refuse(hostSays);
            const heard = [];
            port.onCurrent(item => { heard.push(item); });
            expect(heard).toEqual([]);
            hostSays(notification(METHODS.toolInput, { arguments: { current: first } }));
            hostSays(notification(METHODS.toolInput, { arguments: { current: second } }));
            expect(heard).toEqual([{ current: first }, { current: second }]);
        }
    });
});

describe('the MCP Current payload budget', () => {
    it('rejects an over-budget Current from either delivery method with one bounded error', () => {
        const { port, hostSays } = setup();
        const currents = [];
        const errors = [];
        port.onCurrent(item => currents.push(item));
        port.onError(error => errors.push(error));
        const overBudget = { ...CURRENT, segments: [{ id: 's', text: '界'.repeat(22_000) }] };
        hostSays(notification(METHODS.toolInput, { arguments: { current: overBudget } }));
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: overBudget } }));
        expect(currents).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('65,536-byte MCP limit');
        expect(errors[0].message.length).toBeLessThanOrEqual(300);
    });

    it('measures serialized UTF-8 bytes, including non-ASCII and JSON escapes at the boundary', () => {
        const { port, hostSays } = setup();
        const currents = [];
        const errors = [];
        port.onCurrent(item => currents.push(item));
        port.onError(error => errors.push(error));
        const base = { ...CURRENT, segments: [{ id: 's', text: '' }] };
        const padding = PORT_LIMITS.current - serializedUtf8Bytes(base);
        const fitting = { ...CURRENT, segments: [{ id: 's', text: '界'.repeat(Math.floor(padding / 3)) + 'x'.repeat(padding % 3) }] };
        const oversized = { ...fitting, segments: [{ ...fitting.segments[0], text: `${fitting.segments[0].text}"` }] };
        expect(serializedUtf8Bytes(fitting)).toBe(PORT_LIMITS.current);
        expect(serializedUtf8Bytes(oversized)).toBeGreaterThan(PORT_LIMITS.current);
        hostSays(notification(METHODS.toolInput, { arguments: { current: fitting } }));
        hostSays(notification(METHODS.toolInput, { arguments: { current: oversized } }));
        expect(currents).toHaveLength(1);
        expect(errors).toHaveLength(1);
    });
});

describe('handing Currents to the app', () => {
    it('keeps a few that arrive before anyone is listening, and gives them first', () => {
        const { port, hostSays } = setup();
        for (let i = 0; i < PORT_LIMITS.buffered + 3; i += 1) hostSays(notification(METHODS.toolInput, { arguments: { current: { ...CURRENT, id: `c${i}` } } }));
        const heard = [];
        port.onCurrent(item => { heard.push(item.current.id); });
        expect(heard).toHaveLength(PORT_LIMITS.buffered);
        expect(heard[0]).toBe('c3');
        expect(heard.at(-1)).toBe(`c${PORT_LIMITS.buffered + 2}`);
    });

    it('discards buffered Currents on close and does not deliver them to a later listener', () => {
        const { port, hostSays } = setup();
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        port.close();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        expect(heard).toEqual([]);
    });

    it('stops handing over once a listener takes one, and stops listening when told', () => {
        const { port, hostSays } = setup();
        const first = [];
        const second = [];
        const offFirst = port.onCurrent(item => { first.push(item); return true; });
        port.onCurrent(item => { second.push(item); });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(first).toHaveLength(1);
        expect(second).toHaveLength(0);
        offFirst();
        hostSays(notification(METHODS.toolInput, { arguments: { current: { ...CURRENT, id: 'another' } } }));
        expect(second).toHaveLength(1);
    });
});

describe('the same Current, twice', () => {
    it('hands over what arrived as a tool’s input once, though it arrives again as the tool’s result', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(heard).toHaveLength(1);
    });

    it('does not keep the second copy to give to whoever listens next', () => {
        const { port, hostSays } = setup();
        const first = [];
        const off = port.onCurrent(item => { first.push(item); return true; });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        off();
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        const next = [];
        port.onCurrent(item => { next.push(item); });
        expect(first).toHaveLength(1);
        expect(next).toEqual([]);
    });

    it('forgets old ones, so the list of what was seen stays small', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item.current.id); });
        for (let i = 0; i < PORT_LIMITS.remembered + 2; i += 1) hostSays(notification(METHODS.toolInput, { arguments: { current: { ...CURRENT, id: `c${i}` } } }));
        hostSays(notification(METHODS.toolInput, { arguments: { current: { ...CURRENT, id: 'c0' } } }));
        expect(heard.at(-1)).toBe('c0');
        expect(heard).toHaveLength(PORT_LIMITS.remembered + 3);
    });
});

describe('saying hello', () => {
    it('says hello, waits for the host’s answer, and then says it is ready', async () => {
        const { port, sent, hostSays } = setup();
        const connecting = port.connect();
        expect(sent).toHaveLength(1);
        expect(sent[0].message).toMatchObject({ jsonrpc: '2.0', method: METHODS.initialize, params: { appInfo: { name: 'RISE' }, protocolVersion: PROTOCOL_VERSION } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { hostInfo: { name: 'a host' } } });
        expect(await connecting).toEqual({ hostInfo: { name: 'a host' } });
        expect(sent[1].message).toMatchObject({ method: METHODS.initialized });
    });

    it('learns from what the host says whether it will put a question to its model, and does not assume it', async () => {
        expect((await connected({ sampling: true })).port.canSample()).toBe(true);
        expect((await connected({ sampling: false })).port.canSample()).toBe(false);
        expect(setup().port.canSample()).toBe(false);
    });
});

describe('asking the host’s model', () => {
    it('sends the question with the instructions apart from it, and gives back the words', async () => {
        const { port, sent, hostSays } = await connected();
        const asked = port.complete({ system: 'Be brief.', text: 'What is a horizon?' });
        expect(sent[0].message).toMatchObject({ method: METHODS.sample, params: { systemPrompt: 'Be brief.', maxTokens: 2_000, messages: [{ role: 'user', content: { type: 'text', text: 'What is a horizon?' } }] } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { role: 'assistant', model: 'm', content: { type: 'text', text: 'An edge.' } } });
        expect(await asked).toBe('An edge.');
    });

    it('reads an answer in several blocks, and takes only their text', async () => {
        const { port, sent, hostSays } = await connected();
        const asked = port.complete({ system: 's', text: 't' });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { content: [{ type: 'text', text: 'One ' }, { type: 'image', data: 'x' }, { type: 'tool_use', name: 'n' }, { type: 'text', text: 'two.' }] } });
        expect(await asked).toBe('One two.');
    });

    it('does not ask a host that did not say it would, and sends nothing', async () => {
        const { port, sent } = await connected({ sampling: false });
        await expect(port.complete({ system: 's', text: 't' })).rejects.toThrow('does not put a question to its model');
        expect(sent).toEqual([]);
    });

    it('says in words when the host refuses, when it answers with nothing, and when it answers with too much', async () => {
        const { port, sent, hostSays } = await connected();
        const refused = port.complete({ system: 's', text: 't' });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, error: { code: -1, message: 'The reader said no' } });
        await expect(refused).rejects.toThrow('The reader said no');

        for (const [result, message] of [[{ content: { type: 'text', text: '   ' } }, 'gave no words'], [{ content: { type: 'image' } }, 'gave no words'], [{}, 'gave no words'],
            [{ content: { type: 'text', text: 'x'.repeat(PORT_LIMITS.answer + 1) } }, 'gave too much']]) {
            const asked = port.complete({ system: 's', text: 't' });
            hostSays({ jsonrpc: '2.0', id: sent.at(-1).message.id, result });
            await expect(asked).rejects.toThrow(message);
        }
    });

    it('waits as long as it is told, not as long as a plain request would, and then gives up and frees the timer', async () => {
        const { port, clock } = await connected({ timeoutMs: 1_000 });
        const asked = port.complete({ system: 's', text: 't', timeoutMs: 30_000 }).catch(error => error);
        await clock.advance(29_999);
        expect(clock.pending()).toBe(1);
        await clock.advance(1);
        expect((await asked).message).toBe('The host did not answer in time');
        expect(clock.pending()).toBe(0);
    });

    it('matches answers to the questions that were asked, not to the order they come back in', async () => {
        const { port, sent, hostSays } = await connected();
        const one = port.complete({ system: 's', text: 'first' });
        const two = port.complete({ system: 's', text: 'second' });
        hostSays({ jsonrpc: '2.0', id: sent[1].message.id, result: { content: { type: 'text', text: 'B' } } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { content: { type: 'text', text: 'A' } } });
        expect(await one).toBe('A');
        expect(await two).toBe('B');
    });

    it('ignores an answer to a question nobody asked, and bounds how many are waiting', async () => {
        const { port, hostSays, sent, clock } = await connected({ timeoutMs: 2_000 });
        hostSays({ jsonrpc: '2.0', id: 9999, result: {} });
        const waiting = Array.from({ length: PORT_LIMITS.pending }, () => port.complete({ system: 's', text: 't' }).catch(() => {}));
        await expect(port.complete({ system: 's', text: 'one too many' })).rejects.toThrow('Too many requests');
        expect(sent.length).toBe(PORT_LIMITS.pending);
        await clock.advance(2_000);
        await Promise.all(waiting);
        expect(clock.pending()).toBe(0);
    });

    it('lets go of everything when closed, and hears nothing afterwards', async () => {
        const { port, clock, listeners, hostSays } = await connected();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        const pending = port.complete({ system: 's', text: 't' }).catch(error => error.message);
        port.close();
        expect(await pending).toBe('Closed');
        expect(listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toEqual([]);
    });
});

describe('the host’s own requests, which it waits on', () => {
    it('answers a ping', () => {
        const { sent, hostSays } = setup();
        hostSays({ jsonrpc: '2.0', id: 7, method: METHODS.ping });
        expect(sent).toEqual([{ message: { jsonrpc: '2.0', id: 7, result: {} }, target: '*' }]);
    });

    it('answers a request to tear down, then tells the app, and survives an app that throws', () => {
        const { port, sent, hostSays } = setup();
        const order = [];
        port.onTeardown(() => { order.push(['told', sent.length]); });
        port.onTeardown(() => { throw new Error('bad'); });
        hostSays({ jsonrpc: '2.0', id: 3, method: METHODS.teardown, params: {} });
        expect(sent[0].message).toEqual({ jsonrpc: '2.0', id: 3, result: {} });
        expect(order).toEqual([['told', 1]]);
    });

    it('says it does not know a method it does not know, rather than leaving the host waiting', () => {
        const { sent, hostSays } = setup();
        hostSays({ jsonrpc: '2.0', id: 'x1', method: 'tools/call', params: {} });
        expect(sent[0].message).toMatchObject({ id: 'x1', error: { code: -32601, message: 'Method not found' } });
    });

    it('takes a Current only from a notification: a request that carries one is answered and not shown', () => {
        const { port, sent, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        hostSays({ jsonrpc: '2.0', id: 4, method: METHODS.toolInput, params: { arguments: { current: CURRENT } } });
        expect(heard).toEqual([]);
        expect(sent[0].message.error.code).toBe(-32601);
    });

    it('stops telling the app about a teardown when it is told to, and when closed', () => {
        const { port, hostSays } = setup();
        const told = [];
        const off = port.onTeardown(() => told.push(1));
        off();
        hostSays({ jsonrpc: '2.0', id: 1, method: METHODS.teardown });
        port.onTeardown(() => told.push(2));
        port.close();
        expect(told).toEqual([]);
    });
});

describe('saying how much room it takes', () => {
    it('sends whole pixels, and leaves out what is not a number', () => {
        const { port, sent } = setup();
        port.sizeChanged({ width: 390.4, height: 640.6 });
        port.sizeChanged({ height: NaN, width: 200 });
        expect(sent.map(item => item.message)).toEqual([
            { jsonrpc: '2.0', method: METHODS.sizeChanged, params: { width: 390, height: 641 } },
            { jsonrpc: '2.0', method: METHODS.sizeChanged, params: { width: 200 } }
        ]);
    });
});
