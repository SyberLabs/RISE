import { describe, expect, it, vi } from 'vitest';
import {
  compileRiseCurrent, RISE_CURRENT_THEME_IDS, RISE_CURRENT_THEMES, validateRiseCurrent
} from './rise-current.js';
import { directionEligibility } from './passage-visuals/reading-state.js';
import { JEV_COLOR_THEMES } from './jev-color-themes.js';
import { JEV_PALETTES, jevColors } from './jev-palette.js';
import { sessionColorTheme } from './session-presentation.js';
import { normalizeFieldStyle } from './visual-style-definitions.js';
import { PALETTES } from '../visuals/attractor.js';
import { Chamber } from '../components/Chamber.js';

const current = (patch = {}) => ({
  schema: 'rise.current.v1',
  id: 'gravity-answer',
  title: 'Why gravity bends light',
  origin: { kind: 'model', name: 'Explainer', provider: 'example-provider' },
  segments: [
    {
      id: 'opening',
      text: 'Gravity curves spacetime. Light follows its geometry.',
      visual: 'attractor',
      dives: [{
        id: 'spacetime',
        text: 'The path of light is related to the geometry being described.',
        anchor: {
          fromCharacter: 15, toCharacter: 25,
          quoteStart: 'spacetime.', quoteEnd: 'spacetime.'
        }
      }]
    },
    { id: 'second', text: 'The bend can be measured.', visual: 'still' }
  ],
  ...patch
});

describe('external Current validation', () => {
  it('detaches and freezes a valid input without claiming a model is evidence', () => {
    const input = current();
    const checked = validateRiseCurrent(input);
    input.segments[0].text = 'changed';
    expect(checked.segments[0].text).toBe('Gravity curves spacetime. Light follows its geometry.');
    expect(checked.origin).toEqual({ kind: 'model', name: 'Explainer', provider: 'example-provider' });
    expect(Object.isFrozen(checked.segments[0].dives[0].anchor)).toBe(true);
  });

  it.each([
    ['wrong schema', { schema: 'rise.current.v2' }, 'CURRENT_SCHEMA', '$.schema'],
    ['unknown visual', { segments: [{ id: 'a', text: 'Text', visual: 'eval-js' }] }, 'CURRENT_VISUAL', '$.segments[0].visual'],
    ['executable field', { segments: [{ id: 'a', text: 'Text', javascript: 'alert(1)' }] }, 'CURRENT_UNKNOWN_FIELD', '$.segments[0].javascript'],
    ['duplicate segment', { segments: [{ id: 'a', text: 'First' }, { id: 'a', text: 'Second' }] }, 'CURRENT_DUPLICATE_ID', '$.segments[1].id'],
    ['blank segment', { segments: [{ id: 'a', text: '  ' }] }, 'CURRENT_TEXT', '$.segments[0].text'],
    ['oversize segment', { segments: [{ id: 'a', text: 'x'.repeat(4_001) }] }, 'CURRENT_TEXT', '$.segments[0].text'],
    ['pause marker', { segments: [{ id: 'a', text: 'A [PAUSE] B.' }] }, 'CURRENT_RESERVED_TEXT', '$.segments[0].text'],
    ['score cut', { segments: [{ id: 'a', text: 'A \uE000 B.' }] }, 'CURRENT_RESERVED_TEXT', '$.segments[0].text'],
    ['authored pipe', { segments: [{ id: 'a', text: 'A | B.' }] }, 'CURRENT_RESERVED_TEXT', '$.segments[0].text'],
    ['null visual', { segments: [{ id: 'a', text: 'Text', visual: null }] }, 'CURRENT_VISUAL', '$.segments[0].visual'],
    ['null dives', { segments: [{ id: 'a', text: 'Text', dives: null }] }, 'CURRENT_DIVES', '$.segments[0].dives'],
    ['total size', { segments: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, text: 'x'.repeat(4_000) })) }, 'CURRENT_TOTAL_TEXT', '$.segments'],
    ['missing provider', { origin: { kind: 'model', name: 'Explainer' } }, 'CURRENT_PROVIDER', '$.origin.provider'],
    ['untrue quote', { segments: [{ id: 'a', text: 'Gravity curves spacetime.', dives: [{ id: 'd', text: 'Note', anchor: { fromCharacter: 0, toCharacter: 7, quoteStart: 'curves', quoteEnd: 'curves' } }] }] }, 'CURRENT_QUOTE', '$.segments[0].dives[0].anchor'],
    ['untrimmed quote', { segments: [{ id: 'a', text: 'Alpha beta', dives: [{ id: 'd', text: 'Note', anchor: { fromCharacter: 0, toCharacter: 10, quoteStart: 'Alpha ', quoteEnd: 'beta' } }] }] }, 'CURRENT_QUOTE', '$.segments[0].dives[0].anchor'],
    ['out of range', { segments: [{ id: 'a', text: 'Text', dives: [{ id: 'd', text: 'Note', anchor: { fromCharacter: 0, toCharacter: 100, quoteStart: 'Text', quoteEnd: 'Text' } }] }] }, 'CURRENT_ANCHOR', '$.segments[0].dives[0].anchor'],
    ['partial word', { segments: [{ id: 'a', text: 'Longword remains', dives: [{ id: 'd', text: 'Note', anchor: { fromCharacter: 0, toCharacter: 4, quoteStart: 'Long', quoteEnd: 'Long' } }] }] }, 'CURRENT_ANCHOR', '$.segments[0].dives[0].anchor'],
    ['NUL quote', { segments: [{ id: 'a', text: 'Alpha\0 beta', dives: [{ id: 'd', text: 'Note', anchor: { fromCharacter: 0, toCharacter: 6, quoteStart: 'Alpha\0', quoteEnd: 'Alpha\0' } }] }] }, 'CURRENT_QUOTE', '$.segments[0].dives[0].anchor'],
    ['duplicate Dive', { segments: [{ id: 'a', text: 'Text', dives: [
      { id: 'd', text: 'A', anchor: { fromCharacter: 0, toCharacter: 4, quoteStart: 'Text', quoteEnd: 'Text' } },
      { id: 'd', text: 'B', anchor: { fromCharacter: 0, toCharacter: 4, quoteStart: 'Text', quoteEnd: 'Text' } }
    ] }] }, 'CURRENT_DUPLICATE_ID', '$.segments[0].dives[1].id']
  ])('rejects %s', (_name, patch, code, path) => {
    expect(() => validateRiseCurrent(current(patch))).toThrow(expect.objectContaining({ code, path }));
  });

  it('rejects prototype keys in parsed input', () => {
    const input = JSON.parse(JSON.stringify(current()));
    input.segments[0] = JSON.parse('{"id":"a","text":"Text","__proto__":{"polluted":true}}');
    expect(() => validateRiseCurrent(input)).toThrow(expect.objectContaining({
      code: 'CURRENT_UNKNOWN_FIELD', path: '$.segments[0].__proto__'
    }));
  });

  it('accepts a human origin without a provider', () => {
    expect(validateRiseCurrent(current({ origin: { kind: 'human', name: 'Mateo' } })).origin)
      .toEqual({ kind: 'human', name: 'Mateo' });
  });

  it('refuses sparse segment arrays at the missing index', () => {
    expect(() => validateRiseCurrent(current({ segments: new Array(1) }))).toThrow(expect.objectContaining({
      code: 'CURRENT_OBJECT', path: '$.segments[0]'
    }));
  });
});

describe('external Current compilation', () => {
  it('uses the canonical score and Session with segment sources and anchored depth', () => {
    const input = current();
    const session = compileRiseCurrent(input);
    expect(session.sources.map(source => source.id)).toEqual(['opening', 'second']);
    expect(session.sourceTexts.get('opening')).toBe('Gravity curves spacetime. Light follows its geometry.');
    expect(session.atoms.some(atom => atom.sourceSpanIds?.includes('current-dives:dive-0-0'))).toBe(true);
    expect(session.experienceProgram.tracks[2].clips[0].metadata.externalId).toBe('spacetime');
    expect(session.experienceProgram.schema).toBe('rise.experience-program.v1');
    expect(session.experienceProgram.authority).toBe('proposed');
    expect(session.visualProgram.segments[0].cue).toEqual({ kind: 'field', renderer: 'attractor', config: {} });
    expect(directionEligibility(session)).toMatchObject({ defaultMode: 'hold', reason: 'authored-program' });
    expect(session.visualConfig.visualMode).toBe('interlocution');
    expect(session.projection).toBe('stream');
    expect(input.segments[0].visual).toBe('attractor');
  });

  it('lets human-authored content compile to Page with user authority', () => {
    const session = compileRiseCurrent(current({ origin: { kind: 'human', name: 'Mateo' } }), { projection: 'page' });
    expect(session.projection).toBe('page');
    expect(session.experienceProgram.authority).toBe('user');
  });

  it('launches a Stream with its authored visual cue active', () => {
    const session = compileRiseCurrent(current());
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    try {
      expect(chamber.hasRhythmicVisuals).toBe(true);
      expect(chamber._visualSchedule).not.toBeNull();
      expect(chamber._direction.mode).toBe('hold');
      const cue = vi.spyOn(chamber, 'applyScheduledVisualCue').mockReturnValue(true);
      chamber._visualSchedule.observe(session.atoms.find(atom => atom.sourceId === 'opening'));
      expect(cue).toHaveBeenCalledWith(
        { kind: 'field', renderer: 'attractor', config: {} }, expect.any(Object)
      );
    } finally {
      chamber.destroy();
      container.remove();
      vi.restoreAllMocks();
    }
  });

  it('refuses an unknown projection rather than silently presenting it as Stream', () => {
    expect(() => compileRiseCurrent(current(), { projection: 'hologram' })).toThrow(expect.objectContaining({
      code: 'CURRENT_PROJECTION', path: '$.projection'
    }));
  });
});

describe('the theme a Current may name', () => {
  const IDS = ['classic', 'amethyst', 'prism', 'ember', 'cobalt', 'jade'];
  const themed = theme => current({
    theme,
    segments: [
      { id: 'moving', text: 'The filament moves.', visual: 'attractor' },
      { id: 'drawn', text: 'The drawing grows.', visual: 'genesis' },
      { id: 'quiet', text: 'The page is still.', visual: 'still' }
    ]
  });

  it('is one of the shipped color themes, by reference, in their order', () => {
    expect(RISE_CURRENT_THEME_IDS).toBe(JEV_COLOR_THEMES);
    expect([...RISE_CURRENT_THEME_IDS]).toEqual(IDS);
  });

  it.each(IDS)('accepts %s and keeps it on the frozen result', id => {
    const checked = validateRiseCurrent(themed(id));
    expect(checked.theme).toBe(id);
    expect(Object.isFrozen(checked)).toBe(true);
  });

  it.each([null, '', 'neon', 'Jade', 'jade ', '#061912', 7, {}, ['jade']])('refuses %j and names every theme it could have been', theme => {
    let error = null;
    try { validateRiseCurrent(current({ theme })); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'CURRENT_THEME', path: '$.theme' });
    for (const id of IDS) expect(error.message).toContain(id);
    expect(error.message).toBe('Unknown theme; use one of classic, amethyst, prism, ember, cobalt, jade ($.theme)');
  });

  it('reads the theme once, so what is checked is what is compiled', () => {
    const input = () => {
      let reads = 0;
      const value = current();
      Object.defineProperty(value, 'theme', {
        enumerable: true, configurable: true,
        get: () => (reads++ === 0 ? 'jade' : 'neon')
      });
      return { value, reads: () => reads };
    };
    const first = input();
    expect(validateRiseCurrent(first.value).theme).toBe('jade');
    expect(first.reads()).toBe(1);
    const second = input();
    expect(compileRiseCurrent(second.value).presentation).toEqual({ colorTheme: 'jade', colors: jevColors('jade') });
    expect(second.reads()).toBe(1);
  });

  it.each([
    ['a segment theme', { segments: [{ id: 'a', text: 'T', theme: 'jade' }] }, '$.segments[0].theme'],
    ['a segment palette', { segments: [{ id: 'a', text: 'T', palette: 'gold' }] }, '$.segments[0].palette'],
    ['a segment style', { segments: [{ id: 'a', text: 'T', style: 'color: red' }] }, '$.segments[0].style'],
    ['a segment colors', { segments: [{ id: 'a', text: 'T', colors: { background: '#000' } }] }, '$.segments[0].colors'],
    ['top-level colors', { colors: { background: '#000000', text: '#ffffff', accent: '#ff0000' } }, '$.colors'],
    ['a top-level look', { look: 'cobalt' }, '$.look']
  ])('refuses %s as an unknown field', (_name, patch, path) => {
    expect(() => validateRiseCurrent(current(patch))).toThrow(expect.objectContaining({
      code: 'CURRENT_UNKNOWN_FIELD', path
    }));
  });

  it('with no theme, carries no theme key, configures nothing and presents nothing', () => {
    const input = themed('cobalt');
    delete input.theme;
    expect(Object.hasOwn(validateRiseCurrent(input), 'theme')).toBe(false);
    const session = compileRiseCurrent(input);
    expect(session.presentation).toBeNull();
    expect(session.visualProgram.segments.map(segment => segment.cue)).toEqual([
      { kind: 'field', renderer: 'attractor', config: {} },
      { kind: 'field', renderer: 'genesis', config: {} },
      { kind: 'still' }
    ]);
  });

  it.each(IDS)('compiles %s to its page colors, its filament and its drawings', id => {
    const session = compileRiseCurrent(themed(id));
    expect(session.presentation).toEqual({ colorTheme: id, colors: jevColors(id) });
    expect(sessionColorTheme(session)).toEqual(JEV_PALETTES[id]);
    expect(session.visualProgram.segments.map(segment => segment.cue)).toEqual([
      { kind: 'field', renderer: 'attractor', config: { ...RISE_CURRENT_THEMES[id].attractor } },
      { kind: 'field', renderer: 'genesis', config: { ...RISE_CURRENT_THEMES[id].genesis } },
      { kind: 'still' }
    ]);
  });

  it('compiles cobalt exactly as the contract shows it', () => {
    const session = compileRiseCurrent(themed('cobalt'));
    expect(session.visualProgram.segments[0].cue)
      .toEqual({ kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'blue', form: 'mirror' } });
    expect(session.visualProgram.segments[1].cue)
      .toEqual({ kind: 'field', renderer: 'genesis', config: { preset: 'architectural' } });
    expect(session.presentation)
      .toEqual({ colorTheme: 'cobalt', colors: { background: '#071326', text: '#EDF6FF', accent: '#58B8FF' } });
  });

  describe('the table it compiles through', () => {
    it('holds renderer ids only, one row per theme, in theme order', () => {
      expect(Object.keys(RISE_CURRENT_THEMES)).toEqual([...RISE_CURRENT_THEME_IDS]);
      expect(RISE_CURRENT_THEMES).toEqual({
        classic: { attractor: { system: 'aizawa', palette: 'gold', form: 'mirror' }, genesis: { preset: 'harmonic' } },
        amethyst: { attractor: { system: 'thomas', palette: 'purple', form: 'kaleido' }, genesis: { preset: 'chaotic' } },
        prism: { attractor: { system: 'halvorsen', palette: 'neon', form: 'mirror' }, genesis: { preset: 'chaotic' } },
        ember: { attractor: { system: 'halvorsen', palette: 'red', form: 'bilateral' }, genesis: { preset: 'twittering' } },
        cobalt: { attractor: { system: 'thomas', palette: 'blue', form: 'mirror' }, genesis: { preset: 'architectural' } },
        jade: { attractor: { system: 'aizawa', palette: 'jade', form: 'bilateral' }, genesis: { preset: 'gravitational' } }
      });
    });

    it.each(IDS)('names in %s only what the renderers already accept', id => {
      const row = RISE_CURRENT_THEMES[id];
      expect(normalizeFieldStyle('attractor', row.attractor)).toEqual({ ...row.attractor });
      expect(normalizeFieldStyle('genesis', row.genesis).preset).toBe(row.genesis.preset);
      expect(row.genesis.preset).not.toBe('random');
    });

    it('gives each theme its own shape, and neon only the mirror', () => {
      const rows = Object.values(RISE_CURRENT_THEMES);
      expect(new Set(rows.map(row => `${row.attractor.system}|${row.attractor.form}`)).size).toBe(rows.length);
      for (const row of rows.filter(item => item.attractor.palette === 'neon')) expect(row.attractor.form).toBe('mirror');
    });

    it('draws no theme brighter in its form than the brightest of the six first themes in that form', () => {
      // The light one frame strokes, as attractor.js draws each form: mirror adds the twin at 0.6,
      // bilateral draws the core twice, kaleido twelve times at 0.52. relLum is WCAG luminance of 'r,g,b'.
      const relLum = col => {
        const [r, g, b] = col.split(',').map(Number).map(value => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const light = passes => passes.reduce((sum, pass) => sum + pass.w * pass.mul * relLum(pass.col), 0);
      const drawn = ({ palette, form }) => {
        const { core, twin } = PALETTES[palette];
        if (form === 'mirror') return light(core) + 0.6 * light(twin);
        return (form === 'bilateral' ? 2 : 12 * 0.52) * light(core);
      };
      // prism, jade and amethyst: the brightest shipped mirror, bilateral and kaleido looks.
      const ceiling = {
        mirror: drawn({ palette: 'neon', form: 'mirror' }),
        bilateral: drawn({ palette: 'jade', form: 'bilateral' }),
        kaleido: drawn({ palette: 'purple', form: 'kaleido' })
      };
      expect(ceiling.mirror).toBeCloseTo(1.838, 3);
      expect(ceiling.bilateral).toBeCloseTo(2.083, 3);
      expect(ceiling.kaleido).toBeCloseTo(4.124, 3);
      for (const [id, row] of Object.entries(RISE_CURRENT_THEMES)) {
        expect(drawn(row.attractor), id).toBeLessThanOrEqual(ceiling[row.attractor.form] + 1e-9);
      }
    });

    it('is frozen at every level', () => {
      expect(Object.isFrozen(RISE_CURRENT_THEMES)).toBe(true);
      for (const row of Object.values(RISE_CURRENT_THEMES)) {
        expect(Object.isFrozen(row)).toBe(true);
        expect(Object.isFrozen(row.attractor)).toBe(true);
        expect(Object.isFrozen(row.genesis)).toBe(true);
      }
    });
  });
});
