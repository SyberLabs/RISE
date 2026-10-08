/**
 * A sealed Current that validates but will not compile fails in the
 * compiler's own words. The run's closing line ("Nothing was said") is for a
 * Current with nothing in it, never a cover for an earlier failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createFakeMcpPort } from '../test/fake-mcp-port.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { createLiveRuntime } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import * as riseCurrent from '../core/rise-current.js';

vi.mock('../core/rise-current.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, compileRiseCurrent: vi.fn(actual.compileRiseCurrent) };
});

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [{ say: 'Sunlight carries every colour.', scene: 'field' }, { hold: { ms: 1000 } }, { say: 'So blue reaches your eye.' }]
};

let runtime;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});
afterEach(async () => {
  await runtime?.stop();
  runtime = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a Current the compiler refuses', () => {
  it('fails with the compiler’s message, not "Nothing was said"', async () => {
    // The compiler refuses this Current every time it is asked, as a real limit would.
    riseCurrent.compileRiseCurrent.mockImplementation(() => {
      throw Object.assign(new Error('A movement track accepts at most 16 clips'), { code: 'EXPERIENCE_PROGRAM_INVALID' });
    });
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => createSyntheticVoice({ clock, msPerChar: 10, breathMs: 50 }) },
      createPlayer: session => new Player(session),
      host: { present() {}, dismiss() {} }
    });
    const started = runtime.start('Why is the sky blue?');
    port.answer(V2, 10);
    await vi.advanceTimersByTimeAsync(200);
    await started.catch(() => {});
    expect(riseCurrent.compileRiseCurrent).toHaveBeenCalled();
    expect(runtime.status).toBe('failed');
    const { error } = runtime.snapshot();
    expect(error.message).toMatch(/movement track/u);
    expect(error.message).not.toMatch(/Nothing was said/u);
  });
});
