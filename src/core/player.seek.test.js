/**
 * Moving the reading to an atom: the reader's seek, as the live runtime asks it of the Player.
 *
 * The Player goes to the atom and takes it up from its start, timed afresh by whatever governs it; nothing owed
 * to the atom it left (a timer, a watchdog, a governed end, a flash between phrases) may move it again. A paused
 * Player stays paused and shows the atom when played; a playing one shows it at once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent } from './rise-current.js';
import { Player } from './player.js';

const session = () => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'seek-1',
    title: 'Seek',
    origin: { kind: 'human', name: 'Tester' },
    segments: [
        { id: 's1', text: 'One thought here. And another one follows it. And a third.' },
        { id: 's2', text: 'A second passage begins. It goes on for a while. Then it ends.' }
    ]
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

const atoms = target => target.sessionState.session.atoms;

function watch(target) {
    const shown = [];
    target.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
    return shown;
}

/** A governor that ends each atom when the test says, and remembers which atoms it was asked for. */
function governed(target) {
    const asked = [];
    const ends = new Map();
    target.govern({
        completion: (atom, index) => {
            asked.push(index);
            return new Promise(resolve => ends.set(index, resolve));
        }
    });
    return { asked, end: index => ends.get(index)?.({ reason: 'ended' }) };
}

describe('seeking while playing', () => {
    it('shows the atom at once, times it afresh, and lets nothing owed to the atom it left move the reading', async () => {
        player = new Player(session());
        const shown = watch(player);
        const clock = governed(player);
        player.play();
        await tick(100);
        player.seekTo(4);
        expect(player.sessionState.state).toBe('playing');
        expect(shown).toEqual([0, 4]);
        expect(clock.asked).toEqual([0, 4]);
        // The end owed to atom 0 comes and goes without moving the reading.
        clock.end(0);
        await tick(100);
        expect(shown).toEqual([0, 4]);
        clock.end(4);
        await tick(10);
        expect(shown).toEqual([0, 4, 5]);
    });

    it('keeps the watchdog of the atom sought when a late end owed to the atom it left arrives', async () => {
        player = new Player(session());
        const shown = watch(player);
        const clock = governed(player);
        player.play();
        await tick(100);
        player.seekTo(4);
        clock.end(0);
        // Atom 4's end never comes: its watchdog still carries the reading on.
        await tick(atoms(player)[4].duration * 2 + 3_000);
        expect(shown.slice(0, 3)).toEqual([0, 4, 5]);
    });

    it('drops the timer of the atom it left: the atom sought lasts its own time', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index }) => shown.push({ index, at: performance.now() }));
        const { duration: first } = atoms(player)[0];
        const { duration: sought } = atoms(player)[2];
        player.play();
        await tick(first - 50);
        player.seekTo(2);
        const at = performance.now();
        await tick(sought + 100);
        const next = shown.find(entry => entry.index === 3);
        expect(next.at - at).toBeGreaterThanOrEqual(sought);
        expect(shown.filter(entry => entry.index === 1)).toEqual([]);
    });

    it('goes back as readily as forward', async () => {
        player = new Player(session());
        const shown = watch(player);
        const clock = governed(player);
        player.play();
        for (const index of [0, 1, 2]) { clock.end(index); await tick(10); }
        player.seekTo(1);
        clock.end(1);
        await tick(10);
        expect(shown).toEqual([0, 1, 2, 3, 1, 2]);
    });

    it('ends a flash of imagery between phrases where it stands, and goes to the atom without the flash advancing it again', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        player = new Player(session());
        player.sessionState.session.visualConfig = { visualMode: 'interlocution', interlocution: { frequency: 1 } };
        let finishFlash = null;
        const cancelled = [];
        player.setInterlocutionHandler(
            () => new Promise(resolve => { finishFlash = () => resolve({ presented: true, presentedDurationMs: 1_200 }); }),
            reason => cancelled.push(reason)
        );
        const shown = watch(player);
        const clock = governed(player);
        player.play();
        clock.end(0);
        await tick(10);
        expect(player.sessionState.state).toBe('interlocuting');
        player.seekTo(3);
        expect(cancelled).toHaveLength(1);
        expect(player.sessionState.state).toBe('playing');
        expect(shown).toEqual([0, 3]);
        finishFlash();
        await tick(100);
        expect(shown).toEqual([0, 3]);
    });
});

describe('seeking while paused', () => {
    it('stays paused on the atom sought, shown, and takes it up from its start, once, when played', async () => {
        player = new Player(session());
        const shown = watch(player);
        const clock = governed(player);
        player.play();
        await tick(100);
        player.pause();
        player.seekTo(3);
        expect(shown).toEqual([0, 3]);
        await tick(5_000);
        expect(player.sessionState.state).toBe('paused');
        expect(shown).toEqual([0, 3]);
        expect(clock.asked).toEqual([0]);
        player.play();
        // Not shown a second time, and asked afresh, not resumed on what remained of the atom it left.
        expect(shown).toEqual([0, 3]);
        expect(clock.asked).toEqual([0, 3]);
        clock.end(3);
        await tick(10);
        expect(shown).toEqual([0, 3, 4]);
    });

    it('gives the atom sought its whole time when played, on the Player’s own timer', async () => {
        player = new Player(session());
        const shown = [];
        player.on('atom', ({ index }) => shown.push({ index, at: performance.now() }));
        player.play();
        await tick(100);
        player.pause();
        player.seekTo(2);
        await tick(1_000);
        const at = performance.now();
        player.play();
        await tick(atoms(player)[2].duration + 100);
        expect(shown.map(entry => entry.index)).toEqual([0, 2, 3]);
        expect(shown[2].at - at).toBeGreaterThanOrEqual(atoms(player)[2].duration);
    });

    it('shows the atom sought in a reading that had finished, and takes it up from there when played', async () => {
        player = new Player(session());
        const shown = watch(player);
        player.play();
        await tick(120_000);
        expect(player.sessionState.state).toBe('complete');
        const before = shown.length;
        player.seekTo(2);
        expect(shown.slice(before)).toEqual([2]);
        player.play();
        expect(player.sessionState.state).toBe('playing');
        expect(shown.slice(before)).toEqual([2]);
    });

    it('refuses an atom that is not there', () => {
        player = new Player(session());
        expect(() => player.seekTo(-1)).toThrow(RangeError);
        expect(() => player.seekTo(player.sessionState.session.atoms.length)).toThrow(RangeError);
        expect(() => player.seekTo(1.5)).toThrow(RangeError);
    });
});
