/**
 * The data plane, for the runtimes that have no origin to fetch it from.
 *
 * A work is an immutable object at `/content/works/<sha256>.json`, which a
 * browser resolves against its origin. Node has no origin: `fetch` refuses
 * a relative URL outright, so every Node entrance to the corpus — the
 * vitest suite and the Scriptorium CLI — would refuse every work.
 *
 * THIS IS NOT A SECOND CODE PATH FOR THE CORPUS. The store is unchanged:
 * it fetches a URL and verifies the bytes against the digest that URL
 * names. Only the transport differs, which is what the `fetchImpl` seam
 * exists for. A test therefore reaches a work exactly the way a reader
 * does — including the hash check — rather than by an `import()` that
 * proves only that a bundler could find a file.
 *
 * It also means a Node entrance reads what will actually be deployed:
 * these are the same bytes `vite build` copies into `dist/`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PUBLIC_ROOT = resolve(process.cwd(), 'public');

/**
 * Answer same-origin `/content/...` requests from `public/`, and hand
 * everything else to the fetch that was already installed.
 */
export function installContentPlaneFetch() {
    const upstream = globalThis.fetch?.bind(globalThis);

    globalThis.fetch = async function contentPlaneFetch(input, init) {
        const url = typeof input === 'string' ? input : input?.url ?? String(input);
        if (!url.startsWith('/content/')) {
            if (!upstream) throw new Error(`No fetch available for ${url}`);
            return upstream(input, init);
        }
        const path = join(PUBLIC_ROOT, url.replace(/^\//, '').split('?')[0]);
        if (!existsSync(path)) {
            // The store turns this into CONTENT_UNAVAILABLE, which is the
            // honest answer: the plane was not built.
            return new Response('not found', { status: 404 });
        }
        return new Response(readFileSync(path, 'utf8'), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };
}
