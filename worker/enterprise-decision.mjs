import { ruleDecider, sanitizeDecision } from '../src/enterprise/decision.js';

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
};

const VIEW_KEYS = new Set(['window', 'speaker', 'mode', 'candidates', 'rail']);
const CANDIDATE_KEYS = new Set(['id', 'title', 'score', 'layouts', 'layout']);
const RAIL_KEYS = new Set(['id', 'title']);
const MAX_BYTES = 4096;

function reply(status, body) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function sameOrigin(request) {
    const header = request.headers.get('origin');
    if (!header) return false;
    try {
        const supplied = new URL(header);
        return supplied.origin === header && supplied.origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

function keysFit(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).every(key => allowed.has(key));
}

function viewFits(view) {
    if (!keysFit(view, VIEW_KEYS)) return false;
    if (!Array.isArray(view.candidates) || !Array.isArray(view.rail)) return false;
    for (const candidate of view.candidates) {
        if (!keysFit(candidate, CANDIDATE_KEYS) || !Array.isArray(candidate.layouts)) return false;
        if (candidate.layouts.some(layout => layout && typeof layout === 'object')) return false;
    }
    return view.rail.every(card => keysFit(card, RAIL_KEYS));
}

export async function handleEnterpriseDecision(request) {
    if (request.method !== 'POST') {
        return reply(405, { error: { code: 'METHOD', message: 'Expected POST' } });
    }
    if (!sameOrigin(request)) {
        return reply(403, { error: { code: 'ORIGIN', message: 'Expected the same origin' } });
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) {
        return reply(413, { error: { code: 'BODY', message: 'Decision view exceeds 4096 bytes' } });
    }
    let view;
    try {
        view = JSON.parse(text);
    } catch {
        return reply(400, { error: { code: 'INVALID_JSON', message: 'Expected JSON' } });
    }
    if (!viewFits(view)) {
        return reply(400, { error: { code: 'DECISION_SHAPE', message: 'Decision view has an unknown field' } });
    }
    const decision = sanitizeDecision(ruleDecider(view), view.candidates);
    return reply(200, {
        action: decision.action,
        cardId: decision.cardId,
        layout: decision.layout
    });
}
