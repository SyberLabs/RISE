import { describe, expect, it } from 'vitest';
import { admitComposition, parseModelJson } from './admit.js';

const MODEL = 'claude-sonnet-5-5';
const period = { from: '2026-10-12T09:00:00.000Z', to: '2026-10-19T09:00:00.000Z' };
const pull = (number, body = '') => ({ number, title: `Change ${number}`, body });
const pulls = [pull(652, 'The swarm draws 700 particles at 60 ticks a second.'), pull(653, 'Three frames.')];

const current = (beats, extra = {}) => ({
  schema: 'rise.current.v2', id: 'week', title: 'What changed in RISE', theme: 'cobalt',
  origin: { kind: 'model', name: MODEL, provider: 'Anthropic, via Claude Code' },
  scenes: [{ id: 'field', engine: 'attractor' }], beats, ...extra
});
const beats = [
  { say: 'This week RISE Live changed.', scene: 'field' },
  { say: 'The swarm draws 700 particles.' },
  { say: 'Sophia holds every visual in a frame.' }
];
const text = (value) => JSON.stringify(value);
const admit = (value, options = {}) => admitComposition(typeof value === 'string' ? value : text(value), { pulls, model: MODEL, period, ...options });

describe('parseModelJson', () => {
  it('reads one JSON object, bare or in one code fence', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('  ```\n{"a":1}\n```  ')).toEqual({ a: 1 });
  });

  it('refuses prose around the object, and anything that is not an object', () => {
    expect(() => parseModelJson('Here it is: {"a":1}')).toThrow();
    expect(() => parseModelJson('[1]')).toThrow();
    expect(() => parseModelJson('')).toThrow();
    expect(() => parseModelJson(null)).toThrow();
  });
});

describe('admitComposition', () => {
  it('admits a valid Current with sources that cite every included pull request', () => {
    const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [653] } });
    expect(verdict.ok).toBe(true);
    expect(verdict.sources).toEqual({ 1: [652], 2: [653] });
    expect(verdict.current.beats).toHaveLength(3);
  });

  it('sets the origin to the composer, whatever the model wrote', () => {
    const verdict = admit({ current: current(beats, { origin: { kind: 'human', name: 'Someone' } }), sources: { 1: [652], 2: [653] } });
    expect(verdict.ok).toBe(true);
    expect(verdict.current.origin).toEqual({ kind: 'model', name: MODEL, provider: 'Anthropic, via Claude Code' });
  });

  it('refuses an answer that is not the {current, sources} object', () => {
    expect(admit('not json').diagnostics[0]).toMatch(/one JSON object/);
    expect(admit({ current: current(beats) }).diagnostics[0]).toMatch(/"current" and "sources"/);
    expect(admit({ current: current(beats), sources: {}, note: 'x' }).diagnostics[0]).toMatch(/"current" and "sources"/);
  });

  it('refuses a v1 Current', () => {
    const v1 = { schema: 'rise.current.v1', id: 'w', title: 'T', origin: { kind: 'model', name: MODEL, provider: 'x' }, segments: [{ id: 'a', text: 'Hello.' }] };
    expect(admit({ current: v1, sources: { 0: [652, 653] } }).diagnostics.join('\n')).toMatch(/rise\.current\.v2/);
  });

  it('refuses what the Current validator refuses, in the connector’s words', () => {
    const verdict = admit({ current: current(beats, { theme: 'plaid' }), sources: { 1: [652], 2: [653] } });
    expect(verdict.ok).toBe(false);
    expect(verdict.diagnostics[0]).toMatch(/^RISE refused this Current: .*theme/);
  });

  it('refuses a refused scene with the scene, the line and the rule', () => {
    const scenes = [{ id: 'bad', code: 'export default function scene(rise) {\n  fetch("x");\n  return { frame() {} };\n}' }];
    const verdict = admit({ current: current([{ say: 'This week.', scene: 'bad' }, ...beats.slice(1)], { scenes }), sources: { 1: [652], 2: [653] } });
    expect(verdict.diagnostics[0]).toMatch(/^Scene "bad" was refused: line 2, column 3: `fetch` is not available to a scene/);
  });

  it('refuses a refused figure', () => {
    const scenes = [{ id: 'fig', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>' }];
    const verdict = admit({ current: current([{ say: 'This week.', scene: 'fig' }, ...beats.slice(1)], { scenes }), sources: { 1: [652], 2: [653] } });
    expect(verdict.diagnostics.join('\n')).toMatch(/^Scene "fig" was refused: .*script/m);
  });

  it('refuses a Current over the connector’s size bound', () => {
    const long = Array.from({ length: 20 }, () => ({ say: 'word '.repeat(700).trim().slice(0, 3999) }));
    const verdict = admit({ current: current([...beats, ...long]), sources: { 1: [652], 2: [653] } });
    expect(verdict.diagnostics.join('\n')).toMatch(/byte/);
  });

  describe('sources', () => {
    const cases = [
      ['a beat index past the last beat', { 3: [652], 2: [653] }, /beat 3/],
      ['a key that is not a beat index', { first: [652], 2: [653] }, /beat index/],
      ['a padded index', { '01': [652], 2: [653] }, /beat index/],
      ['an empty list', { 1: [], 2: [652, 653] }, /pull request numbers/],
      ['a number that is not included', { 1: [652, 999], 2: [653] }, /#999/],
      ['a repeated number in one beat', { 1: [652, 652], 2: [653] }, /twice/],
      ['an included change no beat cites', { 1: [652] }, /#653/],
      ['a list that is not numbers', { 1: ['652'], 2: [653] }, /pull request numbers/]
    ];
    for (const [name, sources, pattern] of cases) {
      it(`refuses ${name}`, () => {
        const verdict = admit({ current: current(beats), sources });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(pattern);
      });
    }

    it('refuses sources that are not an object', () => {
      expect(admit({ current: current(beats), sources: [[652]] }).diagnostics.join('\n')).toMatch(/"sources"/);
    });
  });

  describe('numbers', () => {
    it('refuses a number that no included pull request states', () => {
      const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'It is 40 percent faster.' }]), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"40"/);
    });

    it('refuses a number written in a figure’s visible text', () => {
      const scenes = [{ id: 'fig', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">40%</text></svg>' }];
      const verdict = admit({ current: current([{ say: 'This week.', scene: 'fig' }, ...beats.slice(1)], { scenes }), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"40"/);
    });

    it('accepts numbers a pull request states, and the dates of the period', () => {
      const verdict = admit({ current: current([{ say: 'From 12 to 19 October 2026.', scene: 'field' }, { say: '700 particles, 60 ticks a second.' }, { say: 'Three frames.' }]), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(true);
    });

    it('reads what is shown as well as what is said', () => {
      const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'Faster.', show: 'Now 3x faster.' }]), sources: { 1: [652], 2: [653] } });
      expect(verdict.diagnostics.join('\n')).toMatch(/"3"/);
    });
  });
});
