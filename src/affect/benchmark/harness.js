/**
 * Runs every runnable text model on the RISE corpus and records
 * disagreements. Models that were not executed are listed as
 * unavailable rather than filled with published numbers.
 */

import { DIMENSION_BY_ID, DIMENSIONS } from '../dimensions.js';
import { experienceState, slot } from '../schema.js';
import { CORPUS, PROBES } from './corpus.js';
import { cachedEncoders } from './external.js';
import { hostedTeacher } from './teacher.js';
import { TEXT_ENCODER_MANIFEST, encodeText } from '../text/encode.js';
import { LEXICAL_MANIFEST, encodeLexical } from '../text/lexical.js';

export function unavailableModels() {
    return cachedEncoders()
        .filter(model => model.available === false)
        .map(model => ({
            id: model.id,
            role: model.role,
            available: false,
            parameters: null,
            reason: model.reason
        }));
}

export function runnableModels() {
    const base = [
        {
            id: LEXICAL_MANIFEST.id,
            role: 'weak-baseline',
            parameters: LEXICAL_MANIFEST.parameters,
            trained: false,
            encode: encodeLexical
        },
        {
            id: TEXT_ENCODER_MANIFEST.id,
            role: 'candidate',
            parameters: TEXT_ENCODER_MANIFEST.activeParameters,
            trained: false,
            encode: encodeText
        }
    ];
    const cached = cachedEncoders().filter(model => model.available && typeof model.encode === 'function');
    return [...base, ...cached];
}

function teacherOutput(judged) {
    const body = judged?.body;
    if (judged?.status !== 'ok' || !body?.dimensions) return null;
    const dimensions = {};
    for (const [id, value] of Object.entries(body.dimensions)) {
        if (!DIMENSION_BY_ID[id] || typeof value !== 'number' || !Number.isFinite(value)) continue;
        dimensions[id] = slot(value, 0.35, 'inferred');
    }
    if (Object.keys(dimensions).length === 0) return null;
    return {
        modelId: body.modelId || judged.id || 'hosted-teacher',
        role: 'teacher',
        parameters: body.parameters ?? null,
        trained: false,
        ms: Number.isFinite(body.ms) ? body.ms : 0,
        confidence: 0.35,
        state: experienceState({
            modality: 'text',
            dimensions,
            caveats: ['language-model-teacher', body.note || 'teacher-response'].filter(item => typeof item === 'string').slice(0, 8),
            provenance: {
                method: 'hosted-teacher',
                modelId: body.modelId || 'hosted-teacher'
            }
        })
    };
}

function meanConfidence(state) {
    const slots = Object.values(state.dimensions).filter(slot => slot.value != null);
    if (!slots.length) return 0;
    return slots.reduce((sum, slot) => sum + slot.confidence, 0) / slots.length;
}

function disagreements(outputs, threshold = 0.35) {
    const found = [];
    for (const dimension of DIMENSIONS) {
        const present = outputs
            .map(output => ({
                modelId: output.modelId,
                slot: output.state.dimensions[dimension.id]
            }))
            .filter(item => item.slot && item.slot.value != null);
        if (present.length < 2) continue;
        for (let left = 0; left < present.length; left += 1) {
            for (let right = left + 1; right < present.length; right += 1) {
                const delta = Math.abs(present[left].slot.value - present[right].slot.value);
                if (delta >= threshold) {
                    found.push({
                        dimension: dimension.id,
                        delta,
                        models: [present[left].modelId, present[right].modelId],
                        values: [present[left].slot.value, present[right].slot.value]
                    });
                }
            }
        }
    }
    return found;
}

export async function runBenchmark(options = {}) {
    const corpus = options.corpus || [...CORPUS, ...PROBES];
    const models = options.models || runnableModels();
    const now = options.now || (() => performance.now());
    const memory = options.memory || (() => null);
    const teacher = options.teacher || hostedTeacher;
    const env = options.env || {};
    const passages = [];
    const totals = Object.fromEntries(models.map(model => [model.id, 0]));

    for (const passage of corpus) {
        const outputs = [];
        for (const model of models) {
            const before = memory();
            const start = now();
            const state = model.encode(passage.text, passage.id);
            const recorded = state.measurements?.ms;
            const ms = typeof recorded === 'number' ? recorded : now() - start;
            totals[model.id] += ms;
            outputs.push({
                modelId: model.id,
                role: model.role,
                parameters: model.parameters,
                trained: model.trained === true,
                ms,
                memoryBefore: before,
                confidence: meanConfidence(state),
                state
            });
        }
        const judged = options.skipTeacher ? null : await teacher(passage, env);
        const taught = teacherOutput(judged);
        if (taught) outputs.push(taught);
        passages.push({
            id: passage.id,
            origin: passage.origin || 'rise-archive',
            provenance: passage.provenance,
            text: passage.text,
            outputs,
            disagreements: disagreements(outputs),
            teacher: judged
        });
    }

    return {
        version: 1,
        passages,
        models: [
            ...models.map(model => ({
                id: model.id,
                role: model.role,
                parameters: model.parameters,
                trained: model.trained === true,
                available: true,
                totalMs: totals[model.id]
            })),
            ...unavailableModels()
        ]
    };
}
