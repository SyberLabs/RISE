/**
 * One prepared program, one speaker rail, one stage.
 *
 * A turn is prepared, decided, and resolved. `prepare` is synchronous: it
 * checks presenter authority, keeps the rolling window, matches, and — for an
 * audience final the program missed — retrieves permitted sentences. It
 * returns the context a decider may see. The decision may be local and
 * immediate or remote and slow. `resolve` accepts a decision only for a turn
 * this session issued, once, while no later turn on the same channel has
 * been prepared; any other answer is a hold. Speech and the presenter's asks
 * are separate channels: neither makes the other stale. A decider never
 * touches the rail directly.
 *
 * Draft transcripts take the lexical tier. A finalized sentence embeds the
 * rolling window and takes the semantic tier. When the room's sentence
 * vectors are attached and a final or ask arrives with its own `vector`,
 * matching and retrieval rank by that vector instead; `prepare` stays
 * synchronous because the caller embeds before it. `warm` runs the lexical tier on
 * an interim transcript without deciding anything. Promote is a presenter's
 * tap, and it re-runs the gate for the room's audience before the stage
 * changes.
 *
 * A finalized audience utterance that the decider declines is a gap. A
 * failed, cancelled, or superseded decision is not. The debrief is the
 * follow-up pack.
 */

import { renderChart } from './chart.js';
import { buildContext, viewOf } from './context.js';
import { RAIL_POLICY, reduceRail, ruleDecider, sanitizeDecision, initialRailState } from './decision.js';
import { admitToStage, auditRendered, validateProgram } from './gate.js';
import { attachDense as attachCardVectors, indexProgram, matchLexical, matchSemantic } from './match.js';
import { attachDense as attachEntryVectors, indexCorpus, retrieve, retrieveDense } from './retrieve.js';

export const WINDOW_FINALS = 3;
const RETRIEVAL_SCORE = 0.8;

function presentParts(record, layout, corpus) {
    const parts = [record.title];
    if (record.kind === 'passage') parts.push(record.body);
    if (record.kind === 'chart') {
        const drawn = renderChart({ ...record, layout }, corpus);
        for (const row of drawn.rows) parts.push(row.label, ...row.values);
    }
    return parts;
}

function sessionNonce() {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function held(turn, reason, cardId = null) {
    return {
        action: 'hold',
        cardId,
        tier: turn?.tier ?? null,
        latencyMs: null,
        requestId: turn?.requestId ?? null,
        reason
    };
}

export function openSession({ program, corpus, decider = ruleDecider, policy, now, onEvent, sessionId }) {
    validateProgram(program, corpus);
    const index = indexProgram(program, corpus);
    const permitted = indexCorpus(corpus, program.audienceId);
    const nonce = sessionId ?? sessionNonce();
    let state = initialRailState();
    const finals = [];
    const gaps = [];
    const samples = [];
    const stageLog = [];
    const retrieved = new Map();
    const numbers = { traced: 0, untraced: 0 };
    const issued = new WeakMap();
    const dismissedAt = new Map();
    let latestAt = 0;
    let seq = 0;
    const latestByChannel = { speech: 0, ask: 0 };

    function emit(type, fields) {
        if (typeof onEvent !== 'function') return;
        try {
            onEvent(type, fields);
        } catch {
            // Observability must not change what the room does.
        }
    }

    function recordOf(cardId) {
        return program.cards.find(item => item.id === cardId) || retrieved.get(cardId) || null;
    }

    function stamp(at) {
        const basis = Number.isFinite(at) ? at : latestAt;
        if (Number.isFinite(basis)) latestAt = basis;
        if (typeof now !== 'function') return basis;
        const value = now(basis);
        return Number.isFinite(value) ? value : basis;
    }

    function viewCandidates(ranked) {
        return ranked.slice(0, 5).map(hit => ({
            id: hit.id,
            title: hit.title,
            score: hit.score,
            layouts: [...hit.layouts],
            layout: hit.layout
        }));
    }

    function materialize(cardState) {
        const record = recordOf(cardState.id);
        if (!record) return null;
        const chart = record.kind === 'chart'
            ? renderChart({ ...record, layout: cardState.layout }, corpus)
            : null;
        const sample = samples.find(item => item.cardId === cardState.id);
        return {
            id: record.id,
            title: record.title,
            status: cardState.status,
            layout: cardState.layout,
            kind: record.kind,
            body: record.kind === 'passage' ? record.body : null,
            chart,
            provenance: record.provenance,
            latencyMs: sample?.latencyMs ?? null,
            decidedBy: sample?.decidedBy ?? null,
            asked: cardState.asked === true
        };
    }

    let dense = false;

    /** Retrieved cards and their scores: calibrated cosine with a vector, a fixed score without. */
    function retrieveFor(text, vector) {
        if (dense && vector) return retrieveDense(permitted, text, vector, { floor: RAIL_POLICY.holdThreshold });
        return retrieve(permitted, text).map(card => ({ card, score: RETRIEVAL_SCORE }));
    }

    /** Whether a prepared card already shows this retrieved card's source. */
    function preparedCovers(card) {
        return program.cards.some(prepared => (card.kind === 'chart'
            ? prepared.kind === 'chart' && prepared.chart.tableId === card.chart.tableId
            : prepared.kind === 'passage' && prepared.body === card.body
                && prepared.provenance[0].documentId === card.provenance[0].documentId));
    }

    function retrievedRanking(hits, tier) {
        for (const { card } of hits) retrieved.set(card.id, card);
        return hits.map(({ card, score }) => ({
            id: card.id,
            title: card.title,
            score,
            tier,
            layouts: card.layouts,
            layout: card.layout
        }));
    }

    function issue(ranked, { windowText, speaker, mode, tier, at, text, recordGap, decisive, channel }) {
        seq += 1;
        if (decisive) latestByChannel[channel] = seq;
        const requestId = `${nonce}:${seq}`;
        const context = buildContext({
            window: windowText,
            speaker,
            mode,
            candidates: viewCandidates(ranked),
            rail: state.cards.map(card => ({ id: card.id, title: card.title }))
        }, requestId);
        const turn = Object.freeze({
            seq,
            requestId,
            tier,
            at,
            final: decisive,
            speaker,
            channel,
            context
        });
        issued.set(turn, { text, recordGap, resolved: false });
        const top = context.structure.candidates[0];
        emit('candidates', {
            requestId,
            tier,
            speaker,
            count: context.structure.candidates.length,
            topId: top?.id ?? null,
            topScore: top?.score ?? null
        });
        return turn;
    }

    /** Presenter authority, window, match, and fallback retrieval. No decision. */
    function prepare(event) {
        if (event.speaker === 'presenter' && !program.presenterIds.includes(event.speakerId)) {
            return null;
        }
        const tier = event.final ? 'semantic' : 'lexical';
        let windowText = event.text;
        if (event.final) {
            finals.push(event.text);
            while (finals.length > WINDOW_FINALS) finals.shift();
            windowText = finals.join(' ');
        }
        const vector = dense && event.final ? event.vector ?? null : null;
        let ranked = tier === 'semantic'
            ? matchSemantic(index, windowText, { lexicalText: event.text, vector })
            : matchLexical(index, event.text);
        if (vector) {
            // With vectors, every permitted sentence and table competes with
            // the prepared cards; a prepared card keeps its slide's title.
            const hits = retrieveFor(event.text, vector).filter(hit => !preparedCovers(hit.card));
            emit('retrieve', { tier, hits: hits.length, ids: hits.map(hit => hit.card.id) });
            ranked = [...ranked, ...retrievedRanking(hits, 'semantic')]
                .sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        } else if (event.speaker === 'audience' && event.final && (ranked[0]?.score ?? 0) < RAIL_POLICY.holdThreshold) {
            const hits = retrieveFor(event.text, vector);
            emit('retrieve', { tier, hits: hits.length, ids: hits.map(hit => hit.card.id) });
            if (hits.length) ranked = [...retrievedRanking(hits, 'semantic'), ...ranked];
        }
        return issue(ranked, {
            windowText,
            speaker: event.speaker,
            mode: event.speaker === 'audience' ? 'qa' : 'prepared',
            tier,
            at: event.at,
            text: event.text,
            recordGap: event.final === true && event.speaker === 'audience',
            decisive: event.final === true,
            channel: 'speech'
        });
    }

    /** An explicit request: retrieve even when the program already matches. */
    function prepareReasoning({ text, at, vector = null }) {
        const hits = retrieveFor(text, vector);
        emit('retrieve', { tier: 'reasoning', hits: hits.length, ids: hits.map(hit => hit.card.id) });
        return issue(retrievedRanking(hits, 'reasoning'), {
            windowText: text,
            speaker: 'presenter',
            mode: 'prepared',
            tier: 'reasoning',
            at,
            text,
            recordGap: false,
            decisive: true,
            channel: 'ask'
        });
    }

    /**
     * Apply a decision to the rail. `meta.reason` names a decider failure and
     * forces a hold; `meta.provider` is recorded with a shown card.
     */
    function resolve(turn, raw, meta = {}) {
        const record = turn ? issued.get(turn) : null;
        if (!record) return held(turn, 'unknown-turn');
        if (record.resolved) return held(turn, 'resolved');
        record.resolved = true;

        const { at, tier, requestId } = turn;
        const candidates = turn.context.structure.candidates;
        const noteGap = () => {
            if (record.recordGap) gaps.push({ text: record.text, speaker: turn.speaker, at });
        };
        const hold = (reason, cardId = null) => {
            emit('rail.hold', { requestId, tier, reason, cardId });
            return held(turn, reason, cardId);
        };

        if (meta.reason) return hold(meta.reason);
        if (turn.seq < latestByChannel[turn.channel]) return hold('stale');

        const decision = sanitizeDecision(raw, candidates);
        if (decision.refused) return hold('invalid');
        if (decision.action !== 'show') {
            noteGap();
            emit('rail.hold', { requestId, tier, reason: 'decider', cardId: decision.cardId });
            return { ...held(turn, 'decider'), action: decision.action };
        }

        if ((dismissedAt.get(decision.cardId) ?? -1) >= turn.seq) {
            return hold('dismissed', decision.cardId);
        }
        const chosen = candidates.find(item => item.id === decision.cardId);
        const card = recordOf(decision.cardId);
        const parts = card ? presentParts(card, decision.layout, corpus) : [];
        const audit = card ? auditRendered(parts, card, corpus) : { traced: 0, untraced: 1 };
        if (!card || audit.untraced > 0) {
            numbers.untraced += audit.untraced;
            return hold('untraced', decision.cardId);
        }
        const reduced = reduceRail(state, {
            type: 'verdict',
            action: 'show',
            cardId: decision.cardId,
            layout: decision.layout,
            score: chosen.score,
            title: card.title,
            at,
            asked: turn.channel === 'ask'
        }, policy);
        state = reduced.state;
        if (reduced.effect !== 'show') return hold(reduced.reason, decision.cardId);

        numbers.traced += audit.traced;
        const shownAt = stamp(at);
        const latencyMs = shownAt - at;
        const decidedBy = typeof meta.provider === 'string' ? meta.provider : null;
        samples.push({ cardId: decision.cardId, latencyMs, at: shownAt, decidedBy });
        emit('rail.show', {
            requestId,
            tier,
            cardId: decision.cardId,
            layout: decision.layout,
            score: chosen.score,
            latencyMs,
            decidedBy
        });
        return {
            action: 'show',
            cardId: decision.cardId,
            tier,
            latencyMs,
            requestId,
            reason: null
        };
    }

    function decideLocally(turn) {
        let raw;
        try {
            raw = decider(viewOf(turn.context));
        } catch {
            return resolve(turn, null, { reason: 'error' });
        }
        return resolve(turn, raw ?? { action: 'hold', cardId: null, layout: null }, { provider: 'local' });
    }

    function hear(event) {
        const turn = prepare(event);
        if (!turn) return { action: 'ignore', cardId: null, tier: null, latencyMs: null, requestId: null, reason: 'presenter' };
        return decideLocally(turn);
    }

    /** Lexical leaders for an interim transcript. The rail does not move. */
    function warm(event) {
        if (event.speaker === 'presenter' && !program.presenterIds.includes(event.speakerId)) {
            return { tier: 'lexical', leaders: [] };
        }
        const leaders = matchLexical(index, event.text, { limit: 3 })
            .filter(hit => hit.score > 0)
            .map(hit => ({ id: hit.id, title: hit.title, score: hit.score }));
        emit('warm', {
            chars: String(event.text ?? '').length,
            topId: leaders[0]?.id ?? null,
            topScore: leaders[0]?.score ?? null
        });
        return { tier: 'lexical', leaders };
    }

    return {
        id: nonce,
        prepare,
        prepareReasoning,
        /** The texts to embed once: prepared cards and permitted corpus entries, by id. */
        embeddingTexts() {
            return {
                cards: index.cards.map(card => ({ id: card.id, text: card.text })),
                entries: permitted.entries.map(entry => ({ id: entry.id, text: entry.text }))
            };
        },
        /** Attach every vector at once; from then on a line's own vector is used. */
        attachVectors({ cards, entries, scale }) {
            attachCardVectors(index, cards, scale);
            attachEntryVectors(permitted, entries, scale);
            dense = index.cards.every(card => card.dense) && permitted.entries.every(entry => entry.dense);
            emit('vectors', { cards: index.cards.length, entries: permitted.entries.length, attached: dense });
            return dense;
        },
        resolve,
        warm,
        hear,
        requestReasoning(request) {
            return decideLocally(prepareReasoning(request));
        },
        promote(cardId, { by = program.presenterId } = {}) {
            const card = recordOf(cardId);
            let reason = null;
            if (!program.presenterIds.includes(by)) reason = 'presenter';
            else if (!card || !state.cards.some(item => item.id === cardId)) reason = 'unknown';
            else if (!admitToStage(card, corpus, program.audienceId)) reason = 'gate';
            emit('promote.gate', { cardId, by, admitted: reason === null, reason });
            if (reason) return { action: 'refused' };
            const at = stamp();
            const reduced = reduceRail(state, { type: 'promote', cardId, at }, policy);
            state = reduced.state;
            if (reduced.effect !== 'promote') return { action: 'refused' };
            stageLog.push({ cardId, at });
            emit('stage.publish', { cardId, by, at });
            return { action: 'promote' };
        },
        retract(cardId) {
            const reduced = reduceRail(state, { type: 'retract', cardId, at: stamp() }, policy);
            state = reduced.state;
            if (reduced.effect !== 'retract') return { action: 'refused' };
            emit('stage.retract', { cardId });
            return { action: 'retract' };
        },
        dismiss(cardId) {
            const reduced = reduceRail(state, { type: 'dismiss', cardId, at: stamp() }, policy);
            state = reduced.state;
            if (reduced.effect === 'dismiss') {
                dismissedAt.set(cardId, seq);
                emit('rail.dismiss', { cardId });
            }
        },
        rail() {
            return state.cards.map(materialize).filter(Boolean);
        },
        stage() {
            return state.stageIds.map(id => {
                const card = state.cards.find(item => item.id === id);
                return card ? materialize(card) : null;
            }).filter(Boolean);
        },
        hints() {
            return program.entities.map(entity => entity.name);
        },
        metrics() {
            const shown = state.shown;
            const promoted = state.promotedIds.length;
            const speakerDismissed = state.dismissedIds.length;
            return {
                samples: samples.map(sample => ({ ...sample })),
                shown,
                promoted,
                speakerDismissed,
                acceptanceRate: shown ? promoted / shown : null,
                dismissRate: shown ? speakerDismissed / shown : null,
                numbers: { traced: numbers.traced, untraced: numbers.untraced },
                provenanceComplete: numbers.untraced === 0
            };
        },
        debrief() {
            const gapList = gaps.map(gap => ({ ...gap }));
            return {
                shown: samples.map(sample => ({ ...sample })),
                promoted: state.promotedIds.map(cardId => ({ cardId })),
                stage: stageLog.map(entry => ({ ...entry })),
                dismissed: state.dismissedIds.map(cardId => ({ cardId })),
                gaps: gapList,
                followUp: gapList.map(gap => ({ ...gap }))
            };
        }
    };
}
