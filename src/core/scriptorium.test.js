import { describe, expect, it } from 'vitest';
import { buildCuratorPrompt } from './curator-prompt.js';
import { exportCuratorContext } from './curator-context.js';
import { EXPERIENCE_PROGRAM_SCHEMA, validateExperienceProgram } from './experience-program.js';
import { locateQuoteSpan, compileSourceSpans, assertQuotationAnchorsAgainstSources } from './source-span.js';

describe('buildCuratorPrompt', () => {
  it('stays outside the context document and teaches progress + quotation', () => {
    const context = exportCuratorContext({ id: 'ctx', sources: [] });
    const prompt = buildCuratorPrompt({
      intent: 'A sequence about memory and loss.',
      context
    });
    expect(prompt).toMatch(/rise\.experience-program\.v1/);
    expect(prompt).toMatch(/rise\.agent-operation-set\.v1/);
    expect(prompt).toMatch(/fromProgress/);
    expect(prompt).toMatch(/quoteStart/);
    expect(prompt).toMatch(/memory and loss/);
    // The room stopped being a decorator when the reading track shipped; this
    // line used to pin the word, which is why the prompt kept saying it.
    expect(prompt).toMatch(/"kind": "reading"/);
    expect(JSON.stringify(context)).not.toContain('You are arranging');
  });
});

describe('library catalogue in curator context', () => {
  it('ships titles, authors, and titled/imposed division honesty', () => {
    const context = exportCuratorContext({ id: 'ctx', sources: [] });
    expect(context.library?.length).toBeGreaterThan(20);
    const sample = context.library.find(item => item.id === 'anna-karenina')
      || context.library[0];
    expect(sample).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      divisions: expect.objectContaining({
        titled: expect.any(Boolean),
        authored: expect.any(Boolean)
      })
    });
    const measured = context.library.find(item => item.divisions?.reason === 'measured');
    if (measured) {
      expect(measured.divisions.authored).toBe(false);
    }
    const authored = context.library.find(item =>
      item.divisions?.authored === true && item.divisions?.reason === 'scheme');
    if (authored) {
      expect(authored.divisions.titled).toBe(false);
    }
    expect(JSON.stringify(context.library)).not.toMatch(/data:|blob:|https?:\/\//);
  });
});

describe('quotation-only anchors', () => {
  it('validates quote-only spans and locates them in the edition', () => {
    const text = 'Happy families are all alike; every unhappy family is unhappy in its own way.';
    const program = validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'quote-score',
      authority: 'proposed',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['anna'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: {
              sourceIds: ['anna'],
              quoteStart: 'Happy families',
              quoteEnd: 'all alike'
            },
            cue: { kind: 'procedural', collections: ['klee'] }
          }],
          fallback: { kind: 'still' }
        }
      ]
    });
    expect(program.tracks[1].clips[0].anchor.fromCharacter).toBeUndefined();
    const located = locateQuoteSpan(text, 'Happy families', 'all alike');
    expect(located.fromCharacter).toBe(0);
    expect(text.slice(located.fromCharacter, located.toCharacter)).toMatch(/Happy families/);

    const atoms = [{
      id: 'a0', sourceId: 'anna', position: 0,
      text: 'Happy', comparable: 'Happy'
    }];
    // Minimal atom alignment needs matching tokens — use empty atoms list path via omit
    const { resolutions, omitted } = compileSourceSpans(
      program,
      [{ id: 'anna', raw: text }],
      []
    );
    // No atoms → quotation degrades to omitted rather than hard fail
    expect(resolutions).toHaveLength(0);
    expect(omitted[0]?.reason).toBe('SOURCE_SPAN_NO_ATOMS');
  });

  it('refuses two quotation anchors on the same source in one lane', () => {
    expect(() => validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'quote-overlap',
      authority: 'proposed',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['anna'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [
            {
              id: 'v1',
              anchor: { sourceIds: ['anna'], quoteStart: 'Happy', quoteEnd: 'families' },
              cue: { kind: 'still' }
            },
            {
              id: 'v2',
              anchor: { sourceIds: ['anna'], quoteStart: 'unhappy', quoteEnd: 'way' },
              cue: { kind: 'still' }
            }
          ],
          fallback: { kind: 'still' }
        }
      ]
    })).toThrow(expect.objectContaining({ code: 'PROGRAM_LANE_OVERLAP' }));
  });

  it('omits ambiguous quotation clips at compile so the reading still opens', () => {
    const text = 'alpha the mark beta gamma the mark delta';
    const program = validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'ambiguous-compile',
      authority: 'proposed',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['src'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: ['src'], quoteStart: 'the mark', quoteEnd: 'delta' },
            cue: { kind: 'still' }
          }],
          fallback: { kind: 'still' }
        }
      ]
    });
    const { resolutions, omitted } = compileSourceSpans(
      program,
      [{ id: 'src', raw: text }],
      [{ id: 'a0', sourceId: 'src', position: 0, text: 'alpha', comparable: 'alpha' }]
    );
    expect(resolutions).toHaveLength(0);
    expect(omitted).toEqual([expect.objectContaining({
      clipId: 'v1',
      reason: 'SOURCE_SPAN_QUOTE_AMBIGUOUS'
    })]);
  });

  it('refuses ambiguous quotes at authoring assert; not-found stays soft', () => {
    const text = 'alpha the mark beta gamma the mark delta';
    const ambiguous = validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'ambiguous-assert',
      authority: 'proposed',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['src'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: ['src'], quoteStart: 'the mark', quoteEnd: 'delta' },
            cue: { kind: 'still' }
          }],
          fallback: { kind: 'still' }
        }
      ]
    });
    expect(() => assertQuotationAnchorsAgainstSources(ambiguous, [{ id: 'src', data: text }]))
      .toThrow(expect.objectContaining({ code: 'SOURCE_SPAN_QUOTE_AMBIGUOUS' }));

    const missing = validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'missing-assert',
      authority: 'proposed',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['src'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: ['src'], quoteStart: 'no such line', quoteEnd: 'anywhere' },
            cue: { kind: 'still' }
          }],
          fallback: { kind: 'still' }
        }
      ]
    });
    expect(assertQuotationAnchorsAgainstSources(missing, [{ id: 'src', data: text }])).toBe(true);
  });
});
