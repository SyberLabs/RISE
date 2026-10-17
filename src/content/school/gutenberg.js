/**
 * Reads a Project Gutenberg HTML edition into the units a School recipe
 * declares.
 *
 * The edition's markup is the only evidence of structure read here:
 * headings (`h1`..`h6`, plus any element a recipe names as a heading) mark
 * where units begin, and `<pre>`, poem blocks and line-broken paragraphs
 * carry their lines. Which headings open units is the recipe's decision,
 * never a pattern's: a list of exact heading texts, or every heading of one
 * level between two named ones. Nothing is reflowed: a paragraph is one
 * line, a verse block keeps every line it printed.
 *
 * Removed before anything is read, and reported by kind: the distributor's
 * header and footer (which hold the START and END markers), page numbers,
 * footnote markers and footnote blocks, transcriber's notes, and the
 * edition's hidden duplicates. Every remaining word of the span is counted
 * from the document's text nodes, independently of how the units were
 * assembled, so `sourceWords === importedWords` proves no word was lost.
 *
 * Imported only by scripts/school-ingest.mjs; `parse` is the caller's HTML
 * parser, so this module carries no DOM dependency of its own.
 */

const BLOCK = new Set(['P', 'DIV', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD',
    'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'SECTION', 'ARTICLE', 'HEADER',
    'FOOTER', 'FIGURE', 'FIGCAPTION', 'HR', 'CENTER', 'ASIDE', 'NAV', 'CAPTION', 'MAIN']);
const HEADINGS = 'h1,h2,h3,h4,h5,h6';
const VERSE = 'pre, .poem, .poetry, .verse, .stanza, .linegroup, .lg-container-b';
/** A line break inside a block, kept apart from the source's own whitespace. */
const BREAK = '\u2028';
/** A block's edge, and a stanza's, inside a block read as lines. */
const EDGE = '\uE000';
const STANZA = '\uE001';
const RUN = /[\s\uE000\uE001]*[\u2028\uE000\uE001][\s\uE000\uE001]*/gu;

const DROP = Object.freeze({
    'page numbers': '.pagenum, .pageno, .xxpn, .linenum, .indexpageno',
    hidden: '.epubonly, .x-ebookmaker-drop, .pleasehide, script, style',
    'transcriber notes': '.transnote, .tnotes, .tnote',
    footnotes: '.footnote:not(a), .footnotes, .dftnt, p.foot'
});
/** An anchor's whole text when it is a footnote marker: [1], [12a], [FN#3], [A], *. */
const MARKER_TEXT = /^\s*\[?(?:FN#?)?(?:\d{1,4}[a-z]?|[A-Za-z]|[*†‡§])\]?\s*$/u;
/** A marker set as plain text: attached to the word or stop before it, or an [FN#n] anywhere. */
const PLAIN_MARKER = /(?<=\S)\[(?:FN#?)?(?:\d{1,4}|[A-Z])\]|\[FN#?\d{1,4}\]/gu;
/** A block that opens with a marker is a footnote's own text. */
const NOTE_BLOCK = /^\s*\[(?:FN#?)?(?:\d{1,4}|[A-Z])\]/u;
const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on',
    'or', 'the', 'to', 'with']);

const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;
const flat = text => String(text).replace(/\s+/gu, ' ').trim();

/**
 * A shouted heading in title case; a heading with lower case is left as
 * printed. Roman numerals stay numerals; minor words stay lower case except
 * where a title or a clause after a colon begins.
 */
export function titleCase(text) {
    const raw = flat(text);
    if (!raw || /\p{Ll}/u.test(raw)) return raw;
    let opening = true;
    return raw.split(' ').map(word => {
        const first = opening;
        opening = /[.:—·]$/u.test(word);
        if (/^\(?[IVXLCDM]+[.,:;)]*$/u.test(word)) return word;
        const lower = word.toLowerCase();
        if (!first && MINOR.has(lower.replace(/[.,:;]+$/u, ''))) return lower;
        return lower.replace(/(^|[-(‘“"'])(\p{L})/gu, (_, lead, letter) => lead + letter.toUpperCase());
    }).join(' ');
}

function dropWords(elements) {
    let total = 0;
    for (const element of elements) {
        if (!element.isConnected) continue;
        total += countWords(element.textContent);
        element.remove();
    }
    return total;
}

/**
 * Removes every "[Footnote: …]" an edition set inline, to its matching
 * bracket, across whatever elements its text runs through; returns the
 * words removed.
 */
function dropInlineNotes(doc) {
    const walker = doc.createTreeWalker(doc.body, 4);
    let removed = '';
    let depth = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let kept = '';
        let at = 0;
        const data = node.data;
        while (at < data.length) {
            if (!depth) {
                const open = data.indexOf('[Footnote', at);
                if (open < 0) {
                    kept += data.slice(at);
                    break;
                }
                kept += data.slice(at, open);
                at = open;
            }
            for (; at < data.length && (depth || data[at] === '['); at++) {
                if (data[at] === '[') depth++;
                else if (data[at] === ']') depth--;
                removed += data[at];
                if (!depth) {
                    at++;
                    removed += ' ';
                    break;
                }
            }
        }
        if (kept !== data) node.data = kept;
    }
    return countWords(removed);
}

/** Strips everything that is not the edition's text, and says how much. */
function strip(doc) {
    const header = doc.getElementById('pg-header');
    const footer = doc.getElementById('pg-footer');
    if (!header || !/\*\*\* ?START OF/u.test(header.textContent)) throw new Error('no "*** START OF" marker in a #pg-header');
    if (!footer || !/\*\*\* ?END OF/u.test(footer.textContent)) throw new Error('no "*** END OF" marker in a #pg-footer');
    header.remove();
    footer.remove();

    const dropped = {};
    const add = (kind, count) => { if (count) dropped[kind] = (dropped[kind] || 0) + count; };
    for (const [kind, selector] of Object.entries(DROP)) {
        add(kind, dropWords([...doc.body.querySelectorAll(selector)]));
    }
    const markers = [...doc.body.querySelectorAll('a[href^="#"]')].filter(anchor => MARKER_TEXT.test(anchor.textContent)
        && (/[[\]*†‡§]/u.test(anchor.textContent) || anchor.closest('sup')
            || /fn|note|citation/iu.test(anchor.className)));
    add('footnote markers', dropWords(markers));
    for (const sup of doc.body.querySelectorAll('sup')) {
        if (!sup.textContent.trim()) sup.remove();
    }
    add('footnotes', dropWords([...doc.body.querySelectorAll('p, div')]
        .filter(block => NOTE_BLOCK.test(block.textContent) && ![...block.children].some(child => BLOCK.has(child.tagName)))));

    add('footnotes', dropInlineNotes(doc));
    const walker = doc.createTreeWalker(doc.body, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!PLAIN_MARKER.test(node.data)) continue;
        PLAIN_MARKER.lastIndex = 0;
        add('footnote markers', (node.data.match(PLAIN_MARKER) || []).length);
        node.data = node.data.replace(PLAIN_MARKER, '');
    }
    // An equation set as an image is text the edition gives in its alt.
    for (const img of doc.body.querySelectorAll('img[data-tex]')) img.replaceWith(doc.createTextNode(img.alt));
    for (const br of doc.body.querySelectorAll('br')) br.after(doc.createTextNode(BREAK));
    return dropped;
}

/**
 * Where a run of breaks ends a line, and where it also ends a stanza: a
 * stanza's edge, or two `<br>` (or two newlines in `<pre>`) with no block
 * edge between them. A block edge next to a `<br>` is one break, not two.
 */
function breakRun(run) {
    if (run.includes(STANZA)) return '\n\n';
    if (run.includes(EDGE)) return '\n';
    return [...run].filter(char => char === BREAK).length > 1 ? '\n\n' : '\n';
}

/** A block's lines: breaks where it set `<br>`, a block edge, or (in `<pre>`) a newline. */
function linesOf(element) {
    let text = '';
    const walk = node => {
        if (node.nodeType === 3) {
            text += node.parentElement.closest('pre') ? node.data.replace(/\n/gu, BREAK) : node.data;
            return;
        }
        if (node.nodeType !== 1) return;
        // A table cell is a column within its row's line.
        const cell = node.tagName === 'TD' || node.tagName === 'TH';
        const block = BLOCK.has(node.tagName) && node !== element && !cell;
        const edge = block && node.classList.contains('stanza') ? STANZA : EDGE;
        if (block) text += edge;
        if (cell) text += ' ';
        for (const child of node.childNodes) walk(child);
        if (block) text += edge;
    };
    walk(element);
    const lines = text.replace(/[\n\r\t\f]/gu, ' ').replace(RUN, breakRun).split('\n').map(line => line.replace(/\s+/gu, ' ').trim());
    const kept = [];
    for (const line of lines) {
        if (line || (kept.length && kept[kept.length - 1])) kept.push(line);
    }
    while (kept.length && !kept[kept.length - 1]) kept.pop();
    return kept;
}

function hasBlockChild(element) {
    return [...element.children].some(child => BLOCK.has(child.tagName) || hasBlockChild(child));
}

/**
 * The body in reading order: headings, and blocks of lines. A leaf block is
 * one item; a container is read through; loose text between blocks is a
 * paragraph of its own.
 */
function linearize(body, isHeading) {
    const items = [];
    const push = (element, lines, verse) => {
        if (lines.length) items.push({ kind: 'block', element, lines, verse });
    };
    const walk = element => {
        let run = [];
        const flush = () => {
            const text = run.map(node => node.textContent).join('');
            const lines = text.split(BREAK).map(line => line.replace(/\s+/gu, ' ').trim()).filter(Boolean);
            push(element, lines, lines.length > 1);
            run = [];
        };
        for (const node of element.childNodes) {
            if (node.nodeType === 1 && isHeading(node)) {
                flush();
                items.push({ kind: 'heading', element: node, text: flat(node.textContent), lines: linesOf(node) });
            } else if (node.nodeType === 1 && BLOCK.has(node.tagName)) {
                flush();
                if (node.matches(VERSE) || !hasBlockChild(node) || node.tagName === 'TABLE') {
                    const lines = linesOf(node);
                    const verse = node.tagName !== 'TABLE' && (node.matches(VERSE) || lines.length > 1);
                    push(node, lines, verse);
                } else {
                    walk(node);
                }
            } else if (node.nodeType === 1 && hasBlockChild(node)) {
                flush();
                walk(node);
            } else if (node.nodeType === 1 || node.nodeType === 3) {
                run.push(node);
            }
        }
        flush();
    };
    walk(body);
    return items;
}

/**
 * Words from `start` (inclusive) to `end` (exclusive), counted from the
 * document's own text: text runs on across inline elements, and a block's
 * edge separates words, as a reader sees them.
 */
function wordsBetween(doc, start, end) {
    let text = '';
    let on = !start;
    let done = false;
    const walk = node => {
        if (done) return;
        if (node === end) {
            done = true;
            return;
        }
        if (node === start) on = true;
        if (node.nodeType === 3) {
            if (on) text += node.data;
            return;
        }
        const block = node.nodeType === 1 && (BLOCK.has(node.tagName) || node.tagName === 'BR');
        if (block) text += ' ';
        for (const child of node.childNodes) walk(child);
        if (block) text += ' ';
    };
    walk(doc.body);
    return countWords(text);
}

/** The one heading that reads `text` (at `level`, if given), or the `nth` of several. */
function findHeading(items, { text, level, nth }, label) {
    const want = flat(text);
    const found = items.filter(item => item.kind === 'heading' && item.text === want
        && (level === undefined || levelOf(item.element) === level));
    if (nth !== undefined ? !found[nth - 1] : found.length !== 1) {
        throw new Error(`${label}: ${found.length} headings read "${want}" in the span`);
    }
    return found[nth === undefined ? 0 : nth - 1];
}

function levelOf(element) {
    return /^H[1-6]$/u.test(element.tagName) ? Number(element.tagName[1]) : null;
}

/** "CHAPTER III / HERAKLEITOS" as one name; a printed stop ends a line on its own. */
function headingName(lines) {
    const name = lines.filter(Boolean).reduce((joined, line) => {
        if (!joined) return line;
        return /[.:;,—-]$/u.test(joined) ? `${joined} ${line}` : `${joined}: ${line}`;
    }, '');
    return titleCase(name.replace(/[.:]$/u, '')).replace(/[.:]$/u, '');
}

function shortName(text) {
    return titleCase(flat(text).split(/[.:] /u)[0].replace(/[.:]$/u, ''));
}

/**
 * The recipe's units, in reading order: `{ item, name?, verse?, group? }`.
 * `units: 'headings'` takes every heading of `level` (a number, or the
 * selector the recipe made headings of) from `from` to `to` inclusive, and
 * every heading of `group`, or whose text `groups` lists, as a group
 * banner; a list takes exactly the headings it names.
 */
function plan(items, recipe) {
    if (Array.isArray(recipe.units)) {
        return recipe.units.map(unit => ({ ...unit, item: findHeading(items, { ...unit, text: unit.heading }, 'unit') }));
    }
    if (recipe.units !== 'headings') throw new Error(`units must be "headings" or a list, not ${JSON.stringify(recipe.units)}`);
    const at = (item, level) => (typeof level === 'number' ? levelOf(item.element) === level : item.element.matches(level));
    const first = recipe.from ? findHeading(items, { text: recipe.from }, 'from') : null;
    const last = recipe.to ? findHeading(items, { text: recipe.to }, 'to') : null;
    const units = [];
    let open = !first;
    for (const item of items) {
        if (item.kind !== 'heading') continue;
        if (item === first) open = true;
        if ((recipe.group !== undefined && at(item, recipe.group)) || recipe.groups?.includes(item.text)) units.push({ item, group: true });
        else if (open && at(item, recipe.level)) units.push({ item });
        if (item === last) open = false;
    }
    return units;
}

/**
 * `{ parts, sourceWords, importedWords, dropped, groups, title }` for the
 * units `recipe` declares in `html`. Throws, naming the cause, when a named
 * heading is missing or doubled, or when text in the span belongs to no unit.
 */
export function readGutenberg(html, parse, recipe) {
    const doc = parse(String(html));
    const dropped = strip(doc);
    // What the recipe names as not the work: a printer's colophon set in the text.
    if (recipe.drop) dropped.recipe = dropWords(doc.body.querySelectorAll(recipe.drop));
    const extra = [recipe.headings, typeof recipe.level === 'string' ? recipe.level : null].filter(Boolean).join(', ');
    // An element the recipe names as a heading stands for the block it opens.
    const candidates = new Set([...doc.body.querySelectorAll(extra ? `${HEADINGS}, ${extra}` : HEADINGS)]
        .map(element => (BLOCK.has(element.tagName) ? element : element.closest([...BLOCK].join(',').toLowerCase()))));
    const all = linearize(doc.body, element => candidates.has(element));

    let items = all;
    let end = null;
    if (recipe.extract) {
        const from = findHeading(all, { ...recipe.extract, text: recipe.extract.from }, 'extract.from');
        const start = all.indexOf(from);
        // The span ends before the first heading, or failing one the first
        // paragraph, that reads `to`.
        const reads = item => (item.kind === 'heading' ? item.text : item.lines.join(' ')) === flat(recipe.extract.to);
        const stop = recipe.extract.to ? all.findIndex((item, index) => index > start && reads(item)) : -1;
        if (recipe.extract.to && stop < 0) throw new Error(`extract.to: nothing reads "${flat(recipe.extract.to)}" after "${from.text}"`);
        items = all.slice(start, stop < 0 ? undefined : stop);
        end = stop < 0 ? null : all[stop].element;
    }
    const units = plan(items, recipe);
    if (!units.length) throw new Error('the recipe selects no units');
    const opens = new Map(units.map(unit => [unit.item, unit]));

    const title = [];
    const groups = [];
    const parts = [];
    let current = null;
    let carried = [];
    let importedWords = 0;
    for (const item of items) {
        const unit = opens.get(item);
        if (unit?.group) {
            groups.push(item.text);
            current = null;
            carried.push(item.lines.join(' '));
            continue;
        }
        if (unit) {
            current = {
                name: unit.name ?? headingName(item.lines),
                sourceTitle: item.text,
                verseFlag: unit.verse ?? recipe.verse,
                blocks: [...carried.map(text => ({ lines: [text], verse: false }))],
                subtitle: recipe.subtitle ? 'pending' : null,
                group: groups[groups.length - 1] ?? null
            };
            carried = [];
            importedWords += countWords(item.text);
            parts.push(current);
            continue;
        }
        if (current?.subtitle === 'pending') {
            current.subtitle = null;
            if (item.kind === 'block' && item.element.matches(recipe.subtitle)) {
                current.name = `${current.name}: ${headingName(item.lines)}`;
                current.sourceTitle = `${current.sourceTitle} ${item.lines.join(' ')}`;
                importedWords += countWords(item.lines.join(' '));
                continue;
            }
        }
        if (!current && !carried.length && !parts.length) {
            if (item.kind !== 'heading') throw new Error(`text before the first unit: "${item.lines.join(' ').slice(0, 80)}"`);
            title.push(item.text);
            importedWords += countWords(item.text);
            continue;
        }
        const block = item.kind === 'heading' ? { lines: [item.lines.join(' ')], verse: false } : item;
        if (current) current.blocks.push(block);
        else carried.push(block.lines.join('\n'));
    }
    if (carried.length) throw new Error(`a group banner has no unit after it: "${carried[0].slice(0, 80)}"`);

    for (const part of parts) {
        part.content = part.blocks.map(block => block.lines.join('\n')).join('\n\n');
        const verseWords = part.blocks.reduce((sum, block) => sum + (block.verse ? countWords(block.lines.join(' ')) : 0), 0);
        part.verse = part.verseFlag ?? verseWords / Math.max(1, countWords(part.content)) > 0.5;
        part.lines = part.verse ? part.blocks.reduce((sum, block) => sum + block.lines.filter(Boolean).length, 0) : 0;
        if (recipe.groupPrefix && part.group) part.name = `${shortName(part.group)} · ${part.name}`;
        importedWords += countWords(part.content);
        delete part.blocks;
        delete part.verseFlag;
        delete part.subtitle;
        delete part.group;
    }
    const start = recipe.extract ? items[0].element : null;
    return {
        parts,
        sourceWords: wordsBetween(doc, start, end),
        importedWords,
        dropped,
        groups,
        title: title.join(' ')
    };
}
