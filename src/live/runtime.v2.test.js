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
import { createLiveRuntime, RUNTIME_LIMITS } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { ATTRACTOR_VISUAL_MANIFEST } from '../core/visual-control-contract.js';
import { createMockBeatsAdapter } from './adapters/mock-beats.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';

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

describe('the end of a reading', () => {
  const SPOKEN = {
    ...V2,
    beats: [{ say: 'A first passage, said slowly.', scene: 'field' }, { say: 'And the last words of the reading.' }]
  };

  /**
   * A synthetic voice that is given each passage 5 s late, so the clock gives up on it and the words, at the
   * pace of speech, finish while the voice is still saying them. `drop`: a passage it accepts and never says.
   */
  function lateRun({ drop = null } = {}) {
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const voice = createSyntheticVoice({ clock, msPerChar: 120, breathMs: 50 });
    const enqueue = voice.enqueue.bind(voice);
    voice.enqueue = item => { if (item.id !== drop) clock.setTimer(() => enqueue(item), 5_000); };
    const seen = { completeAt: null, statuses: [] };
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => voice },
      createPlayer: session => {
        const player = new Player(session);
        player.on('complete', () => { seen.completeAt = performance.now(); });
        return player;
      },
      host: { present() {}, dismiss() {} }
    });
    runtime.subscribe(view => { if (seen.statuses.at(-1)?.status !== view.status) seen.statuses.push({ status: view.status, at: performance.now() }); });
    port.answer(SPOKEN, 10);
    return { seen, started: runtime.start('Why is the sky blue?') };
  }

  const endedAt = seen => seen.statuses.find(entry => entry.status === 'ended')?.at ?? null;
  const lastSpeechEnd = () => runtime.journal().filter(entry => entry.type === 'speech.end').at(-1)?.at ?? null;

  it('is not over while its last words are still being said: it ends when the voice does', async () => {
    const { seen, started } = lateRun();
    await tick(100);
    await started;
    await tick(40_000);
    // The words finished first: the clock gave up on a voice that began late.
    expect(seen.completeAt).not.toBeNull();
    expect(lastSpeechEnd()).toBeGreaterThan(seen.completeAt + 1_000);
    expect(endedAt(seen)).toBeGreaterThanOrEqual(lastSpeechEnd());
    expect(endedAt(seen)).toBeLessThanOrEqual(lastSpeechEnd() + 100);
  });

  it('ends at the latest its bounded time after the words, for a voice that never finishes', async () => {
    const { seen, started } = lateRun({ drop: 'beat-1' });
    await tick(100);
    await started;
    await tick(60_000);
    expect(seen.completeAt).not.toBeNull();
    expect(endedAt(seen) - seen.completeAt).toBeGreaterThanOrEqual(RUNTIME_LIMITS.voiceTailMs - 50);
    expect(endedAt(seen) - seen.completeAt).toBeLessThanOrEqual(RUNTIME_LIMITS.voiceTailMs + 50);
  });

  it('holds the voice on a Pause while it says its last words, and lets it finish on Play', async () => {
    const { seen, started } = lateRun();
    await tick(100);
    await started;
    for (let waited = 0; seen.completeAt === null && waited < 40_000; waited += 100) await tick(100);
    expect(runtime.status).toBe('live');
    await runtime.interrupt();
    expect(runtime.status).toBe('interrupted');
    const said = runtime.journal().filter(entry => entry.type === 'speech.end').length;
    await tick(10_000);
    // Held: nothing more is said, and the reading is not over.
    expect(runtime.journal().filter(entry => entry.type === 'speech.end').length).toBe(said);
    expect(endedAt(seen)).toBeNull();
    runtime.resume();
    await tick(30_000);
    expect(endedAt(seen)).toBeGreaterThanOrEqual(lastSpeechEnd());
    expect(runtime.journal().filter(entry => entry.type === 'speech.end').map(entry => entry.segmentId)).toEqual(['beat-0', 'beat-1']);
  });
});

describe('beats streamed: a v2 Current played as it is written', () => {
  /** The venue's demo, written in beats at a model's pace, read by the synthetic voice; what is shown is timed. */
  function streamedRun({ adapter, msPerChar = 30 } = {}) {
    const clock = createRealClock();
    const voice = createSyntheticVoice({ clock, msPerChar, breathMs: 50 });
    const spoken = [];
    const enqueue = voice.enqueue.bind(voice);
    voice.enqueue = item => { spoken.push(item.id); return enqueue(item); };
    const shown = [];
    const commands = [];
    const players = [];
    const sessions = [];
    runtime = createLiveRuntime({
      adapter: adapter ?? createMockBeatsAdapter({ clock }), clock, voices: { create: () => voice },
      createPlayer: session => {
        sessions.push(session);
        const player = new Player(session);
        player.on('atom', ({ atom, index }) => shown.push({ at: performance.now(), atom, index }));
        players.push(player);
        return player;
      },
      host: {
        present() {}, dismiss() {},
        discoverVisual: () => ({ manifest: ATTRACTOR_VISUAL_MANIFEST, current: { intensity: 0.65 }, target: { intensity: 0.65 } }),
        controlVisual: ({ command }) => { commands.push({ at: performance.now(), command }); return { status: 'accepted', surface: command.surface, parameter: command.parameter, requested: command.value, effective: command.value }; }
      }
    });
    return { spoken, shown, commands, players, sessions, started: runtime.start('Explain black holes with RISE.') };
  }

  const firstShown = (shown, predicate) => shown.find(({ atom }) => predicate(atom))?.at ?? null;
  const composedAt = () => runtime.journal().find(entry => entry.type === 'composed')?.at ?? null;

  it('takes up a hold, a scene and a cue while the answer is still being written, the voice the clock throughout', async () => {
    const { spoken, shown, commands, players, sessions, started } = streamedRun();
    await tick(100);
    await started;
    await tick(60_000);
    // The reading is put on screen with its first beat, which starts no scene: it is put up ready for the ones that follow.
    expect(sessions[0].atoms.every(atom => atom.sourceId === 'beat-0' || atom.seam)).toBe(true);
    expect(sessions[0].visualConfig.visualMode).toBe('interlocution');
    expect(sessions[0].visualProgram.segments.length).toBeGreaterThan(0);
    const composed = composedAt();
    expect(composed).not.toBeNull();
    expect(runtime.journal().find(entry => entry.type === 'composed')).toMatchObject({ role: 'main', phase: 'complete' });
    // The hold after the first beat, the figure's beat and the field's cue all came before the last line was written.
    const hold = firstShown(shown, atom => atom.sourceId === 'beat-1');
    const figure = firstShown(shown, atom => atom.scene === 'horizon');
    expect(shown.find(({ atom }) => atom.sourceId === 'beat-1').atom.hold).toEqual({ ms: 1800, sceneId: 'field' });
    expect(hold).toBeLessThan(composed);
    expect(figure).toBeLessThan(composed);
    expect(commands[0]).toMatchObject({ command: { surface: 'attractor', parameter: 'intensity', value: 0.45 } });
    expect(commands[0].at).toBeLessThan(composed);
    // The hold lasted its own length: nobody spoke in it.
    const after = firstShown(shown, atom => atom.sourceId === 'beat-2');
    expect(after - hold).toBeGreaterThanOrEqual(1800);
    // Only what is said is given to the voice, which was the clock throughout, and the reading ends complete.
    expect(spoken).toEqual(['beat-0', 'beat-2', 'beat-4', 'beat-6']);
    expect(runtime.journal().filter(entry => entry.type === 'voice.degraded')).toEqual([]);
    expect(players).toHaveLength(1);
    expect(players[0].sessionState.state).toBe('complete');
    expect(runtime.status).toBe('ended');
  });

  it('seeks and replays over a streamed beat run as over a sealed one', async () => {
    const { spoken, started } = streamedRun({ msPerChar: 10 });
    await tick(100);
    await started;
    await tick(60_000);
    expect(runtime.status).toBe('ended');
    expect(runtime.passages().map(passage => [passage.segmentId, passage.spoken])).toEqual([
      ['beat-0', true], ['beat-1', false], ['beat-2', true], ['beat-3', false], ['beat-4', true], ['beat-5', false], ['beat-6', true]
    ]);
    spoken.length = 0;
    runtime.seek({ segmentId: 'beat-2' });
    expect(runtime.position()).toMatchObject({ segmentId: 'beat-2', spoken: true });
    await tick(60_000);
    expect(spoken).toEqual(['beat-2', 'beat-4', 'beat-6']);
    spoken.length = 0;
    runtime.seek({ segmentId: 'beat-4' });
    runtime.replay();
    await tick(60_000);
    expect(spoken[0]).toBe('beat-4');
    expect(runtime.status).toBe('ended');
  });

  it('writes a scene the admission refused in the journal, in the Worker’s words, and reads on', async () => {
    const text = '@say A scene that reaches out.\n@scene thief code\n```js\nexport default function scene(rise) { fetch(1); return { frame() {} }; }\n```\n@say scene=thief It is not started.\n';
    const adapter = createTextStreamAdapter({
      id: 'scripted', provider: 'test',
      connect: async (_request, sink) => { setTimeout(() => { sink.delta(text); sink.done(); }, 10); return { cancel() {}, close() {} }; }
    });
    const { spoken, started } = streamedRun({ adapter, msPerChar: 10 });
    await tick(100);
    await started;
    await tick(20_000);
    const refused = runtime.journal().filter(entry => entry.type === 'scene.refused');
    expect(refused).toEqual([expect.objectContaining({ role: 'main', sceneId: 'thief', message: expect.stringMatching(/^Scene "thief" was refused: line 1, column \d+: `fetch`/u) })]);
    expect(spoken).toEqual(['beat-0', 'beat-1']);
    expect(runtime.status).toBe('ended');
  });
});
