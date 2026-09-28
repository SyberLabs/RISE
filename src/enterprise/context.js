/**
 * The context a decider is allowed to see, and the only shape that leaves the
 * browser for the decision route.
 *
 * Evidence is what was heard. Structure is the legal options. Authority is
 * what the decider may do with them. Promotion is never in that list: the
 * right to publish stays with a presenter. The room's own authority — tenant,
 * residency, audience, presenters — stays in the session and is not
 * serialized.
 */

import { fail } from './errors.js';

export const CONTEXT_SCHEMA = 'rise.enterprise-context.v1';
export const DECISION_SCHEMA = 'rise.enterprise-decision.v1';

export const CONTEXT_LIMITS = Object.freeze({
    window: 600,
    id: 160,
    title: 160,
    candidates: 5,
    rail: 3
});

const LAYOUTS = new Set(['quote', 'bar', 'line', 'table']);
const SPEAKERS = new Set(['presenter', 'audience']);
const MODES = new Set(['prepared', 'qa']);
const ACTIONS = ['show', 'hold', 'dismiss'];
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,64}$/u;

const TOP_KEYS = new Set(['schema', 'requestId', 'evidence', 'structure', 'authority']);
const EVIDENCE_KEYS = new Set(['window', 'speaker', 'mode']);
const STRUCTURE_KEYS = new Set(['candidates', 'rail']);
const AUTHORITY_KEYS = new Set(['actions']);
const CANDIDATE_KEYS = new Set(['id', 'title', 'score', 'layouts', 'layout']);
const RAIL_KEYS = new Set(['id', 'title']);

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function shaped(value, allowed, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('CONTEXT_SHAPE', `Expected an object at ${path}`);
    }
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) fail('CONTEXT_FIELD', `Unknown field ${key} at ${path}`);
    }
    return value;
}

function text(value, max, path) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        fail('CONTEXT_TEXT', `Expected text of at most ${max} characters at ${path}`);
    }
    return value;
}

export function allowedActions(candidateCount) {
    return candidateCount > 0 ? [...ACTIONS] : ['hold', 'dismiss'];
}

function trimWindow(value) {
    const flat = String(value ?? '').replace(/\s+/gu, ' ').trim();
    if (flat.length <= CONTEXT_LIMITS.window) return flat;
    // The newest words carry the decision; keep the tail on a word boundary.
    const tail = flat.slice(-CONTEXT_LIMITS.window);
    const cut = tail.indexOf(' ');
    return cut > 0 ? tail.slice(cut + 1) : tail;
}

function clip(value, max) {
    return String(value ?? '').slice(0, max);
}

/**
 * Build the wire context from the session's decider view. Fields the view does
 * not have are not invented; fields it has beyond the protocol are dropped.
 */
export function buildContext(view, requestId) {
    const candidates = (view.candidates || [])
        .filter(item => typeof item.id === 'string' && item.id.length <= CONTEXT_LIMITS.id)
        .slice(0, CONTEXT_LIMITS.candidates)
        .map(item => ({
        id: item.id,
        title: clip(item.title, CONTEXT_LIMITS.title),
        score: Math.round(Math.min(1, Math.max(0, Number(item.score) || 0)) * 1000) / 1000,
        layouts: [...item.layouts],
        layout: item.layout ?? item.layouts[0]
        }));
    const context = {
        schema: CONTEXT_SCHEMA,
        requestId,
        evidence: {
            window: trimWindow(view.window) || '…',
            speaker: view.speaker,
            mode: view.mode
        },
        structure: {
            candidates,
            rail: (view.rail || []).slice(-CONTEXT_LIMITS.rail).map(card => ({
                id: card.id,
                title: clip(card.title, CONTEXT_LIMITS.title)
            }))
        },
        authority: { actions: allowedActions(candidates.length) }
    };
    return deepFreeze(validateContext(context));
}

/** Refuse anything the protocol does not name. Returns the same object. */
export function validateContext(value) {
    shaped(value, TOP_KEYS, 'context');
    if (value.schema !== CONTEXT_SCHEMA) fail('CONTEXT_SCHEMA', 'Expected an enterprise context');
    if (typeof value.requestId !== 'string' || !REQUEST_ID.test(value.requestId)) {
        fail('CONTEXT_REQUEST', 'Expected a request id');
    }

    const evidence = shaped(value.evidence, EVIDENCE_KEYS, 'context.evidence');
    text(evidence.window, CONTEXT_LIMITS.window, 'context.evidence.window');
    if (!SPEAKERS.has(evidence.speaker)) fail('CONTEXT_SPEAKER', 'Expected presenter or audience');
    if (!MODES.has(evidence.mode)) fail('CONTEXT_MODE', 'Expected prepared or qa');

    const structure = shaped(value.structure, STRUCTURE_KEYS, 'context.structure');
    if (!Array.isArray(structure.candidates) || structure.candidates.length > CONTEXT_LIMITS.candidates) {
        fail('CONTEXT_CANDIDATES', `Expected at most ${CONTEXT_LIMITS.candidates} candidates`);
    }
    const ids = new Set();
    structure.candidates.forEach((candidate, index) => {
        const path = `context.structure.candidates[${index}]`;
        shaped(candidate, CANDIDATE_KEYS, path);
        text(candidate.id, CONTEXT_LIMITS.id, `${path}.id`);
        text(candidate.title, CONTEXT_LIMITS.title, `${path}.title`);
        if (ids.has(candidate.id)) fail('CONTEXT_CANDIDATES', `Duplicate candidate ${candidate.id}`);
        ids.add(candidate.id);
        if (typeof candidate.score !== 'number' || !(candidate.score >= 0 && candidate.score <= 1)) {
            fail('CONTEXT_SCORE', `Expected a score from 0 to 1 at ${path}.score`);
        }
        if (!Array.isArray(candidate.layouts) || !candidate.layouts.length
            || candidate.layouts.length > LAYOUTS.size
            || candidate.layouts.some(layout => !LAYOUTS.has(layout))
            || new Set(candidate.layouts).size !== candidate.layouts.length
            || !candidate.layouts.includes(candidate.layout)) {
            fail('CONTEXT_LAYOUT', `Expected known layouts at ${path}`);
        }
    });
    if (!Array.isArray(structure.rail) || structure.rail.length > CONTEXT_LIMITS.rail) {
        fail('CONTEXT_RAIL', `Expected at most ${CONTEXT_LIMITS.rail} rail entries`);
    }
    structure.rail.forEach((card, index) => {
        const path = `context.structure.rail[${index}]`;
        shaped(card, RAIL_KEYS, path);
        text(card.id, CONTEXT_LIMITS.id, `${path}.id`);
        text(card.title, CONTEXT_LIMITS.title, `${path}.title`);
    });

    const authority = shaped(value.authority, AUTHORITY_KEYS, 'context.authority');
    const expected = allowedActions(structure.candidates.length);
    if (!Array.isArray(authority.actions) || authority.actions.length !== expected.length
        || authority.actions.some((action, index) => action !== expected[index])) {
        fail('CONTEXT_AUTHORITY', 'Authority must list exactly the actions this turn allows');
    }
    return value;
}

/** The decider view the rule decider and `sanitizeDecision` read. */
export function viewOf(context) {
    return {
        window: context.evidence.window,
        speaker: context.evidence.speaker,
        mode: context.evidence.mode,
        candidates: context.structure.candidates,
        rail: context.structure.rail
    };
}
