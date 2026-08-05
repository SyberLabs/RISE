/**
 * The chain's laws, tested as properties rather than as samples.
 *
 * A generative model cannot be tested by looking at one output and
 * judging it good. What can be tested is what it must NEVER do, and §9
 * is unusually specific about that: never present a recomposition as a
 * passage from a source, keep the genealogy inspectable, and let the
 * transition probabilities be conditioned from outside.
 */
import { describe, it, expect } from 'vitest';
import {
    train, generate, tokenize, detokenize, entropyOf, genealogy, mulberry32, seedFrom
} from './markov.js';

/** A corpus with one long deterministic spine, which is the hard case. */
const MOBY = 'Call me Ishmael. Some years ago never mind how long precisely having little '
    + 'or no money in my purse and nothing particular to interest me on shore I thought '
    + 'I would sail about a little and see the watery part of the world.';
const WALDEN = 'I went to the woods because I wished to live deliberately to front only '
    + 'the essential facts of life and see if I could not learn what it had to teach and '
    + 'not when I came to die discover that I had not lived.';

const corpus = () => [
    { workId: 'moby-dick', text: MOBY },
    { workId: 'walden', text: WALDEN }
];

describe('tokenising', () => {
    it('keeps the punctuation that ends a sentence', () => {
        // Discarding it produces an endless run-on; the chain learns
        // where a line stops from these tokens alone.
        expect(tokenize('Call me Ishmael. Some years')).toEqual(
            ['Call', 'me', 'Ishmael', '.', 'Some', 'years']);
    });

    it('round-trips into readable prose', () => {
        expect(detokenize(tokenize('I went, and I saw; it was good.')))
            .toBe('I went, and I saw; it was good.');
    });
});

describe('the seed', () => {
    it('replays the same walk exactly', () => {
        // §9 wants the seed recoverable so a dream can be re-entered.
        const model = train(corpus());
        const a = generate(model, { seed: 'dream', length: 60 });
        const b = generate(model, { seed: 'dream', length: 60 });
        expect(a.text).toBe(b.text);
        expect(a.seed).toBe(seedFrom('dream'));
    });

    it('different seeds diverge', () => {
        const model = train(corpus());
        const a = generate(model, { seed: 1, length: 60 });
        const b = generate(model, { seed: 2, length: 60 });
        expect(a.text).not.toBe(b.text);
    });

    it('is uniform enough to sample with', () => {
        const random = mulberry32(12345);
        const buckets = new Array(10).fill(0);
        for (let i = 0; i < 20000; i++) buckets[Math.floor(random() * 10)]++;
        for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(300);
    });
});

describe('it does not quote', () => {
    it('backs off out of a deterministic context', () => {
        // THE CENTRAL PROPERTY. In natural text most trigrams have one
        // continuation, so a fixed order-3 walk copies its source. The
        // chain measures the entropy of where it stands and refuses a
        // context that has nothing to say.
        const model = train(corpus(), { order: 3 });
        const result = generate(model, { seed: 7, length: 80, minEntropy: 0.35 });
        expect(result.backoffs.length, 'a deterministic corpus must force backoff')
            .toBeGreaterThan(0);
        expect(result.backoffs.some(b => b.reason === 'entropy')).toBe(true);
    });

    it('holds the verbatim ceiling', () => {
        const model = train(corpus(), { order: 3 });
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const result = generate(model, { seed, length: 120, maxVerbatim: 5 });
            expect(result.longestVerbatimRun,
                `seed ${seed} ran ${result.longestVerbatimRun} tokens of one work`)
                .toBeLessThanOrEqual(5);
        }
    });

    it('does not reproduce a long span of a source verbatim', () => {
        // The claim stated the way a reader would check it.
        const model = train(corpus(), { order: 3 });
        const sources = [MOBY, WALDEN].map(t => tokenize(t).join(' '));
        for (const seed of [11, 22, 33, 44]) {
            const words = generate(model, { seed, length: 140, maxVerbatim: 6 }).tokens;
            for (let i = 0; i + 12 <= words.length; i++) {
                const span = words.slice(i, i + 12).join(' ');
                for (const source of sources) {
                    expect(source.includes(span),
                        `12 tokens reproduced verbatim: "${span}"`).toBe(false);
                }
            }
        }
    });

    it('carries the boundary, and it is not the caller’s to compose', () => {
        const model = train(corpus());
        const result = generate(model, { seed: 3, length: 20 });
        expect(result.notice).toMatch(/stochastic recomposition, not a quotation/);
    });
});

describe('entropy', () => {
    it('is zero where a context has one continuation', () => {
        const model = train([{ workId: 'x', text: 'alpha beta gamma' }], { order: 2 });
        expect(entropyOf(model.orders[1].get('alpha'))).toBe(0);
    });

    it('rises as continuations multiply', () => {
        const model = train([{ workId: 'x', text: 'a b a c a d a e' }], { order: 1 });
        expect(entropyOf(model.orders[1].get('a'))).toBeGreaterThan(1.5);
    });
});

describe('genealogy', () => {
    it('names the works that contributed, in proportion', () => {
        const model = train(corpus());
        const result = generate(model, { seed: 5, length: 100 });
        const lines = genealogy(result);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(['moby-dick', 'walden']).toContain(line.workId);
        const total = lines.reduce((n, l) => n + l.share, 0);
        expect(total).toBeCloseTo(1, 5);
    });

    it('splits the credit for an ambiguous step rather than doubling it', () => {
        // A token both works could have produced credits each a half. Full
        // credit to both would let one shared word inflate every source it
        // touched — a genealogy that overstates is not inspectable.
        const result = {
            attribution: [
                { token: 'the', works: ['a', 'b'] },
                { token: 'sea', works: ['a'] }
            ]
        };
        const lines = genealogy(result);
        expect(lines.find(l => l.workId === 'a').weight).toBeCloseTo(1.5, 5);
        expect(lines.find(l => l.workId === 'b').weight).toBeCloseTo(0.5, 5);
    });
});

describe('conditioning', () => {
    it('lets an outside signal reweight the transitions', () => {
        // §9's coupled organism: the visual and acoustic state condition
        // the next phrase by biasing the DISTRIBUTION, never by editing
        // the output afterwards.
        const model = train(corpus(), { order: 1 });
        const plain = generate(model, { seed: 9, length: 100 });
        // Bias tokens the corpus actually contains. The first version of
        // this test weighted "sea" and "water", neither of which appears
        // in these two passages — so it multiplied nothing and passed a
        // biased run that was identical to the plain one. A conditioning
        // test that conditions nothing tests nothing.
        const biased = generate(model, {
            seed: 9, length: 100,
            bias: (token) => (token === 'woods' || token === 'world' ? 60 : 1)
        });
        expect(biased.text).not.toBe(plain.text);
        const rate = (t) => (t.match(/\b(woods|world)\b/g) || []).length;
        expect(rate(biased.text), 'the bias moved the distribution')
            .toBeGreaterThan(rate(plain.text));
    });

    it('ignores a bias that would silence every continuation', () => {
        // A bias that zeroes the whole distribution has said nothing. It
        // must not be able to end the walk — that would let the visual
        // lane mute the text lane by accident.
        const model = train(corpus(), { order: 2 });
        const result = generate(model, { seed: 4, length: 60, bias: () => 0 });
        expect(result.tokens.length).toBe(60);
    });

    it('temperature sharpens and flattens without breaking the walk', () => {
        const model = train(corpus(), { order: 2 });
        for (const temperature of [0.2, 1, 3]) {
            const result = generate(model, { seed: 6, length: 50, temperature });
            expect(result.tokens.length).toBe(50);
        }
    });
});
