/**
 * Kev inference off the main thread, so the transcript and rail never wait
 * on the GPU.
 *
 * Load order: WebGPU adapter, then the manifest (refused unless it names the
 * pinned checkpoint), then the runtime binary (refused unless it hashes to
 * the pinned digest), then the weights. WebGPU only: the CPU fallback is too
 * slow for a live rail, so a device without a usable adapter reports that
 * and loads nothing.
 */

import * as ort from 'onnxruntime-web/webgpu';
import { loadKev } from '@ai-ecoverse/kev.js';
import { DEVICE_MODELS, ORT_WASM, runMatches } from './device-model.js';

let kev = null;

const post = (message) => self.postMessage(message);

class LoadFailure extends Error {
    constructor(code, detail = null) {
        super(code);
        this.code = code;
        this.detail = detail;
    }
}

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

    post({ type: 'phase', phase: 'runtime' });
    const wasm = new Uint8Array(await (await fetchChecked(ORT_WASM.url, 'runtime')).arrayBuffer());
    if (await sha256(wasm) !== ORT_WASM.sha256) throw new LoadFailure('runtime-digest');
    ort.env.wasm.wasmBinary = wasm;
    ort.env.wasm.numThreads = 1;

    kev = await loadKev(model.base, {
        ort,
        variant: model.variant,
        executionProviders: ['webgpu'],
        vision: false,
        onProgress: progressReporter(),
        onPhase: (phase) => post({ type: 'phase', phase })
    });
    if (!runMatches(kev.manifest.run, model.run)) throw new LoadFailure('wrong-model', String(kev.manifest.run));

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
