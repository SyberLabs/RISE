/**
 * Parse the approved imaginative-literature dossier into accession data.
 *
 * The prose dossier is the editorial authority. Keeping the parser here
 * means the ingest cannot quietly acquire a title with different shelf,
 * division, rights basis, or completeness claim from the approved record.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOSSIER_PATH = resolve(
    ROOT,
    'docs/ingest-records/SOL-PD-ACQUISITIONS-DOSSIER-LITERATURE-2026-07-28.md'
);

const FORM_CROSS_SHELF = new Set([
    'W06', 'W10', 'W12', 'W13', 'W24', 'W26', 'W28', 'W39', 'W40',
    'W41', 'E02', 'E04', 'E07', 'E09', 'E12', 'I01', 'I08'
]);

const RELEASE_GATES = Object.freeze({
    I01: 'Community review/contact and access-restriction fields are required before public release.',
    I02: 'Community review/contact and access-restriction fields are required before public release.',
    I03: 'Community review/contact and access-restriction fields are required before public release.',
    I04: 'Community review/contact and access-restriction fields are required before public release.',
    I05: 'Community review/contact and access-restriction fields are required before public release.',
    I06: 'Community review/contact and access-restriction fields are required before public release.',
    I07: 'Community review/contact and access-restriction fields are required before public release.',
    I08: 'Community review/contact and access-restriction fields are required before public release.'
});

function clean(value = '') {
    return value.replace(/\r/g, '').trim();
}

function labelled(block, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return clean(block.match(new RegExp(`^- \\*\\*${escaped}:\\*\\* (.+)$`, 'm'))?.[1]);
}

function slug(value) {
    return value.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function links(value) {
    return [...value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)]
        .map(([, label, url]) => ({ label, url }));
}

function proseList(value) {
    return value.split(';').map(clean).filter(Boolean);
}

export function parseLiteratureDossier(markdown = readFileSync(DOSSIER_PATH, 'utf8')) {
    const heading = /^### ([WEI]\d{2}) — \*(.+)\*$/gm;
    const hits = [...markdown.matchAll(heading)];
    return hits.map((match, i) => {
        const code = match[1];
        const title = match[2];
        const block = markdown.slice(
            match.index + match[0].length,
            hits[i + 1]?.index ?? markdown.indexOf('\n## Form & Design cross-shelf', match.index)
        );
        const placement = labelled(block, 'author / shelf / division');
        const place = placement.match(/^(.*);\s*`([^`]+)`;\s*`([^`]+)`$/);
        if (!place) throw new Error(`${code}: cannot parse author/shelf/division`);

        const editionLine = labelled(block, 'edition / source / basis');
        const basis = editionLine.match(/`([^`]+)`\s*$/)?.[1];
        const sourceLinks = links(editionLine);
        if (!basis || !sourceLinks.length) throw new Error(`${code}: cannot parse edition/source/basis`);

        const functionsLine = labelled(block, 'functions / rhymes');
        const [functionText, rhymeText = ''] = functionsLine.split(';', 2);
        const functions = [...functionText.matchAll(/`([^`]+)`/g)].map(m => m[1]);
        const structureLine = labelled(block, 'structure / reading unit / bounds');
        const [levels = '', readingUnit = '', bounds = ''] = proseList(structureLine);
        const extentLine = labelled(block, 'extent / caveats');
        const [extentClaim = '', ...caveats] = proseList(extentLine);

        return {
            code,
            id: slug(title),
            title,
            author: clean(place[1]),
            traditionShelf: place[2],
            shelf: place[2],
            subjectShelves: FORM_CROSS_SHELF.has(code) ? ['form'] : [],
            division: place[3],
            why: labelled(block, 'why'),
            functions,
            rhymes: rhymeText.split(',').map(clean).filter(Boolean),
            provenance: {
                edition: clean(editionLine.replace(/;\s*\[[^\n]+$/, '')),
                year: Number(editionLine.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1]) || null,
                basis,
                evidence: [labelled(block, 'evidence')],
                sources: sourceLinks
            },
            structure: {
                levels: proseList(levels.replace(/\s*with\b.*$/i, '')),
                readingUnit,
                startRule: bounds,
                endRule: bounds
            },
            extent: /^full\b/i.test(extentClaim) || /^both volumes, full/i.test(extentClaim)
                ? 'full'
                : extentClaim,
            caveats,
            releaseGate: RELEASE_GATES[code] || null
        };
    });
}

export function assertDossier(entries) {
    const expected = { W: 42, E: 16, I: 8 };
    const actual = { W: 0, E: 0, I: 0 };
    for (const entry of entries) actual[entry.code[0]]++;
    if (entries.length !== 66 || Object.keys(expected).some(k => actual[k] !== expected[k])) {
        throw new Error(`dossier must contain W42/E16/I08 (found ${JSON.stringify(actual)})`);
    }
    const ids = new Set(entries.map(e => e.id));
    if (ids.size !== entries.length) throw new Error('dossier creates duplicate accession ids');
    return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const entries = assertDossier(parseLiteratureDossier());
    for (const entry of entries) {
        console.log(`${entry.code}  ${entry.id.padEnd(48)} ${entry.provenance.sources.length} source(s)`);
    }
}
