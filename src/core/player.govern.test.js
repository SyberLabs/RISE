/**
 * More than one thing may have a claim on how long an atom lasts.
 *
 * `atomDurationOverride` and `atomCompletionOverride` are single slots, and a
 * view assigns them for its own reasons (the Chamber, for Recitation). A
 * second consumer, such as the live speech clock, must not replace the first,
 * so it asks to `govern` instead. The rules: the slots are asked first, a
 * governor only when they decline, the first governor to answer wins, and
 * releasing one leaves the others.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent } from './rise-current.js';
import { Player } from './player.js';

const session = () => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'govern-1',
    title: 'Govern',
    origin: { kind: 'human', name: 'Tester' },
    segments: [{ id: 's1', text: 'One thought here. And another one follows it. And a third.' }]
});

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let player;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(() => {
    player?.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('leaving a Player that has been destroyed', () => {
    it('lets a listener unsubscribe after the Player cleared them, without throwing', () => {
        player = new Player(session());
        const off = player.on('atom', () => {});
        player.destroy();
        expect(() => off()).not.toThrow();
    });
});

describe('governing the duration of an atom', () => {
    it('asks a governor only when the slot declines, and uses the first answer', () => {
        player = new Player(session());
        const atom = player.sessionState.currentAtom;
        expect(player._atomDisplayMs(atom)).toBeGreaterThan(50);

        const asked = [];
        player.govern({ duration: () => { asked.push('a'); return null; } });
        player.govern({ duration: () => { asked.push('b'); return 4321; } });
        player.govern({ duration: () => { asked.push('c'); return 9999; } });
        expect(player._atomDisplayMs(atom)).toBe(4321);
        expect(asked).toEqual(['a', 'b']);

        player.atomDurationOverride = () => 777;
        asked.length = 0;
        expect(player._atomDisplayMs(atom)).toBe(777);
        expect(asked).toEqual([]);
    });

    it('lets one governor go without disturbing another', () => {
        player = new Player(session());
        const atom = player.sessionState.currentAtom;
        const releaseFirst = player.govern({ duration: () => 1111 });
        player.govern({ duration: () => 2222 });
        expect(player._atomDisplayMs(atom)).toBe(1111);
        releaseFirst();
        releaseFirst();
        expect(player._atomDisplayMs(atom)).toBe(2222);
    });
});

describe('governing the end of an atom', () => {
    it('ends an atom when a governor says so, and only then', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
        let finish = null;
        player.govern({ completion: (_atom, index) => (index === 0 ? new Promise(resolve => { finish = () => resolve({ reason: 'ended' }); }) : null) });
        player.play();
        // Well inside the atom’s own length plus the watchdog’s margin, which would degrade it to the timer.
        await tick(1_000);
        expect(shown).toEqual([0]);
        finish();
        await tick(400);
        expect(shown.length).toBeGreaterThan(1);
    });

    it('is not asked at all when the slot already governs the atom', async () => {
        player = new Player(session());
        const slot = new Promise(() => {});
        player.atomCompletionOverride = (_atom, index) => (index === 0 ? slot : null);
        const asked = [];
        player.govern({ completion: (_atom, index) => { asked.push(index); return null; } });
        player.play();
        await tick(100);
        expect(asked).toEqual([]);
    });

    it('advances once when a governed end arrives after the watchdog has put the atom on its timer', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: performance.now() }); });
        // Every atom lasts 1000 ms by the governor; the first one's end comes 4000 ms in, after the watchdog
        // (1000 ms + its 2500 ms margin) has given up on it and started the atom's timer again.
        player.govern({
            duration: () => 1000,
            completion: (_atom, index) => new Promise(resolve => { setTimeout(() => resolve({ reason: 'ended' }), index === 0 ? 4000 : 1000); })
        });
        player.play();
        await tick(4000 + 3 * 1000 + 100);
        // Each atom once, in order: the session is three sentences, so three atoms.
        expect(shown.map(entry => entry.index)).toEqual([0, 1, 2]);
        // The atom after the late one is shown for its whole governed time, not cut short by the watchdog's leftover timer.
        expect(shown[1].at).toBe(4000);
        expect(shown[2].at - shown[1].at).toBe(1000);
    });

    it('lets a late end touch only the atom it was asked for, not an ungoverned atom shown after it', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: performance.now() }); });
        let endFirst = null;
        // The first atom's end is held back past its watchdog; the second declines governance and runs on its own timer.
        player.govern({
            duration: () => 1000,
            completion: (_atom, index) => (index === 0 ? new Promise(resolve => { endFirst = resolve; }) : index === 1 ? null
                : new Promise(resolve => { setTimeout(() => resolve({ reason: 'ended' }), 1000); }))
        });
        player.play();
        for (let i = 0; i < 200 && !shown.some(entry => entry.index === 1); i += 1) await tick(50);
        expect(shown.some(entry => entry.index === 1)).toBe(true);
        // The first atom's end arrives at last, while the second is on screen.
        await tick(300);
        endFirst({ reason: 'ended' });
        await tick(3000);
        expect(shown.map(entry => entry.index)).toEqual([0, 1, 2]);
        // The second atom is shown for its whole time (its own timer runs on frames, so a frame over): the stale end did not cut it short.
        expect(shown[2].at - shown[1].at).toBeGreaterThanOrEqual(1000);
        expect(shown[2].at - shown[1].at).toBeLessThan(1100);
    });

    it('re-arms the watchdog from the new estimate when the pace slows mid-atom, and the governed end still advances', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: performance.now() }); });
        let endFirst = null;
        // The estimate follows the pace, as the speech clock's does once rescaled: 1000 ms at 1x.
        player.govern({
            duration: () => 1000 * player.speedFactor,
            completion: (_atom, index) => (index === 0 ? new Promise(resolve => { endFirst = resolve; }) : null)
        });
        player.play();
        await tick(400);
        // Half the pace at 400 ms: what remains (600 ms of 1000) takes 1200 ms, so the watchdog is due at 400 + 1200 + 2500.
        player.setSpeedFactor(2);
        await tick(3650);
        expect(player.speechWatchdogId).not.toBe(null);
        expect(player.timerId).toBe(null);
        expect(shown.map(entry => entry.index)).toEqual([0]);
        endFirst({ reason: 'ended' });
        await tick(20);
        expect(shown.map(entry => entry.index)).toEqual([0, 1]);
    });

    it('re-times an ungoverned atom on its timer: the part shown stays shown, the rest goes at the new pace', async () => {
        const timed = session();
        for (const atom of timed.atoms) atom.duration = 1000;
        player = new Player(timed);
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: performance.now() }); });
        player.play();
        await tick(400);
        // 1.5x: the remaining 600 ms takes 400.
        player.setSpeedFactor(1 / 1.5);
        await tick(700);
        expect(shown[1].at).toBeGreaterThanOrEqual(800);
        expect(shown[1].at).toBeLessThan(820);
    });

    it('scales only the time left when the reading is paused', async () => {
        const timed = session();
        for (const atom of timed.atoms) atom.duration = 1000;
        player = new Player(timed);
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push({ index, at: performance.now() }); });
        player.play();
        await tick(400);
        player.pause();
        player.setSpeedFactor(2);
        expect(player.timerId).toBe(null);
        expect(player.currentAtomRemainingTime).toBeCloseTo(1200, 0);
        await tick(1000);
        player.play();
        await tick(1250);
        expect(shown.map(entry => entry.index)).toEqual([0, 1]);
        expect(shown[1].at - 1400).toBeGreaterThanOrEqual(1200);
        expect(shown[1].at - 1400).toBeLessThan(1220);
    });

    it('leaves the time left of a paused atom alone when a governor calls it fixed: a scene’s hold is real time, not speech', async () => {
        const timed = session();
        for (const atom of timed.atoms) atom.duration = 1000;
        player = new Player(timed);
        // The beat conductor answers so for a hold a scene may end: its remainder is on the scene's clock, whatever the pace.
        player.govern({ duration: () => null, completion: () => null, fixed: atom => atom === timed.atoms[0] });
        player.play();
        await tick(400);
        player.pause();
        const left = player.currentAtomRemainingTime;
        player.setSpeedFactor(2);
        expect(player.currentAtomRemainingTime).toBe(left);
        // The next atom, which no scene holds, is paced as before.
        player.play();
        await tick(left + 10);
        player.pause();
        const before = player.currentAtomRemainingTime;
        player.setSpeedFactor(4);
        expect(player.currentAtomRemainingTime).toBeCloseTo(before * 2, 0);
    });

    it('carries on for an atom that nothing governs', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
        player.govern({ completion: () => null, duration: () => null });
        player.play();
        await tick(60_000);
        expect(shown).toEqual(player.sessionState.session.atoms.map((_, i) => i));
    });
});
