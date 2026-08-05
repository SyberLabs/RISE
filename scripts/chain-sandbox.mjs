/**
 * RISE Chain — the text lane, over the real Archive.
 *
 *   node scripts/chain-sandbox.mjs
 *   node scripts/chain-sandbox.mjs --works moby-dick,literary-walden --seed dream
 *   node scripts/chain-sandbox.mjs --order 3 --temperature 1.4 --length 160
 *
 * A sandbox, in the sense §9's build order means it: one lane, no
 * visuals, no audio, nothing wired into the Chamber. The point is to
 * hear what the corpus sounds like when it dreams, and to find out by
 * ear what the parameters do — which is not something a unit test can
 * tell you.
 *
 * It prints the genealogy afterwards rather than during, per §9:
 * "reveal it afterwards, like retrieving a dream's source material".
 */
import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import { train, generate, genealogy, tokenize } from '../src/chain/markov.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const order = Number(flag('order', '3'));
const length = Number(flag('length', '140'));
const temperature = Number(flag('temperature', '1'));
const minEntropy = Number(flag('minEntropy', '0.35'));
const maxVerbatim = Number(flag('maxVerbatim', '7'));
const seed = flag('seed', 'dream');
const passages = Number(flag('passages', '3'));
/** Characters taken per work. The whole shelf is 15.9M words; a dream
 *  does not need the complete inventory, and §9 says so explicitly. */
const budget = Number(flag('budget', '120000'));

const only = (flag('works') || '').split(',').map(s => s.trim()).filter(Boolean);

const texts = ingestedArchiveTexts()
    .filter(t => !only.length || only.includes(t.id));

if (!texts.length) {
    console.error(`No works matched --works ${only.join(',')}`);
    process.exit(1);
}

console.log(`training over ${texts.length} work${texts.length === 1 ? '' : 's'}…`);

const sources = [];
let totalTokens = 0;
for (const text of texts) {
    let sequences;
    try { sequences = await text.getSequences(); } catch { continue; }
    if (!Array.isArray(sequences) || !sequences.length) continue;

    // Take from the MIDDLE of the work. The opening of a scanned book is
    // title pages, dedications and tables of contents — front matter that
    // would teach the chain to dream in library catalogue.
    const body = sequences.length > 2 ? sequences.slice(1, -1) : sequences;
    let taken = '';
    for (let i = Math.floor(body.length / 3); i < body.length && taken.length < budget; i++) {
        taken += ' ' + String(body[i].content || '');
    }
    const tokens = tokenize(taken);
    if (tokens.length < 200) continue;
    totalTokens += tokens.length;
    sources.push({ workId: text.id, tokens });
}

const model = train(sources, { order });
console.log(`${sources.length} works · ${totalTokens.toLocaleString()} tokens · order ${order}`);
console.log(`contexts: ${model.orders.map((o, k) => `${k}:${o.size.toLocaleString()}`).join('  ')}`);
console.log('');

for (let p = 0; p < passages; p++) {
    const result = generate(model, {
        seed: `${seed}-${p}`, length, temperature, minEntropy, maxVerbatim
    });

    console.log('─'.repeat(72));
    console.log(result.text);
    console.log('');
    console.log(`seed ${result.seed}  ·  longest single-work run ${result.longestVerbatimRun}`
        + `  ·  backoffs ${result.backoffs.length}`
        + ` (entropy ${result.backoffs.filter(b => b.reason === 'entropy').length},`
        + ` verbatim ${result.backoffs.filter(b => b.reason === 'verbatim').length})`);

    // Afterwards, never during.
    const lines = genealogy(result).slice(0, 6);
    console.log('genealogy: ' + lines
        .map(l => `${l.workId} ${(l.share * 100).toFixed(0)}%`).join('  ·  '));
    console.log('');
}

console.log('─'.repeat(72));
console.log('Generated from selected Archive sources. This text is a stochastic');
console.log('recomposition, not a quotation.');
