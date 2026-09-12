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

    it('reports a late first clip without silencing the rest of the reading', async () => {
        // It used to write this into _sessionAvailable, which is the flag
        // that says whether the reading is in the pack at all. One slow
        // request at entry therefore silenced every phrase that followed
        // it, permanently - nothing sets that flag back, and prime()
        // will not run once it is down. A late first clip should cost the
        // first clip.
        const texts = Array.from({ length: 10 }, (_, index) => `phrase ${index}`);
        let call = 0;
        const fetchImpl = vi.fn(() => {
            call += 1;
            return call === 1 ? Promise.reject(new Error('stalled')) : Promise.resolve(response());
        });
        const voice = new Voice({ manifest: fixtureManifest(texts), fetchImpl });
        voice.enabled = true;

        await expect(voice.prepare(texts.map(content => ({ content })))).resolves.toBe(false);
        expect(voice._sessionAvailable).toBe(true);
    });

    it('gives a dropped request one more chance before calling it missing', async () => {
        // Any failure went straight into _missing, which _ensureIndex
        // treats as final - so one flaky response on a phone moving
        // between cells removed that phrase's audio for the session.
        const texts = ['phrase 0'];
        let call = 0;
        const fetchImpl = vi.fn(() => {
            call += 1;
            return call === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve(response());
        });
        const voice = new Voice({ manifest: fixtureManifest(texts), fetchImpl });
        voice.enabled = true;
        await voice.load();
        voice._atoms = texts.map(content => ({ content }));

        expect(await voice._ensureIndex(0)).toBeNull();
        expect(voice._missing.has(0)).toBe(false);

        const second = await voice._ensureIndex(0);
        expect(second).toBeTruthy();
    });

    it('stops retrying a request that keeps failing', async () => {
        const texts = ['phrase 0'];
        const fetchImpl = vi.fn(() => Promise.reject(new Error('gone')));
        const voice = new Voice({ manifest: fixtureManifest(texts), fetchImpl });
        voice.enabled = true;
        await voice.load();
        voice._atoms = texts.map(content => ({ content }));

        await voice._ensureIndex(0);
        await voice._ensureIndex(0);

        expect(voice._missing.has(0)).toBe(true);
        const calls = fetchImpl.mock.calls.length;
        await voice._ensureIndex(0);
        expect(fetchImpl.mock.calls.length).toBe(calls);
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
            audible: true,
            setVoiceDucking: vi.fn()
        };
        audioEngine.voiceGain = { id: 'voiceGain' };
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
        // voiceGain, not masterGain: the session reveal lives on
        // sessionGain and the voice is deliberately not on it, so the
        // first phrase is not multiplied by a ramp that is still rising.
        expect(source.connect).toHaveBeenCalledWith(audioEngine.voiceGain);
        expect(source.start).toHaveBeenCalledOnce();
        expect(audioEngine.setVoiceDucking).not.toHaveBeenCalled();

        source.onended();
        await expect(spoken.finished).resolves.toMatchObject({ reason: 'ended' });
        expect(audioEngine.setVoiceDucking).not.toHaveBeenCalled();
    });

    it('plays the media fallback at the volume the reader set', () => {
        // A media element is outside the graph: it never touches
        // masterGain, so nothing was setting its level and a reading that
        // landed here spoke at full system volume over a bed that was
        // obeying the slider.
        const played = [];
        class FakeAudio {
            constructor() { this.volume = 1; played.push(this); }
            play() { return Promise.resolve(); }
            pause() {}
        }
        vi.stubGlobal('Audio', FakeAudio);
        vi.stubGlobal('URL', {
            createObjectURL: () => 'blob:x',
            revokeObjectURL: () => {}
        });

        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: { context: null, config: { masterVolume: 0.4 } }
        });

        voice._play({ audioBuffer: null, blob: new Blob() }, 0);

        expect(played).toHaveLength(1);
        expect(played[0].volume).toBeCloseTo(0.4);
    });

    it('decodes a clip that was cached before any context existed', async () => {
        // _decode returns null with no AudioContext, and the entry was
        // cached in that state and served from cache ever after - so the
        // clip played through the media fallback for the rest of the
        // reading even once Web Audio was available.
        const audioBuffer = { duration: 1, sampleRate: 24000 };
        const decodeAudioData = vi.fn(() => Promise.resolve(audioBuffer));
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: { context: { state: 'running', decodeAudioData } }
        });
        const entry = {
            audioBuffer: null,
            blob: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) },
            durationMs: 1000,
            onsets: [],
            sampleRate: 24000
        };
        voice._cache.set(0, entry);

        await voice._ensureIndex(0);
        // The repair is deliberately fire-and-forget, so the reading is
        // never held up by it. A macrotask drains every microtask the
        // chain is waiting on; counting ticks would depend on how many
        // awaits deep it happens to be.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(decodeAudioData).toHaveBeenCalledTimes(1);
        expect(entry.audioBuffer).toBe(audioBuffer);
    });

    it('does not try to repair a clip while no context exists', async () => {
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: { context: null }
        });
        const arrayBuffer = vi.fn();
        voice._cache.set(0, { audioBuffer: null, blob: { arrayBuffer } });

        await voice._ensureIndex(0);

        expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it('will not start a source into a context that is not running', () => {
        // THIS TEST USED TO ASSERT THE BUG. It required resume() to be
        // called AND the source to start anyway, which is exactly the
        // race: a buffer started against a suspended context is scheduled
        // on a frozen clock, so it makes no sound, its onended never
        // fires, and the next phrase's stop() discards it. The reading
        // looks perfect and says nothing, and the suite called that
        // correct.
        //
        // Asking is still right - a later phrase may be admitted. Acting
        // on the answer is the part that was missing.
        const resume = vi.fn(() => Promise.resolve({ state: 'suspended', audible: false }));
        const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: {
                context: { state: 'suspended', createBufferSource: () => source },
                masterGain: {},
                audible: false,
                resume
            }
        });

        voice._play({ audioBuffer: {} }, 0);

        expect(resume).toHaveBeenCalledTimes(1);
        expect(source.start).not.toHaveBeenCalled();
    });

    it('falls to the media element when Web Audio is shut', () => {
        // A media element is a separate admission decision under its own
        // policy, so it is worth attempting when the context is not
        // running. That is what a fallback is for.
        const played = [];
        class FakeAudio {
            constructor() { this.volume = 1; played.push(this); }
            play() { return Promise.resolve(); }
            pause() {}
        }
        vi.stubGlobal('Audio', FakeAudio);
        vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });

        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: {
                context: { state: 'suspended', createBufferSource: () => ({}) },
                audible: false,
                config: { masterVolume: 0.5 },
                resume: () => Promise.resolve({ state: 'suspended', audible: false })
            }
        });

        voice._play({ audioBuffer: {}, blob: new Blob() }, 0);

        expect(played).toHaveLength(1);
    });

    it('does not disturb a context that is already running', () => {
        const resume = vi.fn(() => Promise.resolve());
        const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
        const voice = new Voice({
            manifest: fixtureManifest(['phrase']),
            audioEngine: {
                context: { state: 'running', createBufferSource: () => source },
                masterGain: {},
                audible: true,
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
