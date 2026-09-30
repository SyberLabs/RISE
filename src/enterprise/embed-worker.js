/**
 * The matcher's sentence embedder, off the main thread.
 *
 * Load order: the runtime binary, the model and its tokenizer, each refused
 * unless it hashes to its pinned digest (embed-model.js). Files are kept in
 * Cache Storage so a room opens without downloading them again. Requests run
 * one at a time; the model answers a sentence in milliseconds on the CPU.
 */

import * as ort from 'onnxruntime-web/wasm';
import { Tokenizer } from '@huggingface/tokenizers';
import { EMBED_MODEL, ORT_WASM_CPU } from './embed-model.js';
import { meanPool } from './embedding.js';
import { CACHE_NAME, cacheKey, LoadFailure, storedFile } from './kev-store.js';

const RUNTIME_REV = 'onnxruntime-web@1.30.0';

let model = null;
let queue = Promise.resolve();

const post = (message, transfer) => self.postMessage(message, transfer || []);

async function sha256(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verified(cache, file, rev) {
    const blob = await storedFile(cache, file.url, { rev, bytes: file.bytes, file: file.url.split('/').pop() });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (await sha256(bytes) !== file.sha256) {
        await cache.delete(cacheKey(file.url, rev));
        throw new LoadFailure('digest', file.url.split('/').pop());
    }
    return bytes;
}

async function load() {
    const started = performance.now();
    if (typeof caches === 'undefined') throw new LoadFailure('storage', 'no Cache Storage');
    const cache = await caches.open(CACHE_NAME);
    const { files, revision } = EMBED_MODEL;
    const [wasm, graph, tokenizerJson, tokenizerConfig] = await Promise.all([
        verified(cache, ORT_WASM_CPU, RUNTIME_REV),
        verified(cache, files.model, revision),
        verified(cache, files.tokenizer, revision),
        verified(cache, files.tokenizerConfig, revision)
    ]);
    ort.env.wasm.wasmBinary = wasm;
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(graph, { executionProviders: ['wasm'] });
    const text = (bytes) => new TextDecoder().decode(bytes);
    const tokenizer = new Tokenizer(JSON.parse(text(tokenizerJson)), JSON.parse(text(tokenizerConfig)));
    model = { session, tokenizer };
    return { loadMs: Math.round(performance.now() - started) };
}

async function embedOne(value) {
    const { session, tokenizer } = model;
    const encoded = tokenizer.encode(value);
    let ids = encoded.ids;
    let mask = encoded.attention_mask;
    if (ids.length > EMBED_MODEL.maxTokens) {
        // Keep the closing separator the model was trained to see.
        ids = [...ids.slice(0, EMBED_MODEL.maxTokens - 1), ids[ids.length - 1]];
        mask = mask.slice(0, EMBED_MODEL.maxTokens);
    }
    const shape = [1, ids.length];
    const feeds = {
        input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), shape),
        attention_mask: new ort.Tensor('int64', BigInt64Array.from(mask, BigInt), shape)
    };
    if (session.inputNames.includes('token_type_ids')) {
        feeds.token_type_ids = new ort.Tensor('int64', new BigInt64Array(ids.length), shape);
    }
    const out = await session.run(feeds);
    const hidden = out.last_hidden_state ?? out[session.outputNames[0]];
    return meanPool(hidden.data, mask, EMBED_MODEL.dims);
}

self.onmessage = ({ data }) => {
    if (data?.type === 'load') {
        queue = queue.then(async () => {
            try {
                post({ type: 'ready', info: await load() });
            } catch (error) {
                model = null;
                post({
                    type: 'failed',
                    code: error instanceof LoadFailure ? error.code : 'load-error',
                    detail: error instanceof LoadFailure ? error.detail : String(error?.message || error).slice(0, 200)
                });
            }
        });
        return;
    }
    if (data?.type === 'embed') {
        queue = queue.then(async () => {
            if (!model) {
                post({ type: 'vectors', id: data.id, error: 'not-ready' });
                return;
            }
            try {
                const prefix = data.query ? EMBED_MODEL.queryPrefix : '';
                const vectors = [];
                for (const value of data.texts) vectors.push(await embedOne(prefix + value));
                post({ type: 'vectors', id: data.id, vectors }, vectors.map(vector => vector.buffer));
            } catch {
                post({ type: 'vectors', id: data.id, error: 'inference' });
            }
        });
    }
};
