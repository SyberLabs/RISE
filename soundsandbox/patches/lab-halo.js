/**
 * PATCH · Halo (wandering harmonics)
 * A self-driving version of the app's harmonics layer, designed as the
 * moving companion for lab-aureole: long silences, then the five-partial
 * series fades in at a randomly chosen carrier tuning, holds, and either
 * glides ("jumps") to another tuning while sounding or fades back out to
 * rest. All durations are randomized around the knob values, so the
 * cycle never becomes a loop the ear can predict.
 *
 * Voice is copied verbatim from app-harmonics per the charter (ratios
 * 1..5, amplitudes halving from 0.5); the oscillators run continuously
 * and only the envelope and tuning move, so every transition is pure
 * ramp — no rebuild, no clicks.
 *
 * Character notes (keep this section in every lab patch):
 * - built for lab-aureole at root 108: 216 lands on its 2nd harmonic
 *   (pure agreement), 200 sits a wide whole-tone shade below (gentle
 *   tension) — the 200↔216 alternation is the composed gesture here
 * - vs app-harmonics: identical timbre, but presence itself is the
 *   parameter; use Wander low (~0.3) for rarer, more precious arrivals
 * - adding 432 to the pool doubles the register and can crowd Aureole's
 *   upper bloom; drop Aureole's Bloom below 0.5 if you enable it
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

const POOLS = {
    '200 · 216': [200, 216],
    '200 · 216 · 220': [200, 216, 220],
    '200 · 216 · 220 · 432': [200, 216, 220, 432]
};

const RATIOS = [1, 2, 3, 4, 5];
const AMPS = [0.5, 0.25, 0.125, 0.0625, 0.03125];

// avg seconds → randomized 0.6×–1.5× milliseconds
const jitter = (avg) => avg * (0.6 + Math.random() * 0.9) * 1000;

export default {
    id: 'lab-halo',
    name: 'Halo (wandering harmonics)',
    category: 'lab',
    description: 'Harmonics that come and go on their own — fading in at a random tuning, drifting between 200 and 216, resting in silence.',
    params: [
        { id: 'pool', label: 'Tunings', type: 'select', value: '200 · 216', options: Object.keys(POOLS) },
        { id: 'rest', label: 'Rest (s avg)', type: 'range', min: 2, max: 40, step: 1, value: 10 },
        { id: 'presence', label: 'Presence (s avg)', type: 'range', min: 3, max: 60, step: 1, value: 14 },
        { id: 'fade', label: 'Fade (s)', type: 'range', min: 0.5, max: 10, step: 0.5, value: 3.5 },
        { id: 'wander', label: 'Wander', type: 'range', min: 0, max: 1, step: 0.05, value: 0.55 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.6, step: 0.01, value: 0.15 }
    ],

    build(ctx, destination, opts = {}) {
        const state = {
            pool: opts.pool || '200 · 216',
            rest: opts.rest ?? 10,
            presence: opts.presence ?? 14,
            fade: opts.fade ?? 3.5,
            wander: opts.wander ?? 0.55,
            gain: opts.gain ?? 0.15
        };

        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(destination);

        // Envelope the scheduler drives; `out` stays the patch master
        const envelope = ctx.createGain();
        envelope.gain.value = 0;
        envelope.connect(out);

        let voices = [];
        let timer = null;
        let generation = 0;   // stop() bumps this; stale timers self-cancel
        let tuning = 0;

        function retune(freq, tau) {
            tuning = freq;
            const t = ctx.currentTime;
            voices.forEach(({ osc, ratio }) =>
                osc.frequency.setTargetAtTime(freq * ratio, t, tau));
        }

        function pickTuning() {
            const pool = POOLS[state.pool];
            const candidates = pool.filter(f => f !== tuning);
            return candidates[Math.floor(Math.random() * candidates.length)]
                ?? pool[0];
        }

        function wait(ms, next) {
            const gen = generation;
            timer = setTimeout(() => { if (gen === generation) next(); }, ms);
        }

        function restPhase() {
            rampOut(ctx, envelope.gain, state.fade);
            wait(state.fade * 1000 + jitter(state.rest), enterPhase);
        }

        function enterPhase() {
            retune(pickTuning(), 0.02); // silent — snap to the new tuning
            rampIn(ctx, envelope.gain, 1, state.fade);
            wait(state.fade * 1000 + jitter(state.presence), decidePhase);
        }

        function decidePhase() {
            if (Math.random() < state.wander && POOLS[state.pool].length > 1) {
                retune(pickTuning(), 0.12); // audible jump: fast clickless glide
                wait(jitter(state.presence), decidePhase);
            } else {
                restPhase();
            }
        }

        return {
            start() {
                voices = RATIOS.map((ratio, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 200 * ratio;
                    gain.gain.value = AMPS[i];
                    osc.connect(gain).connect(envelope);
                    osc.start();
                    return { osc, gain, ratio };
                });
                tuning = 0;
                out.gain.setValueAtTime(0, ctx.currentTime);
                rampIn(ctx, out.gain, state.gain, 0.8);
                // Begin from silence so the first arrival is an event
                wait(jitter(state.rest) * 0.5, enterPhase);
            },
            stop() {
                generation++;
                clearTimeout(timer);
                rampOut(ctx, out.gain);
                const held = voices;
                voices = [];
                setTimeout(() => held.forEach(({ osc }) => {
                    try { osc.stop(); osc.disconnect(); } catch (e) { /* done */ }
                }), 1400);
            },
            set(id, value) {
                state[id] = value;
                if (id === 'gain') {
                    out.gain.setTargetAtTime(value, ctx.currentTime, 0.1);
                }
                // pool / rest / presence / fade / wander apply from the
                // next phase decision — the current gesture completes
            }
        };
    }
};
