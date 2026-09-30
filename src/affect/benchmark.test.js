import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORPUS, PROBES, REQUIRED_CASES } from './benchmark/corpus.js';
import { mapPert } from './benchmark/external.js';
import { renderReport, runBenchmark } from './index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function archiveText(path) {
    return readFileSync(join(ROOT, path), 'utf8')
        .replace(/\\n/g, ' ')
        .replace(/\s+/gu, ' ');
}

describe('RISE affect benchmark', () => {
    it('quotes passages that the archive modules still contain', () => {
        const cases = new Set();
        expect(CORPUS.length).toBeGreaterThanOrEqual(20);
        for (const passage of CORPUS) {
            const held = archiveText(passage.provenance.archivePath);
            const needle = passage.text.replace(/\s+/gu, ' ');
            expect(held, passage.id).toContain(needle);
            for (const item of passage.provenance.cases) cases.add(item);
        }
        for (const required of REQUIRED_CASES) expect(cases.has(required)).toBe(true);
        expect(PROBES[0].origin).toBe('constructed-probe');
    });

    it('records model outputs and a negation disagreement', async () => {
        const result = await runBenchmark({ env: {} });
        const probe = result.passages.find(passage => passage.id === 'probe-negation');
        expect(probe.disagreements.some(item => item.dimension === 'valence' && item.delta > 0.5)).toBe(true);
        expect(probe.teacher.status).toBe('unavailable');
        expect(probe.teacher.reason).toMatch(/No hosted model was called/);
        const crime = result.passages.find(passage => passage.id === 'crime-question');
        const neutral = result.passages.find(passage => passage.id === 'vitruvius-order');
        const tension = (passage) => passage.outputs
            .find(output => output.modelId === 'contextual-window-v1')
            .state.dimensions.tension.value;
        expect(tension(crime)).toBeGreaterThan(tension(neutral));
        const paradise = result.passages.find(passage => passage.id === 'paradise-woe');
        const whitman = result.passages.find(passage => passage.id === 'whitman-celebrate');
        const valence = (passage) => passage.outputs
            .find(output => output.modelId === 'contextual-window-v1')
            .state.dimensions.valence.value;
        expect(valence(paradise)).toBeLessThan(0);
        expect(valence(whitman)).toBeGreaterThan(0);
        for (const passage of result.passages) {
            const contextual = passage.outputs.find(output => output.modelId === 'contextual-window-v1');
            for (const slot of Object.values(contextual.state.dimensions)) {
                expect(slot.confidence).toBeLessThanOrEqual(0.7);
            }
        }
        const report = renderReport(result);
        expect(report).toContain('## dickinson-death');
        expect(report).toContain('## austen-opening');
        expect(report).toContain('Disagreement');
        expect(report).toContain('pert-emopair');
        expect(report).toContain('minilm-l6-probe');
        expect(report).toContain('hosted-teacher: unavailable');
        const pert = (passage) => passage.outputs
            .find(output => output.modelId === 'pert-emopair')
            .state.dimensions.valence.value;
        expect(pert(paradise)).toBeLessThan(pert(whitman));
        expect(pert(paradise)).toBeLessThan(0);
        expect(pert(whitman)).toBeGreaterThan(0);
        const missing = result.models.filter(model => model.available === false);
        expect(missing).toEqual([]);
        expect(mapPert({ valence: 4.287, arousal: -0.474, dominance: -0.5 }).valence).toBeGreaterThan(0.5);
        expect(mapPert({ valence: 1.563, arousal: 0.758, dominance: -0.15 }).valence).toBeLessThan(0);
        expect(mapPert({ valence: 3, arousal: 0.758, dominance: 0 }).arousal)
            .toBeGreaterThan(mapPert({ valence: 3, arousal: -0.474, dominance: 0 }).arousal);
    });
});
