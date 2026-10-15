import { describe, expect, it } from 'vitest';
import { ILLUSTRATOR_EXAMPLES, ILLUSTRATOR_INSTRUCTIONS } from '../../src/live/adapters/openai-instructions.js';
import { validateRiseCurrent } from '../../src/core/rise-current.js';
import { renderFigure } from '../../src/core/figures/figure-kit.js';
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
    expect(calls[0].system).toMatch(/clear of every other label/);
    expect(calls[0].system).toMatch(/only where the brief says/);
    expect(calls[0].system).toMatch(/A chart or a diagram the brief asks for is drawn as asked/);
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

  it('lets go of a cue the beat gave the scene a picture replaces, figure or code', async () => {
    for (const [answer, medium] of [[good, 'figure'], [ILLUSTRATOR_EXAMPLES[1], 'scene']]) {
      const cued = current();
      cued.beats[1] = { ...cued.beats[1], cue: 'calm' };
      const { ask } = scriptedAsk([answer]);
      const { current: drawn } = await illustrate({ ask, model: MODEL, current: cued, pictures: [{ beat: 1, medium, brief }], pulls, period, log: () => {} });
      expect(drawn.beats[1].scene).toBe('picture-1');
      expect(drawn.beats[1]).not.toHaveProperty('cue');
      expect(() => validateRiseCurrent(drawn)).not.toThrow();
    }
  });

  it('illustrates a Current that declares no scenes', async () => {
    const bare = current();
    delete bare.scenes;
    delete bare.beats[0].scene;
    const { ask } = scriptedAsk([good]);
    const { current: drawn } = await illustrate({ ask, model: MODEL, current: bare, pictures: [{ beat: 0, medium: 'figure', brief }], pulls, period, log: () => {} });
    expect(drawn.scenes.map(scene => scene.id)).toEqual(['picture-1']);
    expect(drawn.beats[0].scene).toBe('picture-1');
  });

  it('holds a code scene’s labels to the number rule, but not its colours', async () => {
    const code = label => ['@scene picture code', '```js', 'export default function scene(rise) {', '  const { lib } = rise;', '  return {', '    frame() {', "      lib.clear('#0b0d12');", `      lib.label('${label}', { at: [40, 60], color: lib.color('accent', 0.8) });`, '    }', '  };', '}', '```'].join('\n');
    const { ask, calls } = scriptedAsk([code('40% faster'), code('700 particles')]);
    const { current: drawn } = await run(ask, [{ beat: 1, medium: 'scene', brief: 'An animation of the swarm of 700 particles.' }]);
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toMatch(/['"]40['"], which no included pull request states/);
    expect(drawn.scenes.at(-1).code).toContain('700 particles');
  });

  describe('the layout of a figure', () => {
    const recorder = () => {
      const fired = [];
      const repaired = [];
      return { fired, repaired, tally: { fired: (rule, count = 1) => fired.push([rule, count]), repaired: stage => repaired.push(stage) } };
    };
    const crossing = figure('<rect x="100" y="100" width="120" height="60" fill="none" stroke="currentColor" stroke-width="2"/><text x="160" y="137" text-anchor="middle">700 particles and more</text>');
    const moved = figure('<text x="40" y="100">700 particles</text>');
    const overlap = { rule: 'rendered-overlap', message: 'at 390 pixels wide, the text "700 particles" overlaps the text "60 ticks"' };

    it('refuses a figure whose label crosses a box, and repairs it within the same attempts', async () => {
      const { ask, calls } = scriptedAsk([crossing, good]);
      const { fired, repaired, tally } = recorder();
      const { current: drawn, notes } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 1, medium: 'figure', brief }], pulls, period, log: () => {}, tally });
      expect(calls).toHaveLength(2);
      expect(calls[1].prompt).toMatch(/- line 1 \(text-crosses-shape\): the text '700 particles and more' at x 160, y 137 crosses the edge of the <rect>/);
      expect(drawn.beats[1].scene).toBe('picture-1');
      expect(notes).toEqual([]);
      expect(fired).toEqual([['text-crosses-shape', 1]]);
      expect(repaired).toEqual(['illustrator']);
    });

    it('sends a figure the rendered check finds fault with back once, with its source, and keeps the repair', async () => {
      const { ask, calls } = scriptedAsk([good, moved]);
      const { fired, repaired, tally } = recorder();
      const rendered = [];
      const renderCheck = async svg => { rendered.push(svg); return { problems: rendered.length === 1 ? [overlap] : [], ms: 5 }; };
      const { current: drawn, notes } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 1, medium: 'figure', brief }], pulls, period, log: () => {}, tally, renderCheck });
      expect(calls).toHaveLength(2);
      expect(calls[1].prompt).toMatch(/RISE refused the last picture/);
      expect(calls[1].prompt).toMatch(/\(rendered-overlap\): at 390 pixels wide, the text '700 particles' overlaps/);
      expect(calls[1].prompt).toContain('<text x="40" y="60">700 particles</text>');
      expect(rendered).toHaveLength(2);
      expect(drawn.scenes.at(-1).svg).toContain('y="100"');
      expect(notes).toEqual([]);
      expect(fired).toEqual([['rendered-overlap', 1]]);
      expect(repaired).toEqual(['illustrator']);
    });

    it('lets the picture go when the rendered fault outlasts its one repair, and says why', async () => {
      const { ask, calls } = scriptedAsk([good, moved]);
      const lines = [];
      const renderCheck = async () => ({ problems: [overlap], ms: 5 });
      const { current: drawn, notes } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 1, medium: 'figure', brief }], pulls, period, log: line => lines.push(line), renderCheck });
      expect(calls).toHaveLength(2);
      expect(drawn.beats[1].scene).toBeUndefined();
      expect(notes).toEqual([`The picture for beat 1 (“${brief}”) was not drawn: its labels still failed the rendered check after a repair (rendered-overlap); the beat keeps the scene before it.`]);
      expect(lines.join('\n')).toMatch(/picture for beat 1: rendered check in 5 ms: rendered-overlap/);
    });

    it('renders figures only: a code scene has no text to measure', async () => {
      const { ask } = scriptedAsk([ILLUSTRATOR_EXAMPLES[1]]);
      const renderCheck = async () => { throw new Error('a code scene was rendered'); };
      const { current: drawn } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 3, medium: 'scene', brief: 'An animation of the shutter opening into the inner eye.' }], pulls, period, log: () => {}, renderCheck });
      expect(drawn.beats[3].scene).toBe('picture-1');
    });
  });

  describe('kit figures', () => {
    const bars = { kind: 'bars', title: 'Particles', max: 700, items: [{ label: 'Ticks', value: 60 }, { label: 'Particles', value: 700, changed: true }] };

    it('draws a kit figure with RISE’s own code, in the reading’s theme, asking no model', async () => {
      const { ask, calls } = scriptedAsk([]);
      const tally = { fired: () => {}, repaired: () => { throw new Error('no repair'); } };
      const lines = [];
      const { current: drawn, notes } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 1, kit: bars }], pulls, period, log: line => lines.push(line), tally });
      expect(calls).toHaveLength(0);
      expect(notes).toEqual([]);
      expect(drawn.scenes.at(-1)).toEqual({ id: 'picture-1', svg: renderFigure(bars, { theme: 'cobalt' }) });
      expect(drawn.beats[1].scene).toBe('picture-1');
      expect(lines.join('\n')).toMatch(/picture for beat 1: a kit bars figure/);
      expect(() => validateRiseCurrent(drawn)).not.toThrow();
    });

    it('draws kit and bespoke pictures in beat order', async () => {
      const { ask, calls } = scriptedAsk([good]);
      const { current: drawn } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 3, medium: 'figure', brief }, { beat: 1, kit: bars }], pulls, period, log: () => {} });
      expect(calls).toHaveLength(1);
      expect(drawn.beats[1].scene).toBe('picture-1');
      expect(drawn.beats[3].scene).toBe('picture-2');
    });

    it('renders a kit figure too, and lets one go that the rendered check finds fault with, since no model can repair it', async () => {
      const { ask, calls } = scriptedAsk([]);
      const fired = [];
      const renderCheck = async () => ({ problems: [{ rule: 'rendered-overlap', message: 'two labels meet' }], ms: 4 });
      const { current: drawn, notes } = await illustrate({ ask, model: MODEL, current: current(), pictures: [{ beat: 1, kit: bars }], pulls, period, log: () => {}, tally: { fired: rule => fired.push(rule), repaired() {} }, renderCheck });
      expect(calls).toHaveLength(0);
      expect(drawn.beats[1].scene).toBeUndefined();
      expect(fired).toContain('rendered-overlap');
      expect(notes).toEqual(['The kit bars figure for beat 1 (“Particles”) was not drawn: its labels failed the rendered check (rendered-overlap); the beat keeps the scene before it.']);
    });
  });
});
