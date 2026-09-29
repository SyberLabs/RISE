/**
 * The voice as the reading's clock.
 *
 * While a Current is being spoken, the speech timeline decides when each atom
 * is over. This is the second consumer of the Player's completion seam (the
 * first is Recitation); the Player does not learn what speech is.
 *
 * An atom ends when the voice has played as far as the atom's last character.
 * Which character time that is comes from the voice's own reports:
 *   - the segment's marks (word boundaries with their time), interpolated
 *     between, when the voice has them;
 *   - otherwise a rate learned from what has been said so far;
 *   - otherwise a default rate.
 * When the voice reports a segment's end, the answer is exact. So approximate
 * timing never accumulates: it is corrected at every mark and reset at every
 * segment end.
 *
 * A seam between segments ends when the voice begins the next segment.
 *
 * Degrading is quiet and one way. If the voice does not begin what it was
 * asked to say within `graceMs`, the governor stands down for the rest of the
 * Current and the Player's own timer carries on, because a reading that stops
 * is worse than a reading that is not synchronised. The host is told, so it can
 * show that the voice is not being heard.
 *
 * Pause. The Player does not consult a governor when it resumes from a pause,
 * so the atom that was paused finishes on the timer for what remained of it.
 * The next atom is governed again, by absolute played time, so the difference
 * is never more than the one atom.
 */

import { mapAtoms } from './atom-map.js';

const POLL_MS = 20;
const LONGEST_WAIT_MS = 250;
const SHORTEST_ATOM_MS = 50;

export function createSpeechGovernor({ player, voice, clock, graceMs = 1500, defaultMsPerChar = 65, onDegrade = () => {} }) {
    let map = [];
    let segments = new Map();
    /** id -> { marks: [[charIndex, tMs]], durationMs: number|null } */
    const timing = new Map();
    let degraded = false;
    let installed = false;
    let waiting = null;
    let stopWatchingState = null;

    const model = id => {
        if (!timing.has(id)) timing.set(id, { marks: [], durationMs: null });
        return timing.get(id);
    };

    /** How far into a segment's speech, in ms, the voice is when it reaches `charIndex`. */
    function charTime(id, charIndex) {
        const length = segments.get(id)?.length ?? 0;
        const { marks, durationMs } = model(id);
        const points = [[0, 0], ...marks];
        if (durationMs !== null) points.push([length, durationMs]);
        for (let i = 1; i < points.length; i += 1) {
            const [c1, t1] = points[i];
            if (charIndex <= c1) {
                const [c0, t0] = points[i - 1];
                return c1 === c0 ? t1 : t0 + ((charIndex - c0) / (c1 - c0)) * (t1 - t0);
            }
        }
        const [lastC, lastT] = points.at(-1);
        const rate = lastC > 0 ? lastT / lastC : defaultMsPerChar;
        return lastT + (charIndex - lastC) * rate;
    }

    function cancelWait() {
        if (waiting) { waiting.cancel?.(); waiting.dead = true; waiting = null; }
    }

    function estimate(atom, index) {
        const entry = map[index];
        if (degraded || !entry?.segmentId || entry.seam || entry.end <= entry.start) return undefined;
        return Math.max(SHORTEST_ATOM_MS, charTime(entry.segmentId, entry.end) - charTime(entry.segmentId, entry.start));
    }

    function complete(atom, index) {
        const entry = map[index];
        if (degraded || !entry?.segmentId) return null;
        cancelWait();
        const mine = { dead: false, cancel: null };
        waiting = mine;
        const beganAt = clock.now();

        return new Promise(resolve => {
            const finish = result => {
                if (waiting === mine) waiting = null;
                resolve(result);
            };
            const check = () => {
                mine.cancel = null;
                if (mine.dead) return;
                const played = voice.playedMs(entry.segmentId);
                if (played === undefined) {
                    if (clock.now() - beganAt >= graceMs) {
                        degrade('voice-did-not-start');
                        finish({ reason: 'timeout' });
                        return;
                    }
                    mine.cancel = clock.setTimer(check, POLL_MS);
                    return;
                }
                if (entry.seam) { finish({ reason: 'ended' }); return; }
                const remaining = charTime(entry.segmentId, entry.end) - played;
                if (remaining <= 0) { finish({ reason: 'ended' }); return; }
                mine.cancel = clock.setTimer(check, Math.min(Math.max(remaining, 1), LONGEST_WAIT_MS));
            };
            check();
        });
    }

    function degrade(reason) {
        if (degraded) return;
        degraded = true;
        onDegrade({ reason });
    }

    return {
        /** The atoms of the Session now in hand and the segments they were made from. Call before `player.extend`. */
        update({ atoms, segments: list }) {
            segments = new Map(list.map(segment => [segment.id, segment.text]));
            map = mapAtoms(atoms, list);
        },

        /** What the voice reports: 'mark' (id, charIndex, tMs) and 'end' (id, durationMs). */
        observe(kind, id, a, b) {
            if (kind === 'mark') {
                const { marks } = model(id);
                if (!marks.length || marks.at(-1)[0] < a) marks.push([a, b]);
            } else if (kind === 'end') {
                model(id).durationMs = a;
            }
        },

        install() {
            if (installed) return;
            installed = true;
            player.atomDurationOverride = estimate;
            player.atomCompletionOverride = complete;
            // A paused reading is waiting on nothing; the Player will not ask again for this atom.
            stopWatchingState = player.on('state', ({ state }) => {
                if (state === 'paused' || state === 'idle' || state === 'complete') cancelWait();
            });
        },

        dispose() {
            cancelWait();
            stopWatchingState?.();
            stopWatchingState = null;
            if (installed) {
                if (player.atomDurationOverride === estimate) player.atomDurationOverride = null;
                if (player.atomCompletionOverride === complete) player.atomCompletionOverride = null;
            }
            installed = false;
        },

        get degraded() { return degraded; },
        /** Exposed for measurement: when, into a segment's speech, an atom is expected to end. */
        endsAtMs(index) {
            const entry = map[index];
            return entry?.segmentId && !entry.seam ? charTime(entry.segmentId, entry.end) : null;
        }
    };
}
