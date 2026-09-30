/**
 * Execute the RISE affect benchmark and write the inspection report.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, runBenchmark } from '../../src/affect/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const result = await runBenchmark({
    env: process.env,
    memory: () => process.memoryUsage()
});
const report = renderReport(result);
writeFileSync(join(root, 'docs/affect/BENCHMARK.md'), `${report}\n`);
const summary = {
    passages: result.passages.length,
    models: result.models.map(model => ({
        id: model.id,
        available: model.available !== false,
        totalMs: model.totalMs ?? null,
        parameters: model.parameters ?? null,
        reason: model.reason ?? null
    })),
    disagreements: result.passages.reduce((sum, passage) => sum + passage.disagreements.length, 0),
    teacher: result.passages[0]?.teacher?.status ?? null
};
writeFileSync(join(root, 'docs/affect/benchmark-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
