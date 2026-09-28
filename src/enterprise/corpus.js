/**
 * Ingest a bounded corpus: documents, the tables that cite them, and the
 * entity list the recognizer is allowed to boost.
 *
 * A number column is a bare numeral. Prose such as "4.2 million" stays in
 * the document. The chart assembler has no other place to read a figure.
 */

import { fail } from './errors.js';

const NUMBER = /^-?\d+(?:\.\d+)?$/u;

function exactId(value, path) {
    if (typeof value !== 'string' || !value || value !== value.trim()) {
        fail('CORPUS_ID', `Expected an id at ${path}`);
    }
    return value;
}

function stringList(value, path) {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
        fail('CORPUS_LIST', `Expected a list of strings at ${path}`);
    }
    return value;
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function claimId(seen, id, path) {
    if (seen.has(id)) fail('CORPUS_DUPLICATE', `Duplicate id ${id} at ${path}`);
    seen.add(id);
}

export function ingestCorpus(input) {
    if (!input || typeof input !== 'object') fail('CORPUS_SHAPE', 'Expected a corpus');
    const ids = new Set();
    const documents = (input.documents || []).map((document, index) => {
        const path = `documents[${index}]`;
        const id = exactId(document?.id, `${path}.id`);
        claimId(ids, id, path);
        const pages = (document.pages || []).map((page, pageIndex) => {
            if (!Number.isInteger(page?.page) || page.page < 1) {
                fail('CORPUS_PAGE', `Expected a page number at ${path}.pages[${pageIndex}]`);
            }
            if (typeof page.text !== 'string' || !page.text.trim()) {
                fail('CORPUS_PAGE', `Expected page text at ${path}.pages[${pageIndex}]`);
            }
            return { page: page.page, text: page.text };
        });
        if (!pages.length) fail('CORPUS_PAGE', `Expected at least one page at ${path}`);
        return {
            id,
            title: exactId(document.title, `${path}.title`),
            audiences: stringList(document.audiences, `${path}.audiences`),
            pages
        };
    });

    const tables = (input.tables || []).map((table, index) => {
        const path = `tables[${index}]`;
        const id = exactId(table?.id, `${path}.id`);
        claimId(ids, id, path);
        const document = documents.find(item => item.id === table.documentId);
        if (!document) fail('CORPUS_DOCUMENT', `Table ${id} cites a document the corpus does not have`);
        if (!document.pages.some(page => page.page === table.page)) {
            fail('CORPUS_PAGE', `Table ${id} cites a page the document does not have`);
        }
        const columns = (table.columns || []).map((column, columnIndex) => {
            if (column?.kind !== 'label' && column?.kind !== 'number') {
                fail('CORPUS_COLUMN', `Expected a label or number column at ${path}.columns[${columnIndex}]`);
            }
            return {
                id: exactId(column.id, `${path}.columns[${columnIndex}].id`),
                name: exactId(column.name, `${path}.columns[${columnIndex}].name`),
                kind: column.kind
            };
        });
        if (!columns.length) fail('CORPUS_COLUMN', `Expected columns at ${path}`);
        const rows = (table.rows || []).map((row, rowIndex) => {
            const out = {};
            for (const column of columns) {
                const raw = row?.[column.id];
                if (typeof raw !== 'string') {
                    fail('CORPUS_CELL', `Expected a string cell at ${path}.rows[${rowIndex}].${column.id}`);
                }
                if (column.kind === 'number' && (!NUMBER.test(raw) || !Number.isFinite(Number(raw)))) {
                    fail('CORPUS_NUMBER', `Expected a bare number at ${path}.rows[${rowIndex}].${column.id}`);
                }
                out[column.id] = raw;
            }
            return out;
        });
        if (!rows.length) fail('CORPUS_CELL', `Expected rows at ${path}`);
        return {
            id,
            title: exactId(table.title, `${path}.title`),
            documentId: document.id,
            page: table.page,
            columns,
            rows
        };
    });

    const entities = (input.entities || []).map((entity, index) => {
        const path = `entities[${index}]`;
        const id = exactId(entity?.id, `${path}.id`);
        claimId(ids, id, path);
        const documentIds = entity.documentIds ? stringList(entity.documentIds, `${path}.documentIds`) : [];
        for (const documentId of documentIds) {
            if (!documents.some(document => document.id === documentId)) {
                fail('CORPUS_DOCUMENT', `Entity ${id} cites a document the corpus does not have`);
            }
        }
        return {
            id,
            name: exactId(entity.name, `${path}.name`),
            aliases: entity.aliases ? stringList(entity.aliases, `${path}.aliases`) : [],
            documentIds
        };
    });

    const tenantId = input.tenantId == null ? 'local' : input.tenantId;
    const residency = input.residency == null ? 'local' : input.residency;
    return deepFreeze({ documents, tables, entities, tenantId, residency });
}

function boundString(value, code, word) {
    if (typeof value !== 'string' || !value || value !== value.trim()) {
        fail(code, `Expected a ${word}`);
    }
    return value;
}

export function bindTenant(input, binding = {}) {
    const tenantId = boundString(binding.tenantId, 'CORPUS_TENANT', 'tenant');
    const residency = boundString(binding.residency, 'CORPUS_RESIDENCY', 'residency');
    return ingestCorpus({ ...input, tenantId, residency });
}

export function corpusFromRecords(records, binding) {
    return bindTenant(records, binding);
}

export function combineCorpora(left, right) {
    if (left?.residency !== right?.residency) {
        fail('CORPUS_RESIDENCY', 'Corpora must share a residency');
    }
    if (left?.tenantId !== right?.tenantId) {
        fail('CORPUS_TENANT', 'Corpora must share a tenant');
    }
    return ingestCorpus({
        documents: [...left.documents, ...right.documents],
        tables: [...left.tables, ...right.tables],
        entities: [...left.entities, ...right.entities],
        tenantId: left.tenantId,
        residency: left.residency
    });
}
