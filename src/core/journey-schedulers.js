/**
 * Following a Journey — movement identity and audio cues.
 *
 * Two controllers, both built the way `VisualScheduleController` is
 * built, because that one is proven and the spec is explicit that the
 * first slice must not destabilise it to create an abstraction
 * (JOURNEYS-SPEC §8.1). They share its shape: synchronous construction,
 * one emission per identity transition, a generation token that
 * increments on change, and a reset that makes the next atom re-emit.
 *
 * NEITHER OWNS A CLOCK.
 *
 * They observe atoms the Player emits and answer questions about them.
 * They schedule no timeouts, advance no reading, and hold no wall-time
 * state. That is the whole reason a boundary is an atom rather than a
 * timer: the transition IS the current atom, so pausing a Journey
 * pauses its transitions for free, and no controller can drift from the
 * reading it is following.
 */

import { movementForSource } from './journey-compiler.js';
import { cueForAtom } from './visual-scheduler.js';

/**
 * Which movement the reading is in, and when it crosses a boundary.
 *
 * Emits only on identity change, so the many atoms of one movement
 * produce one announcement. A paragraph break inside a movement carries
 * that movement's own sourceId and therefore holds it — structural
 * silence is not a movement change, exactly as it is not a cue change.
 */
export class MovementScheduleController {
    constructor(movementProgram, onChange) {
        this.program = movementProgram || null;
        this.onChange = typeof onChange === 'function' ? onChange : () => {};
        this._activeId = null;
        this._generation = 0;

        // O(1) lookup (§8.1). Built once at construction rather than
        // scanned per atom: a Journey emits thousands of atoms and the
        // movement rarely changes.
        this._bySource = new Map();
        for (const movement of this.program?.movements || []) {
            for (const sourceId of movement.sourceIds) {
                this._bySource.set(sourceId, { kind: 'movement', movement });
            }
        }
        for (const boundary of this.program?.boundaries || []) {
            this._bySource.set(boundary.sourceId, { kind: 'boundary', boundary });
        }
    }

    get active() { return !!this.program; }
    get generation() { return this._generation; }
    get activeId() { return this._activeId; }

    /**
     * Observe one atom.
     *
     * @returns {{kind: 'movement'|'boundary', movement?, boundary?}|null}
     *   the current position, or null while nothing is known.
     */
    observe(atom) {
        if (!this.program) return null;
        const sourceId = atom?.sourceId;
        if (typeof sourceId !== 'string' || !sourceId) return this._current || null;

        const found = this._bySource.get(sourceId) || null;
        // A source the Journey never named is not a movement change —
        // it is a reading the compiler let through, and announcing
        // "no movement" would thrash the UI between real movements.
        if (!found) return this._current || null;

        const id = found.kind === 'boundary' ? found.boundary.id : found.movement.id;
        if (id !== this._activeId) {
            this._activeId = id;
            this._generation += 1;
            this._current = found;
            this.onChange(found, { id, generation: this._generation });
        }
        return found;
    }

    /** Where the reading is, without observing anything. */
    get current() { return this._current || null; }

    reset() {
        this._activeId = null;
        this._current = null;
    }
}

/**
 * The audio cue a reading is under.
 *
 * Mirrors the visual controller and delegates bounded commands to the
 * engine — it never touches an AudioContext itself (§5). The engine
 * already owns pause and resume, which is what keeps a scheduled fade
 * from continuing through a paused reading: there is no timer here to
 * leave running.
 *
 * ONE SOUNDSCAPE HANDLE. The present engine stops one soundscape before
 * starting another, so V1 boundaries fade to silence and back rather
 * than crossfading (§7.3). An abrupt replacement is not called a
 * crossfade here, because naming it one would make the next person
 * believe the engine can do something it cannot.
 */
export class AudioScheduleController {
    constructor(audioProgram, engine, options = {}) {
        this.program = audioProgram || null;
        this.engine = engine || null;
        const combined = Array.isArray(this.program?.segments) ? this.program.segments : [];
        this.bedProgram = this.program?.lanes?.bed || (this.program ? {
            coordinateSpace: this.program.coordinateSpace,
            segments: combined.filter(segment => segment.cue?.kind !== 'swell'),
            fallback: this.program.fallback || { kind: 'silence', fadeMs: 500 }
        } : null);
        this.swellProgram = this.program?.lanes?.swell || (this.program ? {
            coordinateSpace: this.program.coordinateSpace,
            segments: combined.filter(segment => segment.cue?.kind === 'swell'),
            fallback: { kind: 'hold' }
        } : null);
        if (!this.bedProgram?.segments?.length) this.bedProgram = null;
        if (!this.swellProgram?.segments?.length) this.swellProgram = null;
        this.defaultCue = options.defaultCue || null;
        this._activeBedId = this.defaultCue ? '__fallback__' : null;
        this._activeSwellId = null;
        this._activeBedCue = this.defaultCue;
        this._activeSwellCue = null;
        this._generation = 0;
        this._enabled = options.enabled !== false;
        this._paused = false;
        this._lastAtom = null;
    }

    get active() { return !!this.program && this._enabled; }
    get generation() { return this._generation; }
    get activeCueId() { return this._activeBedId; }
    get activeBedId() { return this._activeBedId; }
    get activeSwellId() { return this._activeSwellId; }

    /** A reader may silence a Journey without rewriting it (§3.3). */
    setEnabled(enabled) {
        this._enabled = enabled !== false;
        if (!this._enabled) this.stop();
        else if (this._lastAtom) this.resume();
    }

    observe(atom) {
        if (!this.program || !this._enabled || this._paused) return null;
        // Structural silence holds the cue, as everywhere else.
        if (typeof atom?.sourceId !== 'string' || !atom.sourceId) return null;

        this._lastAtom = atom;
        const bed = this.bedProgram ? cueForAtom(this.bedProgram, atom) : null;
        const swell = this.swellProgram ? cueForAtom(this.swellProgram, atom) : null;
        const changed = bed?.id !== this._activeBedId || swell?.id !== this._activeSwellId;
        if (!changed) return { bed, swell, syncGroups: this._syncGroups(bed, swell) };

        const generation = ++this._generation;
        if (bed?.id !== this._activeBedId) {
            this._activeBedId = bed?.id ?? null;
            this._applyBed(bed?.cue, generation);
        }
        if (swell?.id !== this._activeSwellId) {
            this._activeSwellId = swell?.id ?? null;
            this._applySwell(swell?.cue, generation);
        }
        return { bed, swell, syncGroups: this._syncGroups(bed, swell) };
    }

    _syncGroups(bed, swell) {
        return [...new Set([bed, swell]
            .map(result => this.program?.segments?.find(segment => segment.id === result?.id)?.syncGroup)
            .filter(Boolean))];
    }

    /**
     * Ask the engine for a method it actually has.
     *
     * THE `?.` WAS THE BUG, NOT A SAFETY NET. This controller called
     * `setSoundscape` and `fadeSoundscapeOut`; the engine has
     * `startSoundscape` and `stopSoundscape` and never had the others.
     * Written as `engine.setSoundscape?.(…)`, that mismatch was not a
     * crash, a warning, or a failing test — it was nothing at all, and
     * War played in silence from the day it shipped while its audio
     * schedule announced itself correctly in the log.
     *
     * That is the fifth time a vocabulary has lived in two places here
     * with only one copy learning the word, and the first that was
     * silent BY CONSTRUCTION rather than by accident. So the optional
     * call is gone: a method this controller needs and cannot find is
     * reported once, by name.
     */
    _command(name) {
        const method = this.engine?.[name];
        if (typeof method === 'function') return method.bind(this.engine);
        if (this.engine && !this._warned?.has(name)) {
            (this._warned ||= new Set()).add(name);
            console.warn(`[Journey audio] The engine has no ${name}(). `
                + 'This movement will be silent.');
        }
        return null;
    }

    /**
     * Bounded commands only. Anything the engine cannot do is a no-op
     * rather than an approximation — a missing soundscape degrades to
     * silence at runtime (§8.5), it does not substitute a different one.
     */
    _applyLegacy(cue, generation) {
        if (!this.engine || !cue) return;
        // A late command from a movement the reader has already left
        // must not publish into the one they are in.
        const current = () => generation === this._generation;

        switch (cue.kind) {
            case 'hold':
                return;
            case 'silence':
                if (current()) this._command('stopSoundscape')?.(false);
                return;
            case 'soundscape': {
                if (!current()) return;
                const start = this._command('startSoundscape');
                if (!start) return;
                // The engine warns by name on an id it does not know,
                // and plays nothing — which is the right degradation. A
                // soundscape that does not exist must not become a
                // different soundscape.
                start(cue.soundscapeId);
                // Gain rides on the layer, because startSoundscape takes
                // an id and nothing else. `fadeMs` has no engine control
                // at all: one handle stops before the next starts, so a
                // V1 boundary fades to silence and back (see the class
                // comment) and there is no crossfade to time.
                if (typeof cue.gain === 'number') {
                    this._command('setLayerVolume')?.('soundscape', cue.gain, true);
                }
                return;
            }
            case 'swell':
                if (current()) this._command('playSwell')?.(cue.swellId);
                return;
            default:
                return;
        }
    }

    _cancelBed(cue = this._activeBedCue) {
        if (!cue || cue.kind === 'hold') return;
        if (cue.kind === 'soundscape') this._command('stopSoundscape')?.(cue.fadeMs === 0);
        if (cue.kind === 'tone') this._command('applyPreset')?.('silent');
        // Silence owns no running handle. Entering it performs cancellation;
        // leaving it must not emit a second stop.
    }

    _applyBed(cue, generation) {
        if (!this.engine || !cue) return;
        const current = () => generation === this._generation;
        const hadBed = !!this._activeBedCue;
        this._cancelBed();
        const effective = cue.kind === 'hold' ? this.defaultCue : cue;
        this._activeBedCue = effective || cue;
        if (!effective || !current()) return;
        const immediate = effective.fadeMs === 0;
        if (effective.kind === 'tone') this._command('stopSoundscape')?.(immediate);
        if (effective.kind === 'silence' && hadBed) return;
        this._startBed(effective, current, immediate);
    }

    _startBed(cue, current, immediate) {
        if (!cue || !current()) return;
        if (cue.kind === 'soundscape') {
            this._command('startSoundscape')?.(cue.soundscapeId);
            if (typeof cue.gain === 'number') {
                this._command('setLayerVolume')?.('soundscape', cue.gain, true);
            }
        } else if (cue.kind === 'tone') {
            this._command('applyPreset')?.(cue.presetId);
        } else if (cue.kind === 'silence') {
            this._command('stopSoundscape')?.(immediate);
            this._command('applyPreset')?.('silent');
        }
    }

    _applySwell(cue, generation) {
        if (!this.engine) return;
        if (this._activeSwellCue?.kind === 'swell') {
            this._command('stopSwell')?.(this._activeSwellCue.fadeMs === 0);
        }
        this._activeSwellCue = cue || null;
        if (!cue || cue.kind !== 'swell') return;
        const play = this._command('playSwell');
        if (!play) return;
        Promise.resolve(play(cue.swellId)).then(() => {
            if (generation !== this._generation) this._command('stopSwell')?.(false);
        }).catch(() => {
            if (generation === this._generation) this._activeSwellId = null;
        });
    }

    pause() {
        this._paused = true;
        this._generation += 1;
        this._cancelBed();
        if (this._activeSwellCue?.kind === 'swell') this._command('stopSwell')?.(false);
        this._activeBedId = null;
        this._activeSwellId = null;
    }

    resume() {
        if (!this._enabled || !this._lastAtom) return null;
        this._paused = false;
        const bed = this.bedProgram ? cueForAtom(this.bedProgram, this._lastAtom) : null;
        const swell = this.swellProgram ? cueForAtom(this.swellProgram, this._lastAtom) : null;
        const generation = ++this._generation;
        this._activeBedId = bed?.id ?? null;
        this._activeSwellId = swell?.id ?? null;
        this._applyBed(bed?.cue, generation);
        return { bed, swell, syncGroups: this._syncGroups(bed, swell) };
    }

    stop() {
        this._paused = false;
        this._generation += 1;
        this._cancelBed();
        if (this._activeSwellCue?.kind === 'swell') this._command('stopSwell')?.(false);
        this._activeBedId = null;
        this._activeSwellId = null;
        this._activeBedCue = null;
        this._activeSwellCue = null;
        this._lastAtom = null;
    }

    /** Restore silence on stop and destroy (§8.3). */
    silence() {
        this.stop();
    }

    reset() {
        this._activeBedId = null;
        this._activeSwellId = null;
        this._activeBedCue = null;
        this._activeSwellCue = null;
        this._lastAtom = null;
    }
}
