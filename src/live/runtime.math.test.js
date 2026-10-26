/**
 * Maths in a streamed answer (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.5): the reading
 * holds a passage with maths until the typesetter has loaded (or long enough has passed), so a formula is never
 * shown as source and later snapped into place, and the voice is given the passage as it is said.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { spokenWith } from '../core/math-text.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime, RUNTIME_LIMITS } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';

const ANSWER = [
  '@say Here is the oscillator.',
  '@say It never rests.',
  '@say The energy is $E_0 = \\frac{1}{2}\\hbar\\omega$ at rest.',
  '@say That is all.'
].join('\n') + '\n';

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(async () => {
  await runtime?.stop();
  runtime = null;
  vi.useRealTimers();
});

/** The typesetter as the runtime sees it, loaded when the test says. */
function typesetter() {
  let resolve;
  const loaded = new Promise(done => { resolve = done; });
  return {
    maths: { load: () => loaded, speakable: text => spokenWith(text, () => 'E nought equals one half h bar omega') },
    finishLoading: () => resolve()
  };
}

function start({ maths }) {
  const clock = createRealClock();
  const adapter = createTextStreamAdapter({
    id: 'maths', origin: () => ({ name: 'Test', provider: 'Test' }),
    connect: async (request, sink) => {
      void (async () => {
        for (const line of ANSWER.split(/(?<=\n)/u)) { await clock.sleep(50); sink.delta(line); }
        sink.done();
      })();
      return { cancel() {}, close() {} };
    }
  });
  const voice = createSyntheticVoice({ clock, msPerChar: 10, breathMs: 50 });
  const said = [];
  const enqueue = voice.enqueue.bind(voice);
  voice.enqueue = item => { said.push(item); return enqueue(item); };
  const players = [];
  runtime = createLiveRuntime({
    adapter, clock, maths, voices: { create: () => voice },
    createPlayer: session => { const player = new Player(session); players.push(player); return player; },
    host: { present() {}, dismiss() {} }
  });
  void runtime.start('What is the energy of an oscillator at rest?');
  const shown = () => players[0]?.sessionState.session.atoms.filter(atom => !atom.seam).map(atom => atom.sourceId) ?? [];
  return { said, shown };
}

describe('maths in a streamed answer', () => {
  it('reads on while the typesetter loads, holds the passage with maths, then gives it whole, its formula said', async () => {
    const { maths, finishLoading } = typesetter();
    const { said, shown } = start({ maths });
    await tick(1_000);
    expect(new Set(shown())).toEqual(new Set(['beat-0', 'beat-1']));
    expect(said.map(item => item.id)).toEqual(['beat-0', 'beat-1']);
    finishLoading();
    await tick(100);
    expect(new Set(shown())).toEqual(new Set(['beat-0', 'beat-1', 'beat-2', 'beat-3']));
    await tick(10_000);
    expect(said.find(item => item.id === 'beat-2').text).toBe('The energy is E nought equals one half h bar omega, at rest.');
  });

  it('gives the passage with its plain reading once it has waited long enough', async () => {
    const { maths } = typesetter();
    const { shown } = start({ maths });
    await tick(1_000);
    expect(shown()).not.toContain('beat-2');
    await tick(RUNTIME_LIMITS.mathWaitMs);
    expect(shown()).toContain('beat-2');
  });
});
