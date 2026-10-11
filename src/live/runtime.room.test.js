/**
 * The model changes the room while it plays (docs/plans/LIVE-CURRENT.md §18): `@visual`, `@cue`, `@look` and `@pace`
 * lines between beats reach the runtime as room changes, anchored before the next beat. A cue lands at once when the
 * reading reaches its place; every other change at a phrase boundary, one a phrase; what is refused is a journal note
 * and the reading goes on; the reader's own settings in this reading win.
 *
 * The whole runtime on one time source (vitest's fake timers): a text-stream adapter reading a scripted model through
 * the real parser, the real reducer, Player, speech governor, beat conductor and synthetic voice. The host is a fake
 * that takes the attractor's commands as the Chamber does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from '../core/visual-control-contract.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const MS_PER_CHAR = 20;
/** A passage of several phrases, so a change can wait one phrase. */
const LONG = 'So the sky is blue, and a sunset is red, because the light of evening crosses far more air, and the blue is scattered away before it reaches you.';

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime = null;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
    await runtime?.stop();
    runtime = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/**
 * A room on a scripted model writing `text`; `answer` what it writes to an interjection. The host takes the attractor's
 * commands and a look's theme, and records when each landed against which atom the Player was on.
 */
async function open(text, { answer = '@say Of course.\n@then resume\n', look = () => ({ status: 'accepted' }) } = {}) {
    const clock = createRealClock();
    const adapter = createTextStreamAdapter({
        id: 'scripted', provider: 'test',
        connect: async (request, sink) => {
            const timer = setTimeout(() => { sink.delta(request.intent === 'interject' ? answer : text); sink.done(); }, 50);
            return { cancel: () => clearTimeout(timer), close: () => clearTimeout(timer) };
        }
    });
    const landed = [];
    const atoms = [];
    let player = null;
    const where = () => ({ at: performance.now(), atom: player?.sessionState.currentIndex ?? null });
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => {
            player = new Player(session);
            player.on('atom', ({ atom, index, concealed }) => { if (!concealed && !atom?.seam) atoms.push({ at: performance.now(), index, sourceId: atom?.sourceId }); });
            return player;
        },
        voices: { create: () => createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 50 }) },
        host: {
            present: async () => {},
            dismiss: () => {},
            discoverVisual: () => ({ manifest: ATTRACTOR_VISUAL_MANIFEST }),
            controlVisual: ({ command }) => {
                const checked = validateVisualCommand(command);
                landed.push({ ...where(), kind: 'visual', command });
                return checked.ok ? { status: 'accepted', effective: checked.effective } : { status: 'refused', code: checked.code };
            },
            changeLook: change => {
                landed.push({ ...where(), kind: 'look', ...change });
                return look(change);
            }
        }
    });
    await runtime.start('Why is the sky blue?');
    await tick(100);
    return {
        landed, atoms,
        journal: type => runtime.journal().filter(entry => entry.type === type),
        /** The first atom of passage `id` the reader saw, after `from` ms. */
        firstAtomOf: (id, from = 0) => atoms.find(entry => entry.sourceId === id && entry.at >= from)
    };
}

async function until(test, limitMs = 60_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 20) await tick(20);
    expect(test()).toBe(true);
}

describe('where a change lands', () => {
    it('at the start of the beat after its line, not when it arrives', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once.',
            '@scene field attractor palette=blue',
            '@say scene=field The air scatters blue light far more than red.',
            '@visual intensity=0.5',
            '@say So, looking up, blue reaches your eye from every direction.',
            ''
        ].join('\n'));
        expect(room.journal('room.asked')).toEqual([expect.objectContaining({ kind: 'visual.control' })]);
        // Arrived with the rest of the answer, long before the reading is there: nothing has landed.
        expect(room.landed).toEqual([]);
        await until(() => room.landed.length > 0);
        const first = room.firstAtomOf('beat-2');
        expect(room.landed[0]).toMatchObject({ kind: 'visual', command: { surface: 'attractor', parameter: 'intensity', value: 0.5 } });
        expect(room.landed[0].at - first.at).toBeGreaterThanOrEqual(0);
        expect(room.landed[0].at - first.at).toBeLessThan(50);
        expect(room.journal('room.changed')).toEqual([expect.objectContaining({ kind: 'visual.control', surface: 'attractor', parameter: 'intensity', value: 0.5 })]);
        await until(() => runtime.status === 'ended');
    });

    it('one change a phrase: a second at the same place waits for the next phrase; a cue lands at once', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once.',
            '@scene field attractor palette=blue',
            '@say scene=field The air scatters blue light far more than red.',
            '@look flame',
            '@cue field bright',
            '@visual intensity=0.5',
            `@say ${LONG}`,
            ''
        ].join('\n'));
        await until(() => room.landed.length >= 3);
        const phrases = room.atoms.filter(entry => entry.sourceId === 'beat-2');
        expect(phrases.length).toBeGreaterThanOrEqual(2);
        const look = room.landed.find(entry => entry.kind === 'look');
        const cue = room.landed.find(entry => entry.kind === 'visual' && entry.command.value === 0.75);
        const visual = room.landed.find(entry => entry.kind === 'visual' && entry.command.value === 0.5);
        expect(look).toMatchObject({ look: 'flame', theme: 'ember' });
        // The look at the first phrase of the beat after it, the cue with it, the command at the next phrase.
        expect(look.atom).toBe(phrases[0].index);
        expect(cue.atom).toBe(phrases[0].index);
        expect(visual.atom).toBe(phrases[1].index);
        expect(visual.at - phrases[1].at).toBeLessThan(50);
        expect(room.journal('room.changed').map(entry => entry.kind)).toEqual(['look.change', 'scene.cue', 'visual.control']);
    });

    it('an interjection’s change lands at the answer’s first beat, within a second of arriving', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once, and the air scatters some of it.',
            '@scene field attractor palette=blue',
            '@say scene=field The air scatters blue light far more than red.',
            ''
        ].join('\n'), { answer: '@visual intensity=0.75\n@say Brighter, then.\n@say And on we go.\n@then resume\n' });
        await until(() => runtime.position()?.segmentId === 'beat-1');
        await tick(300);
        runtime.beginInterjection();
        await runtime.interject('Make it more vibrant.');
        await until(() => room.journal('room.asked').length > 0);
        const asked = room.journal('room.asked')[0];
        await until(() => room.landed.some(entry => entry.command?.value === 0.75));
        const change = room.landed.find(entry => entry.command?.value === 0.75);
        const answerStart = room.firstAtomOf('beat-2', asked.at);
        expect(runtime.passages()[2].text).toBe('Brighter, then.');
        expect(change.atom).toBe(answerStart.index);
        expect(change.at - asked.at).toBeLessThan(1_000);
    });
});

describe('what is refused, and the reading goes on', () => {
    it('a command the running engine does not take, a cue to a scene not running, with a note each', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once.',
            '@scene field attractor palette=blue',
            '@scene other genesis',
            '@say scene=field The air scatters blue light far more than red.',
            '@visual energy=0.9',
            '@cue other set:preset=chaotic',
            '@cue elsewhere spin',
            '@say So the sky is blue.',
            ''
        ].join('\n'));
        await until(() => runtime.status === 'ended');
        expect(room.journal('room.refused')).toEqual([
            expect.objectContaining({ kind: 'visual.control', code: 'UNSUPPORTED_SURFACE' }),
            expect.objectContaining({ kind: 'scene.cue', code: 'NOT_RUNNING' })
        ]);
        expect(room.journal('run.finished')).toHaveLength(1);
    });

    it('what the reader set in this reading wins: their intensity, their theme, their pace', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once.',
            '@scene field attractor palette=blue',
            '@say scene=field The air scatters blue light far more than red.',
            '@visual intensity=0.5',
            '@say So, looking up, blue reaches your eye.',
            '@look flame',
            '@say From every direction at once.',
            '@pace 1.5',
            '@say And so the sky is blue.',
            ''
        ].join('\n'));
        runtime.noteSetting('intensity', 0.7);
        runtime.noteSetting('theme', 'jade');
        runtime.setPace(1.25);
        await until(() => runtime.status === 'ended');
        expect(room.journal('room.refused').map(entry => [entry.kind, entry.code])).toEqual([
            ['visual.control', 'READER_SET'], ['look.change', 'READER_SET'], ['pace.suggest', 'READER_SET']
        ]);
        expect(room.landed).toEqual([]);
        expect(runtime.snapshot().pace).toBe(1.25);
    });
});

describe('a suggested pace', () => {
    it('is taken when the reader set none, said as RISE’s, and the reader’s own pace takes it back', async () => {
        const room = await open([
            '@say Sunlight carries every colour at once.',
            '@pace 1.5',
            '@say The air scatters blue light far more than red.',
            '@say So the sky is blue.',
            ''
        ].join('\n'));
        await until(() => runtime.snapshot().paceSuggested !== null);
        expect(runtime.snapshot()).toMatchObject({ pace: 1.5, paceSuggested: { rate: 1.5, before: 1 } });
        expect(room.journal('room.changed')).toEqual([expect.objectContaining({ kind: 'pace.suggest', rate: 1.5 })]);
        // Not the reader's move: nothing of it is a 'pace' note.
        expect(room.journal('pace')).toEqual([]);
        runtime.setPace(1);
        expect(runtime.snapshot()).toMatchObject({ pace: 1, paceSuggested: null });
    });
});
