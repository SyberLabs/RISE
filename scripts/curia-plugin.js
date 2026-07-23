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

    const liveSearch = {};
    let inLiveSearch = false;
    for (const line of lines.slice(headerEnd)) {
        if (/^export const LIVE_SEARCH_ENABLED/.test(line)) {
            inLiveSearch = true;
            current = null;
            continue;
        }
        if (inLiveSearch) {
            const flag = line.match(/^\s{4}"([a-z]+)":\s*(true|false)/);
            if (flag) liveSearch[flag[1]] = flag[2] === 'true';
            if (/^\}\);/.test(line)) inLiveSearch = false;
            continue;
        }
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
    return { header, pins, order, exclusions, exclusionOrder, liveSearch };
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
    out.push('// LIVE-AIC search per category — canon-governed, default OFF. The');
    out.push('// creator judged the pinned canon (with every AIC survivor of the');
    out.push('// full audit promoted to a pin) superior to what live search adds;');
    out.push('// a category flipped true serves clauses UNION pins as before. The');
    out.push("// Curia's toggle writes this object.");
    out.push('export const LIVE_SEARCH_ENABLED = Object.freeze({');
    const liveCats = Object.entries(model.liveSearch || {}).filter(([, v]) => v === true);
    liveCats.forEach(([cat], ci) => {
        out.push(`    "${cat}": true${ci === liveCats.length - 1 ? '' : ','}`);
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
    for (const t of changeset.setLiveSearch || []) {
        model.liveSearch = model.liveSearch || {};
        model.liveSearch[t.category] = t.enabled === true;
        applied.setLiveSearch = (applied.setLiveSearch || 0) + 1;
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

const KNOWN_SOURCES = new Set(['aic', 'rijks', 'cleveland', 'met', 'commons']);
const CHANGE_VERBS = ['exclude', 'unexclude', 'addPin', 'removePin', 'movePin', 'setLiveSearch'];
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Validate an incoming changeset against the parsed model. Throws with
 * a human-readable reason on the first violation. Category names must
 * already exist in the canon (the Curia offers no category creation);
 * ids must be finite positive integers; notes are flattened to one
 * line.
 */
export function validateChangeset(changeset, model) {
    if (!changeset || typeof changeset !== 'object') throw new Error('changeset is not an object');
    const knownCats = new Set([...model.order, ...model.exclusionOrder]);
    const checkCat = (cat, where) => {
        if (typeof cat !== 'string' || !knownCats.has(cat)) {
            throw new Error(`${where}: unknown category '${cat}'`);
        }
    };
    const checkId = (id, where) => {
        const n = Number(id);
        if (!Number.isInteger(n) || n <= 0) throw new Error(`${where}: invalid id '${id}'`);
    };
    for (const key of Object.keys(changeset)) {
        if (!CHANGE_VERBS.includes(key)) throw new Error(`unknown verb '${key}'`);
        if (!Array.isArray(changeset[key])) throw new Error(`verb '${key}' is not an array`);
    }
    for (const e of changeset.exclude || []) { checkCat(e.category, 'exclude'); checkId(e.id, 'exclude'); }
    for (const e of changeset.unexclude || []) { checkCat(e.category, 'unexclude'); checkId(e.id, 'unexclude'); }
    for (const a of changeset.addPin || []) {
        checkCat(a.category, 'addPin'); checkId(a.id, 'addPin');
        if (!KNOWN_SOURCES.has(a.source)) throw new Error(`addPin: unknown source '${a.source}'`);
        if (a.note != null) a.note = String(a.note).replace(/[\r\n]+/g, ' ').slice(0, 60);
    }
    for (const r of changeset.removePin || []) {
        checkCat(r.category, 'removePin'); checkId(r.id, 'removePin');
        if (!KNOWN_SOURCES.has(r.source)) throw new Error(`removePin: unknown source '${r.source}'`);
    }
    for (const m of changeset.movePin || []) {
        checkCat(m.from, 'movePin.from'); checkCat(m.to, 'movePin.to'); checkId(m.id, 'movePin');
        if (!KNOWN_SOURCES.has(m.source)) throw new Error(`movePin: unknown source '${m.source}'`);
    }
    for (const t of changeset.setLiveSearch || []) {
        checkCat(t.category, 'setLiveSearch');
        if (typeof t.enabled !== 'boolean') throw new Error('setLiveSearch: enabled must be boolean');
    }
}

/**
 * Semantic accounting of a model, for the pre/post-write comparison:
 * the emitted file must reparse to exactly the model we intended.
 */
export function modelCensus(model) {
    return JSON.stringify({
        pins: Object.fromEntries(Object.entries(model.pins).map(
            ([c, arr]) => [c, arr.map(p => `${p.source}:${p.id}`).sort()])),
        exclusions: Object.fromEntries(Object.entries(model.exclusions).map(
            ([c, arr]) => [c, [...arr].sort((a, b) => a - b)])),
        liveSearch: model.liveSearch || {}
    });
}

export function curiaPlugin() {
    return {
        name: 'curia-dev-write',
        apply: 'serve', // dev server only — never in a build
        configureServer(server) {
            server.middlewares.use('/__curia/apply', (req, res) => {
                if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
                let body = '';
                let overflow = false;
                req.on('data', chunk => {
                    body += chunk;
                    if (body.length > MAX_BODY_BYTES) { overflow = true; req.destroy(); }
                });
                req.on('end', () => {
                    if (overflow) { res.statusCode = 413; return res.end(); }
                    try {
                        // The Curia rewrites the visual canon: it behaves
                        // like a tiny migration system, not a text editor.
                        // validate → apply in memory → emit → REPARSE the
                        // candidate → compare semantics → backup → write
                        // to a temp file → atomic rename.
                        const changeset = JSON.parse(body);
                        const original = fs.readFileSync(PINS_PATH, 'utf8');
                        const model = parsePinsFile(original);
                        if (model.order.length === 0) {
                            throw new Error('refusing to write: parsed model holds no categories');
                        }
                        validateChangeset(changeset, model);
                        const applied = applyChangeset(model, changeset);

                        const candidate = emitPinsFile(model);
                        const reparsed = parsePinsFile(candidate);
                        if (modelCensus(reparsed) !== modelCensus(model)) {
                            throw new Error('refusing to write: candidate does not reparse to the intended model');
                        }

                        // Timestamped backup beside the canon, then an
                        // atomic temp+rename so a crash never leaves a
                        // half-written file
                        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const backupPath = `${PINS_PATH}.${stamp}.bak`;
                        fs.writeFileSync(backupPath, original);
                        const tmpPath = `${PINS_PATH}.tmp`;
                        fs.writeFileSync(tmpPath, candidate);
                        fs.renameSync(tmpPath, PINS_PATH);

                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ ok: true, applied, backup: path.basename(backupPath) }));
                    } catch (e) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ ok: false, error: String(e.message) }));
                    }
                });
            });
        }
    };
}
