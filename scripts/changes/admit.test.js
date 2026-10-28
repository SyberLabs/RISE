import { describe, expect, it } from 'vitest';
import { admitComposition, figureNumberProblems, parseModelJson } from './admit.js';

const MODEL = 'claude-sonnet-5-5';
const period = { from: '2026-10-12T09:00:00.000Z', to: '2026-10-19T09:00:00.000Z' };
const pull = (number, body = '') => ({ number, title: `Change ${number}`, body });
const pulls = [pull(652, 'The swarm draws 700 particles at 60 ticks a second.'), pull(653, 'Three frames.')];

const current = (beats, extra = {}) => ({
  schema: 'rise.current.v2', id: 'week', title: 'What changed in RISE', theme: 'cobalt',
  origin: { kind: 'model', name: MODEL, provider: 'Anthropic, via Claude Code' },
  beats, ...extra
});
/** The opening the composer names: RISE places it on the first beat. */
const OPEN = { engine: 'attractor' };
const beats = [
  { say: 'This week RISE Live changed.' },
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

  it('refuses an answer that is not the {current, pictures, opening?, close?} object', () => {
    expect(admit('not json').diagnostics[0]).toMatch(/one JSON object/);
    expect(admit({ current: current(beats) }).diagnostics[0]).toMatch(/"current" and "pictures"/);
    expect(admit({ current: current(beats), pictures: [PICTURE], note: 'x' }).diagnostics[0]).toMatch(/"current" and "pictures"/);
    expect(admit({ current: current(beats), pictures: [PICTURE], extra: {} }).diagnostics[0]).toMatch(/"current" and "pictures"/);
  });

  describe('opening and close', () => {
    const sources = { 1: [652], 2: [653] };
    const ENGINE_RULE = /RISE’s engines open and close a digest; a change is shown with a kit picture/;

    it('places the opening on the first beat and the close on the last, and declares their scenes', () => {
      const verdict = admit({ current: current(beats), sources, opening: OPEN, close: { engine: 'ostensoria', params: { palette: 'ice' } } });
      expect(verdict.ok).toBe(true);
      expect(verdict.current.scenes).toEqual([{ id: 'opening', engine: 'attractor' }, { id: 'close', engine: 'ostensoria', params: { palette: 'ice' } }]);
      expect(verdict.current.beats.map(beat => beat.scene)).toEqual(['opening', undefined, 'close']);
    });

    it('needs neither: a digest may open and close on its pictures alone', () => {
      const verdict = admit({ current: current(beats), sources });
      expect(verdict.ok).toBe(true);
      expect(verdict.current.scenes ?? []).toEqual([]);
    });

    it('refuses a scene in the Current that names an engine, in plain words', () => {
      const list = beats.map((beat, i) => (i === 2 ? { ...beat, scene: 'flame' } : beat));
      const verdict = admit({ current: current(list, { scenes: [{ id: 'flame', engine: 'living-flame' }] }), sources });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics).toHaveLength(1);
      expect(verdict.diagnostics[0]).toMatch(/^Scene "flame" names RISE’s engine "living-flame"/);
      expect(verdict.diagnostics[0]).toMatch(ENGINE_RULE);
      expect(verdict.rules).toEqual({ engine: 1 });
    });

    it('refuses a picture that names an engine, in the same words', () => {
      const verdict = admit({ current: current(beats), sources, pictures: [{ beat: 1, refs: [652], engine: 'attractor' }] });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics[0]).toMatch(/^"pictures"\[0\] names RISE’s engine "attractor"/);
      expect(verdict.diagnostics[0]).toMatch(ENGINE_RULE);
      expect(verdict.rules).toEqual({ engine: 1 });
    });

    it('refuses an opening or close that is not { engine, params? } with one of RISE’s engines', () => {
      for (const [opening, pattern] of [
        ['attractor', /"opening" is \{ "engine", "params"\? \}/],
        [{ engine: 'attractor', at: 0 }, /"opening" is \{ "engine", "params"\? \}/],
        [{ engine: 'plasma' }, /"opening" names "plasma", which is not one of RISE’s engines/]
      ]) {
        const verdict = admit({ current: current(beats), sources, opening });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(pattern);
      }
    });

    it('refuses a picture on the beat the opening or the close shows', () => {
      const verdict = admit({ current: current(beats), sources: { 0: [652], 1: [652], 2: [653] }, opening: OPEN, pictures: [{ ...PICTURE, beat: 0 }] });
      expect(verdict.diagnostics.join('\n')).toMatch(/beat 0 opens with RISE’s engine/);
    });

    it('refuses an opening and a close on a Current of one beat', () => {
      const verdict = admit({ current: current([{ say: 'Three frames.' }]), sources: { 0: [653] }, opening: OPEN, close: OPEN, pictures: [] });
      expect(verdict.diagnostics.join('\n')).toMatch(/one beat has room for an opening or a close, not both/);
    });
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
      const verdict = admit({ current: current([{ say: 'From 12 to 19 October 2026.' }, { say: '700 particles, 60 ticks a second.' }, { say: 'Three frames.' }]), sources: { 1: [652], 2: [653] } });
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
    /** Beat 4 speaks of #653, every other beat but the opening of #652; a picture cites what its beat speaks of. */
    const refsOf = beat => (beat === 4 ? [653] : [652]);
    const sources = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, refsOf(i + 1)]));
    const picture = (beat, medium = 'figure') => ({ beat, refs: refsOf(beat), medium, brief: `A labelled diagram for beat ${words[beat] ?? 'later'}, drawn from the pull request’s own words.` });
    const kit = (beat, spec = { kind: 'flow', steps: ['Before', 'After'], changed: 'After' }) => ({ beat, refs: refsOf(beat), kit: spec });

    it('refuses one scene held through the whole reading, with no picture', () => {
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [] });
      expect(verdict.ok).toBe(false);
      const said = verdict.diagnostics.join('\n');
      expect(said).toMatch(/at least one picture/);
      expect(said).toMatch(/beat 0 holds one scene for 9 beats/);
    });

    it('accepts an opening engine and a picture for each group', () => {
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1), picture(4), picture(7, 'scene')] });
      expect(verdict.diagnostics).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });

    it('holds a picture up to six beats while every beat under it cites what it shows', () => {
      const six = { 1: [652], 2: [652], 3: [652], 4: [652], 5: [652], 6: [652], 7: [653], 8: [653] };
      const verdict = admit({ current: current(nine), opening: OPEN, sources: six, pictures: [{ ...kit(1), refs: [652] }, { ...kit(7), refs: [653] }] });
      expect(verdict.diagnostics).toBeUndefined();
      const seven = { ...six, 7: [652] };
      const held = admit({ current: current(nine), opening: OPEN, sources: seven, pictures: [{ ...kit(1), refs: [652] }, { ...kit(8), refs: [653] }] });
      expect(held.diagnostics.join('\n')).toMatch(/beat 1 holds one picture for 7 beats; a picture is held at most 6 beats while every beat under it cites what it shows/);
    });

    it('holds a picture to four beats when a beat under it cites none of its changes, and an engine to four', () => {
      const gap = { 1: [652], 2: [652], 4: [652], 5: [652], 6: [653], 7: [653], 8: [653] };
      const held = admit({ current: current(nine), opening: OPEN, sources: gap, pictures: [{ ...kit(1), refs: [652] }, { ...kit(6), refs: [653] }] });
      expect(held.diagnostics.join('\n')).toMatch(/beat 1 holds one scene for 5 beats; an engine, or a picture over a beat that cites none of its changes, is held at most 4 beats/);
      const late = admit({ current: current(nine), opening: OPEN, sources: { 5: [652], 6: [652], 7: [653], 8: [653] }, pictures: [{ ...kit(5), refs: [652] }, { ...kit(7), refs: [653] }] });
      expect(late.diagnostics.join('\n')).toMatch(/beat 0 holds one scene for 5 beats; an engine/);
    });

    it('exempts RISE\u2019s eye from the hold limit: it may rest across beats that cite no change', () => {
      const ten = [...nine, { say: 'Beat nine.' }];
      const resting = { 1: [652], 2: [653], 9: [653] };
      const verdict = admit({ current: current(ten), opening: OPEN, sources: resting, pictures: [{ ...kit(1), refs: [652] }, { ...kit(9), refs: [653] }] });
      expect(verdict.diagnostics).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });

    it('counts only the beats a picture is shown under: where its beats move on, the picture\u2019s hold ends', () => {
      const moved = { 1: [652], 2: [652], 3: [652], 4: [652], 5: [652], 6: [652], 7: [652], 8: [653] };
      const held = admit({ current: current(nine), opening: OPEN, sources: moved, pictures: [{ ...kit(1), refs: [652] }] });
      expect(held.diagnostics.join('\n')).toMatch(/beat 1 holds one picture for 7 beats/);
      const ended = { ...moved, 7: [653] };
      expect(admit({ current: current(nine), opening: OPEN, sources: ended, pictures: [{ ...kit(1), refs: [652] }] }).diagnostics).toBeUndefined();
    });

    describe('density', () => {
      const routed = significance => number => ({ ...pull(number, number === 652 ? 'The swarm draws 700 particles at 60 ticks a second.' : 'Three frames.'), route: { audience: 'team', significance, kind: 'feature' } });

      it('refuses more than two speaking beats in a row with no picture of what they speak of, naming the beats and their changes', () => {
        const moved = { 1: [652], 2: [653], 3: [653], 4: [653], 5: [653], 6: [653], 7: [653], 8: [653] };
        const verdict = admit({ current: current(nine), opening: OPEN, sources: moved, pictures: [{ ...kit(1), refs: [652] }] });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(/beats 2 to 8 speak of #653 with no picture of it; at most 2 speaking beats in a row go without one\. Give each theme one picture on its first beat, held across its beats: for a rule or a process change, a list or a compare; for a change to what flows between services, queues and stores, a system/);
        expect(verdict.rules).toEqual({ density: 1 });
      });

      it('admits two speaking beats in a row without a picture, and counts a speaking beat under an engine as one', () => {
        const two = { 1: [652], 2: [652], 3: [653], 4: [653], 5: [652], 6: [652], 7: [652], 8: [653] };
        const verdict = admit({ current: current(nine), opening: OPEN, sources: two, pictures: [{ ...kit(1), refs: [652] }, { ...kit(5), refs: [652] }] });
        expect(verdict.diagnostics).toBeUndefined();
        const closing = admit({ current: current(nine), opening: OPEN, close: OPEN, sources: { ...two, 6: [653], 7: [653] }, pictures: [{ ...kit(1), refs: [652] }, { ...kit(5), refs: [652] }] });
        expect(closing.diagnostics.join('\n')).toMatch(/beats 6 to 8 speak of #653 with no picture of it/);
      });

      it('refuses an included major change that no picture shows', () => {
        const options = { pulls: [routed('notable')(652), routed('major')(653)] };
        const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [653] } }, options);
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics).toEqual(['#653 is a major change and no picture shows it; give it a picture on a beat that speaks of it: for a rule or a process change, a list or a compare; for a change to what flows between services, queues and stores, a system']);
        expect(verdict.rules).toEqual({ density: 1 });
        const shown = admit({ current: current(beats), sources: { 1: [652], 2: [653] }, pictures: [PICTURE, { beat: 2, refs: [653], kit: { kind: 'list', items: [{ label: 'Inner eye' }, { label: 'Outer shell' }, { label: 'Full frame' }] } }] }, options);
        expect(shown.ok).toBe(true);
      });

      it('asks nothing of a major change no beat speaks of: it is left out of the reading', () => {
        const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [652] } }, { pulls: [routed('notable')(652), routed('major')(653)] });
        expect(verdict.ok).toBe(true);
        expect(verdict.unspoken).toEqual([653]);
      });
    });

    describe('room', () => {
      const many = Array.from({ length: 16 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : 'More.' }));
      const all = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, i + 1 === 2 ? [652, 653] : [652]]));
      const flows = count => Array.from({ length: count }, (_, i) => ({ beat: 1 + i * 2, refs: [652], kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }));

      it('gives up the close when a picture needs its slot, and says so', () => {
        const verdict = admit({ current: current(many), opening: OPEN, close: OPEN, sources: all, pictures: flows(7) });
        expect(verdict.diagnostics).toBeUndefined();
        expect(verdict.dropped).toEqual(['close']);
        expect(verdict.current.scenes.map(scene => scene.id)).toEqual(['opening']);
        expect(verdict.current.beats[15]).not.toHaveProperty('scene');
      });

      it('gives up the opening too when the pictures need every slot, and keeps both when giving them up would not make room', () => {
        const both = admit({ current: current(many), opening: OPEN, close: OPEN, sources: all, pictures: flows(8) });
        expect(both.dropped).toEqual(['close', 'opening']);
        expect(both.current).not.toHaveProperty('scenes');
        const none = admit({ current: current(many), opening: OPEN, close: OPEN, sources: all, pictures: [...flows(7), { beat: 14, refs: [652], kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }, { beat: 15, refs: [652], kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }] });
        expect(none.ok).toBe(false);
        expect(none.diagnostics.join('\n')).toMatch(/"pictures" has 9; a Current has room for at most 6 pictures beside its 2 engines/);
      });

      it('keeps both ends when the pictures fit beside them', () => {
        const verdict = admit({ current: current(many), opening: OPEN, close: OPEN, sources: all, pictures: flows(6) });
        expect(verdict.ok).toBe(true);
        expect(verdict.dropped).toEqual([]);
      });
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
        [[picture(0), kit(4), kit(7)], /beat 0 opens with RISE’s engine/]
      ];
      for (const [pictures, pattern] of cases) {
        const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures });
        expect(verdict.ok).toBe(false);
        expect(verdict.diagnostics.join('\n')).toMatch(pattern);
      }
    });

    it('accepts a kit figure, drawn by RISE from the data the composer gives', () => {
      const bars = { kind: 'bars', title: 'Particles', max: 700, items: [{ label: 'Before', value: 60 }, { label: 'After', value: 700, changed: true }] };
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1, bars), kit(4), kit(7)] });
      expect(verdict.ok).toBe(true);
      expect(verdict.pictures[0]).toEqual({ beat: 1, refs: [652], kit: bars });
    });

    it('refuses a kit figure the kit cannot draw, in the kit’s own words', () => {
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1, { kind: 'bars', max: 10, items: [{ label: 'a', value: 1 }] }), kit(4), kit(7)] });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.kit: items has 2 to 4 items/);
      expect(verdict.rules).toHaveProperty('composition');
    });

    it('holds a kit figure’s labels and values to the number rule', () => {
      const bars = { kind: 'bars', max: 100, items: [{ label: 'Before', value: 40 }, { label: 'After', value: 60, changed: true }] };
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1, bars), kit(4), kit(7, { kind: 'flow', steps: ['Step 9', 'Done'] })] });
      const said = verdict.diagnostics.join('\n');
      expect(said).toMatch(/"40"/);
      expect(said).toMatch(/"9"/);
      expect(said).not.toMatch(/"100"/);
    });

    it('refuses an illustrator brief when the digest may draw kit figures only', () => {
      const verdict = admit({ current: current(beats), sources: { 1: [652], 2: [653] } }, { kitOnly: true });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/kit figures only/);
      expect(verdict.rules).toHaveProperty('composition');
    });

    it('refuses more than two pictures for the illustrator: a kit kind draws a measurement, a sequence, a sorting or a layout', () => {
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [picture(1), picture(4), picture(7)] });
      expect(verdict.diagnostics.join('\n')).toMatch(/3 pictures for the illustrator; at most 2/);
    });

    it('refuses a picture that cites a change its beat does not speak of', () => {
      const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [{ ...kit(1), refs: [653] }, kit(4), kit(7)] });
      expect(verdict.ok).toBe(false);
      expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.refs \[653\] are not all among beat 1’s refs \[652\]; a picture shows what its own beat speaks of/);
      expect(verdict.rules).toHaveProperty('composition');
    });

    it('refuses a picture with no refs, or refs that are not pull request numbers', () => {
      for (const refs of [[], ['652'], 652]) {
        const verdict = admit({ current: current(nine), opening: OPEN, sources, pictures: [{ ...kit(1), refs }, kit(4), kit(7)] });
        expect(verdict.diagnostics.join('\n')).toMatch(/"pictures"\[0\]\.refs lists the pull requests the picture shows/);
      }
    });

    it('holds a picture’s numbers to the pull requests that picture cites, not to the whole week', () => {
      const bars = { kind: 'bars', max: 700, items: [{ label: 'Ticks', value: 60 }, { label: 'Particles', value: 700, changed: true }] };
      expect(admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1, bars), kit(4), kit(7)] }).ok).toBe(true);
      const elsewhere = admit({ current: current(nine), opening: OPEN, sources, pictures: [kit(1), kit(4, bars), kit(7)] });
      expect(elsewhere.ok).toBe(false);
      expect(elsewhere.diagnostics.join('\n')).toMatch(/"700", which no pull request the picture cites states/);
    });

    it('refuses more pictures than a Current has room for beside its engines', () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : i === 4 ? 'Sophia holds every visual in a frame.' : 'More.' }));
      const pictures = Array.from({ length: 8 }, (_, i) => kit(1 + i * 3));
      const verdict = admit({ current: current(many), opening: OPEN, sources, pictures });
      expect(verdict.diagnostics.join('\n')).toMatch(/at most 6 pictures beside its 1 engine and RISE\u2019s eye/);
    });

    it('keeps no room for RISE\u2019s eye when no picture ends early', () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ say: i === 1 ? 'The swarm draws 700 particles.' : i === 4 ? 'Sophia holds every visual in a frame.' : 'More.' }));
      const all = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 1, i + 1 === 4 ? [652, 653] : [652]]));
      const pictures = Array.from({ length: 7 }, (_, i) => ({ beat: 1 + i * 4, refs: [652], kit: { kind: 'flow', steps: ['Before', 'After'], changed: 'After' } }));
      const verdict = admit({ current: current(many), opening: OPEN, sources: all, pictures });
      expect(verdict.diagnostics ?? []).not.toContainEqual(expect.stringMatching(/room for at most/));
    });
  });
});
