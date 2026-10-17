/**
 * Build the pinned Haeckel plate catalog from Wikimedia Commons.
 *
 *   node scripts/build-haeckel-catalog.mjs
 *
 * Run by hand: CI has no network, and the reader's browser never asks
 * Commons for anything but the image bytes. The Commons gallery page
 * "Kunstformen der Natur" lists one file per plate, in plate order; the
 * script pins that page's revision, reads each file's size, sha1 and
 * licence, refuses any plate that is not public domain by age, checks that
 * every image URL it records answers, and only then replaces
 * src/sources/visual/haeckel-catalog.generated.json.
 *
 * The display image is a 1920 px thumbnail on upload.wikimedia.org (Commons
 * serves only its standard thumbnail widths; 1920 is the one nearest 2000),
 * or the original when the original is narrower.
 */

import { writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const OUTPUT_URL = new URL('../src/sources/visual/haeckel-catalog.generated.json', import.meta.url);
const API = 'https://commons.wikimedia.org/w/api.php';
const GALLERY = 'Kunstformen der Natur';
const PLATES = 100;
const DISPLAY_WIDTH = 1920;
const USER_AGENT = 'RISE Haeckel catalog build (https://github.com/sykosyber)';

async function get(url, init = {}) {
    for (let attempt = 1; ; attempt++) {
        const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
        if (response.ok) return response;
        // 429 is Commons pacing a thumbnail it has to render; wait as asked.
        const retryable = response.status === 429 || response.status >= 500;
        if (attempt >= 6 || !retryable) throw new Error(`${response.status} ${url}`);
        const wait = Number(response.headers.get('retry-after')) || 5 * attempt;
        await new Promise(resolve => setTimeout(resolve, wait * 1000));
    }
}

const api = async params => (await get(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`)).json();

/** `{ plate, file, title, genus }` per line of the gallery's first block, in plate order. */
function galleryPlates(wikitext) {
    const block = /<gallery[^>]*>([\s\S]*?)<\/gallery>/u.exec(wikitext)?.[1];
    if (!block) throw new Error('the gallery page holds no gallery');
    return block.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const match = /^(?:Image|File):([^|]+)\|(\d+)\.\s*(.+)$/u.exec(line);
        if (!match) throw new Error(`unreadable gallery line: ${line}`);
        const caption = match[3].replace(/\{\{[^}]*\}\}/gu, '').replace(/\([^)]*\)/gu, '').trim();
        const [title, genus = null] = caption.split(';').map(part => part.trim());
        return { plate: Number(match[2]), file: `File:${match[1].trim().replace(/_/gu, ' ')}`, title, genus: genus || null };
    });
}

const text = node => node.textContent.replace(/\s+/gu, ' ').trim();

const BINOMIAL = /^[A-Z][a-z]+ [a-z]+(?:-[a-z]+)?$/u;

/**
 * The organisms a file's description lists, one per item (its figure index).
 * A description that lists fewer than two is not an index, so the species
 * categories Commons files the plate under name them instead; a description
 * without a list is kept as the plate's note. Figures are never read.
 */
function described(html, categories) {
    const body = new JSDOM(`<body>${html ?? ''}</body>`).window.document.body;
    body.querySelectorAll('figure, img, style, script').forEach(node => node.remove());
    const list = body.querySelectorAll('li');
    const items = [...list].map(text).filter(Boolean);
    if (items.length >= 2) return { organisms: items, note: null };
    const species = categories.split('|').map(name => name.trim()).filter(name => BINOMIAL.test(name));
    const prose = list.length ? '' : text(body).replace(/^Enlarge image for index to numbers\.?\s*/iu, '');
    return { organisms: species, note: prose || null };
}

/** upload.wikimedia.org path of a file, from its original URL; the thumb sits beside it. */
function displayUrl(original, width, fileName) {
    if (width <= DISPLAY_WIDTH) return original;
    const { pathname } = new URL(original);
    const tail = pathname.replace('/wikipedia/commons/', '');
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${tail}/${DISPLAY_WIDTH}px-${encodeURIComponent(fileName.replace(/ /gu, '_'))}`;
}

async function answers(url) {
    const response = await get(url, { method: 'HEAD' });
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`${url} answered ${type}`);
}

async function main() {
    const page = await api({ action: 'parse', page: GALLERY, prop: 'wikitext|revid' });
    const plates = galleryPlates(page.parse.wikitext);
    const numbers = plates.map(plate => plate.plate);
    if (numbers.join() !== Array.from({ length: PLATES }, (_, i) => i + 1).join()) {
        throw new Error(`the gallery lists plates ${numbers.join(', ')}`);
    }

    const info = new Map();
    for (let i = 0; i < plates.length; i += 50) {
        const batch = plates.slice(i, i + 50);
        const result = await api({
            action: 'query', prop: 'imageinfo', iiprop: 'url|size|sha1|extmetadata',
            titles: batch.map(plate => plate.file).join('|')
        });
        const normalized = new Map((result.query.normalized ?? []).map(entry => [entry.to, entry.from]));
        for (const entry of result.query.pages) {
            if (entry.missing) throw new Error(`${entry.title} is missing on Commons`);
            info.set(normalized.get(entry.title) ?? entry.title, { title: entry.title, ...entry.imageinfo[0] });
        }
    }

    const refused = [];
    const out = [];
    for (const plate of plates) {
        const file = info.get(plate.file);
        if (!file) throw new Error(`no imageinfo for ${plate.file}`);
        const meta = file.extmetadata ?? {};
        const value = key => String(meta[key]?.value ?? '');
        const licence = value('LicenseShortName');
        const pdOld = /(?:^|\|)PD[ -]old/iu.test(value('Categories'));
        if (licence !== 'Public domain' || value('Copyrighted') !== 'False' || !pdOld) {
            refused.push(`${plate.plate} ${file.title}: licence ${JSON.stringify(licence)}, PD-old ${pdOld}`);
            continue;
        }
        const original = file.url.split('?')[0];
        const name = file.title.replace(/^File:/u, '');
        const image = displayUrl(original, file.width, name);
        const { organisms, note } = described(value('ImageDescription'), value('Categories'));
        out.push({
            plate: plate.plate,
            title: plate.title,
            genus: plate.genus,
            file: file.title,
            image,
            original,
            width: file.width,
            height: file.height,
            sha1: file.sha1,
            licence,
            pdOld,
            organisms,
            note,
            sourceUrl: file.descriptionurl,
            attribution: `Ernst Haeckel, Kunstformen der Natur, 1904, Tafel ${plate.plate}; public domain; Wikimedia Commons, ${file.title}`
        });
    }
    if (refused.length) throw new Error(`refusing to write; not public domain by age:\n  ${refused.join('\n  ')}`);

    for (const plate of out) {
        await answers(plate.image);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const catalog = {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: {
            gallery: `https://commons.wikimedia.org/wiki/${GALLERY.replace(/ /gu, '_')}`,
            revid: page.parse.revid,
            category: 'https://commons.wikimedia.org/wiki/Category:Kunstformen_der_Natur'
        },
        plates: out
    };
    await writeFile(OUTPUT_URL, `${JSON.stringify(catalog, null, 2)}\n`);
    const listed = out.filter(plate => plate.organisms.length).length;
    console.log(`wrote ${out.length} plates (revision ${page.parse.revid}); ${listed} list their organisms, ${out.filter(p => p.note).length} carry a note`);
}

await main();
