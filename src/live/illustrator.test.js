/**
 * The illustrator (docs/plans/LIVE-CURRENT.md §19): the ladder RISE climbs before it asks anyone, the loop that asks a
 * model for a picture and repairs it against the admission's own diagnostics, and how an admitted picture enters the
 * arranged reading and its visual schedule.
 */
import { describe, expect, it } from 'vitest';
import { cueForAtom } from '../core/visual-scheduler.js';
import { compileRiseCurrent } from '../core/rise-current.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { draw, ILLUSTRATOR_LIMITS, modelMedium, nativeAnswer, pictureCue, readDrawing, withPictureClips, withPictures } from './illustrator.js';

const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';
const SCRIPTED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>';
const fenced = (svg, form = 'svg') => `@scene picture ${form}\n\`\`\`${form}\n${svg}\n\`\`\`\n`;

describe('the ladder: RISE first, a model second', () => {
    it('answers with the running engine’s own cue when the brief names it, or its comparative', () => {
        expect(nativeAnswer('brighter attractor', { running: 'attractor' })).toEqual({ rung: 'cue', engine: 'attractor', cue: 'bright' });
        expect(nativeAnswer('make it calmer', { running: 'attractor' })).toEqual({ rung: 'cue', engine: 'attractor', cue: 'calm' });
        expect(nativeAnswer('a warmer flame', { running: 'living-flame' })).toEqual({ rung: 'cue', engine: 'living-flame', cue: 'warm' });
        // The preference does not stop RISE answering from what it has.
        expect(nativeAnswer('brighter', { running: 'attractor', medium: 'figure' })).toEqual({ rung: 'cue', engine: 'attractor', cue: 'bright' });
    });

    it('starts an engine the brief names that is not running, with its cue’s values, unless a figure or a scene was asked for', () => {
        expect(nativeAnswer('an attractor visual', { running: null })).toEqual({ rung: 'engine', engine: 'attractor', params: {} });
        expect(nativeAnswer('a brighter attractor', { running: 'genesis' })).toEqual({ rung: 'engine', engine: 'attractor', params: { intensity: 0.75 } });
        expect(nativeAnswer('a surging flame', { running: null, medium: 'cue' })).toEqual({ rung: 'engine', engine: 'living-flame', params: { energy: 0.9 } });
        expect(nativeAnswer('a fractal', { running: null, medium: 'figure' })).toBeNull();
        expect(nativeAnswer('a fractal', { running: null, medium: 'scene' })).toBeNull();
    });

    it('asks a model for anything else: a figure, or a code scene for motion or when asked for one', () => {
        // A brief that asks for a diagram, a chart or a label is the illustrator's, even where it names an engine or a cue.
        expect(nativeAnswer('a labelled diagram of a neural network', { running: null })).toBeNull();
        expect(nativeAnswer('a cool chart of the flame', { running: 'living-flame' })).toBeNull();
        for (const brief of ['a labelled diagram of the three states of water', 'brighter', 'still life', 'the stillness of ice']) {
            expect(nativeAnswer(brief, { running: null }), brief).toBeNull();
        }
        expect(modelMedium('a labelled diagram of the three states of water')).toBe('figure');
        expect(modelMedium('a labelled diagram', 'cue')).toBe('figure');
        expect(modelMedium('a diagram', 'scene')).toBe('scene');
        expect(modelMedium('molecules moving faster as water warms')).toBe('scene');
        expect(modelMedium('an animation of a wave')).toBe('scene');
        expect(modelMedium('an animation of a wave', 'figure')).toBe('figure');
    });
});

describe('what the illustrator drew', () => {
    const at = (type, body = {}) => ({ type, ...body });

    it('is the first scene it declared, with its source whole; what it said is counted, never kept', () => {
        const drawing = readDrawing([
            at('current.open'),
            at('segment.begin', { segmentId: 'beat-0', beat: {} }), at('segment.text', { segmentId: 'beat-0', offset: 0, text: 'Here it is.' }), at('segment.end', { segmentId: 'beat-0' }),
            at('scene.declare', { sceneId: 'picture', form: 'svg' }), at('scene.text', { sceneId: 'picture', offset: 0, text: '<svg' }), at('scene.text', { sceneId: 'picture', offset: 4, text: '/>' }),
            at('scene.declare', { sceneId: 'second', form: 'svg' }), at('scene.text', { sceneId: 'second', offset: 0, text: '<svg/>' }),
            at('current.complete')
        ]);
        expect(drawing).toEqual({ scene: { form: 'svg', source: '<svg/>' }, cue: null, spoke: 1, error: null });
    });

    it('is a cue to the running scene when it drew nothing else, or the error it ended with', () => {
        expect(readDrawing([at('room.change', { kind: 'scene.cue', scene: 'field', cue: 'bright' }), at('room.change', { kind: 'look.change', look: 'flame' })]))
            .toEqual({ scene: null, cue: { kind: 'scene.cue', scene: 'field', cue: 'bright' }, spoke: 0, error: null });
        expect(readDrawing([at('room.change', { kind: 'illustrate', brief: 'more' })]).cue).toBeNull();
        expect(readDrawing([at('error', { code: 'KEY_REFUSED', message: 'No.' })]).error).toEqual({ code: 'KEY_REFUSED', message: 'No.' });
    });
});

/** An adapter whose model answers each request with the next of `answers` (a string, or a function of the request). */
function scripted(answers) {
    const asked = [];
    const adapter = createTextStreamAdapter({
        id: 'illustrator', provider: 'test',
        connect: async (request, sink) => {
            asked.push(request);
            const answer = answers[Math.min(asked.length - 1, answers.length - 1)];
            const text = typeof answer === 'function' ? answer(request) : answer;
            queueMicrotask(() => {
                if (text instanceof Error) sink.error({ code: text.message, message: 'refused', recoverable: false });
                else { sink.delta(text); sink.done(); }
            });
            return { cancel() {}, close() {} };
        }
    });
    return { adapter, asked };
}

const ROOM = { theme: 'cobalt', running: { id: 'field', engine: 'attractor' }, said: ['Water comes in three states.'] };

async function drawn(answers, { medium = 'figure', room = ROOM } = {}) {
    const { adapter, asked } = scripted(answers);
    const notes = [];
    let t = 0;
    const result = await draw({ adapter, brief: 'a labelled diagram of the three states of water', medium, room, now: () => (t += 100), onNote: (type, body) => notes.push({ type, ...body }) });
    return { result, asked, notes };
}

describe('the drawing, its admission and its repair', () => {
    it('is admitted at once when the first picture passes, with one request', async () => {
        const { result, asked, notes } = await drawn([fenced(FIGURE)]);
        expect(result).toMatchObject({ status: 'admitted', scene: { svg: FIGURE }, medium: 'figure', attempts: 1 });
        expect(result.ms).toBeGreaterThan(0);
        expect(asked).toHaveLength(1);
        expect(asked[0]).toEqual({ intent: 'illustrate', prompt: 'a labelled diagram of the three states of water', illustration: { medium: 'figure', attempt: 1, ...ROOM } });
        expect(notes.map(note => note.type)).toEqual(['illustration.requested']);
    });

    it('sends each refusal and the refused source back, and is admitted on the repair; what it said is dropped and noted', async () => {
        const { result, asked, notes } = await drawn([`@say Here is your diagram.\n${fenced(SCRIPTED)}`, fenced(FIGURE)]);
        expect(result).toMatchObject({ status: 'admitted', attempts: 2, scene: { svg: FIGURE } });
        expect(asked[1].illustration).toMatchObject({ attempt: 2, repair: { source: SCRIPTED, diagnostics: [expect.objectContaining({ line: 1, rule: 'figure', message: expect.stringContaining('<script>') })] } });
        expect(notes.map(note => note.type)).toEqual(['illustration.requested', 'illustrator.spoke', 'illustration.refused', 'illustration.requested']);
        expect(notes[2]).toMatchObject({ attempt: 1, rule: 'figure', line: 1, column: expect.any(Number) });
    });

    it('fails after three refusals, and asks no more', async () => {
        const { result, asked } = await drawn([fenced(SCRIPTED)]);
        expect(result).toEqual({ status: 'failed', reason: 'REFUSED', attempts: ILLUSTRATOR_LIMITS.attempts });
        expect(asked).toHaveLength(3);
    });

    it('counts an answer that drew nothing as an attempt, and says so in the repair', async () => {
        const { result, asked } = await drawn(['@say I would rather describe it.\n', fenced(FIGURE)]);
        expect(result).toMatchObject({ status: 'admitted', attempts: 2 });
        expect(asked[1].illustration.repair).toEqual({ diagnostics: [{ line: null, column: null, rule: 'nothing-drawn', message: 'the answer drew no picture' }] });
    });

    it('ends at once on the provider’s own error: asking again would not mend a refused key', async () => {
        const { result, asked } = await drawn([new Error('KEY_REFUSED')]);
        expect(result).toEqual({ status: 'failed', reason: 'KEY_REFUSED', attempts: 1 });
        expect(asked).toHaveLength(1);
    });

    it('takes a code scene, held to the same admission and its shape, and a cue to the running scene', async () => {
        const code = 'export default function scene(rise) { return { frame() { rise.lib.clear(); } }; }';
        const { result } = await drawn([fenced('export default function scene(rise) { fetch("x"); return { frame() {} }; }', 'code'), fenced(code, 'code')], { medium: 'scene' });
        expect(result).toMatchObject({ status: 'admitted', medium: 'scene', scene: { code }, attempts: 2 });
        const cued = await drawn(['@cue field bright\n']);
        expect(cued.result).toMatchObject({ status: 'cue', change: { kind: 'scene.cue', scene: 'field', cue: 'bright' }, attempts: 1 });
    });

    it('admits nothing through an adapter that cannot admit a picture', async () => {
        const { adapter } = scripted([fenced(FIGURE)]);
        const closed = { ...adapter, diagnoseScene: undefined, admitScene: undefined };
        const result = await draw({ adapter: closed, brief: 'water', medium: 'figure', room: ROOM, now: () => 0, onNote: () => {} });
        expect(result).toEqual({ status: 'failed', reason: 'REFUSED', attempts: 3 });
    });

    it('stops, and asks no more, once its signal is aborted', async () => {
        const { adapter, asked } = scripted([fenced(SCRIPTED)]);
        const controller = new AbortController();
        const result = await draw({ adapter, brief: 'water', medium: 'figure', room: ROOM, signal: controller.signal, now: () => 0, onNote: type => { if (type === 'illustration.refused') controller.abort(); } });
        expect(result).toMatchObject({ status: 'aborted' });
        expect(asked).toHaveLength(1);
    });
});

describe('where a picture enters the reading', () => {
    const current = {
        schema: 'rise.current.v2', id: 'water', title: 'Water', theme: 'cobalt', origin: { kind: 'model', name: 'Test', provider: 'test' },
        scenes: [{ id: 'field', engine: 'attractor' }, { id: 'own', engine: 'genesis' }],
        beats: [
            { say: 'Water comes in three states. Ice is the first.', scene: 'field' },
            { say: 'Liquid is the second.', cue: 'bright' },
            { hold: { ms: 1000 } },
            { say: 'Steam is the third.', scene: 'own' },
            { say: 'That is all.' }
        ]
    };
    const keyAt = index => `beat-${index}`;
    const picture = { n: 1, scene: { id: 'picture-1', svg: FIGURE }, key: 'beat-0', progress: 0.5 };

    it('starts the picture’s scene at the beat after the one it lands in, lets go of cues to the scene it replaced, and stops where a beat starts its own', () => {
        const placed = withPictures(current, [picture], keyAt);
        expect(placed.scenes).toEqual([...current.scenes, picture.scene]);
        expect(placed.beats[0]).toEqual(current.beats[0]);
        expect(placed.beats[1]).toEqual({ say: 'Liquid is the second.', scene: 'picture-1' });
        expect(placed.beats[2]).toEqual({ hold: { ms: 1000 } });
        expect(placed.beats[3]).toEqual(current.beats[3]);
        expect(current.beats[1]).toEqual({ say: 'Liquid is the second.', cue: 'bright' });
        expect(() => compileRiseCurrent(placed)).not.toThrow();
    });

    it('adds no scene a beat does not start, places nothing whose passage is not in the reading, and fits within a Current’s scenes', () => {
        expect(withPictures(current, [{ ...picture, key: 'beat-4' }], keyAt).scenes).toEqual(current.scenes);
        expect(withPictures(current, [{ ...picture, key: 'gone' }], keyAt)).toEqual(current);
        const many = Array.from({ length: 8 }, (_, n) => ({ n: n + 1, scene: { id: `picture-${n + 1}`, svg: FIGURE }, key: 'beat-0', progress: 0 }));
        const placed = withPictures(current, many, keyAt);
        expect(placed.scenes.length).toBeLessThanOrEqual(8);
        expect(() => compileRiseCurrent(placed)).not.toThrow();
        // The later picture wins from where it lands.
        expect(placed.beats[1].scene).toBe(placed.scenes.at(-1).id);
    });

    it('changes the visual schedule’s cue exactly at the phrase it lands on, and not before', () => {
        const placed = withPictures(current, [picture], keyAt);
        const session = compileRiseCurrent(placed);
        const atoms = session.atoms.filter(atom => atom.sourceId === 'beat-0' && !atom.seam);
        expect(atoms.length).toBe(2);
        // Placed on the passage's second phrase, where that phrase begins.
        const [first, landing] = atoms;
        const at = { ...picture, progress: landing.sourceProgress };
        const program = withPictureClips(session.visualProgram, [at], { atoms: session.atoms, cueOf: scene => ({ kind: 'scene', sceneId: scene.id, svg: scene.svg }) });
        expect(cueForAtom(program, first).id).not.toBe('picture-1');
        expect(cueForAtom(program, landing)).toEqual({ id: 'picture-1', cue: { kind: 'scene', sceneId: 'picture-1', svg: FIGURE } });
        // The next beat runs the same scene under the reading's own clip, so the field keeps it rather than mounting it again.
        const next = session.atoms.find(atom => atom.sourceId === 'beat-1' && !atom.seam);
        expect(cueForAtom(program, next).cue).toEqual({ kind: 'scene', sceneId: 'picture-1', svg: FIGURE });
        expect(withPictureClips(session.visualProgram, [], { atoms: session.atoms, cueOf: () => null })).toBe(session.visualProgram);
    });

    it('gives the phrase it lands on the very cue the beats after it carry, for a figure and for an engine in the reading’s theme', () => {
        expect(pictureCue({ id: 'picture-1', svg: FIGURE }, current)).toEqual({ kind: 'scene', sceneId: 'picture-1', svg: FIGURE });
        const engine = { id: 'picture-2', engine: 'attractor', params: { intensity: 0.75 } };
        const session = compileRiseCurrent(withPictures(current, [{ n: 2, scene: engine, key: 'beat-0', progress: 0.5 }], keyAt));
        const next = session.atoms.find(atom => atom.sourceId === 'beat-1' && !atom.seam);
        expect(pictureCue(engine, current)).toEqual(cueForAtom(session.visualProgram, next).cue);
    });
});
