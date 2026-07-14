/**
 * SoundSandbox shared library — constants mirrored from the app's
 * audio engine plus the two gain-ramp helpers every patch must use.
 *
 * INVARIANT: no patch ever steps a gain or frequency discontinuously.
 * rampIn/rampOut are the sanctioned envelope; setTargetAtTime is the
 * sanctioned glide. A click in this sandbox is a bug.
 */

/** Brainwave entrainment bands (Hz) — mirrors BRAINWAVE_BANDS in engine.js */
export const BANDS = {
    'δ 2': 2,      // delta: deep sleep
    'θ 6': 6,      // theta: hypnagogic, deep meditation
    'α 10': 10,    // alpha: relaxed, receptive
    'β 18': 18,    // beta: alert, focused
    'γ 40': 40     // gamma: peak awareness
};

/** Carrier tunings (Hz) — mirrors CARRIER_TUNINGS in engine.js */
export const TUNINGS = {
    '200 std': 200,
    '216 verdi': 216,
    '220 A3': 220,
    '432 sacred': 432
};

/** Solfeggio frequencies (Hz) — mirrors SOLFEGGIO_FREQUENCIES in engine.js */
export const SOLFEGGIO = {
    '396 ut': 396,
    '417 re': 417,
    '528 mi': 528,
    '639 fa': 639,
    '741 sol': 741,
    '852 la': 852
};

/** Attack every patch uses: 1.2s exponential-feel rise to `level`. */
export function rampIn(ctx, gainParam, level, seconds = 1.2) {
    const t = ctx.currentTime;
    gainParam.cancelScheduledValues(t);
    gainParam.setValueAtTime(Math.max(gainParam.value, 0.0001), t);
    gainParam.setTargetAtTime(level, t, seconds / 3);
}

/** Release every patch uses: 1.2s fall toward silence. */
export function rampOut(ctx, gainParam, seconds = 1.2) {
    const t = ctx.currentTime;
    gainParam.cancelScheduledValues(t);
    gainParam.setValueAtTime(gainParam.value, t);
    gainParam.setTargetAtTime(0, t, seconds / 3);
}
