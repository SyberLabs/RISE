import { describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent, validateRiseCurrent } from './rise-current.js';
import { directionEligibility } from './passage-visuals/reading-state.js';
import { Chamber } from '../components/read/Chamber.js';

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
