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

  it('launches a book once per click and refuses to race a second launch', async () => {
    let release;
    const gate = new Promise(fulfil => { release = fulfil; });
    const onLaunchBook = vi.fn(() => gate);
    const { container } = mount({ onLaunchBook });

    const psalms = container.querySelector('[data-book-id="psalms"]');
    psalms.click();
    psalms.click();
    container.querySelector('[data-book-id="jude"]').click();

    expect(onLaunchBook).toHaveBeenCalledTimes(1);
    expect(onLaunchBook).toHaveBeenCalledWith('psalms');
    expect(psalms.classList.contains('chapel-book-loading')).toBe(true);

    release();
    await gate;
    await Promise.resolve();
    expect(psalms.classList.contains('chapel-book-loading')).toBe(false);
  });

  it('marks the last-read book on return from the Chamber', () => {
    const { container, chapel } = mount({ bookId: 'john' });
    expect(container.querySelector('[data-book-id="john"]').classList.contains('chapel-book-last')).toBe(true);

    chapel.update({ bookId: 'psalms' });
    expect(container.querySelector('[data-book-id="john"]').classList.contains('chapel-book-last')).toBe(false);
    expect(container.querySelector('[data-book-id="psalms"]').classList.contains('chapel-book-last')).toBe(true);
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
