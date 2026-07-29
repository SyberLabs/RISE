/**
 * Voice — the contracts that hold when speech is unavailable.
 *
 * The invariant worth guarding is the one from RECITATION-SPEC §2: a
 * reading that cannot be spoken is read SILENTLY, never stalled. Every
 * failure path here must return rather than wait, because a reading
 * that pauses for a synthesiser has stopped being a reading.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Voice } from './voice.js';

describe('speakable text', () => {
    const voice = new Voice();

    it('strips every marker a reader sees as notation', () => {
        // `|` is a breath, [PAUSE] is silence, *marks* are stress. A
        // voice saying any of them aloud would be absurd.
        expect(voice._speakable({ content: 'how *beautiful* and *amazing*' }))
            .toBe('how beautiful and amazing');
        expect(voice._speakable({ content: 'This is | a phrase | boundary' }))
            .toBe('This is a phrase boundary');
        expect(voice._speakable({ content: 'Before [PAUSE] after' }))
            .toBe('Before after');
        expect(voice._speakable({ content: 'Hold [HOLD] steady' }))
            .toBe('Hold steady');
    });

    it('yields nothing for empty or non-text atoms', () => {
        expect(voice._speakable({ content: '' })).toBe('');
        expect(voice._speakable({ content: '   [PAUSE]  ' })).toBe('');
        expect(voice._speakable({})).toBe('');
        expect(voice._speakable(null)).toBe('');
    });
});

describe('degradation — the reading never stalls', () => {
    let voice;
    beforeEach(() => { voice = new Voice(); });

    it('speaks nothing when the voice is disabled', () => {
        expect(voice.available).toBe(false);
        expect(voice.speak(0)).toBeNull();
    });

    it('speaks nothing when the audio is not ready yet', () => {
        // The starved case. Returning null lets the Chamber fall
        // through to its own timing; waiting would freeze the reading.
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        expect(voice.speak(3)).toBeNull();
    });

    it('never retries a failed load', () => {
        // A device that cannot run the model will not start being able
        // to mid-session, and retrying would re-download 155 MB.
        voice._fail('no worker');
        expect(voice._failed).toBe(true);
        expect(voice.available).toBe(false);
        return expect(voice.load()).resolves.toBe(false);
    });

    it('rejects everything in flight when it fails', () => {
        // A pending promise nobody settles is how a reading hangs.
        voice._worker = { terminate: vi.fn() };
        const pending = new Promise((resolve, reject) =>
            voice._pending.set(1, { resolve, reject }));
        voice._fail('gone');
        return expect(pending).rejects.toThrow('gone');
    });

    it('primes nothing when unavailable', () => {
        const atoms = [{ content: 'one' }, { content: 'two' }];
        expect(() => voice.prime(atoms, 0)).not.toThrow();
        expect(voice._generating.size).toBe(0);
    });

    it('reports starvation from the buffer depth', () => {
        expect(voice.starved).toBe(true);
        voice._cache.set(0, {}); voice._cache.set(1, {}); voice._cache.set(2, {});
        expect(voice.starved).toBe(false);
    });
});

describe('buffer housekeeping', () => {
    it('releases audio the reader has passed', () => {
        // A long reading would otherwise accumulate every phrase it has
        // ever spoken — half a megabyte of samples each.
        const voice = new Voice();
        for (let i = 0; i < 10; i++) voice._cache.set(i, { samples: new Float32Array(1) });
        voice._evictBefore(6);
        expect([...voice._cache.keys()]).toEqual([6, 7, 8, 9]);
    });
});

/**
 * The generation storm.
 *
 * These are regression tests for a fault that crashed a reader's tab and
 * that the entire suite above was blind to, because every test here
 * reasoned about ONE request at a time. The fault only existed in the
 * relationship between requests: each was individually correct, and
 * together they saturated the main thread until the audio graph could
 * not fill its buffers and the drones tore into a buzz.
 *
 * The lesson is in the shape of the tests, not only their assertions —
 * what needed asserting was how OFTEN something happens, not whether it
 * can happen at all.
 */
describe('no request is made before there is a model to answer it', () => {
    it('uses Kokoro\'s supported q4f16 dtype on WASM', async () => {
        const sent = [];
        vi.stubGlobal('Worker', class {
            postMessage(message) {
                sent.push(message);
                queueMicrotask(() => this.onmessage({
                    data: { id: message.id, type: 'ready', voices: ['af_heart'] }
                }));
            }
            terminate() {}
        });

        const voice = new Voice();
        voice.enabled = true;
        await expect(voice.load()).resolves.toBe(true);
        expect(sent[0]).toMatchObject({
            type: 'load',
            dtype: 'q4f16',
            device: 'wasm'
        });
        vi.unstubAllGlobals();
    });

    it('is unavailable while the worker exists but the model is still loading', () => {
        // A large model, tens of seconds. Treating the worker's EXISTENCE as
        // readiness is the whole bug: every speak request in that window
        // threw `voice not loaded` and cleared its in-flight flag on the
        // way out, so the next atom queued the same indices again.
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        expect(voice.available).toBe(false);

        voice._loaded = true;
        expect(voice.available).toBe(true);
    });

    it('queues nothing at all until the model is loaded', () => {
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        voice._send = vi.fn();
        const atoms = Array.from({ length: 20 }, (_, i) => ({ content: 'phrase ' + i }));

        // The Chamber primes on EVERY atom. Forty advances during the
        // load window used to mean hundreds of doomed requests.
        for (let i = 0; i < 40; i++) voice.prime(atoms, i % 12);
        expect(voice._send).not.toHaveBeenCalled();
    });
});

describe('work the reading has outrun is abandoned', () => {
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    const readyVoice = () => {
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        return voice;
    };

    it('does not generate audio for atoms the reader has passed', async () => {
        // Kokoro on WASM holds a core for the whole run, so a phrase
        // that is already history delays the ones still ahead AND
        // starves the audio graph. This is what made PAUSING the
        // trigger: resuming primed a fresh lead on top of a backlog
        // that had no way to expire.
        const voice = readyVoice();
        const spoken = [];
        voice._send = vi.fn((_type, { text }) => {
            spoken.push(text);
            return Promise.resolve({ samples: new Float32Array(8), sampleRate: 24000 });
        });

        const atoms = Array.from({ length: 40 }, (_, i) => ({ content: 'phrase ' + i }));
        voice.prime(atoms, 0);          // queues 0..7, serialised
        voice.prime(atoms, 30);         // the reader jumps ahead

        await flush();
        await voice._queue;

        // Whatever was already in flight may finish, but nothing behind
        // the reader gets STARTED.
        const stale = spoken.filter(t => {
            const n = Number(t.split(' ')[1]);
            return n > 0 && n < 30;
        });
        expect(stale).toEqual([]);
        expect(spoken).toContain('phrase 30');
    });

    it('caches only what it actually generated', async () => {
        const voice = readyVoice();
        voice._send = vi.fn(() =>
            Promise.resolve({ samples: new Float32Array(8), sampleRate: 24000 }));

        const atoms = Array.from({ length: 40 }, (_, i) => ({ content: 'phrase ' + i }));
        voice.prime(atoms, 0);
        voice.prime(atoms, 30);
        await flush();
        await voice._queue;

        // A skipped request resolves to null; storing that would put an
        // entry with no samples in the cache, and speak() would read
        // `samples.length` off undefined.
        for (const entry of voice._cache.values()) {
            expect(entry.samples).toBeInstanceOf(Float32Array);
            expect(entry.sampleRate).toBe(24000);
        }
    });

    it('clears the in-flight flag for skipped work too', async () => {
        // If `finally` did not run for skipped requests the index would
        // be permanently marked in-flight and never generated, even when
        // the reader came back to it.
        const voice = readyVoice();
        voice._send = vi.fn(() =>
            Promise.resolve({ samples: new Float32Array(8), sampleRate: 24000 }));
        const atoms = Array.from({ length: 40 }, (_, i) => ({ content: 'phrase ' + i }));

        voice.prime(atoms, 0);
        voice.prime(atoms, 30);
        await flush();
        await voice._queue;
        expect(voice._generating.size).toBe(0);
    });
});

describe('a recurring cause is reported once', () => {
    it('does not log the same failure per atom per advance', async () => {
        // The diagnostic became the fault: one warning with a full async
        // stack trace, several times a second, was itself enough console
        // work to starve the audio thread.
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        voice._send = vi.fn(() => Promise.reject(new Error('voice not loaded')));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const atoms = Array.from({ length: 30 }, (_, i) => ({ content: 'phrase ' + i }));
        for (let i = 0; i < 30; i++) voice.prime(atoms, i);
        await voice._queue;

        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('still reports a DIFFERENT cause', () => {
        const voice = new Voice();
        voice._warnUnspoken(1, new Error('voice not loaded'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        voice._warnUnspoken(2, new Error('voice not loaded'));
        expect(warn).not.toHaveBeenCalled();
        voice._warnUnspoken(3, new Error('session already started'));
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe('speech begins once, with a lead behind it', () => {
    // jsdom has neither object URLs nor a working play(). The gate is
    // what is under test, so playback is stubbed to the thinnest thing
    // that lets speak() run to its return value.
    beforeEach(() => {
        vi.stubGlobal('URL', Object.assign(Object.create(URL), {
            createObjectURL: () => 'blob:stub',
            revokeObjectURL: () => {}
        }));
        vi.stubGlobal('Audio', class {
            constructor(src) { this.src = src; }
            play() { return Promise.resolve(); }
            pause() {}
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    const seeded = (n) => {
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        for (let i = 0; i < n; i++) {
            voice._cache.set(i, {
                samples: new Float32Array(2400),
                sampleRate: 24000,
                blob: new Blob([], { type: 'audio/wav' })
            });
        }
        return voice;
    };

    it('stays silent while only a phrase or two is ready', () => {
        // The false start: the first phrase to finish generating was
        // spoken alone, then the reading fell silent until the next one
        // happened to be ready. Stuttering in and out reads worse than
        // waiting and then staying.
        const voice = seeded(2);
        expect(voice.speak(0)).toBeNull();
        expect(voice._speaking).toBe(false);
    });

    it('begins once the lead exists', () => {
        const voice = seeded(8);
        expect(voice.speak(0)).not.toBeNull();
        expect(voice._speaking).toBe(true);
    });

    it('rebuilds a cushion after a real underrun before resuming', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        const voice = seeded(8);
        voice.speak(0);
        voice._cache.clear();
        expect(voice.speak(1)).toBeNull();
        expect(voice._speaking).toBe(false);

        for (let i = 2; i < 6; i++) {
            voice._cache.set(i, {
                samples: new Float32Array(2400),
                sampleRate: 24000,
                blob: new Blob([], { type: 'audio/wav' })
            });
        }
        expect(voice.speak(2)).not.toBeNull();
        expect(voice._speaking).toBe(true);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(info).toHaveBeenCalledTimes(1);
        warn.mockRestore();
        info.mockRestore();
    });

    it('does not mistake an authored pause for an underrun', () => {
        const voice = seeded(8);
        voice._atoms = [
            { content: 'phrase 0' },
            { content: '[PAUSE]' }
        ];
        voice.speak(0);
        expect(voice.speak(1)).toBeNull();
        expect(voice._speaking).toBe(true);
        expect(voice._starvedAt).toBeNull();
    });

    it('uses Kokoro\'s native Blob in the media fallback', () => {
        const voice = seeded(8);
        const nativeBlob = new Blob(['kokoro'], { type: 'audio/wav' });
        voice._cache.get(0).blob = nativeBlob;
        const createObjectURL = vi.spyOn(URL, 'createObjectURL');

        expect(voice.speak(0)).not.toBeNull();

        expect(createObjectURL).toHaveBeenCalledWith(nativeBlob);
        createObjectURL.mockRestore();
    });

    it('plays raw samples through the shared Web Audio graph', async () => {
        const source = {
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null
        };
        const buffer = { copyToChannel: vi.fn() };
        const context = {
            state: 'running',
            destination: {},
            createBuffer: vi.fn(() => buffer),
            createBufferSource: vi.fn(() => source)
        };
        const audioEngine = {
            context,
            masterGain: {},
            setVoiceDucking: vi.fn()
        };
        const voice = new Voice({ audioEngine });
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        for (let i = 0; i < 8; i++) {
            voice._cache.set(i, {
                samples: new Float32Array(2400),
                sampleRate: 24000
            });
        }

        const spoken = voice.speak(0);
        expect(spoken).not.toBeNull();
        expect(context.createBuffer).toHaveBeenCalledWith(1, 2400, 24000);
        expect(buffer.copyToChannel).toHaveBeenCalledWith(
            voice._cache.get(0).samples, 0);
        expect(source.connect).toHaveBeenCalledWith(audioEngine.masterGain);
        expect(source.start).toHaveBeenCalledTimes(1);
        expect(audioEngine.setVoiceDucking).toHaveBeenCalledWith(true);

        source.onended();
        await expect(spoken.finished).resolves.toMatchObject({ reason: 'ended' });
        expect(audioEngine.setVoiceDucking).toHaveBeenLastCalledWith(false);
    });
});

describe('preparation lead', () => {
    it('generates a contiguous lead before the Chamber enters', async () => {
        const voice = new Voice();
        voice.enabled = true;
        voice._worker = {};
        voice._loaded = true;
        voice.load = vi.fn(() => Promise.resolve(true));
        voice._send = vi.fn(() => Promise.resolve({
            samples: new Float32Array(2400),
            sampleRate: 24000,
            blob: new Blob()
        }));
        const atoms = Array.from({ length: 24 }, (_, i) => ({
            // Preparation counts utterances, not raw atom positions:
            // authored pauses must not shorten the spoken lead.
            content: i % 3 === 0 ? `phrase ${i}` : '[PAUSE]'
        }));

        await expect(voice.prepare(atoms, 0)).resolves.toBe(true);
        expect([0, 3, 6, 9, 12, 15, 18, 21]
            .every(i => voice._cache.has(i))).toBe(true);
        expect(voice._hasLead(0)).toBe(true);
    });

    it('does not mistake unrelated cached atoms for a lead', () => {
        const voice = new Voice();
        voice._atoms = Array.from({ length: 10 }, (_, i) => ({
            content: `phrase ${i}`
        }));
        for (const i of [0, 6, 7, 8]) {
            voice._cache.set(i, {
                samples: new Float32Array(1),
                sampleRate: 24000
            });
        }
        expect(voice._hasLead(0)).toBe(false);
    });
});
