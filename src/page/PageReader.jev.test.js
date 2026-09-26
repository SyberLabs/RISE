import { describe, expect, it, vi } from 'vitest';
import { PageReader } from './PageReader.js';

const session = { atoms: [{ content: 'The first passage.', modality: 'text', sourceId: 'work', tags: [] }] };
const continueDecision = { action: 'continue', model: 'test-model', confidence: 0.9 };

describe('PageReader Jev gate', () => {
  it('keeps the first passage out of the DOM until approval', async () => {
    let resolve;
    const jevConductor = { decide: vi.fn(() => new Promise(r => { resolve = r; })) };
    const host = document.createElement('div');
    const reader = new PageReader(host, { session, jevConductor });

    reader.render();
    expect(host.textContent).not.toContain('The first passage.');
    expect(jevConductor.decide).toHaveBeenCalledWith(expect.objectContaining({ excerpt: 'The first passage.' }));

    resolve(continueDecision);
    await vi.waitFor(() => expect(host.textContent).toContain('The first passage.'));
    reader.destroy();
  });

  it('does not render after refusal and allows retrying the same page', async () => {
    const jevConductor = { decide: vi.fn()
      .mockResolvedValueOnce({ ...continueDecision, action: 'pause' })
      .mockResolvedValueOnce(continueDecision) };
    const host = document.createElement('div');
    const reader = new PageReader(host, { session, jevConductor });

    reader.render();
    await vi.waitFor(() => expect(jevConductor.decide).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(host.textContent).not.toContain('The first passage.');

    reader.goToPage(0);
    await vi.waitFor(() => expect(host.textContent).toContain('The first passage.'));
    expect(jevConductor.decide).toHaveBeenCalledTimes(2);
    reader.destroy();
  });

  it('keeps Jev-enabled readers paged and refuses whole-book print requests', async () => {
    const atoms = [];
    for (let i = 0; i < 50; i++) {
      atoms.push({ content: `Passage ${i}. ${'word '.repeat(60)}`, modality: 'text', sourceId: 'book', tags: [] });
      if (i < 49) atoms.push({ content: '', modality: 'text', sourceId: 'book', tags: ['paragraph-break'] });
    }
    const jevConductor = { decide: vi.fn().mockResolvedValue(continueDecision) };
    const onJevState = vi.fn();
    const host = document.createElement('div');
    const reader = new PageReader(host, {
      session: { atoms }, jevConductor, onJevState, paginated: false
    });

    reader.render();
    await vi.waitFor(() => expect(host.querySelector('.page-article')).not.toBeNull());
    const pageRequests = jevConductor.decide.mock.calls.length;
    expect(reader.paginated).toBe(true);
    expect(reader.isPaged).toBe(true);
    expect(reader.setPaged(false)).toBe(true);
    expect(await reader.prepareForPrint()).toBe(false);
    expect(jevConductor.decide).toHaveBeenCalledTimes(pageRequests);
    expect(onJevState).toHaveBeenCalledWith(expect.objectContaining({ state: 'blocked' }));
    expect(host.querySelectorAll('.page-text').length).toBeLessThan(50);
    reader.destroy();
  });

  it('retries a rejected target page rather than reapproving the visible page', async () => {
    const atoms = [];
    for (let i = 0; i < 40; i++) {
      atoms.push({ content: `Passage ${i}. ${'word '.repeat(65)}`, modality: 'text', sourceId: 'book', tags: [] });
      if (i < 39) atoms.push({ content: '', modality: 'text', sourceId: 'book', tags: ['paragraph-break'] });
    }
    let rejectNext = false;
    let rejectedTarget = null;
    const jevConductor = { decide: vi.fn(async ({ excerpt }) => {
      if (rejectNext) {
        rejectNext = false;
        rejectedTarget = excerpt;
        return { ...continueDecision, action: 'pause' };
      }
      return continueDecision;
    }) };
    const host = document.createElement('div');
    const reader = new PageReader(host, { session: { atoms }, jevConductor, linesPerPage: 10 });
    reader.render();
    await vi.waitFor(() => expect(host.querySelector('.page-article')).not.toBeNull());
    expect(reader.pages.length).toBeGreaterThan(1);

    rejectNext = true;
    reader.goToPage(1);
    await vi.waitFor(() => expect(rejectedTarget).not.toBeNull());
    await new Promise(resolve => setTimeout(resolve, 0));
    const blockedExcerpt = rejectedTarget;
    expect(reader.pageIndex).toBe(0);
    await reader.retry();
    await vi.waitFor(() => expect(reader.pageIndex).toBe(1));
    expect(jevConductor.decide.mock.calls.some(([request]) => request.excerpt === blockedExcerpt)).toBe(true);
    reader.destroy();
  });

  it('does not let an already-approved page render after a newer navigation starts', async () => {
    let resolveTarget;
    const jevConductor = { decide: vi.fn()
      .mockResolvedValueOnce(continueDecision)
      .mockImplementationOnce(() => new Promise(resolve => { resolveTarget = resolve; })) };
    const host = document.createElement('div');
    const reader = new PageReader(host, { session, jevConductor });
    reader.render();
    await vi.waitFor(() => expect(host.textContent).toContain('The first passage.'));

    const template = reader.composition.items.find(item => item.type === 'text');
    reader.pages = [
      { index: 0, items: [template] },
      { index: 1, items: [{ ...template, text: 'stale passage', passageId: 'approved-scope' }] },
      { index: 2, items: [{ ...template, text: 'latest passage', passageId: 'pending-scope' }] }
    ];
    reader._jevLastPassage = 'approved-scope';
    reader.goToPage(1); // This scope is cached, so its gate resolves immediately.
    reader.goToPage(2); // A newer request supersedes it before its continuation runs.
    await vi.waitFor(() => expect(resolveTarget).toBeTypeOf('function'));
    resolveTarget(continueDecision);
    await vi.waitFor(() => expect(reader.pageIndex).toBe(2));
    expect(host.textContent).toContain('latest passage');
    expect(host.textContent).not.toContain('stale passage');
    reader.destroy();
  });
});
