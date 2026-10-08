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
 *   - otherwise the speed learned from the segments already said (their total
 *     time over their total length), so a voice that reports no boundaries is
 *     only approximate in its first segment;
 *   - otherwise a default rate.
 * When the voice reports a segment's end, the answer is exact. So approximate
 * timing never accumulates: it is corrected at every mark and reset at every
 * segment end.
 *
 * A seam between segments ends when the voice begins the next segment.
 *
 * The words on screen never run ahead of the words spoken. A voice that
 * reports its word boundaries (`capabilities.wordMarks`) says exactly where it
 * is, while the clock it is measured by can start before any sound does (a
 * cold speech engine reports its start early). So for such a voice an atom is
 * over only when the voice has begun the next atom's first word, or ended the
 * segment. A voice that claims marks and then goes quiet is not waited on for
 * ever: once `markPatienceMs` has passed since both the estimate fell due and
 * the voice last reported anything, the estimate stands again, for the rest of
 * the Current. A voice that is slow but still reporting is never cut off.
 *
 * The first utterance of a reading has `firstGraceMs` to begin, because a speech
 * engine that has not yet spoken in this page starts slowly, and so does the
 * first after a pause (a held voice is cancelled and spoken again, and a network
 * voice's engine may have shut down meanwhile); later ones have `graceMs`. A
 * voice still saying an earlier passage (one said again from further back after
 * a pause) is owed the time that passage is expected to take before the grace
 * for the next one begins.
 *
 * Degrading is quiet and one way. If the voice does not begin what it was
 * asked to say within its grace, the governor stands down for the rest of the
 * Current and the Player's own timer carries on, at the pace the voice was
 * measured at, because a reading that stops is worse than a reading that is not
 * synchronised. The host is told, so it can show that the voice is not being
 * heard.
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

export const GOVERNOR_LIMITS = Object.freeze({ firstGraceMs: 4000, markPatienceMs: 1500 });

export function createSpeechGovernor({ voice, clock, graceMs = 1500, defaultMsPerChar = 65, onDegrade = () => {} }) {
    let map = [];
    let segments = new Map();
    /** id -> { marks: [[charIndex, tMs]], durationMs: number|null } */
    const timing = new Map();
    /** What every segment heard so far says about how fast this voice goes: characters, and the time they took. */
    const learned = { chars: 0, ms: 0 };
    let degraded = false;
    /** Whether atoms wait for the voice's own word reports: it claims them, and has not been found without them. */
    let followMarks = voice?.capabilities?.wordMarks === true;
    /** Whether any utterance of this reading has begun: until then the engine may be cold. */
    let begun = false;
    /** When the voice last reported anything (a start, a mark, an end), on the governor's clock. */
    let lastHeardAt = -Infinity;
    let player = null;
    let releaseGovernor = null;
    let waiting = null;
    let stopWatchingState = null;

    const model = id => {
        if (!timing.has(id)) timing.set(id, { marks: [], durationMs: null });
        return timing.get(id);
    };

    /** Milliseconds per character for speech nothing has been heard of yet: this voice's own speed if it has been heard, else the default. */
    const speed = () => (learned.chars > 0 ? learned.ms / learned.chars : defaultMsPerChar);

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
        const rate = lastC > 0 ? lastT / lastC : speed();
        return lastT + (charIndex - lastC) * rate;
    }

    function cancelWait() {
        if (waiting) { waiting.cancel?.(); waiting.dead = true; waiting = null; }
    }

    /** How long an atom takes to say. Still answered once stood down, so the words keep the pace of speech. */
    function estimate(atom, index) {
        const entry = map[index];
        if (!entry?.segmentId || entry.seam || entry.end <= entry.start) return undefined;
        return Math.max(SHORTEST_ATOM_MS, charTime(entry.segmentId, entry.end) - charTime(entry.segmentId, entry.start));
    }

    /** Whether the voice has said all of an atom: begun the next atom's first word, or ended the segment. */
    function heardPast(entry) {
        const { marks, durationMs } = model(entry.segmentId);
        return durationMs !== null || (marks.length > 0 && marks.at(-1)[0] >= entry.end);
    }

    function complete(atom, index) {
        const entry = map[index];
        if (degraded || !entry?.segmentId) return null;
        cancelWait();
        const mine = { dead: false, cancel: null };
        waiting = mine;
        const beganAt = clock.now();
        const grace = begun ? graceMs : Math.max(graceMs, GOVERNOR_LIMITS.firstGraceMs);
        // A voice still saying an earlier passage (one held and said again from further back, say) has not failed to
        // begin this one: the grace starts when that passage should be over, by the time it is expected to take.
        const still = voice.speakingId?.() ?? null;
        const owed = still && still !== entry.segmentId && segments.has(still)
            ? Math.max(0, charTime(still, segments.get(still).length) - (voice.playedMs(still) ?? 0))
            : 0;

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
                    if (clock.now() - beganAt >= grace + owed) {
                        degrade('voice-did-not-start');
                        finish({ reason: 'timeout' });
                        return;
                    }
                    mine.cancel = clock.setTimer(check, POLL_MS);
                    return;
                }
                if (!begun) { begun = true; lastHeardAt = Math.max(lastHeardAt, clock.now()); }
                if (entry.seam) { finish({ reason: 'ended' }); return; }
                const remaining = charTime(entry.segmentId, entry.end) - played;
                if (remaining <= 0 && followMarks && !heardPast(entry)) {
                    mine.dueAt ??= clock.now();
                    if (clock.now() - Math.max(mine.dueAt, lastHeardAt) < GOVERNOR_LIMITS.markPatienceMs) {
                        mine.cancel = clock.setTimer(check, POLL_MS);
                        return;
                    }
                    // It claimed its words and has not said them: from here the estimate is all there is.
                    followMarks = false;
                }
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
            lastHeardAt = clock.now();
            if (kind === 'mark') {
                const { marks } = model(id);
                if (!marks.length || marks.at(-1)[0] < a) marks.push([a, b]);
            } else if (kind === 'end') {
                model(id).durationMs = a;
                // Each segment teaches its voice's speed once, by its length.
                const length = segments.get(id)?.length ?? 0;
                if (length > 0 && a > 0) {
                    learned.chars += length;
                    learned.ms += a;
                }
            }
        },

        /** Take over the Player’s clock. */
        install(target) {
            if (player) return;
            player = target;
            releaseGovernor = player.govern({ duration: estimate, completion: complete });
            // A paused reading is waiting on nothing; the Player will not ask again for this atom.
            stopWatchingState = player.on('state', ({ state }) => {
                if (state === 'paused' || state === 'idle' || state === 'complete') cancelWait();
                // A held voice is cancelled and spoken again, and an engine left idle may have shut down meanwhile:
                // its next start is as slow as a first one.
                if (state === 'paused') begun = false;
            });
        },

        dispose() {
            cancelWait();
            stopWatchingState?.();
            stopWatchingState = null;
            releaseGovernor?.();
            releaseGovernor = null;
            player = null;
        },

        /** The host found the voice unusable (it threw, or is gone). The reading carries on by its own timer. */
        standDown(reason) { degrade(reason); },

        /** Where in a segment the reader is when the head is on this atom: its first character. */
        positionOf(index) {
            if (index >= map.length) {
                // Past the last atom: the reading has ended, at the end of the last words.
                const last = map.findLast(item => !item.seam && item.segmentId);
                return last ? { segmentId: last.segmentId, atCharacter: last.end } : null;
            }
            const entry = map[index];
            if (!entry?.segmentId) return null;
            return { segmentId: entry.segmentId, atCharacter: entry.seam ? 0 : entry.start };
        },

        /**
         * Where the phrase the reader is on begins, and when the voice is there: the segment, its first
         * character, and the voice's time at that character. For a voice that is about to say it again.
         */
        restartPoint(index) {
            const entry = map[index];
            if (degraded || !entry?.segmentId || entry.seam) return null;
            // A voice started from a time that is only a guess says its segment's length wrongly when it ends, so
            // there has to be something the time rests on: marks heard, a duration known, or a speed learned.
            const { marks, durationMs } = model(entry.segmentId);
            if (!marks.length && durationMs === null && learned.chars === 0) return null;
            return { segmentId: entry.segmentId, charIndex: entry.start, tMs: Math.round(charTime(entry.segmentId, entry.start)) };
        },

        get degraded() { return degraded; },
        /** Exposed for measurement: when, into a segment's speech, an atom is expected to end. */
        endsAtMs(index) {
            const entry = map[index];
            return entry?.segmentId && !entry.seam ? charTime(entry.segmentId, entry.end) : null;
        }
    };
}
