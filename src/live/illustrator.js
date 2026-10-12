/**
 * The illustrator (the RISE Live design §6.2; docs/plans/LIVE-CURRENT.md §19): the composer asks for a picture while it
 * goes on speaking, and RISE answers from its own engines before it asks anyone; then a second request on the room's
 * adapter draws it, held to the admission every scene is held to, repaired against that admission's own diagnostics.
 *
 *   nativeAnswer    the ladder's first two rungs: an engine's cue, or an engine started, with no request
 *   modelMedium     the third: a figure, or a code scene for motion or when asked for one
 *   draw            the request, the admission and the repair, three attempts in all
 *   withPictures    an admitted picture in the arranged reading: its scene from the beat after the one it lands in
 *   withPictureClips  and in the visual schedule: from the phrase it lands on, so the cue changes exactly there
 *
 * The runtime decides when (runtime.js); nothing here holds a clock, a Player or a voice. The illustrator never
 * speaks: what it says is counted and dropped.
 */

import { cueCommands, SCENE_ENGINES, validateScenes } from '../core/beats.js';
import { lowerCurrentLook } from '../core/current-look.js';
import { compileRiseCurrent, RISE_CURRENT_SCHEMA_V2 } from '../core/rise-current.js';
import { OPEN_LIMITS } from './adapter.js';

/** Attempts in all for one picture; pictures one reading may ask for. */
export const ILLUSTRATOR_LIMITS = Object.freeze({ attempts: OPEN_LIMITS.attempts, perReading: 4 });

/**
 * A brief that asks for motion: a code scene, unless the composer preferred a figure. Only words that name motion as
 * the picture (a labelled diagram of heat "moving" between states is still a figure).
 */
const MOTION = /\b(?:animat\w*|simulat\w*|in motion)\b/iu;
/** A brief that asks for a drawn thing: the illustrator's, even where it names an engine or one of its cues. */
const DRAWN = /\b(?:diagram\w*|chart\w*|graph\w*|label\w*|plot\w*|maps?|figures?|sketch\w*|drawing\w*|tables?)\b/iu;
/** The endings a cue's name takes in a brief: `brighter` is `bright`, `calmer` is `calm`, `surging` is `surge`. */
const ENDINGS = ['ing', 'est', 'er', 'en', 'ed', 'ly', 's'];

const wordsOf = brief => String(brief ?? '').toLowerCase().match(/[a-z]+/gu) ?? [];

/** The engine a brief names, by its id or the last word of it (`flame`); the still is not a picture. */
function engineNamed(words) {
    return SCENE_ENGINES.find(id => id !== 'still' && (words.includes(id) || words.includes(id.split('-').at(-1)))) ?? null;
}

/** One of `engine`'s named cues a brief names, as itself or with an ending: `{ cue, commands }`, or null. */
function cueNamed(words, engine) {
    for (const word of words) {
        const stems = [word, ...ENDINGS.filter(ending => word.endsWith(ending) && word.length > ending.length + 2).flatMap(ending => {
            const stem = word.slice(0, -ending.length);
            return [stem, `${stem}e`];
        })];
        for (const cue of stems) {
            // A plain word is only ever one of the engine's named cues (manifests.js; `set:` is not a word).
            const commands = cueCommands(engine, cue);
            if (commands) return { cue, commands };
        }
    }
    return null;
}

/**
 * What RISE can answer a brief with from its own engines, or null when a model has to draw it.
 * @param {string} brief the composer's words
 * @param {{running: string|null, medium?: 'cue'|'figure'|'scene'}} room the engine running where the line was written
 * @returns {{rung: 'cue', engine: string, cue: string} | {rung: 'engine', engine: string, params: object} | null}
 */
export function nativeAnswer(brief, { running = null, medium } = {}) {
    if (DRAWN.test(brief)) return null;
    const words = wordsOf(brief);
    const named = engineNamed(words);
    const engine = named ?? running;
    const found = engine ? cueNamed(words, engine) : null;
    if (found && engine === running) return { rung: 'cue', engine, cue: found.cue };
    if (named && named !== running && (medium === undefined || medium === 'cue')) {
        return { rung: 'engine', engine: named, params: Object.fromEntries((found?.commands ?? []).map(({ parameter, value }) => [parameter, value])) };
    }
    return null;
}

/**
 * The visual cue a picture's scene lowers to in a reading of this theme and look: compiled as the runtime compiles a
 * beat that starts it (a look lowered to its theme), so the clip of the phrase it lands on and the clips of the beats
 * after it carry the same cue.
 */
export function pictureCue(scene, { theme, look } = {}) {
    const session = compileRiseCurrent({
        schema: RISE_CURRENT_SCHEMA_V2, id: 'picture', title: 'Picture', origin: { kind: 'model', name: 'RISE', provider: 'RISE' },
        ...(theme ? { theme } : {}), ...(look ? { look } : {}),
        scenes: [scene], beats: [{ say: 'Picture.', scene: scene.id }]
    }, { lowerLook: lowerCurrentLook });
    return session.visualProgram.segments.find(segment => segment.match?.sourceIds?.includes('beat-0'))?.cue ?? { kind: 'still' };
}

/** The medium a model draws in: a code scene when asked for one or when the brief asks for motion, else a figure. */
export function modelMedium(brief, medium) {
    if (medium === 'scene') return 'scene';
    return medium !== 'figure' && MOTION.test(brief) ? 'scene' : 'figure';
}

/**
 * What an illustrator's answer drew, from its events: the first scene it declared with its source whole, else the
 * first cue it gave the running scene; how many beats it said (dropped); and the error it ended with, if any.
 */
export function readDrawing(events) {
    let scene = null;
    let sceneId = null;
    let cue = null;
    let spoke = 0;
    let error = null;
    for (const event of events) {
        if (event.type === 'scene.declare' && sceneId === null) {
            sceneId = event.sceneId;
            scene = event.form ? { form: event.form, source: '' } : { engine: event.engine, params: { ...(event.params ?? {}) } };
        } else if (event.type === 'scene.text' && event.sceneId === sceneId && scene.form) {
            scene.source += event.text;
        } else if (event.type === 'room.change' && cue === null && (event.kind === 'scene.cue' || event.kind === 'visual.control')) {
            const { type: _type, schema: _schema, currentId: _id, seq: _seq, ...change } = event;
            cue = change;
        } else if (event.type === 'segment.begin') {
            spoke += 1;
        } else if (event.type === 'error') {
            error = { code: event.code, message: event.message };
        }
    }
    return { scene, cue: scene ? null : cue, spoke, error };
}

const NOTHING_DRAWN = Object.freeze({ line: null, column: null, rule: 'nothing-drawn', message: 'the answer drew no picture' });
const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/**
 * Every diagnostic RISE's admission gives a picture: the adapter's (the functions the reducer and the Worker run),
 * then the shape a Current holds a scene to. Closed when nothing here can admit one: a picture is never run on trust.
 */
function diagnose(adapter, shaped) {
    let found;
    if (typeof adapter.diagnoseScene === 'function') found = adapter.diagnoseScene(shaped);
    else if (typeof adapter.admitScene === 'function') {
        const sentence = adapter.admitScene(shaped);
        found = sentence === null ? [] : [{ line: null, column: null, rule: 'refused', message: sentence }];
    } else found = [{ line: null, column: null, rule: 'refused', message: 'nothing here can admit a picture' }];
    if (found.length) return found;
    try {
        validateScenes([shaped], '$.scenes');
    } catch (caught) {
        return [{ line: null, column: null, rule: 'shape', message: String(caught?.message ?? caught) }];
    }
    return [];
}

/** Read one answer to its end, and let its connection go; an abort closes it at once, so nothing more is spent on it. */
async function answerOf(connection, signal) {
    const events = [];
    const close = () => { void Promise.resolve(connection.close()).catch(() => {}); };
    signal?.addEventListener('abort', close, { once: true });
    try {
        for await (const event of connection.events) {
            if (signal?.aborted) break;
            events.push(event);
        }
    } catch (caught) {
        events.push({ type: 'error', code: caught?.code ?? 'STREAM_LOST', message: String(caught?.message ?? caught) });
    } finally {
        signal?.removeEventListener('abort', close);
        try { await connection.close(); } catch { /* closing must always finish */ }
    }
    return events;
}

/**
 * Ask the room's adapter for a picture, and hold it to RISE's admission: a refusal goes back in the next request with
 * each diagnostic and the source refused; an answer that drew nothing counts as an attempt; a provider's own error ends
 * it at once. At most ILLUSTRATOR_LIMITS.attempts requests.
 * @param {object} options
 * @param {object} options.adapter the room's adapter (adapter.js), on the reader's key
 * @param {string} options.brief what to draw, in the composer's words
 * @param {'figure'|'scene'} options.medium
 * @param {{theme?: string, look?: string, running?: object, said: string[], asked?: string}} options.room
 * @param {AbortSignal} [options.signal] aborted when the reading has no more use for the picture
 * @param {() => number} options.now
 * @param {(type: string, body: object) => void} options.onNote the journal
 * @returns {Promise<{status: 'admitted', scene: {svg?: string, code?: string, engine?: string, params?: object}, medium: string, attempts: number, ms: number}
 *   | {status: 'cue', change: object, attempts: number, ms: number} | {status: 'failed', reason: string, attempts: number}
 *   | {status: 'aborted', attempts: number}>}
 */
export async function draw({ adapter, brief, medium, room, signal, now, onNote }) {
    const started = now();
    let repair = null;
    for (let attempt = 1; attempt <= ILLUSTRATOR_LIMITS.attempts; attempt += 1) {
        if (signal?.aborted) return { status: 'aborted', attempts: attempt - 1 };
        onNote('illustration.requested', { attempt, medium });
        let connection;
        try {
            connection = await adapter.open({ intent: 'illustrate', prompt: brief, illustration: { medium, attempt, ...room, ...(repair ? { repair } : {}) } }, { signal });
        } catch (caught) {
            if (signal?.aborted) return { status: 'aborted', attempts: attempt };
            return { status: 'failed', reason: String(caught?.code ?? 'OPEN_FAILED').slice(0, 80), attempts: attempt };
        }
        const events = await answerOf(connection, signal);
        if (signal?.aborted) return { status: 'aborted', attempts: attempt };
        const drawing = readDrawing(events);
        if (drawing.spoke) onNote('illustrator.spoke', { attempt, beats: drawing.spoke });
        const { scene } = drawing;
        if (!scene && drawing.cue) return { status: 'cue', change: drawing.cue, attempts: attempt, ms: now() - started };
        if (!scene && drawing.error && drawing.error.code !== 'EMPTY_ANSWER') {
            return { status: 'failed', reason: String(drawing.error.code ?? 'PROVIDER_FAILED').slice(0, 80), attempts: attempt };
        }
        let diagnostics;
        let shaped = null;
        if (!scene) diagnostics = [NOTHING_DRAWN];
        else {
            shaped = scene.form === undefined ? { id: 'picture', engine: scene.engine, ...(Object.keys(scene.params).length ? { params: scene.params } : {}) }
                : scene.form === 'code' ? { id: 'picture', code: scene.source } : { id: 'picture', svg: scene.source };
            diagnostics = scene.form === undefined ? diagnoseNative(shaped) : diagnose(adapter, shaped);
        }
        if (diagnostics.length === 0) {
            const { id: _id, ...picture } = shaped;
            // A native engine the illustrator named is one of RISE's own: a cue's medium.
            const drawn = { svg: 'figure', code: 'scene' }[scene.form] ?? 'cue';
            return { status: 'admitted', scene: picture, medium: drawn, attempts: attempt, ms: now() - started };
        }
        const [first] = diagnostics;
        onNote('illustration.refused', { attempt, rule: first.rule, line: first.line, column: first.column });
        repair = {
            ...(scene?.form && scene.source ? { source: scene.source.slice(0, OPEN_LIMITS.source) } : {}),
            diagnostics: diagnostics.slice(0, OPEN_LIMITS.diagnostics).map(item => ({ ...item, message: clip(String(item.message), OPEN_LIMITS.diagnostic) }))
        };
    }
    return { status: 'failed', reason: 'REFUSED', attempts: ILLUSTRATOR_LIMITS.attempts };
}

/** A native scene the illustrator declared, held to its engine's manifest. */
function diagnoseNative(shaped) {
    try {
        validateScenes([shaped], '$.scenes');
        return [];
    } catch (caught) {
        return [{ line: null, column: null, rule: 'shape', message: String(caught?.message ?? caught) }];
    }
}

// ─── the picture in the reading ──────────────────────────────────────

/**
 * The arranged reading with its pictures in it. Each picture `{ scene, key, progress }` lands in the passage named `key`
 * (graft.js pieceKey; `keyAt(index)` names the beat at `index`): its scene starts at the next beat unless that beat
 * starts one of its own, and runs until a beat does; a cue a beat under it gives the scene it replaced is let go. A
 * later picture wins over an earlier one from where it lands. Only as many pictures as a Current's scenes allow are
 * placed; a scene no beat starts is not declared (the passage it lands in draws it through its clip, withPictureClips).
 */
export function withPictures(current, pictures, keyAt) {
    if (!pictures.length) return current;
    const beats = current.beats.map(beat => ({ ...beat }));
    const own = beats.map(beat => beat.scene !== undefined);
    const room = 8 - (current.scenes?.length ?? 0);
    const placed = [];
    for (const picture of pictures) {
        const at = beats.findIndex((_, index) => keyAt(index) === picture.key);
        if (at < 0 || placed.length >= room) continue;
        placed.push(picture);
        for (let index = at + 1; index < beats.length && !own[index]; index += 1) {
            if (index === at + 1) beats[index].scene = picture.scene.id;
            delete beats[index].cue;
        }
    }
    if (!placed.length) return current;
    const started = new Set(beats.map(beat => beat.scene));
    const scenes = [...(current.scenes ?? []), ...placed.map(picture => ({ ...picture.scene })).filter(scene => started.has(scene.id))];
    return { ...current, ...(scenes.length ? { scenes } : {}), beats };
}

/**
 * The visual schedule with each picture's clip: from the phrase it lands on (`progress`, that phrase's start in its
 * passage, as the atom carries it) to the end of that passage, under an id of its own, so the schedule changes cue
 * exactly as that phrase begins and a seek before it shows what ran before. A later picture's clip is matched first.
 * `cueOf(scene)` is the cue the picture's scene lowers to, the same the next beat's clip carries, so the field keeps it
 * there rather than mounting it again; `sourceIdOf(key)` the passage named `key` as the reading's atoms name it now.
 */
export function withPictureClips(program, pictures, { atoms, cueOf, sourceIdOf = key => key }) {
    if (!program || !pictures.length) return program;
    const clips = [];
    for (const picture of pictures) {
        const sourceId = sourceIdOf(picture.key);
        if (!sourceId || !atoms.some(atom => atom.sourceId === sourceId)) continue;
        clips.unshift({ id: `picture-${picture.n}`, match: { sourceIds: [sourceId], fromProgress: picture.progress, toProgress: 1 }, cue: cueOf(picture.scene) });
    }
    return clips.length ? { ...program, segments: [...clips, ...program.segments] } : program;
}
