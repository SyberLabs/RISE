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

    it('holds the scenes of an answer to a later question grafted into the same reading, and still answers it', async () => {
        const room = await open(READING, { answer: '@scene glow living-flame\n@say scene=glow It never repeats because it is chaotic.\n@then resume\n' });
        await heldInTheField(room);
        room.runtime.chooseVisual({ engine: 'harmonograph', params: {} });
        await until(() => room.atoms.some(atom => atom.sourceId === 'beat-2'));
        const asked = performance.now();
        room.runtime.beginInterjection();
        await room.runtime.interject('Why does it never repeat?');
        await until(() => room.journal('interjection.answered').length > 0);
        await until(() => room.journal('run.finished').length > 0);
        expect(room.requests.map(request => request.intent)).toEqual(['answer', 'interject']);
        expect(room.runtime.passages().some(passage => passage.text === 'It never repeats because it is chaotic.')).toBe(true);
        // Nor the field the graft would take up again after the answer: the reader's choice stays.
        expect(shown(room, asked).some(cue => cue.kind === 'field')).toBe(false);
        expect(room.journal('room.held').filter(entry => entry.kind === 'scene').map(entry => entry.scene)).toEqual(expect.arrayContaining(['gen', 'i1-glow', 'field']));
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
