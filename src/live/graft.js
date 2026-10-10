/**
 * The room's reading, arranged around the reader's interjections (the RISE Live design §6.1;
 * docs/plans/LIVE-CURRENT.md §17).
 *
 * A room begins as its own answer, beat by beat. An interjection cuts the reading after the passage the reader was in:
 * the answer's beats go in there as they arrive, and the rest of the reading (the tail) is held aside, so the voice
 * cannot run on into it while the answer is still being written. The ending the answer named then puts the tail back
 * (`resume`, led by the held passage taken up from the phrase the voice was held at) or withdraws it (`replace`, `end`).
 *
 * The arrangement is a list of pieces: `{ base: i }` the room's own beat i, `{ answer: n, beat: j }` beat j of the
 * n-th answer, `{ taken }` a passage taken up again (a beat); a piece may carry `restore`, a scene to start again where the room's
 * reading resumes after an answer that started its own. It is lowered to ONE `rise.current.v2` in reading order, so a
 * beat's id is its place (`beat-<n>`) and is unique across the whole run by construction; an answer's scenes are named
 * `i<n>-<id>`, so they never meet the room's.
 *
 * Pure: no clock, no Player, no voice. Every function returns a new arrangement.
 */

import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../core/rise-current.js';

/** The room's first `count` beats, placed: its tail is open to the beats it has still to write. */
export function arrangeRoom(count) {
    return placeBase({ pieces: [], baseNext: 0, tail: 'open', aside: null }, count);
}

/** The room's beats that have ended since, placed at the end while its tail is open; otherwise they wait. */
export function placeBase(room, count) {
    if (room.tail !== 'open' || count <= room.baseNext) return room;
    const placed = Array.from({ length: count - room.baseNext }, (_, k) => ({ base: room.baseNext + k }));
    return { ...room, pieces: [...room.pieces, ...placed], baseNext: count };
}

/**
 * Cut the reading after the piece at `after` (the passage the reader was in) for the next answer. `taken` is that
 * passage's beat to take up again on resume, or null; `running` the scene running there, or null.
 */
export function cutAfter(room, { after, taken, running }) {
    if (room.aside) throw new RangeError('One interjection at a time: an answer is still being written');
    if (!Number.isInteger(after) || after < 0 || after >= room.pieces.length) throw new RangeError(`There is no passage ${after} to cut after`);
    return {
        ...room,
        pieces: room.pieces.slice(0, after + 1),
        tail: 'aside',
        aside: { pieces: room.pieces.slice(after + 1), tail: room.tail, taken, running }
    };
}

/** The `n`-th answer has written `count` beats: those not yet placed go at the end. */
export function growAnswer(room, n, count) {
    if (!room.aside) throw new RangeError('No answer is being written');
    const have = room.pieces.filter(piece => piece.answer === n).length;
    if (count <= have) return room;
    const placed = Array.from({ length: count - have }, (_, k) => ({ answer: n, beat: have + k }));
    return { ...room, pieces: [...room.pieces, ...placed] };
}

/**
 * The answer is written, and named its ending. `resume` puts back the held passage taken up and the tail, starting the
 * room's scene again where it resumes when the answer started one of its own (`sceneStarted`); `replace` and `end`
 * withdraw the tail, and with it whatever the room had still to write.
 */
export function closeAnswer(room, ending, { sceneStarted }) {
    if (!room.aside) throw new RangeError('No answer is being written');
    const { pieces, tail, taken, running } = room.aside;
    if (ending !== 'resume') return { ...room, tail: 'withdrawn', aside: null };
    const resumed = [...(taken ? [{ taken }] : []), ...pieces];
    if (sceneStarted && running !== null && resumed.length) {
        const [first] = resumed;
        resumed[0] = first.taken ? { taken: { ...first.taken, scene: first.taken.scene ?? running } } : { ...first, restore: running };
    }
    return { ...room, pieces: [...room.pieces, ...resumed], tail, aside: null };
}

/** The scene running at beat `index` of `beats`: the last one started at or before it, or null. */
export function runningScene(beats, index) {
    for (let at = Math.min(index, beats.length - 1); at >= 0; at -= 1) {
        if (beats[at].scene !== undefined) return beats[at].scene;
    }
    return null;
}

/**
 * What of the held passage is said again when the reading resumes: its said words from `atCharacter` (the start of
 * the phrase the voice was held at), with its place, size and face; null for a hold or a shown line (time, not words
 * to take up), for a passage heard to its end, or when there is no phrase (`atCharacter` null). A passage said one way
 * and shown another is taken up whole: what is shown is not cut by what was said.
 */
export function takenUp(beat, atCharacter) {
    if (beat?.say === undefined || !Number.isInteger(atCharacter)) return null;
    const rest = beat.say.slice(atCharacter).trim();
    if (!rest) return null;
    const look = {};
    for (const key of ['place', 'size', 'type']) if (beat[key] !== undefined) look[key] = beat[key];
    return beat.show === undefined ? { say: rest, ...look } : { say: beat.say, show: beat.show, ...look };
}

/** An answer's beats and scenes; one written in passages is said beat by beat, a literal passage left out. */
export function answerBeats(current) {
    if (current.schema === RISE_CURRENT_SCHEMA_V2) return { beats: current.beats, scenes: current.scenes ?? [] };
    return { beats: current.segments.filter(segment => !segment.literal).map(segment => ({ say: segment.text })), scenes: [] };
}

const copy = beat => JSON.parse(JSON.stringify(beat));

/**
 * The arranged reading as one `rise.current.v2`: the room's title, origin and look, the scenes its beats start, and
 * the beats in reading order. `base` is the room's own Current so far (its ended beats); `answers[n]` the n-th
 * answer's. Validated as any Current is: an arrangement past a Current's bounds is refused, never cut silently.
 */
export function lowerRoom(room, { base, answers }) {
    const named = answers.map(answerBeats);
    const sceneId = (n, id) => `i${n + 1}-${id}`;
    const beats = room.pieces.map(piece => {
        let beat;
        if (piece.taken) beat = copy(piece.taken);
        else if (piece.answer !== undefined) {
            beat = copy(named[piece.answer].beats[piece.beat]);
            if (beat.scene !== undefined) beat.scene = sceneId(piece.answer, beat.scene);
        } else beat = copy(base.beats[piece.base]);
        if (piece.restore !== undefined && beat.scene === undefined) beat.scene = piece.restore;
        return beat;
    });
    const pool = [
        ...(base.scenes ?? []),
        ...named.flatMap(({ scenes }, n) => scenes.map(scene => ({ ...scene, id: sceneId(n, scene.id) })))
    ];
    const started = new Set(beats.map(beat => beat.scene).filter(Boolean));
    const scenes = pool.filter(scene => started.has(scene.id)).map(copy);
    const { scenes: _scenes, beats: _beats, ...header } = base;
    const current = { ...copy(header), ...(scenes.length ? { scenes } : {}), beats };
    // Returned as written, as the stream's own lowering is (stream.js toCurrent), once the validator has held it.
    validateRiseCurrent(current);
    return current;
}
