/**
 * Cached outputs from models that ran offline.
 *
 * The checkpoints are not imported by the player. A missing file is an
 * unavailable model, which is what the benchmark recorded before the
 * run. Mapped axes are only valence, arousal, and dominance: that is
 * what these checkpoints emit.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../hash.js';
import { clamp, experienceState, slot, unavailableState } from '../schema.js';

const SCORES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'affect', 'emopair-scores.json');
const PROBE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'affect', 'minilm-probe.json');

function readJson(path) {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * PERT valence is on the EmoBank 1–5 scale. Its arousal and dominance
 * heads are not: calibration sentences put a still room near arousal
 * -0.5 and fury near 0.8, while dominance stayed inside about -0.6..0.5.
 * Arousal is shifted from that operating range. Dominance is already
 * inside the bipolar range, so it is only clamped.
 */
export function mapPert(raw) {
    return {
        valence: clamp((raw.valence - 3) / 2, -1, 1),
        arousal: clamp((raw.arousal + 0.6) / 1.6, 0, 1),
        dominance: clamp(raw.dominance, -1, 1)
    };
}

/** Reward valence is a 1–5 regression. Arousal and dominance use the checkpoint's published norm. */
export function mapReward(raw, norm) {
    const unit = (value, key) => {
        const span = norm?.[key];
        if (!span) return value;
        return (value - span.min) / (span.max - span.min || 1);
    };
    return {
        valence: clamp((raw.valence - 3) / 2, -1, 1),
        arousal: clamp(unit(raw.arousal, 'arousal'), 0, 1),
        dominance: clamp(unit(raw.dominance, 'dominance') * 2 - 1, -1, 1)
    };
}

function vadState({ modelId, method, raw, mapped, ms, caveats, trained }) {
    return experienceState({
        modality: 'text',
        dimensions: {
            valence: slot(mapped.valence, 0.55, 'inferred'),
            arousal: slot(mapped.arousal, 0.55, 'inferred'),
            dominance: slot(mapped.dominance, 0.55, 'inferred')
        },
        measurements: {
            rawValence: raw?.valence,
            rawArousal: raw?.arousal,
            rawDominance: raw?.dominance,
            ms
        },
        caveats,
        provenance: {
            method,
            modelId,
            trained: trained ? 'true' : 'false',
            contentHash: contentHash(`${modelId}:${raw?.valence}:${raw?.arousal}:${raw?.dominance}`)
        }
    });
}

function indexPassages(model) {
    const map = new Map();
    for (const row of model?.passages || []) map.set(row.id, row);
    return map;
}

export function emopairModels(document = readJson(SCORES)) {
    if (!document?.models) {
        return [{
            id: 'emopair-family',
            role: 'external-candidate',
            available: false,
            parameters: null,
            reason: 'No EmoPair scores file is present. Published scores were not copied in as RISE results.'
        }];
    }
    const models = [];
    for (const [id, model] of Object.entries(document.models)) {
        if (model.status === 'unavailable' || !model.passages) {
            models.push({
                id,
                role: 'external-candidate',
                available: false,
                parameters: null,
                reason: model.reason || 'checkpoint did not score'
            });
            continue;
        }
        const byId = indexPassages(model);
        const mapNote = id === 'pert-emopair'
            ? 'pert-valence-emobank-arousal-operating-range'
            : 'reward-valence-emobank-ad-published-norm';
        models.push({
            id,
            role: 'external-candidate',
            available: true,
            parameters: 355_000_000,
            trained: true,
            encode(text, passageId) {
                const row = byId.get(passageId);
                if (!row) return unavailableState('text', 'passage-not-in-emopair-cache');
                const mapped = id === 'reward-emopair'
                    ? mapReward(row.raw, model.normParams)
                    : mapPert(row.raw);
                return vadState({
                    modelId: model.modelId,
                    method: `${id}:${row.id}`,
                    raw: row.raw,
                    mapped,
                    ms: row.ms,
                    trained: true,
                    caveats: ['offline-checkpoint', 'vad-only', mapNote, 'not-a-rise-human-norm']
                });
            }
        });
    }
    return models;
}

export function minilmModel(document = readJson(PROBE)) {
    if (!document?.passages) {
        return {
            id: 'minilm-distillation',
            role: 'external-candidate',
            available: false,
            parameters: null,
            reason: 'No MiniLM probe file is present. The readout was not fitted to invented labels.'
        };
    }
    const byId = new Map(document.passages.map(row => [row.id, row]));
    return {
        id: 'minilm-l6-probe',
        role: 'distilled-candidate',
        available: true,
        parameters: document.parameters ?? null,
        trained: true,
        encode(_text, passageId) {
            const row = byId.get(passageId);
            if (!row?.loo) return unavailableState('text', 'passage-not-in-minilm-probe');
            return vadState({
                modelId: document.modelId,
                method: 'minilm-l6-probe-loo',
                raw: row.loo,
                mapped: row.loo,
                trained: true,
                caveats: [
                    'leave-one-out-prediction',
                    'distilled-from-pert-emopair',
                    'vad-only',
                    document.caveat || 'twenty-four-passages'
                ].filter(Boolean)
            });
        }
    };
}

export function cachedEncoders() {
    return [...emopairModels(), minilmModel()];
}
