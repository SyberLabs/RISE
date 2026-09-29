/**
 * The app's side of an MCP host's messaging, against a fake host.
 *
 * The vocabulary is written from the MCP Apps extension without a real host to
 * try it on (see mcp-port.js), so this holds what does not depend on it being
 * right: only the frame's parent is listened to, anything malformed or
 * oversize is ignored, a Current is read only from the two places one is
 * expected, requests are matched to their answers and bounded and timed out,
 * and closing lets go of everything.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createMcpGuestPort, currentFrom, METHODS, PORT_LIMITS } from './mcp-port.js';

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

describe('reading a Current out of what the host sends', () => {
    it('finds one in a tool’s input and in a tool’s structured result, and nowhere else', () => {
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT } })).toEqual({ current: CURRENT, replyTo: undefined });
        expect(currentFrom(METHODS.toolResult, { structuredContent: { current: CURRENT, replyTo: 'dive-1' } })).toEqual({ current: CURRENT, replyTo: 'dive-1' });
        expect(currentFrom(METHODS.toolInput, { structuredContent: { current: CURRENT } })).toBeNull();
        expect(currentFrom(METHODS.toolResult, { arguments: { current: CURRENT } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { arguments: { text: CURRENT } })).toBeNull();
        expect(currentFrom('ui/other', { arguments: { current: CURRENT } })).toBeNull();
        for (const junk of [null, undefined, 'x', 3, [], { arguments: null }, { arguments: [] }, { arguments: { current: null } }, { arguments: { current: 'text' } }]) {
            expect(currentFrom(METHODS.toolInput, junk)).toBeNull();
        }
    });

    it('takes a reply reference only if it is one, and ignores a hostile one rather than trusting it', () => {
        for (const bad of ['has space', '"quote"', '<b>', 'x'.repeat(121), '', 5, {}, null]) {
            expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, replyTo: bad } }).replyTo, String(bad)).toBeUndefined();
        }
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, replyTo: 'dive-mcp-1-abc123' } }).replyTo).toBe('dive-mcp-1-abc123');
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
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(second).toHaveLength(1);
    });
});

describe('speaking to the host', () => {
    it('says hello, waits for the host’s answer, and then says it is ready', async () => {
        const { port, sent, hostSays } = setup();
        const connecting = port.connect();
        expect(sent).toHaveLength(1);
        expect(sent[0].message).toMatchObject({ jsonrpc: '2.0', method: METHODS.initialize, params: { appInfo: { name: 'RISE' } } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { hostInfo: { name: 'a host' } } });
        expect(await connecting).toEqual({ hostInfo: { name: 'a host' } });
        expect(sent[1].message).toMatchObject({ method: METHODS.initialized });
    });

    it('puts a message into the conversation, and matches the answer to the request', async () => {
        const { port, sent, hostSays } = setup();
        const one = port.sendMessage('first');
        const two = port.sendMessage('second');
        expect(sent.map(item => item.message.params.content[0].text)).toEqual(['first', 'second']);
        hostSays({ jsonrpc: '2.0', id: sent[1].message.id, result: { ok: 2 } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { ok: 1 } });
        expect(await one).toEqual({ ok: 1 });
        expect(await two).toEqual({ ok: 2 });
    });

    it('reports a refusal in words, and ignores an answer to a request nobody made', async () => {
        const { port, sent, hostSays } = setup();
        const asked = port.sendMessage('hello');
        hostSays({ jsonrpc: '2.0', id: 9999, result: {} });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, error: { code: -32000, message: 'The reader has disabled messages' } });
        await expect(asked).rejects.toThrow('The reader has disabled messages');
    });

    it('gives up on a host that does not answer, frees the timer, and bounds how many are waiting', async () => {
        const { port, clock, sent } = setup({ timeoutMs: 2_000 });
        const slow = port.sendMessage('hello');
        const settled = slow.catch(error => error);
        await clock.advance(2_000);
        expect((await settled).message).toBe('The host did not answer in time');
        expect(clock.pending()).toBe(0);

        const waiting = Array.from({ length: PORT_LIMITS.pending }, () => port.sendMessage('x').catch(() => {}));
        await expect(port.sendMessage('one too many')).rejects.toThrow('Too many requests');
        expect(sent.length).toBe(1 + PORT_LIMITS.pending);
        port.close();
        await Promise.all(waiting);
    });

    it('lets go of everything when closed, and hears nothing afterwards', async () => {
        const { port, clock, listeners, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        const pending = port.sendMessage('hello').catch(error => error.message);
        port.close();
        expect(await pending).toBe('Closed');
        expect(listeners.size).toBe(0);
        expect(clock.pending()).toBe(0);
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toEqual([]);
    });
});
