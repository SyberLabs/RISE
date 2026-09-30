/**
 * Human judgments are observations. This module appends frozen records
 * and will not revise one. Inferred scores live elsewhere.
 */

import { questionById } from './questions.js';

const WINNERS = new Set(['left', 'right', 'tie']);
const KINDS = new Set(['human', 'researcher-prior', 'synthetic']);

function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${field} must be a non-empty string`);
    }
    return value.trim().slice(0, 200);
}

export function judgment(input = {}) {
    const question = questionById(input.questionId);
    if (!question) throw new TypeError(`Unknown pairwise question: ${input.questionId}`);
    const leftId = requiredString(input.leftId, 'leftId');
    const rightId = requiredString(input.rightId, 'rightId');
    if (leftId === rightId) throw new TypeError('A judgment needs two distinct items');
    if (!WINNERS.has(input.winner)) throw new TypeError('winner must be left, right, or tie');
    const annotatorKind = input.annotatorKind ?? 'human';
    if (!KINDS.has(annotatorKind)) throw new TypeError('annotatorKind is not a known class');
    const record = {
        id: requiredString(input.id, 'id'),
        leftId,
        rightId,
        questionId: question.id,
        winner: input.winner,
        annotator: requiredString(input.annotator, 'annotator'),
        annotatorKind
    };
    if (typeof input.note === 'string' && input.note.length > 0) {
        record.note = input.note.slice(0, 500);
    }
    if (typeof input.recordedAt === 'string' && input.recordedAt.length > 0) {
        record.recordedAt = input.recordedAt.slice(0, 40);
    }
    return Object.freeze(record);
}

export function recordJudgment(store, input) {
    const next = judgment(input);
    const prior = Array.isArray(store) ? store : [];
    return Object.freeze([...prior, next]);
}

export const MIN_HUMAN_JUDGMENTS = 24;

export function canFitReadout(store) {
    const human = (store || []).filter(item => item.annotatorKind === 'human').length;
    return {
        ok: human >= MIN_HUMAN_JUDGMENTS,
        human,
        required: MIN_HUMAN_JUDGMENTS,
        reason: human >= MIN_HUMAN_JUDGMENTS
            ? 'enough human judgments to attempt a fit'
            : `need ${MIN_HUMAN_JUDGMENTS} human judgments before a readout may be fitted; have ${human}`
    };
}
