/**
 * Voice — Kokoro speech for the reading, with a rolling buffer.
 *
 * The main-thread half of the worker in voice-worker.js. Owns the
 * lifecycle (load once, lazily), the buffer (generate ahead of the
 * reader), and the degradation contract (a reading that cannot be
 * spoken is read silently, never stalled).
 *
 * WHY A BUFFER (TTS-RESEARCH, measured 2026-07-29)
 * ────────────────────────────────────────────────
 * Real-time factor is ~1.09 on CPU: generating a phrase takes slightly
 * longer than speaking it. Read naively that is fatal — the voice falls
 * further behind with every atom. It is not, because the deficit is 9%
 * and two things cover it:
 *
 *   - Readings are 19–23% silence. `[PAUSE]`, `[HOLD]`, and paragraph
 *     breaks are dead air the synthesiser generates straight through,
 *     so the buffer grows during silence faster than it drains during
 *     speech.
 *   - A head start drains at only RTF−1 per second. Thirty seconds of
 *     lead covers about five and a half minutes of continuous reading.
 *
 * So: warm the model early, build a lead before the first word, and
 * keep generating ahead. If the lead is ever lost, stop speaking rather
 * than stall the reading — `speak()` returns null and the Chamber falls
 * through to its own timing.
 */

import { speechOnsets } from '../core/recitation.js';

/** How many atoms to keep generated ahead of the one being read. */
const LEAD = 8;

/**
 * Below this the buffer has lost its race and speech steps aside.
 * Chosen so the reading degrades a phrase or two BEFORE it would have
 * to wait — a silent reading is a reading; a stalled one is a fault.
 */
const STARVED = 1;

export class Voice {
    constructor({ audioEngine = null } = {}) {
        this.audioEngine = audioEngine;
        this.enabled = false;
        this.voiceId = 'af_heart';

        this._worker = null;
        this._pending = new Map();     // id → {resolve, reject}
        this._seq = 0;
        this._ready = null;            // in-flight or settled load
        this._cache = new Map();       // atom index → {samples, sampleRate}
        this._generating = new Set();  // indices currently in flight
        this._current = null;          // the HTMLAudioElement now playing
        this._queue = Promise.resolve(); // generation runs one at a time
        this._failed = false;          // load failed; never retry this session
        this.onProgress = null;
    }

    /** Is speech available and working? */
    get available() {
        return this.enabled && !this._failed && !!this._worker;
    }

    /**
     * Bring the model up. Safe to call repeatedly and from anywhere —
     * the Chamber warms it on entry, and a reader toggling voice on
     * calls it again.
     */
    async load() {
        if (this._failed) return false;
        if (this._ready) return this._ready;

        this._ready = (async () => {
            if (typeof Worker === 'undefined') { this._failed = true; return false; }
            try {
                this._worker = new Worker(
                    new URL('./voice-worker.js', import.meta.url), { type: 'module' });
                this._worker.onmessage = (e) => this._onMessage(e.data);
                this._worker.onerror = () => this._fail('voice worker failed');

                // WebGPU is 10–100× faster than WASM and is the
                // difference between comfortable and marginal. fp32 is
                // recommended for WebGPU; q8 keeps the download small
                // on the CPU path most Safari and Firefox readers take.
                const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
                await this._send('load', {
                    dtype: webgpu ? 'fp32' : 'q8',
                    device: webgpu ? 'webgpu' : 'wasm'
                });
                return true;
            } catch (error) {
                this._fail(error?.message || 'voice unavailable');
                return false;
            }
        })();

        return this._ready;
    }

    /**
     * Generate ahead of the reader.
     *
     * Called as the reading advances. Everything already cached or in
     * flight is skipped, so this is cheap to call on every atom.
     */
    prime(atoms, fromIndex) {
        if (!this.available || !Array.isArray(atoms)) return;
        for (let i = fromIndex; i < Math.min(atoms.length, fromIndex + LEAD); i++) {
            const text = this._speakable(atoms[i]);
            if (!text) continue;
            if (this._cache.has(i) || this._generating.has(i)) continue;

            this._generating.add(i);
            // SERIALISED. ONNX Runtime rejects overlapping runs on one
            // session ("Session already started"), so firing the whole
            // lead at once made most of them fail — a sparse cache and
            // a generation storm, which read as speech that stuttered
            // in and out. Each request waits for the last.
            this._queue = this._queue
                .then(() => this._send('speak', { text, voice: this.voiceId }))
                .then(({ samples, sampleRate }) => {
                    this._cache.set(i, { samples, sampleRate });
                })
                .catch((error) => {
                    // Logged, not swallowed: a silent failure here looks
                    // identical to a slow one, and the two want
                    // different fixes.
                    console.warn(`[Voice] atom ${i} unspoken:`, error?.message || error);
                })
                .finally(() => this._generating.delete(i));
        }
        this._evictBefore(fromIndex - 2);
    }

    /**
     * Speak an atom if its audio is ready.
     *
     * Returns onsets so the reveal can follow the voice, or null when
     * nothing is spoken. **Never waits.** A reading that pauses to let
     * the synthesiser catch up has stopped being a reading.
     *
     * @returns {{onsets: number[], durationMs: number}|null}
     */
    speak(index) {
        if (!this.available) return null;
        const entry = this._cache.get(index);
        if (!entry) return null;              // starved: read on in silence

        this.stop();
        const { samples, sampleRate } = entry;
        const durationMs = (samples.length / sampleRate) * 1000;

        const el = new Audio(URL.createObjectURL(this._wav(samples, sampleRate)));
        this._current = el;
        this.audioEngine?.setVoiceDucking?.(true);
        el.onended = el.onerror = () => {
            if (this._current === el) {
                this.audioEngine?.setVoiceDucking?.(false);
                this._current = null;
            }
            URL.revokeObjectURL(el.src);
        };
        // A blocked autoplay must not leave the music ducked forever.
        el.play().catch(() => el.onended());

        return { onsets: speechOnsets(samples, sampleRate), durationMs };
    }

    /** Is the buffer keeping up? */
    get starved() {
        return this._cache.size <= STARVED;
    }

    /** Stop whatever is speaking and restore the music. */
    stop() {
        if (!this._current) return;
        const el = this._current;
        this._current = null;
        el.pause();
        this.audioEngine?.setVoiceDucking?.(false);
    }

    destroy() {
        this.stop();
        this._worker?.terminate();
        this._worker = null;
        for (const { reject } of this._pending.values()) reject(new Error('voice destroyed'));
        this._pending.clear();
        this._cache.clear();
        this._generating.clear();
    }

    // ── internals ───────────────────────────────────────────────

    _fail(message) {
        this._failed = true;
        console.warn('[Voice]', message, '— the reading continues silently');
        for (const { reject } of this._pending.values()) reject(new Error(message));
        this._pending.clear();
        this._worker?.terminate();
        this._worker = null;
    }

    _send(type, payload) {
        return new Promise((resolve, reject) => {
            if (!this._worker) return reject(new Error('no voice worker'));
            const id = ++this._seq;
            this._pending.set(id, { resolve, reject });
            this._worker.postMessage({ id, type, ...payload });
        });
    }

    _onMessage(data) {
        // Progress is broadcast, not correlated — it belongs to the
        // load as a whole rather than to one request.
        if (data.type === 'progress') { this.onProgress?.(data.progress); return; }

        const request = this._pending.get(data.id);
        if (!request) return;
        this._pending.delete(data.id);
        if (data.type === 'error') request.reject(new Error(data.error));
        else request.resolve(data);
    }

    /**
     * The text a synthesiser should say.
     *
     * Markers are notation for a reader, never words: `|` is a breath,
     * `[PAUSE]` is silence, and `*marks*` are stress. A voice reading
     * any of them aloud would be absurd.
     */
    _speakable(atom) {
        const raw = atom?.content;
        if (typeof raw !== 'string') return '';
        return raw
            .replace(/\*/g, '')
            .replace(/\|/g, ' ')
            .replace(/\[(PAUSE|HOLD|FLASH)\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Release audio the reader has passed; a long reading must not grow without bound. */
    _evictBefore(index) {
        for (const key of this._cache.keys()) {
            if (key < index) this._cache.delete(key);
        }
    }

    /** Minimal WAV container — an <audio> element will not take raw samples. */
    _wav(samples, sampleRate) {
        return new Blob([this._wavBuffer(samples, sampleRate)], { type: 'audio/wav' });
    }

    /**
     * The WAV bytes. Split from _wav so the encoding can be asserted
     * directly — jsdom's Blob has no arrayBuffer(), and a clamping bug
     * that only shows up as an audible click deserves a real test.
     */
    _wavBuffer(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const ascii = (offset, text) => {
            for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
        };
        ascii(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        ascii(8, 'WAVEfmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);            // PCM
        view.setUint16(22, 1, true);            // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        ascii(36, 'data');
        view.setUint32(40, samples.length * 2, true);
        for (let i = 0; i < samples.length; i++) {
            // Clamp before scaling: a sample outside [-1, 1] would wrap
            // to the opposite extreme and click audibly.
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        return buffer;
    }
}
