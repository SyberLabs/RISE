/**
 * The bounded choice, and the rules that keep the rail from flickering.
 *
 * A decider — JEV, or the rule stand-in — may return show, hold, or dismiss,
 * a candidate id, and a layout. Any other field refuses the decision. The
 * decider is not given documents. Hysteresis lives here, outside the model:
 * a cooldown, a dwell, and a margin.
 */

export const RAIL_POLICY = Object.freeze({
    showThreshold: 0.42,
    holdThreshold: 0.22,
    margin: 0.12,
    cooldownMs: 4_000,
    dwellMs: 8_000,
    maxRail: 3
});

const DECISION_KEYS = new Set(['action', 'cardId', 'layout']);

export function initialRailState() {
    return {
        cards: [],
        stageIds: [],
        lastShownAt: null,
        lastDismissedAt: null,
        shown: 0,
        promotedIds: [],
        dismissedIds: []
    };
}

function cloneState(state) {
    return {
        cards: state.cards.map(card => ({ ...card })),
        stageIds: [...(state.stageIds || [])],
        lastShownAt: state.lastShownAt,
        lastDismissedAt: state.lastDismissedAt,
        shown: state.shown,
        promotedIds: [...state.promotedIds],
        dismissedIds: [...state.dismissedIds]
    };
}

function refused() {
    return { action: 'hold', cardId: null, layout: null, refused: true };
}

export function sanitizeDecision(raw, candidates) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return refused();
    for (const key of Object.keys(raw)) {
        if (!DECISION_KEYS.has(key)) return refused();
    }
    if (raw.action !== 'show' && raw.action !== 'hold' && raw.action !== 'dismiss') return refused();
    if (raw.action !== 'show') {
        if (raw.layout != null) return refused();
        if (raw.cardId != null && !candidates.some(candidate => candidate.id === raw.cardId)) {
            return refused();
        }
        return {
            action: raw.action,
            cardId: raw.cardId ?? null,
            layout: null,
            refused: false
        };
    }
    const candidate = candidates.find(item => item.id === raw.cardId);
    if (!candidate || !candidate.layouts?.includes(raw.layout)) return refused();
    return { action: 'show', cardId: raw.cardId, layout: raw.layout, refused: false };
}

export function ruleDecider(view) {
    const top = view.candidates[0];
    if (!top || top.score < RAIL_POLICY.holdThreshold) {
        return { action: 'dismiss', cardId: null, layout: null };
    }
    if (top.score < RAIL_POLICY.showThreshold || view.rail.some(card => card.id === top.id)) {
        return { action: 'hold', cardId: top.id, layout: null };
    }
    const layout = top.layouts.includes(top.layout) ? top.layout : top.layouts[0];
    return { action: 'show', cardId: top.id, layout };
}

function cooling(state, at, policy) {
    const last = Math.max(state.lastShownAt ?? -Infinity, state.lastDismissedAt ?? -Infinity);
    return Number.isFinite(last) && at - last < policy.cooldownMs;
}

export function reduceRail(state, event, policy = RAIL_POLICY) {
    const next = cloneState(state);
    if (event.type === 'dismiss') {
        const card = next.cards.find(item => item.id === event.cardId);
        if (!card) return { state: next, effect: 'hold' };
        next.cards = next.cards.filter(item => item.id !== event.cardId);
        next.stageIds = next.stageIds.filter(id => id !== event.cardId);
        next.lastDismissedAt = event.at;
        if (card.status !== 'promoted') next.dismissedIds.push(event.cardId);
        return { state: next, effect: 'dismiss' };
    }
    if (event.type === 'retract') {
        if (!next.stageIds.includes(event.cardId)) return { state: next, effect: 'hold' };
        next.stageIds = next.stageIds.filter(id => id !== event.cardId);
        return { state: next, effect: 'retract' };
    }
    if (event.type === 'promote') {
        const card = next.cards.find(item => item.id === event.cardId);
        if (!card || card.status === 'promoted') return { state: next, effect: 'hold' };
        card.status = 'promoted';
        next.promotedIds.push(event.cardId);
        if (!next.stageIds.includes(event.cardId)) next.stageIds.push(event.cardId);
        return { state: next, effect: 'promote' };
    }
    if (event.action !== 'show' || next.cards.some(card => card.id === event.cardId)) {
        return { state: next, effect: 'hold' };
    }
    if (cooling(next, event.at, policy)) return { state: next, effect: 'hold' };
    const best = next.cards.reduce((score, card) => Math.max(score, card.score), 0);
    const youngest = next.cards.reduce((at, card) => Math.max(at, card.shownAt), -Infinity);
    const dwelling = next.cards.length > 0 && event.at - youngest < policy.dwellMs;
    if (dwelling && event.score < best + policy.margin) {
        return { state: next, effect: 'hold' };
    }
    if (next.cards.length >= policy.maxRail) {
        if (event.score < best + policy.margin) return { state: next, effect: 'hold' };
        let lowest = 0;
        next.cards.forEach((card, index) => {
            if (card.score < next.cards[lowest].score) lowest = index;
        });
        next.cards.splice(lowest, 1);
    }
    next.cards.push({
        id: event.cardId,
        title: event.title,
        layout: event.layout,
        score: event.score,
        shownAt: event.at,
        status: 'shown'
    });
    next.lastShownAt = event.at;
    next.shown += 1;
    return { state: next, effect: 'show' };
}
