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

/**
 * SELECTION PROFILES — how a continuation is chosen once the context is
 * settled. Mateo's proposal, 2026-08-05, and it needs one correction
 * before it is useful.
 *
 * The proposal was: quoting is following the most probable path, so
 * discard the top path. Half of that is right and the half that is not
 * is the load-bearing half.
 *
 * **Where quoting actually happens there IS no second path.** A context
 * that reproduces its source has ONE continuation at probability 1 —
 * that is what makes it reproduce. Dropping the top leaves an empty
 * draw. Nothing chosen at that context can help, which is why the
 * entropy rule does not choose differently there: it backs off to a
 * SHORTER context and draws from a different distribution entirely.
 *
 * So rank selection does not replace the entropy rule. What it is —
 * and this is worth having for its own sake — is a different axis from
 * temperature. Temperature FLATTENS a distribution, making every option
 * more equal. Rank selection EXCLUDES BY POSITION, which is not the same
 * shape at all: `second` on a distribution of [0.7, 0.1, 0.1, 0.05,
 * 0.05] takes a 0.1 every time, where temperature 3 would still take the
 * 0.7 most often. One is a change of confidence; the other is a change
 * of intent — a deliberate refusal of the corpus's own grain.
 *
 * Each profile receives candidates sorted most-probable first and
 * returns weights. Returning all zeros means "no opinion" and the
 * natural distribution stands.
 */
export const PROFILES = {
    /** The corpus's own grain: weighted by what it actually does. */
    natural: (ranked) => ranked.map(c => c.p),

    /** Never the likeliest. The nearest honest reading of "discard top". */
    'drop-top': (ranked) => ranked.map((c, i) => (i === 0 && ranked.length > 1 ? 0 : c.p)),

    /** Always the runner-up, where there is one. */
    second: (ranked) => ranked.map((_, i) => (i === Math.min(1, ranked.length - 1) ? 1 : 0)),

    /** A fixed rank, clamped. `rank:10` in the CLI. */
    rank: (ranked, k = 2) => {
        const at = Math.min(Math.max(1, k) - 1, ranked.length - 1);
        return ranked.map((_, i) => (i === at ? 1 : 0));
    },

    /** Uniform over everything the context permits — probability ignored. */
    shuffle: (ranked) => ranked.map(() => 1),

    /** The least likely continuation the corpus ever made. */
    least: (ranked) => ranked.map((_, i) => (i === ranked.length - 1 ? 1 : 0)),

    /**
     * Inverted: improbable continuations get the weight. Not the same as
     * `least`, which is deterministic — this keeps a distribution and
     * merely turns it upside down, so the walk still varies.
     */
    anti: (ranked) => ranked.map(c => 1 - c.p),

    /** The middle of the distribution. Deterministic — see the warning. */
    median: (ranked) => {
        const at = Math.floor(ranked.length / 2);
        return ranked.map((_, i) => (i === at ? 1 : 0));
    },

    /**
     * SAMPLE FROM THE TAIL: everything from rank k downward, weighted
     * naturally. `tail:2` is `drop-top`; `tail:5` refuses the four most
     * probable continuations and lets the rest compete.
     *
     * THIS IS THE PROFILE THAT SURVIVES THE CYCLE PROBLEM, and it is the
     * honest form of "discard the top path". It keeps a DISTRIBUTION
     * rather than a position, so the walk stays stochastic and never
     * settles into a loop, while still refusing the corpus's grain.
     */
    tail: (ranked, k = 2) => {
        const from = Math.min(Math.max(1, k) - 1, ranked.length - 1);
        return ranked.map((c, i) => (i < from ? 0 : c.p));
    }
};

/**
 * ⚠ EVERY DETERMINISTIC PROFILE CYCLES, AND THAT IS A THEOREM.
 *
 * `second`, `rank:k`, `median` and `least` choose a POSITION rather than
 * a distribution, so the next token becomes a deterministic function of
 * the context. A deterministic map on a finite state space must
 * eventually revisit a state, and from there it repeats forever. It is
 * not a tuning problem and no corpus is large enough to escape it.
 *
 * Measured on four works at order 3, the walks fell into their limit
 * cycles within a few dozen tokens:
 *
 *     rank:5    "But this was thrilling." over and over
 *     rank:10   "I would embrace you? If an arrow" over and over
 *     least     "amours amours amours transgress amours"
 *     median    "decaying decaying decaying noiselessly"
 *
 * They are kept because the result is worth being able to reproduce, and
 * because a short deterministic run before the cycle closes is a
 * legitimate texture. For anything longer than a phrase, use `tail:k`.
 */
export const CYCLES = new Set(['second', 'rank', 'median', 'least']);

/** Resolve `'rank:10'`, a bare name, or a function. */
export function resolveProfile(profile) {
    if (typeof profile === 'function') return profile;
    const name = String(profile || 'natural');
    const [key, arg] = name.split(':');
    const fn = PROFILES[key];
    if (!fn) return PROFILES.natural;
    return arg === undefined ? fn : (ranked) => fn(ranked, Number(arg));
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
    profile = 'natural',
    start = null
} = {}) {
    const select = resolveProfile(profile);
    const numericSeed = typeof seed === 'number' ? seed : seedFrom(seed);
    const random = mulberry32(numericSeed);
    const { orders, order } = model;

    const out = [];
    const attribution = [];          // per emitted token: the works it could have come from
    const backoffs = [];             // where the chain refused to be deterministic
    const surprisal = [];
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
            chosen = sample(entry, random, temperature, bias, context, forbid, select);
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
        // Surprisal in bits: -log2 p under the model's OWN distribution,
        // so a profile can be compared against the corpus's grain rather
        // than against an opinion about it.
        surprisal.push(chosen.p > 0 ? -Math.log2(chosen.p) : 0);

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
        profile: typeof profile === 'function' ? 'custom' : String(profile),
        /** Mean bits of surprise per token, under the model's own model. */
        meanSurprisal: surprisal.length
            ? surprisal.reduce((a, b) => a + b, 0) / surprisal.length : 0,
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
function sample(entry, random, temperature, bias, context, forbid = null, select = null) {
    let tokens = [...entry.next.keys()];
    if (forbid) {
        tokens = tokens.filter((token) => {
            const works = entry.works.get(token);
            return !(works && works.size === 1 && works.has(forbid));
        });
        if (!tokens.length) return null;
    }
    // Ranked most-probable first, which is the order a profile expects.
    const ranked = tokens
        .map(token => ({ token, p: entry.next.get(token) / entry.total }))
        .sort((a, b) => b.p - a.p);

    // THE PROFILE CHOOSES THE SHAPE; temperature and bias then act on
    // whatever it produced. The order matters: applying temperature
    // first and a rank profile second would let temperature reorder the
    // ranks it was about to select from.
    let shape = select ? select(ranked) : ranked.map(c => c.p);
    if (!Array.isArray(shape) || shape.length !== ranked.length) shape = ranked.map(c => c.p);
    if (!shape.some(w => w > 0)) shape = ranked.map(c => c.p);

    const weights = ranked.map((c, i) => {
        const w = Math.max(0, Number(shape[i]) || 0);
        const shaped = temperature === 1 ? w : Math.pow(w, 1 / Math.max(0.01, temperature));
        const factor = bias ? Math.max(0, Number(bias(c.token, context)) || 0) : 1;
        return shaped * factor;
    });

    let total = weights.reduce((a, b) => a + b, 0);
    // A bias that zeroes everything is a bias that said nothing; fall
    // back to the natural distribution rather than emitting silence.
    if (!(total > 0)) {
        for (let i = 0; i < ranked.length; i++) weights[i] = ranked[i].p;
        total = weights.reduce((a, b) => a + b, 0);
    }
    if (!(total > 0)) return null;

    let r = random() * total;
    for (let i = 0; i < ranked.length; i++) {
        r -= weights[i];
        if (r <= 0) {
            const token = ranked[i].token;
            return { token, works: entry.works.get(token) || new Set(), p: ranked[i].p };
        }
    }
    const last = ranked[ranked.length - 1];
    return { token: last.token, works: entry.works.get(last.token) || new Set(), p: last.p };
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
