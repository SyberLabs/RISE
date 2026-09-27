/**
 * The talk-program gate.
 *
 * A card is admitted for one audience, or it is not admitted. Passage text
 * has to be the cited page. Chart specs name a table and columns. Any other
 * field — including a model-written value — is a refusal. Every numeral that
 * would be shown has to occur as its own token in the cited source.
 */

import { fail } from './errors.js';

export const TALK_PROGRAM_SCHEMA = 'rise.talk-program.v1';

const CARD_KEYS = new Set([
    'id', 'title', 'topicId', 'kind', 'layouts', 'layout', 'body', 'chart', 'provenance'
]);
const CHART_KEYS = new Set(['tableId', 'labelColumnId', 'valueColumnIds']);
const PROVENANCE_KEYS = new Set(['documentId', 'page', 'tableId', 'query']);
const CHART_LAYOUTS = new Set(['bar', 'line', 'table']);

function onlyKeys(value, allowed, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('CARD_SHAPE', `Expected an object at ${path}`);
    }
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) fail('CARD_FIELD', `Unknown field ${key} at ${path}`);
    }
}

function documentOf(corpus, id) {
    return corpus.documents.find(document => document.id === id) || null;
}

function pageOf(corpus, item) {
    const document = documentOf(corpus, item.documentId);
    return document?.pages.find(page => page.page === item.page) || null;
}

function tableOf(corpus, id) {
    return corpus.tables.find(table => table.id === id) || null;
}

/** A numeral glued to a letter (Q1) is a label, not a plotted value. */
export function numericTokens(text) {
    return String(text ?? '').match(/(?<![A-Za-z0-9.])\d+(?:\.\d+)?(?![A-Za-z0-9.])/g) || [];
}

export function permit(card, corpus, audienceId) {
    if (!card?.provenance?.length || typeof audienceId !== 'string' || !audienceId) return false;
    return card.provenance.every(item => {
        const document = documentOf(corpus, item?.documentId);
        return !!document && document.audiences.includes(audienceId);
    });
}

function sourceNumbers(card, corpus) {
    const found = new Set();
    for (const item of card.provenance) {
        const page = pageOf(corpus, item);
        for (const token of numericTokens(page?.text || '')) found.add(token);
        if (item.tableId) {
            const table = tableOf(corpus, item.tableId);
            for (const row of table?.rows || []) {
                for (const value of Object.values(row)) {
                    for (const token of numericTokens(value)) found.add(token);
                }
            }
        }
    }
    return found;
}

function assertTraced(card, corpus) {
    const allowed = sourceNumbers(card, corpus);
    const shown = [
        ...numericTokens(card.title),
        ...numericTokens(card.body)
    ];
    for (const token of shown) {
        if (!allowed.has(token)) {
            fail('CARD_NUMBER', `The number ${token} is not in the cited source`);
        }
    }
}

export function validateCard(card, corpus, audienceId) {
    onlyKeys(card, CARD_KEYS, 'card');
    if (typeof card.id !== 'string' || !card.id.trim()) fail('CARD_ID', 'Expected a card id');
    if (typeof card.title !== 'string' || !card.title.trim()) fail('CARD_TITLE', 'Expected a card title');
    if (typeof card.topicId !== 'string' || !card.topicId.trim()) fail('CARD_TOPIC', 'Expected a topic id');
    if (!Array.isArray(card.layouts) || !card.layouts.length) fail('CARD_LAYOUT', 'Expected layouts');
    if (!card.layouts.includes(card.layout)) fail('CARD_LAYOUT', 'Layout is not one of the card layouts');
    if (!permit(card, corpus, audienceId)) {
        fail('CARD_AUDIENCE', `Card ${card.id} is not permitted for this audience`);
    }

    if (!Array.isArray(card.provenance) || !card.provenance.length) {
        fail('CARD_PROVENANCE', 'Expected provenance');
    }
    for (const item of card.provenance) {
        onlyKeys(item, PROVENANCE_KEYS, 'card.provenance');
        if (!pageOf(corpus, item)) fail('CARD_PROVENANCE', 'Provenance cites a missing page');
        if (typeof item.query !== 'string' || !item.query.trim()) {
            fail('CARD_PROVENANCE', 'Provenance needs the query that selected it');
        }
        if (item.tableId != null && !tableOf(corpus, item.tableId)) {
            fail('CARD_PROVENANCE', 'Provenance cites a missing table');
        }
    }

    if (card.kind === 'passage') {
        if (card.chart != null) fail('CARD_FIELD', 'A passage has no chart spec');
        if (typeof card.body !== 'string' || !card.body.trim()) fail('CARD_BODY', 'Expected passage text');
        if (card.layouts.some(layout => layout !== 'quote')) fail('CARD_LAYOUT', 'A passage is a quote');
        for (const item of card.provenance) {
            if (item.tableId != null) fail('CARD_PROVENANCE', 'A passage does not cite a table');
            const page = pageOf(corpus, item);
            if (!page.text.includes(card.body)) {
                fail('CARD_BODY', 'A passage has to be the cited page, verbatim');
            }
        }
    } else if (card.kind === 'chart') {
        if (card.body != null) fail('CARD_BODY', 'A chart does not carry prose');
        onlyKeys(card.chart, CHART_KEYS, 'card.chart');
        if (!Array.isArray(card.chart.valueColumnIds) || !card.chart.valueColumnIds.length) {
            fail('CARD_CHART', 'Expected value columns');
        }
        if (card.layouts.some(layout => !CHART_LAYOUTS.has(layout))) {
            fail('CARD_LAYOUT', 'Unknown chart layout');
        }
        const table = tableOf(corpus, card.chart.tableId);
        if (!table) fail('CARD_CHART', 'Chart cites a missing table');
        const label = table.columns.find(column => column.id === card.chart.labelColumnId);
        if (!label) fail('CARD_CHART', 'Chart cites a missing label column');
        for (const columnId of card.chart.valueColumnIds) {
            const column = table.columns.find(item => item.id === columnId);
            if (!column || column.kind !== 'number') {
                fail('CARD_CHART', 'A plotted column has to be a number column on the table');
            }
        }
        for (const item of card.provenance) {
            if (item.tableId !== card.chart.tableId) {
                fail('CARD_PROVENANCE', 'Chart provenance has to name its table');
            }
            if (item.documentId !== table.documentId || item.page !== table.page) {
                fail('CARD_PROVENANCE', 'Chart provenance has to name the table document and page');
            }
        }
    } else {
        fail('CARD_KIND', 'A card is a passage or a chart');
    }

    assertTraced(card, corpus);
    return card;
}

export function validateProgram(program, corpus) {
    if (!program || program.schema !== TALK_PROGRAM_SCHEMA) {
        fail('PROGRAM_SCHEMA', 'Expected a talk program');
    }
    if (typeof program.presenterId !== 'string' || !program.presenterId.trim()) {
        fail('PROGRAM_PRESENTER', 'Expected one presenter id');
    }
    if (typeof program.audienceId !== 'string' || !program.audienceId) {
        fail('PROGRAM_AUDIENCE', 'Expected an audience id');
    }
    if (!Array.isArray(program.cards) || !Array.isArray(program.topics)) {
        fail('PROGRAM_SHAPE', 'Expected topics and cards');
    }
    const ids = new Set();
    for (const card of program.cards) {
        validateCard(card, corpus, program.audienceId);
        if (ids.has(card.id)) fail('PROGRAM_DUPLICATE', `Duplicate card ${card.id}`);
        ids.add(card.id);
    }
    for (const topic of program.topics) {
        if (!Array.isArray(topic.cardIds)) fail('PROGRAM_TOPIC', 'Expected topic card ids');
        for (const cardId of topic.cardIds) {
            if (!ids.has(cardId)) fail('PROGRAM_TOPIC', `Topic cites a missing card ${cardId}`);
        }
    }
    return program;
}

/**
 * Count numerals on a rendered card. `untraced` above zero means the card
 * must not be shown. Chart cells are checked against the cited table, not
 * against whatever the decision named.
 */
export function auditRendered(parts, card, corpus) {
    const allowed = sourceNumbers(card, corpus);
    let traced = 0;
    let untraced = 0;
    for (const part of parts) {
        for (const token of numericTokens(part)) {
            if (allowed.has(token)) traced += 1;
            else untraced += 1;
        }
    }
    return { traced, untraced };
}
