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
  it('fires a beat’s cue once, on the first atom of its passage, with the scene it is for', async () => {
    const cues = [];
    const { player } = setup({ onCue: cue => cues.push(cue) });
    const bright = [{ surface: 'attractor', parameter: 'intensity', value: 0.75 }];
    const first = { content: 'Here is', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field', cueCommands: bright };
    const second = { content: 'a vector.', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field', cueCommands: bright };
    player.show(first);
    player.show(second);
    player.show({ content: 'No cue.', sourceId: 'beat-1', scene: 'field' });
    player.show({ content: '', sourceId: 'beat-2', beat: { cue: 'calm' }, scene: 'field', hold: { ms: 1000, sceneId: 'field' } });
    await Promise.resolve();
    expect(cues).toEqual([{ cue: 'bright', sceneId: 'field', commands: bright }, { cue: 'calm', sceneId: 'field', commands: [] }]);
  });

  it('delivers a cue after the atom’s other listeners, so a scene the same beat starts is there to take it', async () => {
    const order = [];
    const { player } = setup({ onCue: ({ cue }) => order.push(`cue:${cue}`) });
    // The Chamber listens after the conductor and mounts the beat's scene as the atom arrives.
    player.on('atom', () => order.push('scene mounted'));
    player.show({ content: 'Here is a vector.', sourceId: 'beat-0', beat: { scene: 'vector', cue: 'draw' }, scene: 'vector' });
    await Promise.resolve();
    expect(order).toEqual(['scene mounted', 'cue:draw']);
  });

  it('fires nothing once disposed', async () => {
    const cues = [];
    const { conductor, player } = setup({ onCue: cue => cues.push(cue) });
    player.show({ content: 'x', sourceId: 'beat-0', beat: { cue: 'bright' }, scene: 'field' });
    conductor.dispose();
    player.show({ content: 'y', sourceId: 'beat-1', beat: { cue: 'calm' }, scene: 'field' });
    await Promise.resolve();
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

describe('a hold the scene may end', () => {
  const SCENE_HOLD = { content: '', duration: 6000, hold: { ms: 6000, maxMs: 8000, sceneId: 'vector' } };

  function scene() {
    const asked = [];
    let end = null;
    return {
      asked,
      end: () => end?.({ reason: 'ended' }),
      onHold: atom => { asked.push(atom); return new Promise(resolve => { end = resolve; }); }
    };
  }

  it('asks the scene for a hold with maxMs and ends when the scene does', async () => {
    const running = scene();
    const { clock, player } = setup({ onHold: running.onHold });
    const state = { done: null };
    player.governor.completion(SCENE_HOLD, 0).then(result => { state.done = result; });
    expect(running.asked).toEqual([SCENE_HOLD]);
    // While the scene holds, the Player is told the most the atom may last, so its own watchdog waits that long.
    expect(player.governor.duration(SCENE_HOLD, 0)).toBe(8000);
    await clock.advance(1200);
    running.end();
    await clock.advance(0);
    expect(state.done).toEqual({ reason: 'ended' });
  });

  it('ends at maxMs at the latest, whatever the scene does', async () => {
    const { clock, player } = setup({ onHold: () => new Promise(() => {}) });
    const state = { done: null };
    player.governor.completion(SCENE_HOLD, 0).then(result => { state.done = result; });
    await clock.advance(7999);
    expect(state.done).toBeNull();
    await clock.advance(1);
    expect(state.done).toEqual({ reason: 'ended' });
  });

  it('keeps its own clock when there is no scene to ask, or the hold has no maxMs', async () => {
    const asked = [];
    const { clock, player } = setup({ onHold: atom => { asked.push(atom); return null; } });
    const state = { done: null };
    player.governor.completion(SCENE_HOLD, 0).then(result => { state.done = result; });
    expect(player.governor.duration(SCENE_HOLD, 0)).toBe(6000);
    await clock.advance(6000);
    expect(state.done).toEqual({ reason: 'ended' });
    player.governor.completion(HOLD, 1);
    expect(asked).toEqual([SCENE_HOLD]);
  });

  it('ignores a scene that ends a hold the reader has paused', async () => {
    const running = scene();
    const { clock, player } = setup({ onHold: running.onHold });
    const state = { done: null };
    player.governor.completion(SCENE_HOLD, 0).then(result => { state.done = result; });
    player.set('paused');
    running.end();
    await clock.advance(9000);
    expect(state.done).toBeNull();
  });
});
