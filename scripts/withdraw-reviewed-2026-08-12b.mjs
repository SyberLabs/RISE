/**
 * The second 2026-08-12 pass, after the evidence was read.
 *
 *   node scripts/withdraw-reviewed-2026-08-12b.mjs            # report
 *   node scripts/withdraw-reviewed-2026-08-12b.mjs --apply
 *
 *   A. `don-quixote` — image furniture from the Gutenberg HTML edition,
 *      running through the WHOLE work rather than sitting at its head:
 *      `bookcover.jpg`, `p003.jpg (307K)`, `Full Size`. Cut LINE by line;
 *      no division is withdrawn, because every one of them is Cervantes
 *      apart from these. 23 distinct line shapes were listed and read
 *      before this was written, and not one is prose.
 *
 *   B. `le-morte-darthur` — three sections are chapter-heading lists with
 *      no prose between them. Withdrawn whole. The discriminator was
 *      checked against its own neighbour: section 245 opens
 *      `CHAPTER I. How Sir Tristram jousted…` and then continues `And if
 *      so be ye can descrive what ye bear…`, which is the book. A contents
 *      list runs heading to heading and scores above one structural
 *      heading per hundred words; a real chapter scores far below it.
 *
 * NOT CUT, and deliberately: `Volume 1 — Front matter` and `Volume 2 —
 * Front matter` also carry contents, but they open with the title block —
 * `Le Morte D'Arthur / King Arthur and of his Noble Knights…` — and that is
 * where the work names itself. Karenina taught this on the same day: cutting
 * to the first real heading removed the only self-naming in the opening pages
 * and `identity.test.js` failed at once. Those two want the Karenina
 * treatment, and they get their own pass rather than a hurried one here.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rewriteSections } from '../src/content/archive/payload-writer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKS = join(HERE, '..', 'src', 'content', 'archive', 'works');
const APPLY = process.argv.includes('--apply');

const words = (text) => String(text || '').trim().split(/\s+/u).filter(Boolean).length;

const IMAGE_FILE = /(^|\s)[\w-]+\.(jpg|jpeg|png|gif|svg)(\s|$)/iu;
const FILE_SIZE = /\(\s*\d{1,4}\s*[KkMm][Bb]?\s*\)/u;
const FULL_SIZE = /^\s*Full\s+Size\s*$/iu;
const isFurniture = (line) => {
    const text = line.trim();
    if (!text) return false;
    return FULL_SIZE.test(text) || ((IMAGE_FILE.test(text) || FILE_SIZE.test(text)) && text.length < 60);
};

/** A heading list: structural headings with no prose between them. */
const HEADING = /^[ \t]*(CHAPTER|PART|BOOK|CANTO|ACT|SCENE|VOLUME)\s+([IVXLCDM]+|\d+)\b/u;
function headingDensity(text) {
    const count = new Set(String(text).split('\n')
        .map(line => HEADING.exec(line)).filter(Boolean)
        .map(match => `${match[1]} ${match[2]}`)).size;
    const total = words(text);
    return { count, density: total ? (count / total) * 100 : 0, words: total };
}

async function load(id) {
    const path = join(WORKS, `${id}.js`);
    const module = await import(pathToFileURL(path).href);
    return { path, sections: Object.values(module).find(value => Array.isArray(value)) };
}

function write({ path }, sections) {
    const result = rewriteSections(path, sections);
    if (!result.ok) throw new Error(`${path}: ${result.reason}`);
}

// ── A. Don Quixote's image furniture ────────────────────────────────────────
{
    const work = await load('don-quixote');
    let cut = 0;
    const sections = work.sections.map(section => {
        const lines = String(section.content || '').split('\n');
        const kept = lines.filter(line => {
            if (!isFurniture(line)) return true;
            cut += 1;
            return false;
        });
        return { ...section, content: kept.join('\n') };
    });
    console.log(`\ndon-quixote — line furniture removed`);
    console.log(`  ${cut} lines cut from ${work.sections.length} sections`);
    console.log(`  must survive: "In a village of La Mancha…" and every chapter of it`);
    if (APPLY && cut) write(work, sections);
}

// ── B. Le Morte d'Arthur's heading lists ────────────────────────────────────
{
    const work = await load('le-morte-darthur');
    const kept = [];
    const cut = [];
    work.sections.forEach(section => {
        const text = String(section.content || '');
        const { count, density } = headingDensity(text);
        // Front matter opens with the title block; it is not cut here.
        const isFrontMatter = /Front matter/iu.test(String(section.name || ''));
        (count > 1 && density >= 1 && !isFrontMatter ? cut : kept).push(section);
    });
    console.log(`\nle-morte-darthur — heading lists withdrawn whole`);
    console.log(`  ${cut.length} sections, ${cut.reduce((sum, s) => sum + words(s.content), 0)}w`);
    cut.forEach(section => {
        const { count, density } = headingDensity(section.content);
        console.log(`    − ${JSON.stringify(String(section.name || '').slice(0, 46))} ${count} headings, ${density.toFixed(2)}/100w`);
    });
    console.log(`  must survive: section 245, "And if so be ye can descrive what ye bear"`);
    console.log(`  NOT cut: both Front matter sections — they carry the title block`);
    if (APPLY && cut.length) write(work, kept);
}

console.log(APPLY ? '\napplied.' : '\nREPORT ONLY. Nothing was written. Re-run with --apply.');
