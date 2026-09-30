/**
 * Model files live on disk, never whole in a worker's memory. Kev and the
 * matcher's embedder both load through here.
 *
 * Kev-4B is 4.7 GB; held as buffers it overflows the tab. Each file is
 * streamed straight into Cache Storage and handed back as a Blob backed by
 * that entry, which the runtime reads one tensor at a time. Keys match
 * kev.js's own, so files it cached earlier are reused, and every key carries
 * the bundle revision, so a rebuilt bundle never reads an old one's bytes.
 */

export const CACHE_NAME = 'kev-web-v1';

export class LoadFailure extends Error {
    constructor(code, detail = null) {
        super(code);
        this.code = code;
        this.detail = detail;
    }
}

export const cacheKey = (url, rev) => `${url}${url.includes('?') ? '&' : '?'}kev-rev=${encodeURIComponent(rev)}`;

export async function storedFile(cache, url, { rev, bytes, file = url, onProgress, fetchFile = fetch } = {}) {
    const key = cacheKey(url, rev);
    const hit = await cache.match(key);
    if (hit) {
        const blob = await hit.blob();
        if (!bytes || blob.size === bytes) {
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
    const counted = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            loaded += chunk.byteLength;
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
    return blob;
}

/** A superseded bundle is gigabytes of quota: drop this model's files from every other revision. */
export async function dropOtherRevisions(cache, baseUrl, rev) {
    const prefix = `${baseUrl.replace(/\/$/u, '')}/`;
    for (const request of await cache.keys()) {
        if (!request.url.startsWith(prefix)) continue;
        if (new URL(request.url).searchParams.get('kev-rev') !== rev) await cache.delete(request.url);
    }
}
