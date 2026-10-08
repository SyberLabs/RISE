/**
 * The words on screen never run ahead of the words spoken.
 *
 * A voice that reports word boundaries says exactly where it is; between them
 * the governor only estimates, from a clock that can start before any sound
 * does (a cold speech engine reports its start early). So for such a voice an
 * atom is over only when the voice has begun the next atom's first word, or
 * has finished the segment. A voice that turns out not to report boundaries
 * after all is not waited on for ever: past a patience, the estimate stands
 * again for the rest of the Current.
 *
 * The first utterance of a reading is given longer to begin than the rest,
 * because a speech engine that has not spoken yet in this page starts slowly.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from './clock.js';
import { createSpeechGovernor, GOVERNOR_LIMITS } from './speech-governor.js';

const TEXT = 'one two three four';
const ATOMS = [{ content: 'one two', sourceId: 's' }, { content: 'three four', sourceId: 's' }];

function setup({ wordMarks = true, startsAt = 0 } = {}) {
    const clock = createVirtualClock();
    const voice = {
        capabilities: { wordMarks },
        playedMs: id => (id === 's' && clock.now() >= startsAt ? clock.now() - startsAt : undefined)
    };
    const degraded = [];
    const governor = createSpeechGovernor({ voice, clock, onDegrade: info => degraded.push(info) });
    let completion = null;
    governor.update({ atoms: ATOMS, segments: [{ id: 's', text: TEXT }] });
    governor.install({ govern: ({ completion: fn }) => { completion = fn; return () => {}; }, on: () => () => {} });
    const settled = index => {
        const state = { done: false, result: null };
        completion(ATOMS[index], index).then(result => { state.done = true; state.result = result; });
        return state;
    };
    return { clock, governor, settled, degraded };
}

describe('a voice that reports its words', () => {
    it('keeps an atom on screen until the voice has begun the next atom’s first word, however late that is', async () => {
        const { clock, governor, settled } = setup();
        const first = settled(0);
        // Far past the estimate for "one two " (8 characters), with no word heard.
        await clock.advance(3 * 8 * 65);
        expect(first.done).toBe(false);
        governor.observe('mark', 's', 4, 300);
        await clock.advance(100);
        expect(first.done).toBe(false);
        governor.observe('mark', 's', 8, 900);
        await clock.advance(100);
        expect(first.done).toBe(true);
        expect(first.result).toEqual({ reason: 'ended' });
    });

    it('keeps the segment’s last atom until the voice says the segment ended, while it is still reporting', async () => {
        const { clock, governor, settled } = setup();
        governor.observe('mark', 's', 8, 500);
        const last = settled(1);
        await clock.advance(1000);
        governor.observe('mark', 's', 14, 1000);
        // Past the estimate for the whole segment (18 characters at the speed the marks give), with no end heard.
        await clock.advance(1400);
        expect(last.done).toBe(false);
        governor.observe('end', 's', 2400);
        await clock.advance(100);
        expect(last.done).toBe(true);
    });

    it('stops waiting for words a voice never reports, after its patience, and estimates for the rest of the Current', async () => {
        const { clock, settled } = setup();
        const first = settled(0);
        const estimate = 8 * 65;
        // Patience runs from when the estimate fell due (the start was the last thing heard, before it).
        await clock.advance(estimate + GOVERNOR_LIMITS.markPatienceMs - 50);
        expect(first.done).toBe(false);
        await clock.advance(100);
        expect(first.done).toBe(true);
        // From now on the estimate stands: the next atom is not held for marks or for the segment's end.
        const last = settled(1);
        await clock.advance(10 * 65 + 50);
        expect(last.done).toBe(true);
    });
});

describe('a voice that does not claim to report its words', () => {
    it('is followed by its estimate, as before', async () => {
        const { clock, settled } = setup({ wordMarks: false });
        const first = settled(0);
        await clock.advance(8 * 65 + 30);
        expect(first.done).toBe(true);
    });
});

describe('the first utterance of a reading', () => {
    it('is given longer to begin than the grace, because a cold speech engine starts slowly', async () => {
        const { clock, settled, degraded } = setup({ startsAt: 3000 });
        const first = settled(0);
        await clock.advance(2900);
        expect(degraded).toEqual([]);
        expect(first.done).toBe(false);
        await clock.advance(200);
        expect(degraded).toEqual([]);
    });

    it('still stands down when the voice never begins at all', async () => {
        const { clock, settled, degraded } = setup({ startsAt: Infinity });
        const first = settled(0);
        await clock.advance(GOVERNOR_LIMITS.firstGraceMs + 100);
        expect(first.result).toEqual({ reason: 'timeout' });
        expect(degraded).toEqual([{ reason: 'voice-did-not-start' }]);
    });
});
