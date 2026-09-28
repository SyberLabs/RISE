/**
 * Prepare a talk before the room starts.
 *
 * Each slide is scored against permitted pages and tables. A hit becomes a
 * card that has already passed the gate: the passage is a verbatim sentence,
 * the chart names columns, and a board-only document never enters the program.
 * This is the reasoning tier run ahead of the speaker. It does not call a
 * model, and it does not invent a figure.
 */

import { ingestCorpus } from './corpus.js';
import { fail } from './errors.js';
import { TALK_PROGRAM_SCHEMA, validateProgram } from './gate.js';
import { sentences, tokenize } from './text.js';

const MIN_SHARED = 2;
const MIN_RATIO = 0.34;

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function overlap(slideTokens, targetTokens) {
    const target = new Set(targetTokens);
    let count = 0;
    for (const token of slideTokens) {
        if (target.has(token)) count += 1;
    }
    return {
        count,
        ratio: slideTokens.length ? count / slideTokens.length : 0
    };
}

function permitted(document, audienceId) {
    return document.audiences.includes(audienceId);
}

function bestPassage(slideTokens, corpus, audienceId) {
    let best = null;
    for (const document of corpus.documents) {
        if (!permitted(document, audienceId)) continue;
        for (const page of document.pages) {
            for (const sentence of sentences(page.text)) {
                const score = overlap(slideTokens, tokenize(sentence));
                if (score.count < MIN_SHARED || score.ratio < MIN_RATIO) continue;
                if (!best || score.ratio > best.ratio) {
                    best = { sentence, document, page: page.page, ratio: score.ratio };
                }
            }
        }
    }
    return best;
}

function tableTokens(table, corpus) {
    const document = corpus.documents.find(item => item.id === table.documentId);
    const labels = table.rows.flatMap(row => table.columns
        .filter(column => column.kind === 'label')
        .map(column => row[column.id]));
    return tokenize([
        table.title,
        document?.title || '',
        ...table.columns.map(column => column.name),
        ...labels
    ].join(' '));
}

function bestTable(slideTokens, corpus, audienceId) {
    let best = null;
    for (const table of corpus.tables) {
        const document = corpus.documents.find(item => item.id === table.documentId);
        if (!document || !permitted(document, audienceId)) continue;
        if (!table.columns.some(column => column.kind === 'number')) continue;
        const score = overlap(slideTokens, tableTokens(table, corpus));
        if (score.count < MIN_SHARED || score.ratio < MIN_RATIO) continue;
        if (!best || score.ratio > best.ratio) best = { table, ratio: score.ratio };
    }
    return best;
}

function chartLayout(table) {
    const label = table.columns.find(column => column.kind === 'label') || table.columns[0];
    const ordered = table.rows.every(row => /^(?:q[1-4]|\d{4})$/iu.test(row[label.id]));
    return ordered ? 'line' : 'bar';
}

function visibleEntities(corpus, audienceId) {
    return corpus.entities
        .filter(entity => {
            if (!entity.documentIds.length) return true;
            return entity.documentIds.some(id => {
                const document = corpus.documents.find(item => item.id === id);
                return document?.audiences.includes(audienceId);
            });
        })
        .map(entity => ({
            id: entity.id,
            name: entity.name,
            aliases: [...entity.aliases]
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function presenterList(presenterId, presenterIds) {
    const list = presenterIds == null ? [presenterId] : presenterIds;
    if (!Array.isArray(list) || !list.length || list.some(id => typeof id !== 'string' || !id.trim())) {
        fail('PREPARE_PRESENTER', 'Expected presenter ids');
    }
    if (new Set(list).size !== list.length || !list.includes(presenterId)) {
        fail('PREPARE_PRESENTER', 'The presenter has to be one of the listed presenters, once');
    }
    return list;
}

export function prepareTalk({ deck, corpus, audienceId, presenterId, presenterIds }) {
    if (!deck?.id || !Array.isArray(deck.slides) || !deck.slides.length) {
        fail('PREPARE_DECK', 'Expected one deck with slides');
    }
    if (typeof presenterId !== 'string' || !presenterId.trim()) {
        fail('PREPARE_PRESENTER', 'Expected one presenter');
    }
    const presenters = presenterList(presenterId, presenterIds);
    if (typeof audienceId !== 'string' || !audienceId) {
        fail('PREPARE_AUDIENCE', 'Expected an audience');
    }
    const source = corpus.documents ? corpus : ingestCorpus(corpus);
    const cards = [];
    const topics = [];

    for (const slide of deck.slides) {
        const slideTokens = tokenize(`${slide.title} ${slide.notes || ''}`);
        const cardIds = [];
        const passage = bestPassage(slideTokens, source, audienceId);
        if (passage) {
            const id = `card:${slide.id}:passage:${passage.document.id}:${passage.page}`;
            cards.push({
                id,
                title: slide.title,
                topicId: slide.id,
                kind: 'passage',
                layouts: ['quote'],
                layout: 'quote',
                body: passage.sentence,
                chart: null,
                provenance: [{
                    documentId: passage.document.id,
                    page: passage.page,
                    tableId: null,
                    query: slide.title
                }]
            });
            cardIds.push(id);
        }
        const chart = bestTable(slideTokens, source, audienceId);
        if (chart) {
            const label = chart.table.columns.find(column => column.kind === 'label')
                || chart.table.columns[0];
            const valueColumnIds = chart.table.columns
                .filter(column => column.kind === 'number')
                .map(column => column.id);
            const id = `card:${slide.id}:chart:${chart.table.id}`;
            cards.push({
                id,
                title: slide.title,
                topicId: slide.id,
                kind: 'chart',
                layouts: ['bar', 'line', 'table'],
                layout: chartLayout(chart.table),
                body: null,
                chart: {
                    tableId: chart.table.id,
                    labelColumnId: label.id,
                    valueColumnIds
                },
                provenance: [{
                    documentId: chart.table.documentId,
                    page: chart.table.page,
                    tableId: chart.table.id,
                    query: slide.title
                }]
            });
            cardIds.push(id);
        }
        topics.push({ id: slide.id, title: slide.title, cardIds });
    }

    const program = {
        schema: TALK_PROGRAM_SCHEMA,
        id: `talk:${deck.id}:${audienceId}`,
        presenterId,
        presenterIds: presenters,
        deckId: deck.id,
        audienceId,
        entities: visibleEntities(source, audienceId),
        topics,
        cards
    };
    validateProgram(program, source);
    return deepFreeze(program);
}
