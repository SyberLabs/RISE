/**
 * A host is told every journal entry as it is written, and the voice's hold
 * and release are among them: the trace a reader copies from DevTools must
 * show where the voice was held, where it took up again, and why the clock
 * stood down, or a field report of "they fell out of sync" has nothing to go on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createFakeMcpPort } from '../test/fake-mcp-port.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { createLiveRuntime } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { createBrowserVoice } from './voices/browser.js';
import { createFakeSpeech } from '../test/fake-speech.js';

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [{ say: 'Sunlight carries every colour at once, and the sky takes the blue.', scene: 'field' }, { say: 'So blue reaches your eye.' }]
};

let runtime;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});
afterEach(async () => {
  await runtime?.stop();
  runtime = null;
  vi.useRealTimers();
});

describe('the journal as it is written', () => {
  it('reaches onNote entry by entry, and says when the voice is held and released', async () => {
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const notes = [];
    let player = null;
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => createSyntheticVoice({ clock, msPerChar: 10, breathMs: 50 }) },
      createPlayer: session => { player = new Player(session); return player; },
      host: { present() {}, dismiss() {} },
      onNote: entry => notes.push(entry)
    });
    const started = runtime.start('Why is the sky blue?');
    port.answer(V2, 10);
    await vi.advanceTimersByTimeAsync(600);
    await started;
    expect(notes.map(entry => entry.type)).toEqual(runtime.journal().map(entry => entry.type));
    expect(notes.some(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-0')).toBe(true);

    runtime.hold();
    await vi.advanceTimersByTimeAsync(50);
    const held = notes.find(entry => entry.type === 'voice.held');
    expect(held).toMatchObject({ role: 'main', segmentId: 'beat-0' });
    expect(typeof held.restarts).toBe('boolean');

    runtime.resume();
    await vi.advanceTimersByTimeAsync(50);
    expect(notes.find(entry => entry.type === 'voice.released')).toMatchObject({ role: 'main' });
    // What a listener is given is its own copy: the journal is not written through it.
    held.type = 'tampered';
    expect(runtime.journal().some(entry => entry.type === 'tampered')).toBe(false);
  });

  it('says once which voice the reading is spoken in, before it says anything', async () => {
    const clock = createRealClock();
    const port = createFakeMcpPort({ clock, answerAfterMs: 10 });
    const adapter = createMcpAppAdapter({ port, clock, host: 'https://host.example' });
    const synth = createFakeSpeech(clock, { msPerChar: 10, boundaries: false });
    const google = { name: 'Google US English', lang: 'en-US', localService: false };
    runtime = createLiveRuntime({
      adapter, clock, voices: { create: () => createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock, voice: google }) },
      createPlayer: session => new Player(session),
      host: { present() {}, dismiss() {} }
    });
    const started = runtime.start('Why is the sky blue?');
    port.answer(V2, 10);
    await vi.advanceTimersByTimeAsync(600);
    await started;
    const journal = runtime.journal();
    const chosen = journal.filter(entry => entry.type === 'voice.chosen');
    expect(chosen).toEqual([expect.objectContaining({ role: 'main', kind: 'browser', name: 'Google US English', local: false })]);
    expect(journal.indexOf(chosen[0])).toBeLessThan(journal.findIndex(entry => entry.type === 'speech.start'));
  });
});
