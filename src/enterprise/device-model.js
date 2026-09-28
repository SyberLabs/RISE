/**
 * What "Kev on this device" is allowed to load.
 *
 * Each model is named by its published bundle and the checkpoint its
 * manifest must report. A manifest naming any other checkpoint is refused
 * before a byte of weights is fetched. The ONNX Runtime WebAssembly binary
 * is too large to serve from this site, so it is fetched from a
 * version-pinned address and must hash to the value of the copy in the
 * lockfile before the runtime sees it.
 */

export const DEVICE_MODELS = Object.freeze({
    'kev-4b': Object.freeze({
        label: 'Kev-4B',
        base: 'https://huggingface.co/ai-ecoverse/kev.js/resolve/main/kev-4b',
        // The same checkpoint the server Kev serves (deploy/kev/modal_app.py).
        run: 'jaredpalmer/kev-4b@139fdd94f1b6a6ad80cc15e08fcb99cac885a101',
        variant: 'q8f32',
        bytes: 4_700_000_000
    }),
    'kev-0.8b': Object.freeze({
        label: 'Kev-0.8B',
        base: 'https://huggingface.co/ai-ecoverse/kev.js/resolve/main/kev-0.8b',
        run: 'jaredpalmer/kev-0.8b@9a45d25eb2ab761841196625383fa1dff0e56c1e',
        variant: 'q8f32',
        bytes: 822_000_000
    })
});

export const DEFAULT_DEVICE_MODEL = 'kev-4b';

export const ORT_WASM = Object.freeze({
    url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.asyncify.wasm',
    sha256: '39f9f0894d478800487ed9f7dbe92618498db320cf55c8e3d89adff8dce658da'
});

/** A manifest `run` matches when it is the pinned repo at a commit that begins with the pinned hash. */
export function runMatches(run, pinned) {
    if (typeof run !== 'string' || typeof pinned !== 'string') return false;
    const [repo, commit = ''] = run.split('@');
    const [pinnedRepo, pinnedCommit] = pinned.split('@');
    return repo === pinnedRepo && /^[0-9a-f]+$/u.test(commit) && commit.startsWith(pinnedCommit);
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '?';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    return `${Math.round(bytes / 1e6)} MB`;
}
