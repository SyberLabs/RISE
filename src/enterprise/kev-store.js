/**
 * Model files live on disk, never whole in a worker's memory. Kev and the
 * matcher's embedder both load through here.
 *
 * Kev-4B is 4.7 GB; held as buffers it overflows the tab. Each file is
 * streamed straight into Cache Storage and handed back as a Blob backed by
 * that entry, which the runtime reads one tensor at a time. A file with a
 * pinned digest is hashed as it streams in, and again from the cache each
 * time it is reused, so a stale or unverified entry is never served. Every
 * key carries the revision the file was pinned at, so a rebuilt bundle never
 * reads an old one's bytes.
 */

import { sha256Stream } from './sha256.js';

export const CACHE_NAME = 'kev-web-v1';

export const UNPINNED = 'weights are not pinned; run scripts/pin-kev-weights.mjs';

export class LoadFailure extends Error {
    constructor(code, detail = null) {
        super(code);
        this.code = code;
        this.detail = detail;
    }
}

export const cacheKey = (url, rev) => `${url}${url.includes('?') ? '&' : '?'}kev-rev=${encodeURIComponent(rev)}`;

/** Every file a variant of the manifest loads, in load order: tokenizer, its config, the head, the graph, then the weights. */
export function variantFiles(manifest, variantId) {
    const variant = manifest.variants?.[variantId];
    if (!variant) throw new LoadFailure('wrong-model', `no variant ${variantId}`);
    const { files } = manifest;
    return [files.tokenizer, files.tokenizer_config, files.head, variant.model, ...variant.data];
}

/** The pinned size and digest of one file of a device model; refused when the model, or this file of it, is not pinned. */
export function pinnedFile(model, path) {
    const pin = model.files?.[path];
    if (!pin) throw new LoadFailure('unpinned', model.files ? path : UNPINNED);
    return pin;
}

async function digestOf(stream) {
    const hash = sha256Stream();
    const reader = stream.getReader();
    for (let next = await reader.read(); !next.done; next = await reader.read()) hash.update(next.value);
    return hash.digest();
}

export async function storedFile(cache, url, { rev, bytes, sha256, file = url, onProgress, fetchFile = fetch } = {}) {
    const key = cacheKey(url, rev);
    const hit = await cache.match(key);
    if (hit) {
        const blob = await hit.blob();
        if ((!bytes || blob.size === bytes) && (!sha256 || await digestOf(blob.stream()) === sha256)) {
            onProgress?.({ file, loaded: blob.size, total: blob.size });
            return blob;
        }
        await cache.delete(key);
    }

    let response;
    try {
        response = await fetchFile(url, { credentials: 'omit' });
    } catch {
        throw new LoadFailure('network', file);
    }
    if (!response.ok || !response.body) throw new LoadFailure('network', `${file} ${response.status}`);

    let loaded = 0;
    const hash = sha256 ? sha256Stream() : null;
    const counted = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            loaded += chunk.byteLength;
            hash?.update(chunk);
            onProgress?.({ file, loaded, total: bytes || loaded });
            controller.enqueue(chunk);
        }
    }));
    try {
        await cache.put(key, new Response(counted, { headers: { 'content-type': 'application/octet-stream' } }));
    } catch (error) {
        await cache.delete(key);
        throw new LoadFailure(error?.name === 'QuotaExceededError' ? 'storage' : 'network', file);
    }

    const blob = await (await cache.match(key))?.blob();
    if (!blob || (bytes && blob.size !== bytes)) {
        await cache.delete(key);
        throw new LoadFailure('network', `${file} incomplete`);
    }
    if (hash && hash.digest() !== sha256) {
        await cache.delete(key);
        throw new LoadFailure('digest', file);
    }
    return blob;
}

/**
 * A superseded bundle is gigabytes of quota: drop this model's files from
 * every other revision, including those fetched from the same bundle at
 * another ref (`resolve/<ref>/<bundle>/`), as before it was pinned to a commit.
 */
export async function dropOtherRevisions(cache, baseUrl, rev) {
    const base = baseUrl.replace(/\/$/u, '');
    const [repo, refAndBundle] = base.split('/resolve/');
    const bundle = refAndBundle.slice(refAndBundle.indexOf('/'));
    const sameBundle = (url) => {
        if (!url.startsWith(`${repo}/resolve/`)) return false;
        const rest = url.slice(`${repo}/resolve/`.length);
        return rest.slice(rest.indexOf('/')).startsWith(`${bundle}/`);
    };
    for (const request of await cache.keys()) {
        if (!sameBundle(request.url)) continue;
        if (!request.url.startsWith(`${base}/`) || new URL(request.url).searchParams.get('kev-rev') !== rev) await cache.delete(request.url);
    }
}
