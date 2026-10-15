import { describe, expect, it } from 'vitest';
import { admitComposition, figureNumberProblems, parseModelJson } from './admit.js';

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
const PICTURE = { beat: 1, refs: [652], medium: 'figure', brief: 'A labelled diagram of the swarm: 700 particles riding the attractor.' };
const text = (value) => JSON.stringify(value);
/**
 * The composer's answer from a test's shorthand: `sources` becomes each beat's own `refs`, and an answer that names
 * no pictures is given one.
 */
const answer = value => {
  if (!value || typeof value !== 'object' || !('current' in value) || !('sources' in value)) return value;
  const { sources, ...rest } = value;
  if (!Array.isArray(value.current?.beats)) return { pictures: [PICTURE], current: value.current };
  const beatsWithRefs = value.current.beats.map((beat, i) => (Object.hasOwn(sources, i) ? { ...beat, refs: sources[i] } : beat));
  return { pictures: [PICTURE], ...rest, current: { ...value.current, beats: beatsWithRefs } };
};
const admit = (value, options = {}) => admitComposition(typeof value === 'string' ? value : text(answer(value)), { pulls, model: MODEL, period, ...options });

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

  it('refuses an answer that is not the {current, pictures} object', () => {
    expect(admit('not json').diagnostics[0]).toMatch(/one JSON object/);
    expect(admit({ current: current(beats) }).diagnostics[0]).toMatch(/"current" and "pictures"/);
    expect(admit({ current: current(beats), pictures: [PICTURE], note: 'x' }).diagnostics[0]).toMatch(/"current" and "pictures"/);
    expect(admit({ current: current(beats), pictures: [PICTURE], extra: {} }).diagnostics[0]).toMatch(/"current" and "pictures"/);
  });

  it('derives the sources from each beat’s refs, and plays a Current without them', () => {
    const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [653] } });
    expect(verdict.sources).toEqual({ 1: [652], 2: [653] });
    expect(verdict.current.beats.some(beat => 'refs' in beat)).toBe(false);
  });

  it('returns the admitted pictures with the Current', () => {
    const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [653] } });
    expect(verdict.pictures).toEqual([PICTURE]);
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

  it('refuses a figure or a code scene the composer draws itself: a picture is a brief the illustrator draws', () => {
    for (const scene of [{ id: 'bad', code: 'export default function scene(rise) {\n  return { frame() {} };\n}' }, { id: 'bad', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>' }]) {
      const verdict = admit({ current: current([{ say: 'This week.', scene: 'bad' }, ...beats.slice(1)], { scenes: [scene] }), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/Scene "bad" .*"pictures"/);
    }
  });

  it('refuses a Current over the connector’s size bound', () => {
    const long = Array.from({ length: 20 }, () => ({ say: 'word '.repeat(700).trim().slice(0, 3999) }));
    const verdict = admit({ current: current([...beats, ...long]), sources: { 1: [652], 2: [653] } });
    expect(verdict.diagnostics.join('\n')).toMatch(/byte/);
  });

  describe('refs', () => {
    const cases = [
      ['a number that is not included', { 1: [652, 999], 2: [653] }, /beat 1 "refs" cites #999, which is not one of the included pull requests/],
      ['a repeated number in one beat', { 1: [652, 652], 2: [653] }, /twice/],
      ['a list that is not numbers', { 1: ['652'], 2: [653] }, /beat 1 "refs" must list one or more pull request numbers/],
      ['refs that are not a list', { 1: 652, 2: [653] }, /beat 1 "refs" must list one or more pull request numbers/]
    ];
    for (const [name, sources, pattern] of cases) {
      it(`refuses ${name}`, () => {
        const verdict = admit({ current: current(beats), sources });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(pattern);
        expect(verdict.rules).toHaveProperty('refs');
      });
    }

    it('lets an included change no beat cites go unspoken, rather than refusing the reading', () => {
      const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [652] } });
      expect(verdict.ok).toBe(true);
      expect(verdict.unspoken).toEqual([653]);
      expect(verdict.sources).toEqual({ 1: [652], 2: [652] });
    });

    it('lets a beat that only opens, holds or closes carry no refs, or empty ones', () => {
      expect(admit({ current: current(beats), sources: { 0: [], 1: [652], 2: [653] } }).ok).toBe(true);
    });
  });

  describe('numbers', () => {
    it('refuses a number that no included pull request states', () => {
      const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'It is 40 percent faster.' }]), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"40"/);
    });

    it('refuses a number written in a figure’s visible text', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">40%</text></svg>';
      expect(figureNumberProblems(svg, { pulls, period }).join('\n')).toMatch(/"40"/);
    });

    it('does not read a figure’s style sheet or comments as text it shows', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><!-- draft 3 --><style>text { stroke-width: 3; }</style><text x="120" y="240">700 particles</text></svg>';
      expect(figureNumberProblems(svg, { pulls, period })).toEqual([]);
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
  describe('process talk', () => {
    it('refuses a beat that speaks of how the reading was made, naming the phrase and the beat', () => {
      const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'Whether it holds will show in the next dry run.' }]), sources: { 1: [652], 2: [653] } });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics).toEqual([
        'beat 2 says "will show in", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out',
        'beat 2 says "dry run", which speaks of how this reading was made, not of what changed; say what changed, or leave the sentence out'
      ]);
      expect(verdict.rules).toEqual({ 'process-talk': 2 });
    });

    it('lets a phrase stand that an included pull request says', () => {
      const own = [pull(652, 'The swarm draws 700 particles. The pipeline moved.'), pull(653, 'Three frames.')];
      const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'The pipeline moved.' }]), sources: { 1: [652], 2: [653] } }, { pulls: own });
      expect(verdict.ok).toBe(true);
    });
  });

  it('counts each rule a refusal fired, for the run’s first-pass score', () => {
    const verdict = admit({ current: current([...beats.slice(0, 2), { say: 'It is 40 percent faster, the next dry run will tell.' }]), sources: { 1: [652] } });
    expect(verdict.rules).toEqual({ number: 1, 'process-talk': 2 });
    expect(admit('not json').rules).toEqual({ answer: 1 });
  });


  describe('composition', () => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    const nine = Array.from({ length: 9 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : i === 4 ? 'Sophia holds every visual in a frame.' : `Beat ${words[i]}.` }));
    const withScene = (list, at, scene) => list.map((beat, i) => (i === at ? { ...beat, scene } : beat));
    /** Beat 4 speaks of #653, every other beat but the opening of #652; a picture cites what its beat speaks of. */
    const refsOf = beat => (beat === 4 ? [653] : [652]);
    const sources = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, refsOf(i + 1)]));
    const picture = (beat, medium = 'figure') => ({ beat, refs: refsOf(beat), medium, brief: `A labelled diagram for beat ${words[beat] ?? 'later'}, drawn from the pull request’s own words.` });
    const kit = (beat, spec = { kind: 'flow', steps: ['Before', 'After'], changed: 'After' }) => ({ beat, refs: refsOf(beat), kit: spec });

    it('refuses one scene held through the whole reading, with no picture', () => {
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [] });
      expect(verdict.ok).toBe(false);
      const said = verdict.diagnostics.join('\n');
      expect(said).toMatch(/at least one picture/);
      expect(said).toMatch(/beat 0 holds one scene for 9 beats/);
    });

    it('accepts an opening engine and a picture for each group', () => {
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1), picture(4), picture(7, 'scene')] });
      expect(verdict.diagnostics).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });

    it('refuses more than two of RISE’s engines', () => {
      const scenes = [{ id: 'a', engine: 'attractor' }, { id: 'b', engine: 'living-flame' }, { id: 'c', engine: 'genesis' }];
      const list = withScene(withScene(withScene(nine, 0, 'a'), 1, 'b'), 8, 'c');
      const verdict = admit({ current: current(list, { scenes }), sources, pictures: [picture(3), picture(6)] });
      expect(verdict.diagnostics.join('\n')).toMatch(/at most 2 of RISE’s engines/);
    });

    it('refuses an engine started in the middle of the reading, where a picture should explain', () => {
      const scenes = [{ id: 'field', engine: 'attractor' }, { id: 'flame', engine: 'living-flame' }];
      const list = withScene(withScene(nine, 0, 'field'), 4, 'flame');
      const verdict = admit({ current: current(list, { scenes }), sources, pictures: [picture(2), picture(7)] });
      expect(verdict.diagnostics.join('\n')).toMatch(/beat 4 starts RISE’s engine "flame".*opening or the close/);
    });

    it('refuses a scene held for more than four beats', () => {
      const same = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, [652]]));
      same[8] = [652, 653];
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources: same, pictures: [{ ...kit(1), refs: [652] }, { ...kit(4), refs: [652] }] });
      expect(verdict.diagnostics.join('\n')).toMatch(/beat 4 holds one scene for 5 beats/);
    });

    it('counts only the beats a picture is shown under: where its beats move on, RISE\u2019s eye holds, and is counted too', () => {
      const moved = { 1: [652], 2: [653], 3: [653], 4: [653], 5: [653], 6: [653], 7: [653], 8: [653] };
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources: moved, pictures: [{ ...kit(1), refs: [652] }] });
      expect(verdict.diagnostics.join('\n')).toMatch(/beat 2 holds one scene for 7 beats/);
      const fine = admit({ current: current(withScene(nine, 0, 'field')), sources: moved, pictures: [{ ...kit(1), refs: [652] }, { ...kit(5), refs: [653] }] });
      expect(fine.diagnostics).toBeUndefined();
    });

    it('refuses a malformed picture list', () => {
      const cases = [
        [[{ ...picture(1), beat: 9 }, picture(4), kit(7)], /beat 9/],
        [[picture(1), kit(1), picture(4), kit(7)], /twice/],
        [[{ ...picture(1), medium: 'cue' }, picture(4), kit(7)], /figure or scene/],
        [[{ ...picture(1), brief: 'x'.repeat(301) }, picture(4), kit(7)], /300/],
        [[{ ...picture(1), note: 'x' }, picture(4), kit(7)], /either \{ beat, refs, kit \} or \{ beat, refs, medium, brief \}/],
        [[{ ...kit(1), brief: 'x'.repeat(30) }, picture(4), kit(7)], /either \{ beat, refs, kit \} or \{ beat, refs, medium, brief \}/],
        [[{ beat: 1, kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }, picture(4), kit(7)], /either \{ beat, refs, kit \}/],
        [[picture(0), kit(4), kit(7)], /beat 0 already starts/]
      ];
      for (const [pictures, pattern] of cases) {
        const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(pattern);
      }
    });

    it('accepts a kit figure, drawn by RISE from the data the composer gives', () => {
      const bars = { kind: 'bars', title: 'Particles', max: 700, items: [{ label: 'Before', value: 60 }, { label: 'After', value: 700, changed: true }] };
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1, bars), kit(4), kit(7)] });
      expect(verdict.ok).toBe(true);
      expect(verdict.pictures[0]).toEqual({ beat: 1, refs: [652], kit: bars });
    });

    it('refuses a kit figure the kit cannot draw, in the kit’s own words', () => {
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1, { kind: 'bars', max: 10, items: [{ label: 'a', value: 1 }] }), kit(4), kit(7)] });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.kit: items has 2 to 4 items/);
      expect(verdict.rules).toHaveProperty('composition');
    });

    it('holds a kit figure’s labels and values to the number rule', () => {
      const bars = { kind: 'bars', max: 100, items: [{ label: 'Before', value: 40 }, { label: 'After', value: 60, changed: true }] };
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1, bars), kit(4), kit(7, { kind: 'flow', steps: ['Step 9', 'Done'] })] });
      const said = verdict.diagnostics.join('\n');
      expect(said).toMatch(/"40"/);
      expect(said).toMatch(/"9"/);
      expect(said).not.toMatch(/"100"/);
    });

    it('refuses more than two pictures for the illustrator: a kit kind draws a measurement, a sequence, a sorting or a layout', () => {
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [picture(1), picture(4), picture(7)] });
      expect(verdict.diagnostics.join('\n')).toMatch(/3 pictures for the illustrator; at most 2/);
    });

    it('refuses a picture that cites a change its beat does not speak of', () => {
      const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [{ ...kit(1), refs: [653] }, kit(4), kit(7)] });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.refs \[653\] are not all among beat 1’s refs \[652\]; a picture shows what its own beat speaks of/);
      expect(verdict.rules).toHaveProperty('composition');
    });

    it('refuses a picture with no refs, or refs that are not pull request numbers', () => {
      for (const refs of [[], ['652'], 652]) {
        const verdict = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [{ ...kit(1), refs }, kit(4), kit(7)] });
        expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.refs lists the pull requests the picture shows/);
      }
    });

    it('holds a picture’s numbers to the pull requests that picture cites, not to the whole week', () => {
      const bars = { kind: 'bars', max: 700, items: [{ label: 'Ticks', value: 60 }, { label: 'Particles', value: 700, changed: true }] };
      expect(admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1, bars), kit(4), kit(7)] }).ok).toBe(true);
      const elsewhere = admit({ current: current(withScene(nine, 0, 'field')), sources, pictures: [kit(1), kit(4, bars), kit(7)] });
      expect(elsewhere.ok).toBe(false);
      expect(elsewhere.diagnostics.join('\n')).toMatch(/"700", which no pull request the picture cites states/);
    });

    it('refuses more pictures than a Current has room for beside its engines', () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : i === 4 ? 'Sophia holds every visual in a frame.' : 'More.' }));
      const pictures = Array.from({ length: 8 }, (_, i) => kit(1 + i * 3));
      const verdict = admit({ current: current(withScene(many, 0, 'field')), sources, pictures });
      expect(verdict.diagnostics.join('\n')).toMatch(/at most 6 pictures beside its 1 engine and RISE\u2019s eye/);
    });

    it('keeps no room for RISE\u2019s eye when no picture ends early', () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : i === 4 ? 'Sophia holds every visual in a frame.' : 'More.' }));
      const all = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 1, i + 1 === 4 ? [652, 653] : [652]]));
      const pictures = Array.from({ length: 7 }, (_, i) => ({ beat: 1 + i * 4, refs: [652], kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }));
      const verdict = admit({ current: current(withScene(many, 0, 'field')), sources: all, pictures });
      expect(verdict.diagnostics ?? []).not.toContainEqual(expect.stringMatching(/room for at most/));
    });
  });
});
