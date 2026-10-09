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
async function connected({ sampling = true, hostContext, capabilities = {}, ...options } = {}) {
    const made = setup(options);
    const connecting = made.port.connect();
    made.hostSays({ jsonrpc: '2.0', id: made.sent[0].message.id, result: { hostInfo: { name: 'a host' }, hostCapabilities: { ...(sampling ? { sampling: {} } : {}), ...capabilities }, ...(hostContext === undefined ? {} : { hostContext }) } });
    await connecting;
    made.sent.length = 0;
    return made;
}

describe('reading a Current out of what the host sends', () => {
    it('finds a Current only in a successful tool result', () => {
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT } })).toBeNull();
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

    it('does not treat tool input or its argument envelope as an admitted result', () => {
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, theme: 'jade' } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, replyTo: 'x', other: { deep: 1 } } })).toBeNull();
        expect(currentFrom(METHODS.toolInput, { arguments: { current: CURRENT, other: 'host metadata' } })).toBeNull();
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
            hostContextChanged: 'ui/notifications/host-context-changed',
            toolCancelled: 'ui/notifications/tool-cancelled',
            ping: 'ping',
            teardown: 'ui/resource-teardown',
            // McpUiUpdateModelContextRequest in ext-apps src/spec.types.ts; a request, answered with {}.
            updateModelContext: 'ui/update-model-context',
            // A request, { mode }, answered with the mode the host set (apps.mdx, Display Modes).
            requestDisplayMode: 'ui/request-display-mode',
            // McpUiOpenLinkRequest in ext-apps src/spec.types.ts: a request, { url }, answered with { isError? }.
            openLink: 'ui/open-link'
        });
    });
});

describe('what the host says about where the app is shown', () => {
    it('keeps the host context given at hello, and holds none when the host gives none, or gives something that is not an object', async () => {
        expect((await connected({ hostContext: { theme: 'dark', displayMode: 'inline' } })).port.hostContext()).toEqual({ theme: 'dark', displayMode: 'inline' });
        expect((await connected()).port.hostContext()).toEqual({});
        for (const given of [null, 'dark', 5, ['dark']]) expect((await connected({ hostContext: given })).port.hostContext(), String(given)).toEqual({});
        expect(setup().port.hostContext()).toEqual({});
    });

    it('merges each change the host sends, field by field, and tells the app after each', async () => {
        const { port, hostSays } = await connected({ hostContext: { theme: 'dark', containerDimensions: { maxHeight: 640 }, locale: 'en' } });
        const told = [];
        port.onHostContext(context => told.push(context));
        hostSays(notification(METHODS.hostContextChanged, { theme: 'light' }));
        hostSays(notification(METHODS.hostContextChanged, { containerDimensions: { width: 390 } }));
        expect(port.hostContext()).toEqual({ theme: 'light', containerDimensions: { width: 390 }, locale: 'en' });
        expect(told).toEqual([
            { theme: 'light', containerDimensions: { maxHeight: 640 }, locale: 'en' },
            { theme: 'light', containerDimensions: { width: 390 }, locale: 'en' }
        ]);
    });

    it('ignores a change that is not an object, and stops telling the app when told and when closed', async () => {
        const { port, hostSays } = await connected({ hostContext: { theme: 'dark' } });
        const told = [];
        const off = port.onHostContext(context => told.push(context));
        for (const params of [undefined, null, 'light', 5, ['light']]) hostSays(notification(METHODS.hostContextChanged, params));
        expect(port.hostContext()).toEqual({ theme: 'dark' });
        expect(told).toEqual([]);
        off();
        hostSays(notification(METHODS.hostContextChanged, { theme: 'light' }));
        expect(port.hostContext()).toEqual({ theme: 'light' });
        expect(told).toEqual([]);
        port.onHostContext(context => told.push(context));
        port.close();
        hostSays(notification(METHODS.hostContextChanged, { theme: 'dark' }));
        expect(told).toEqual([]);
    });
});

describe('when the host cancels the call', () => {
    it('tells the app, with the host’s reason clipped to a line, or none', () => {
        const { port, hostSays } = setup();
        const told = [];
        port.onToolCancelled(cancel => told.push(cancel));
        hostSays(notification(METHODS.toolCancelled, { reason: 'user action' }));
        hostSays(notification(METHODS.toolCancelled, { reason: 'x'.repeat(300) }));
        hostSays(notification(METHODS.toolCancelled, {}));
        hostSays(notification(METHODS.toolCancelled, { reason: 5 }));
        hostSays(notification(METHODS.toolCancelled));
        expect(told).toEqual([{ reason: 'user action' }, { reason: 'x'.repeat(200) }, { reason: null }, { reason: null }, { reason: null }]);
    });

    it('stops telling the app when told, and when closed, and survives an app that throws', () => {
        const { port, hostSays } = setup();
        const told = [];
        const off = port.onToolCancelled(() => told.push(1));
        port.onToolCancelled(() => { throw new Error('bad'); });
        port.onToolCancelled(() => told.push(2));
        hostSays(notification(METHODS.toolCancelled, { reason: 'r' }));
        expect(told).toEqual([1, 2]);
        off();
        hostSays(notification(METHODS.toolCancelled, { reason: 'r' }));
        expect(told).toEqual([1, 2, 2]);
        port.close();
        hostSays(notification(METHODS.toolCancelled, { reason: 'r' }));
        expect(told).toEqual([1, 2, 2]);
    });
});

describe('who it listens to', () => {
    it('listens to the frame’s parent only', () => {
        const { port, from } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        from({ other: 'window' }, notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        from(null, notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(heard).toEqual([]);
    });

    it('ignores what is not well-formed JSON-RPC, and what is too large', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        for (const data of [null, undefined, 'text', 5, [], {}, { jsonrpc: '1.0', method: METHODS.toolResult }, { jsonrpc: '2.0' }, { jsonrpc: '2.0', method: 5 },
            notification(METHODS.toolResult, { structuredContent: { current: { ...CURRENT, title: 'x'.repeat(PORT_LIMITS.message) } } })]) {
            hostSays(data);
        }
        expect(heard).toEqual([]);
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(heard).toHaveLength(1);
    });

    it('survives a message that cannot be measured', () => {
        const { port, hostSays } = setup();
        port.onCurrent(() => {});
        const cyclic = notification(METHODS.toolResult, {});
        cyclic.params.self = cyclic;
        expect(() => hostSays(cyclic)).not.toThrow();
    });

    it('reports a trusted oversized Current envelope instead of silently waiting', () => {
        const { port, hostSays } = setup();
        const errors = [];
        port.onError(error => errors.push(error));
        const envelope = notification(METHODS.toolResult, { structuredContent: { current: CURRENT }, metadata: '界'.repeat(Math.floor(PORT_LIMITS.message / 3) + 100) });
        expect(JSON.stringify(envelope).length).toBeLessThan(PORT_LIMITS.message);
        expect(serializedUtf8Bytes(envelope)).toBeGreaterThan(PORT_LIMITS.message);
        hostSays(envelope);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('too large');
    });

    it('keeps a successful buffered result when an anonymous oversized envelope follows', () => {
        const { port, hostSays } = setup();
        const envelope = notification(METHODS.toolResult, { structuredContent: { current: CURRENT }, metadata: 'x'.repeat(PORT_LIMITS.message) });
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        hostSays(envelope);
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        expect(heard).toEqual([{ current: CURRENT }]);
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(heard).toEqual([{ current: CURRENT }]);
    });

    it('keeps successful buffered results when an anonymous error arrives', () => {
        const { port, hostSays } = setup();
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        hostSays(notification(METHODS.toolResult, { isError: true, content: [{ type: 'text', text: 'refused' }] }));
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        expect(heard).toEqual([{ current: CURRENT }]);
    });
});

describe('the MCP Current payload budget', () => {
    it('rejects an over-budget successful result with one bounded error', () => {
        const { port, hostSays } = setup();
        const currents = [];
        const errors = [];
        port.onCurrent(item => currents.push(item));
        port.onError(error => errors.push(error));
        const overBudget = { ...CURRENT, segments: [{ id: 's', text: '界'.repeat(22_000) }] };
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: overBudget } }));
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
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: fitting } }));
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: oversized } }));
        expect(currents).toHaveLength(1);
        expect(errors).toHaveLength(1);
    });
});

describe('handing Currents to the app', () => {
    it('keeps a few that arrive before anyone is listening, and gives them first', () => {
        const { port, hostSays } = setup();
        for (let i = 0; i < PORT_LIMITS.buffered + 3; i += 1) hostSays(notification(METHODS.toolResult, { structuredContent: { current: { ...CURRENT, id: `c${i}` } } }));
        const heard = [];
        port.onCurrent(item => { heard.push(item.current.id); });
        expect(heard).toHaveLength(PORT_LIMITS.buffered);
        expect(heard[0]).toBe('c3');
        expect(heard.at(-1)).toBe(`c${PORT_LIMITS.buffered + 2}`);
    });

    it('discards buffered Currents on close and does not deliver them to a later listener', () => {
        const { port, hostSays } = setup();
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
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
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(first).toHaveLength(1);
        expect(second).toHaveLength(0);
        offFirst();
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: { ...CURRENT, id: 'another' } } }));
        expect(second).toHaveLength(1);
    });
});

describe('the same Current, twice', () => {
    it('ignores tool input and delivers only the successful result once', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item); });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        expect(heard).toEqual([]);
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        expect(heard).toEqual([{ current: CURRENT }]);
    });

    it('does not mark tool input as delivered before a later listener subscribes', () => {
        const { port, hostSays } = setup();
        const first = [];
        const off = port.onCurrent(item => { first.push(item); return true; });
        hostSays(notification(METHODS.toolInput, { arguments: { current: CURRENT } }));
        off();
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: CURRENT } }));
        const next = [];
        port.onCurrent(item => { next.push(item); });
        expect(first).toEqual([]);
        expect(next).toEqual([{ current: CURRENT }]);
    });

    it('forgets old ones, so the list of what was seen stays small', () => {
        const { port, hostSays } = setup();
        const heard = [];
        port.onCurrent(item => { heard.push(item.current.id); });
        for (let i = 0; i < PORT_LIMITS.remembered + 2; i += 1) hostSays(notification(METHODS.toolResult, { structuredContent: { current: { ...CURRENT, id: `c${i}` } } }));
        hostSays(notification(METHODS.toolResult, { structuredContent: { current: { ...CURRENT, id: 'c0' } } }));
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
        // "View MUST declare all display modes it supports in appCapabilities.availableDisplayModes during initialization" (apps.mdx):
        // the card can fill the screen or float, where a host offers either; it is never moved to a mode it did not declare.
        expect(sent[0].message.params.appCapabilities).toEqual({ availableDisplayModes: ['inline', 'fullscreen', 'pip'] });
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

describe('asking the host for another display mode', () => {
    it('asks with the mode, and gives back the mode the host set, which becomes the context’s', async () => {
        const { port, sent, hostSays } = await connected({ hostContext: { displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] } });
        const asking = port.requestDisplayMode('fullscreen');
        expect(sent[0].message).toMatchObject({ jsonrpc: '2.0', method: METHODS.requestDisplayMode, params: { mode: 'fullscreen' } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: { mode: 'fullscreen' } });
        expect(await asking).toBe('fullscreen');
        expect(port.hostContext()).toMatchObject({ displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] });
    });

    it('keeps the mode it was in when the host names none, and refuses a mode that is not one', async () => {
        const { port, sent, hostSays } = await connected({ hostContext: { displayMode: 'inline' } });
        const asking = port.requestDisplayMode('pip');
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: {} });
        expect(await asking).toBe('inline');
        expect(port.hostContext().displayMode).toBe('inline');
        await expect(port.requestDisplayMode('maximised')).rejects.toThrow(/display mode/u);
        expect(sent).toHaveLength(1);
    });
});

describe('asking the host to open a link outside the card', () => {
    it('asks with the address, and says whether the host opened it', async () => {
        const { port, sent, hostSays } = await connected();
        const opening = port.openLink('https://syberlabs.io/auth/signin');
        expect(sent[0].message).toMatchObject({ jsonrpc: '2.0', method: METHODS.openLink, params: { url: 'https://syberlabs.io/auth/signin' } });
        hostSays({ jsonrpc: '2.0', id: sent[0].message.id, result: {} });
        expect(await opening).toBe(true);
        const refused = port.openLink('https://syberlabs.io/auth/signin');
        hostSays({ jsonrpc: '2.0', id: sent[1].message.id, result: { isError: true } });
        expect(await refused).toBe(false);
    });
});

describe('telling the host’s model what went wrong in a scene (CC-006)', () => {
    const MODEL_CONTEXT = { updateModelContext: { text: {}, image: {} } };
    const reports = sent => sent.filter(item => item.message.method === METHODS.updateModelContext).map(item => item.message);
    const toolResult = current => notification(METHODS.toolResult, { structuredContent: { current } });

    it('reports to a host that said at hello it takes text for its model’s context, as the whole report so far', async () => {
        const { port, sent, hostSays } = await connected({ capabilities: MODEL_CONTEXT });
        expect(port.report('scene "vector": frame failed')).toBe(true);
        expect(port.report('scene "dots": load failed')).toBe(true);
        const [first, second] = reports(sent);
        expect(first).toMatchObject({ jsonrpc: '2.0', id: expect.any(Number), params: { content: [{ type: 'text', text: expect.stringContaining('scene "vector": frame failed') }] } });
        // Each update replaces the last in the host's context, so each carries every line so far.
        expect(second.params.content[0].text).toContain('scene "vector": frame failed\nscene "dots": load failed');
        expect(second.params.content[0].text.startsWith('RISE')).toBe(true);
        hostSays({ jsonrpc: '2.0', id: first.id, result: {} });
        hostSays({ jsonrpc: '2.0', id: second.id, error: { code: -32000, message: 'Context update denied' } });
        await Promise.resolve();
    });

    it('sends nothing, and says so, where the host did not offer it, offered it without text, or has not said hello', async () => {
        for (const capabilities of [{}, { updateModelContext: true }, { updateModelContext: { image: {} } }, { updateModelContext: { text: true } }, { updateModelContext: [] }]) {
            const { port, sent } = await connected({ capabilities });
            expect(port.report('scene "vector": frame failed'), JSON.stringify(capabilities)).toBe(false);
            expect(sent).toEqual([]);
        }
        const { port, sent } = setup();
        expect(port.report('x')).toBe(false);
        expect(sent).toEqual([]);
    });

    it('keeps each report under 2,000 characters with no control characters, and stops after five for one Current', async () => {
        const { port, sent } = await connected({ capabilities: MODEL_CONTEXT });
        for (let index = 0; index < 7; index += 1) port.report(`line ${index}\u0007\n${'x'.repeat(900)}`);
        const sentReports = reports(sent);
        expect(sentReports).toHaveLength(5);
        for (const message of sentReports) {
            const { text } = message.params.content[0];
            expect(text.length).toBeLessThanOrEqual(2_000);
            expect(text).not.toMatch(/\u0007/u);
        }
        expect(port.report('one more')).toBe(false);
    });

    it('starts afresh for a new Current, and not for the same one again', async () => {
        const { port, sent, hostSays } = await connected({ capabilities: MODEL_CONTEXT });
        port.onCurrent(() => true);
        hostSays(toolResult(CURRENT));
        for (let index = 0; index < 5; index += 1) port.report(`old ${index}`);
        expect(port.report('old 5')).toBe(false);
        hostSays(toolResult(CURRENT));
        expect(port.report('still old')).toBe(false);
        hostSays(toolResult({ ...CURRENT, id: 'next' }));
        expect(port.report('new 0')).toBe(true);
        expect(reports(sent).at(-1).params.content[0].text).not.toContain('old');
    });

    it('reports nothing once closed', async () => {
        const { port, sent } = await connected({ capabilities: MODEL_CONTEXT });
        port.close();
        expect(port.report('x')).toBe(false);
        expect(sent).toEqual([]);
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

describe('writing down what the host says, for a witness', () => {
    it('given a log, writes one JSON line for the hello’s context, one per change, and one per size report', async () => {
        const lines = [];
        const { port, hostSays } = await connected({
            log: line => lines.push(line),
            hostContext: {
                containerDimensions: { width: 560, maxHeight: 640 }, displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'],
                safeAreaInsets: { top: 0, right: 0, bottom: 34, left: 0 }, theme: 'dark',
                styles: { variables: { '--font-sans': 'Inter, sans-serif', '--color-background': '#fff' } },
                platform: 'web', deviceCapabilities: { touch: false }, locale: 'en-US'
            }
        });
        hostSays(notification(METHODS.hostContextChanged, { containerDimensions: { maxHeight: 520 } }));
        port.sizeChanged({ height: 481 });
        expect(lines.map(line => JSON.parse(line))).toEqual([
            {
                'rise-host': 'initialize',
                containerDimensions: { width: 560, maxHeight: 640 }, displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'],
                safeAreaInsets: { top: 0, right: 0, bottom: 34, left: 0 }, theme: 'dark',
                stylesVariables: ['--font-sans', '--color-background'],
                platform: 'web', deviceCapabilities: { touch: false }
            },
            { 'rise-host': 'context-changed', containerDimensions: { maxHeight: 520 } },
            { 'rise-host': 'size-changed', height: 481 }
        ]);
    });

    it('writes a change’s style variables as their keys, and a hello without a context as the marker alone', async () => {
        const lines = [];
        const { hostSays } = await connected({ log: line => lines.push(line) });
        hostSays(notification(METHODS.hostContextChanged, { theme: 'light', styles: { variables: { '--font-sans': 'Inter' } } }));
        expect(lines.map(line => JSON.parse(line))).toEqual([
            { 'rise-host': 'initialize' },
            { 'rise-host': 'context-changed', theme: 'light', stylesVariables: ['--font-sans'] }
        ]);
    });
});
