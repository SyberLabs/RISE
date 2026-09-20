/**
 * The code that goes on the card.
 *
 * A minted sequence exists to be printed and scanned, and the only thing
 * that has to be exactly right is the URL inside the code — a typo on a
 * card cannot be recalled. So the URL is built from the register rather
 * than typed, and the script refuses any slug the register does not carry.
 *
 * NOT PART OF THE BUILD, and deliberately. A QR is a one-off artefact per
 * mint, not something to regenerate on every deploy: running it in the
 * build would add a dependency to the critical path for a file that only
 * changes when a sequence does. `qrcode` is a devDependency for the same
 * reason — nothing here reaches the browser bundle, which is held to a
 * ratcheting first-load budget.
 *
 * SVG because a code that will be printed must not be resampled. Vector
 * scales to a poster; a PNG at the wrong size is a code that will not scan.
 *
 *   node scripts/mint-program-qr.mjs                  every mint
 *   node scripts/mint-program-qr.mjs <slug>           one of them
 *   node scripts/mint-program-qr.mjs --origin <url>   against another host
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { HOUSE_PROGRAMS, houseProgram, programPath } from '../src/content/programs/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs/mints');

/** Where a scanned code actually goes. */
const DEFAULT_ORIGIN = 'https://rise.syberlabs.space';

/**
 * Error correction, and why this level.
 *
 * M recovers about 15% of a damaged code. A card gets thumbed, folded and
 * photographed at an angle, and L does not survive that; H would survive
 * more but costs modules, and a denser code is a code a phone has to work
 * harder to resolve at the same printed size.
 */
const ERROR_CORRECTION = 'M';

function parseArgs(argv) {
    const args = { slugs: [], origin: DEFAULT_ORIGIN };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--origin') args.origin = argv[++i] || DEFAULT_ORIGIN;
        else args.slugs.push(argv[i]);
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const origin = args.origin.replace(/\/+$/u, '');

    const mints = args.slugs.length
        ? args.slugs.map(slug => {
            const entry = houseProgram(slug);
            // A slug the register does not carry has no URL to encode, and
            // a code pointing at a 404 is worse than no code.
            if (!entry) throw new Error(`"${slug}" is not a minted sequence`);
            return entry;
        })
        : HOUSE_PROGRAMS;

    mkdirSync(OUT_DIR, { recursive: true });

    for (const entry of mints) {
        const url = `${origin}${programPath(entry.slug)}`;
        const svg = await QRCode.toString(url, {
            type: 'svg',
            errorCorrectionLevel: ERROR_CORRECTION,
            margin: 2
        });
        const file = resolve(OUT_DIR, `${entry.slug}.svg`);
        writeFileSync(file, svg);

        // The module count is the number that decides whether this scans at
        // the size it will be printed, so it is reported rather than buried.
        const modules = /viewBox="0 0 (\d+)/u.exec(svg)?.[1] ?? '?';
        console.log(`[mint] ${entry.slug}`);
        console.log(`       ${url}`);
        console.log(`       ${modules}x${modules} modules, EC ${ERROR_CORRECTION} -> ${file}`);
    }
    console.log(`\n[mint] ${mints.length} code(s) in ${OUT_DIR}`);
}

main().catch(error => {
    console.error(`[mint] ${error?.message || error}`);
    process.exitCode = 1;
});
