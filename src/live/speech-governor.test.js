/**
 * The voice as the reading's clock, against the real Player.
 *
 * One time source runs all of it: vitest's fake timers drive the Player, the
 * voice and the governor alike, so "when" has a single answer. The recorded
 * budgets (docs/plans/LIVE-CURRENT.md §11) are asserted here: a segment's first
 * atom appears when the voice starts that segment, and an atom inside a
 * segment is never more than 250 ms from where the voice actually was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent } from '../core/rise-current.js';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { BLACK_HOLES } from './fixtures/black-holes.js';
import { mapAtoms } from './atom-map.js';
import { createSpeechGovernor, GOVERNOR_LIMITS } from './speech-governor.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { createBrowserVoice } from './voices/browser.js';
import { createFakeSpeech } from '../test/fake-speech.js';

const MS_PER_CHAR = 40;
const IN_SEGMENT_BUDGET_MS = 250;
const SEGMENT_BOUNDARY_BUDGET_MS = 100;

const clock = createRealClock();
const now = () => performance.now();
const tick = ms => vi.advanceTimersByTimeAsync(ms);

let player;
let voice;
let governor;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    // Reading in these tests never rolls a flash: the clock, not chance, is under test.
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(() => {
    governor?.dispose();
    voice?.close();
    player?.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

function setup({ count = 3, speak = true, voiceOptions = {} } = {}) {
    const segments = BLACK_HOLES.segments.slice(0, count).map(({ id, text }) => ({ id, text }));
    const session = compileRiseCurrent({
        schema: 'rise.current.v1', id: 'gov-1', title: 'Gov', origin: { kind: 'human', name: 'Tester' }, segments
    });
    player = new Player(session);
    const shown = [];
    player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: now() }); });

    const voiceLog = {};
    voice = createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 150, ...voiceOptions });
    const degraded = [];
    governor = createSpeechGovernor({ voice, clock, onDegrade: info => degraded.push(info) });
    voice.attach({
        start: id => { voiceLog[id] = { startedAt: now() }; },
        mark: (id, charIndex, tMs) => governor.observe('mark', id, charIndex, tMs),
        end: (id, durationMs) => { voiceLog[id].endedAt = now(); governor.observe('end', id, durationMs); }
    });
    governor.update({ atoms: session.atoms, segments });
    governor.install(player);
    if (speak) for (const segment of segments) voice.enqueue({ id: segment.id, text: segment.text });
    return { segments, session, shown, voiceLog, degraded, map: mapAtoms(session.atoms, segments) };
}

const totalMs = segments => segments.reduce((sum, s) => sum + s.text.length * MS_PER_CHAR + 150, 0);

describe('when the voice is the clock', () => {
    it('shows each segment’s first atom when the voice starts that segment', async () => {
        const { segments, shown, voiceLog, map } = setup();
        player.play();
        await tick(totalMs(segments) + 3_000);
        for (const segment of segments) {
            const first = map.find(e => !e.seam && e.segmentId === segment.id);
            const atom = shown.find(s => s.index === first.index);
            expect(atom, `first atom of ${segment.id}`).toBeDefined();
            expect(Math.abs(atom.at - voiceLog[segment.id].startedAt)).toBeLessThanOrEqual(SEGMENT_BOUNDARY_BUDGET_MS);
        }
    });

    it('keeps every atom inside a segment within the budget of where the voice was', async () => {
        const { segments, shown, voiceLog, map } = setup();
        player.play();
        await tick(totalMs(segments) + 3_000);
        let compared = 0;
        for (const entry of map.filter(e => !e.seam && e.start > 0)) {
            const atom = shown.find(s => s.index === entry.index);
            const said = voiceLog[entry.segmentId].startedAt + entry.start * MS_PER_CHAR;
            expect(Math.abs(atom.at - said), `atom ${entry.index}`).toBeLessThanOrEqual(IN_SEGMENT_BUDGET_MS);
            compared += 1;
        }
        expect(compared).toBeGreaterThan(2);
    });

    it('shows every atom exactly once, in order, and completes when the last segment ends', async () => {
        const { segments, session, shown, voiceLog } = setup();
        const done = [];
        player.on('complete', () => done.push(now()));
        player.play();
        await tick(totalMs(segments) + 3_000);
        expect(shown.map(s => s.index)).toEqual(session.atoms.map((_, i) => i));
        expect(done).toHaveLength(1);
        const lastEnd = voiceLog[segments.at(-1).id].endedAt;
        expect(Math.abs(done[0] - lastEnd)).toBeLessThanOrEqual(SEGMENT_BOUNDARY_BUDGET_MS);
    });

    it('is not ahead of a slow voice: the reading takes as long as the voice does', async () => {
        const slow = setup({ voiceOptions: { msPerChar: 90 } });
        const done = [];
        player.on('complete', () => done.push(now()));
        player.play();
        const voiceTotal = slow.segments.reduce((sum, s) => sum + s.text.length * 90 + 150, 0);
        await tick(voiceTotal + 3_000);
        expect(done).toHaveLength(1);
        expect(done[0]).toBeGreaterThanOrEqual(slow.segments.reduce((sum, s) => sum + s.text.length * 90, 0));
    });

    it('does not put the reader ahead of the voice for longer than one atom after a pause', async () => {
        const { segments, session, shown, voiceLog, map } = setup();
        player.play();
        await tick(1_500);
        player.pause();
        voice.hold();
        await tick(10_000);
        const heldAt = shown.length;
        voice.release();
        player.play();
        await tick(totalMs(segments) + 3_000);
        expect(shown.length).toBeGreaterThanOrEqual(heldAt);
        expect(shown.map(s => s.index)).toEqual(session.atoms.map((_, i) => i));
        // Once the voice moves on to a later segment the reading is with it again.
        const last = map.filter(e => !e.seam && e.segmentId === segments.at(-1).id)[0];
        const atom = shown.find(s => s.index === last.index);
        expect(Math.abs(atom.at - voiceLog[segments.at(-1).id].startedAt)).toBeLessThanOrEqual(SEGMENT_BOUNDARY_BUDGET_MS);
    });
});

/**
 * The browser voice on a fake device, held and released as the runtime does it (runtime.js holdVoice): a held
 * voice is cancelled and says its passage again, from the phrase on screen when it can, else from the last place
 * it heard, which can be well before the words on screen.
 */
function setupHeld({ texts, msPerChar = 60, latencyMs = 30, latencyAfterCancelMs = null } = {}) {
    const segments = texts.map((text, i) => ({ id: `p${i + 1}`, text }));
    const session = compileRiseCurrent({
        schema: 'rise.current.v1', id: 'held-1', title: 'Held', origin: { kind: 'human', name: 'Tester' }, segments
    });
    player = new Player(session);
    const shown = [];
    player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: now() }); });
    const synth = createFakeSpeech(clock, { msPerChar, latencyMs, latencyAfterCancelMs, boundaries: false });
    voice = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock });
    const degraded = [];
    governor = createSpeechGovernor({ voice, clock, onDegrade: info => degraded.push(info) });
    const voiceLog = {};
    voice.attach({
        start: id => { voiceLog[id] = { startedAt: now() }; },
        mark: (id, charIndex, tMs) => governor.observe('mark', id, charIndex, tMs),
        end: (id, durationMs) => { voiceLog[id].endedAt = now(); governor.observe('end', id, durationMs); }
    });
    governor.update({ atoms: session.atoms, segments });
    governor.install(player);
    for (const segment of segments) voice.enqueue(segment);
    const hold = () => {
        player.pause();
        const phrase = player.betweenPhrases ? null : governor.restartPoint(player.sessionState.currentIndex);
        if (voice.hold(phrase ? { resumeAt: phrase } : undefined) === true) player.restartCurrentAtom();
    };
    const release = () => { voice.release(); player.play(); };
    return { segments, shown, voiceLog, degraded, hold, release, map: mapAtoms(session.atoms, segments) };
}

const FIRST = 'The first passage is a single sentence that takes a while.';

describe('when the voice is held and says its passage again from further back', () => {
    it('does not stand down while the voice is still saying the passage before: the next one waits for it', async () => {
        const held = setupHeld({ texts: [FIRST, 'The second passage follows.', 'A third one ends it.'] });
        player.play();
        // Late in the first passage, before the voice has said a whole one: its speed is unknown, so it is said
        // again from its start while the words on screen carry on from where they were.
        await tick(3_000);
        held.hold();
        await tick(2_000);
        held.release();
        await tick(20_000);
        expect(held.degraded).toEqual([]);
        const second = held.map.find(entry => !entry.seam && entry.segmentId === 'p2');
        const atom = held.shown.find(entry => entry.index === second.index);
        expect(Math.abs(atom.at - held.voiceLog.p2.startedAt)).toBeLessThanOrEqual(SEGMENT_BOUNDARY_BUDGET_MS);
    });

    it('still stands down for a voice that began a passage and never ends it, once that passage’s time and the grace are up', async () => {
        const segments = [{ id: 'p1', text: FIRST }, { id: 'p2', text: 'The second passage follows.' }];
        const session = compileRiseCurrent({
            schema: 'rise.current.v1', id: 'stuck-1', title: 'Stuck', origin: { kind: 'human', name: 'Tester' }, segments
        });
        player = new Player(session);
        // Begun 30 ms in, saying p1 for ever: no end, and p2 never begins.
        const stuck = {
            capabilities: { wordMarks: false },
            playedMs: id => (id === 'p1' && now() >= 30 ? now() - 30 : undefined),
            speakingId: () => 'p1'
        };
        const degraded = [];
        governor = createSpeechGovernor({ voice: stuck, clock, onDegrade: info => degraded.push(info) });
        governor.update({ atoms: session.atoms, segments });
        governor.install(player);
        player.play();
        // p1 is 58 characters: 3770 ms at the default speed, then the 1500 ms grace for p2 to begin.
        await tick(30 + 58 * 65 + 1_500 + 300);
        expect(degraded).toEqual([{ reason: 'voice-did-not-start' }]);
    });

    it('gives a voice the first start’s grace after a hold: a network voice can be slow to start again', async () => {
        const msPerChar = 60;
        const latencyMs = 400;
        const held = setupHeld({ texts: [FIRST, 'The second passage follows.'], msPerChar, latencyMs, latencyAfterCancelMs: 3_000 });
        player.play();
        // Held in the moment between the passages: the first is said, the second is asked for and not yet begun.
        await tick(latencyMs + FIRST.length * msPerChar + 200);
        expect(held.voiceLog.p1.endedAt).toBeDefined();
        expect(held.voiceLog.p2).toBeUndefined();
        held.hold();
        await tick(1_000);
        held.release();
        await tick(15_000);
        expect(held.degraded).toEqual([]);
        expect(held.voiceLog.p2.endedAt).toBeDefined();
    });
});

describe('when the voice cannot be the clock', () => {
    it('stands down once, tells the host, and lets the reading carry on by its own timer', async () => {
        const { session, shown, degraded } = setup({ speak: false });
        const done = [];
        player.on('complete', () => done.push(now()));
        player.play();
        // The first utterance has the cold-engine grace, longer than the rest.
        await tick(GOVERNOR_LIMITS.firstGraceMs - 100);
        expect(degraded).toEqual([]);
        await tick(300);
        expect(degraded).toEqual([{ reason: 'voice-did-not-start' }]);
        await tick(60_000);
        expect(shown.map(s => s.index)).toEqual(session.atoms.map((_, i) => i));
        expect(done).toHaveLength(1);
        expect(degraded).toHaveLength(1);
        expect(governor.degraded).toBe(true);
    });

    it('does not make each atom wait for the grace once it has stood down', async () => {
        const { segments, map } = setup({ speak: false });
        const done = [];
        player.on('complete', () => done.push(now()));
        player.play();
        await tick(GOVERNOR_LIMITS.firstGraceMs + 100);
        const at = now();
        await tick(60_000);
        // The rest ran at the pace of speech (nothing was heard, so the governor's default 65 ms a character, and each
        // seam its own time), plus the Player's ~300 ms transition per atom, not with a grace waited out on every atom.
        const atoms = player.sessionState.session.atoms;
        const seams = map.filter(entry => entry.seam).reduce((sum, entry) => sum + atoms[entry.index].duration, 0);
        const spokenPace = segments.reduce((sum, s) => sum + s.text.length * 65, 0) + seams + atoms.length * 300;
        expect(done[0] - at).toBeLessThan(spokenPace);
    });

    it('keeps the words at the pace the voice was measured at once it has stood down, not at the pace of silent reading', async () => {
        const msPerChar = 90;
        const { segments, session, shown, map } = setup({ voiceOptions: { msPerChar } });
        player.play();
        // The first passage is heard whole, so the voice's speed is known; then the voice is given up on.
        await tick(segments[0].text.length * msPerChar + 150 + 100);
        governor.standDown('test');
        await tick(60_000);
        const last = map.filter(entry => !entry.seam && entry.segmentId === segments.at(-1).id);
        let compared = 0;
        for (const [i, entry] of last.slice(0, -1).entries()) {
            const chars = entry.end - entry.start;
            const atom = session.atoms[entry.index];
            // The reading's own duration for the atom is far from the voice's, so the two cannot be confused.
            expect(atom.duration).toBeLessThan(chars * msPerChar * 0.7);
            const at = shown.find(s => s.index === entry.index).at;
            const next = shown.find(s => s.index === last[i + 1].index).at;
            expect(next - at, `atom ${entry.index}`).toBeGreaterThanOrEqual(chars * msPerChar * 0.85);
            expect(next - at, `atom ${entry.index}`).toBeLessThanOrEqual(chars * msPerChar * 1.15 + 50);
            compared += 1;
        }
        expect(compared).toBeGreaterThan(0);
    });

    it('lets go of the Player when disposed', () => {
        setup();
        governor.dispose();
        expect(player._governors).toEqual([]);
    });
});

describe('where a phrase begins', () => {
    const text = index => BLACK_HOLES.segments[index].text;
    const inside = map => map.find(entry => !entry.seam && entry.start > 0);

    it('says the segment, the first character, and the voice time, once the voice’s speed is known', () => {
        const { map } = setup({ count: 1, speak: false });
        const atom = inside(map);
        // Heard: the voice says its marks, which are the speed it is going at.
        governor.observe('mark', BLACK_HOLES.segments[0].id, 10, 10 * 40);
        const point = governor.restartPoint(atom.index);
        expect(point).toMatchObject({ segmentId: BLACK_HOLES.segments[0].id, charIndex: atom.start });
        expect(point.tMs).toBeGreaterThan(0);
    });

    it('says the time exactly once the voice has said the segment', async () => {
        const { map } = setup({ count: 1 });
        const atom = inside(map);
        player.play();
        await tick(20_000);
        expect(governor.restartPoint(atom.index).tMs).toBe(atom.start * MS_PER_CHAR);
    });

    it('says the time at the speed it learned from the segments before, for one it has not heard', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('end', BLACK_HOLES.segments[0].id, text(0).length * 40);
        const atom = map.find(entry => !entry.seam && entry.segmentId === BLACK_HOLES.segments[1].id && entry.start > 0);
        expect(governor.restartPoint(atom.index)).toEqual({ segmentId: atom.segmentId, charIndex: atom.start, tMs: atom.start * 40 });
    });

    it('says nothing while it has no idea how fast the voice goes: a guess is not a place to start a voice from', () => {
        const { map } = setup({ count: 2, speak: false });
        expect(governor.restartPoint(inside(map).index)).toBeNull();
    });

    it('is the segment’s start for its first atom, when the speed is known', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('end', BLACK_HOLES.segments[0].id, text(0).length * 40);
        const first = map.find(entry => !entry.seam && entry.segmentId === BLACK_HOLES.segments[1].id);
        expect(governor.restartPoint(first.index)).toEqual({ segmentId: first.segmentId, charIndex: 0, tMs: 0 });
    });

    it('says nothing for a seam, or once the voice has been given up on', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('end', BLACK_HOLES.segments[0].id, text(0).length * 40);
        const seam = map.find(entry => entry.seam);
        if (seam) expect(governor.restartPoint(seam.index)).toBeNull();
        governor.standDown('test');
        expect(governor.restartPoint(map.find(entry => !entry.seam).index)).toBeNull();
    });
});

describe('learning how fast the voice goes', () => {
    const ends = (map, index) => {
        const last = map.filter(entry => !entry.seam && entry.segmentId === BLACK_HOLES.segments[index].id).at(-1);
        return governor.endsAtMs(last.index);
    };

    it('expects a segment it has not heard to take as long as the segments before it did, per character', () => {
        const { map } = setup({ count: 2, speak: false });
        expect(ends(map, 1)).toBe(BLACK_HOLES.segments[1].text.length * 65);
        governor.observe('end', BLACK_HOLES.segments[0].id, BLACK_HOLES.segments[0].text.length * 40);
        expect(ends(map, 1)).toBe(BLACK_HOLES.segments[1].text.length * 40);
    });

    it('averages over every segment it has heard, by their length, not by how many there were', () => {
        const { map } = setup({ count: 3, speak: false });
        const [a, b] = [BLACK_HOLES.segments[0], BLACK_HOLES.segments[1]];
        governor.observe('end', a.id, a.text.length * 30);
        governor.observe('end', b.id, b.text.length * 50);
        const expected = (a.text.length * 30 + b.text.length * 50) / (a.text.length + b.text.length);
        expect(ends(map, 2)).toBeCloseTo(BLACK_HOLES.segments[2].text.length * expected, 5);
    });

    it('keeps what a segment’s own marks say about it, rather than the average', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('end', BLACK_HOLES.segments[0].id, BLACK_HOLES.segments[0].text.length * 40);
        governor.observe('mark', BLACK_HOLES.segments[1].id, 10, 10 * 90);
        expect(ends(map, 1)).toBe(BLACK_HOLES.segments[1].text.length * 90);
    });
});

describe('a seek: passages said again from the start', () => {
    const [a, b] = [BLACK_HOLES.segments[0], BLACK_HOLES.segments[1]];
    const lastOf = (map, id) => map.filter(entry => !entry.seam && entry.segmentId === id).at(-1);

    it('forgets what it heard of the passage it is told and every one after it, and keeps the speed it learned', () => {
        const { map } = setup({ count: 2, speak: false });
        const firstOfA = map.find(entry => !entry.seam && entry.segmentId === a.id);
        governor.observe('mark', a.id, 10, 10 * 90);
        governor.observe('end', a.id, a.text.length * 40);
        governor.observe('mark', b.id, 10, 10 * 90);
        const heardA = governor.endsAtMs(firstOfA.index);
        governor.forget(b.id);
        // b is expected at the learned speed, not at its own forgotten marks; a keeps everything it said.
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBe(b.text.length * 40);
        expect(governor.endsAtMs(firstOfA.index)).toBe(heardA);
        governor.forget(a.id);
        expect(governor.endsAtMs(firstOfA.index)).toBe(firstOfA.end * 40);
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBe(b.text.length * 40);
    });

    it('times a passage said again afresh: its marks from the start are heard again', () => {
        const { map } = setup({ count: 1, speak: false });
        governor.observe('mark', a.id, 30, 30 * 90);
        governor.forget(a.id);
        governor.observe('mark', a.id, 10, 10 * 50);
        expect(governor.endsAtMs(lastOf(map, a.id).index)).toBe(a.text.length * 50);
    });

    it('comes back from a stand-down, because a seek is a reader’s act: the clock is the voice again, and a phrase has a place to start', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('end', a.id, a.text.length * 40);
        governor.standDown('test');
        const first = map.find(entry => !entry.seam && entry.segmentId === b.id);
        expect(governor.restartPoint(first.index)).toBeNull();
        governor.forget(b.id);
        expect(governor.degraded).toBe(false);
        expect(governor.restartPoint(first.index)).toEqual({ segmentId: b.id, charIndex: 0, tMs: 0 });
    });

    it('drops the wait it was on, for a passage the voice may now never say', async () => {
        const { degraded } = setup({ speak: false });
        player.play();
        await tick(1_000);
        governor.forget(BLACK_HOLES.segments[0].id);
        // Untouched, the wait for the first passage would give up on the voice at the first start's grace.
        await tick(GOVERNOR_LIMITS.firstGraceMs - 1_000 + 100);
        expect(degraded).toEqual([]);
    });
});

describe('a change of pace', () => {
    const [a, b] = [BLACK_HOLES.segments[0], BLACK_HOLES.segments[1]];
    const lastOf = (map, id) => map.filter(entry => !entry.seam && entry.segmentId === id).at(-1);

    it('expects a passage it has not heard at the new pace, whether it knows the voice’s speed or only the default', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.rescale(0.5);
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBe(b.text.length * 65 * 0.5);
        governor.observe('end', a.id, a.text.length * 40);
        governor.rescale(2);
        // 40 ms a character heard at the old pace is 80 at the new.
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBeCloseTo(b.text.length * 80, 5);
    });

    it('takes a passage it is part way through on at the new pace from the last place it heard', () => {
        const { map } = setup({ count: 2, speak: false });
        governor.observe('mark', b.id, 10, 10 * 90);
        governor.rescale(0.5);
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBe(10 * 90 + (b.text.length - 10) * 45);
        // Heard again at the new pace: what is left goes at the pace heard since the change, not the passage's average.
        governor.observe('mark', b.id, 20, 10 * 90 + 10 * 45);
        expect(governor.endsAtMs(lastOf(map, b.id).index)).toBe(10 * 90 + 10 * 45 + (b.text.length - 20) * 45);
    });
});

describe('expected times', () => {
    it('reports where an atom is expected to end, first by estimate and then exactly', async () => {
        const { map } = setup({ count: 1 });
        const last = map.filter(e => !e.seam).at(-1);
        const before = governor.endsAtMs(last.index);
        expect(before).toBeGreaterThan(0);
        player.play();
        await tick(20_000);
        const after = governor.endsAtMs(last.index);
        expect(after).toBe(BLACK_HOLES.segments[0].text.length * MS_PER_CHAR);
    });
});
