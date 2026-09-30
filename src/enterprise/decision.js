/**
 * The bounded choice, and the rules that keep the rail from flickering.
 *
 * A decider — local Kev, on-device Kev, or the rule stand-in — may return show, hold, or dismiss,
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
        if (!card) return { state: next, effect: 'hold', reason: 'unknown' };
        next.cards = next.cards.filter(item => item.id !== event.cardId);
        next.stageIds = next.stageIds.filter(id => id !== event.cardId);
        next.lastDismissedAt = event.at;
        if (card.status !== 'promoted') next.dismissedIds.push(event.cardId);
        return { state: next, effect: 'dismiss' };
    }
    if (event.type === 'retract') {
        if (!next.stageIds.includes(event.cardId)) return { state: next, effect: 'hold', reason: 'unknown' };
        next.stageIds = next.stageIds.filter(id => id !== event.cardId);
        return { state: next, effect: 'retract' };
    }
    if (event.type === 'promote') {
        const card = next.cards.find(item => item.id === event.cardId);
        if (!card) return { state: next, effect: 'hold', reason: 'unknown' };
        if (next.stageIds.includes(event.cardId)) return { state: next, effect: 'hold', reason: 'duplicate' };
        // A retracted card may go back on the stage; acceptance counts it once.
        if (card.status !== 'promoted') next.promotedIds.push(event.cardId);
        card.status = 'promoted';
        next.stageIds.push(event.cardId);
        return { state: next, effect: 'promote' };
    }
    if (event.action !== 'show') return { state: next, effect: 'hold', reason: 'not-show' };
    if (next.cards.some(card => card.id === event.cardId)) {
        return { state: next, effect: 'hold', reason: 'duplicate' };
    }
    // An asked-for card is the presenter's own request: the waiting rules that
    // keep speech from flickering the rail do not apply to it.
    const asked = event.asked === true;
    if (!asked && cooling(next, event.at, policy)) return { state: next, effect: 'hold', reason: 'cooldown' };
    // Speech is paced against speech: an asked card sets no bar for it.
    const best = next.cards.reduce((score, card) => (card.asked ? score : Math.max(score, card.score)), 0);
    const youngest = next.cards.reduce((at, card) => (card.asked ? at : Math.max(at, card.shownAt)), -Infinity);
    const dwelling = next.cards.length > 0 && event.at - youngest < policy.dwellMs;
    if (!asked && dwelling && event.score < best + policy.margin) {
        return { state: next, effect: 'hold', reason: 'dwell' };
    }
    if (next.cards.length >= policy.maxRail) {
        if (!asked && event.score < best + policy.margin) return { state: next, effect: 'hold', reason: 'margin' };
        // A card on the stage stays until the presenter takes it off; a
        // retracted card is no longer on the stage and may go.
        let lowest = -1;
        next.cards.forEach((card, index) => {
            if (next.stageIds.includes(card.id)) return;
            if (lowest < 0 || card.score < next.cards[lowest].score) lowest = index;
        });
        if (lowest < 0) return { state: next, effect: 'hold', reason: 'full' };
        next.cards.splice(lowest, 1);
    }
    next.cards.push({
        id: event.cardId,
        title: event.title,
        layout: event.layout,
        score: event.score,
        shownAt: event.at,
        status: 'shown',
        asked
    });
    // Asked cards do not start the cooldown that paces speech suggestions.
    if (!asked) next.lastShownAt = event.at;
    next.shown += 1;
    return { state: next, effect: 'show' };
}
