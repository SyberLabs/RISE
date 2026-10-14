import { describe, expect, it } from 'vitest';
import { ILLUSTRATOR_EXAMPLES, ILLUSTRATOR_INSTRUCTIONS } from '../../src/live/adapters/openai-instructions.js';
import { validateRiseCurrent } from '../../src/core/rise-current.js';
import { illustrate } from './illustrate.js';

const MODEL = 'claude-sonnet-5-5';
const period = { from: '2026-10-12T09:00:00.000Z', to: '2026-10-19T09:00:00.000Z' };
const pulls = [{ number: 652, title: 'The swarm', body: 'The swarm draws 700 particles at 60 ticks a second.' }];

const current = () => ({
  schema: 'rise.current.v2', id: 'week', title: 'What changed in RISE', theme: 'cobalt',
  origin: { kind: 'model', name: MODEL, provider: 'Anthropic, via Claude Code' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [
    { say: 'This week RISE Live changed.', scene: 'field' },
    { say: 'The swarm draws 700 particles.' },
    { say: 'At 60 ticks a second.' },
    { say: 'Sophia holds every visual in a frame.' },
    { say: 'That is the week.' }
  ]
});
const brief = 'A labelled diagram of the swarm: 700 particles, 60 ticks a second.';
const figure = inner => ['@scene picture svg', '```svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" fill="currentColor" font-size="20">${inner}</svg>`, '```'].join('\n');
const good = figure('<text x="40" y="60">700 particles</text>');

function scriptedAsk(answers) {
  const calls = [];
  const ask = async request => {
    calls.push(request);
    const next = answers.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error('unexpected ask');
    return next;
  };
  return { ask, calls };
}

const run = (ask, pictures, lines = []) => illustrate({ ask, model: MODEL, current: current(), pictures, pulls, period, log: line => lines.push(line) });

describe('illustrate', () => {
  it('teaches the illustrator with RISE Live’s own instructions, the digest’s dark ground and phone-sized labels', async () => {
    const { ask, calls } = scriptedAsk([good]);
    await run(ask, [{ beat: 1, medium: 'figure', brief }]);
    expect(calls[0].model).toBe(MODEL);
    expect(calls[0].system).toContain(ILLUSTRATOR_INSTRUCTIONS);
    expect(calls[0].system).toMatch(/dark/i);
    expect(calls[0].system).toMatch(/390/);
    expect(calls[0].prompt).toContain(brief);
    expect(calls[0].prompt).toContain('The swarm draws 700 particles.');
  });

  it('puts an admitted figure on the beat its brief names', async () => {
    const { ask } = scriptedAsk([good]);
    const { current: drawn, notes } = await run(ask, [{ beat: 1, medium: 'figure', brief }]);
    expect(notes).toEqual([]);
    expect(drawn.scenes.at(-1)).toMatchObject({ id: 'picture-1' });
    expect(drawn.scenes.at(-1).svg).toContain('700 particles');
    expect(drawn.beats[1].scene).toBe('picture-1');
    expect(() => validateRiseCurrent(drawn)).not.toThrow();
  });

  it('draws a code scene when the brief asks for motion', async () => {
    const { ask } = scriptedAsk([ILLUSTRATOR_EXAMPLES[1]]);
    const { current: drawn } = await run(ask, [{ beat: 3, medium: 'scene', brief: 'An animation of the shutter opening into the inner eye.' }]);
    expect(drawn.scenes.at(-1).code).toContain('export default function scene');
    expect(drawn.beats[3].scene).toBe('picture-1');
  });

  it('repairs a refused figure from the admission’s diagnostics', async () => {
    const { ask, calls } = scriptedAsk([figure('<script>alert(1)</script>'), good]);
    const { current: drawn, notes } = await run(ask, [{ beat: 1, medium: 'figure', brief }]);
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toMatch(/Attempt 2 of 3/);
    expect(calls[1].prompt).toMatch(/<script> is not an element a figure may use/);
    expect(drawn.beats[1].scene).toBe('picture-1');
    expect(notes).toEqual([]);
  });

  it('holds every figure to the number rule, and repairs a number no pull request states', async () => {
    const { ask, calls } = scriptedAsk([figure('<text x="40" y="60">40% faster</text>'), good]);
    const { current: drawn } = await run(ask, [{ beat: 1, medium: 'figure', brief }]);
    expect(calls[1].prompt).toMatch(/['"]40['"], which no included pull request states/);
    expect(drawn.scenes.at(-1).svg).not.toContain('40%');
  });

  it('keeps the scene before when a picture is still refused, says so, and draws the rest', async () => {
    const bad = figure('<script>alert(1)</script>');
    const { ask, calls } = scriptedAsk([bad, bad, bad, good]);
    const lines = [];
    const { current: drawn, notes } = await run(ask, [{ beat: 1, medium: 'figure', brief }, { beat: 3, medium: 'figure', brief: 'A labelled diagram of the three frames Sophia holds.' }], lines);
    expect(calls).toHaveLength(4);
    expect(drawn.beats[1].scene).toBeUndefined();
    expect(drawn.beats[3].scene).toBe('picture-2');
    expect(drawn.scenes.map(scene => scene.id)).toEqual(['field', 'picture-2']);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/beat 1.*not drawn.*keeps the scene before it/);
    expect(lines.join('\n')).toMatch(/beat 1.*not drawn/);
    expect(() => validateRiseCurrent(drawn)).not.toThrow();
  });

  it('keeps the scene before when the model call itself fails', async () => {
    const { ask } = scriptedAsk([new Error('The CLI exited with 1')]);
    const { current: drawn, notes } = await run(ask, [{ beat: 1, medium: 'figure', brief }]);
    expect(drawn.beats[1].scene).toBeUndefined();
    expect(notes[0]).toMatch(/beat 1/);
  });
});
