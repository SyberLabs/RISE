/**
 * Chunker curation tool — show how the shelf actually reads.
 *
 * The instrument the phrase-chunking study lacked. Every metric it owns —
 * coefficient of variation, fragment rate, stutter runs, dangling tails —
 * scored Tintern Abbey as healthy while the reader met
 *
 *     6w  Five years have passed; five summers,
 *     7w  with the length Of five long winters!
 *
 * whose second atom carries the head of Wordsworth's next line. No number
 * flagged it. Mateo read the poem, and that is how it was found
 * (PHRASE-CHUNKING-STUDY §9).
 *
 * So this renders atoms AS A READER MEETS THEM, one per line, for every work
 * on the shelf in every mode, with the metrics beside them rather than
 * instead of them. A metric that disagrees with the page is the metric's
 * problem.
 *
 * Usage:
 *   node scripts/chunk-contact-sheet.mjs [out.html]
 */

import { writeFileSync } from 'node:fs';
import { CANON } from '../src/content/archive/canon.js';
import { chunkText } from '../src/core/chunker.js';

/** Atoms shown per sample. Enough to see a habit, few enough to scan. */
const ATOMS = 18;
/** Readings sampled per work: the first, and one from the middle. */
const SAMPLES = 2;
const MODES = ['phrase', 'sentence', 'word'];

const TRAILING_CONNECTIVE =
    /\b(?:and|but|or|nor|yet|that|with|which|who|the|a|an|of|to|in|as|for|from|by)[,;]?$/i;

function words(text) {
    return String(text ?? '').trim().split(/\s+/u).filter(Boolean);
}

/**
 * What share of these atoms BEGIN where a printed line begins?
 *
 * The question no existing metric asked, and the one Tintern Abbey failed
 * while scoring well on every other.
 *
 * Asked BY POSITION rather than by matching opening words. A short line is
 * carried into the next one deliberately — "Oedipus" onto what Oedipus then
 * says — and such an atom still begins where a line began. Comparing head
 * words counted every carry as a miss and scored a faithful Oedipus Rex at
 * 70.7%, which was this metric being wrong about the chunker rather than the
 * other way round.
 */
function onPrintedLines(atoms, source) {
    const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    const starts = new Set();
    let stream = '';
    for (const line of lines) {
        if (stream) stream += ' ';
        starts.add(stream.length);
        stream += line.replace(/\s+/gu, ' ');
    }

    let cursor = 0;
    let fitting = 0;
    let placed = 0;
    for (const atom of atoms) {
        const text = atom.content.trim().replace(/\s+/gu, ' ');
        const at = stream.indexOf(text, cursor);
        // An atom the walk cannot place says nothing either way: it is a
        // marker, or a normalisation this comparison does not model.
        if (at < 0) continue;
        placed += 1;
        if (starts.has(at)) fitting += 1;
        cursor = at + text.length;
    }
    return placed ? fitting / placed : null;
}

/**
 * What the numbers say, kept beside the page rather than in place of it.
 */
function measure(atoms, source, isVerse) {
    const lengths = atoms.map(atom => words(atom.content).length);
    const mean = lengths.reduce((total, n) => total + n, 0) / lengths.length;
    const sd = Math.sqrt(
        lengths.reduce((total, n) => total + (n - mean) ** 2, 0) / lengths.length);
    const sorted = [...lengths].sort((a, b) => a - b);

    let stutter = 0;
    let run = 0;
    for (const n of lengths) {
        if (n <= 3) { run += 1; if (run === 3) stutter += 1; } else run = 0;
    }

    const lineFit = isVerse ? onPrintedLines(atoms, source) : null;

    return {
        atoms: atoms.length,
        median: sorted[sorted.length >> 1] ?? 0,
        mean,
        cv: mean ? sd / mean : 0,
        fragments: lengths.filter(n => n <= 2).length / lengths.length,
        tails: atoms.filter(atom => TRAILING_CONNECTIVE.test(atom.content.trim())).length
            / atoms.length,
        stutter,
        lineFit
    };
}

function sampleWork(work, sections) {
    const usable = sections.filter(section => words(section.content).length > 120);
    const pool = usable.length ? usable : sections;
    const picks = [pool[0]];
    if (pool.length > 2 && SAMPLES > 1) picks.push(pool[Math.floor(pool.length / 2)]);

    return picks.filter(Boolean).map(section => {
        const isVerse = section.verse === true;
        return {
            workId: work.id,
            name: section.name,
            isVerse,
            words: words(section.content).length,
            modes: Object.fromEntries(MODES.map(mode => {
                // The reading path's own settings: the verse declaration
                // reaches phrase mode and no other (see §9's open item).
                const atoms = chunkText(section.content, {
                    mode,
                    wpm: 200,
                    verseLines: isVerse && mode === 'phrase'
                }).filter(atom => atom.content && atom.content.trim());
                return [mode, {
                    stats: measure(atoms, section.content, isVerse),
                    atoms: atoms.slice(0, ATOMS).map(atom => ({
                        text: atom.content.trim(),
                        words: words(atom.content).length,
                        ms: atom.duration
                    }))
                }];
            }))
        };
    });
}

const escape = text => String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pct = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function renderSample(sample) {
    const panes = MODES.map(mode => {
        const { stats, atoms } = sample.modes[mode];
        const rows = atoms.map(atom => `<li><b>${atom.words}w</b><span>${escape(atom.text)}</span></li>`)
            .join('');
        const fit = stats.lineFit == null
            ? ''
            : `<dt>on a printed line</dt><dd class="${stats.lineFit > 0.9 ? 'good' : 'bad'}">${pct(stats.lineFit)}</dd>`;
        return `<div class="pane" data-mode="${mode}">
      <dl class="stats">
        <dt>atoms</dt><dd>${stats.atoms}</dd>
        <dt>median</dt><dd>${stats.median}w</dd>
        <dt>cv</dt><dd>${stats.cv.toFixed(3)}</dd>
        <dt>≤2w</dt><dd>${pct(stats.fragments)}</dd>
        <dt>tails</dt><dd>${pct(stats.tails)}</dd>
        <dt>stutter</dt><dd>${stats.stutter}</dd>
        ${fit}
      </dl>
      <ol class="atoms">${rows}</ol>
    </div>`;
    }).join('');

    return `<section class="sample">
    <header>
      <h3>${escape(sample.name)}</h3>
      <p><span class="badge ${sample.isVerse ? 'verse' : 'prose'}">${sample.isVerse ? 'verse' : 'prose'}</span>
         <span class="muted">${escape(sample.workId)} · ${sample.words.toLocaleString()} words</span></p>
    </header>
    ${panes}
  </section>`;
}

function render(works) {
    const body = works.map(work => `<article class="work">
    <h2>${escape(work.title)}<span class="muted"> · ${escape(work.author)}</span></h2>
    ${work.samples.map(renderSample).join('')}
  </article>`).join('');

    return `<title>Chunk Contact Sheet</title>
<style>
  :root {
    --bg: #fbfaf8; --fg: #1b1a18; --muted: #6f6a63; --rule: #e2ded7;
    --card: #ffffff; --accent: #7a5c2e; --good: #2f6b3d; --bad: #9a3b2c;
    --verse: #efe6d5; --prose: #e6ecef;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #17161a; --fg: #ece9e4; --muted: #97918a; --rule: #322f36;
      --card: #1f1e23; --accent: #d5b478; --good: #82c08e; --bad: #e2907e;
      --verse: #332c1d; --prose: #1e2a30;
    }
  }
  :root[data-theme="dark"] {
    --bg: #17161a; --fg: #ece9e4; --muted: #97918a; --rule: #322f36;
    --card: #1f1e23; --accent: #d5b478; --good: #82c08e; --bad: #e2907e;
    --verse: #332c1d; --prose: #1e2a30;
  }
  body {
    background: var(--bg); color: var(--fg); margin: 0;
    font: 15px/1.5 ui-serif, Georgia, serif; padding: 2.5rem 1.25rem 5rem;
  }
  .wrap { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 1.7rem; margin: 0 0 .3rem; letter-spacing: -.01em; }
  .lede { color: var(--muted); max-width: 40rem; margin: 0 0 1.75rem; }
  .muted { color: var(--muted); font-weight: 400; }
  .modes { position: sticky; top: 0; z-index: 2; display: flex; gap: .4rem;
    padding: .7rem 0; background: var(--bg); border-bottom: 1px solid var(--rule);
    margin-bottom: 1.5rem; flex-wrap: wrap; }
  .modes button {
    font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .09em; text-transform: uppercase; cursor: pointer;
    padding: .55rem .9rem; border-radius: 999px; border: 1px solid var(--rule);
    background: transparent; color: var(--muted);
  }
  .modes button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
  .work { margin: 0 0 2.5rem; }
  .work > h2 { font-size: 1.15rem; margin: 0 0 .75rem; padding-bottom: .4rem;
    border-bottom: 1px solid var(--rule); }
  .sample { background: var(--card); border: 1px solid var(--rule);
    border-radius: 10px; padding: 1rem 1.1rem; margin: 0 0 .9rem; }
  .sample header h3 { font-size: 1rem; margin: 0 0 .2rem; font-weight: 600; }
  .sample header p { margin: 0 0 .8rem; font-size: 12px; }
  .badge { font: 600 10px/1 ui-monospace, Menlo, monospace; text-transform: uppercase;
    letter-spacing: .1em; padding: .28rem .5rem; border-radius: 4px; margin-right: .5rem; }
  .badge.verse { background: var(--verse); color: var(--fg); }
  .badge.prose { background: var(--prose); color: var(--fg); }
  .pane { display: none; }
  .pane.on { display: block; }
  .stats { display: flex; flex-wrap: wrap; gap: 0 1.15rem; margin: 0 0 .7rem;
    font: 11px/1.6 ui-monospace, Menlo, monospace; color: var(--muted); }
  .stats dt { display: inline; letter-spacing: .06em; text-transform: uppercase; }
  .stats dd { display: inline; margin: 0 0 0 .3rem; color: var(--fg); font-weight: 600; }
  .stats dd.good { color: var(--good); }
  .stats dd.bad { color: var(--bad); }
  .atoms { list-style: none; margin: 0; padding: 0;
    border-left: 2px solid var(--rule); }
  .atoms li { display: flex; gap: .8rem; padding: .16rem 0 .16rem .8rem; }
  .atoms b { font: 600 11px/1.55 ui-monospace, Menlo, monospace; color: var(--muted);
    min-width: 2.4rem; text-align: right; flex: none; }
  .atoms span { flex: 1; }
</style>
<div class="wrap">
  <h1>Chunk Contact Sheet</h1>
  <p class="lede">Every reading on the shelf, atom by atom, as a reader meets them.
  The numbers are beside the page rather than in place of it: each of them scored
  Tintern Abbey as healthy while its second atom carried the head of Wordsworth's
  next line. A metric that disagrees with the page is the metric's problem.</p>
  <div class="modes">
    ${MODES.map((mode, index) => `<button data-mode="${mode}" aria-pressed="${index === 0}">${mode}</button>`).join('')}
  </div>
  ${body}
</div>
<script>
  const show = wanted => {
    for (const pane of document.querySelectorAll('.pane')) {
      pane.classList.toggle('on', pane.dataset.mode === wanted);
    }
    for (const button of document.querySelectorAll('.modes button')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === wanted));
    }
  };
  document.querySelector('.modes').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) show(button.dataset.mode);
  });
  show(${JSON.stringify(MODES[0])});
</script>`;
}

async function main() {
    const [, , outPath = 'chunk-contact-sheet.html'] = process.argv;
    const works = [];
    for (const entry of CANON) {
        const module = await import(`../src/content/archive/works/${entry.id}.js`);
        const sections = Object.values(module)
            .find(value => Array.isArray(value) && value[0]?.name);
        if (!sections) continue;
        const meta = Object.values(module).find(value => value?.title && value?.author);
        works.push({
            title: meta?.title || entry.id,
            author: meta?.author || '',
            samples: sampleWork(entry, sections)
        });
    }
    writeFileSync(outPath, render(works));
    const samples = works.reduce((total, work) => total + work.samples.length, 0);
    console.log(`${works.length} works, ${samples} readings, ${MODES.length} modes → ${outPath}`);
}

main();
