import { afterEach, describe, expect, it, vi } from 'vitest';
import { Voice } from './voice.js';
import {
    VOICE_PACK_SCHEMA,
    resolveVoicePackEntry,
    speakableText,
    voiceAssetKey
} from './voice-pack.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function fixtureManifest(texts, voiceId = 'af_heart') {
    const entries = Object.fromEntries(texts.map((text, index) => {
        const normalized = speakableText(text);
        return [voiceAssetKey(normalized), {
            text: normalized,
            asset: `/audio/recitation/${voiceId}/${index}.wav`,
            mimeType: 'audio/wav',
            sampleRate: 24000,
            durationMs: 1000 + index,
            onsetsMs: [125, 500]
        }];
    }));
    return {
        schema: VOICE_PACK_SCHEMA,
        voices: {
            [voiceId]: {
                label: 'Fixture',
                entries
            }
        }
    };
}

function response() {
    return {
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(16))
    };
}

describe('static voice-pack identity', () => {
    it('strips reader notation before hashing', () => {
        expect(speakableText('This is | *spoken* [PAUSE] now'))
            .toBe('This is spoken now');
        expect(voiceAssetKey('This is | *spoken* [PAUSE] now'))
            .toBe(voiceAssetKey('This is spoken now'));
        expect(voiceAssetKey('[PAUSE]')).toBe('');
    });

    it('verifies normalized text as well as the compact key', () => {
        const manifest = fixtureManifest(['A phrase']);
        expect(resolveVoicePackEntry('af_heart', 'A phrase', manifest))
            .toMatchObject({ durationMs: 1000 });
        expect(resolveVoicePackEntry('af_heart', 'Another phrase', manifest))
            .toBeNull();
    });
});

describe('session admission and reverent degradation', () => {
    it('does not load when this build has no installed pack', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const voice = new Voice({
            manifest: {
                schema: VOICE_PACK_SCHEMA,
                voices: {}
            },
            fetchImpl: vi.fn()
        });
        voice.enabled = true;

        await expect(voice.load()).resolves.toBe(false);
        expect(voice.available).toBe(false);
        expect(voice.speak(0)).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('rejects a partially packed reading before fetching audio', async () => {
        const fetchImpl = vi.fn(() => Promise.resolve(response()));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const voice = new Voice({
            manifest: fixtureManifest(['packed']),
            fetchImpl
        });
        voice.enabled = true;

        await expect(voice.prepare([
            { content: 'packed' },
            { content: '[PAUSE]' },
            { content: 'not packed' }
        ])).resolves.toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(voice.speak(0)).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('prepares a complete lead with concurrent static fetches', async () => {
        const texts = Array.from({ length: 10 }, (_, index) => `phrase ${index}`);
        const fetchImpl = vi.fn(() => Promise.resolve(response()));
        const voice = new Voice({
            manifest: fixtureManifest(texts),
            fetchImpl
        });
        voice.enabled = true;

        await expect(voice.prepare(
            texts.map(content => ({ content }))
        )).resolves.toBe(true);
        expect(voice.coverage(texts.map(content => ({ content }))))
            .toEqual({ speakable: 10, missing: 0, complete: true });
        expect([...voice._cache.keys()].slice(0, 8))
            .toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        await voice._queue;
        expect(fetchImpl).toHaveBeenCalledTimes(10);
    });

    it('waits for an audio context before it decodes anything', async () => {
        // A clip decoded with no context caches with a null buffer and
        // keeps it, because _ensureIndex serves the cache and never
        // decodes twice. The lead is fetched while the engine is still
        // starting, so this was a race that a FAST network lost: on a
        // warm reload the fetches returned before the context existed and
        // the reading opened silent, while a cold first load was slow
        // enough that everything worked.
        const texts = ['phrase 0', 'phrase 1'];
        let context = null;
        const audioEngine = {
            get context() { return context; },
            init: vi.fn(async () => {
                context = {
                    state: 'suspended',
                    decodeAudioData: async () => ({ sampleRate: 24000, duration: 1, getChannelData: () => new Float32Array(8) })
                };
            })
        };
        const voice = new Voice({
            manifest: fixtureManifest(texts),
            fetchImpl: vi.fn(() => Promise.resolve(response())),
            audioEngine
        });
        voice.enabled = true;

        await voice.prepare(texts.map(content => ({ content })));

        expect(audioEngine.init).toHaveBeenCalled();
        // The clip it opens on carries real audio, not a null buffer.
        expect(voice._cache.get(0)?.audioBuffer).toBeTruthy();
    });

    it('begins on the clip it needs, not on all eight of them', async () => {
        // ONE SLOW FETCH USED TO SILENCE A WHOLE READING. The lead was
        // all-or-nothing, and a single miss among the first eight set
        // _sessionAvailable false — which is not "start a little later",
        // it is speak() returning null for good, because prime refuses to
        // run once that flag is down.
        const texts = Array.from({ length: 10 }, (_, index) => `phrase ${index}`);
        let call = 0;
        const fetchImpl = vi.fn(() => {
            call += 1;
            // The sixth clip never arrives; every other one does.
            return call === 6 ? Promise.reject(new Error('stalled')) : Promise.resolve(response());
        });
        const voice = new Voice({ manifest: fixtureManifest(texts), fetchImpl });
        voice.enabled = true;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(voice.prepare(texts.map(content => ({ content })))).resolves.toBe(true);
        expect(voice._sessionAvailable).toBe(true);
        warn.mockRestore();
    });

    it('refuses when the clip it needs first is the one that is missing', async () => {
        const texts = Array.from({ length: 10 }, (_, index) => `phrase ${index}`);
        let call = 0;
        const fetchImpl = vi.fn(() => {
            call += 1;
            return call === 1 ? Promise.reject(new Error('stalled')) : Promise.resolve(response());
        });
        const voice = new Voice({ manifest: fixtureManifest(texts), fetchImpl });
        voice.enabled = true;

        await expect(voice.prepare(texts.map(content => ({ content })))).resolves.toBe(false);
        expect(voice._sessionAvailable).toBe(false);
    });

    it('never waits in speak when an admitted asset is not ready', () => {
        const voice = new Voice({ manifest: fixtureManifest(['phrase']) });
        voice.enabled = true;
        voice._loaded = true;
        voice._sessionAvailable = true;
        voice._atoms = [{ content: 'phrase' }];
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(voice.speak(0)).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('releases decoded audio the reader has passed', () => {
        const voice = new Voice();
        for (let index = 0; index < 10; index++) {
            voice._cache.set(index, {});
        }
        voice._evictBefore(6);
        expect([...voice._cache.keys()]).toEqual([6, 7, 8, 9]);
    });
});

describe('static playback', () => {
    function admittedVoice(audioEngine = null) {
        const voice = new Voice({
            audioEngine,
            manifest: fixtureManifest(['phrase'])
        });
        voice.enabled = true;
        voice._loaded = true;
        voice._sessionAvailable = true;
        voice._atoms = [{ content: 'phrase' }];
        return voice;
    }

    it('plays the decoded asset through the shared Web Audio graph', async () => {
        const source = {
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null
        };
        const context = {
            state: 'running',
            destination: {},
            createBufferSource: vi.fn(() => source)
        };
        const audioEngine = {
            context,
            masterGain: {},
            setVoiceDucking: vi.fn()
        };
        const voice = admittedVoice(audioEngine);
        const audioBuffer = { duration: 1, sampleRate: 24000 };
        voice._cache.set(0, {
            audioBuffer,
            blob: new Blob(),
            durationMs: 1000,
            onsets: [125, 500],
            sampleRate: 24000
        });

        const spoken = voice.speak(0);
        expect(spoken).toMatchObject({
            durationMs: 1000,
            onsets: [125, 500]
        });
        expect(source.buffer).toBe(audioBuffer);
        expect(source.connect).toHaveBeenCalledWith(audioEngine.masterGain);
        expect(source.start).toHaveBeenCalledOnce();
        expect(audioEngine.setVoiceDucking).not.toHaveBeenCalled();

        source.onended();
        await expect(spoken.finished).resolves.toMatchObject({ reason: 'ended' });
        expect(audioEngine.setVoiceDucking).not.toHaveBeenCalled();
    });

    it('asks for the clock back before speaking into a suspended context', () => {
        // A buffer started against a suspended context neither plays nor
        // ends — `onended` never fires, the completion promise never
        // settles, and the reading waiting on it waits for good. It is
        // why pausing and playing cured the stall: that click is a user
        // gesture, which is the permission a browser is waiting for.
        const resume = vi.fn(() => Promise.resolve());
        const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: {
                context: { state: 'suspended', createBufferSource: () => source },
                masterGain: {},
                resume
            }
        });

        voice._play({ audioBuffer: {} }, 0);

        expect(resume).toHaveBeenCalledTimes(1);
        expect(source.start).toHaveBeenCalled();
    });

    it('does not disturb a context that is already running', () => {
        const resume = vi.fn(() => Promise.resolve());
        const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: {
                context: { state: 'running', createBufferSource: () => source },
                masterGain: {},
                resume
            }
        });

        voice._play({ audioBuffer: {} }, 0);

        expect(resume).not.toHaveBeenCalled();
    });

    it('uses the fetched Blob when Web Audio decoding is unavailable', () => {
        const createObjectURL = vi.fn(() => 'blob:voice');
        vi.stubGlobal('URL', {
            createObjectURL,
            revokeObjectURL: vi.fn()
        });
        vi.stubGlobal('Audio', class {
            play() { return Promise.resolve(); }
            pause() {}
        });
        const voice = admittedVoice();
        const blob = new Blob(['static'], { type: 'audio/wav' });
        voice._cache.set(0, {
            audioBuffer: null,
            blob,
            durationMs: 1000,
            onsets: [125],
            sampleRate: 24000
        });

        expect(voice.speak(0)).not.toBeNull();
        expect(createObjectURL).toHaveBeenCalledWith(blob);
    });

    it('stops playback and clears static resources on destroy', () => {
        const pause = vi.fn();
        const voice = admittedVoice();
        voice._current = {
            element: { pause },
            finish: vi.fn(),
            interrupted: false
        };
        voice._cache.set(0, {});
        voice.destroy();

        expect(pause).toHaveBeenCalledOnce();
        expect(voice._cache.size).toBe(0);
        expect(voice._sessionAvailable).toBe(false);
    });
});
