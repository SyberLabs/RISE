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
 * q8/WASM produced healthy samples but could not sustain the real
 * Chamber: its measured browser throughput was about 5.8 seconds of
 * generation for each roughly 2-second phrase. A finite head start only
 * postponed the underrun.
 *
 * Kokoro's supported q4f16/WASM model measured RTF 0.34–0.38 on the same
 * CPU probe, versus 1.15–1.26 for q8. It can replenish the rolling lead
 * while the reader speaks, without selecting experimental WebGPU merely
 * because a browser exposes it.
 *
 * So: warm the model early, build a lead before the first word, and
 * keep generating the nearest useful phrases ahead. If a slow device
 * still loses the lead, stop speaking rather than stall the reading,
 * abandon stale generation, and resume only after rebuilding a cushion.
 */

import { speechOnsets } from '../core/recitation.js';

const VOICE_DTYPE = 'q4f16';
const VOICE_DEVICE = 'wasm';

/** How many atoms to keep generated ahead of the one being read. */
const LEAD = 12;

/**
 * How much lead must exist before the voice starts speaking at all.
 *
 * Without this the first phrase to finish generating is spoken alone,
 * then the reading falls silent until the next one happens to be ready.
 * A voice that stutters in and out reads far worse than one that waits
 * and then stays — so speech begins once, late, and continues.
 */
const LEAD_TO_BEGIN = 8;

/**
 * After a real underrun, wait for a smaller contiguous cushion before
 * resuming. This prevents one newly-finished phrase from making the
 * voice stutter on/off while still recovering.
 */
const LEAD_TO_RESUME = 4;

/**
 * Below this the buffer has lost its race and speech steps aside.
 * Chosen so the reading degrades a phrase or two BEFORE it would have
 * to wait — a silent reading is a reading; a stalled one is a fault.
 */
const STARVED = 1;

export class Voice {
    constructor({ audioEngine = null, voiceId = null } = {}) {
        this.audioEngine = audioEngine;
        this.enabled = false;
        // af_heart is the model's reference voice and the only one it
        // grades A. Most of the twenty-four are C or D, so an unknown
        // or absent choice falls back here rather than to whatever
        // happens to be first.
        this.voiceId = voiceId || 'af_heart';

        this._worker = null;
        this._pending = new Map();     // id → {resolve, reject}
        this._seq = 0;
        this._ready = null;            // in-flight or settled load
        this._cache = new Map();       // atom index → {samples, sampleRate}
        this._generating = new Set();  // indices currently in flight
        this._jobs = new Map();        // index → settled generation promise
        this._generationQueue = new Map(); // index → queued generation task
        this._drainPromise = null;
        this._activeGeneration = null;
        this._atoms = null;            // current reading, for contiguous lead checks
        this._current = null;          // the playback now speaking
        this._queue = Promise.resolve(); // generation runs one at a time
        this._failed = false;          // load failed; never retry this session
        this._loaded = false;          // the MODEL is up, not merely the worker
        this._speaking = false;        // the lead was reached and speech began
        this._everSpoken = false;
        this._starvedAt = null;
        this._readerIndex = 0;         // how far the reading has actually got
        this._warned = new Set();      // causes already reported this session
        this._reportedAudioPath = false;
        this.onProgress = null;
    }

    /**
     * Is speech available and working?
     *
     * The worker EXISTING is not the model being LOADED, and conflating
     * the two cost a reader their session. Kokoro is 155 MB and takes
     * tens of seconds to fetch; throughout that window every speak
     * request threw `voice not loaded` and cleared its in-flight flag on
     * the way out, so the Chamber — which primes on every atom — queued
     * the same eight indices again, and again, several times a second.
     *
     * Nothing about that was audible as a voice failure. What it did was
     * flood the main thread with rejections and stack traces until the
     * audio graph could not fill its buffers, and a reader heard the
     * drones tear into a buzz. The fix is this one condition: no request
     * is made until there is a model to answer it.
     */
    get available() {
        return this.enabled && !this._failed && this._loaded;
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

                const ready = await this._send('load', {
                    // WebGPU is still an experimental Transformers.js
                    // backend. Chrome and Edge expose the same Windows
                    // path, so choosing it merely because navigator.gpu
                    // exists made both browsers produce the same unusable
                    // samples. q8/WASM fixed the corruption but could not
                    // keep up with a live reading. Kokoro's documented
                    // q4f16 dtype on WASM was ~3x faster in the CPU probe and
                    // remains deterministic across Chrome and Edge.
                    dtype: VOICE_DTYPE,
                    device: VOICE_DEVICE
                });
                const runtime = ready.runtimeDiagnostics || {};
                console.info(
                    `[Voice] Kokoro ready — ${VOICE_DTYPE}/${VOICE_DEVICE.toUpperCase()}, `
                    + `${runtime.numThreads ?? 1} thread(s), `
                    + `cross-origin isolated: ${runtime.crossOriginIsolated === true}`
                );
                this._loaded = true;
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
        this._atoms = atoms;
        this._readerIndex = fromIndex;

        let speakableAhead = 0;
        for (let i = fromIndex; i < atoms.length && speakableAhead < LEAD; i++) {
            const text = this._speakable(atoms[i]);
            if (!text) continue;
            speakableAhead++;
            if (this._cache.has(i) || this._generating.has(i)) continue;

            this._enqueueGeneration(i, text);
        }
        this._queue = this._drainGenerationQueue();
        this._evictBefore(fromIndex - 2);
    }

    /**
     * Load the model and build the initial contiguous lead before the
     * Chamber becomes visible. Generation beyond the lead remains queued,
     * so entry waits only for what the first uninterrupted passage needs.
     */
    async prepare(atoms, fromIndex = 0) {
        if (!Array.isArray(atoms)) return false;
        const loaded = await this.load();
        if (!loaded) return false;

        this._atoms = atoms;
        this.prime(atoms, fromIndex);
        const targets = this._leadIndices(atoms, fromIndex);
        const jobs = targets
            .filter(index => !this._cache.has(index))
            .map(index => this._jobs.get(index))
            .filter(Boolean);
        await Promise.all(jobs);
        return targets.length > 0 && targets.every(index => this._cache.has(index));
    }

    /**
     * Speak an atom if its audio is ready.
     *
     * Returns onsets so the reveal can follow the voice, or null when
     * nothing is spoken. **Never waits.** A reading that pauses to let
     * the synthesiser catch up has stopped being a reading.
     *
     * @returns {{onsets: number[], durationMs: number, finished: Promise}|null}
     */
    speak(index) {
        if (!this.available) return null;

        // An authored pause is silence, not an underrun. Preserve the
        // narration state while Kokoro uses that time to refill.
        if (Array.isArray(this._atoms) && !this._speakable(this._atoms[index])) {
            return null;
        }

        // Speech begins (or resumes after an underrun) only with a
        // contiguous cushion. A single newly-finished phrase must not
        // make the narration stutter on and off.
        if (!this._speaking) {
            const needed = this._everSpoken ? LEAD_TO_RESUME : LEAD_TO_BEGIN;
            if (!this._hasLead(index, needed)) return null;
            this._speaking = true;
            if (this._starvedAt !== null) {
                console.info(`[Voice] narration resumed at atom ${index}`, {
                    starvedAt: this._starvedAt,
                    ...this._bufferState(index)
                });
                this._starvedAt = null;
            }
        }

        const entry = this._cache.get(index);
        if (!entry) {
            this._speaking = false;
            this._starvedAt = index;
            console.warn(`[Voice] buffer starved at atom ${index}; reading continues silently`, {
                resumeLead: LEAD_TO_RESUME,
                ...this._bufferState(index)
            });
            return null;
        }

        this.stop();
        const { samples, sampleRate, blob } = entry;
        const durationMs = (samples.length / sampleRate) * 1000;
        const playback = this._play(samples, sampleRate, index, blob);
        if (!playback) return null;
        this._everSpoken = true;

        return {
            onsets: speechOnsets(samples, sampleRate),
            durationMs,
            finished: playback.finished
        };
    }

    /** Is the buffer keeping up? */
    get starved() {
        return this._cache.size <= STARVED;
    }

    /** Stop whatever is speaking and restore the music. */
    stop() {
        if (!this._current) return;
        const playback = this._current;
        this._current = null;
        playback.interrupted = true;
        if (playback.source) {
            try { playback.source.stop(); } catch (_) { /* already ended */ }
        } else if (playback.element) {
            playback.element.pause();
            playback.finish('stopped');
        }
        this.audioEngine?.setVoiceDucking?.(false);
    }

    destroy() {
        this.stop();
        this._worker?.terminate();
        this._worker = null;
        for (const { reject } of this._pending.values()) reject(new Error('voice destroyed'));
        this._pending.clear();
        this._clearQueuedGeneration();
        this._cache.clear();
        this._generating.clear();
        this._jobs.clear();
        this._atoms = null;
    }

    // ── internals ───────────────────────────────────────────────

    _fail(message) {
        this._failed = true;
        console.warn('[Voice]', message, '— the reading continues silently');
        for (const { reject } of this._pending.values()) reject(new Error(message));
        this._pending.clear();
        this._clearQueuedGeneration();
        this._worker?.terminate();
        this._worker = null;
    }

    /**
     * Add work to the serial scheduler without fixing its FIFO position.
     *
     * The reader can advance while Kokoro is generating. A promise chain
     * preserves every old queue position, so after one underrun the
     * synthesiser can keep selecting phrases that have just become stale.
     * This scheduler re-evaluates the nearest useful phrase after every
     * inference and therefore catches up instead of chasing the reader.
     */
    _enqueueGeneration(index, text) {
        let settle;
        const job = new Promise(resolve => { settle = resolve; });
        this._generating.add(index);
        this._jobs.set(index, job);
        this._generationQueue.set(index, { text, job, settle });
    }

    _drainGenerationQueue() {
        if (this._drainPromise) return this._drainPromise;

        const run = (async () => {
            while (this.available && this._generationQueue.size > 0) {
                this._dropStaleGeneration();
                if (this._generationQueue.size === 0) break;

                // ONNX Runtime permits one run per session. Re-evaluate
                // and synthesize the nearest phrase still ahead.
                const index = Math.min(...this._generationQueue.keys());
                const task = this._generationQueue.get(index);
                this._generationQueue.delete(index);
                this._activeGeneration = index;

                try {
                    const audio = await this._send('speak', {
                        text: task.text,
                        voice: this.voiceId
                    });
                    // The reader may have passed this phrase while
                    // inference was running. Do not retain dead audio.
                    if (audio && index >= this._readerIndex) {
                        this._cache.set(index, {
                            samples: audio.samples,
                            sampleRate: audio.sampleRate,
                            blob: audio.blob || null,
                            diagnostics: audio.diagnostics || null
                        });
                    }
                } catch (error) {
                    this._warnUnspoken(index, error);
                } finally {
                    this._activeGeneration = null;
                    this._finishGeneration(index, task);
                }
            }
        })();

        this._drainPromise = run.finally(() => {
            this._drainPromise = null;
            // Work may have arrived after the loop observed an empty
            // queue. Start another drain without requiring a new atom.
            if (this.available && this._generationQueue.size > 0) {
                this._queue = this._drainGenerationQueue();
            }
        });
        return this._drainPromise;
    }

    _dropStaleGeneration() {
        for (const [index, task] of this._generationQueue) {
            if (index >= this._readerIndex) continue;
            this._generationQueue.delete(index);
            this._finishGeneration(index, task);
        }
    }

    _finishGeneration(index, task) {
        this._generating.delete(index);
        if (this._jobs.get(index) === task.job) this._jobs.delete(index);
        task.settle();
    }

    _clearQueuedGeneration() {
        for (const [index, task] of this._generationQueue) {
            this._finishGeneration(index, task);
        }
        this._generationQueue.clear();
    }

    /**
     * Report a cause once per session.
     *
     * The first version logged every failure. A model that had not
     * finished loading produced one per atom per advance — thousands of
     * warnings, each with a full async stack trace — and the console
     * work alone was enough to starve the audio thread. The diagnostic
     * became the fault.
     *
     * Still logged, though: a silent failure looks identical to a slow
     * one, and the two want different fixes.
     */
    _warnUnspoken(index, error) {
        const reason = String(error?.message || error);
        if (this._warned.has(reason)) return;
        this._warned.add(reason);
        console.warn(`[Voice] atom ${index} unspoken:`, reason,
            '— further reports of this cause suppressed');
    }

    /**
     * Play raw model samples in the already-unlocked Web Audio graph.
     *
     * This avoids a Float32 → PCM16 → Blob → media-decoder round trip,
     * gives the Player a real `onended` signal, and keeps narration under
     * the same user-gesture/audio-device lifecycle as the soundscape.
     * The HTML media path remains only as a graceful fallback for hosts
     * that have no AudioEngine.
     */
    _play(samples, sampleRate, index, nativeBlob = null) {
        const context = this.audioEngine?.context;
        if (context && context.state !== 'closed') {
            try {
                const buffer = context.createBuffer(1, samples.length, sampleRate);
                if (typeof buffer.copyToChannel === 'function') {
                    buffer.copyToChannel(samples, 0);
                } else {
                    buffer.getChannelData(0).set(samples);
                }

                const source = context.createBufferSource();
                source.buffer = buffer;
                source.connect(this.audioEngine.masterGain || context.destination);

                let settle;
                const finished = new Promise(resolve => { settle = resolve; });
                const playback = {
                    source,
                    interrupted: false,
                    finished,
                    finish: (reason, error = null) => {
                        if (!settle) return;
                        const resolve = settle;
                        settle = null;
                        if (this._current === playback) {
                            this._current = null;
                            this.audioEngine?.setVoiceDucking?.(false);
                        }
                        resolve({ reason, error });
                    }
                };

                source.onended = () =>
                    playback.finish(playback.interrupted ? 'stopped' : 'ended');
                this._current = playback;
                this.audioEngine?.setVoiceDucking?.(true);
                source.start();
                return playback;
            } catch (error) {
                this.stop();
                this.audioEngine?.setVoiceDucking?.(false);
                this._warnPlayback(index, error);
                // Continue into Kokoro's native Float32 WAV media path.
            }
        }

        try {
            if (!nativeBlob) {
                throw new Error('Kokoro native audio Blob unavailable');
            }
            const url = URL.createObjectURL(nativeBlob);
            const element = new Audio(url);
            let settle;
            const finished = new Promise(resolve => { settle = resolve; });
            const playback = {
                element,
                url,
                interrupted: false,
                finished,
                finish: (reason, error = null) => {
                    if (!settle) return;
                    const resolve = settle;
                    settle = null;
                    if (this._current === playback) {
                        this._current = null;
                        this.audioEngine?.setVoiceDucking?.(false);
                    }
                    URL.revokeObjectURL(url);
                    resolve({ reason, error });
                }
            };

            element.onended = () =>
                playback.finish(playback.interrupted ? 'stopped' : 'ended');
            element.onerror = () => {
                const error = element.error || new Error('voice media failed');
                this._warnPlayback(index, error);
                playback.finish('error', error);
            };
            this._current = playback;
            this.audioEngine?.setVoiceDucking?.(true);
            element.play().catch(error => {
                this._warnPlayback(index, error);
                playback.finish('error', error);
            });
            return playback;
        } catch (error) {
            this.audioEngine?.setVoiceDucking?.(false);
            this._warnPlayback(index, error);
            return null;
        }
    }

    _warnPlayback(index, error) {
        const reason = String(error?.message || error || 'voice playback failed');
        const key = `playback:${reason}`;
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[Voice] atom ${index} playback failed:`, reason,
            '— further reports of this cause suppressed');
    }

    _leadIndices(atoms, fromIndex, count = LEAD_TO_BEGIN) {
        const result = [];
        for (let i = fromIndex; i < atoms.length && result.length < count; i++) {
            if (this._speakable(atoms[i])) result.push(i);
        }
        return result;
    }

    _hasLead(index, count = LEAD_TO_BEGIN) {
        if (!Array.isArray(this._atoms)) return this._cache.size >= count;
        const targets = this._leadIndices(this._atoms, index, count);
        return targets.length > 0 && targets.every(i => this._cache.has(i));
    }

    _bufferState(index) {
        const targets = Array.isArray(this._atoms)
            ? this._leadIndices(this._atoms, index, LEAD)
            : [];
        return {
            cachedAhead: targets.filter(i => this._cache.has(i)).length,
            queuedAhead: targets.filter(i => this._generating.has(i)).length,
            rollingLead: LEAD,
            activeGeneration: this._activeGeneration
        };
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
        if (data.type === 'error') {
            request.reject(new Error(data.error));
            return;
        }
        if (data.type === 'audio' && !this._reportedAudioPath) {
            this._reportedAudioPath = true;
            const diagnostics = data.diagnostics || {};
            console.info(
                `[Voice] ${VOICE_DTYPE}/${VOICE_DEVICE.toUpperCase()} audio ready; `
                + 'compact Float32 transfer — '
                + `${data.sampleRate} Hz, ${data.samples?.length ?? 0} samples, `
                + `${diagnostics.generationMs ?? '?'} ms generation / `
                + `${diagnostics.audioDurationMs ?? '?'} ms audio `
                + `(RTF ${diagnostics.realTimeFactor ?? '?'})`,
                {
                sampleRate: data.sampleRate,
                samples: data.samples?.length,
                ...diagnostics
                }
            );
        }
        request.resolve(data);
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

}
