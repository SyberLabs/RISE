/**
 * Musical-layer ducking, and the several reasons that want it.
 *
 * Recitation does not currently call this; a highlighted passage's layer does,
 * so that the whole-reading bed steps back under it rather than stopping.
 * Ducking twice without an intervening restore must not record the ducked
 * level as the level to return to, or the music walks itself down to silence
 * over a reading. That is exactly the kind of bug that only appears after
 * twenty phrases and is then hard to attribute.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AudioEngine } from './engine.js';
import { LEVEL_BAND, PHONE_SPEAKER_LIFT_DB } from './sound-levels.js';

/** A gain node recording what was scheduled, without Web Audio. */
function fakeGain(value) {
    return {
        gain: {
            value,
            _ramps: [],
            cancelScheduledValues() { },
            setValueAtTime(v) { this.value = v; },
            linearRampToValueAtTime(v, t) { this._ramps.push({ v, t }); this.value = v; }
        }
    };
}

function engineWithLayers(volumes) {
    const engine = new AudioEngine();
    engine.context = { currentTime: 0 };
    engine.layerGains = {};
    for (const [name, v] of Object.entries(volumes)) engine.layerGains[name] = fakeGain(v);
    return engine;
}

describe('voice ducking', () => {
    let engine;
    beforeEach(() => {
        engine = engineWithLayers({
            binaural: 0.8, harmonics: 0.6, soundscape: 1.0, drone: 0.4,
            ui: 0.5, typing: 0.3
        });
    });

    it('ducks the musical layers toward a floor, not to silence', () => {
        // Cutting to zero between every phrase would pump audibly. The
        // bed stays present under the voice.
        engine.setVoiceDucking(true);
        expect(engine.layerGains.binaural.gain.value).toBeCloseTo(0.8 * 0.35, 5);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(1.0 * 0.35, 5);
        expect(engine.layerGains.binaural.gain.value).toBeGreaterThan(0);
    });

    it('leaves feedback layers alone', () => {
        // A keystroke or a click should still be audible while speaking;
        // those are feedback, not bed.
        engine.setVoiceDucking(true);
        expect(engine.layerGains.ui.gain.value).toBe(0.5);
        expect(engine.layerGains.typing.gain.value).toBe(0.3);
    });

    it('restores the levels that were there before', () => {
        engine.setVoiceDucking(true);
        engine.setVoiceDucking(false);
        expect(engine.layerGains.binaural.gain.value).toBeCloseTo(0.8, 5);
        expect(engine.layerGains.harmonics.gain.value).toBeCloseTo(0.6, 5);
        expect(engine.layerGains.drone.gain.value).toBeCloseTo(0.4, 5);
    });

    it('does not ratchet when ducked repeatedly', () => {
        // THE bug this test exists for. Twenty phrases of speech must
        // leave the music where it started, not at 0.35^20 of it.
        for (let i = 0; i < 20; i++) engine.setVoiceDucking(true);
        engine.setVoiceDucking(false);
        expect(engine.layerGains.binaural.gain.value).toBeCloseTo(0.8, 5);
    });

    it('survives a restore with no preceding duck', () => {
        engine.setVoiceDucking(false);
        expect(engine.layerGains.binaural.gain.value).toBe(0.8);
    });

    it('ramps down faster than it comes back up', () => {
        // Down fast so the voice never fights a swell; up slow so the
        // return reads as a breath rather than a switch.
        engine.setVoiceDucking(true);
        const down = engine.layerGains.binaural.gain._ramps.at(-1).t;
        engine.setVoiceDucking(false);
        const up = engine.layerGains.binaural.gain._ramps.at(-1).t;
        expect(down).toBeLessThan(up);
    });

    it('is inert without an audio context', () => {
        const cold = new AudioEngine();
        cold.context = null;
        expect(() => cold.setVoiceDucking(true)).not.toThrow();
        expect(() => cold.setVoiceDucking(false)).not.toThrow();
    });

    it('tolerates missing layers', () => {
        const sparse = engineWithLayers({ binaural: 0.7 });
        expect(() => sparse.setVoiceDucking(true)).not.toThrow();
        expect(sparse.layerGains.binaural.gain.value).toBeCloseTo(0.7 * 0.35, 5);
    });
});

describe('a layer ducks the bed it sounds over', () => {
    let engine;
    beforeEach(() => {
        engine = engineWithLayers({
            binaural: 0.8, soundscape: 1.0, swell: 0.9, ui: 0.5
        });
    });

    it('steps the bed back and leaves the layer itself alone', () => {
        engine.setLayerDucking(true);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.34, 5);
        expect(engine.layerGains.binaural.gain.value).toBeCloseTo(0.272, 5);
        // The layer is what the bed is making room for.
        expect(engine.layerGains.swell.gain.value).toBe(0.9);
        expect(engine.layerGains.ui.gain.value).toBe(0.5);

        engine.setLayerDucking(false);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(1.0, 5);
        expect(engine.layerGains.binaural.gain.value).toBeCloseTo(0.8, 5);
    });

    it('gives the bed back at its own level however many times it ducks', () => {
        for (let i = 0; i < 20; i += 1) {
            engine.setLayerDucking(true);
            engine.setLayerDucking(true);
            engine.setLayerDucking(false);
        }
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(1.0, 5);
    });

    it('does not ratchet when a voice and a layer duck together', () => {
        // Two mechanisms each remembering the other's ducked value as the
        // level to restore is how music walks itself down and never returns.
        engine.setLayerDucking(true);
        engine.setVoiceDucking(true);
        // The deeper floor wins while both are asking.
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.34, 5);
        // And the voice ducks the layer, which the bed's own duck does not.
        expect(engine.layerGains.swell.gain.value).toBeCloseTo(0.315, 5);

        engine.setVoiceDucking(false);
        // The layer is still sounding, so the bed stays at the layer's floor.
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.34, 5);
        expect(engine.layerGains.swell.gain.value).toBeCloseTo(0.9, 5);

        engine.setLayerDucking(false);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(1.0, 5);
        expect(engine.layerGains.swell.gain.value).toBeCloseTo(0.9, 5);
    });

    it('returns the bed when the reasons are released in either order', () => {
        engine.setVoiceDucking(true);
        engine.setLayerDucking(true);
        engine.setLayerDucking(false);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.35, 5);
        engine.setVoiceDucking(false);
        expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(1.0, 5);
    });
});

describe('the bed on a phone\'s speaker', () => {
    /** The level a bed levelled to the catalogue's band reaches at the output, through the session and its duck. */
    function bedDbfs(engine) {
        const session = engine.sessionGain.gain.value;
        const layer = engine.layerGains.soundscape.gain.value;
        return LEVEL_BAND.rmsDbfs + 20 * Math.log10(session * layer);
    }

    function revealed(liftDb) {
        const engine = engineWithLayers({ soundscape: 1.0 });
        engine.sessionGain = fakeGain(0);
        if (liftDb !== undefined) engine.setSessionLift(liftDb);
        engine.fadeInSession(1.2);
        engine._cancelFade();
        return engine;
    }

    it('leaves the catalogue\'s levels as they are where no lift is asked: -29 dBFS, and about -38 under the voice', () => {
        const engine = revealed();
        expect(bedDbfs(engine)).toBeCloseTo(-29, 1);
        engine.setVoiceDucking(true);
        expect(bedDbfs(engine)).toBeCloseTo(-38.1, 1);
    });

    it('lifts the whole session by the phone level: about -23 dBFS, and -32 under the voice', () => {
        expect(PHONE_SPEAKER_LIFT_DB).toBe(6);
        const engine = revealed(PHONE_SPEAKER_LIFT_DB);
        expect(bedDbfs(engine)).toBeCloseTo(-23, 1);
        engine.setVoiceDucking(true);
        expect(bedDbfs(engine)).toBeCloseTo(-32.1, 1);
    });

    it('returns to the catalogue\'s level when the lift is taken off', () => {
        const engine = revealed(PHONE_SPEAKER_LIFT_DB);
        engine.setSessionLift(0);
        engine.fadeInSession(0.6);
        engine._cancelFade();
        expect(bedDbfs(engine)).toBeCloseTo(-29, 1);
    });
});
