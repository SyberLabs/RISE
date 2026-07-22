// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chapel } from './Chapel.js';
import { CHAPEL_BOOKS, CHAPEL_GROUPINGS } from '../content/chapel/corpus/manifest.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chapel = new Chapel(container, options);
  return { container, chapel };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Chapel view', () => {
  it('renders every book of the canon under its liturgical grouping', () => {
    const { container } = mount();
    const buttons = [...container.querySelectorAll('.chapel-book')];
    expect(buttons).toHaveLength(CHAPEL_BOOKS.length);

    const groupingTitles = [...container.querySelectorAll('.chapel-grouping-title')]
      .map(node => node.textContent.trim());
    expect(groupingTitles).toEqual(CHAPEL_GROUPINGS.map(grouping => grouping.name));

    // Translation identity is provenance — named on the surface
    expect(container.querySelector('.chapel-kicker').textContent).toContain('DOUAY-RHEIMS');
    expect(container.querySelector('.chapel-provenance').textContent).toContain('Challoner');
  });

  it('is deliberately quiet: no search, no view modes, no filters', () => {
    const { container } = mount();
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(container.querySelector('[data-view-mode]')).toBeNull();
    expect(container.querySelector('[data-domain]')).toBeNull();
  });

  it('opens a multi-chapter book into its chapters instead of launching it', () => {
    const onLaunchReading = vi.fn();
    const { container } = mount({ onLaunchReading });

    const john = container.querySelector('.chapel-book[data-book-id="john"]');
    john.click();

    expect(onLaunchReading).not.toHaveBeenCalled();
    expect(john.getAttribute('aria-expanded')).toBe('true');
    const panel = container.querySelector('[data-chapter-panel="john"]');
    expect(panel).not.toBeNull();
    expect(panel.querySelectorAll('.chapel-chapter')).toHaveLength(21);

    // Clicking the open book again closes it
    john.click();
    expect(container.querySelector('.chapel-chapter-panel')).toBeNull();
    expect(john.getAttribute('aria-expanded')).toBe('false');

    // Opening another book replaces the panel — only one open at a time
    john.click();
    container.querySelector('.chapel-book[data-book-id="mark"]').click();
    expect(container.querySelectorAll('.chapel-chapter-panel')).toHaveLength(1);
    expect(container.querySelector('[data-chapter-panel="mark"]')).not.toBeNull();
  });

  it('launches a chapter with its number, the whole book with null', () => {
    const onLaunchReading = vi.fn();
    const { container } = mount({ onLaunchReading });

    container.querySelector('.chapel-book[data-book-id="john"]').click();
    container.querySelector('[data-chapter-panel="john"] [data-chapter="3"]').click();
    expect(onLaunchReading).toHaveBeenCalledWith('john', 3);

    onLaunchReading.mockClear();
    const { container: second } = mount({ onLaunchReading });
    second.querySelector('.chapel-book[data-book-id="john"]').click();
    second.querySelector('[data-chapter-panel="john"] [data-whole-book]').click();
    expect(onLaunchReading).toHaveBeenCalledWith('john', null);
  });

  it('launches a single-chapter book directly, no panel', () => {
    const onLaunchReading = vi.fn();
    const { container } = mount({ onLaunchReading });

    container.querySelector('.chapel-book[data-book-id="jude"]').click();
    expect(onLaunchReading).toHaveBeenCalledWith('jude', null);
    expect(container.querySelector('.chapel-chapter-panel')).toBeNull();
  });

  it('says Psalm, not Chapter, inside the Psalter', () => {
    const { container } = mount();
    container.querySelector('.chapel-book[data-book-id="psalms"]').click();
    const panel = container.querySelector('[data-chapter-panel="psalms"]');
    expect(panel.querySelector('.chapel-chapter-title').textContent).toContain('150 psalms');
    expect(panel.querySelectorAll('.chapel-chapter')).toHaveLength(150);
  });

  it('launches once per click and refuses to race a second launch', async () => {
    let release;
    const gate = new Promise(fulfil => { release = fulfil; });
    const onLaunchReading = vi.fn(() => gate);
    const { container } = mount({ onLaunchReading });

    container.querySelector('.chapel-book[data-book-id="psalms"]').click();
    const psalm1 = container.querySelector('[data-chapter-panel="psalms"] [data-chapter="1"]');
    psalm1.click();
    psalm1.click();
    container.querySelector('.chapel-book[data-book-id="jude"]').click();

    expect(onLaunchReading).toHaveBeenCalledTimes(1);
    expect(onLaunchReading).toHaveBeenCalledWith('psalms', 1);
    expect(psalm1.classList.contains('chapel-book-loading')).toBe(true);

    release();
    await gate;
    await Promise.resolve();
    expect(psalm1.classList.contains('chapel-book-loading')).toBe(false);
  });

  it('returns from the Chamber with the book open and its chapter marked', () => {
    const { container } = mount({ bookId: 'john', chapter: 3 });
    // Arrives already open at its chapters
    const panel = container.querySelector('[data-chapter-panel="john"]');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('[data-chapter="3"]').classList.contains('chapel-chapter-last')).toBe(true);
    expect(container.querySelector('.chapel-book[data-book-id="john"]').classList.contains('chapel-book-last')).toBe(true);

    // And updates in place on a later return
    const { container: again, chapel } = mount({ bookId: 'john' });
    chapel.update({ bookId: 'psalms', chapter: 23 });
    expect(again.querySelector('[data-chapter-panel="psalms"] [data-chapter="23"]')
      .classList.contains('chapel-chapter-last')).toBe(true);
  });
});

describe('the doorway (seam)', () => {
  const portalSource = readFileSync(resolve('src/components/Portal.js'), 'utf8');
  const chapelCss = readFileSync(resolve('src/components/Chapel.css'), 'utf8');
  const appSource = readFileSync(resolve('src/app.js'), 'utf8');
  const indexHtml = readFileSync(resolve('index.html'), 'utf8');

  it('the sanctuary lamp is the only entrance: portal has it, the nav row does not', () => {
    expect(portalSource).toMatch(/portal-chapel-lamp[^>]*data-nav="chapel"/s);
    // The nav row (nav-primary/nav-secondary) must never gain a chapel item
    const navBlock = portalSource.slice(
      portalSource.indexOf('class="nav-primary"'),
      portalSource.indexOf('</nav>')
    );
    expect(navBlock).not.toContain('chapel');
  });

  it('the lamp breathes on an 8s cycle and falls still under reduced motion', () => {
    expect(chapelCss).toMatch(/\.portal-chapel-lamp\.lamp-lit\s*\{[^}]*animation:\s*chapel-lamp-breath 8s/s);
    const reducedMotion = chapelCss.slice(chapelCss.indexOf('prefers-reduced-motion'));
    expect(reducedMotion).toMatch(/\.portal-chapel-lamp(,|\.lamp-lit)[^{]*\{[^}]*animation:\s*none/s);
    // The portal reveal must actually light the lamp
    expect(portalSource).toContain("classList.add('lamp-lit')");
  });

  it('app.js registers the chapel view with a lazy handoff and reverent failure copy', () => {
    expect(appSource).toContain("registerView('chapel'");
    expect(appSource).toContain("import('./content/chapel/handoff.js')");
    expect(appSource).toContain('CHAPEL_PAYLOAD_INTEGRITY');
    expect(indexHtml).toContain('id="view-chapel"');
  });
});
