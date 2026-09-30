/**
 * Write an affect brief and the prompt that asks a model to return a program.
 *
 * Usage: node scripts/affect/export-brief.mjs TEXTFILE OUTDIR
 *
 * The text file is hashed as read. A passage-level EmoPair score is attached
 * only when that exact text is one of the benchmark passages.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPUS, PROBES } from '../../src/affect/benchmark/corpus.js';
import { affectProgramPrompt, buildAffectBrief, passageProposalsFor } from '../../src/affect/brief.js';

const [textPath, outDir] = process.argv.slice(2);
if (!textPath || !outDir) {
    console.error('Usage: node scripts/affect/export-brief.mjs TEXTFILE OUTDIR');
    process.exitCode = 2;
} else {
    const text = readFileSync(textPath, 'utf8');
    const scoresPath = new URL('../../docs/affect/emopair-scores.json', import.meta.url);
    let scores = { models: {} };
    try {
        scores = JSON.parse(readFileSync(scoresPath, 'utf8'));
    } catch {
        scores = { models: {} };
    }
    const catalog = [];
    for (const passage of [...CORPUS, ...PROBES]) {
        if (passage.text !== text) continue;
        for (const model of Object.values(scores.models || {})) {
            const row = model.passages?.find(item => item.id === passage.id);
            if (!row?.raw) continue;
            catalog.push({ text: passage.text, modelId: model.modelId, raw: row.raw });
        }
    }
    const brief = buildAffectBrief(text, { passageProposals: passageProposalsFor(text, catalog) });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'affect-brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
    writeFileSync(join(outDir, 'affect-prompt.md'), `${affectProgramPrompt()}\n`);
    console.log(JSON.stringify({
        outDir,
        phrases: brief.phrases.length,
        passageProposals: brief.passageProposals.length
    }));
}
