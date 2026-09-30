/**
 * Adversarial tests for the live layer (see docs/plans/LIVE-RED-TEAM.md).
 *
 * Two kinds of test live here, and the difference matters:
 *
 *   it(...)        an invariant that was attacked and HELD. These are the false
 *                  alarms of the review, kept so that the attack stays refuted.
 *   it.fails(...)  an invariant that was attacked and BROKE. Each asserts what
 *                  should be true, so it fails today and vitest reports that as a
 *                  pass. When the defect is fixed the test starts to pass, vitest
 *                  reports that as a failure, and the fix turns `it.fails` into
 *                  `it`. Production behaviour is not changed here.
 */
import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from '../core/rise-current.js';
import { toSealedCurrent } from '../test/sealed-current.js';
import { createFakeMcpPort } from '../test/fake-mcp-port.js';
import { createChannel, createEventWriter } from './adapter.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { createOpenAIRealtimeAdapter } from './adapters/openai-realtime.js';
import { createSegmentParser } from './adapters/segment-parser.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createVirtualClock } from './clock.js';
import { HORIZON_DIVE } from './fixtures/black-holes.js';
import { describeOrigin } from './host/passage.js';
import { RISE_CURRENT_EVENTS_SCHEMA, validateEvent } from './protocol.js';
import { createLiveRuntime } from './runtime.js';
import { STREAM_LIMITS, createCurrentStream } from './stream.js';

const flush = async (turns = 30) => { for (let i = 0; i < turns; i += 1) await Promise.resolve(); };
const macrotask = () => new Promise(resolve => setImmediate(resolve));
const event = (seq, type, body = {}, currentId = 'c') => ({ schema: RISE_CURRENT_EVENTS_SCHEMA, currentId, seq, type, ...body });
const OPEN = { title: 'T', origin: { kind: 'model', name: 'm', provider: 'p' } };

/** A deterministic PRNG, so a failing seed can be replayed. */
function prng(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5; state >>>= 0;
        return state / 0x1_0000_0000;
    };
}

// ─── 1. the event protocol ──────────────────────────────────────────────

describe('protocol: validateEvent returns what it checked', () => {
    it.fails('DEFECT: an accessor can return a visual outside the closed catalog after it was checked', () => {
        let reads = 0;
        const raw = { schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: 'c', seq: 1, type: 'segment.begin', segmentId: 's' };
        Object.defineProperty(raw, 'visual', {
            enumerable: true,
            get() { reads += 1; return reads <= 2 ? 'still' : 'webgpu:any-shader'; }
        });
        let clean;
        try { clean = validateEvent(raw); } catch { return; }
        expect(['still', 'attractor', 'genesis']).toContain(clean.visual);
    });

    it.fails('DEFECT: an accessor can change an evidence kind between the check and the copy', () => {
        let reads = 0;
        const evidence = { id: 'e', title: 'A source' };
        Object.defineProperty(evidence, 'kind', {
            enumerable: true,
            get() { reads += 1; return reads === 1 ? 'model-proposed' : 'javascript:alert(1)'; }
        });
        const clean = validateEvent(event(1, 'evidence.add', { segmentId: 's', evidence }));
        expect(['supplied', 'retrieved', 'model-proposed']).toContain(clean.evidence.kind);
    });

    it('holds: JSON-shaped hostile input (prototype keys, sparse arrays, nulls, deep nesting) is refused', () => {
        const hostile = [
            JSON.parse('{"schema":"rise.current-events.v1","currentId":"c","seq":0,"type":"current.open","title":"T","origin":{"kind":"human","name":"n"},"__proto__":{"polluted":true}}'),
            { ...event(1, 'segment.text', { segmentId: 's', offset: 0, text: 'a' }), text: ['a', , 'b'] }, // eslint-disable-line no-sparse-arrays
            event(1, 'segment.begin', { segmentId: 's', visual: null }),
            event(1, 'state.set', { segmentId: 's', state: { motionEnergy: { valueOf: () => 0.5 } } }),
            event(1, 'dive.attach', { segmentId: 's', dive: { id: 'd', text: 'x', anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: 'a', quoteEnd: 'a', nested: { deeper: {} } } } }),
            event(Number.MAX_SAFE_INTEGER, 'segment.end', { segmentId: 's' }),
            event(1.5, 'segment.end', { segmentId: 's' })
        ];
        for (const raw of hostile) expect(() => validateEvent(raw)).toThrow();
        expect({}.polluted).toBeUndefined();
    });
});

describe('protocol: the reducer under a generated hostile stream', () => {
    /** A valid Current's events, in order. */
    function validScript(rand) {
        const out = [event(0, 'current.open', OPEN)];
        const segments = 1 + Math.floor(rand() * 4);
        for (let s = 0; s < segments; s += 1) {
            const id = `s${s}`;
            out.push(event(out.length, 'segment.begin', { segmentId: id, visual: 'still' }));
            let offset = 0;
            const chunks = 1 + Math.floor(rand() * 4);
            for (let c = 0; c < chunks; c += 1) {
                const text = `${c ? ' ' : ''}Word${s}${c} more.`;
                out.push(event(out.length, 'segment.text', { segmentId: id, offset, text }));
                offset += text.length;
            }
            out.push(event(out.length, 'segment.end', { segmentId: id }));
        }
        out.push(event(out.length, 'current.complete'));
        return out;
    }

    /** What an attacker may do to a delivery: reorder, repeat, contradict, corrupt, and keep going after the end. */
    function hostileDelivery(script, rand) {
        const delivered = [];
        const window = script.map(e => e);
        while (window.length) {
            const pick = Math.min(window.length - 1, Math.floor(rand() * 4));
            const [next] = window.splice(pick, 1);
            delivered.push(next);
            const roll = rand();
            if (roll < 0.15) delivered.push(next);
            else if (roll < 0.22 && next.type === 'segment.text') delivered.push({ ...next, text: 'Rewritten words.' });
            else if (roll < 0.27) delivered.push({ ...next, seq: next.seq + 1 + Math.floor(rand() * 40), type: 'segment.end', segmentId: 'nope' });
            else if (roll < 0.30) delivered.push({ junk: true, seq: next.seq });
            else if (roll < 0.33) delivered.push(JSON.parse(`{"schema":"${RISE_CURRENT_EVENTS_SCHEMA}","currentId":"c","seq":${next.seq},"type":"current.cancel","__proto__":{}}`));
        }
        delivered.push(event(0, 'current.open', OPEN), event(script.length, 'segment.begin', { segmentId: 'late' }));
        return delivered;
    }

    it('holds: over 400 seeds, apply never throws, ended words never change, and every lowering is a prefix of the next', () => {
        for (let seed = 1; seed <= 400; seed += 1) {
            const rand = prng(seed);
            const stream = createCurrentStream();
            const frozen = new Map();
            let lastCurrent = null;
            for (const raw of hostileDelivery(validScript(rand), rand)) {
                expect(() => stream.apply(raw), `seed ${seed}`).not.toThrow();
                const view = stream.snapshot();
                for (const segment of view.segments.filter(item => item.ended)) {
                    if (frozen.has(segment.id)) expect(segment.text, `seed ${seed}`).toBe(frozen.get(segment.id));
                    else frozen.set(segment.id, segment.text);
                }
                if (stream.endedCount > 0) {
                    const current = stream.toCurrent();
                    if (lastCurrent) {
                        expect(current.segments.length).toBeGreaterThanOrEqual(lastCurrent.segments.length);
                        lastCurrent.segments.forEach((segment, i) => expect(current.segments[i]).toEqual(segment));
                    }
                    lastCurrent = current;
                }
                expect(stream.pressure).toBeLessThanOrEqual(STREAM_LIMITS.window);
                expect(stream.snapshot().refusals).toBeLessThanOrEqual(STREAM_LIMITS.refusals);
            }
            expect(['complete', 'failed', 'cancelled', 'open']).toContain(stream.phase);
        }
        expect({}.polluted).toBeUndefined();
    });

    it('holds: a storm of duplicates and late events cannot run forever: the Current fails at the event cap', () => {
        const stream = createCurrentStream();
        stream.apply(event(0, 'current.open', OPEN));
        let applied = 0;
        for (let i = 0; i < STREAM_LIMITS.events + 10; i += 1) applied += stream.apply(event(0, 'current.open', OPEN)).applied;
        expect(applied).toBe(0);
        expect(stream.phase).toBe('failed');
        expect(stream.snapshot().error.code).toBe('TOO_MANY_EVENTS');
    });

    it.fails('DEFECT: an ended segment’s condition and sources can still be changed, which the plan says is refused', () => {
        const stream = createCurrentStream();
        stream.apply(event(0, 'current.open', OPEN));
        stream.apply(event(1, 'segment.begin', { segmentId: 'a', visual: 'attractor' }));
        stream.apply(event(2, 'segment.text', { segmentId: 'a', offset: 0, text: 'Already said.' }));
        stream.apply(event(3, 'segment.end', { segmentId: 'a' }));
        const late = [
            stream.apply(event(4, 'state.set', { segmentId: 'a', state: { motionEnergy: 1 } })),
            stream.apply(event(5, 'evidence.add', { segmentId: 'a', evidence: { id: 'e', kind: 'supplied', title: 'Added after the passage ended' } }))
        ];
        expect(late.map(result => result.status)).toEqual(['refused', 'refused']);
    });
});

// ─── 2. model text streaming ────────────────────────────────────────────

describe('segment parser: what a model can make it hold', () => {
    it.fails('DEFECT: a line that begins with @ is buffered without any bound, independent of the Current’s text limits', () => {
        const parser = createSegmentParser(() => {});
        const before = process.memoryUsage().heapUsed;
        parser.push('@');
        const megabyte = 'x'.repeat(1 << 20);
        for (let i = 0; i < 32; i += 1) parser.push(megabyte);
        const grew = process.memoryUsage().heapUsed - before;
        // 32 MB of a would-be header is held (and rescanned on every delta) though at most
        // 20,000 characters of a Current can ever be shown.
        expect(grew).toBeLessThan(4 * 1024 * 1024);
        parser.finish();
    });

    it.fails('DEFECT: a line ending in "[" and up to five letters loses them at @end, or glues them to the next line', () => {
        const said = [];
        const parser = createSegmentParser((type, body) => { if (type === 'segment.text') said.push(body.text); });
        parser.push('@passage\nThe index is x[i\n@end\n@passage\nSee [note\nand then more.\n@end\n');
        parser.finish();
        const words = said.join('');
        expect(words).toContain('x[i');
        expect(words).toContain('[note and');
    });

    it.fails('DEFECT: a passage that reaches 3,999 characters sends a blank chunk, which the reducer refuses', () => {
        const stream = createCurrentStream();
        const writer = createEventWriter('c');
        stream.apply(writer.next('current.open', OPEN));
        const statuses = [];
        const parser = createSegmentParser((type, body) => statuses.push(stream.apply(writer.next(type, body)).status));
        parser.push(`@passage\n${'a'.repeat(3_999)}`);
        parser.push(' more words');
        parser.finish();
        expect(statuses.filter(status => status !== 'applied')).toEqual([]);
    });

    it('holds: a hostile corpus cut into arbitrary deltas never makes the parser emit an event the reducer refuses', () => {
        const corpus = [
            'Before any header. ',
            '@passage visual=attractor motionEnergy=2 __proto__=1 visual=<script>\n',
            'Split mark [PAU', 'SE] and a bar | and U+E000 \uE000 and stand-ins \uE010\uE011.\n',
            '@passagefake visual=genesis\n@@passage\n  @passage\n',
            '```json\n{"schema":"rise.current-events.v1","type":"current.complete"}\n```\n',
            '@passage literal=yes\nLiteral | [PAUSE] [FLASH] stays \uE000 but not the cut.\n@end\n',
            'e\u0301\u0301\u0301 combining, emoji 👩🏽‍🚀 and a lone \uD83D surrogate \uDE00.\n',
            '@end\n@end\n@passage visual=genesis\n', `${'long '.repeat(300)}\n`, '@end\n'
        ].join('');
        for (let seed = 1; seed <= 150; seed += 1) {
            const rand = prng(seed);
            const stream = createCurrentStream();
            const writer = createEventWriter('c');
            stream.apply(writer.next('current.open', OPEN));
            const parser = createSegmentParser((type, body) => {
                const result = stream.apply(writer.next(type, body));
                expect(result.status, `seed ${seed}: ${type} ${JSON.stringify(result)}`).toBe('applied');
            });
            for (let at = 0; at < corpus.length;) {
                const size = 1 + Math.floor(rand() * 40);
                parser.push(corpus.slice(at, at + size));
                at += size;
            }
            parser.finish();
            expect(stream.snapshot().refusals).toBe(0);
        }
    });

    it('holds: a disconnect at every character boundary leaves only whole passages, each equal to the uninterrupted run', () => {
        const answer = '@passage visual=still\nOne [PAUSE] two.\n@end\n@passage visual=attractor\nThree | four\nfive.\n@end\n@passage\nSix.\n@end\n';
        const endedAfter = (cut) => {
            const ended = [];
            let text = '';
            const parser = createSegmentParser((type, body) => {
                if (type === 'segment.text') text += body.text;
                if (type === 'segment.end') { ended.push(text); text = ''; }
                if (type === 'segment.begin') text = '';
            });
            for (const ch of answer.slice(0, cut)) parser.push(ch);
            if (cut === answer.length) parser.finish(); else parser.abandon();
            return ended;
        };
        const whole = endedAfter(answer.length);
        for (let cut = 0; cut <= answer.length; cut += 1) {
            const partial = endedAfter(cut);
            expect(partial).toEqual(whole.slice(0, partial.length));
        }
    });
});

describe('text-stream adapter: the outcome depends on how the provider cuts its words', () => {
    async function run(deltas, { burst = false } = {}) {
        let sink;
        const adapter = createTextStreamAdapter({
            id: 't', provider: 'p',
            connect: async (_request, providerSink) => { sink = providerSink; return { cancel() {}, close() {} }; }
        });
        const connection = await adapter.open({ intent: 'answer', prompt: 'q' });
        const stream = createCurrentStream();
        const pumped = (async () => {
            try {
                for await (const raw of connection.events) { stream.apply(raw); if (stream.terminal) break; }
            } catch (error) { return error.code; }
            return null;
        })();
        for (const delta of deltas) { sink.delta(delta); if (!burst) await macrotask(); }
        sink.done();
        const thrown = await pumped;
        return { phase: stream.phase, code: thrown ?? stream.snapshot().error?.code ?? null, ended: stream.endedCount };
    }

    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}.`).join('\n');
    const poem = `@passage visual=still\n${lines}\n@end\n`;

    it('holds: the same many-line answer arriving line by line completes', async () => {
        expect(await run(poem.split(/(?<=\n)/u))).toMatchObject({ phase: 'complete', ended: 1 });
    });

    it.fails('DEFECT: the same answer arriving in one delta overflows the adapter’s queue and nothing is shown', async () => {
        expect(await run([poem], { burst: true })).toMatchObject({ phase: 'complete', ended: 1 });
    });

    it.fails('DEFECT: an answer within every text limit fails TOO_MANY_EVENTS when a provider sends one character per delta', async () => {
        const passage = n => `@passage visual=still\n${Array.from({ length: 330 }, (_, i) => `abcdefgh${(i + n) % 10}`).join(' ')}.\n@end\n`;
        const answer = passage(0) + passage(1) + passage(2);
        expect(answer.length).toBeLessThan(10_000);
        expect(await run([...answer])).toMatchObject({ phase: 'complete', ended: 3 });
    }, 30_000);
});

// ─── 3. runtime concurrency ─────────────────────────────────────────────

/** An adapter whose `open` resolves only when the test says, like a WebRTC session still connecting. */
function slowAdapter() {
    const opens = [];
    return {
        opens,
        adapter: {
            id: 'slow',
            capabilities: {},
            open(request, { signal } = {}) {
                const currentId = `c${opens.length}`;
                const channel = createChannel({ capacity: 64 });
                const writer = createEventWriter(currentId);
                const connection = {
                    currentId, closed: false, events: channel,
                    record() {}, async interrupt() {}, async resume() {},
                    async close() { connection.closed = true; channel.close(); }
                };
                let release;
                const opened = new Promise(resolve => { release = () => resolve(connection); });
                const say = (type, body = {}) => channel.pushNow(writer.next(type, body));
                opens.push({ request, signal, connection, release, say });
                return opened;
            }
        }
    };
}

function fakePlayers() {
    const made = [];
    const factory = (session, { role }) => {
        const player = {
            role, destroyed: false, live: false,
            sessionState: { session, currentIndex: 0, state: 'idle' },
            on() { return () => {}; },
            setLive(live) { player.live = live; },
            extend(next) { player.sessionState.session = next; },
            play() { player.sessionState.state = 'playing'; },
            pause() { player.sessionState.state = 'paused'; },
            destroy() { player.destroyed = true; }
        };
        made.push(player);
        return player;
    };
    return { made, factory };
}

function build() {
    const { adapter, opens } = slowAdapter();
    const players = fakePlayers();
    const presented = [];
    const runtime = createLiveRuntime({
        adapter,
        createPlayer: players.factory,
        clock: createVirtualClock(),
        host: { present: ({ role }) => { presented.push({ role, status: runtime.status }); }, dismiss() {} }
    });
    return { runtime, opens, players: players.made, presented };
}

const onePassage = (say, id = 'a') => {
    say('current.open', OPEN);
    say('segment.begin', { segmentId: id, visual: 'still' });
    say('segment.text', { segmentId: id, offset: 0, text: 'Some words that were said.' });
    say('segment.end', { segmentId: id });
};

/** Start, let the provider connect, and commit one passage: a reading that is live. */
async function begin({ runtime, opens }) {
    const started = runtime.start('q');
    await flush();
    opens[0].release();
    await started;
    onePassage(opens[0].say);
    await flush();
}

async function diveIn({ runtime, opens }) {
    const diving = runtime.dive({ question: 'why?', segmentId: 'a' });
    await flush();
    opens[1].release();
    await diving;
    onePassage(opens[1].say, 'side-a');
    await flush();
}

describe('runtime: Stop, Dive and Surface racing an open that has not finished', () => {
    it('Stop while the provider is still connecting: nothing is presented and the late connection is closed', async () => {
        const { runtime, opens, players, presented } = build();
        const started = runtime.start('q');
        await flush();
        await runtime.stop();
        opens[0].release();
        await started.catch(() => {});
        onePassage(opens[0].say);
        await flush();
        expect({ status: runtime.status, players: players.length, presented: presented.length, closed: opens[0].connection.closed })
            .toEqual({ status: 'stopped', players: 0, presented: 0, closed: true });
    });

    it('a second Dive asked before the first has opened is refused, and nothing is orphaned', async () => {
        const built = build();
        const { runtime, opens } = built;
        await begin(built);
        expect(runtime.status).toBe('live');
        const first = runtime.dive({ question: 'one?', segmentId: 'a' });
        const second = runtime.dive({ question: 'two?', segmentId: 'a' }).catch(error => error.code);
        await flush();
        opens[1]?.release();
        opens[2]?.release();
        await Promise.allSettled([first, second]);
        await runtime.surface();
        const sides = opens.slice(1);
        expect({ opened: sides.length, allClosed: sides.every(open => open.connection.closed) }).toEqual({ opened: 1, allClosed: true });
    });

    it('Stop while a Dive is still opening: the Dive is never started and its connection is closed', async () => {
        const built = build();
        const { runtime, opens, players } = built;
        await begin(built);
        const diving = runtime.dive({ question: 'why?', segmentId: 'a' }).catch(() => {});
        await flush();
        await runtime.stop();
        opens[1].release();
        await diving;
        onePassage(opens[1].say, 'side-a');
        await flush();
        expect({ status: runtime.status, sidePlayers: players.filter(p => p.role === 'side').length, closed: opens[1].connection.closed })
            .toEqual({ status: 'stopped', sidePlayers: 0, closed: true });
    });

    it('Stop during Surface: the destroyed parent Player is not presented again', async () => {
        const built = build();
        const { runtime, presented, players } = built;
        await begin(built);
        await diveIn(built);
        const before = presented.length;
        const surfacing = runtime.surface();
        const stopping = runtime.stop();
        await Promise.allSettled([surfacing, stopping]);
        await flush();
        const main = players.find(player => player.role === 'main');
        expect({ status: runtime.status, presentedAfterStop: presented.length - before, mainDestroyed: main.destroyed })
            .toEqual({ status: 'stopped', presentedAfterStop: 0, mainDestroyed: true });
    });

    it('holds: events a provider sends after Stop are never applied', async () => {
        const built = build();
        const { runtime, opens, players } = built;
        await begin(built);
        await runtime.stop();
        opens[0].say('segment.begin', { segmentId: 'b' });
        await flush();
        expect(runtime.composed()?.segments.map(s => s.id) ?? ['a']).toEqual(['a']);
        expect(players[0].destroyed).toBe(true);
        expect(opens[0].connection.closed).toBe(true);
    });

    it('Stop tells an open that has not finished to give up, so a provider can abandon it before it asks', async () => {
        const { runtime, opens } = build();
        const started = runtime.start('q');
        await flush();
        expect(opens[0].signal?.aborted).toBe(false);
        await runtime.stop();
        expect(opens[0].signal.aborted).toBe(true);
        opens[0].release();
        await started;
    });

    it('the OpenAI adapter hands the signal to its transport, and never asks once it has been stopped', async () => {
        const sent = [];
        let closed = 0;
        let given;
        const stop = new AbortController();
        const transport = {
            async open(options) {
                given = options?.signal;
                stop.abort();
                return { send: text => sent.push(text), onMessage() {}, onClose() {}, close: () => { closed += 1; } };
            }
        };
        const adapter = createOpenAIRealtimeAdapter({ transport });
        await expect(adapter.open({ intent: 'answer', prompt: 'q' }, { signal: stop.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect({ given: given === stop.signal, sent, closed }).toEqual({ given: true, sent: [], closed: 1 });
    });

    it('a voice that calls back after Stop changes nothing the runtime keeps', async () => {
        const { adapter, opens } = slowAdapter();
        let callbacks = null;
        const voice = { attach(cb) { callbacks = cb; }, enqueue() {}, hold() {}, release() {}, close() {}, playedMs: () => undefined };
        const runtime = createLiveRuntime({
            adapter, createPlayer: fakePlayers().factory, clock: createVirtualClock(), voices: { create: () => voice }
        });
        await begin({ runtime, opens });
        await runtime.stop();
        const kept = runtime.journal().length;
        callbacks.start('a');
        callbacks.end('a', 100);
        callbacks.fail('a', 'late');
        expect(runtime.journal().length).toBe(kept);
    });
});

// ─── 4. the Player extension ────────────────────────────────────────────

describe('Session extension: is the prefix the same reading, or only the same words?', () => {
    const lower = segments => compileRiseCurrent({ schema: 'rise.current.v1', id: 'x', title: 'T', origin: OPEN.origin, segments });
    const segments = [
        { id: 'a', text: 'First sentence here. Second one follows! A third?', visual: 'attractor' },
        { id: 'b', text: 'Another passage, with a clause; and more. Done.', visual: 'still' },
        { id: 'c', text: 'Short.', visual: 'genesis' }
    ];

    it('holds: every field of every committed atom except its id is identical across lowerings', () => {
        const sessions = [1, 2, 3].map(n => lower(segments.slice(0, n)));
        const strip = ({ id, ...rest }) => rest;
        for (let n = 1; n < sessions.length; n += 1) {
            sessions[n - 1].atoms.forEach((atom, i) => expect(strip(sessions[n].atoms[i])).toEqual(strip(atom)));
        }
    });

    it('risk: an atom’s id is regenerated on every lowering, so nothing may key on it across an extension', () => {
        const once = lower(segments.slice(0, 1)).atoms.map(atom => atom.id);
        const again = lower(segments.slice(0, 1)).atoms.map(atom => atom.id);
        expect(once.some((id, i) => id === again[i])).toBe(false);
    });
});

// ─── 5. provenance through the MCP host ────────────────────────────────

describe('MCP: who a host’s model may say it is', () => {
    async function diveAnswer(origin) {
        const clock = createVirtualClock();
        const dive = { ...toSealedCurrent(HORIZON_DIVE, 'dive-answer'), origin };
        const port = createFakeMcpPort({ clock, dive });
        const adapter = createMcpAppAdapter({ port, clock });
        const connection = await adapter.open({
            intent: 'dive', prompt: 'What is the horizon?',
            parent: { currentId: 'p', segmentId: 's', atCharacter: 0, context: ['The horizon.'] }
        });
        const stream = createCurrentStream();
        const read = (async () => { for await (const raw of connection.events) stream.apply(raw); })();
        await clock.advance(1_000);
        await read;
        return stream;
    }

    it.fails('DEFECT: a Dive written by the host’s model can present itself as a human author', async () => {
        const stream = await diveAnswer({ kind: 'human', name: 'Your teacher' });
        const origin = stream.snapshot().origin;
        expect(describeOrigin(origin)).toMatch(/^Written when you asked, by /u);
        expect(compileRiseCurrent(stream.toCurrent()).experienceProgram.authority).toBe('proposed');
    });
});
