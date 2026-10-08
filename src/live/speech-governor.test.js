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
        setup({ speak: false });
        const done = [];
        player.on('complete', () => done.push(now()));
        player.play();
        await tick(GOVERNOR_LIMITS.firstGraceMs + 100);
        const at = now();
        await tick(60_000);
        // The rest ran at its own pace (plus the Player's ~300 ms transition per atom), not
        // with a grace waited out on top of every atom.
        const atoms = player.sessionState.session.atoms;
        const ownPace = atoms.reduce((sum, a) => sum + a.duration, 0) + atoms.length * 300;
        expect(done[0] - at).toBeLessThan(ownPace);
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
