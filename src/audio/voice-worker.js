/**
 * Voice worker — Kokoro TTS, off the main thread.
 *
 * The model is 82M parameters and inference is CPU-bound: at least one
 * project reports it locking a tab during load. A reading environment
 * cannot freeze mid-phrase, so synthesis never touches the thread that
 * paints the text.
 *
 * PROTOCOL. Every message carries an `id` so responses correlate with
 * requests. Voice serializes generation for the ONNX session, while
 * load progress remains an uncorrelated broadcast.
 *
 *   → { id, type: 'load', dtype, device }
 *   ← { id, type: 'progress', progress }        (repeatedly, during load)
 *   ← { id, type: 'ready', voices }
 *   ← { id, type: 'error', error }
 *
 *   → { id, type: 'speak', text, voice }
 *   ← { id, type: 'audio', samples, sampleRate, blob, diagnostics }
 *   ← { id, type: 'error', error }
 *
 * The audio view is compacted once inside the worker, then its exact
 * buffer is transferred. A tensor backend may expose a view into a
 * larger allocation; transferring that backing allocation would make
 * the receiver depend on offset/layout details that are irrelevant to
 * the utterance. Kokoro's own Float32 WAV Blob accompanies it as the
 * reference media fallback.
 */

let tts = null;
let loading = null;
let runtimeDiagnostics = null;
const ortWasmModuleUrl = new URL(
    '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
    import.meta.url
).href;
const ortWasmBinaryUrl = new URL(
    '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
    import.meta.url
).href;

/**
 * Load once, and let concurrent callers share the same attempt.
 *
 * Without this, two `load` messages arriving close together would each
 * fetch the model. That is not hypothetical: the Chamber may warm the voice
 * while a reader also toggles it on.
 */
async function ensureModel({ dtype, device }) {
    if (tts) return tts;
    if (loading) return loading;

    loading = (async () => {
        // Imported inside the worker, and inside the function, so the
        // The weights are fetched only when a reading actually asks
        // for a voice — never as a side effect of loading the app.
        const { KokoroTTS } = await import('kokoro-js');

        // SELF-HOST THE ONNX RUNTIME.
        //
        // transformers.js loads its WASM backend from cdn.jsdelivr.net
        // at runtime. That is a third-party CDN executing code, and
        // `script-src 'self'` is the strongest line in our policy —
        // weakening it so a voice can speak would be a bad trade.
        //
        // Import both runtime files through Vite's explicit asset-URL
        // contract. A public/ file can be fetched, but Vite deliberately
        // rejects importing its .mjs as source during development. These
        // URLs are hashed, same-origin assets in both dev and production.
        // Set BEFORE the first model load, because the path is read when
        // the backend initialises and cannot be changed afterwards.
        const { env } = await import('@huggingface/transformers');
        env.backends.onnx.wasm.wasmPaths = {
            mjs: ortWasmModuleUrl,
            wasm: ortWasmBinaryUrl
        };
        tts = await KokoroTTS.from_pretrained(
            'onnx-community/Kokoro-82M-v1.0-ONNX',
            {
                dtype,
                device,
                progress_callback: (p) => {
                    if (p?.status === 'progress' && Number.isFinite(p.progress)) {
                        self.postMessage({ type: 'progress', progress: p.progress });
                    }
                }
            }
        );
        runtimeDiagnostics = {
            crossOriginIsolated: self.crossOriginIsolated === true,
            numThreads: env.backends.onnx.wasm.numThreads ?? 1,
            hardwareConcurrency: self.navigator?.hardwareConcurrency ?? null
        };
        return tts;
    })();

    try {
        return await loading;
    } finally {
        // Cleared either way: a failed load must be retryable rather
        // than leaving every later request awaiting a rejected promise.
        loading = null;
    }
}

self.onmessage = async ({ data }) => {
    const { id, type } = data || {};
    try {
        if (type === 'load') {
            const model = await ensureModel({
                dtype: data.dtype || 'q4f16',
                device: data.device || 'wasm'
            });
            self.postMessage({
                id,
                type: 'ready',
                voices: Object.keys(model.voices || {}),
                runtimeDiagnostics
            });
            return;
        }

        if (type === 'speak') {
            if (!tts) throw new Error('voice not loaded');
            const generationStarted = performance.now();
            const audio = await tts.generate(data.text, { voice: data.voice || 'af_heart' });
            const generationMs = performance.now() - generationStarted;
            // Kokoro's official browser demo encodes inside the worker
            // with RawAudio.toBlob(). Keep that reference path for media
            // fallback, and compact the sample view before transfer so a
            // WebGPU tensor backed by a larger readback allocation can
            // never expose adjacent bytes at the worker boundary.
            const source = audio.audio;
            const sampleRate = Number(audio.sampling_rate);
            if (!source?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
                throw new Error('Kokoro returned invalid audio metadata');
            }

            const samples = new Float32Array(source);
            let peak = 0;
            for (let i = 0; i < samples.length; i++) {
                const value = samples[i];
                if (!Number.isFinite(value)) {
                    throw new Error(`Kokoro returned a non-finite sample at ${i}`);
                }
                peak = Math.max(peak, Math.abs(value));
            }
            const blob = audio.toBlob();
            const audioDurationMs = (samples.length / sampleRate) * 1000;
            self.postMessage(
                {
                    id,
                    type: 'audio',
                    samples,
                    sampleRate,
                    blob,
                    diagnostics: {
                        sourceByteOffset: source.byteOffset,
                        sourceByteLength: source.byteLength,
                        sourceBufferByteLength: source.buffer?.byteLength,
                        transferredByteLength: samples.byteLength,
                        peak,
                        generationMs: Math.round(generationMs),
                        audioDurationMs: Math.round(audioDurationMs),
                        realTimeFactor: Number((generationMs / audioDurationMs).toFixed(2))
                    }
                },
                [samples.buffer]
            );
            return;
        }

        throw new Error(`unknown message type '${type}'`);
    } catch (error) {
        // Never let a failure hang the caller. The Chamber's contract is
        // that a reading which cannot be spoken is read silently, and
        // that requires the rejection to actually arrive.
        self.postMessage({ id, type: 'error', error: String(error?.message || error) });
    }
};
