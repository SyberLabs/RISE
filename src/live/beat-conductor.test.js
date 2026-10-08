/**
 * The beat conductor: one governor on the Player's completion seam that gives
 * each atom its clock. A hold's atom and a shown beat's atoms are timed by
 * their own duration here, so the speech governor is never asked about words
 * no voice will say; every other atom is declined, and the voice decides.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from './clock.js';
import { createBeatConductor } from './beat-conductor.js';

function fakePlayer() {
  const listeners = { state: new Set(), atom: new Set() };
  let governor = null;
  return {
    govern(given) { governor = given; return () => { governor = null; }; },
    on(name, fn) { listeners[name]?.add(fn); return () => listeners[name]?.delete(fn); },
    set(state) { for (const fn of listeners.state) fn({ state }); },
    show(atom) { for (const fn of listeners.atom) fn({ atom, index: 0, concealed: false }); },
    get governor() { return governor; }
  };
}

function setup(options = {}) {
  const clock = createVirtualClock();
  const conductor = createBeatConductor({ clock, ...options });
  const player = fakePlayer();
  conductor.install(player);
  return { clock, conductor, player };
}

const HOLD = { content: '', duration: 3000, hold: { ms: 3000, sceneId: 'field' } };
const SHOWN = { content: 'A title.', duration: 1500, beatTimed: true };
const SAID = { content: 'Words a voice says.', duration: 1200 };

describe('what the conductor cues', () => {
  it('fires a beat’s cue once, on the first atom of its passage, with the scene it is for', () => {
    const cues = [];
    const { player } = setup({ onCue: cue => cues.push(cue) });
    const bright = [{ surface: 'attractor', parameter: 'intensity', value: 0.75 }];
    const first = { content: 'Here is', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field', cueCommands: bright };
    const second = { content: 'a vector.', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field', cueCommands: bright };
    player.show(first);
    player.show(second);
    player.show({ content: 'No cue.', sourceId: 'beat-1', scene: 'field' });
    player.show({ content: '', sourceId: 'beat-2', beat: { cue: 'calm' }, scene: 'field', hold: { ms: 1000, sceneId: 'field' } });
    expect(cues).toEqual([{ cue: 'bright', sceneId: 'field', commands: bright }, { cue: 'calm', sceneId: 'field', commands: [] }]);
  });

  it('fires nothing once disposed', () => {
    const cues = [];
    const { conductor, player } = setup({ onCue: cue => cues.push(cue) });
    conductor.dispose();
    player.show({ content: 'x', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field' });
    expect(cues).toEqual([]);
  });
});

describe('what the conductor times', () => {
  it('ends a hold’s atom when its duration has passed, and not before', async () => {
    const { clock, player } = setup();
    const state = { done: null };
    player.governor.completion(HOLD, 0).then(result => { state.done = result; });
    await clock.advance(2900);
    expect(state.done).toBeNull();
    await clock.advance(200);
    expect(state.done).toEqual({ reason: 'ended' });
    expect(player.governor.duration(HOLD, 0)).toBe(3000);
  });

  it('times a shown beat’s atom the same way', async () => {
    const { clock, player } = setup();
    const state = { done: null };
    player.governor.completion(SHOWN, 1).then(result => { state.done = result; });
    await clock.advance(1500);
    expect(state.done).toEqual({ reason: 'ended' });
  });

  it('declines an atom a voice will say, so the speech governor decides it', () => {
    const { player } = setup();
    expect(player.governor.completion(SAID, 2)).toBeNull();
    expect(player.governor.duration(SAID, 2)).toBeUndefined();
  });

  it('stops waiting when the reading pauses, since the Player times the rest of the atom itself on resume', async () => {
    const { clock, player } = setup();
    const state = { done: null };
    player.governor.completion(HOLD, 0).then(result => { state.done = result; });
    await clock.advance(1000);
    player.set('paused');
    await clock.advance(5000);
    expect(state.done).toBeNull();
  });

  it('lets go of the Player when disposed', async () => {
    const { clock, conductor, player } = setup();
    const state = { done: null };
    player.governor.completion(HOLD, 0).then(result => { state.done = result; });
    conductor.dispose();
    expect(player.governor).toBeNull();
    await clock.advance(4000);
    expect(state.done).toBeNull();
  });
});
