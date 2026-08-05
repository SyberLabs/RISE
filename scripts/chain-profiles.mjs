/**
 * RISE Chain — compare selection profiles on the same corpus and seed.
 *
 *   npx vite-node scripts/chain-profiles.mjs
 *   npx vite-node scripts/chain-profiles.mjs --works moby-dick-or-the-whale,literary-walden
 *
 * Mateo's experiment, 2026-08-05: if quoting is following the corpus's
 * most probable path, what happens if we take the second path, the
 * tenth, a uniform shuffle, the least likely?
 *
 * The point of running them side by side on ONE seed is that the walks
 * are then comparable — same corpus, same random stream, only the
 * selection rule differs. Any difference in the numbers below is the
 * profile and nothing else.
 *
 * WHAT THE COLUMNS MEAN
 *   surprisal   mean bits of surprise per token under the model's OWN
 *               distribution. `natural` sits low by construction; a
 *               profile that refuses the corpus's grain sits high. This
 *               is the honest measure of "how far off the path".
 *   run         longest span of tokens only one work could have produced.
 *   backoff     how often the chain refused a deterministic context.
 *   bigram      share of adjacent pairs the corpus has actually seen — a
 *               crude readability proxy. High means it reads like
 *               language; low means it reads like a word salad.
 */
import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import { train, generate, tokenize, PROFILES } from '../src/chain/markov.js';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const order = Number(flag('order', '3'));
const length = Number(flag('length', '120'));
const seed = flag('seed', 'dream');
const budget = Number(flag('budget', '60000'));
const only = (flag('works') || '').split(',').map(s => s.trim()).filter(Boolean);
const show = Number(flag('show', '150'));

const texts = ingestedArchiveTexts().filter(t => !only.length || only.includes(t.id));
const sources = [];
for (const text of texts) {
    let sequences;
    try { sequences = await text.getSequences(); } catch { continue; }
    if (!Array.isArray(sequences) || !sequences.length) continue;
    const body = sequences.length > 2 ? sequences.slice(1, -1) : sequences;
    let taken = '';
    for (let i = Math.floor(body.length / 3); i < body.length && taken.length < budget; i++) {
        taken += ' ' + String(body[i].content || '');
    }
    const tokens = tokenize(taken);
    if (tokens.length < 200) continue;
    sources.push({ workId: text.id, tokens });
}

const model = train(sources, { order });
console.log(`${sources.length} works · ${model.tokens.toLocaleString()} tokens · order ${order} · seed "${seed}"\n`);

/**
 * The period of a limit cycle, or 0 if the walk is still moving.
 *
 * A deterministic selection rule must eventually revisit a state and
 * then repeat forever. Looking for a repeating suffix is how that shows
 * up in the output.
 */
function cycleLength(tokens) {
    const tail = tokens.slice(-Math.min(60, tokens.length));
    for (let period = 1; period <= Math.floor(tail.length / 3); period++) {
        let repeats = true;
        for (let i = tail.length - 1; i >= tail.length - period * 3; i--) {
            if (tail[i] !== tail[i - period]) { repeats = false; break; }
        }
        if (repeats) return period;
    }
    return 0;
}

/** Share of adjacent pairs the corpus has actually seen. */
function bigramFidelity(tokens) {
    if (tokens.length < 2) return 0;
    let seen = 0;
    for (let i = 1; i < tokens.length; i++) {
        const entry = model.orders[1].get(tokens[i - 1]);
        if (entry && entry.next.has(tokens[i])) seen++;
    }
    return seen / (tokens.length - 1);
}

const profiles = flag('profiles',
    'natural,drop-top,tail:3,tail:6,second,rank:5,median,shuffle,anti,least').split(',');
const rows = [];

for (const profile of profiles) {
    const result = generate(model, { seed, length, order, profile });
    rows.push({
        profile,
        surprisal: result.meanSurprisal,
        run: result.longestVerbatimRun,
        backoff: result.backoffs.length,
        bigram: bigramFidelity(result.tokens),
        // A walk that has entered a limit cycle repeats a window forever.
        // Reporting it is the difference between "this profile is strange"
        // and "this profile has stopped generating".
        cycle: cycleLength(result.tokens),
        text: result.text
    });
}

console.log('profile      surprisal   run  backoff  bigram   cycle');
console.log('─'.repeat(60));
for (const r of rows) {
    console.log(
        r.profile.padEnd(12)
        + r.surprisal.toFixed(2).padStart(9)
        + String(r.run).padStart(6)
        + String(r.backoff).padStart(9)
        + (r.bigram * 100).toFixed(0).padStart(7) + '%'
        + (r.cycle ? String(r.cycle).padStart(8) : '       —')
    );
}
console.log('');
console.log('cycle = length of the repeating window, if the walk has stopped generating.');

console.log('');
for (const r of rows) {
    console.log('─'.repeat(72));
    console.log(`${r.profile}`);
    console.log(r.text.slice(0, show) + (r.text.length > show ? '…' : ''));
    console.log('');
}

console.log('─'.repeat(72));
console.log('Generated from selected Archive sources. This text is a stochastic');
console.log('recomposition, not a quotation.');
