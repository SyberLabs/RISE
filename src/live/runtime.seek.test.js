/**
 * Playback as an instrument: the reader moves the reading, and the voice moves first.
 *
 * The voice is the clock (docs/plans/LIVE-CURRENT.md §4). A seek re-anchors the voice at the start of a passage and
 * the words follow it there; a replay is a seek to the passage on screen; the pace is the voice's rate, and the
 * Player's timers follow it for what no voice says. The whole runtime (the field's 17-beat Current through the MCP
 * adapter, the Player, the speech governor, the beat conductor and the synthetic voice) on one time source:
 * vitest's fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { currentToEvents } from './adapters/current-events.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { SKY_PREMIUM_EDUCATIONAL as SKY } from './fixtures/sky-premium-educational.js';

const MS_PER_CHAR = 20;
const SCENE_MANIFEST = { surface: 'scene', parameters: { cue: { type: 'name', cueable: true } } };
const SPOKEN = SKY.beats.flatMap((beat, index) => (beat.say ? [`beat-${index}`] : []));

const tick = ms => vi.advanceTimersByTimeAsync(ms);
const now = () => performance.now();
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
 * Open the field's Current; what the voice said, what the words showed and what the scene was cued, each with when.
 * `lost`: passages the voice takes and never says, once for each time one is named, the first times it is given them. `msPerChar`: how slowly the voice speaks.
 * `connectingPace`: a pace the reader sets while the reading is still being opened.
 */
async function open({ lost = [], msPerChar = MS_PER_CHAR, connectingPace = null } = {}) {
    const losing = [...lost];
    const clock = createRealClock();
    const adapter = createMcpAppAdapter({
        port: { onCurrent: () => () => {}, canSample: () => false }, clock, host: 'https://host.example',
        admittedEvents: currentToEvents(SKY), admittedCurrent: SKY
    });
    const said = [];
    const shown = [];
    const cued = [];
    let player = null;
    let completedAt = null;
    let voiceCallbacks = null;
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => {
            player = new Player(session);
            player.on('atom', ({ index, atom, concealed }) => { if (!concealed) shown.push({ at: now(), index, sourceId: atom.seam ? null : atom.sourceId }); });
            player.on('complete', () => { completedAt = now(); });
            return player;
        },
        voices: {
            create: () => {
                const voice = createSyntheticVoice({ clock, msPerChar, breathMs: 50 });
                const attach = voice.attach.bind(voice);
                voice.attach = callbacks => attach(voiceCallbacks = {
                    ...callbacks,
                    start: id => { said.push({ at: now(), kind: 'start', id }); callbacks.start(id); },
                    mark: (id, charIndex, tMs) => { said.push({ at: now(), kind: 'mark', id, charIndex }); callbacks.mark(id, charIndex, tMs); },
                    end: (id, durationMs) => { said.push({ at: now(), kind: 'end', id, durationMs }); callbacks.end(id, durationMs); }
                });
                const enqueue = voice.enqueue.bind(voice);
                voice.enqueue = item => {
                    const at = losing.indexOf(item.id);
                    if (at < 0) return enqueue(item);
                    losing.splice(at, 1);
                    return undefined;
                };
                return voice;
            }
        },
        host: {
            present: async () => {}, dismiss: () => {},
            discoverVisual: () => ({ manifest: SCENE_MANIFEST }),
            controlVisual: ({ command, instant }) => {
                cued.push({ at: now(), cue: command.value, instant: instant === true });
                return { status: 'accepted', effective: command.value };
            }
        }
    });
    const starting = runtime.start('Why is the sky blue?');
    if (connectingPace !== null) runtime.setPace(connectingPace);
    await starting;
    await tick(50);
    return {
        said, shown, cued,
        player: () => player,
        completedAt: () => completedAt,
        failVoice: id => voiceCallbacks.fail(id, 'network'),
        journal: type => runtime.journal().filter(entry => entry.type === type)
    };
}

/** Play until the reading has ended, at most `limitMs`. */
async function playOut(limitMs = 120_000) {
    for (let waited = 0; waited < limitMs && runtime.status !== 'ended'; waited += 500) await tick(500);
}

const after = (list, at) => list.filter(entry => entry.at >= at);
const index = id => Number(id.slice('beat-'.length));

/**
 * The voice and the words end together: the voice is never still speaking a second after the words have all been
 * shown, and the words outlast the voice only by the closing line no voice says (its seam and its hold, at the pace).
 */
function expectTogether(run) {
    const voiceEnded = run.journal('speech.end').at(-1).at;
    const player = run.player();
    const closing = player.sessionState.session.atoms.slice(-2).reduce((sum, atom) => sum + atom.duration, 0) * player.speedFactor;
    expect(voiceEnded - run.completedAt()).toBeLessThan(1_000);
    expect(run.completedAt() - voiceEnded).toBeLessThan(closing + 500);
}

describe('where the reader is', () => {
    it('is a passage of the reading, counted among all of them, and whether a voice says it', async () => {
        const run = await open();
        expect(runtime.position()).toEqual({
            segmentId: 'beat-0', segmentIndex: 0, segmentCount: SKY.beats.length,
            atomIndex: 0, atomCount: run.player().sessionState.session.atoms.length, spoken: true
        });
        // The first passage said, the reading reaches the hold after it.
        for (let waited = 0; waited < 20_000 && runtime.position().segmentId !== 'beat-1'; waited += 50) await tick(50);
        expect(runtime.position()).toMatchObject({ segmentId: 'beat-1', segmentIndex: 1, spoken: false });
        expect(runtime.snapshot().position).toEqual(runtime.position());
        expect(runtime.snapshot().pace).toBe(1);
    });

    it('lists every passage in order, each with whether a voice says it, for a stage that draws them', async () => {
        await open();
        expect(runtime.passages()).toEqual(SKY.beats.map((beat, index) => ({ segmentId: `beat-${index}`, spoken: beat.say !== undefined, text: beat.say ?? beat.show ?? '' })));
    });
});

describe('a seek', () => {
    it('forward: the voice says the passage sought from its start and nothing before it, and the words follow it there', async () => {
        const run = await open();
        await tick(1_000);
        const at = now();
        runtime.seek({ segmentId: 'beat-9' });
        expect(run.journal('seek')).toEqual([expect.objectContaining({ from: 'beat-0', to: 'beat-9', reason: 'reader' })]);
        expect(runtime.position()).toMatchObject({ segmentId: 'beat-9', segmentIndex: 9 });
        await tick(3_000);
        const spoken = after(run.said, at);
        expect(spoken[0]).toMatchObject({ kind: 'start', id: 'beat-9' });
        expect(spoken.find(entry => entry.kind === 'mark').charIndex).toBeLessThan(30);
        expect(spoken.filter(entry => index(entry.id) < 9)).toEqual([]);
        // The words show nothing from the holds and passages skipped, and the passage's first atom once the voice begins it.
        const words = after(run.shown, at).filter(entry => entry.sourceId);
        expect(words.filter(entry => index(entry.sourceId) < 9)).toEqual([]);
        expect(words[0].sourceId).toBe('beat-9');
        expect(words[0].at).toBeGreaterThanOrEqual(spoken[0].at);
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        expect(run.journal('run.finished')).toHaveLength(1);
        expect(after(run.said, at).filter(entry => entry.kind === 'end').map(entry => entry.id))
            .toEqual(SPOKEN.filter(id => index(id) >= 9));
    });

    it('lands the cues of the scene’s earlier beats at once, and the passage’s own as it begins', async () => {
        const run = await open();
        await tick(1_000);
        const at = now();
        runtime.seek({ segmentId: 'beat-9' });
        await tick(3_000);
        expect(after(run.cued, at).map(({ cue, instant }) => [cue, instant])).toEqual([['strip', true], ['curve', true], ['pair', false]]);
    });

    it('back: the voice says the passage again from its start, and the reading still ends when the voice has', async () => {
        const run = await open();
        for (let waited = 0; waited < 60_000 && runtime.position().segmentIndex < 9; waited += 250) await tick(250);
        const at = now();
        runtime.seek({ segmentId: 'beat-2' });
        await tick(3_000);
        const spoken = after(run.said, at);
        expect(spoken[0]).toMatchObject({ kind: 'start', id: 'beat-2' });
        const words = after(run.shown, at).filter(entry => entry.sourceId);
        expect(words[0].sourceId).toBe('beat-2');
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        expect(after(run.said, at).filter(entry => entry.kind === 'end').map(entry => entry.id))
            .toEqual(SPOKEN.filter(id => index(id) >= 2));
        expectTogether(run);
    });

    it('by a step: one passage on, or back, from where the reader is', async () => {
        await open();
        runtime.seek({ delta: 1 });
        expect(runtime.position().segmentId).toBe('beat-1');
        runtime.seek({ delta: 1 });
        runtime.seek({ delta: 1 });
        expect(runtime.position().segmentId).toBe('beat-3');
        runtime.seek({ delta: -1 });
        expect(runtime.position().segmentId).toBe('beat-2');
        runtime.seek({ delta: -5 });
        expect(runtime.position().segmentId).toBe('beat-0');
    });

    it('from the end: the reading is live again from the passage sought, and ends again', async () => {
        const run = await open();
        await playOut();
        expect(runtime.status).toBe('ended');
        const at = now();
        runtime.seek({ segmentId: 'beat-13' });
        expect(runtime.status).toBe('live');
        await tick(2_000);
        expect(after(run.said, at)[0]).toMatchObject({ kind: 'start', id: 'beat-13' });
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('run.finished')).toHaveLength(2);
        expect(after(run.said, at).filter(entry => entry.kind === 'end').map(entry => entry.id)).toEqual(['beat-13', 'beat-14', 'beat-15']);
    });

    it('while held: it stays held on the passage sought, its first words shown and nothing said, and Play takes up there', async () => {
        const run = await open();
        await tick(1_000);
        await runtime.interrupt();
        const at = now();
        runtime.seek({ segmentId: 'beat-4' });
        expect(runtime.status).toBe('interrupted');
        expect(run.player().sessionState.state).toBe('paused');
        const first = run.player().sessionState.session.atoms.findIndex(atom => atom.sourceId === 'beat-4' && !atom.seam);
        expect(after(run.shown, at)).toEqual([expect.objectContaining({ index: first, sourceId: 'beat-4' })]);
        expect(runtime.position()).toMatchObject({ segmentId: 'beat-4', atomIndex: first });
        await tick(5_000);
        expect(after(run.said, at)).toEqual([]);
        expect(after(run.shown, at)).toHaveLength(1);
        const played = now();
        runtime.resume();
        await tick(3_000);
        expect(after(run.said, played)[0]).toMatchObject({ kind: 'start', id: 'beat-4' });
        // Taken up where it is, not shown again: the next words follow the voice.
        expect(after(run.shown, played).every(entry => entry.index > first)).toBe(true);
        await playOut();
        expect(run.journal('voice.degraded')).toEqual([]);
        expectTogether(run);
    });

    it('never gives up on the voice across ten seeks anywhere, and the reading still ends with it', async () => {
        const run = await open();
        let seed = 7;
        const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        for (let i = 0; i < 10; i += 1) {
            await tick(200 + Math.floor(random() * 3_000));
            if (runtime.status === 'ended') break;
            runtime.seek({ segmentId: `beat-${Math.floor(random() * SKY.beats.length)}` });
        }
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('seek').length).toBeGreaterThan(5);
        expect(run.journal('voice.degraded')).toEqual([]);
        expectTogether(run);
    });

    it('takes the voice back as the clock after it was given up on: a seek is the reader’s act, not the voice failing', async () => {
        const run = await open({ lost: ['beat-0'] });
        await tick(6_000);
        expect(run.journal('voice.degraded')).toHaveLength(1);
        expect(runtime.snapshot().main.voiceDegraded).toBe(true);
        const at = now();
        runtime.seek({ segmentId: 'beat-2' });
        expect(run.journal('voice.recovered')).toHaveLength(1);
        expect(runtime.snapshot().main.voiceDegraded).toBe(false);
        await tick(3_000);
        expect(after(run.said, at)[0]).toMatchObject({ kind: 'start', id: 'beat-2' });
        expect(after(run.shown, at).find(entry => entry.sourceId).at).toBeGreaterThanOrEqual(after(run.said, at)[0].at);
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toHaveLength(1);
        expectTogether(run);
    });

    it('refuses a passage that is not in the reading, and a reading that is not there', async () => {
        await open();
        expect(() => runtime.seek({ segmentId: 'beat-99' })).toThrow(/passage/u);
        expect(() => runtime.seek({})).toThrow(/passage/u);
        await runtime.stop();
        expect(() => runtime.seek({ segmentId: 'beat-0' })).toThrow(/nothing/u);
    });
});

describe('a replay', () => {
    it('says the passage on screen again from its start, and shows it again with it', async () => {
        const run = await open();
        for (let waited = 0; waited < 60_000 && runtime.position().segmentId !== 'beat-4'; waited += 100) await tick(100);
        await tick(500);
        const at = now();
        runtime.replay();
        expect(run.journal('replay')).toEqual([expect.objectContaining({ from: 'beat-4', to: 'beat-4', reason: 'reader' })]);
        await tick(2_000);
        expect(after(run.said, at)[0]).toMatchObject({ kind: 'start', id: 'beat-4' });
        expect(after(run.shown, at).find(entry => entry.sourceId).sourceId).toBe('beat-4');
    });
});

describe('the pace', () => {
    it('is the voice’s rate: the words keep with it, and where the reader is does not move', async () => {
        const run = await open();
        await tick(1_000);
        const before = runtime.position();
        runtime.setPace(2);
        expect(runtime.position()).toEqual(before);
        expect(runtime.snapshot().pace).toBe(2);
        expect(run.journal('pace')).toEqual([expect.objectContaining({ rate: 2, applied: false })]);
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        // A passage said after the change takes half its time.
        const ended = run.said.find(entry => entry.kind === 'end' && entry.id === 'beat-13');
        expect(ended.durationMs).toBeCloseTo(SKY.beats[13].say.length * MS_PER_CHAR / 2, 0);
        expectTogether(run);
    });

    it('slowed in the middle of a passage, lets the voice finish it at the old rate, the words with it, and lands as it ends', async () => {
        const run = await open();
        await tick(300);
        runtime.setPace(0.5);
        expect(runtime.snapshot().pace).toBe(0.5);
        expect(runtime.snapshot().paceFrom).toBe('passage');
        expect(run.journal('pace')).toEqual([expect.objectContaining({ rate: 0.5, applied: false })]);
        // Nothing is re-timed yet: the voice is still saying this passage at the old rate.
        expect(run.player().speedFactor).toBe(1);
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        const ended = id => run.said.find(entry => entry.kind === 'end' && entry.id === id);
        expect(ended('beat-0').durationMs).toBeCloseTo(SKY.beats[0].say.length * MS_PER_CHAR, 0);
        // The words keep with the voice at the old rate: the passage is not left before the voice has said it, nor long after.
        const left = run.shown.find(entry => entry.index > 0 && entry.sourceId !== 'beat-0');
        expect(left.at).toBeGreaterThanOrEqual(ended('beat-0').at - 250);
        expect(left.at).toBeLessThan(ended('beat-0').at + 500);
        // The pace lands as the voice finishes the passage it was saying; the next passage said is said at it.
        expect(run.journal('pace.applied')).toEqual([expect.objectContaining({ at: ended('beat-0').at, rate: 0.5, segmentId: 'beat-0' })]);
        const next = SPOKEN[1];
        expect(ended(next).durationMs).toBeCloseTo(SKY.beats[index(next)].say.length * MS_PER_CHAR * 2, 0);
        expect(runtime.snapshot().paceFrom).toBeNull();
        expect(run.player().speedFactor).toBe(2);
        expectTogether(run);
    });

    it('set during a passage the voice then fails, lands when the voice is given up on', async () => {
        const run = await open();
        await tick(300);
        runtime.setPace(0.5);
        expect(runtime.snapshot().paceFrom).toBe('passage');
        run.failVoice('beat-0');
        expect(runtime.snapshot().paceFrom).toBeNull();
        expect(run.player().speedFactor).toBe(2);
    });

    it('set while the reading is paused, lands when it plays again', async () => {
        const run = await open();
        await tick(1_000);
        await runtime.interrupt();
        runtime.setPace(2);
        expect(run.journal('pace')).toEqual([expect.objectContaining({ rate: 2, applied: false })]);
        await tick(2_000);
        expect(run.journal('pace.applied')).toEqual([]);
        runtime.resume();
        await tick(500);
        expect(run.journal('pace.applied')).toEqual([expect.objectContaining({ rate: 2, segmentId: 'beat-0' })]);
        expect(runtime.snapshot().paceFrom).toBeNull();
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        expectTogether(run);
    });

    it('lets what no voice says follow it: a hold after the passage the pace was set in lasts half as long at twice the pace', async () => {
        const run = await open();
        runtime.setPace(2);
        for (let waited = 0; waited < 20_000 && runtime.position().segmentId !== 'beat-2'; waited += 10) await tick(10);
        const hold = run.shown.find(entry => entry.sourceId === 'beat-1');
        const next = run.shown.find(entry => entry.index === hold.index + 1);
        expect(next.at - hold.at).toBeLessThan(SKY.beats[1].hold.ms * 0.6);
    });

    it('slowed fourfold in the middle of a long phrase, waits for the voice: the next words come only when it reaches them', async () => {
        // A slow voice, so the phrase's rest at the new pace outlasts the watchdog the Player armed at the old one.
        const run = await open({ msPerChar: 80 });
        runtime.setPace(2);
        const atoms = run.player().sessionState.session.atoms;
        const first = atoms.findIndex(atom => atom.sourceId === 'beat-4' && !atom.seam);
        for (let waited = 0; waited < 60_000 && !run.shown.some(entry => entry.index === first); waited += 20) await tick(20);
        await tick(200);
        runtime.setPace(0.5);
        const next = atoms.findIndex(atom => atom.sourceId === 'beat-5' && !atom.seam);
        for (let waited = 0; waited < 60_000 && !run.shown.some(entry => entry.index === next); waited += 50) await tick(50);
        expect(run.journal('voice.degraded')).toEqual([]);
        // The passage's second phrase is shown once the voice is past the first (when its own marks place the
        // first's last character), not when a watchdog armed at the old pace gave up on it.
        const end = atoms[first].content.length;
        const marks = run.said.filter(entry => entry.kind === 'mark' && entry.id === 'beat-4');
        const before = marks.findLast(entry => entry.charIndex <= end);
        const beyond = marks.find(entry => entry.charIndex > end);
        const voicePast = before.at + ((end - before.charIndex) / (beyond.charIndex - before.charIndex)) * (beyond.at - before.at);
        expect(run.shown.find(entry => entry.index === first + 1).at).toBeGreaterThanOrEqual(voicePast - 50);
        // And the next passage's words only once the voice begins it.
        const begun = run.said.find(entry => entry.kind === 'start' && entry.id === 'beat-5');
        // Less a millisecond: the synthetic voice has begun an utterance one timer tick before it reports the start.
        expect(run.shown.find(entry => entry.index === next).at).toBeGreaterThanOrEqual(begun.at - 1);
    });

    it('sped up during a hold, shortens the hold already running', async () => {
        const run = await open();
        const atoms = run.player().sessionState.session.atoms;
        const hold = atoms.findIndex(atom => atom.sourceId === 'beat-8');
        for (let waited = 0; waited < 60_000 && !run.shown.some(entry => entry.index === hold); waited += 10) await tick(10);
        const began = run.shown.find(entry => entry.index === hold).at;
        await tick(500);
        runtime.setPace(2);
        // The voice says nothing during a hold, so there is nothing to wait for: the pace lands at once.
        expect(run.journal('pace')).toEqual([expect.objectContaining({ rate: 2, applied: true })]);
        expect(runtime.snapshot().paceFrom).toBeNull();
        for (let waited = 0; waited < 10_000 && !run.shown.some(entry => entry.index === hold + 1); waited += 10) await tick(10);
        // 500 ms of its 2000 at 1x, the other 1500 at 2x: 1250 ms in all.
        const lasted = run.shown.find(entry => entry.index === hold + 1).at - began;
        expect(lasted).toBeGreaterThanOrEqual(1_200);
        expect(lasted).toBeLessThan(1_350);
    });

    it('set while the reading is still being opened, is the pace of all of it', async () => {
        const run = await open({ connectingPace: 2 });
        expect(run.journal('pace')).toEqual([expect.objectContaining({ rate: 2, applied: true })]);
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toEqual([]);
        expect(run.journal('pace.applied')).toEqual([]);
        const ended = run.said.find(entry => entry.kind === 'end' && entry.id === 'beat-0');
        expect(ended.durationMs).toBeCloseTo(SKY.beats[0].say.length * MS_PER_CHAR / 2, 0);
        expectTogether(run);
    });

    it('is between half and twice the voice’s own', async () => {
        await open();
        expect(() => runtime.setPace(0.4)).toThrow(/pace/u);
        expect(() => runtime.setPace(2.5)).toThrow(/pace/u);
        expect(() => runtime.setPace(Number.NaN)).toThrow(/pace/u);
    });
});

describe('Play after the voice was given up on', () => {
    /** Open with the first passage lost `times` times, and play until the reading has stood down from its voice; then pause. */
    async function givenUp(times = 1) {
        const run = await open({ lost: Array(times).fill('beat-0') });
        for (let waited = 0; waited < 10_000 && !runtime.snapshot().main.voiceDegraded; waited += 50) await tick(50);
        expect(run.journal('voice.degraded').map(entry => entry.reason)).toEqual(['voice-did-not-start']);
        await runtime.interrupt();
        return run;
    }

    it('re-arms the voice: it says the passage on screen from its start, and is the clock again', async () => {
        const run = await givenUp();
        const on = runtime.position().segmentId;
        const at = now();
        runtime.resume();
        expect(run.journal('voice.rearmed')).toEqual([expect.objectContaining({ role: 'main', reason: 'play' })]);
        expect(runtime.snapshot().main.voiceDegraded).toBe(false);
        await tick(3_000);
        expect(after(run.said, at)[0]).toMatchObject({ kind: 'start', id: on });
        const first = run.player().sessionState.session.atoms.findIndex(atom => atom.sourceId === on && !atom.seam);
        expect(after(run.shown, at)[0]).toMatchObject({ index: first, sourceId: on });
        await playOut();
        expect(runtime.status).toBe('ended');
        expect(run.journal('voice.degraded')).toHaveLength(1);
        expectTogether(run);
    });

    it('stands down again, as before, when the voice does not start this time either', async () => {
        const run = await givenUp(2);
        expect(runtime.position().segmentId).toBe('beat-0');
        runtime.resume();
        expect(run.journal('voice.rearmed')).toHaveLength(1);
        await tick(4_500);
        expect(run.journal('voice.degraded').map(entry => entry.reason)).toEqual(['voice-did-not-start', 'voice-did-not-start']);
        expect(runtime.snapshot().main.voiceDegraded).toBe(true);
        await playOut();
        expect(runtime.status).toBe('ended');
    });

    it('re-arms nothing when the voice was never given up on', async () => {
        const run = await open();
        await tick(1_000);
        await runtime.interrupt();
        runtime.resume();
        expect(run.journal('voice.rearmed')).toEqual([]);
    });
});
