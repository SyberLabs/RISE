/**
 * The Player, held open for words that have not arrived yet.
 *
 * A live Current is compiled again each time a segment ends, and the atoms it
 * already had come back unchanged with more after them. The one Player is
 * therefore extended, not replaced. While the words run out the Player waits
 * instead of finishing, and it finishes only when told the Current is over.
 *
 * Every invariant here is about the reader's experience: each atom is
 * presented exactly once and in order, a hold takes no reading time, and a
 * Player that is not live behaves as it always has.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent } from './rise-current.js';
import { Player } from './player.js';

const SENTENCES = [
    'A black hole is a region of space where gravity is strong.',
    'Its boundary is called the event horizon.',
    'It is not a surface you could touch.',
    'It is the point of no return.'
];

const current = count => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'live-1',
    title: 'Live',
    origin: { kind: 'human', name: 'Tester' },
    segments: SENTENCES.slice(0, count).map((text, i) => ({ id: `s${i + 1}`, text }))
});

const tick = ms => vi.advanceTimersByTimeAsync(ms);

let player;
let seen;
let events;

function watch(p) {
    seen = [];
    events = [];
    p.on('atom', ({ index, concealed }) => { if (!concealed) seen.push(index); });
    for (const name of ['waiting', 'extended', 'complete', 'state']) {
        p.on(name, data => events.push([name, data]));
    }
}

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
});

afterEach(() => {
    player?.destroy();
    vi.useRealTimers();
});

describe('holding at the end of the words', () => {
    it('waits instead of finishing when the words run out and more may come', async () => {
        const session = current(1);
        player = new Player(session);
        player.setLive(true);
        watch(player);
        player.play();
        await tick(60_000);

        expect(seen).toEqual(session.atoms.map((_, i) => i));
        expect(events.filter(([name]) => name === 'complete')).toEqual([]);
        expect(events.filter(([name]) => name === 'waiting')).toHaveLength(1);
        expect(events.find(([name]) => name === 'waiting')[1]).toEqual({ index: session.atoms.length });
        expect(player.state).toBe('playing');
    });

    it('takes no reading time while it waits', async () => {
        player = new Player(current(1));
        player.setLive(true);
        player.play();
        await tick(30_000);
        const atHold = player.elapsed;
        await tick(60_000);
        expect(player.elapsed).toBe(atHold);
    });

    it('runs no animation frames while it waits', async () => {
        player = new Player(current(1));
        player.setLive(true);
        player.play();
        await tick(30_000);
        expect(player.timerId).toBeNull();
        expect(player.progressFrameId).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('holds a fast shuttle back to home', async () => {
        player = new Player(current(1));
        player.setLive(true);
        watch(player);
        player.play();
        await tick(200);
        player.shuttleForward();
        expect(player.shuttle.velocity).toBe(2);
        await tick(60_000);
        expect(player.shuttle.atHome).toBe(true);
    });
});

describe('extending it', () => {
    it('carries on into the new words the moment they arrive, presenting each atom once, in order', async () => {
        const one = current(1);
        player = new Player(one);
        player.setLive(true);
        watch(player);
        player.play();
        await tick(30_000);
        const held = seen.length;
        expect(held).toBe(one.atoms.length);

        const two = current(2);
        player.extend(two);
        await tick(30_000);
        const three = current(3);
        player.extend(three);
        await tick(30_000);

        expect(seen).toEqual(three.atoms.map((_, i) => i));
        expect(new Set(seen).size).toBe(seen.length);
        expect(events.filter(([name]) => name === 'extended').map(([, data]) => data.resumed)).toEqual([true, true]);
    });

    it('does not disturb the atom being shown when words arrive part way through it', async () => {
        const one = current(1);
        player = new Player(one);
        player.setLive(true);
        watch(player);
        player.play();
        await tick(400);
        const before = seen.slice();
        player.extend(current(2));
        expect(events.filter(([name]) => name === 'extended').map(([, data]) => data.resumed)).toEqual([false]);
        await tick(60_000);
        expect(seen.slice(0, before.length)).toEqual(before);
        expect(seen).toEqual(current(2).atoms.map((_, i) => i));
    });

    it('takes new words that arrive while it is paused, and reads them once it is played', async () => {
        player = new Player(current(1));
        player.setLive(true);
        watch(player);
        player.play();
        await tick(30_000);
        player.pause();
        player.extend(current(2));
        await tick(30_000);
        const stillHeld = seen.length;
        expect(stillHeld).toBe(current(1).atoms.length);
        player.play();
        await tick(30_000);
        expect(seen).toEqual(current(2).atoms.map((_, i) => i));
    });

    it('can be paused and played again while it waits, and still waits', async () => {
        player = new Player(current(1));
        player.setLive(true);
        watch(player);
        player.play();
        await tick(30_000);
        player.pause();
        player.play();
        await tick(30_000);
        expect(events.filter(([name]) => name === 'complete')).toEqual([]);
        expect(player.state).toBe('playing');
        player.extend(current(2));
        await tick(30_000);
        expect(seen).toEqual(current(2).atoms.map((_, i) => i));
    });

    it('keeps its progress and remaining time finite as the words grow', async () => {
        player = new Player(current(1));
        player.setLive(true);
        player.play();
        await tick(30_000);
        player.extend(current(3));
        expect(Number.isFinite(player.calculateRemainingTime())).toBe(true);
        expect(player.calculateRemainingTime()).toBeGreaterThan(0);
        expect(player.progress).toBeGreaterThan(0);
        expect(player.progress).toBeLessThan(1);
    });
});

describe('what may be extended, and with what', () => {
    const live = () => {
        const p = new Player(current(2));
        p.setLive(true);
        return p;
    };

    it('refuses a Session that is not longer, or not the same to begin with', () => {
        player = live();
        expect(() => player.extend(current(1))).toThrow(RangeError);

        const changed = current(3);
        changed.atoms[0] = { ...changed.atoms[0], content: 'Something else entirely.' };
        expect(() => player.extend(changed)).toThrow(/unchanged/u);

        const retimed = current(3);
        retimed.atoms[1] = { ...retimed.atoms[1], duration: retimed.atoms[1].duration + 1 };
        expect(() => player.extend(retimed)).toThrow(/unchanged/u);

        const moved = current(3);
        moved.atoms[0] = { ...moved.atoms[0], sourceId: 'other' };
        expect(() => player.extend(moved)).toThrow(/unchanged/u);
    });

    it('changes nothing when it refuses', () => {
        player = live();
        const before = player.sessionState.session;
        const bad = current(3);
        bad.atoms[0] = { ...bad.atoms[0], content: 'x' };
        expect(() => player.extend(bad)).toThrow();
        expect(player.sessionState.session).toBe(before);
    });

    it('is a live Player only: an ordinary one cannot be extended', () => {
        player = new Player(current(2));
        expect(() => player.extend(current(3))).toThrow(/live/u);
    });

    it('accepts the same words again as a no-op', async () => {
        player = live();
        watch(player);
        player.play();
        await tick(200);
        expect(() => player.extend(current(2))).not.toThrow();
        await tick(60_000);
        expect(seen).toEqual(current(2).atoms.map((_, i) => i));
    });
});

describe('showing the same atom again', () => {
    it('emits the atom the head is on, and changes nothing about the reading', async () => {
        player = new Player(current(3));
        player.setLive(true);
        watch(player);
        player.play();
        await tick(1_500);
        player.pause();
        const before = { index: player.sessionState.currentIndex, state: player.state, remaining: player.currentAtomRemainingTime };
        const replays = [];
        player.on('atom', data => { if (data.replayed) replays.push(data); });
        expect(player.replayCurrent()).toBe(true);
        expect(replays).toHaveLength(1);
        expect(replays[0].index).toBe(before.index);
        expect(replays[0].atom).toBe(player.sessionState.currentAtom);
        expect({ index: player.sessionState.currentIndex, state: player.state, remaining: player.currentAtomRemainingTime }).toEqual(before);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('lets the reading carry on afterwards without repeating an atom', async () => {
        const session = current(3);
        player = new Player(session);
        watch(player);
        player.play();
        await tick(1_500);
        player.pause();
        const firsts = [...seen];
        player.on('atom', ({ index, concealed, replayed }) => { if (!concealed && !replayed) firsts.push(index); });
        player.replayCurrent();
        player.play();
        await tick(60_000);
        // The replay is shown once more, and only that: every other atom is shown once, in order.
        expect(firsts).toEqual(session.atoms.map((_, i) => i));
    });

    it('says there is nothing to show when the head is past the end', async () => {
        player = new Player(current(1));
        player.play();
        await tick(60_000);
        expect(player.replayCurrent()).toBe(false);
    });
});

describe('taking up the atom a reading was paused on from its start', () => {
    it('shows it again, once, from its start when played, and carries on in order with no other atom repeated', async () => {
        const session = current(3);
        player = new Player(session);
        watch(player);
        player.play();
        await tick(1_500);
        player.pause();
        const head = player.sessionState.currentIndex;
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
        expect(player.restartCurrentAtom()).toBe(true);
        expect(shown).toEqual([]);
        player.play();
        await tick(60_000);
        // The atom it was on is shown once more, and then every later atom once, in order.
        expect(shown).toEqual([head, ...session.atoms.map((_, i) => i).filter(i => i > head)]);
    });

    it('gives it all of its time again, not what remained of it', async () => {
        const session = current(2);
        player = new Player(session);
        watch(player);
        player.play();
        await tick(1_000);
        player.pause();
        const head = player.sessionState.currentIndex;
        const remaining = player.currentAtomRemainingTime;
        const full = player._atomDisplayMs(player.sessionState.currentAtom);
        expect(remaining).toBeLessThan(full);
        player.restartCurrentAtom();
        const advanced = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) advanced.push([index, Date.now()]); });
        player.play();
        const began = Date.now();
        await tick(full - 50);
        expect(advanced.filter(([index]) => index !== head)).toEqual([]);
        await tick(200);
        expect(advanced.some(([index]) => index === head + 1)).toBe(true);
        expect(Date.now() - began).toBeGreaterThanOrEqual(full - 50);
    });

    it('does nothing, and says so, unless the reading is paused on an atom', async () => {
        player = new Player(current(2));
        watch(player);
        expect(player.restartCurrentAtom()).toBe(false);
        player.play();
        await tick(500);
        expect(player.restartCurrentAtom()).toBe(false);
        await tick(60_000);
        expect(player.restartCurrentAtom()).toBe(false);
    });

    it('is taken back by a second pause: a reading paused again carries on from what remains, as it always did', async () => {
        const session = current(3);
        player = new Player(session);
        watch(player);
        player.play();
        await tick(1_500);
        player.pause();
        player.restartCurrentAtom();
        player.play();
        await tick(400);
        player.pause();
        const shown = [];
        player.on('atom', ({ index, concealed }) => { if (!concealed) shown.push(index); });
        player.play();
        // A plain resume does not show the atom again.
        expect(shown).toEqual([]);
    });
});

describe('finishing', () => {
    it('completes, once, when told there is no more, while it is waiting', async () => {
        const session = current(2);
        player = new Player(session);
        player.setLive(true);
        watch(player);
        player.play();
        await tick(60_000);
        expect(events.filter(([name]) => name === 'complete')).toEqual([]);
        player.setLive(false);
        await tick(1_000);
        expect(events.filter(([name]) => name === 'complete')).toHaveLength(1);
        expect(player.state).toBe('complete');
        player.setLive(false);
        expect(events.filter(([name]) => name === 'complete')).toHaveLength(1);
    });

    it('completes at the end of the words as usual when told before they run out', async () => {
        const session = current(2);
        player = new Player(session);
        player.setLive(true);
        watch(player);
        player.play();
        await tick(400);
        player.setLive(false);
        await tick(60_000);
        expect(events.filter(([name]) => name === 'complete')).toHaveLength(1);
        expect(seen).toEqual(session.atoms.map((_, i) => i));
    });

    it('completes an ordinary Session exactly as it always has', async () => {
        const session = current(2);
        player = new Player(session);
        watch(player);
        player.play();
        await tick(60_000);
        expect(events.filter(([name]) => name === 'waiting')).toEqual([]);
        expect(events.filter(([name]) => name === 'complete')).toHaveLength(1);
        expect(player.state).toBe('complete');
    });

    it('cleans up: nothing runs after it is stopped while it waits', async () => {
        player = new Player(current(1));
        player.setLive(true);
        player.play();
        await tick(30_000);
        player.stop();
        expect(vi.getTimerCount()).toBe(0);
        expect(player.state).toBe('idle');
    });
});

describe('a graft (the interjection, docs/plans/LIVE-CURRENT.md §17)', () => {
    /** Segments s1, s2, then other words in place of s3 and s4: an answer put in after s2. */
    const grafted = () => compileRiseCurrent({
        schema: 'rise.current.v1', id: 'live-1', title: 'Live', origin: { kind: 'human', name: 'Tester' },
        segments: [...SENTENCES.slice(0, 2).map((text, i) => ({ id: `s${i + 1}`, text })), { id: 'a1', text: 'The horizon is a distance, not a thing.' }]
    });

    /** Held on the first atom of s2. */
    async function heldInS2() {
        const four = current(4);
        player = new Player(four);
        player.setLive(true);
        watch(player);
        player.play();
        const at = four.atoms.findIndex(atom => atom.sourceId === 's2' && !atom.seam);
        while (player.sessionState.currentIndex < at) await tick(50);
        player.pause();
        return { four, at };
    }

    it('takes a Session that keeps every atom up to the head and differs after it, and leaves the head where it is', async () => {
        const { at } = await heldInS2();
        const next = grafted();
        player.graft(next);
        expect(player.sessionState.session).toBe(next);
        expect(player.sessionState.currentIndex).toBe(at);
        expect(player.state).toBe('paused');
        expect(events.filter(([name]) => name === 'extended').at(-1)[1]).toEqual({ atomCount: next.atoms.length, resumed: false, grafted: true });
    });

    it('then reads the new words from wherever the reader is sent, each once', async () => {
        await heldInS2();
        const next = grafted();
        player.graft(next);
        const answer = next.atoms.findIndex(atom => atom.sourceId === 'a1');
        seen.length = 0;
        player.seekTo(answer);
        player.play();
        await tick(30_000);
        expect(seen).toEqual(next.atoms.map((_, i) => i).slice(answer));
    });

    it('is refused while the reading plays, when the head’s atom or one before it differs, and on a Player that is not live', async () => {
        const { four } = await heldInS2();
        expect(() => player.graft(current(1))).toThrow(RangeError);
        player.play();
        expect(() => player.graft(grafted())).toThrow(RangeError);
        player.pause();
        const other = compileRiseCurrent({ schema: 'rise.current.v1', id: 'live-1', title: 'Live', origin: { kind: 'human', name: 'Tester' }, segments: [{ id: 's1', text: 'Something else entirely.' }, { id: 's2', text: SENTENCES[1] }] });
        expect(() => player.graft(other)).toThrow(RangeError);
        expect(player.sessionState.session).toBe(four);
        player.setLive(false);
        expect(() => player.graft(grafted())).toThrow(RangeError);
    });
});
