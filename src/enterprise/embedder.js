/**
 * The page's handle on the embedder worker. Until it is ready, or after it
 * fails, `embed` rejects and the room keeps matching the way it did without
 * it; nothing here ever blocks a decision.
 */

function defaultWorker() {
    return new Worker(new URL('./embed-worker.js', import.meta.url), { type: 'module', name: 'embed' });
}

export function createEmbedder({ createWorker = defaultWorker, onChange } = {}) {
    let worker = null;
    let loading = null;
    let nextId = 0;
    const pending = new Map();
    const status = { state: 'idle', code: null, detail: null, loadMs: null };

    function changed(patch) {
        Object.assign(status, patch);
        onChange?.({ ...status });
    }

    function failAll(reason) {
        for (const { reject } of pending.values()) reject(new Error(reason));
        pending.clear();
    }

    function load() {
        if (loading) return loading;
        loading = new Promise((resolve) => {
            try {
                worker = createWorker();
            } catch {
                changed({ state: 'failed', code: 'no-worker' });
                resolve({ ...status });
                return;
            }
            worker.onmessage = ({ data }) => {
                if (data?.type === 'ready') {
                    changed({ state: 'ready', loadMs: data.info?.loadMs ?? null });
                    resolve({ ...status });
                } else if (data?.type === 'failed') {
                    changed({ state: 'failed', code: data.code, detail: data.detail ?? null });
                    failAll('unavailable');
                    resolve({ ...status });
                } else if (data?.type === 'vectors') {
                    const entry = pending.get(data.id);
                    if (!entry) return;
                    pending.delete(data.id);
                    if (data.error) entry.reject(new Error(data.error));
                    else entry.resolve(data.vectors);
                }
            };
            worker.onerror = () => {
                changed({ state: 'failed', code: status.state === 'ready' ? 'crashed' : 'load-error' });
                failAll('error');
                resolve({ ...status });
            };
            changed({ state: 'loading' });
            worker.postMessage({ type: 'load' });
        });
        return loading;
    }

    /** Unit vectors for `texts`, in order. `query` marks a line to match rather than a source. */
    function embed(texts, { query = false } = {}) {
        if (status.state !== 'ready') return Promise.reject(new Error('unavailable'));
        const id = ++nextId;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            worker.postMessage({ type: 'embed', id, texts, query });
        });
    }

    return {
        load,
        embed,
        status: () => ({ ...status }),
        dispose() {
            failAll('stopped');
            worker?.terminate();
            worker = null;
            loading = null;
            changed({ state: 'idle' });
        }
    };
}
