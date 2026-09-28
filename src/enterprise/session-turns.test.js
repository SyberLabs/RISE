import { describe, expect, it, vi } from 'vitest';
import { ingestCorpus } from './corpus.js';
import { demoCorpusInput, demoDeck } from './demo.js';
import { prepareTalk } from './prepare.js';
import { openSession } from './session.js';

function room(options = {}) {
    const corpus = ingestCorpus(demoCorpusInput());
    const program = prepareTalk({ deck: demoDeck(), corpus, audienceId: 'all-hands', presenterId: 'ada' });
    const events = [];
    const session = openSession({
        program,
        corpus,
        now: (at) => at + 250,
        sessionId: 'room1',
        onEvent: (type, fields) => events.push({ type, ...fields }),
        ...options
    });
    return { corpus, program, session, events };
}

const atlas = (at = 1000) => ({ text: 'Atlas renewal price', final: true, speaker: 'presenter', speakerId: 'ada', at });
const revenue = (at = 20_000) => ({ text: 'pipeline revenue by quarter', final: true, speaker: 'presenter', speakerId: 'ada', at });
const showTop = (turn) => {
    const top = turn.context.structure.candidates[0];
    return { action: 'show', cardId: top.id, layout: top.layout };
};

describe('prepare, decide, resolve', () => {
    it('prepares a context without document text and resolves a show', () => {
        const { session, events } = room();
        const turn = session.prepare(atlas());
        expect(turn.requestId).toBe('room1:1');
        expect(Object.isFrozen(turn)).toBe(true);
        const wire = JSON.stringify(turn.context);
        expect(wire).not.toContain('12.4');
        expect(wire).not.toContain('880');
        expect(wire).not.toContain('Northwind renewal price');
        expect(session.rail()).toEqual([]);

        const result = session.resolve(turn, showTop(turn), { provider: 'Kev' });
        expect(result).toMatchObject({ action: 'show', requestId: 'room1:1', latencyMs: 250, reason: null });
        expect(session.rail()[0]).toMatchObject({ decidedBy: 'Kev', status: 'shown' });
        expect(session.stage()).toEqual([]);
        expect(events.map(event => event.type)).toEqual(['candidates', 'rail.show']);
    });

    it('holds a response that arrives after a newer final', () => {
        const { session } = room();
        const first = session.prepare(atlas());
        const second = session.prepare(revenue());
        expect(session.resolve(first, showTop(first))).toMatchObject({ action: 'hold', reason: 'stale' });
        expect(session.rail()).toEqual([]);
        expect(session.resolve(second, showTop(second)).action).toBe('show');
        expect(session.rail()).toHaveLength(1);
    });

    it('resolves a turn once and refuses a turn it did not issue', () => {
        const { session } = room();
        const turn = session.prepare(atlas());
        const forged = { ...turn };
        expect(session.resolve(forged, showTop(turn))).toMatchObject({ action: 'hold', reason: 'unknown-turn' });
        expect(session.resolve(turn, showTop(turn)).action).toBe('show');
        expect(session.resolve(turn, showTop(turn))).toMatchObject({ action: 'hold', reason: 'resolved' });
        const other = room().session;
        expect(other.resolve(turn, showTop(turn)).reason).toBe('unknown-turn');
        expect(other.rail()).toEqual([]);
    });

    it.each(['timeout', 'cancelled', 'error', 'unavailable'])('holds when the decider reports %s', (reason) => {
        const { session } = room();
        const turn = session.prepare({ ...atlas(), speaker: 'audience', speakerId: 'guest' });
        const result = session.resolve(turn, showTop(turn), { reason });
        expect(result).toMatchObject({ action: 'hold', reason });
        expect(session.rail()).toEqual([]);
        expect(session.debrief().gaps).toHaveLength(1);
    });

    it.each([
        ['an extra field', (turn) => ({ ...showTop(turn), text: 'The acquisition price is 880 million' })],
        ['a board memo id', () => ({ action: 'show', cardId: 'card:retrieval:board-memo:1:0', layout: 'quote' })],
        ['a card that was not offered', () => ({ action: 'show', cardId: 'card:acquisition:passage:board-memo:1', layout: 'quote' })],
        ['a layout that was not offered', (turn) => ({ ...showTop(turn), layout: 'table' })],
        ['a publish verb', (turn) => ({ ...showTop(turn), action: 'promote' })],
        ['prose', () => 'Show the 880 million figure'],
        ['an array', (turn) => [showTop(turn)]],
        ['null', () => null]
    ])('holds %s and leaves the rail and stage unchanged', (_, raw) => {
        const { session } = room();
        const turn = session.prepare(atlas());
        expect(session.resolve(turn, raw(turn))).toMatchObject({ action: 'hold', reason: 'invalid' });
        expect(session.rail()).toEqual([]);
        expect(session.stage()).toEqual([]);
        expect(JSON.stringify(session.debrief())).not.toContain('880');
    });

    it('does not show a card the speaker dismissed while the decision was in flight', () => {
        const { session } = room();
        const first = session.prepare(atlas());
        session.resolve(first, showTop(first));
        const cardId = session.rail()[0].id;
        const second = session.prepare(atlas(30_000));
        session.dismiss(cardId);
        expect(session.resolve(second, showTop(second))).toMatchObject({ action: 'hold', reason: 'dismissed', cardId });
        expect(session.rail()).toEqual([]);
        const third = session.prepare(atlas(60_000));
        expect(session.resolve(third, showTop(third)).action).toBe('show');
    });

    it('warms lexical leaders without moving the rail', () => {
        const { session, events } = room();
        const warmed = session.warm({ text: 'Atla', final: false, speaker: 'presenter', speakerId: 'ada', at: 5 });
        expect(warmed.leaders[0].title).toBe('Atlas renewal');
        expect(session.rail()).toEqual([]);
        expect(events.at(-1)).toMatchObject({ type: 'warm', chars: 4 });
        expect(JSON.stringify(events)).not.toContain('Atla"');
        expect(session.warm({ text: 'Atlas', speaker: 'presenter', speakerId: 'mallory' }).leaders).toEqual([]);
    });

    it('lets only a listed presenter promote, and records the gate', () => {
        const { session, events } = room();
        session.hear(atlas());
        const cardId = session.rail()[0].id;
        expect(session.promote(cardId, { by: 'guest' })).toEqual({ action: 'refused' });
        expect(session.stage()).toEqual([]);
        expect(session.promote(cardId)).toEqual({ action: 'promote' });
        expect(session.stage().map(card => card.id)).toEqual([cardId]);
        expect(events.filter(event => event.type === 'promote.gate').map(event => event.reason))
            .toEqual(['presenter', null]);
        expect(events.at(-1)).toMatchObject({ type: 'stage.publish', cardId, by: 'ada' });
    });

    it('keeps working when the event sink throws', () => {
        const { session } = room({ onEvent: vi.fn(() => { throw new Error('sink down'); }) });
        expect(session.hear(atlas()).action).toBe('show');
    });

    it('holds with the rail reason when hysteresis refuses a show', () => {
        const { session } = room();
        session.hear(atlas());
        const turn = session.prepare(revenue(1500));
        expect(session.resolve(turn, showTop(turn))).toMatchObject({ action: 'hold', reason: 'cooldown' });
    });
});
