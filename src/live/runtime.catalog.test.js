/**
 * Catalog words in the runtime (docs/plans/LIVE-CURRENT.md §25): the reader names one of RISE's own visuals while the
 * reading is held for their words, and it is shown at once with no request; the model's own scene and visual changes
 * after that, in the same reading, are held, and the journal says so for the next request.
 *
 * The whole runtime on one time source (vitest's fake timers): a text-stream adapter reading a scripted model through
 * the real parser, reducer, Player, speech governor, beat conductor and synthetic voice. The host takes the attractor's
 * commands as the Chamber does, and a visual schedule follows the Player as the Chamber's does, so what is on screen
 * is measured, not assumed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from '../core/visual-control-contract.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { admitPerception, describePerception, perceive } from './perception.js';
import { recogniseVisual } from './catalog-words.js';
import { createFrameDirector, FRAME_OF, FRAME_OPEN_MS, frameOf, visualOf } from './host/frames.js';
import { SCENE_MANIFESTS, collectionEngine } from '../core/beats.js';

const MS_PER_CHAR = 20;
const LONG = 'So the sky is blue, and a sunset is red, because the light of evening crosses far more air, and the blue is scattered away before it reaches you.';

/** A field, a passage of several phrases under it, then the model's own changes: a visual, a cue, a scene, a picture. */
const READING = [
    '@say Light scattered by air is the whole story.',
    '@scene field attractor palette=blue',
    `@say scene=field ${LONG}`,
    '@cue field bright',
    '@visual intensity=0.7',
    '@say A second thing about the field.',
    '@scene gen genesis preset=chaotic',
    '@say scene=gen And a third, which starts a scene of its own.',
    '@illustrate medium=cue fractal',
    '@say And the last words of all.',
    ''
].join('\n');

const tick = ms => vi.advanceTimersByTimeAsync(ms);
const runtimes = [];

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
    for (const runtime of runtimes.splice(0)) await runtime.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/** A room on a scripted model; records every request, every command the host took, every atom shown and every cue. */
async function open(text = READING, { answer = '@say Of course.\n@then resume\n' } = {}) {
    const clock = createRealClock();
    const requests = [];
    const adapter = createTextStreamAdapter({
        id: 'scripted', provider: 'test',
        connect: async (request, sink) => {
            requests.push(request);
            const timer = setTimeout(() => {
                sink.delta(request.intent === 'interject' ? answer : text);
                sink.done();
            }, 50);
            return { cancel: () => clearTimeout(timer), close: () => clearTimeout(timer) };
        }
    });
    const landed = [];
    const atoms = [];
    const cues = [];
    let player = null;
    let schedule = null;
    const runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => {
            player = new Player(session);
            schedule = new VisualScheduleController(session.visualProgram, cue => cues.push({ at: performance.now(), cue }), { atoms: session.atoms });
            player.on('atom', ({ atom, index, concealed }) => {
                if (concealed) return;
                schedule.observe(atom);
                if (!atom?.seam) atoms.push({ at: performance.now(), index, sourceId: atom?.sourceId });
            });
            player.on('extended', () => schedule.extend(player.sessionState.session.visualProgram, player.sessionState.session.atoms));
            return player;
        },
        voices: { create: () => createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 50 }) },
        host: {
            present: async () => {},
            dismiss: () => {},
            discoverVisual: () => ({ manifest: ATTRACTOR_VISUAL_MANIFEST }),
            controlVisual: ({ command }) => {
                const checked = validateVisualCommand(command);
                landed.push({ at: performance.now(), command });
                return checked.ok ? { status: 'accepted', effective: checked.effective } : { status: 'refused', code: checked.code };
            }
        }
    });
    runtimes.push(runtime);
    await runtime.start('Why is the sky blue?');
    await tick(100);
    return {
        runtime, requests, landed, atoms, cues,
        journal: type => runtime.journal().filter(entry => entry.type === type)
    };
}

async function until(test, limitMs = 90_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 20) await tick(20);
    expect(test()).toBe(true);
}

const shown = (room, from) => room.cues.filter(entry => entry.at >= from).map(entry => entry.cue);
const isGenesis = cue => cue.kind === 'field' && cue.renderer === 'genesis';
const isFractal = cue => cue.kind === 'procedural' && cue.collections?.[0] === 'fractal';

/** The reading is on the field's long passage, a phrase in, and the reader begins to speak. */
async function heldInTheField(room) {
    await until(() => room.atoms.filter(atom => atom.sourceId === 'beat-1').length >= 2);
    room.runtime.beginInterjection();
    return performance.now();
}

describe('the reader names an engine', () => {
    it('is shown at once, the reading goes on, and nothing is asked', async () => {
        const room = await open();
        const at = await heldInTheField(room);
        expect(room.runtime.chooseVisual({ engine: 'harmonograph', params: { pendulums: 'rotary' } })).toBe(true);
        expect(room.runtime.status).toBe('live');
        expect(room.runtime.snapshot().interjection.state).toBe('none');
        await until(() => room.atoms.some(atom => atom.at > at));
        const next = room.atoms.find(atom => atom.at > at);
        const harmonograph = room.cues.find(entry => entry.at >= at && entry.cue.collections?.[0] === 'harmonograph');
        expect(harmonograph?.cue).toMatchObject({ kind: 'procedural', config: { pendulums: 'rotary' } });
        expect(harmonograph.at).toBeLessThanOrEqual(next.at);
        expect(room.journal('visual.chosen')).toEqual([expect.objectContaining({ engine: 'harmonograph', params: { pendulums: 'rotary' } })]);
        await until(() => room.journal('run.finished').length > 0);
        expect(room.requests.map(request => request.intent)).toEqual(['answer']);
    });

    it('holds the model’s later scenes, visuals, cues and pictures in the same reading, and says so', async () => {
        const room = await open();
        const at = await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'harmonograph', params: {} });
        await until(() => room.journal('run.finished').length > 0);
        const after = shown(room, at);
        expect(after.some(isGenesis)).toBe(false);
        expect(after.some(isFractal)).toBe(false);
        expect(after.at(-1)).toMatchObject({ kind: 'procedural', collections: ['harmonograph'] });
        expect(room.landed.filter(entry => entry.at >= at)).toEqual([]);
        expect(room.journal('room.held').map(entry => entry.kind).sort()).toEqual(['illustrate', 'scene', 'scene.cue', 'visual.control']);
        expect(room.journal('room.held').find(entry => entry.kind === 'scene')).toMatchObject({ scene: 'gen' });
        expect(room.journal('room.changed')).toEqual([]);
        expect(room.journal('illustration.dropped')).toEqual([expect.objectContaining({ reason: 'READER_CHOSE' })]);
        expect(room.journal('illustrated')).toEqual([]);
    });

    it('an answer that names one of RISE’s engines before its first beat is grafted and shows it (no choice made)', async () => {
        const room = await open(READING, { answer: '@illustrate medium=cue fractal\n@say Spacetime bends around every mass.\n@then resume\n' });
        await until(() => room.atoms.some(atom => atom.sourceId === 'beat-2'));
        const asked = performance.now();
        room.runtime.beginInterjection();
        await room.runtime.interject('Draw me spacetime bending.');
        await until(() => room.journal('interjection.answered').length + room.journal('interjection.failed').length > 0);
        expect(room.journal('interjection.failed')).toEqual([]);
        await until(() => shown(room, asked).some(isFractal));
    });

    it('the reader’s own later question ends the hold: its answer’s scenes and picture apply, and a new choice holds again', async () => {
        const LATER = `${READING}@scene late neural\n@say scene=late One more scene of its own, near the end.\n`;
        const answer = '@illustrate medium=cue fractal\n@say Spacetime bends around every mass.\n@scene glow living-flame\n@say scene=glow And light follows the bend.\n@then resume\n';
        const room = await open(LATER, { answer });
        const chosen = await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'harmonograph', params: {} });
        // Until the reader asks, the reading's own scene is held.
        await until(() => room.atoms.some(atom => atom.at > chosen && atom.sourceId === 'beat-3'));
        expect(shown(room, chosen).some(isGenesis)).toBe(false);
        expect(room.journal('room.held').map(entry => entry.scene)).toContain('gen');
        const asked = performance.now();
        room.runtime.beginInterjection();
        await room.runtime.interject('Draw me spacetime bending.');
        await until(() => room.journal('interjection.answered').length > 0);
        expect(room.requests.map(request => request.intent)).toEqual(['answer', 'interject']);
        await until(() => shown(room, asked).some(cue => cue.kind === 'field' && cue.renderer === 'living-flame'));
        expect(shown(room, asked).some(isFractal)).toBe(true);
        expect(room.journal('illustrated')).toEqual([expect.objectContaining({ brief: 'fractal' })]);
        expect(room.journal('room.held').map(entry => entry.scene)).not.toContain('i1-glow');
        // A new choice holds again: the scene the reading starts after it is not shown.
        const key = () => room.runtime.passages()[room.runtime.position().segmentIndex]?.key;
        await until(() => key() === 'beat-4');
        room.runtime.beginInterjection();
        const again = performance.now();
        expect(room.runtime.chooseVisual({ engine: 'attractor', params: { trace: 'swarm' } })).toBe(true);
        await until(() => room.journal('run.finished').length > 0);
        expect(shown(room, again).some(cue => cue.collections?.[0] === 'neural')).toBe(false);
        expect(room.journal('room.held').map(entry => entry.scene)).toContain('late');
    });

    it('the hold is the reading’s own: a reading where the reader chose nothing shows the model’s scenes', async () => {
        const room = await open();
        await until(() => room.journal('run.finished').length > 0);
        expect(room.cues.map(entry => entry.cue).some(isGenesis)).toBe(true);
        expect(room.journal('room.changed').map(entry => entry.kind).sort()).toEqual(['scene.cue', 'visual.control']);
        expect(room.journal('room.held')).toEqual([]);
    });

    it('a seek back before the choice shows what played there, and the choice again where it was made', async () => {
        const room = await open();
        const at = await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'harmonograph', params: {} });
        await until(() => room.atoms.some(atom => atom.sourceId === 'beat-3'));
        const back = performance.now();
        room.runtime.seek({ segmentId: 'beat-1' });
        await until(() => room.atoms.some(atom => atom.at > back && atom.sourceId === 'beat-2'));
        const replayed = shown(room, back);
        expect(replayed[0]).toMatchObject({ kind: 'field', renderer: 'attractor' });
        expect(replayed.some(cue => cue.collections?.[0] === 'harmonograph')).toBe(true);
        expect(replayed.some(isGenesis)).toBe(false);
        expect(at).toBeLessThan(back);
    });

    it('is refused unless the reading is held for the reader’s words, and for what is not an engine RISE shows', async () => {
        const room = await open();
        await until(() => room.atoms.some(atom => atom.sourceId === 'beat-1'));
        expect(() => room.runtime.chooseVisual({ engine: 'attractor', params: {} })).toThrow(expect.objectContaining({ code: 'NOT_HELD' }));
        room.runtime.beginInterjection();
        expect(room.runtime.chooseVisual({ engine: 'still', params: {} })).toBe(false);
        expect(room.runtime.chooseVisual({ engine: 'oracle', params: {} })).toBe(false);
        expect(room.runtime.chooseVisual({ engine: 'attractor', params: { trace: 'smoke' } })).toBe(false);
        expect(room.runtime.snapshot().interjection.state).toBe('held');
        expect(room.runtime.chooseVisual({ engine: 'attractor', params: { trace: 'swarm' } })).toBe(true);
        expect(room.runtime.snapshot().interjection.state).toBe('none');
    });
});

/** A field under one long hold: a single phrase on screen for nine seconds, the next only after it. */
const HELD = running => ['@say The room is quiet.', `@scene field ${running}`, '@hold 9000 scene=field', '@say And the reading goes on.', ''].join('\n');
const NAMED = SCENE_MANIFESTS.map(manifest => manifest.id).filter(id => id !== 'still' && id !== 'oracle');

describe('every engine the reader names is on screen within the frame’s own transition, not at the next phrase', () => {
    it.each(NAMED)('%s', async engine => {
        const running = engine === 'attractor' ? 'genesis' : 'attractor';
        const room = await open(HELD(running));
        const director = createFrameDirector();
        let fed = 0;
        // As the venue's animation frames do: each frame, the visual on screen is seen, then the room is drawn.
        const frames = async ms => {
            for (let elapsed = 0; elapsed < ms; elapsed += 16) {
                await tick(16);
                for (; fed < room.cues.length; fed += 1) director.see(frameOf(room.cues[fed].cue), room.cues[fed].at);
                director.at(performance.now());
            }
        };
        await until(() => room.atoms.some(atom => atom.sourceId === 'beat-1'));
        await frames(2000);
        expect(visualOf(room.cues.at(-1).cue)).toBe(running);
        expect(director.settled(performance.now())).toBe(true);

        room.runtime.beginInterjection();
        const at = performance.now();
        const chosen = recogniseVisual(engine.split('-').join(' '), { running: room.runtime.visualEngine() });
        expect(chosen).toMatchObject({ engine, params: {} });
        expect(room.runtime.chooseVisual(chosen)).toBe(true);
        // A collection's cue is a `sourced` one, shown by the collection's name and framed as an image is.
        const framed = FRAME_OF[engine] ?? frameOf({ kind: 'sourced' });
        await frames(FRAME_OPEN_MS[FRAME_OF[running]] + FRAME_OPEN_MS[framed] + 50);
        expect(room.atoms.at(-1).sourceId).toBe('beat-1');
        expect(collectionEngine(room.cues.at(-1).cue) ?? visualOf(room.cues.at(-1).cue)).toBe(engine);
        expect(room.cues.at(-1).at - at).toBeLessThan(50);
        expect(director.at(performance.now())).toMatchObject({ frame: framed, a: 1 });
        expect(director.settled(performance.now())).toBe(true);
    });
});

describe('the reader names a cue', () => {
    it('lands on the engine running at once, and the model’s later changes are held', async () => {
        const room = await open();
        const at = await heldInTheField(room);
        expect(room.runtime.visualEngine()).toBe('attractor');
        expect(room.runtime.chooseVisual({ engine: 'attractor', cue: 'calm' })).toBe(true);
        expect(room.landed.filter(entry => entry.at >= at).map(entry => entry.command)).toEqual([{ surface: 'attractor', parameter: 'intensity', value: 0.45 }]);
        expect(room.runtime.status).toBe('live');
        await until(() => room.journal('run.finished').length > 0);
        expect(room.landed.filter(entry => entry.at >= at)).toHaveLength(1);
        expect(shown(room, at).some(isGenesis)).toBe(false);
        expect(room.journal('visual.chosen')).toEqual([expect.objectContaining({ engine: 'attractor', cue: 'calm' })]);
        expect(room.requests.map(request => request.intent)).toEqual(['answer']);
    });

    it('is not taken for an engine that is not running, or a cue it does not have', async () => {
        const room = await open();
        await heldInTheField(room);
        expect(room.runtime.chooseVisual({ engine: 'living-flame', cue: 'warm' })).toBe(false);
        expect(room.runtime.chooseVisual({ engine: 'attractor', cue: 'warm' })).toBe(false);
        expect(room.runtime.snapshot().interjection.state).toBe('held');
        expect(room.journal('visual.chosen')).toEqual([]);
    });
});

describe('the next request is told (perception)', () => {
    it('a beat’s own cue held after the choice is said as held too', async () => {
        const CUED = ['@say Light scattered by air is the whole story.', '@scene field attractor palette=blue', `@say scene=field ${LONG}`, '@say cue=bright And now the field brightens.', ''].join('\n');
        const room = await open(CUED);
        const at = await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'attractor', cue: 'calm' });
        await until(() => room.journal('run.finished').length > 0);
        expect(room.landed.filter(entry => entry.at >= at).map(entry => entry.command.value)).toEqual([0.45]);
        expect(room.journal('room.held')).toEqual([expect.objectContaining({ kind: 'scene.cue' })]);
        const { events } = perceive(room.runtime.journal(), { passages: room.runtime.passages() });
        expect(events.filter(event => event.type === 'withheld')).toEqual([{ type: 'withheld', by: 'rise' }]);
    });

    it('carries the reader’s request and that RISE’s own changes after it were held', async () => {
        const room = await open();
        await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'attractor', params: { trace: 'swarm' } });
        await until(() => room.journal('run.finished').length > 0);
        const perception = perceive(room.runtime.journal(), { passages: room.runtime.passages() });
        expect(perception.events.filter(event => ['chose', 'withheld'].includes(event.type))).toEqual([
            { type: 'chose', engine: 'attractor', values: ['swarm'] },
            { type: 'withheld', by: 'rise' }
        ]);
        expect(admitPerception(perception)).toEqual(perception);
        const block = describePerception(perception);
        expect(block).toContain('- asked for the attractor (swarm), and it was shown at once');
        expect(block).toContain('- RISE’s own scene changes after that were held');
    });
});
