/**
 * RISE Chain — the stochastic text lane.
 *
 * `EXPERIENCE-PROGRAM-SPEC` §9. A variable-order Markov chain over the
 * Archive, built so that the three things the spec demands are properties
 * of the MODEL rather than filters bolted on afterwards:
 *
 *   1. it never presents a recomposition as a passage from a source;
 *   2. its genealogy stays inspectable — per-fragment attribution, seed;
 *   3. its transition probabilities can be CONDITIONED, because §9's
 *      coupled organism runs `… → alters transition probabilities →
 *      conditions the next phrase`.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY VARIABLE ORDER, AND WHY THAT IS THE SAME THING AS NOT QUOTING
 * ─────────────────────────────────────────────────────────────────────
 * A fixed order-3 chain over a large corpus does not "sometimes" quote.
 * It quotes whenever the context is deterministic — and in natural text
 * most trigrams have exactly one continuation, so an order-3 walk spends
 * most of its life copying a source verbatim. Raising the order makes
 * this strictly worse: at order 5 the chain is a photocopier.
 *
 * That is not a filtering problem to solve after generation. It is the
 * model telling you something true: **a deterministic context carries no
 * information.** When the distribution over continuations has zero
 * entropy, following it is transcription, not composition.
 *
 * So the chain measures the entropy of the context it is standing in,
 * and BACKS OFF to a shorter context when the distribution collapses.
 * Shorter contexts have more continuations, so the walk diverges exactly
 * where it was about to copy. The ethical constraint and the information
 * theory are the same constraint, which is why it is implemented once.
 *
 * A hard verbatim ceiling backs it up — `maxVerbatim` — because backoff
 * is a tendency and a promise should be a bound.
 */

/**
 * Seeded PRNG (mulberry32). §9 requires the seed to be recoverable
 * afterwards, "like retrieving a dream's source material", so the walk
 * must be reproducible from it alone.
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A stable 32-bit hash, for turning a text seed into a numeric one. */
export function seedFrom(text) {
    let h = 2166136261 >>> 0;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/**
 * Tokenise into words and the punctuation that shapes a line.
 *
 * Punctuation is kept as its own token rather than glued to a word: the
 * chain then learns where sentences end, which is most of what makes
 * generated prose readable. Discarding it produces an endless run-on.
 */
export function tokenize(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .match(/[A-Za-z][A-Za-z'’-]*|[.,;:!?—–]/g) || [];
}

/**
 * The separator that joins context tokens into a key.
 *
 * A NUL rather than a space, because a token can never contain one — a
 * space separator would let "the sea" and a hypothetical single token
 * "the sea" collide. WRITTEN AS AN ESCAPE, not as the byte: the raw
 * character is invisible in every editor and in git diff, which cost
 * this project two sessions once already (see src/core/source-hygiene).
 * The guard for that caught this line.
 */
const KEY = '\u0000';

/**
 * Build a variable-order model.
 *
 * @param {Array<{workId: string, text: string}>} sources
 * @param {Object} [options]
 *   - order: highest context length kept (default 3)
 * @returns {{orders: Array<Map>, order: number, tokens: number, works: Set}}
 */
export function train(sources, { order = 3 } = {}) {
    // orders[k] maps a k-token context to { total, next: Map(token → count),
    // works: Map(token → Set(workId)) }. Attribution is per TRANSITION,
    // not per token, because that is what a genealogy needs: not "this
    // word appears in Moby-Dick" but "this JOIN came from Moby-Dick".
    const orders = Array.from({ length: order + 1 }, () => new Map());
    const works = new Set();
    let tokens = 0;

    for (const source of sources) {
        const workId = source.workId || 'unknown';
        works.add(workId);
        const t = Array.isArray(source.tokens) ? source.tokens : tokenize(source.text);
        tokens += t.length;

        for (let i = 0; i < t.length; i++) {
            for (let k = 0; k <= order; k++) {
                if (i - k < 0) continue;
                const context = k === 0 ? '' : t.slice(i - k, i).join(KEY);
                const table = orders[k];
                let entry = table.get(context);
                if (!entry) {
                    entry = { total: 0, next: new Map(), works: new Map() };
                    table.set(context, entry);
                }
                entry.total += 1;
                entry.next.set(t[i], (entry.next.get(t[i]) || 0) + 1);
                let w = entry.works.get(t[i]);
                if (!w) { w = new Set(); entry.works.set(t[i], w); }
                w.add(workId);
            }
        }
    }

    return { orders, order, tokens, works };
}

/** Shannon entropy of a context's continuation distribution, in bits. */
export function entropyOf(entry) {
    if (!entry || !entry.total) return 0;
    let h = 0;
    for (const count of entry.next.values()) {
        const p = count / entry.total;
        h -= p * Math.log2(p);
    }
    return h;
}

/**
 * Generate.
 *
 * @param {Object} model - from train()
 * @param {Object} [options]
 *   - length: tokens to emit
 *   - seed: number or string; recorded so the walk can be replayed
 *   - temperature: >1 flattens the distribution, <1 sharpens it
 *   - minEntropy: bits below which a context is considered deterministic
 *     and the chain backs off to a shorter one
 *   - maxVerbatim: hard ceiling on consecutive tokens taken from a single
 *     work; the promise behind "not a quotation"
 *   - bias: (token, context) → multiplier. THE HOOK §9's coupled organism
 *     needs — the visual and acoustic state condition the next phrase by
 *     reweighting transitions, not by editing the output.
 */
export function generate(model, {
    length = 120,
    seed = 1,
    temperature = 1,
    minEntropy = 0.35,
    maxVerbatim = 7,
    bias = null,
    start = null
} = {}) {
    const numericSeed = typeof seed === 'number' ? seed : seedFrom(seed);
    const random = mulberry32(numericSeed);
    const { orders, order } = model;

    const out = [];
    const attribution = [];          // per emitted token: the works it could have come from
    const backoffs = [];             // where the chain refused to be deterministic
    let run = { workId: null, length: 0 };
    let longestRun = 0;

    if (start) out.push(...(Array.isArray(start) ? start : tokenize(start)));

    for (let i = out.length; i < length; i++) {
        let chosen = null;
        let usedOrder = -1;

        // Walk down from the longest context we have.
        for (let k = Math.min(order, out.length); k >= 0; k--) {
            const context = k === 0 ? '' : out.slice(out.length - k).join(KEY);
            const entry = orders[k].get(context);
            if (!entry || !entry.total) continue;

            // A DETERMINISTIC CONTEXT IS A QUOTATION IN PROGRESS. Back off
            // rather than follow it — unless we are already at order 0,
            // where there is nowhere left to go.
            if (k > 0 && entropyOf(entry) < minEntropy) {
                backoffs.push({ at: i, order: k, reason: 'entropy' });
                continue;
            }

            // THE CEILING IS A CONSTRAINT ON THE TOKEN, NOT ON THE ORDER.
            // Backing off to a shorter context was the first attempt and
            // it does not bound anything: order 0 is unguarded by
            // construction — there is nowhere below it — so the walk
            // dropped to order 0 and carried the same work one token
            // further. A bound enforced by preference is not a bound.
            // When a work has held the pen too long, the tokens ONLY it
            // could have produced are excluded from the draw.
            const forbid = run.length >= maxVerbatim ? run.workId : null;
            chosen = sample(entry, random, temperature, bias, context, forbid);
            if (!chosen) {
                backoffs.push({ at: i, order: k, reason: 'verbatim' });
                continue;
            }
            usedOrder = k;
            break;
        }

        if (!chosen) break;
        out.push(chosen.token);
        attribution.push({ token: chosen.token, order: usedOrder, works: [...chosen.works] });

        // A run continues only while ONE work could have produced every
        // step of it. The moment two works could, it is no longer anyone's
        // sentence.
        if (chosen.works.size === 1) {
            const only = [...chosen.works][0];
            run = only === run.workId ? { workId: only, length: run.length + 1 } : { workId: only, length: 1 };
        } else {
            run = { workId: null, length: 0 };
        }
        longestRun = Math.max(longestRun, run.length);
    }

    return {
        tokens: out,
        text: detokenize(out),
        seed: numericSeed,
        attribution,
        backoffs,
        longestVerbatimRun: longestRun,
        /** §9's required boundary. Not optional, and not the caller's to compose. */
        notice: 'Generated from selected Archive sources. This text is a stochastic '
            + 'recomposition, not a quotation.'
    };
}

/**
 * Weighted choice, with temperature, an optional external bias, and an
 * optional excluded work.
 *
 * `forbid` removes every continuation that ONLY the named work could
 * have produced. A token several works share is not that work's
 * property and stays in the draw — which is the point: the run ends
 * because the text stopped being one book's, not because a counter
 * reached a number.
 *
 * Returns null when nothing survives, so the caller can try a shorter
 * context rather than emit something it excluded.
 */
function sample(entry, random, temperature, bias, context, forbid = null) {
    let tokens = [...entry.next.keys()];
    if (forbid) {
        tokens = tokens.filter((token) => {
            const works = entry.works.get(token);
            return !(works && works.size === 1 && works.has(forbid));
        });
        if (!tokens.length) return null;
    }
    const weights = tokens.map((token) => {
        const p = entry.next.get(token) / entry.total;
        const shaped = temperature === 1 ? p : Math.pow(p, 1 / Math.max(0.01, temperature));
        const factor = bias ? Math.max(0, Number(bias(token, context)) || 0) : 1;
        return shaped * factor;
    });

    let total = weights.reduce((a, b) => a + b, 0);
    // A bias that zeroes everything is a bias that said nothing; fall
    // back to the unbiased distribution rather than emitting silence.
    if (!(total > 0)) {
        for (let i = 0; i < tokens.length; i++) weights[i] = entry.next.get(tokens[i]) / entry.total;
        total = weights.reduce((a, b) => a + b, 0);
    }
    if (!(total > 0)) return null;

    let r = random() * total;
    for (let i = 0; i < tokens.length; i++) {
        r -= weights[i];
        if (r <= 0) return { token: tokens[i], works: entry.works.get(tokens[i]) || new Set() };
    }
    const last = tokens[tokens.length - 1];
    return { token: last, works: entry.works.get(last) || new Set() };
}

/** Rejoin tokens into readable prose. */
export function detokenize(tokens) {
    let out = '';
    for (const token of tokens) {
        if (/^[.,;:!?—–]$/.test(token)) out += token;
        else out += (out ? ' ' : '') + token;
    }
    return out.trim();
}

/**
 * The genealogy of a generated passage: which works contributed, and how
 * much. §9 wants this inspectable but NOT displayed continuously —
 * "reveal it afterwards, like retrieving a dream's source material".
 */
export function genealogy(result) {
    const counts = new Map();
    for (const step of result.attribution || []) {
        // A step that could have come from four works credits each a
        // quarter. Crediting all four fully would let one ambiguous
        // token inflate every source it touched.
        const share = 1 / Math.max(1, step.works.length);
        for (const workId of step.works) {
            counts.set(workId, (counts.get(workId) || 0) + share);
        }
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
    return [...counts.entries()]
        .map(([workId, weight]) => ({ workId, weight, share: weight / total }))
        .sort((a, b) => b.weight - a.weight);
}
