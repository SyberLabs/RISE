/**
 * A v2 Current through the runtime: the sealed Current is compiled whole, the
 * voice is given only what is spoken, and a hold passes on its own clock.
 *
 * One time source runs all of it: vitest's fake timers drive the Player, the
 * voice, the port and the conductor alike.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createFakeMcpPort } from '../test/fake-mcp-port.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { createLiveRuntime } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { ATTRACTOR_VISUAL_MANIFEST } from '../core/visual-control-contract.js';

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor', params: { palette: 'jade' } }],
  beats: [
    { say: 'Sunlight carries every colour.', scene: 'field' },
    { hold: { ms: 2000 }, cue: 'bright' },
    { show: 'A title nobody says.', hold: { ms: 1000 } },
    { say: 'So blue reaches your eye.' }
  ]
};

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
  });
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
  await runtime?.stop();
  runtime = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a v2 Current in the runtime', () => {
  it('compiles the sealed Current, speaks only its spoken beats, and times the rest itself', async () => {
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const voice = createSyntheticVoice({ clock, msPerChar: 10, breathMs: 50 });
    const spoken = [];
    const enqueue = voice.enqueue.bind(voice);
    voice.enqueue = item => { spoken.push(item.id); return enqueue(item); };
    const players = [];
    const commands = [];
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => voice },
      createPlayer: session => { const player = new Player(session); players.push(player); return player; },
      host: {
        present() {}, dismiss() {},
        discoverVisual: () => ({ manifest: ATTRACTOR_VISUAL_MANIFEST, current: { intensity: 0.65 }, target: { intensity: 0.65 } }),
        controlVisual: ({ command }) => { commands.push(command); return { status: 'accepted', surface: command.surface, parameter: command.parameter, requested: command.value, effective: command.value }; }
      }
    });
    const started = runtime.start('Why is the sky blue?');
    port.answer(V2, 10);
    await tick(100);
    await started;
    expect(players).toHaveLength(1);
    const { atoms } = players[0].sessionState.session;
    const hold = atoms.find(atom => atom.sourceId === 'beat-1');
    expect(hold.hold).toEqual({ ms: 2000, sceneId: 'field' });
    expect(atoms.filter(atom => atom.sourceId === 'beat-2').every(atom => atom.beatTimed)).toBe(true);
    await tick(30_000);
    expect(spoken).toEqual(['beat-0', 'beat-3']);
    expect(players[0].sessionState.state).toBe('complete');
    // The hold's cue reached the running engine as the manifest's command, once.
    expect(commands).toEqual([{ surface: 'attractor', parameter: 'intensity', value: 0.75 }]);
  });

  it('keeps the voice as the clock through a hold: a spoken beat after one waits for the reading, and shows while it is said', async () => {
    const msPerChar = 10;
    const caption = { say: 'Scattering goes as one over lambda to the fourth.', show: 'Scattering goes as $1/\\lambda^4$.', place: 'caption' };
    const current = { ...V2, beats: [V2.beats[0], V2.beats[1], V2.beats[2], caption, V2.beats[3]] };
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const shown = [];
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => createSyntheticVoice({ clock, msPerChar, breathMs: 50 }) },
      createPlayer: session => {
        const player = new Player(session);
        player.on('atom', ({ atom }) => shown.push({ at: clock.now(), atom }));
        return player;
      },
      host: { present() {}, dismiss() {} }
    });
    const started = runtime.start('Why is the sky blue?');
    port.answer(current, 10);
    await tick(100);
    await started;
    await tick(30_000);

    const journal = runtime.journal();
    expect(journal.filter(entry => entry.type === 'voice.degraded')).toEqual([]);
    const at = shown.findIndex(({ atom }) => atom.sourceId === 'beat-3');
    const reached = shown[at - 1];
    expect(reached.atom.seam).toBeDefined();
    const began = journal.find(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-3');
    // The voice begins the caption once the reading has reached it, not during the hold and the shown line before it.
    expect(began.at).toBeGreaterThanOrEqual(reached.at);
    // And the caption is on screen for as long as its words take to say.
    expect(shown[at + 1].at - shown[at].at).toBeGreaterThanOrEqual(caption.say.length * msPerChar);
  });
});

describe('a generated scene in the runtime', () => {
  const SCENE_MANIFEST = { surface: 'scene', parameters: { cue: { type: 'name', cueable: true } } };
  const GENERATED = {
    ...V2,
    id: 'vector',
    scenes: [{ id: 'vector', code: 'export const reportsCompletion = true; export default () => ({ frame() {} });' }],
    beats: [
      { say: 'Here is a vector.', scene: 'vector', cue: 'draw' },
      { hold: { ms: 5000, maxMs: 8000 }, cue: 'rotate' },
      { say: 'It turned.' }
    ]
  };

  it('delivers its cues by name and lets the scene end its hold early, through the host', async () => {
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const voice = createSyntheticVoice({ clock, msPerChar: 10, breathMs: 50 });
    const players = [];
    const commands = [];
    const holds = [];
    const shownAt = new Map();
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => voice },
      createPlayer: session => {
        const player = new Player(session);
        player.on('atom', ({ atom }) => { if (!shownAt.has(atom.sourceId)) shownAt.set(atom.sourceId, Date.now()); });
        players.push(player);
        return player;
      },
      host: {
        present() {}, dismiss() {},
        discoverVisual: () => ({ manifest: SCENE_MANIFEST, current: {}, target: {} }),
        controlVisual: ({ command }) => { commands.push(command); return { status: 'accepted', surface: 'scene', parameter: 'cue', requested: command.value, effective: command.value }; },
        holdScene: ({ role, atom }) => {
          holds.push({ role, hold: atom.hold });
          return new Promise(resolve => { setTimeout(() => resolve({ reason: 'ended' }), 600); });
        }
      }
    });
    const started = runtime.start('Show me a vector');
    port.answer(GENERATED, 10);
    await tick(100);
    await started;
    await tick(30_000);
    expect(players[0].sessionState.state).toBe('complete');
    expect(commands).toEqual([
      { surface: 'scene', parameter: 'cue', value: 'draw' },
      { surface: 'scene', parameter: 'cue', value: 'rotate' }
    ]);
    expect(holds).toEqual([{ role: 'main', hold: { ms: 5000, maxMs: 8000, sceneId: 'vector' } }]);
    // The hold ended when the scene said so, well before its 5 s.
    const held = shownAt.get('beat-2') - shownAt.get('beat-1');
    expect(held).toBeGreaterThanOrEqual(600);
    expect(held).toBeLessThan(2000);
  });
});
