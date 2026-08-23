/**
 * Emit the data plane: one immutable JSON object per served work, addressed
 * by the hash of its own bytes, plus the manifest that is the only contract
 * between the two planes.
 *
 * A TEXT IS DATA. The moment it became a program, every system that touched
 * it started paying for a compiler it never needed — Rollup parsed a novel
 * as JavaScript, git versioned it as source, the test runner's fork budget
 * was sized around it, and the browser re-parsed it as a program to get a
 * string back out. Fifteen works were 10.4 MB of the shipped bundle and text
 * was 83% of all the JavaScript RISE served.
 *
 * This reads the generated work modules ONCE, at build time, and writes what
 * a reader actually needs: `[{name, content, verse?}, ...]` as JSON, under
 * the SHA-256 of the exact bytes written. The hash is the URL, so a reader's
 * browser re-verifies on arrival, every time, for free — a silently
 * corrupted CDN object cannot be read. That is a property the module-graph
 * design could not have at any price.
 *
 * WITHHOLDING BECOMES A FIELD, NOT A CODE PATH. Eighty works keep their
 * metadata and their stated reason in the manifest with no url. Nothing
 * needs a build-time filter to keep them out of the bundle, because nothing
 * about them is built.
 *
 * Output is generated, not source: `public/content/` is gitignored and this
 * runs ahead of `vite build`.
 */

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
    CORE_WORKS,
    WITHHELD_WORKS,
    ingestedArchiveTexts
} from '../../src/content/archive/index.js';
import { LITERATURE_WORKS } from '../../src/content/archive/literature-catalog.js';
import { LEGACY_REINGESTED_WORKS } from '../../src/content/archive/legacy-catalog.js';
import { CHAPEL_BOOKS } from '../../src/content/chapel/corpus/manifest.js';

export const CONTENT_MANIFEST_SCHEMA = 'rise.content-manifest.v1';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/content');
const WORKS_DIR = resolve(OUT, 'works');
const CHAPEL_DIR = resolve(OUT, 'chapel');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** The generators name a work's export from its id, and always have. */
export const sectionsExportName = id =>
    `${id.toUpperCase().replace(/-/g, '_')}_SECTIONS`;

export const metaExportName = id =>
    `${id.toUpperCase().replace(/-/g, '_')}_META`;

async function readWork(id) {
    const module = await import(`../../src/content/archive/works/${id}.js`);
    const sections = module[sectionsExportName(id)];
    if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error(`${id}: ${sectionsExportName(id)} is not a non-empty array`);
    }
    // The generated module's own META is authoritative for the ingest
    // checksum. The five hand-written catalogue entries in index.js carry
    // only the browsing fields and never repeated it — a second copy would
    // be a second thing to keep true.
    return { sections, meta: module[metaExportName(id)] ?? null };
}

export async function buildContentPlane({ write = true } = {}) {
    const served = ingestedArchiveTexts();
    const declared = [...CORE_WORKS, ...LEGACY_REINGESTED_WORKS, ...LITERATURE_WORKS];
    const metaById = new Map(declared.map(work => [work.meta?.id, work.meta]));

    if (write) {
        await rm(WORKS_DIR, { recursive: true, force: true });
        await rm(CHAPEL_DIR, { recursive: true, force: true });
        await mkdir(WORKS_DIR, { recursive: true });
        await mkdir(CHAPEL_DIR, { recursive: true });
    }

    const works = [];

    for (const text of served) {
        const { sections, meta } = await readWork(text.id);
        // The bytes are the artifact. Serialize once, hash exactly what will
        // be written, and never re-serialize — a second JSON.stringify with a
        // different spacing would produce a different address for the same
        // book.
        const bytes = Buffer.from(JSON.stringify(sections), 'utf8');
        const digest = sha256(bytes);
        if (write) {
            await writeFile(resolve(WORKS_DIR, `${digest}.json`), bytes);
        }
        works.push({
            id: text.id,
            sha256: digest,
            bytes: bytes.length,
            url: `/content/works/${digest}.json`,
            shelved: true,
            // The ingest's own digest of the payload it wrote, carried
            // through untouched. It binds certification to bytes and is NOT
            // the delivery address: this file's sha256 is.
            payloadChecksum: meta?.payloadChecksum
                ?? metaById.get(text.id)?.payloadChecksum
                ?? null,
            certificationStatus: text.certificationStatus ?? null
        });
    }

    for (const [id, reason] of Object.entries(WITHHELD_WORKS)) {
        works.push({ id, shelved: false, withheldReason: reason });
    }

    works.sort((left, right) => left.id.localeCompare(right.id));

    /**
     * Scripture was already content-addressed and simply not delivered that
     * way: every entry in CHAPEL_BOOKS carries `checksum`, the SHA-256 of the
     * book's exact text, and handoff.js has refused a book that did not match
     * it since the corpus was written. Making that digest the URL costs
     * nothing and takes 5 MB of Douay-Rheims out of the JavaScript bundle.
     *
     * The payload is one string of verse-sentinelled text, not JSON, so it
     * ships as .txt and is verified as bytes.
     */
    const chapel = [];
    for (const book of CHAPEL_BOOKS) {
        const module = await import(`../../src/content/chapel/corpus/books/${book.id}.js`);
        const text = module[book.constName];
        if (typeof text !== 'string' || !text.trim()) {
            throw new Error(`${book.id}: ${book.constName} is not a non-empty string`);
        }
        const bytes = Buffer.from(text, 'utf8');
        const digest = sha256(bytes);
        if (digest !== book.checksum) {
            throw new Error(
                `${book.id}: payload hashes to ${digest} but the manifest `
                + `declares ${book.checksum}. Refusing to publish scripture `
                + 'under an address its bytes do not satisfy.'
            );
        }
        if (write) {
            await writeFile(resolve(CHAPEL_DIR, `${digest}.txt`), bytes);
        }
        chapel.push({
            id: book.id,
            sha256: digest,
            bytes: bytes.length,
            url: `/content/chapel/${digest}.txt`,
            shelved: true
        });
    }

    const manifest = {
        schema: CONTENT_MANIFEST_SCHEMA,
        // Names this exact set of works and addresses. A reader holding an
        // older revision holds older addresses, and every address it holds
        // is still valid, because the objects are immutable.
        revision: sha256(Buffer.from(JSON.stringify([works, chapel]), 'utf8')).slice(0, 16),
        generatedAt: new Date().toISOString(),
        works,
        chapel
    };

    if (write) {
        await writeFile(
            resolve(OUT, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`
        );
    }
    return manifest;
}
