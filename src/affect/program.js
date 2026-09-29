/**
 * rise.affect-program.v1
 *
 * A program names phrases the chunker produces and attaches an experience
 * state to some of them. A phrase it does not name stays absent. The gate
 * re-chunks the text. It does not repair a drifted cut, and it does not
 * clamp a value into range.
 *
 * authority `proposed` is a draft. `user` is a person saving it. There is
 * no certified flag.
 */

import { chunkText } from '../core/chunker.js';
import { READING_PACE } from '../core/reading-limits.js';
import { DIMENSION_BY_ID, EXPERIENCE_STATE_VERSION } from './dimensions.js';
import { contentHash } from './hash.js';

export const AFFECT_PROGRAM_SCHEMA = 'rise.affect-program.v1';

export const PROGRAM_REFUSALS = Object.freeze([
    'AFFECT_PROGRAM_SCHEMA',
    'AFFECT_PROGRAM_UNKNOWN_FIELD',
    'AFFECT_PROGRAM_AUTHORITY',
    'AFFECT_PROGRAM_HASH',
    'AFFECT_PROGRAM_CHUNK',
    'AFFECT_PROGRAM_SPAN',
    'AFFECT_PROGRAM_PHRASE',
    'AFFECT_PROGRAM_DUPLICATE',
    'AFFECT_PROGRAM_STATE',
    'AFFECT_PROGRAM_MEASURED'
]);

const AUTHORITIES = new Set(['proposed', 'user']);
const PROGRAM_SOURCES = new Set(['inferred', 'prior', 'derived', 'authored']);
const PROGRAM_KEYS = new Set(['schema', 'authority', 'textHash', 'chunk', 'spans']);
const CHUNK_KEYS = new Set(['mode', 'wpm', 'phraseFloor']);
const SPAN_KEYS = new Set(['index', 'text', 'state']);
const STATE_KEYS = new Set(['version', 'modality', 'dimensions', 'provenance']);
const SLOT_KEYS = new Set(['value', 'confidence', 'source']);
const PROVENANCE_KEYS = new Set(['method']);

export class AffectProgramError extends Error {
    constructor(code, message, path = '$') {
        super(`${message} (${path})`);
        this.name = 'AffectProgramError';
        this.code = code;
        this.path = path;
    }
}

const fail = (code, message, path) => {
    throw new AffectProgramError(code, message, path);
};

function record(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('AFFECT_PROGRAM_SCHEMA', 'Expected an object', path);
    }
    return value;
}

function onlyKeys(value, allowed, path) {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) fail('AFFECT_PROGRAM_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
}

function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) freezeDeep(nested);
    return Object.freeze(value);
}

export function affectPhrases(text, chunk) {
    return chunkText(String(text), {
        mode: 'phrase',
        wpm: chunk.wpm,
        phraseFloor: chunk.phraseFloor
    })
        .filter(atom => atom.modality === 'text' && atom.content)
        .map(atom => atom.content);
}

function readChunk(raw) {
    const chunk = record(raw, '$.chunk');
    onlyKeys(chunk, CHUNK_KEYS, '$.chunk');
    if (chunk.mode !== 'phrase') fail('AFFECT_PROGRAM_CHUNK', 'An affect program is cut in phrases', '$.chunk.mode');
    if (!Number.isInteger(chunk.wpm) || chunk.wpm < READING_PACE.min || chunk.wpm > READING_PACE.max) {
        fail('AFFECT_PROGRAM_CHUNK', 'Words per minute are outside the reading window', '$.chunk.wpm');
    }
    const floor = chunk.phraseFloor;
    const floorOk = floor === true || floor === false || (Number.isInteger(floor) && floor >= 0 && floor <= 16);
    if (!floorOk) fail('AFFECT_PROGRAM_CHUNK', 'Phrase floor is not a boolean or an integer from 0 to 16', '$.chunk.phraseFloor');
    return { mode: 'phrase', wpm: chunk.wpm, phraseFloor: floor };
}

function readSlot(raw, path) {
    const slot = record(raw, path);
    onlyKeys(slot, SLOT_KEYS, path);
    if (slot.source === 'measured') fail('AFFECT_PROGRAM_MEASURED', 'A text program has no instrument reading', `${path}.source`);
    if (!PROGRAM_SOURCES.has(slot.source)) fail('AFFECT_PROGRAM_STATE', 'Slot source is not allowed on a program', `${path}.source`);
    if (typeof slot.value !== 'number' || !Number.isFinite(slot.value)) {
        fail('AFFECT_PROGRAM_STATE', 'A missing axis is omitted, not stored as an empty score', `${path}.value`);
    }
    if (typeof slot.confidence !== 'number' || !Number.isFinite(slot.confidence) || slot.confidence < 0 || slot.confidence > 1) {
        fail('AFFECT_PROGRAM_STATE', 'Confidence is outside 0 to 1', `${path}.confidence`);
    }
    return { value: slot.value, confidence: slot.confidence, source: slot.source };
}

function readState(raw, path) {
    const state = record(raw, path);
    onlyKeys(state, STATE_KEYS, path);
    if (state.version !== EXPERIENCE_STATE_VERSION) fail('AFFECT_PROGRAM_STATE', 'Experience state version is not 1', `${path}.version`);
    if (state.modality !== 'text') fail('AFFECT_PROGRAM_STATE', 'An affect program span is text', `${path}.modality`);
    const provenance = record(state.provenance, `${path}.provenance`);
    onlyKeys(provenance, PROVENANCE_KEYS, `${path}.provenance`);
    if (typeof provenance.method !== 'string' || provenance.method.length === 0) {
        fail('AFFECT_PROGRAM_STATE', 'Provenance needs a method', `${path}.provenance.method`);
    }
    const dimensionsIn = record(state.dimensions, `${path}.dimensions`);
    const dimensions = {};
    for (const [id, slot] of Object.entries(dimensionsIn)) {
        const dimension = DIMENSION_BY_ID[id];
        if (!dimension) fail('AFFECT_PROGRAM_STATE', `Unknown axis: ${id}`, `${path}.dimensions.${id}`);
        const read = readSlot(slot, `${path}.dimensions.${id}`);
        if (read.value < dimension.range[0] || read.value > dimension.range[1]) {
            fail('AFFECT_PROGRAM_STATE', `${id} is outside ${dimension.range[0]} to ${dimension.range[1]}`, `${path}.dimensions.${id}.value`);
        }
        dimensions[id] = read;
    }
    return {
        version: EXPERIENCE_STATE_VERSION,
        modality: 'text',
        dimensions,
        provenance: { method: provenance.method }
    };
}

/**
 * @param {object} program
 * @param {string} text the text the hash and the phrases must match
 * @returns {Readonly<object>}
 */
export function admitAffectProgram(program, text) {
    const source = record(program, '$');
    onlyKeys(source, PROGRAM_KEYS, '$');
    if (source.schema !== AFFECT_PROGRAM_SCHEMA) {
        fail('AFFECT_PROGRAM_SCHEMA', `Expected schema ${AFFECT_PROGRAM_SCHEMA}`, '$.schema');
    }
    if (!AUTHORITIES.has(source.authority)) fail('AFFECT_PROGRAM_AUTHORITY', 'Authority is proposed or user', '$.authority');
    if (typeof text !== 'string') fail('AFFECT_PROGRAM_HASH', 'The text is required', '$.textHash');
    if (source.textHash !== contentHash(text)) fail('AFFECT_PROGRAM_HASH', 'Text hash does not match', '$.textHash');
    const chunk = readChunk(source.chunk);
    const phrases = affectPhrases(text, chunk);
    if (!Array.isArray(source.spans)) fail('AFFECT_PROGRAM_SPAN', 'Spans are a list', '$.spans');
    const seen = new Set();
    const spans = source.spans.map((raw, index) => {
        const span = record(raw, `$.spans[${index}]`);
        onlyKeys(span, SPAN_KEYS, `$.spans[${index}]`);
        if (!Number.isInteger(span.index) || span.index < 0 || span.index >= phrases.length) {
            fail('AFFECT_PROGRAM_SPAN', 'Phrase index is not one the chunker produced', `$.spans[${index}].index`);
        }
        if (seen.has(span.index)) fail('AFFECT_PROGRAM_DUPLICATE', 'A phrase is named twice', `$.spans[${index}].index`);
        seen.add(span.index);
        if (span.text !== phrases[span.index]) {
            fail('AFFECT_PROGRAM_PHRASE', 'Span text is not the phrase at that index', `$.spans[${index}].text`);
        }
        return {
            index: span.index,
            text: span.text,
            state: readState(span.state, `$.spans[${index}].state`)
        };
    });
    return freezeDeep({
        schema: AFFECT_PROGRAM_SCHEMA,
        authority: source.authority,
        textHash: source.textHash,
        chunk,
        spans
    });
}

/** Saving is the authoring act. Slot sources stay as they were written. */
export function saveAffectProgram(program, text) {
    const admitted = admitAffectProgram(program, text);
    if (admitted.authority === 'user') return admitted;
    return freezeDeep({ ...admitted, authority: 'user' });
}
