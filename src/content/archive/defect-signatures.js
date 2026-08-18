/**
 * Every defect we have found, kept as something that can be looked for again.
 *
 * THE POINT IS RECURSION. A defect discovered in one work is evidence about
 * ninety others. Don Quixote served `bookcover.jpg`, `spine.jpg (152K)` and
 * `Full Size` as if they were Cervantes — and the moment that is written down
 * as a pattern rather than a fix, it becomes a question the whole shelf can be
 * asked, today and at every future acquisition.
 *
 * So each entry records where it came from. A signature with no provenance is
 * a guess; one with provenance is a lesson, and a later reader can go and see
 * the thing that taught it.
 *
 * DISPOSITION IS NOT SEVERITY. `withdraw` means the division was never a
 * reading. `trim` means a genuine reading carries something at its head or in
 * a line. `review` means it is evidence for a human and nothing may be cut on
 * it alone. Nothing here applies itself — this module only finds.
 */

/**
 * @typedef {object} DefectSignature
 * @property {string} id
 * @property {string} name            what a reader would call it
 * @property {RegExp} pattern         run per line, never across a whole work
 * @property {'withdraw'|'trim'|'review'} disposition
 * @property {string} discoveredIn    the work that taught us
 * @property {string} discoveredOn    ISO date
 * @property {string} why             what it is, in one sentence
 * @property {string[]} [exemptWorks] works where this pattern is genuine text
 */

/** @type {ReadonlyArray<DefectSignature>} */
export const DEFECT_SIGNATURES = Object.freeze([
    {
        id: 'transcriber-image-file',
        name: 'An image filename served as prose',
        pattern: /(^|\s)[\w-]+\.(jpg|jpeg|png|gif|svg)(\s|$)/iu,
        disposition: 'trim',
        discoveredIn: 'don-quixote',
        discoveredOn: '2026-08-12',
        why: 'Gutenberg HTML editions name their plates in the text; the scan '
            + 'keeps the filename and drops the picture.'
    },
    {
        id: 'file-size-annotation',
        name: 'A download size beside a plate',
        pattern: /\(\s*\d{1,4}\s*[KkMm][Bb]?\s*\)/u,
        disposition: 'trim',
        discoveredIn: 'don-quixote',
        discoveredOn: '2026-08-12',
        why: '`spine.jpg (152K)` — the weight of a file has no reading in it.'
    },
    {
        id: 'full-size-link',
        name: 'A dead image link',
        pattern: /^\s*Full\s+Size\s*$/iu,
        disposition: 'trim',
        discoveredIn: 'don-quixote',
        discoveredOn: '2026-08-12',
        why: 'The anchor text of a link to a larger scan, left behind as a line.'
    },
    {
        id: 'replacement-character',
        name: 'A character that did not survive an encoding',
        pattern: /�/u,
        disposition: 'review',
        discoveredIn: 'literary-letters-young-poet',
        discoveredOn: '2026-08-11',
        why: 'Fourteen German umlauts and eszetts destroyed mid-word — '
            + '`Dr?ckende`, `da?`. Recoverable by hand, so a repair rather than a cut.'
    },
    {
        id: 'page-image-emoji',
        name: 'A scanned image transcribed as an emoji',
        pattern: /[\u{1F4C4}\u{1F5BC}\u{1F4D6}]/u,
        disposition: 'trim',
        discoveredIn: 'sacred-emerald-tablet',
        discoveredOn: '2026-08-11',
        why: 'A folio image became U+1F4C4 PAGE FACING UP, served mid-sentence.'
    },
    {
        id: 'scan-provider-header',
        name: "The scanner's own header",
        pattern: /Digitized\s+by\s+Google|Google™/iu,
        disposition: 'trim',
        discoveredIn: 'a-hundred-verses-from-old-japan',
        discoveredOn: '2026-08-11',
        why: 'Page furniture from the digitiser, not from the book.'
    },
    {
        id: 'variorum-sigla',
        name: 'Critical apparatus from a variorum edition',
        pattern: /\]\s*(om\.|Ff\.|Qq\.|Q[1-3]\.|conj\.)/u,
        disposition: 'review',
        discoveredIn: 'hamlet',
        discoveredOn: '2026-07-30',
        why: 'The fault that withdrew three Shakespeares: `140. at] Ff. om. Qq.` '
            + 'Kept as a signature so a future acquisition cannot repeat it unseen.'
    },
    {
        id: 'contents-run-out',
        name: 'A contents line — a title, then a page number',
        pattern: /\S\s{2,}\d{1,4}(\s*[-–]\s*\d{1,4})?\s*$/u,
        disposition: 'review',
        discoveredIn: 'a-hundred-and-seventy-chinese-poems',
        discoveredOn: '2026-08-11',
        why: 'A single line proves nothing; a division made of them is a '
            + 'contents page. Density is the evidence, so this is never a cut on its own.'
    },
    {
        id: 'html-entity',
        name: 'An HTML entity that was never decoded',
        pattern: /&(amp|lt|gt|quot|nbsp|[aeiouAEIOU](uml|acute|grave|circ)|szlig|mdash|ndash|hellip|#\d{2,5});/u,
        disposition: 'review',
        discoveredIn: 'literary-letters-young-poet',
        discoveredOn: '2026-08-12',
        why: 'Found in this registry\'s own first sweep, on the line beside the '
            + 'replacement characters: `Zwar f&uuml;hlen viele junge Menschen`. The '
            + 'German survived the scan and then failed to be decoded, which is the '
            + 'same accident twice in one sentence.'
    },
    {
        id: 'gutenberg-boilerplate',
        name: 'Project Gutenberg licence boilerplate',
        pattern: /Project\s+Gutenberg(-tm)?\s+(License|eBook|Literary\s+Archive)/iu,
        disposition: 'trim',
        discoveredIn: 'don-quixote',
        discoveredOn: '2026-08-12',
        why: 'The distributor speaking, inside the reading.'
    },
    {
        id: 'transcriber-note',
        name: "A transcriber's or editor's note",
        pattern: /^\s*(Transcriber|Ebook\s+Editor|Editor)['’]?s?\s+Note/iu,
        disposition: 'review',
        discoveredIn: 'don-quixote',
        discoveredOn: '2026-08-12',
        why: 'Sometimes genuine scholarship about the edition, sometimes a '
            + 'note about image formats. A human decides which.'
    },
    {
        id: 'bibliography-as-division-title',
        name: 'A bibliography entry standing as a division name',
        pattern: /^.{0,40}=\s*\p{Lu}\w*\s*\(\p{Lu}[.\s\p{Lu}]*\)/u,
        disposition: 'review',
        discoveredIn: 'sacred-corpus-hermeticum',
        discoveredOn: '2026-08-18',
        why: 'Its 244 divisions are named from a works-cited list — "Volume 1 '
            + '— D. J, L. = Mead (G. E. S.), Did Jesus L…" — so the scheme '
            + 'counts references rather than tractates. Found while sending '
            + 'division labels to the curator, where a name is what a reader '
            + 'chooses by; a division named for a citation cannot be chosen.'
    }
]);

/** @returns {DefectSignature|undefined} */
export function defectSignature(id) {
    return DEFECT_SIGNATURES.find(signature => signature.id === id);
}

/**
 * Every signature that fires on one line, with the line as its own evidence.
 * Per LINE rather than per work: a pattern that must match a whole payload
 * cannot say where the defect is, and a finding you cannot point at is not
 * actionable.
 */
export function scanLine(line, { skip = new Set() } = {}) {
    const text = String(line ?? '');
    if (!text.trim()) return [];
    return DEFECT_SIGNATURES
        .filter(signature => !skip.has(signature.id))
        .filter(signature => signature.pattern.test(text))
        .map(signature => signature.id);
}
