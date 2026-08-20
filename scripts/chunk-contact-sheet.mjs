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
        const longest = Math.max(1, ...atoms.map(atom => atom.ms));
        const rows = atoms.map(atom => {
            const share = Math.round((atom.ms / longest) * 100);
            return `<li style="--hold:${share}%">
          <span class="count">${atom.words}</span>
          <span class="line">${escape(atom.text)}</span>
        </li>`;
        }).join('');

        const fit = stats.lineFit == null ? '' : `
        <div class="stat"><dt>on a printed line</dt>
        <dd class="${stats.lineFit > 0.93 ? 'good' : 'warn'}">${pct(stats.lineFit)}</dd></div>`;

        return `<div class="pane" data-mode="${mode}">
      <dl class="stats">
        <div class="stat"><dt>atoms</dt><dd>${stats.atoms}</dd></div>
        <div class="stat"><dt>median</dt><dd>${stats.median}w</dd></div>
        <div class="stat"><dt>variation</dt><dd>${stats.cv.toFixed(3)}</dd></div>
        <div class="stat"><dt>under 3w</dt>
          <dd class="${stats.fragments > 0.1 ? 'warn' : ''}">${pct(stats.fragments)}</dd></div>
        <div class="stat"><dt>hanging</dt><dd>${pct(stats.tails)}</dd></div>
        <div class="stat"><dt>stutter</dt>
          <dd class="${stats.stutter ? 'warn' : ''}">${stats.stutter}</dd></div>${fit}
      </dl>
      <ol class="galley">${rows}</ol>
    </div>`;
    }).join('');

    return `<section class="sample">
    <header class="sample-head">
      <h3>${escape(sample.name)}</h3>
      <p><span class="badge ${sample.isVerse ? 'verse' : 'prose'}">${sample.isVerse ? 'set as verse' : 'set as prose'}</span>
         <span class="faint">${sample.words.toLocaleString()} words</span></p>
    </header>
    ${panes}
  </section>`;
}

function render(works) {
    const body = works.map(work => `<article class="work">
    <h2>${escape(work.title)}</h2>
    <p class="byline">${escape(work.author)}</p>
    ${work.samples.map(renderSample).join('')}
  </article>`).join('');

    return `<title>Chunk Contact Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Literata:opsz,wght@7..72,400;7..72,500&display=swap">
<style>
  /* Light is the base set; the two blocks after it redefine ONLY tokens, so
     no colour is ever declared for the first time inside a theme block. */
  :root {
    --paper:  #f6f7f8;
    --card:   #ffffff;
    --ink:    #16191c;
    --faint:  #6b7480;
    --rule:   #dde1e6;
    --accent: #1f4e79;
    --good:   #2d6a4a;
    --warn:   #8c4a2f;
    --tint:   rgba(31, 78, 121, .07);
    --shadow: 0 1px 2px rgba(22, 25, 28, .05);

    --ui:   'IBM Plex Sans', system-ui, sans-serif;
    --data: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    --read: 'Literata', Georgia, 'Times New Roman', serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:  #101317;
      --card:   #171b20;
      --ink:    #e6eaee;
      --faint:  #8b95a1;
      --rule:   #262c33;
      --accent: #7aa8d4;
      --good:   #6fbf8e;
      --warn:   #d99277;
      --tint:   rgba(122, 168, 212, .10);
      --shadow: none;
    }
  }
  :root[data-theme="dark"] {
    --paper:  #101317;
    --card:   #171b20;
    --ink:    #e6eaee;
    --faint:  #8b95a1;
    --rule:   #262c33;
    --accent: #7aa8d4;
    --good:   #6fbf8e;
    --warn:   #d99277;
    --tint:   rgba(122, 168, 212, .10);
    --shadow: none;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 3rem 1.25rem 6rem;
    background: var(--paper);
    color: var(--ink);
    font: 400 15px/1.55 var(--ui);
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 58rem; margin: 0 auto; display: flex; flex-direction: column; gap: 2.25rem; }

  .masthead { display: flex; flex-direction: column; gap: .6rem; }
  .eyebrow {
    font: 500 11px/1 var(--data); letter-spacing: .16em; text-transform: uppercase;
    color: var(--accent); margin: 0;
  }
  h1 { font: 600 1.9rem/1.15 var(--ui); margin: 0; letter-spacing: -.02em; text-wrap: balance; }
  .lede { margin: 0; max-width: 42rem; color: var(--faint); font-size: .95rem; }
  .lede b { color: var(--ink); font-weight: 500; }

  .modes {
    position: sticky; top: 0; z-index: 3;
    display: flex; gap: .4rem; flex-wrap: wrap; align-items: center;
    padding: .85rem 0; margin: 0;
    background: var(--paper); border-bottom: 1px solid var(--rule);
  }
  .modes button {
    font: 500 11px/1 var(--data); letter-spacing: .13em; text-transform: uppercase;
    cursor: pointer; padding: .6rem 1rem; border-radius: 2px;
    border: 1px solid var(--rule); background: transparent; color: var(--faint);
  }
  .modes button:hover { color: var(--ink); border-color: var(--faint); }
  .modes button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .modes button[aria-pressed="true"] {
    background: var(--accent); border-color: var(--accent); color: var(--card);
  }
  .modes .hint { font: 400 11px/1 var(--data); color: var(--faint); margin-left: auto; }

  .work { display: flex; flex-direction: column; gap: .75rem; }
  .work > h2 { font: 600 1.15rem/1.2 var(--ui); margin: 0; letter-spacing: -.01em; }
  .byline { margin: -.6rem 0 .1rem; font-size: .85rem; color: var(--faint); }

  .sample {
    background: var(--card); border: 1px solid var(--rule);
    border-radius: 3px; padding: 1.1rem 1.2rem 1.2rem; box-shadow: var(--shadow);
  }
  .sample-head h3 { font: 500 .98rem/1.3 var(--ui); margin: 0 0 .35rem; }
  .sample-head p { margin: 0 0 .9rem; display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
  .faint { color: var(--faint); font: 400 11px/1 var(--data); }
  .badge {
    font: 500 10px/1 var(--data); letter-spacing: .11em; text-transform: uppercase;
    padding: .34rem .5rem; border-radius: 2px; border: 1px solid currentColor;
  }
  .badge.verse { color: var(--accent); }
  .badge.prose { color: var(--faint); }

  .pane { display: none; }
  .pane.on { display: block; }

  .stats {
    display: flex; flex-wrap: wrap; gap: .35rem 1.4rem; margin: 0 0 1rem;
    padding: 0 0 .85rem; border-bottom: 1px solid var(--rule);
  }
  .stats .stat { display: flex; align-items: baseline; gap: .4rem; }
  .stats dt {
    font: 400 10px/1 var(--data); letter-spacing: .1em; text-transform: uppercase;
    color: var(--faint);
  }
  .stats dd {
    margin: 0; font: 500 12px/1 var(--data); color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .stats dd.good { color: var(--good); }
  .stats dd.warn { color: var(--warn); }

  /* The galley. One row is one atom — one screen the reader will meet — so
     the count sits in the margin where a verse line number sits, and the
     tint behind each row is how long it is held. Rhythm without reading. */
  .galley { list-style: none; margin: 0; padding: 0; }
  .galley li {
    display: flex; gap: 1rem; align-items: baseline;
    padding: .2rem .5rem .2rem 0;
    border-left: 2px solid var(--rule);
    background-image: linear-gradient(to right, var(--tint), var(--tint));
    background-repeat: no-repeat;
    background-size: var(--hold, 0%) 100%;
  }
  .galley .count {
    flex: none; width: 2.1rem; text-align: right;
    font: 400 10px/1.7 var(--data); color: var(--faint);
    font-variant-numeric: tabular-nums;
  }
  .galley .line {
    font: 400 15px/1.55 var(--read); color: var(--ink);
    text-wrap: pretty;
  }

  @media (max-width: 34rem) {
    .galley .count { width: 1.7rem; }
    .galley .line { font-size: 14px; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">RISE · reading atoms</p>
    <h1>Chunk Contact Sheet</h1>
    <p class="lede">Every reading on the shelf, atom by atom, as a reader meets them —
    one row is one screen. The numbers sit <b>beside</b> the page rather than in place of it:
    each of them scored Tintern Abbey as healthy while its second atom carried the head of
    Wordsworth's next line. A metric that disagrees with the page is the metric's problem.</p>
  </header>

  <nav class="modes" aria-label="Chunking mode">
    ${MODES.map((mode, index) => `<button data-mode="${mode}" aria-pressed="${index === 0}">${mode}</button>`).join('')}
    <span class="hint">tint = time held</span>
  </nav>

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
