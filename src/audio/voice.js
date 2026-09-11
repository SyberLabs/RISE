/**
 * Static Recitation voice-pack playback.
 *
 * Kokoro is a build-time authoring tool, never a production dependency. The
 * browser receives small, pre-generated audio assets and a bundled manifest;
 * it performs no inference, creates no worker, downloads no model, and needs
 * no API key. A reading without complete pack coverage continues silently.
 */

import { speechOnsets } from '../core/recitation.js';
import {
    DEFAULT_VOICE_ID,
    getVoicePack,
    resolveVoicePackEntry,
    speakableText,
    voicePackManifest
} from './voice-pack.js';

const LEAD = 12;
const LEAD_TO_BEGIN = 8;
const STARVED = 1;

export class Voice {
    constructor({
        audioEngine = null,
        voiceId = null,
        manifest = voicePackManifest,
        fetchImpl = globalThis.fetch?.bind(globalThis)
    } = {}) {
        this.audioEngine = audioEngine;
        this.enabled = false;
        this.voiceId = voiceId || DEFAULT_VOICE_ID;
        this.manifest = manifest;
        this._fetch = fetchImpl;

        this._pack = null;
        this._ready = null;
        this._loaded = false;
        this._failed = false;
        this._sessionAvailable = false;
        this._atoms = null;
        this._readerIndex = 0;
        this._cache = new Map();
        this._loads = new Map();
        this._missing = new Set();
        this._controllers = new Map();
        this._current = null;
        this._queue = Promise.resolve();
        this._warned = new Set();
        this._reportedPlayback = false;
        this.onProgress = null;
    }

    get available() {
        return this.enabled && !this._failed && this._loaded;
    }

    /**
     * Static load is manifest admission only. It intentionally performs no
     * network request; assets are fetched only after a complete session match.
     */
    async load() {
        if (this._failed) return false;
        if (this._ready) return this._ready;

        this._ready = Promise.resolve().then(() => {
            this._pack = getVoicePack(this.voiceId, this.manifest);
            const entryCount = Object.keys(this._pack?.entries || {}).length;
            if (!this._pack || entryCount === 0 || typeof this._fetch !== 'function') {
                this._failed = true;
                this._warnOnce(
                    'pack-unavailable',
                    `static voice pack ${this.voiceId} is not installed`
                );
                return false;
            }
            this._loaded = true;
            console.info(
                `[Voice] static pack ready — ${this.voiceId}, ${entryCount} phrase assets`
            );
            return true;
        });
        return this._ready;
    }

    /**
     * Confirm full coverage before fetching anything. Partial narration is not
     * admitted: it sounds like a broken feature and makes network timing part
     * of the reading. A miss therefore disables speech for this session only.
     */
    async prepare(atoms, fromIndex = 0) {
        if (!Array.isArray(atoms)) return false;
        const loaded = await this.load();
        if (!loaded) return false;

        // THE CONTEXT MUST EXIST BEFORE A SINGLE CLIP IS FETCHED.
        //
        // _decode returns null when there is no AudioContext, and the
        // entry is then cached in that state — permanently, because
        // _ensureIndex serves it from cache and never decodes it again.
        // The opening lead is fetched here while the engine is still
        // being started elsewhere, so this was a race, and which side won
        // it depended on how fast the network was:
        //
        //   a warm reload    fetches return at once, before the context
        //                    exists — the whole lead caches with null
        //                    buffers and the reading opens silent
        //   a cold first load fetches are slow, the context is up by the
        //                    time they land, and everything speaks
        //
        // Which is exactly backwards from what one would guess, and
        // exactly what was reported: near-certain on reload, rare on a
        // fresh window. Decoding does not need the context RUNNING — a
        // suspended one decodes perfectly well — it only needs it to
        // exist, and init() is idempotent, so asking costs nothing.
        await this.audioEngine?.init?.();

        this._atoms = atoms;
        this._readerIndex = fromIndex;
        const coverage = this.coverage(atoms);
        if (coverage.speakable === 0 || coverage.missing > 0) {
            this._sessionAvailable = false;
            this._warnOnce(
                'session-unpacked',
                `reading is not in the ${this.voiceId} pack `
                + `(${coverage.missing} of ${coverage.speakable} phrases missing)`
            );
            return false;
        }

        this._sessionAvailable = true;
        const targets = this._leadIndices(atoms, fromIndex);
        const entries = await Promise.all(
            targets.map(index => this._ensureIndex(index))
        );

        // READINESS IS THE CLIP ABOUT TO BE SPOKEN, NOT ALL EIGHT OF THEM.
        //
        // This required every clip in the opening lead, and any one of
        // them missing set _sessionAvailable false — which is not "start
        // a little later", it is speak() returning null for the whole
        // reading, for good, because prime() refuses to run once that
        // flag is down. One slow fetch at position six and a reading
        // entirely present in the pack went silent from its first word.
        //
        // Whether a reading is speakable at all is already decided above,
        // by coverage, and that check is unchanged. This one is only
        // about whether the audio has arrived yet, so it asks about the
        // clip that is needed now. The rest of the lead is warmth: prime
        // keeps fetching it, and speak degrades one atom at a time if it
        // is ever outrun.
        const ready = targets.length > 0 && Boolean(entries[0]);
        const arrived = entries.filter(Boolean).length;
        if (!ready) this._sessionAvailable = false;
        else if (arrived < targets.length) {
            this._warnOnce(
                'lead-partial',
                `opening lead arrived ${arrived} of ${targets.length}; `
                + 'the reading begins and the rest follows'
            );
        }
        if (ready) this.prime(atoms, fromIndex);
        return ready;
    }

    coverage(atoms) {
        let speakable = 0;
        let missing = 0;
        for (const atom of Array.isArray(atoms) ? atoms : []) {
            const text = this._speakable(atom);
            if (!text) continue;
            speakable++;
            if (!resolveVoicePackEntry(this.voiceId, text, this.manifest)) {
                missing++;
            }
        }
        return { speakable, missing, complete: speakable > 0 && missing === 0 };
    }

    /**
     * Maintain a small HTTP/decode lead. Unlike inference, these requests are
     * independent and may run concurrently; browser and CDN caches do the
     * durable storage work.
     */
    prime(atoms, fromIndex) {
        if (!this.available || !this._sessionAvailable || !Array.isArray(atoms)) {
            return;
        }
        this._atoms = atoms;
        this._readerIndex = fromIndex;

        const targets = this._leadIndices(atoms, fromIndex, LEAD);
        this._queue = Promise.allSettled(
            targets.map(index => this._ensureIndex(index))
        );
        this._evictBefore(fromIndex - 2);
        this._abortBefore(fromIndex - 2);
    }

    /**
     * Speak only already-decoded audio. This method never waits.
     *
     * @returns {{onsets: number[], durationMs: number, finished: Promise}|null}
     */
    speak(index) {
        if (!this.available || !this._sessionAvailable) return null;
        if (Array.isArray(this._atoms) && !this._speakable(this._atoms[index])) {
            return null;
        }

        const entry = this._cache.get(index);
        if (!entry) {
            this._warnOnce(
                `starved:${index}`,
                `static audio was not ready at atom ${index}; reading continues silently`
            );
            return null;
        }

        this.stop();
        const playback = this._play(entry, index);
        if (!playback) return null;
        if (!this._reportedPlayback) {
            this._reportedPlayback = true;
            console.info(
                `[Voice] static audio playing — ${entry.sampleRate} Hz, `
                + `${Math.round(entry.durationMs)} ms, `
                + `${entry.audioBuffer ? 'Web Audio' : 'media fallback'}`
            );
        }
        return {
            onsets: entry.onsets,
            durationMs: entry.durationMs,
            finished: playback.finished
        };
    }

    get starved() {
        return this._cache.size <= STARVED;
    }

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
    }

    destroy() {
        this.stop();
        for (const controller of this._controllers.values()) controller.abort();
        this._controllers.clear();
        this._loads.clear();
        this._cache.clear();
        this._missing.clear();
        this._atoms = null;
        this._sessionAvailable = false;
    }

    async _ensureIndex(index) {
        if (this._cache.has(index)) return this._cache.get(index);
        if (this._missing.has(index)) return null;
        if (this._loads.has(index)) return this._loads.get(index);

        const atom = this._atoms?.[index];
        const manifestEntry = resolveVoicePackEntry(
            this.voiceId,
            atom,
            this.manifest
        );
        if (!manifestEntry) {
            this._missing.add(index);
            return null;
        }

        const controller = typeof AbortController === 'function'
            ? new AbortController()
            : null;
        if (controller) this._controllers.set(index, controller);

        const load = (async () => {
            try {
                const response = await this._fetch(manifestEntry.asset, {
                    signal: controller?.signal
                });
                if (!response?.ok) {
                    throw new Error(`asset returned HTTP ${response?.status ?? 'unknown'}`);
                }
                const bytes = await response.arrayBuffer();
                const mimeType = manifestEntry.mimeType || 'audio/wav';
                const blob = new Blob([bytes], { type: mimeType });
                const audioBuffer = await this._decode(bytes);
                const sampleRate = audioBuffer?.sampleRate
                    || Number(manifestEntry.sampleRate)
                    || 24000;
                const samples = audioBuffer?.getChannelData?.(0) || null;
                const durationMs = Number(manifestEntry.durationMs)
                    || (audioBuffer?.duration ? audioBuffer.duration * 1000 : 0);
                const onsets = Array.isArray(manifestEntry.onsetsMs)
                    ? manifestEntry.onsetsMs
                    : (samples ? speechOnsets(samples, sampleRate) : []);

                if (!(durationMs > 0)) {
                    throw new Error('asset has no valid duration');
                }
                const entry = {
                    audioBuffer,
                    blob,
                    durationMs,
                    onsets,
                    sampleRate
                };
                if (index >= this._readerIndex - 2) this._cache.set(index, entry);
                this.onProgress?.({
                    phase: 'asset',
                    loaded: this._cache.size,
                    total: LEAD
                });
                return entry;
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    this._missing.add(index);
                    this._warnOnce(
                        `asset:${manifestEntry.asset}`,
                        `${manifestEntry.asset} could not be loaded: `
                        + String(error?.message || error)
                    );
                }
                return null;
            } finally {
                this._loads.delete(index);
                this._controllers.delete(index);
            }
        })();

        this._loads.set(index, load);
        return load;
    }

    async _decode(bytes) {
        const context = this.audioEngine?.context;
        if (!context || context.state === 'closed'
            || typeof context.decodeAudioData !== 'function') {
            return null;
        }
        return context.decodeAudioData(bytes.slice(0));
    }

    _play(entry, index) {
        const context = this.audioEngine?.context;

        // A SUSPENDED CONTEXT IS A CLOCK THAT IS NOT RUNNING, and a buffer
        // started against one neither plays nor ends: `onended` does not
        // fire, so the promise below never settles, and the reading that
        // is waiting on it waits for good. That is the shape of the stall
        // that was reported — and of its cure, because pausing and
        // playing is a user gesture, which is the one thing a browser
        // accepts as permission to start audio.
        //
        // Asking for the context back costs nothing when it is already
        // running and fixes the case where entry outran the gesture. A
        // source started here begins the moment the clock does. Where the
        // browser refuses outright the Player's watchdog carries the
        // reading on without it.
        if (context?.state === 'suspended') {
            void Promise.resolve(this.audioEngine?.resume?.()).catch(() => {});
        }

        if (context && context.state !== 'closed' && entry.audioBuffer) {
            try {
                const source = context.createBufferSource();
                source.buffer = entry.audioBuffer;
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
                        }
                        resolve({ reason, error });
                    }
                };
                source.onended = () =>
                    playback.finish(playback.interrupted ? 'stopped' : 'ended');
                this._current = playback;
                source.start();
                return playback;
            } catch (error) {
                this.stop();
                this._warnPlayback(index, error);
            }
        }

        try {
            const url = URL.createObjectURL(entry.blob);
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
            element.play().catch(error => {
                this._warnPlayback(index, error);
                playback.finish('error', error);
            });
            return playback;
        } catch (error) {
            this._warnPlayback(index, error);
            return null;
        }
    }

    _warnPlayback(index, error) {
        this._warnOnce(
            `playback:${String(error?.message || error)}`,
            `atom ${index} playback failed: ${String(error?.message || error)}`
        );
    }

    _warnOnce(key, message) {
        if (this._warned.has(key)) return;
        this._warned.add(key);
        console.warn(`[Voice] ${message} — the reading continues silently`);
    }

    _leadIndices(atoms, fromIndex, count = LEAD_TO_BEGIN) {
        const result = [];
        for (let index = fromIndex;
            index < atoms.length && result.length < count;
            index++) {
            if (this._speakable(atoms[index])) result.push(index);
        }
        return result;
    }

    _speakable(atom) {
        return speakableText(atom);
    }

    _evictBefore(index) {
        for (const key of this._cache.keys()) {
            if (key < index) this._cache.delete(key);
        }
    }

    _abortBefore(index) {
        for (const [key, controller] of this._controllers) {
            if (key >= index) continue;
            controller.abort();
            this._controllers.delete(key);
        }
    }
}
