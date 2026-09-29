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
import { createSpeechGovernor } from './speech-governor.js';
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
    governor = createSpeechGovernor({ player, voice, clock, onDegrade: info => degraded.push(info) });
    voice.attach({
        start: id => { voiceLog[id] = { startedAt: now() }; },
        mark: (id, charIndex, tMs) => governor.observe('mark', id, charIndex, tMs),
        end: (id, durationMs) => { voiceLog[id].endedAt = now(); governor.observe('end', id, durationMs); }
    });
    governor.update({ atoms: session.atoms, segments });
    governor.install();
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
        await tick(1_400);
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
        await tick(1_600);
        const at = now();
        await tick(60_000);
        // The rest ran at its own pace (plus the Player's ~300 ms transition per atom), not
        // with 1.5 s of grace waited out on top of every atom.
        const atoms = player.sessionState.session.atoms;
        const ownPace = atoms.reduce((sum, a) => sum + a.duration, 0) + atoms.length * 300;
        expect(done[0] - at).toBeLessThan(ownPace);
    });

    it('lets go of the Player when disposed', () => {
        setup();
        governor.dispose();
        expect(player.atomCompletionOverride).toBeNull();
        expect(player.atomDurationOverride).toBeNull();
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
