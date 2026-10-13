/**
 * The illustrator in the runtime (docs/plans/LIVE-CURRENT.md §19): the composer's `@illustrate` line is answered from
 * RISE's own engines with no request, or by a second request on the room's adapter whose picture is admitted, repaired
 * and placed at the next phrase boundary; the voice never waits for it; a reading that ends first lets it go.
 *
 * The whole runtime on one time source (vitest's fake timers): a text-stream adapter reading scripted models (the
 * composer, and the illustrator by intent) through the real parser, the real reducer, Player, speech governor, beat
 * conductor and synthetic voice. The host takes the attractor's commands as the Chamber does, and a visual schedule
 * follows the Player as the Chamber's does, so when the picture's cue is emitted is measured, not assumed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from '../core/visual-control-contract.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { perceive } from './perception.js';

const MS_PER_CHAR = 20;
const BREATH_MS = 50;
const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';
const SCRIPTED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>';
const fenced = svg => `@scene picture svg\n\`\`\`svg\n${svg}\n\`\`\`\n`;

const WATER = [
    '@say Water comes in three states.',
    '@scene field attractor palette=blue',
    '@say scene=field Which one you meet depends on how fast its molecules move.',
    '@illustrate medium=cue brighter attractor',
    '@say As water warms, the molecules move faster, and the field grows brighter.',
    '@illustrate a labelled diagram of the three states of water',
    '@say Let me draw the three states for you.',
    '@say In ice, the molecules are locked in a lattice. They only vibrate where they are.',
    '@say In liquid water, they slide past one another, close but free.',
    '@say In steam, they fly apart and fill whatever space they find.',
    '@say Heat moves water from one state to the next, and cooling moves it back.',
    ''
].join('\n');

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
 * A room on a scripted composer writing `text`; `answer` what it writes to an interjection; `illustrate(request)` what
 * the illustrator answers each request, `{ text, ms }`. Records every request, every command the host took, every atom
 * the reader saw and every cue the visual schedule emitted, each on the one clock.
 */
async function open(text, { answer = '@say Of course.\n@then resume\n', illustrate = () => ({ text: fenced(FIGURE), ms: 800 }) } = {}) {
    const clock = createRealClock();
    const requests = [];
    const closed = [];
    const adapter = createTextStreamAdapter({
        id: 'scripted', provider: 'test',
        connect: async (request, sink) => {
            requests.push(request);
            const drawn = request.intent === 'illustrate' ? illustrate(request) : null;
            const timer = setTimeout(() => {
                sink.delta(drawn ? drawn.text : request.intent === 'interject' ? answer : text);
                sink.done();
            }, drawn ? drawn.ms : 50);
            return { cancel: () => clearTimeout(timer), close: () => { clearTimeout(timer); closed.push(request.intent); } };
        }
    });
    const landed = [];
    const atoms = [];
    const cues = [];
    let player = null;
    let schedule = null;
    const where = () => ({ at: performance.now(), atom: player?.sessionState.currentIndex ?? null });
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => {
            player = new Player(session);
            schedule = new VisualScheduleController(session.visualProgram, (cue, { cueId }) => cues.push({ at: performance.now(), cueId, cue }), { atoms: session.atoms });
            player.on('atom', ({ atom, index, concealed }) => {
                if (concealed) return;
                schedule.observe(atom);
                if (!atom?.seam) atoms.push({ at: performance.now(), index, sourceId: atom?.sourceId });
            });
            // As the Chamber adopts a longer Session: the schedule takes the longer program.
            player.on('extended', () => schedule.extend(player.sessionState.session.visualProgram, player.sessionState.session.atoms));
            return player;
        },
        voices: { create: () => createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: BREATH_MS }) },
        host: {
            present: async () => {},
            dismiss: () => {},
            discoverVisual: () => ({ manifest: ATTRACTOR_VISUAL_MANIFEST }),
            controlVisual: ({ command }) => {
                const checked = validateVisualCommand(command);
                landed.push({ ...where(), command });
                return checked.ok ? { status: 'accepted', effective: checked.effective } : { status: 'refused', code: checked.code };
            }
        }
    });
    await runtime.start('What are the three states of water?');
    await tick(100);
    return {
        requests, closed, landed, atoms, cues,
        journal: type => runtime.journal().filter(entry => entry.type === type),
        firstAtomOf: (id, from = 0) => atoms.find(entry => entry.sourceId === id && entry.at >= from)
    };
}

async function until(test, limitMs = 90_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 20) await tick(20);
    expect(test()).toBe(true);
}

/** The longest silence between one utterance's end and the next one's start: the voice never waited for a picture. */
function longestGap(journal) {
    let gap = 0;
    let ended = null;
    for (const entry of journal) {
        if (entry.type === 'speech.end') ended = entry.at;
        else if (entry.type === 'speech.start' && ended !== null) { gap = Math.max(gap, entry.at - ended); ended = null; }
    }
    return gap;
}

describe('RISE answers from its own engines first', () => {
    it('a cue the running engine takes lands at once where the line was written, with no request', async () => {
        const room = await open(WATER, { illustrate: () => ({ text: fenced(FIGURE), ms: 800 }) });
        await until(() => room.journal('illustrated').some(entry => entry.medium === 'cue'));
        const [asked] = room.journal('illustration.asked');
        expect(asked).toMatchObject({ n: 1, brief: 'brighter attractor', medium: 'cue', rung: 'cue' });
        const cue = room.journal('illustrated').find(entry => entry.n === 1);
        expect(cue).toMatchObject({ medium: 'cue', brief: 'brighter attractor' });
        // The attractor's own cue, bright: its intensity, through the host as the reader's own control goes.
        expect(room.landed.find(item => item.command.parameter === 'intensity')).toMatchObject({ command: { surface: 'attractor', parameter: 'intensity', value: 0.75 } });
        // As the beat after the line began.
        const first = room.firstAtomOf('beat-2');
        expect(cue.at - first.at).toBeGreaterThanOrEqual(0);
        expect(cue.at - first.at).toBeLessThan(50);
        // No request for it: the only illustrator request is the figure's.
        expect(room.requests.filter(request => request.intent === 'illustrate').map(request => request.prompt)).not.toContain('brighter attractor');
        expect(room.journal('illustration.requested').filter(entry => entry.n === 1)).toEqual([]);
    });
});

describe('the illustrator draws, RISE admits and repairs, and the picture lands at the next phrase', () => {
    it('refused, repaired, admitted, placed: the schedule changes cue as a phrase begins, and the voice never waits', async () => {
        const room = await open(WATER, {
            illustrate: request => (request.illustration.attempt === 1
                ? { text: `@say Here is your diagram.\n${fenced(SCRIPTED)}`, ms: 1_500 }
                : { text: fenced(FIGURE), ms: 1_500 })
        });
        await until(() => room.journal('illustrated').some(entry => entry.n === 2));
        const figure = runtime.journal().filter(entry => entry.n === 2).map(entry => entry.type);
        expect(figure).toEqual(['illustration.asked', 'illustration.requested', 'illustrator.spoke', 'illustration.refused', 'illustration.requested', 'illustration.admitted', 'illustrated']);
        const [refused] = room.journal('illustration.refused');
        expect(refused).toMatchObject({ n: 2, attempt: 1, rule: 'figure', line: 1 });
        expect(room.journal('illustration.admitted')[0]).toMatchObject({ n: 2, attempt: 2, medium: 'figure' });

        // The illustrator was given the room, and the second time what was refused and why.
        const asked = room.requests.filter(request => request.intent === 'illustrate');
        expect(asked).toHaveLength(2);
        expect(asked[0].illustration).toMatchObject({ medium: 'figure', attempt: 1, running: { id: 'field', engine: 'attractor' } });
        expect(asked[0].illustration.said.length).toBeGreaterThan(0);
        expect(asked[1].illustration.repair).toMatchObject({ source: SCRIPTED, diagnostics: [expect.objectContaining({ rule: 'figure' })] });

        // Placed at the next phrase after admission: the cue was emitted as that phrase began, and no phrase began between.
        const admitted = room.journal('illustration.admitted')[0];
        const illustrated = room.journal('illustrated').find(entry => entry.n === 2);
        const emitted = room.cues.find(item => item.cueId === 'picture-2' || item.cue?.sceneId === 'picture-2');
        expect(emitted, 'the schedule put the picture up').toBeTruthy();
        expect(emitted.cue).toMatchObject({ kind: 'scene', svg: FIGURE });
        const phrase = room.atoms.find(entry => entry.at >= admitted.at);
        expect(Math.abs(emitted.at - phrase.at)).toBeLessThan(5);
        expect(Math.abs(illustrated.at - phrase.at)).toBeLessThan(5);
        expect(illustrated).toMatchObject({ medium: 'figure', brief: 'a labelled diagram of the three states of water' });
        expect(illustrated.ms).toBeGreaterThan(3_000);

        // The voice never waited: nothing held or paused it, and no silence beyond its own breath between phrases.
        await until(() => runtime.status === 'ended');
        const journal = runtime.journal();
        expect(journal.filter(entry => ['hold', 'voice.held', 'interjection.held'].includes(entry.type))).toEqual([]);
        expect(longestGap(journal)).toBeLessThan(BREATH_MS * 4);
        // The picture went up as RISE's own change.
        expect(perceive(journal).events).toEqual(expect.arrayContaining([{ type: 'drew', by: 'rise', medium: 'figure', brief: 'a labelled diagram of the three states of water' }]));
        // The passages name the scenes the reading's own Current starts; the picture is remembered by its brief, not as one.
        const scenes = runtime.passages().map(passage => passage.scene).filter(scene => scene !== undefined);
        expect(scenes).toContain('field');
        expect(scenes).not.toContain('picture-2');
    });

    it('a third refusal lets the picture go: the reading goes on and ends, and the snapshot says why', async () => {
        const room = await open(WATER, { illustrate: () => ({ text: fenced(SCRIPTED), ms: 300 }) });
        await until(() => room.journal('illustration.failed').length > 0);
        expect(room.journal('illustration.failed')[0]).toMatchObject({ n: 2, reason: 'REFUSED', attempts: 3 });
        expect(room.journal('illustration.refused').filter(entry => entry.n === 2)).toHaveLength(3);
        expect(runtime.snapshot().illustration).toEqual({ drawing: 0, failed: 'REFUSED' });
        await until(() => runtime.status === 'ended');
        expect(room.journal('illustrated').map(entry => entry.n)).toEqual([1]);
        expect(longestGap(runtime.journal())).toBeLessThan(BREATH_MS * 4);
    });

    it('a reading that ends before the picture is drawn lets it go, and closes the request', async () => {
        const room = await open('@say One short answer.\n@illustrate a labelled diagram of water\n@say That is all.\n', { illustrate: () => ({ text: fenced(FIGURE), ms: 120_000 }) });
        expect(runtime.snapshot().illustration.drawing).toBe(1);
        await until(() => runtime.status === 'ended');
        expect(room.journal('illustration.dropped')).toEqual([expect.objectContaining({ n: 1, reason: 'ended' })]);
        expect(room.closed).toContain('illustrate');
        expect(runtime.snapshot().illustration.drawing).toBe(0);
        expect(room.journal('illustrated')).toEqual([]);
    });

    it('a picture admitted while the reading is on its last phrase, with nothing more to come, is let go', async () => {
        const room = await open('@say One.\n@illustrate a labelled diagram of water\n@say A last and much longer phrase, which the picture arrives during, with nothing after it.\n', { illustrate: () => ({ text: fenced(FIGURE), ms: 600 }) });
        await until(() => runtime.status === 'ended');
        expect(room.journal('illustration.admitted')).toHaveLength(1);
        expect(room.journal('illustration.dropped')).toEqual([expect.objectContaining({ n: 1, reason: 'ended' })]);
    });

    it('a picture asked for in an answer to the reader carries their words, and lands in the reading', async () => {
        const room = await open(WATER.replace('@illustrate medium=cue brighter attractor\n', '').replace('@illustrate a labelled diagram of the three states of water\n', ''), {
            answer: '@say Here is that as a diagram.\n@illustrate a labelled diagram of the three states of water\n@say Ice, water and steam, side by side, with heat moving between them.\n@then resume\n',
            illustrate: () => ({ text: fenced(FIGURE), ms: 400 })
        });
        await until(() => room.atoms.length >= 2);
        runtime.beginInterjection();
        await runtime.interject('Show me that as a diagram.');
        await until(() => room.journal('illustrated').length > 0);
        const asked = room.requests.find(request => request.intent === 'illustrate');
        expect(asked.illustration.asked).toBe('Show me that as a diagram.');
        expect(room.journal('illustrated')[0]).toMatchObject({ n: 1, medium: 'figure' });
        expect(room.cues.some(item => item.cue?.sceneId === 'picture-1')).toBe(true);
        await until(() => runtime.status === 'ended');
    });
});
