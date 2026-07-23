/**
 * Curia dev-write plugin.
 *
 * Dev-server-only endpoint that lets the Curia (the in-app curation
 * surface) persist edits straight into the curation canon,
 * src/sources/visual/museum-pins.js. Production builds never include
 * this — there the Curia degrades to changeset export.
 *
 * The write path is regenerate-not-splice: the current file is parsed
 * into a model (header comment, pin arrays with their trailing
 * comments, exclusion lists), the changeset is applied to the model,
 * and the whole file is re-emitted. No regex surgery on live code.
 *
 * Changeset shape (POST /__curia/apply, JSON):
 * {
 *   exclude:    [{ category, source: 'aic', id }],          // live-search cut
 *   unexclude:  [{ category, id }],
 *   addPin:     [{ category, source, id, note }],
 *   removePin:  [{ category, source, id }],
 *   movePin:    [{ from, to, source, id }]
 * }
 */

import fs from 'fs';
import path from 'path';

const PINS_PATH = path.resolve('src/sources/visual/museum-pins.js');

export function parsePinsFile(text) {
    const lines = text.split(/\r?\n/);
    const headerEnd = lines.findIndex(l => l.startsWith('export const MUSEUM_CATEGORY_PINS'));
    const header = lines.slice(0, headerEnd).join('\n');

    const pins = {};   // category -> [{ source, id, note }]
    const order = [];  // category order as written
    let current = null;
    let inExclusions = false;
    const exclusions = {};
    const exclusionOrder = [];

    for (const line of lines.slice(headerEnd)) {
        if (/^export const CATEGORY_EXCLUSIONS/.test(line)) {
            inExclusions = true;
            current = null;
            continue;
        }
        if (inExclusions) {
            // exclusion entries are inline number arrays, one per line
            const exclInline = line.match(/^\s{4}"([a-z]+)":\s*\[([^\]]*)\]/);
            if (exclInline) {
                exclusions[exclInline[1]] = exclInline[2]
                    .split(',').map(s => Number(s.trim())).filter(Number.isFinite);
                if (!exclusionOrder.includes(exclInline[1])) exclusionOrder.push(exclInline[1]);
            }
            continue;
        }
        const catMatch = line.match(/^\s{4}"([a-z]+)":\s*\[/);
        if (catMatch) {
            current = catMatch[1];
            pins[current] = [];
            order.push(current);
            continue;
        }
        const pinMatch = line.match(
            /^\s{8}\{\s*source:\s*"([a-z]+)",\s*id:\s*(\d+)\s*\},?\s*(?:\/\/\s*(.*))?$/);
        if (pinMatch && current) {
            pins[current].push({
                source: pinMatch[1],
                id: Number(pinMatch[2]),
                note: (pinMatch[3] || '').trim()
            });
        }
    }
    return { header, pins, order, exclusions, exclusionOrder };
}

export function emitPinsFile(model) {
    const out = [model.header];
    out.push('export const MUSEUM_CATEGORY_PINS = Object.freeze({');
    model.order.forEach((cat, ci) => {
        out.push(`    "${cat}": [`);
        for (const p of model.pins[cat]) {
            const note = p.note ? `  // ${p.note}` : '';
            out.push(`        { source: "${p.source}", id: ${p.id} },${note}`);
        }
        out.push(ci === model.order.length - 1 ? '    ]' : '    ],');
    });
    out.push('});');
    out.push('');
    out.push('// Works excluded from LIVE-SEARCH categories by contact-sheet audit');
    out.push("// (the creator's hand on every card). Live results cannot be cut by");
    out.push('// omission — search re-serves them — so exclusions bake into the');
    out.push('// query as must_not id terms. This object shares the pin file so the');
    out.push('// Curia owns ONE machine-writable curation canon.');
    out.push('export const CATEGORY_EXCLUSIONS = Object.freeze({');
    const excCats = model.exclusionOrder.filter(c => (model.exclusions[c] || []).length > 0);
    excCats.forEach((cat, ci) => {
        const tail = ci === excCats.length - 1 ? '' : ',';
        out.push(`    "${cat}": [${model.exclusions[cat].join(', ')}]${tail}`);
    });
    out.push('});');
    out.push('');
    return out.join('\n');
}

export function applyChangeset(model, changeset) {
    const applied = { exclude: 0, unexclude: 0, addPin: 0, removePin: 0, movePin: 0 };
    const ensureExclusionCat = (cat) => {
        if (!model.exclusions[cat]) {
            model.exclusions[cat] = [];
            model.exclusionOrder.push(cat);
        }
    };
    const ensurePinCat = (cat) => {
        if (!model.pins[cat]) {
            model.pins[cat] = [];
            model.order.push(cat);
        }
    };
    for (const e of changeset.exclude || []) {
        ensureExclusionCat(e.category);
        const id = Number(e.id);
        if (!model.exclusions[e.category].includes(id)) {
            model.exclusions[e.category].push(id);
            applied.exclude++;
        }
    }
    for (const e of changeset.unexclude || []) {
        const list = model.exclusions[e.category];
        if (!list) continue;
        const i = list.indexOf(Number(e.id));
        if (i >= 0) { list.splice(i, 1); applied.unexclude++; }
    }
    for (const a of changeset.addPin || []) {
        ensurePinCat(a.category);
        const exists = model.pins[a.category]
            .some(p => p.source === a.source && p.id === Number(a.id));
        if (!exists) {
            model.pins[a.category].push({
                source: a.source, id: Number(a.id), note: (a.note || '').slice(0, 60)
            });
            applied.addPin++;
        }
    }
    for (const r of changeset.removePin || []) {
        const list = model.pins[r.category];
        if (!list) continue;
        const i = list.findIndex(p => p.source === r.source && p.id === Number(r.id));
        if (i >= 0) { list.splice(i, 1); applied.removePin++; }
    }
    for (const m of changeset.movePin || []) {
        const from = model.pins[m.from];
        if (!from) continue;
        const i = from.findIndex(p => p.source === m.source && p.id === Number(m.id));
        if (i < 0) continue;
        const [pin] = from.splice(i, 1);
        ensurePinCat(m.to);
        if (!model.pins[m.to].some(p => p.source === pin.source && p.id === pin.id)) {
            model.pins[m.to].push(pin);
        }
        applied.movePin++;
    }
    return applied;
}

export function curiaPlugin() {
    return {
        name: 'curia-dev-write',
        apply: 'serve', // dev server only — never in a build
        configureServer(server) {
            server.middlewares.use('/__curia/apply', (req, res) => {
                if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const changeset = JSON.parse(body);
                        const text = fs.readFileSync(PINS_PATH, 'utf8');
                        const model = parsePinsFile(text);
                        const applied = applyChangeset(model, changeset);
                        fs.writeFileSync(PINS_PATH, emitPinsFile(model));
                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ ok: true, applied }));
                    } catch (e) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ ok: false, error: String(e.message) }));
                    }
                });
            });
        }
    };
}
