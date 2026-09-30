/**
 * Contextual window features.
 *
 * Negation applies to the next lexicon word inside a three-token span,
 * and an intensifier applies only to the next lexicon word. That is a
 * window, not a parse. "But" is counted as contrast even when the prose
 * uses it as "only".
 */

import {
    CONTRASTS,
    DIMINISHERS,
    FIRST_PERSON,
    INTENSIFIERS,
    LEXICON,
    NEGATIONS,
    STOPWORDS
} from './lexicon.js';

export const FEATURE_NAMES = Object.freeze([
    'valenceLex',
    'arousalLex',
    'dominanceLex',
    'coverage',
    'negationRate',
    'intensifierRate',
    'firstPersonRate',
    'questionRate',
    'exclamationRate',
    'contrastRate',
    'solemnRate',
    'warmthLex',
    'scaleRate',
    'motionRate',
    'punctDensity',
    'sentenceLengthNorm',
    'typeTokenRatio',
    'intimacyRate',
    'uncertaintyRate',
    'dialogueRate'
]);

const TOKEN = /[A-Za-z]+(?:'[A-Za-z]+)?|[?!]/gu;

function normalize(text) {
    return String(text)
        .replace(/[\u2019\u2018]/gu, "'")
        .replace(/[\u201C\u201D]/gu, '"');
}

export function tokenize(text) {
    return normalize(text).match(TOKEN) || [];
}

function rate(count, denominator) {
    if (!denominator) return 0;
    return Math.min(1, count / denominator);
}

/**
 * @param {string} text
 * @param {{ negate?: boolean }} [options]
 */
export function extractFeatures(text, options = {}) {
    const negate = options.negate !== false;
    const tokens = tokenize(text).map(token => token.toLowerCase());
    const sentences = String(text).split(/[.!?]+/u).filter(part => part.trim().length > 0);
    const content = [];
    let valenceSum = 0;
    let arousalSum = 0;
    let dominanceSum = 0;
    let warmthSum = 0;
    let warmthHits = 0;
    let hits = 0;
    let negationsApplied = 0;
    let intensifierHits = 0;
    let solemnHits = 0;
    let scaleHits = 0;
    let motionHits = 0;
    let intimacyHits = 0;
    let uncertaintyHits = 0;
    let contrastHits = 0;
    let firstPersonHits = 0;
    let questions = 0;
    let exclamations = 0;
    let negationWindow = 0;
    let intensity = 1;

    for (const token of tokens) {
        if (token === '?') {
            questions += 1;
            continue;
        }
        if (token === '!') {
            exclamations += 1;
            continue;
        }
        if (FIRST_PERSON.has(token)) firstPersonHits += 1;
        if (CONTRASTS.has(token)) contrastHits += 1;
        if (NEGATIONS.has(token) || token.endsWith("n't")) {
            if (negate) negationWindow = 3;
            continue;
        }
        if (INTENSIFIERS.has(token)) {
            intensity = 1.35;
            continue;
        }
        if (DIMINISHERS.has(token)) {
            intensity = 0.65;
            continue;
        }
        if (STOPWORDS.has(token)) {
            if (negationWindow > 0) negationWindow -= 1;
            continue;
        }
        content.push(token);
        const entry = LEXICON[token];
        const negated = negate && negationWindow > 0;
        if (negated) negationWindow -= 1;
        if (!entry) {
            intensity = 1;
            continue;
        }
        const sign = negated ? -1 : 1;
        const magnitude = intensity;
        if (negated) negationsApplied += 1;
        if (magnitude !== 1) intensifierHits += 1;
        valenceSum += sign * entry.v * magnitude;
        arousalSum += Math.min(1, entry.a * (magnitude > 1 ? 1.15 : magnitude < 1 ? 0.85 : 1));
        dominanceSum += sign * entry.d * (magnitude > 1 ? 1.1 : 1);
        hits += 1;
        if (entry.warmth != null) {
            warmthSum += sign * entry.warmth;
            warmthHits += 1;
        }
        if (entry.solemn) solemnHits += entry.solemn;
        if (entry.scale) scaleHits += entry.scale;
        if (entry.motion) motionHits += entry.motion;
        if (entry.intimacy) intimacyHits += entry.intimacy;
        if (entry.uncertainty) uncertaintyHits += Math.max(0, entry.uncertainty);
        intensity = 1;
    }

    const contentCount = content.length || 1;
    const unique = new Set(content).size;
    const meanSentence = sentences.length
        ? tokens.filter(token => token !== '?' && token !== '!').length / sentences.length
        : tokens.length;
    const dialogue = (String(text).match(/["\u201C\u201D]/gu) || []).length;

    const values = {
        valenceLex: hits ? valenceSum / hits : 0,
        arousalLex: hits ? arousalSum / hits : 0,
        dominanceLex: hits ? dominanceSum / hits : 0,
        coverage: content.length ? hits / content.length : 0,
        negationRate: hits ? negationsApplied / hits : 0,
        intensifierRate: hits ? intensifierHits / hits : 0,
        firstPersonRate: rate(firstPersonHits, tokens.length),
        questionRate: rate(questions, Math.max(1, sentences.length)),
        exclamationRate: rate(exclamations, Math.max(1, sentences.length)),
        contrastRate: rate(contrastHits, contentCount),
        solemnRate: rate(solemnHits, contentCount),
        warmthLex: warmthHits ? warmthSum / warmthHits : 0,
        scaleRate: rate(scaleHits, contentCount),
        motionRate: rate(motionHits, contentCount),
        punctDensity: rate(questions + exclamations + ((String(text).match(/[,;:]/gu) || []).length), Math.max(1, tokens.length)),
        sentenceLengthNorm: Math.min(1, meanSentence / 40),
        typeTokenRatio: content.length ? unique / content.length : 0,
        intimacyRate: rate(intimacyHits, contentCount),
        uncertaintyRate: rate(uncertaintyHits, contentCount),
        dialogueRate: rate(dialogue, Math.max(1, String(text).length / 20))
    };

    return {
        names: FEATURE_NAMES,
        values: FEATURE_NAMES.map(name => values[name]),
        map: values,
        hits,
        contentWords: content.length,
        tokens: tokens.length
    };
}
