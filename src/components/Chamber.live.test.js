/**
 * A Chamber on a reading that is still arriving.
 *
 * The Player is extended as each segment lands, so the Chamber has to follow:
 * the schedules that follow the reading take the longer programs (or the atoms
 * of a later segment would be cued as if nothing were authored for them), and
 * what was already cued does not fire again. And a Player can outlive a
 * Chamber (a Dive that has come back is mounted on again), so a torn-down
 * Chamber must have let go of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { Player } from '../core/player.js';
import { compileRiseCurrent } from '../core/rise-current.js';

const SEGMENTS = [
    { id: 'a', text: 'A black hole is a region where gravity is strong.', visual: 'attractor' },
    { id: 'b', text: 'Its boundary is called the event horizon.', visual: 'still' },
    { id: 'c', text: 'Nothing that crosses it can return.', visual: 'genesis' }
];

const current = count => compileRiseCurrent({
    schema: 'rise.current.v1',
    id: 'chamber-live',
    title: 'Chamber live',
    origin: { kind: 'human', name: 'Tester' },
    segments: SEGMENTS.slice(0, count)
});

function mount(count = 1) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = new Player(current(count));
    player.setLive(true);
    const chamber = new Chamber(container, { session: player.sessionState.session, player });
    chamber.activate();
    return { chamber, player, container };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});

afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('following an extended Player', () => {
    it('takes the longer Session, and the visual schedule the longer program', () => {
        const { chamber, player } = mount(1);
        expect(chamber._visualSchedule.program.segments).toHaveLength(1);
        const longer = current(3);
        player.extend(longer);
        expect(chamber.session).toBe(longer);
        expect(chamber._visualSchedule.program).toBe(longer.visualProgram);
        expect(chamber._visualSchedule.program.segments).toHaveLength(3);
        chamber.destroy();
    });

    it('cues an atom of a later segment from the program, and does not re-cue what was showing', () => {
        const { chamber, player } = mount(1);
        const cues = [];
        chamber.applyScheduledVisualCue = (cue, meta) => cues.push([meta.cueId, cue.kind === 'field' ? cue.renderer : cue.kind]);
        const first = player.sessionState.session.atoms[0];
        chamber._visualSchedule.observe(first);
        expect(cues).toEqual([['visual-0', 'attractor']]);

        const longer = current(3);
        player.extend(longer);
        chamber._visualSchedule.observe(first);
        expect(cues).toHaveLength(1);

        const later = longer.atoms.find(atom => atom.sourceId === 'c');
        chamber._visualSchedule.observe(later);
        expect(cues.at(-1)).toEqual(['visual-2', 'genesis']);
        chamber.destroy();
    });

    it('takes what the Player grew while the Chamber was still being built', () => {
        // A sealed Current arrives whole: every segment extends the Player
        // before the view that will show it exists, so no 'extended' is heard.
        const container = document.createElement('div');
        document.body.appendChild(container);
        const first = current(1);
        const player = new Player(first);
        player.setLive(true);
        const longer = current(3);
        player.extend(longer);
        const chamber = new Chamber(container, { session: first, player });
        chamber.activate();
        expect(chamber.session).toBe(longer);
        expect(chamber._visualSchedule.program.segments).toHaveLength(3);
        chamber.destroy();
    });

    it('leaves an ordinary Session alone: nothing extends it, and the Chamber keeps its own', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const session = current(3);
        const player = new Player(session);
        const chamber = new Chamber(container, { session, player });
        chamber.activate();
        expect(chamber.session).toBe(session);
        chamber._adoptExtendedSession();
        expect(chamber.session).toBe(session);
        chamber.destroy();
    });
});

describe('letting go of the Player', () => {
    it('removes every listener it added, so a Chamber mounted next is the only one painting', () => {
        const { chamber, player } = mount(2);
        const before = ['atom', 'progress', 'complete', 'state', 'extended']
            .map(name => player.listeners.get(name)?.size ?? 0);
        expect(before.every(count => count >= 1)).toBe(true);

        chamber.destroy();
        const after = ['atom', 'progress', 'complete', 'state', 'extended']
            .map(name => player.listeners.get(name)?.size ?? 0);
        expect(after).toEqual([0, 0, 0, 0, 0]);

        const spy = vi.spyOn(chamber, 'displayAtom');
        player.replayCurrent();
        expect(spy).not.toHaveBeenCalled();
    });

    it('can be destroyed twice', () => {
        const { chamber } = mount(1);
        chamber.destroy();
        expect(() => chamber.destroy()).not.toThrow();
    });
});

describe('when the reading is over', () => {
    it('lets its field go once the closing screen has replaced the reading, and not before', () => {
        const { chamber, player } = mount(1);
        chamber._visualSchedule.observe(player.sessionState.session.atoms[0]);
        const field = chamber.attractorField;
        expect(field.rafId).not.toBeNull();

        player.emit('complete', {});
        // The reading fades out with its field still turning in it.
        expect(field.destroyed).toBeFalsy();
        vi.advanceTimersByTime(400);
        expect(chamber.container.querySelector('#chamber-display').style.display).toBe('none');
        expect(field.destroyed).toBe(true);
        expect(field.rafId).toBeNull();
        chamber.destroy();
    });
});
