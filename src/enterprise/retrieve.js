/**
 * Fallback search over the corpus the room is allowed to see.
 *
 * Prepared cards stay first. This index is sentences and tables that
 * passed the audience check, and every hit is a card the gate accepts.
 * Scoring uses whole tokens, the same bar as prepare: two shared tokens
 * and a ratio of at least 0.34. Prefixes are not a hit here.
 */

import { validateCard } from './gate.js';
import { sentences, tokenize } from './text.js';

const MIN_SHARED = 2;
const MIN_RATIO = 0.34;

function overlap(queryTokens, targetTokens) {
    const target = new Set(targetTokens);
    let count = 0;
    for (const token of queryTokens) {
        if (target.has(token)) count += 1;
    }
    return {
        count,
        ratio: queryTokens.length ? count / queryTokens.length : 0
    };
}

function chartLayout(table) {
    const label = table.columns.find(column => column.kind === 'label') || table.columns[0];
    const ordered = table.rows.every(row => /^(?:q[1-4]|\d{4})$/iu.test(row[label.id]));
    return ordered ? 'line' : 'bar';
}

function passageCard(document, page, sentence, index, query) {
    return {
        id: `card:retrieval:${document.id}:${page.page}:${index}`,
        title: document.title,
        topicId: 'retrieval',
        kind: 'passage',
        layouts: ['quote'],
        layout: 'quote',
        body: sentence,
        chart: null,
        provenance: [{
            documentId: document.id,
            page: page.page,
            tableId: null,
            query
        }]
    };
}

function chartCard(table, query) {
    const label = table.columns.find(column => column.kind === 'label') || table.columns[0];
    const valueColumnIds = table.columns
        .filter(column => column.kind === 'number')
        .map(column => column.id);
    return {
        id: `card:retrieval:chart:${table.id}`,
        title: table.title,
        topicId: 'retrieval',
        kind: 'chart',
        layouts: ['bar', 'line', 'table'],
        layout: chartLayout(table),
        body: null,
        chart: {
            tableId: table.id,
            labelColumnId: label.id,
            valueColumnIds
        },
        provenance: [{
            documentId: table.documentId,
            page: table.page,
            tableId: table.id,
            query
        }]
    };
}

export function indexCorpus(corpus, audienceId) {
    const entries = [];
    for (const document of corpus.documents) {
        if (!document.audiences.includes(audienceId)) continue;
        for (const page of document.pages) {
            sentences(page.text).forEach((sentence, index) => {
                entries.push({
                    id: `card:retrieval:${document.id}:${page.page}:${index}`,
                    ratioTokens: tokenize(sentence),
                    card: (query) => passageCard(document, page, sentence, index, query)
                });
            });
        }
    }
    for (const table of corpus.tables) {
        const document = corpus.documents.find(item => item.id === table.documentId);
        if (!document?.audiences.includes(audienceId)) continue;
        if (!table.columns.some(column => column.kind === 'number')) continue;
        const labelValues = table.rows.flatMap(row => table.columns
            .filter(column => column.kind === 'label')
            .map(column => row[column.id]));
        entries.push({
            id: `card:retrieval:chart:${table.id}`,
            ratioTokens: tokenize([
                table.title,
                document.title,
                ...table.columns.map(column => column.name),
                ...labelValues
            ].join(' ')),
            card: (query) => chartCard(table, query)
        });
    }
    return { corpus, audienceId, entries };
}

export function retrieve(index, text, { limit = 3 } = {}) {
    const query = String(text ?? '').trim().slice(0, 160);
    const queryTokens = tokenize(query);
    const ranked = [];
    for (const entry of index.entries) {
        const score = overlap(queryTokens, entry.ratioTokens);
        if (score.count < MIN_SHARED || score.ratio < MIN_RATIO) continue;
        ranked.push({ id: entry.id, ratio: score.ratio, card: entry.card(query) });
    }
    ranked.sort((a, b) => (b.ratio - a.ratio) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const cards = [];
    for (const hit of ranked.slice(0, limit)) {
        try {
            validateCard(hit.card, index.corpus, index.audienceId);
            cards.push(hit.card);
        } catch {
            // A hit that the gate refuses is not a candidate.
        }
    }
    return cards;
}
