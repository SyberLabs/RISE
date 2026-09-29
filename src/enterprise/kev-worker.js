/**
 * Kev inference off the main thread, so the transcript and rail never wait
 * on the GPU.
 *
 * Load order: WebGPU adapter, then the manifest (refused unless it names the
 * pinned checkpoint), then the runtime binary (refused unless it hashes to
 * the pinned digest), then the weights. WebGPU only: the CPU fallback is too
 * slow for a live rail, so a device without a usable adapter reports that
 * and loads nothing.
 *
 * The weights never sit whole in this worker (see kev-store.js). The JSPI
 * build of the runtime is the one that reads a Blob lazily, one tensor at a
 * time on its way to the GPU, so a browser without JSPI loads nothing.
 */

import * as ort from 'onnxruntime-web/jspi';
import { Kev, PointerHead } from '@ai-ecoverse/kev.js';
import { Tokenizer } from '@huggingface/tokenizers';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jspi.wasm?url';
import { DEVICE_MODELS, ORT_WASM, runMatches } from './device-model.js';
import { CACHE_NAME, dropOtherRevisions, LoadFailure, storedFile } from './kev-store.js';

let kev = null;

const post = (message) => self.postMessage(message);

async function sha256(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function adapterInfo() {
    if (!self.navigator?.gpu) throw new LoadFailure('no-webgpu');
    const adapter = await self.navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new LoadFailure('no-adapter');
    const info = adapter.info || {};
    return {
        vendor: info.vendor || '',
        architecture: info.architecture || '',
        description: info.description || '',
        maxBufferSize: adapter.limits?.maxBufferSize ?? null
    };
}

async function fetchChecked(url, label) {
    let response;
    try {
        response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    } catch {
        throw new LoadFailure('network', label);
    }
    if (!response.ok) throw new LoadFailure('network', `${label} ${response.status}`);
    return response;
}

function progressReporter() {
    const files = new Map();
    let last = 0;
    return (update) => {
        files.set(update.file, update);
        const now = performance.now();
        if (now - last < 200 && update.loaded < update.total) return;
        last = now;
        let loaded = 0;
        let total = 0;
        for (const file of files.values()) {
            loaded += file.loaded;
            total += file.total;
        }
        post({ type: 'progress', loaded, total });
    };
}

async function load(modelId) {
    const model = DEVICE_MODELS[modelId];
    if (!model) throw new LoadFailure('unknown-model', modelId);
    const started = performance.now();
    const adapter = await adapterInfo();
    post({ type: 'phase', phase: 'manifest', adapter });

    const manifest = await (await fetchChecked(`${model.base}/manifest.json`, 'manifest')).json();
    if (!runMatches(manifest.run, model.run)) throw new LoadFailure('wrong-model', String(manifest.run));

    const variant = manifest.variants?.[model.variant];
    if (!variant) throw new LoadFailure('wrong-model', `no variant ${model.variant}`);

    post({ type: 'phase', phase: 'runtime' });
    if (typeof WebAssembly.Suspending !== 'function') throw new LoadFailure('no-jspi');
    const wasm = new Uint8Array(await (await fetchChecked(ortWasmUrl, 'runtime')).arrayBuffer());
    if (await sha256(wasm) !== ORT_WASM.sha256) throw new LoadFailure('runtime-digest');
    ort.env.wasm.wasmBinary = wasm;
    ort.env.wasm.numThreads = 1;

    post({ type: 'phase', phase: 'download' });
    if (typeof caches === 'undefined') throw new LoadFailure('storage', 'no Cache Storage');
    const cache = await caches.open(CACHE_NAME);
    const rev = manifest.revision ?? manifest.run;
    await dropOtherRevisions(cache, model.base, rev);
    const onProgress = progressReporter();
    const sizes = variant.sizes || {};
    // Announce every file up front so the total does not grow as downloads start.
    for (const [file, bytes] of Object.entries(sizes)) onProgress({ file, loaded: 0, total: bytes });
    const file = (path) => storedFile(cache, `${model.base}/${path}`, { rev, bytes: sizes[path], file: path, onProgress });
    const { files } = manifest;
    const [tokenizerJson, tokenizerConfig, head, graph] = await Promise.all(
        [files.tokenizer, files.tokenizer_config, files.head, variant.model].map(file));
    const weights = [];
    for (const path of variant.data) weights.push({ path: path.split('/').pop(), data: await file(path) });

    post({ type: 'phase', phase: 'session' });
    const session = await ort.InferenceSession.create(new Uint8Array(await graph.arrayBuffer()), {
        ...Kev.sessionOptions(manifest, model.variant, true),
        executionProviders: ['webgpu'],
        externalData: weights
    });
    kev = new Kev({
        ort,
        session,
        head: PointerHead.fromSafetensors(await head.arrayBuffer()),
        tokenizer: new Tokenizer(JSON.parse(await tokenizerJson.text()), JSON.parse(await tokenizerConfig.text())),
        manifest,
        variant: model.variant
    });

    // The first run compiles GPU shaders; pay for it here, not on the first live line.
    await kev.systemOne({
        state: 'warm up',
        questions: { warm: { type: 'choice', criteria: { a: 'First.', b: 'Second.' } } }
    });
    return {
        run: kev.manifest.run,
        revision: kev.manifest.revision ?? null,
        variant: kev.variant,
        adapter,
        loadMs: Math.round(performance.now() - started)
    };
}

self.onmessage = async ({ data }) => {
    if (data?.type === 'load') {
        try {
            post({ type: 'ready', info: await load(data.model) });
        } catch (error) {
            kev = null;
            post({
                type: 'failed',
                code: error instanceof LoadFailure ? error.code : 'load-error',
                detail: error instanceof LoadFailure ? error.detail : String(error?.message || error).slice(0, 200)
            });
        }
        return;
    }
    if (data?.type === 'ask') {
        if (!kev) {
            post({ type: 'answer', id: data.id, error: 'not-ready' });
            return;
        }
        try {
            const started = performance.now();
            const response = await kev.systemOne(data.request);
            post({ type: 'answer', id: data.id, response, inferenceMs: Math.round(performance.now() - started) });
        } catch {
            post({ type: 'answer', id: data.id, error: 'inference' });
        }
    }
};
