/**
 * Converts a Project Gutenberg LaTeX edition into a School source file.
 *
 *   node scripts/school-latex.mjs
 *
 * Boole's Laws of Thought is set in LaTeX only (PG 15114). This fetches the
 * .tex (cached under .ingest-cache/latex/), converts the span from
 * \mainmatter to "the end." (src/content/school/latex.js) and writes
 * scripts/school-sources/mercury.laws-of-thought/laws-of-thought.md with its
 * provenance and the source's sha256 above the text. The ingest then reads
 * that file like any other (`kind: 'file'`), words in equal to words out.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { latexToMarkdown } from '../src/content/school/latex.js';

const ROOT = resolve(import.meta.dirname, '..');
const URL = 'https://www.gutenberg.org/files/15114/15114-t/15114-t.tex';
const CACHE = resolve(ROOT, '.ingest-cache', 'latex');
const OUT = resolve(ROOT, 'scripts/school-sources/mercury.laws-of-thought/laws-of-thought.md');

// Slips in the transcription's own markup, each corrected as the printed page reads.
const FIXES = [
    // A comment after a word runs the next line's first word into it.
    ['}%endfootnote\nAnd in Greece', '}\nAnd in Greece'],
    ['cap.~xi.}%endfootnote\nThe moral', 'cap.~xi.}\nThe moral'],
    ["d'ikaia})%(", "d'ikaia})\n%("]
];

mkdirSync(CACHE, { recursive: true });
const cached = resolve(CACHE, '15114-t.tex');
if (!existsSync(cached)) {
    process.stderr.write(`fetching ${URL}\n`);
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`${URL}: HTTP ${response.status}`);
    writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
}
const bytes = readFileSync(cached);
const sha256 = createHash('sha256').update(bytes).digest('hex');
let tex = bytes.toString('utf8').replace(/\r\n?/gu, '\n');
for (const [slip, fix] of FIXES) {
    if (!tex.includes(slip)) throw new Error(`a fix no longer applies: ${JSON.stringify(slip)}`);
    tex = tex.replace(slip, fix);
}
const { markdown, chapters, dropped } = latexToMarkdown(tex, { from: '\\mainmatter', to: '\\centerline{\\textsc{the end.}}' });

const header = `# An Investigation of the Laws of Thought, by George Boole (Walton and Maberly, London, 1854)

Converted for the RISE Mystery School from Project Gutenberg's LaTeX edition by scripts/school-latex.mjs; never hand-edited.

- Source: ${URL} (Project Gutenberg ebook 15114), sha256 ${sha256}.
- Read: from \\mainmatter to "the end.", the ${chapters} chapters. Left out: the title page, the dedication, the preface,
  the contents and the note after them, the footnotes (${dropped.footnotes ?? 0} words), the transcribers' comments and
  the distributor's header and licence. ${FIXES.length} slips in the transcription's markup corrected (scripts/school-latex.mjs).
- Equations shown as text: every formula is kept in its TeX form inside brackets, [x^2 = x]; a lone letter or number
  set as mathematics is left bare, as the word it is in the sentence. Emphasis is unwrapped; Greek is set in Greek.
`;
writeFileSync(OUT, `${header}\n${markdown}\n`);
console.log(`wrote ${OUT}: ${chapters} chapters, ${markdown.split(/\s+/u).length} words, ${dropped.footnotes ?? 0} words of footnotes left out`);
