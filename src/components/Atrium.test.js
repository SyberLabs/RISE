import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Atrium } from './Atrium.js';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

describe('Atrium', () => {
  let container;
  let onNavigate;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onNavigate = vi.fn();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the complete philosophy discovery map and a truthful launch gate', () => {
    const atrium = new Atrium(container, { onNavigate });

    expect(container.querySelector('#atrium-title').textContent).toBe('Atrium');
    expect(container.querySelectorAll('.atrium-node')).toHaveLength(35);
    expect(container.querySelector('.atrium-detail h2').textContent).toBe('Plato');
    expect(container.querySelector('.atrium-launch-gate button').disabled).toBe(true);
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('8 of 8 distinct passages cleared');
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('3 of 3 journeys ready');
    expect(container.querySelector('.atrium-review-panel').textContent).toContain('specialist sign-off pending');
    expect(container.querySelector('.atrium-stage-heading').textContent).toContain('reviewed relationships');

    atrium.destroy();
  });

  it('hands a cleared point journey to the Chamber configuration boundary', () => {
    const onConfigureJourney = vi.fn();
    const atrium = new Atrium(container, { onNavigate, onConfigureJourney });
    const launch = container.querySelector('.atrium-launch-gate button');

    expect(launch.disabled).toBe(false);
    launch.click();
    expect(onConfigureJourney).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seq-ph-socratic-turn', status: 'publishable' }),
      { domain: 'philosophy' }
    );

    atrium.destroy();
  });

  it('switches to history and filters the timeline by semantic lane', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-domain="history"]').click();

    expect(container.querySelector('.atrium-stage-heading h2').textContent).toContain('1750–1850');
    expect(container.querySelectorAll('.atrium-event').length).toBeGreaterThanOrEqual(50);

    container.querySelector('[data-lane="economic-technology"]').click();
    expect(container.querySelectorAll('.atrium-time-lane')).toHaveLength(1);
    expect(container.querySelectorAll('.atrium-event').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.atrium-detail h2').textContent).toContain('Watt');
    expect(container.querySelector('.atrium-review-panel').textContent).toContain('Date basis');

    atrium.destroy();
  });

  it('provides an equivalent searchable list representation', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-view-mode="list"]').click();
    const search = container.querySelector('.atrium-search input');
    search.value = 'plotinus';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    const items = container.querySelectorAll('.atrium-list-item');
    expect(items.length).toBeGreaterThan(0);
    expect([...items].some(item => item.textContent.includes('Plotinus'))).toBe(true);
    expect([...items].every(item => item.textContent.toLocaleLowerCase().includes('plotin'))).toBe(true);
    expect(container.querySelector('.atrium-detail h2').textContent).toBe('Plotinus');

    atrium.destroy();
  });

  it('returns to the Portal through the supplied navigation contract', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-action="back"]').click();
    expect(onNavigate).toHaveBeenCalledWith('portal');
    atrium.destroy();
  });

  it('opens a journey source plan without exposing or substituting passage text', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('.atrium-detail-scroll').scrollTop = 120;
    container.querySelector('[data-journey-id="seq-ph-plato-ascent"]').click();

    const inspection = container.querySelector('.atrium-journey-inspection');
    expect(inspection).not.toBeNull();
    expect(inspection.querySelectorAll('.atrium-source-plan > li')).toHaveLength(2);
    expect(inspection.textContent).toContain('The divided line');
    expect(inspection.textContent).toContain('Verified excerpts are packaged offline');
    expect(inspection.textContent).not.toContain('The sun');
    expect(container.querySelector('.atrium-detail-scroll').scrollTop).toBe(120);

    atrium.destroy();
  });

  it('makes unresolved counter-archive requirements visible in history journeys', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-domain="history"]').click();
    container.querySelector('[data-select-id="hist-haitian-uprising"]').click();
    container.querySelector('[data-journey-id="seq-hist-haiti-freedom-state"]').click();

    const requirements = container.querySelector('.atrium-open-requirements');
    expect(requirements.textContent).toContain('authenticated counter-archive testimony');
    expect(requirements.textContent).toContain('1793/1794 emancipation decree');

    atrium.destroy();
  });

  it('defaults to the semantic list on narrow screens while keeping Map available', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const atrium = new Atrium(container, { onNavigate });

    expect(container.querySelector('[data-view-mode="list"]').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.atrium-list')).not.toBeNull();

    container.querySelector('[data-view-mode="map"]').click();
    expect(container.querySelector('.atrium-graph-scroll')).not.toBeNull();

    atrium.destroy();
  });

  it('restores an exact Atrium origin and its expanded source plan', () => {
    const atrium = new Atrium(container, {
      onNavigate,
      domain: 'history',
      selectedId: 'hist-haitian-uprising',
      expandedJourneyId: 'seq-hist-haiti-freedom-state'
    });

    expect(container.querySelector('.atrium-detail h2').textContent).toContain('Uprising in northern Saint-Domingue');
    expect(container.querySelector('[data-domain="history"]').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.atrium-journey-inspection')).not.toBeNull();
    expect(container.querySelector('[data-journey-id="seq-hist-haiti-freedom-state"]')
      .getAttribute('aria-expanded')).toBe('true');

    atrium.destroy();
  });
});
