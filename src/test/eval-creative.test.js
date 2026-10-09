/**
 * The Creative Control evaluation (scripts/eval-creative.mjs) is only worth
 * running if it cannot pass a Current that RISE would refuse or a scene that
 * would fail in the card. So: it is shown refusing what the Worker refuses,
 * catching a scene that throws on a frame or on a cue, counting the cues a
 * scene answers, and holding reduced motion; and the corpus is shown to carry
 * every worked Current the guide teaches, unchanged, and to pass.
 */
import { describe, expect, it } from 'vitest';
import { evaluateCurrent, loadCorpus } from '../../scripts/eval-creative.mjs';
import { RISE_CURRENT_STYLES } from '../core/rise-current.js';
import { STYLE_EXAMPLES } from '../live/guide/index.js';

const ORIGIN = { kind: 'model', name: 'Test', provider: 'Test' };
const withScene = (code, beats) => ({
  schema: 'rise.current.v2', id: 'probe', title: 'Probe', style: 'premium-educational', origin: ORIGIN,
  scenes: [{ id: 'probe', code }],
  beats: beats ?? [{ say: 'Watch.', scene: 'probe', cue: 'go' }, { hold: { ms: 1000 } }]
});
const TWEENING = "export default function scene(rise) { const s = { x: 0 }; return { frame() { rise.lib.clear(); }, cue(name, { instant }) { if (name === 'go') return rise.lib.tween(s, { x: 1 }, { ms: 500, instant }); } }; }";

describe('a Current RISE accepts', () => {
  it('is run headless: frames drawn, every cue answered when seeking, playing and in reduced motion, and timed', async () => {
    const report = await evaluateCurrent(withScene(TWEENING));
    expect(report.accepted).toBe(true);
    expect(report.ok).toBe(true);
    const [scene] = report.scenes;
    expect(scene).toMatchObject({ id: 'probe', kind: 'code', errors: [], cues: ['go'], reducedMotionSettled: true });
    // Seeking, playing and reduced motion each answer the one cue.
    expect(scene.cuesHandled).toBe(3);
    expect(scene.frames).toBeGreaterThan(60);
    expect(scene.slowestMs).toBeGreaterThanOrEqual(0);
    expect(scene.overSoft).toBeGreaterThanOrEqual(0);
  });

  it('says a native scene is checked against its engine and not drawn', async () => {
    const report = await evaluateCurrent({ ...withScene(TWEENING), scenes: [{ id: 'probe', engine: 'attractor' }], beats: [{ say: 'Watch.', scene: 'probe', cue: 'calm' }] });
    expect(report.ok).toBe(true);
    expect(report.scenes).toEqual([{ id: 'probe', kind: 'native', engine: 'attractor' }]);
  });
});

describe('what it does not pass', () => {
  it('a Current the validator refuses, with the Worker’s words', async () => {
    const report = await evaluateCurrent({ ...withScene(TWEENING), style: 'baroque' });
    expect(report).toMatchObject({ accepted: false, ok: false, scenes: [] });
    expect(report.refusal).toMatch(/RISE refused this Current: .*style/u);
  });

  it('a scene the admission refuses, with its line and column', async () => {
    const report = await evaluateCurrent(withScene('export default function scene(rise) { fetch(1); return { frame() {} }; }'));
    expect(report.accepted).toBe(false);
    expect(report.refusal).toMatch(/Scene "probe" was refused: line 1, column \d+: `fetch`/u);
  });

  it('a scene that throws on a frame', async () => {
    const report = await evaluateCurrent(withScene("export default function scene(rise) { return { frame(t) { if (t > 100) throw new TypeError('lost'); } }; }"));
    expect(report.ok).toBe(false);
    expect(report.scenes[0].errors[0]).toMatchObject({ phase: 'frame', message: 'TypeError: lost' });
  });

  it('a scene that throws on a cue, or whose tween fails later', async () => {
    const thrown = await evaluateCurrent(withScene("export default function scene(rise) { return { frame() {}, cue() { throw new RangeError('no'); } }; }"));
    expect(thrown.ok).toBe(false);
    expect(thrown.scenes[0].errors[0]).toMatchObject({ phase: 'cue', message: 'RangeError: no' });
    const rejected = await evaluateCurrent(withScene("export default function scene(rise) { return { frame() {}, cue() { return Promise.reject(new Error('later')); } }; }"));
    expect(rejected.ok).toBe(false);
    expect(rejected.scenes[0].errors[0]).toMatchObject({ phase: 'cue', message: 'Error: later' });
  });

  it('a scene that never says it is ready', async () => {
    const report = await evaluateCurrent(withScene('export default function scene(rise) { return {}; }'));
    expect(report.ok).toBe(false);
    expect(report.scenes[0].errors[0].phase).toBe('init');
  });
});

describe('the corpus', () => {
  const corpus = loadCorpus();

  it('has at least three cases per style, each a prompt and a Current in that style', () => {
    for (const style of RISE_CURRENT_STYLES) {
      const cases = corpus.filter(item => item.style === style);
      expect(cases.length, style).toBeGreaterThanOrEqual(3);
      for (const { prompt, current } of cases) {
        expect(typeof prompt).toBe('string');
        expect(current.style).toBe(style);
      }
    }
  });

  it('carries every worked Current the guide teaches, unchanged', () => {
    for (const style of RISE_CURRENT_STYLES) {
      for (const example of STYLE_EXAMPLES[style]) {
        const copy = JSON.parse(JSON.stringify(example));
        expect(corpus.some(item => item.style === style && JSON.stringify({ prompt: item.prompt, current: item.current }) === JSON.stringify(copy)), example.current.id).toBe(true);
      }
    }
  });

  it('has a code scene drawn with axes, a plot, a vector and tweens, cued from its beats', () => {
    const drawn = corpus.flatMap(item => item.current.scenes ?? []).filter(scene => typeof scene.code === 'string');
    expect(drawn.some(({ code }) => ['lib.axes', 'lib.plot', 'lib.vector', 'lib.tween'].every(call => code.includes(call)))).toBe(true);
  });

  it('lays one quiet bed under every Premium Educational lesson, on its first beat and nowhere else', () => {
    for (const { file, current } of corpus.filter(item => item.style === 'premium-educational')) {
      const sounded = current.beats.map((beat, index) => [index, beat.sound]).filter(([, sound]) => sound !== undefined);
      expect(sounded, file).toEqual([[0, expect.stringMatching(/^(starlight|aurora)$/u)]]);
    }
  });

  it('passes, every case', async () => {
    for (const item of corpus) {
      const report = await evaluateCurrent(item.current);
      expect(report.ok, `${item.file}: ${report.refusal ?? JSON.stringify(report.scenes.flatMap(scene => scene.errors ?? []))}`).toBe(true);
    }
  });
});
