/**
 * One presenter, one prepared program, one speaker rail.
 *
 * Draft transcripts take the lexical tier. A finalized sentence embeds the
 * rolling window and takes the semantic tier. The decider sees the window
 * plus candidate ids, titles, scores, and layouts — not the documents and
 * not the numbers. Promote is the speaker's tap. Dismiss is the speaker's
 * other tap. Neither publishes a stage; that surface is a later step.
 *
 * An audience utterance that finalizes without a card is a gap. The debrief
 * is the follow-up pack.
 */

import { renderChart } from './chart.js';
import { reduceRail, ruleDecider, sanitizeDecision, initialRailState } from './decision.js';
import { admitToStage, auditRendered, validateProgram } from './gate.js';
import { indexProgram, matchLexical, matchSemantic } from './match.js';

function presentParts(record, layout, corpus) {
    const parts = [record.title];
    if (record.kind === 'passage') parts.push(record.body);
    if (record.kind === 'chart') {
        const drawn = renderChart({ ...record, layout }, corpus);
        for (const row of drawn.rows) parts.push(row.label, ...row.values);
    }
    return parts;
}

export function openSession({ program, corpus, decider = ruleDecider, policy, now }) {
    validateProgram(program, corpus);
    const index = indexProgram(program, corpus);
    let state = initialRailState();
    const finals = [];
    const gaps = [];
    const samples = [];
    const stageLog = [];
    const retrieved = new Map();
    const numbers = { traced: 0, untraced: 0 };
    let latestAt = 0;

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
            latencyMs: sample?.latencyMs ?? null
        };
    }

    function hear(event) {
        if (event.speaker === 'presenter' && event.speakerId !== program.presenterId) {
            return { action: 'ignore', cardId: null, tier: null, latencyMs: null };
        }
        const tier = event.final ? 'semantic' : 'lexical';
        let windowText = event.text;
        if (event.final) {
            finals.push(event.text);
            while (finals.length > 3) finals.shift();
            windowText = finals.join(' ');
        }
        const ranked = tier === 'semantic'
            ? matchSemantic(index, windowText, { lexicalText: event.text })
            : matchLexical(index, event.text);
        const candidates = viewCandidates(ranked);
        const view = {
            window: windowText,
            speaker: event.speaker,
            mode: event.speaker === 'audience' ? 'qa' : 'prepared',
            candidates,
            rail: state.cards.map(card => ({ id: card.id, title: card.title }))
        };
        let raw = { action: 'hold', cardId: null, layout: null };
        try {
            raw = decider(view) ?? raw;
        } catch {
            raw = { action: 'hold', cardId: null, layout: null };
        }
        const decision = sanitizeDecision(raw, candidates);
        const chosen = candidates.find(item => item.id === decision.cardId);
        if (!decision.refused && decision.action === 'show' && chosen) {
            const record = program.cards.find(item => item.id === decision.cardId);
            const parts = presentParts(record, decision.layout, corpus);
            const audit = auditRendered(parts, record, corpus);
            if (audit.untraced > 0 || !record) {
                numbers.untraced += audit.untraced;
                if (event.final) gaps.push({ text: event.text, speaker: event.speaker, at: event.at });
                return { action: 'hold', cardId: null, tier, latencyMs: null };
            }
            const reduced = reduceRail(state, {
                type: 'verdict',
                action: 'show',
                cardId: decision.cardId,
                layout: decision.layout,
                score: chosen.score,
                title: chosen.title,
                at: event.at
            }, policy);
            if (reduced.effect !== 'show') {
                state = reduced.state;
                if (event.final) gaps.push({ text: event.text, speaker: event.speaker, at: event.at });
                return { action: 'hold', cardId: decision.cardId, tier, latencyMs: null };
            }
            numbers.traced += audit.traced;
            const shownAt = stamp(event.at);
            const latencyMs = shownAt - event.at;
            samples.push({ cardId: decision.cardId, latencyMs, at: shownAt });
            state = reduced.state;
            return { action: 'show', cardId: decision.cardId, tier, latencyMs };
        }
        const reduced = reduceRail(state, {
            type: 'verdict',
            action: decision.refused ? 'hold' : decision.action,
            cardId: decision.cardId,
            layout: decision.layout,
            score: chosen?.score ?? 0,
            title: chosen?.title ?? '',
            at: event.at
        }, policy);
        state = reduced.state;
        if (event.final) gaps.push({ text: event.text, speaker: event.speaker, at: event.at });
        const action = decision.refused ? 'hold' : decision.action;
        return { action, cardId: null, tier, latencyMs: null };
    }

    return {
        hear,
        promote(cardId) {
            const record = recordOf(cardId);
            if (!record || !state.cards.some(card => card.id === cardId)
                || !admitToStage(record, corpus, program.audienceId)) {
                return { action: 'refused' };
            }
            const at = stamp();
            const reduced = reduceRail(state, { type: 'promote', cardId, at }, policy);
            state = reduced.state;
            if (reduced.effect !== 'promote') return { action: 'refused' };
            stageLog.push({ cardId, at });
            return { action: 'promote' };
        },
        retract(cardId) {
            const reduced = reduceRail(state, { type: 'retract', cardId, at: stamp() }, policy);
            state = reduced.state;
            return { action: reduced.effect === 'retract' ? 'retract' : 'refused' };
        },
        dismiss(cardId) {
            const reduced = reduceRail(state, { type: 'dismiss', cardId, at: stamp() }, policy);
            state = reduced.state;
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
