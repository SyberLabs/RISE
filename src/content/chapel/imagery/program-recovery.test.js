import { describe, expect, it } from 'vitest';
import {
  recoverLegacyChapelScriptureSources,
  recoverLegacyChapelVisualProgram
} from './program-recovery.js';

describe('legacy Chapel visual-program recovery', () => {
  it('reconstructs Matthew 27 from canonical provenance', () => {
    const program = recoverLegacyChapelVisualProgram({
      provenance: { kind: 'chapel-book', bookId: 'matthew', chapter: 27 },
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { presentation: 'continuous' }
      }
    });

    expect(program).toMatchObject({
      enabled: true,
      fallback: { kind: 'still' }
    });
    expect(program.segments.map(segment => segment.id)).toEqual([
      'before-pilate',
      'flagellation',
      'crowning-ecce-homo',
      'carrying-cross',
      'crucifixion',
      'descent-lamentation',
      'entombment'
    ]);
  });

  it('supports the oldest canonical source-label record and preserves an Icon lock', () => {
    const program = recoverLegacyChapelVisualProgram({
      textSource: 'The Chapel · Matthew 17',
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'icon', iconId: 'icon-transfiguration' }
      }
    });

    expect(program).toMatchObject({
      enabled: false,
      fallback: {
        kind: 'focal',
        focal: { type: 'icon', iconId: 'icon-transfiguration' }
      }
    });
  });

  it('does not invent a program for non-Chapel or unmapped readings', () => {
    expect(recoverLegacyChapelVisualProgram({
      textSource: 'Pasted',
      provenance: { kind: 'library-book', bookId: 'matthew', chapter: 27 }
    })).toBeNull();
    expect(recoverLegacyChapelVisualProgram({
      provenance: { kind: 'chapel-book', bookId: 'john', chapter: 7 }
    })).toBeNull();
  });

  it('restores the coordinate-bearing source envelope for a text-only record', () => {
    expect(recoverLegacyChapelScriptureSources({
      text: '[v 27:1] And when morning was come.',
      textSource: 'The Chapel · Matthew 27'
    })).toEqual([
      expect.objectContaining({
        id: 'chapel-matthew-27',
        chunkProfile: 'scripture',
        data: '[v 27:1] And when morning was come.',
        provenance: expect.objectContaining({
          kind: 'chapel-book',
          bookId: 'matthew',
          chapter: 27
        })
      })
    ]);
  });
});
