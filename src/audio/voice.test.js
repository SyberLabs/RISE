/**
 * Voice — the contracts that hold when speech is unavailable.
 *
 * The invariant worth guarding is the one from RECITATION-SPEC §2: a
 * reading that cannot be spoken is read SILENTLY, never stalled. Every
 * failure path here must return rather than wait, because a reading
 * that pauses for a synthesiser has stopped being a reading.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
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
        expect(voice.speak(3)).toBeNull();
    });

    it('never retries a failed load', () => {
        // A device that cannot run the model will not start being able
        // to mid-session, and retrying would re-download 92 MB.
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

describe('wav encoding', () => {
    const voice = new Voice();

    it('writes a header an audio element will accept', () => {
        const blob = voice._wav(new Float32Array([0, 0.5, -0.5]), 24000);
        expect(blob.type).toBe('audio/wav');
        // 44-byte header plus 16-bit samples.
        expect(blob.size).toBe(44 + 3 * 2);
    });

    it('clamps samples rather than letting them wrap', () => {
        // A value outside [-1, 1] wrapping to the opposite extreme is an
        // audible click, and Kokoro's output is not guaranteed bounded.
        const view = new DataView(voice._wavBuffer(new Float32Array([2, -2]), 24000));
        expect(view.getInt16(44, true)).toBe(0x7fff);
        expect(view.getInt16(46, true)).toBe(-0x8000);
    });
});
