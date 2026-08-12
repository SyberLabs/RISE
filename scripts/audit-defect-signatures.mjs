/**
 * Run every known defect signature against every shelved work.
 *
 *   node scripts/audit-defect-signatures.mjs           report
 *   node scripts/audit-defect-signatures.mjs --write   commit the artifact
 *
 * This is the recursive half of the cleansing. `defect-signatures.js` records
 * what each finding taught us; this asks the whole shelf that question again.
 * Adding one entry there re-interrogates 16.3 million words here, which is the
 * only way a defect found in one work becomes knowledge about ninety.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFECT_SIGNATURES } from '../src/content/archive/defect-signatures.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKS = join(HERE, '..', 'src', 'content', 'archive', 'works');
const ARTIFACT = join(HERE, '..', 'src', 'content', 'archive', 'defect-report.json');

/** Withheld works keep their payloads; a report about the live shelf must not include them. */
function withheldIds() {
    const source = readFileSync(join(HERE, '..', 'src', 'content', 'archive', 'index.js'), 'utf8');
    const block = /const WITHHELD = Object\.freeze\(\{([\s\S]*?)\}\)/u.exec(source);
    if (!block) return new Set();
    return new Set([...block[1].matchAll(/'([^']+)'\s*:/gu)].map(match => match[1]));
}

const withheld = withheldIds();
const counts = new Map(DEFECT_SIGNATURES.map(signature => [signature.id, 0]));
const worksHit = new Map(DEFECT_SIGNATURES.map(signature => [signature.id, new Set()]));
const samples = new Map(DEFECT_SIGNATURES.map(signature => [signature.id, []]));

for (const file of readdirSync(WORKS).filter(name => name.endsWith('.js'))) {
    const id = file.replace(/\.js$/u, '');
    if (withheld.has(id)) continue;
    const module = await import(pathToFileURL(join(WORKS, file)).href);
    const sections = Object.values(module).find(value => Array.isArray(value));
    if (!sections) continue;

    for (const section of sections) {
        const lines = String(section?.content || '').split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            for (const signature of DEFECT_SIGNATURES) {
                if (signature.exemptWorks?.includes(id)) continue;
                if (!signature.pattern.test(line)) continue;
                counts.set(signature.id, counts.get(signature.id) + 1);
                worksHit.get(signature.id).add(id);
                const kept = samples.get(signature.id);
                if (kept.length < 4) kept.push({ work: id, line: line.trim().slice(0, 110) });
            }
        }
    }
}

const rows = DEFECT_SIGNATURES.map(signature => ({
    id: signature.id,
    disposition: signature.disposition,
    lines: counts.get(signature.id),
    works: [...worksHit.get(signature.id)].sort(),
    discoveredIn: signature.discoveredIn,
    samples: samples.get(signature.id)
})).sort((left, right) => right.lines - left.lines);

for (const row of rows) {
    console.log(`\n${row.lines.toString().padStart(6)} lines · ${row.works.length} works · [${row.disposition}] ${row.id}`);
    if (!row.lines) {
        console.log(`         clean — kept so a future acquisition cannot repeat ${row.discoveredIn}`);
        continue;
    }
    console.log(`         ${row.works.slice(0, 8).join(', ')}${row.works.length > 8 ? ', …' : ''}`);
    for (const sample of row.samples.slice(0, 2)) {
        console.log(`         ${sample.work}: ${JSON.stringify(sample.line)}`);
    }
}

if (process.argv.includes('--write')) {
    writeFileSync(ARTIFACT, `${JSON.stringify({
        generatedBy: 'scripts/audit-defect-signatures.mjs',
        signatures: rows.map(({ samples: _samples, ...rest }) => rest)
    }, null, 2)}\n`, 'utf8');
    console.log(`\nwrote ${ARTIFACT}`);
}
