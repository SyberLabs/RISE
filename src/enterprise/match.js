/**
 * Two matchers over the prepared cards.
 *
 * Lexical and entity spotting runs on every partial transcript. Semantic
 * matching embeds a finalized window, finds nearest neighbours, and reranks
 * with the lexical score. Both are local. The ceilings in the suite are the
 * product targets (under a second, under two), not a field measurement.
 *
 * The embedding here is a hashed bag of tokens. When the room's sentence
 * vectors are attached (`attachDense`) and a line arrives with its own
 * vector, the semantic tier scores by calibrated cosine instead.
 */

import { calibrate, cosine } from './embedding.js';
import { covers, tokenize } from './text.js';

const DIM = 64;

function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function unit(vector) {
    let sum = 0;
    for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
    const norm = Math.sqrt(sum);
    if (!norm) return vector;
    const out = new Float64Array(vector.length);
    for (let i = 0; i < vector.length; i += 1) out[i] = vector[i] / norm;
    return out;
}

export function embed(text) {
    const vector = new Float64Array(DIM);
    for (const token of tokenize(text)) {
        const bucket = hash(token) % DIM;
        const sign = (hash(`${token}#`) & 1) === 0 ? 1 : -1;
        vector[bucket] += sign;
    }
    return unit(vector);
}

function cardText(card, corpus) {
    if (card.kind === 'passage') return `${card.title}\n${card.body}`;
    const table = corpus.tables.find(item => item.id === card.chart.tableId);
    const labels = table
        ? table.rows.map(row => row[card.chart.labelColumnId]).join(' ')
        : '';
    const columns = table
        ? table.columns.map(column => column.name).join(' ')
        : '';
    return `${card.title}\n${table?.title || ''}\n${columns}\n${labels}`;
}

function byRank(a, b) {
    return (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function hitEntity(text, entity) {
    const probe = text.trim().toLowerCase();
    const names = [entity.name, ...entity.aliases];
    if (probe.length >= 4 && names.some(name => name.toLowerCase().startsWith(probe))) return true;
    const tokens = tokenize(text);
    return names.some(name => {
        const parts = tokenize(name);
        return parts.length > 0 && parts.every(part => tokens.some(token =>
            covers(part, token) || covers(token, part)));
    });
}

function entityBoost(text, card, entities) {
    return entities.some(entity => {
        if (!hitEntity(text, entity)) return false;
        return tokenize(entity.name).some(part => [...card.terms].some(term =>
            covers(term, part) || covers(part, term)));
    });
}

export function indexProgram(program, corpus, embedder = embed) {
    return {
        embedder,
        entities: program.entities,
        cards: program.cards.map(card => {
            const text = cardText(card, corpus);
            return {
                id: card.id,
                title: card.title,
                layout: card.layout,
                layouts: card.layouts,
                text,
                terms: new Set(tokenize(text)),
                vector: unit(embedder(text)),
                dense: null
            };
        }),
        scale: null
    };
}

/** Attach sentence vectors by card id. Cards without one keep the hashed tier. */
export function attachDense(index, vectors, scale) {
    for (const card of index.cards) card.dense = vectors.get(card.id) ?? null;
    index.scale = scale;
}

export function matchLexical(index, text, options = {}) {
    const tokens = tokenize(text);
    const ranked = index.cards.map(card => {
        const matched = tokens.filter(token => [...card.terms].some(term => covers(term, token))).length;
        const ratio = tokens.length ? matched / tokens.length : 0;
        const boost = entityBoost(text, card, index.entities) ? 0.35 : 0;
        return {
            id: card.id,
            title: card.title,
            score: Math.min(1, ratio + boost),
            tier: 'lexical',
            layouts: card.layouts,
            layout: card.layout
        };
    });
    ranked.sort(byRank);
    return ranked.slice(0, options.limit ?? 5);
}

function dot(left, right) {
    const width = Math.min(left.length, right.length);
    let total = 0;
    for (let i = 0; i < width; i += 1) total += left[i] * right[i];
    return total;
}

export function matchSemantic(index, text, options = {}) {
    if (options.vector && index.scale && index.cards.every(card => card.dense)) {
        const ranked = index.cards.map(card => ({
            id: card.id,
            title: card.title,
            score: calibrate(cosine(options.vector, card.dense), index.scale),
            tier: 'semantic',
            layouts: card.layouts,
            layout: card.layout
        }));
        ranked.sort(byRank);
        return ranked.slice(0, options.limit ?? 5);
    }
    const embedder = options.embed || index.embedder || embed;
    const query = unit(embedder(text));
    // The window is what gets embedded. Rerank uses the sentence that just
    // finished, so an earlier topic does not keep a new sentence off the rail.
    const lexicalText = options.lexicalText ?? text;
    const lexical = new Map(matchLexical(index, lexicalText, { limit: index.cards.length })
        .map(hit => [hit.id, hit.score]));
    const ranked = index.cards.map(card => {
        const semantic = Math.max(0, dot(query, card.vector));
        const lex = lexical.get(card.id) || 0;
        return {
            id: card.id,
            title: card.title,
            score: (0.65 * semantic) + (0.35 * lex),
            tier: 'semantic',
            layouts: card.layouts,
            layout: card.layout
        };
    });
    ranked.sort(byRank);
    return ranked.slice(0, options.limit ?? 5);
}
