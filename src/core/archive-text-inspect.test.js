import { describe, expect, it } from 'vitest';
import { inspectArchiveText } from './archive-text-inspect.js';

describe('archive text inspect', () => {
  it('scores a variorum apparatus as a refuse, not as the play', () => {
    const text = [
      '140. at] Ff. om. Qq.',
      '63. smote] smot Q2Q3 F2F3.',
      'Capell conj. om. Pope.',
      '8 HAMLET. [act i.'
    ].join('\n');
    const report = inspectArchiveText(text);
    expect(report.score).toBeGreaterThan(12);
    expect(report.warnings).toContain('refuse');
    expect(report.apparatus).toBeGreaterThan(0);
  });

  it('lets a clean prose sample through', () => {
    const text = 'Happy families are all alike; every unhappy family is unhappy in its own way.';
    const report = inspectArchiveText(text);
    expect(report.score).toBeLessThanOrEqual(6);
    expect(report.warnings).not.toContain('refuse');
  });
});
