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

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [
    { say: 'Sunlight carries every colour.', scene: 'field' },
    { hold: { ms: 2000 } },
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
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => voice },
      createPlayer: session => { const player = new Player(session); players.push(player); return player; },
      host: { present() {}, dismiss() {} }
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
  });
});
