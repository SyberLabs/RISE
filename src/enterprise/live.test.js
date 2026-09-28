import { afterEach, describe, expect, it, vi } from 'vitest';
import { DECISION_SCHEMA } from './context.js';
import { ingestCorpus } from './corpus.js';
import { demoCorpusInput, demoDeck } from './demo.js';
import { createLiveLoop, localDecider } from './live.js';
import { prepareTalk } from './prepare.js';
import { createRemoteDecider, DecisionError, KEV_REVISION } from './remote-decider.js';
import { openSession } from './session.js';
import { createTrace } from './trace.js';

function room() {
    const corpus = ingestCorpus(demoCorpusInput());
    const program = prepareTalk({ deck: demoDeck(), corpus, audienceId: 'all-hands', presenterId: 'ada' });
    let clock = 0;
    const now = () => clock;
    const trace = createTrace({ now });
    const session = openSession({ program, corpus, now, sessionId: 'room1', onEvent: trace.emit });
    return { session, trace, tick: (ms) => { clock += ms; } };
}

const final = (text, at = 0) => ({ text, final: true, speaker: 'presenter', speakerId: 'ada', at });
const atlas = (at) => final('Atlas renewal price', at);

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

function answer(context, index = 0) {
    const pick = context.structure.candidates[index];
    return { raw: { action: 'show', cardId: pick.id, layout: pick.layout }, meta: { provider: 'Kev', model: 'kev-latest' } };
}

afterEach(() => vi.useRealTimers());

describe('live loop', () => {
    it('warms on interim speech and decides only on a final', async () => {
        const { session, trace } = room();
        const decide = vi.fn(async (context) => answer(context));
        const loop = createLiveLoop({ session, decide, trace, now: () => 0 });
        const warm = await loop.hear({ ...atlas(0), final: false });
        expect(warm.action).toBe('warm');
        expect(warm.leaders[0].title).toBe('Atlas renewal');
        expect(decide).not.toHaveBeenCalled();
        expect(session.rail()).toEqual([]);

        const shown = await loop.hear(atlas(0));
        expect(shown.action).toBe('show');
        expect(decide).toHaveBeenCalledOnce();
        expect(session.rail()[0].decidedBy).toBe('Kev');
        const types = trace.events().map(event => event.type);
        expect(types).toEqual(['warm', 'candidates', 'decision.request', 'decision.response', 'rail.show']);
    });

    it('cancels a slower decision when a newer final arrives, and holds its late answer', async () => {
        const { session, trace } = room();
        const slow = deferred();
        const signals = [];
        const decide = vi.fn((context, { signal }) => {
            signals.push(signal);
            return decide.mock.calls.length === 1 ? slow.promise.then(() => answer(context)) : Promise.resolve(answer(context));
        });
        const loop = createLiveLoop({ session, decide, trace });
        const first = loop.hear(atlas(0));
        expect(loop.pending()).toBe('room1:1');
        const second = loop.hear(final('pipeline revenue by quarter', 20_000));
        expect(signals[0].aborted).toBe(true);
        slow.resolve();
        expect(await first).toMatchObject({ action: 'hold', reason: 'superseded' });
        expect(await second).toMatchObject({ action: 'show' });
        expect(session.rail().map(card => card.kind)).toEqual(['chart']);
        expect(trace.summary().decisions.outcomes).toEqual({ superseded: 1, answered: 1 });
    });

    it('times out a decider that never answers and ignores its abort signal', async () => {
        vi.useFakeTimers();
        const { session, trace } = room();
        const loop = createLiveLoop({ session, decide: () => new Promise(() => {}), trace, timeoutMs: 1000 });
        const pending = loop.hear(atlas(0));
        await vi.advanceTimersByTimeAsync(1000);
        expect(await pending).toMatchObject({ action: 'hold', reason: 'timeout' });
        expect(session.rail()).toEqual([]);
        expect(loop.pending()).toBeNull();
    });

    it.each([
        ['throws', async () => { throw new Error('boom'); }, 'error'],
        ['reports unavailable', async () => { throw new DecisionError('unavailable', 503); }, 'unavailable'],
        ['returns nothing', async () => undefined, 'invalid'],
        ['returns prose', async () => ({ raw: 'show the 880 million memo', meta: {} }), 'invalid'],
        ['names a restricted card', async () => ({
            raw: { action: 'show', cardId: 'card:retrieval:board-memo:1:0', layout: 'quote' }, meta: {}
        }), 'invalid']
    ])('holds when the decider %s', async (_, decide, reason) => {
        const { session, trace } = room();
        const loop = createLiveLoop({ session, decide, trace });
        expect(await loop.hear(atlas(0))).toMatchObject({ action: 'hold', reason });
        expect(session.rail()).toEqual([]);
        expect(session.stage()).toEqual([]);
        expect(JSON.stringify(trace.toJSON())).not.toContain('880');
    });

    it('aborts the decision in flight on stop and then ignores speech', async () => {
        const { session } = room();
        const loop = createLiveLoop({ session, decide: () => new Promise(() => {}) });
        const pending = loop.hear(atlas(0));
        loop.stop();
        expect(await pending).toMatchObject({ action: 'hold', reason: 'stopped' });
        expect(await loop.hear(atlas(9000))).toMatchObject({ action: 'ignore' });
    });

    it('holds instead of rejecting when preparing a turn throws', async () => {
        const { session } = room();
        const broken = { ...session, prepare: () => { throw new Error('bad transcript'); } };
        const decide = vi.fn();
        const loop = createLiveLoop({ session: broken, decide });
        expect(await loop.hear(atlas(0))).toMatchObject({ action: 'hold', reason: 'error' });
        expect(decide).not.toHaveBeenCalled();
        expect(session.rail()).toEqual([]);
    });

    it('keeps one decision in flight per channel, and neither cancels the other', async () => {
        const { session } = room();
        const pending = [];
        const decide = vi.fn((context, { signal }) => new Promise((done) => {
            pending.push({ context, signal, done });
        }));
        const loop = createLiveLoop({ session, decide });
        const asked = loop.reason({ text: 'pipeline revenue by quarter', at: 0 });
        const spoken = loop.hear(atlas(10));
        const spokenAgain = loop.hear(final('Atlas plan renewal price', 20));
        expect(pending.map(item => item.signal.aborted)).toEqual([false, true, false]);
        pending[0].done(answer(pending[0].context));
        pending[2].done({ raw: { action: 'hold', cardId: null, layout: null }, meta: {} });
        expect(await asked).toMatchObject({ action: 'show', tier: 'reasoning' });
        expect(await spoken).toMatchObject({ action: 'hold', reason: 'superseded' });
        expect((await spokenAgain).reason).toBe('decider');

        const olderAsk = loop.reason({ text: 'Atlas renewal price', at: 30 });
        loop.reason({ text: 'pipeline revenue by quarter', at: 40 });
        expect(await olderAsk).toMatchObject({ action: 'hold', reason: 'superseded' });
    });

    it('runs a reasoning request through the same decision path', async () => {
        const input = demoCorpusInput();
        input.documents.push({ id: 'ops', title: 'Ops note', audiences: ['all-hands'],
            pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }] });
        const corpus = ingestCorpus(input);
        const program = prepareTalk({ deck: demoDeck(), corpus, audienceId: 'all-hands', presenterId: 'ada' });
        const session = openSession({ program, corpus, now: (at) => at });
        const loop = createLiveLoop({ session, decide: localDecider });
        expect(await loop.reason({ text: 'cafeteria soup tuesday', at: 0 })).toMatchObject({ action: 'show', tier: 'reasoning' });
        expect(session.rail()[0].decidedBy).toBe('local');
        expect(session.stage()).toEqual([]);
    });
});

describe('local Kev decider', () => {
    const context = () => room().session.prepare(atlas(0)).context;
    const REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
    const kev = (answer, { revision = REVISION, model = 'kev-latest', status = 200 } = {}) =>
        vi.fn(async () => new Response(JSON.stringify({ model, answers: { rail_action: answer } }), {
            status, headers: { 'Content-Type': 'application/json', ...(revision ? { 'x-kev-revision': revision } : {}) }
        }));

    it('pins the same Kev revision as the reader', async () => {
        const { KEV_REVISION: readerRevision } = await import('../core/decision/providers.js');
        expect(KEV_REVISION).toBe(readerRevision);
    });

    it('asks one opaque rail question on the same-origin bridge and maps the choice back', async () => {
        const ctx = context();
        const first = ctx.structure.candidates[0];
        const fetch = kev({ type: 'choice', choice: `show_1_${first.layouts[0]}`, confidence: 0.8 });
        const result = await createRemoteDecider({ fetch })(ctx, {});
        expect(result.raw).toEqual({ action: 'show', cardId: first.id, layout: first.layouts[0] });
        expect(result.meta).toMatchObject({ provider: 'Kev', revision: REVISION, confidence: 0.8 });
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('/api/local/kev/systemone');
        expect(init.credentials).toBe('same-origin');
        expect(init.headers).not.toHaveProperty('Authorization');
        const sent = JSON.parse(init.body);
        expect(sent.model).toBe('kev-latest');
        expect(Object.keys(sent.questions)).toEqual(['rail_action']);
        // Titles and scores only, never card ids.
        expect(init.body).not.toContain(first.id);
    });

    it.each([
        ['an option that was not offered', { type: 'choice', choice: 'show_99_quote' }, {}],
        ['a publish verb', { type: 'choice', choice: 'promote' }, {}],
        ['free text', { type: 'text', text: 'The acquisition price is 880 million' }, {}],
        ['a confidence above one', { type: 'choice', choice: 'hold', confidence: 3 }, {}],
        ['an unattested checkpoint', { type: 'choice', choice: 'hold' }, { revision: null }],
        ['a different checkpoint', { type: 'choice', choice: 'hold' }, { revision: 'b'.repeat(40) }],
        ['a different model', { type: 'choice', choice: 'hold' }, { model: 'jev-latest' }]
    ])('refuses %s', async (_, answer, options) => {
        await expect(createRemoteDecider({ fetch: kev(answer, options) })(context(), {}))
            .rejects.toMatchObject({ reason: 'invalid' });
    });

    it.each([[503, 'unavailable'], [429, 'rate-limited'], [504, 'timeout'], [502, 'error'], [404, 'unavailable']])(
        'maps HTTP %s to %s (the public site has no bridge: 404)', async (status, reason) => {
            await expect(createRemoteDecider({ fetch: kev(undefined, { status }) })(context(), {}))
                .rejects.toMatchObject({ reason, status });
        });

    it('treats a network failure and malformed JSON as failures, once', async () => {
        const offline = vi.fn(async () => { throw new TypeError('offline'); });
        await expect(createRemoteDecider({ fetch: offline })(context(), {})).rejects.toMatchObject({ reason: 'unavailable' });
        expect(offline).toHaveBeenCalledOnce();
        await expect(createRemoteDecider({ fetch: async () => new Response('{', { headers: { 'x-kev-revision': REVISION } }) })(context(), {}))
            .rejects.toMatchObject({ reason: 'invalid' });
    });
});

describe('trace', () => {
    it('is bounded, ordered, and summarizes decision latency', () => {
        let t = 0;
        const trace = createTrace({ now: () => t, limit: 3 });
        for (const latencyMs of [100, 300, 200]) {
            t += 10;
            trace.emit('decision.response', { outcome: 'answered', latencyMs });
        }
        trace.emit('decision.response', { outcome: 'timeout', latencyMs: 3500 });
        const events = trace.events();
        expect(events.map(event => event.seq)).toEqual([2, 3, 4]);
        expect(trace.summary()).toMatchObject({
            events: 4,
            dropped: 1,
            decisions: { outcomes: { answered: 2, timeout: 1 }, p50Ms: 200, p95Ms: 300 }
        });
        expect(Object.isFrozen(events[0])).toBe(true);
        expect(trace.emit('x', { type: 'forged', seq: 0 })).toMatchObject({ type: 'x', seq: 5 });
    });
});
