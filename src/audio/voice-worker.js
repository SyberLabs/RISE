/**
 * Voice worker — Kokoro TTS, off the main thread.
 *
 * The model is 82M parameters and inference is CPU-bound: at least one
 * project reports it locking a tab during load. A reading environment
 * cannot freeze mid-phrase, so synthesis never touches the thread that
 * paints the text.
 *
 * PROTOCOL. Every message carries an `id` so responses correlate with
 * requests, because generation is slow enough that several will be in
 * flight and they do not necessarily finish in order.
 *
 *   → { id, type: 'load', dtype, device }
 *   ← { id, type: 'progress', progress }        (repeatedly, during load)
 *   ← { id, type: 'ready', voices }
 *   ← { id, type: 'error', error }
 *
 *   → { id, type: 'speak', text, voice }
 *   ← { id, type: 'audio', samples, sampleRate }   samples transferred
 *   ← { id, type: 'error', error }
 *
 * The audio comes back as a transferred Float32Array rather than a
 * copy: a phrase is ~100k samples and copying every one of them across
 * the boundary would undo the point of being off-thread.
 */

let tts = null;
let loading = null;

/**
 * Load once, and let concurrent callers share the same attempt.
 *
 * Without this, two `load` messages arriving close together would each
 * fetch 92 MB. That is not hypothetical: the Chamber may warm the voice
 * while a reader also toggles it on.
 */
async function ensureModel({ dtype, device }) {
    if (tts) return tts;
    if (loading) return loading;

    loading = (async () => {
        // Imported inside the worker, and inside the function, so the
        // 92 MB of weights is fetched only when a reading actually asks
        // for a voice — never as a side effect of loading the app.
        const { KokoroTTS } = await import('kokoro-js');

        // SELF-HOST THE ONNX RUNTIME.
        //
        // transformers.js loads its WASM backend from cdn.jsdelivr.net
        // at runtime. That is a third-party CDN executing code, and
        // `script-src 'self'` is the strongest line in our policy —
        // weakening it so a voice can speak would be a bad trade.
        //
        // The runtime files ship inside the package, so they are copied
        // to public/ort/ and served from our own origin. Set BEFORE the
        // first model load, because the path is read when the backend
        // initialises and cannot be changed afterwards.
        const { env } = await import('@huggingface/transformers');
        env.backends.onnx.wasm.wasmPaths = '/ort/';
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
                dtype: data.dtype || 'q8',
                device: data.device || 'wasm'
            });
            self.postMessage({ id, type: 'ready', voices: Object.keys(model.voices || {}) });
            return;
        }

        if (type === 'speak') {
            if (!tts) throw new Error('voice not loaded');
            const audio = await tts.generate(data.text, { voice: data.voice || 'af_heart' });
            // Transfer rather than copy — see the header note.
            self.postMessage(
                { id, type: 'audio', samples: audio.audio, sampleRate: audio.sampling_rate },
                [audio.audio.buffer]
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
