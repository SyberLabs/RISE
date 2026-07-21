import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Atrium, layoutPhilosophyConstellation } from './Atrium.js';
import { PHILOSOPHY_CORPUS } from '../content/atrium/index.js';

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
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('4 cleared passages');
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('3 curated journeys ready');
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
      expect.objectContaining({ id: 'point-ph-thinker-plato', kind: 'point', status: 'publishable' }),
      {
        domain: 'philosophy',
        expandedJourneyId: null,
        selectedId: 'ph-thinker-plato',
        viewMode: 'map'
      }
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
    const originalDetail = container.querySelector('.atrium-detail');
    const search = container.querySelector('.atrium-search input');
    search.value = 'plotinus';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    const items = container.querySelectorAll('.atrium-list-item');
    expect(items.length).toBeGreaterThan(0);
    expect([...items].some(item => item.textContent.includes('Plotinus'))).toBe(true);
    expect([...items].every(item => item.textContent.toLocaleLowerCase().includes('plotin'))).toBe(true);
    expect(container.querySelector('.atrium-detail')).toBe(originalDetail);
    expect(container.querySelector('.atrium-detail h2').textContent).toBe('Plato');

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
    expect(inspection.querySelectorAll('.atrium-source-plan > li')).toHaveLength(5);
    expect(inspection.textContent).toContain('The divided line');
    expect(inspection.textContent).toContain('Verified excerpts are packaged offline');
    expect(inspection.textContent).not.toContain('The sun');
    expect(container.querySelector('.atrium-detail-scroll').scrollTop).toBe(120);

    atrium.destroy();
  });

  it('presents the cleared Haitian journey as a five-document source plan', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-domain="history"]').click();
    container.querySelector('[data-select-id="hist-haitian-uprising"]').click();
    container.querySelector('[data-journey-id="seq-hist-haiti-freedom-state"]').click();

    const inspection = container.querySelector('.atrium-journey-inspection');
    expect(inspection.querySelectorAll('.atrium-source-plan > li')).toHaveLength(5);
    expect(inspection.textContent).toContain('General liberty or death');
    expect(inspection.textContent).toContain('Freedom and the plantation regime');
    expect(inspection.textContent).toContain('Abolition debated and decreed');
    expect(inspection.querySelector('.atrium-open-requirements')).toBeNull();
    expect(inspection.querySelector('[data-action="configure-launch"]')).not.toBeNull();

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

  it('renders an accessible static Constellation and reveals selected edge evidence', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-view-mode="graph"]').click();

    expect(container.querySelectorAll('.atrium-constellation-node')).toHaveLength(35);
    expect(container.querySelectorAll('.atrium-edge-hit').length).toBeGreaterThanOrEqual(50);
    const edge = container.querySelector('.atrium-edge-hit');
    expect(edge.getAttribute('role')).toBe('button');
    expect(edge.getAttribute('tabindex')).toBe('0');
    edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(container.querySelector('.atrium-edge-detail')).not.toBeNull();
    expect(container.querySelector('.atrium-edge-detail').textContent).toContain('review');

    container.querySelector('[data-select-id="ph-thinker-aristotle"]').click();
    expect(container.querySelectorAll('.atrium-constellation-edge.incoming-pulse').length).toBeGreaterThan(0);
    const selectedNode = container.querySelector('[data-constellation-node="ph-thinker-aristotle"]');
    selectedNode.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(container.querySelectorAll('.atrium-constellation-edge.dimmed').length).toBeGreaterThan(0);

    atrium.destroy();
  });

  it('keeps the one-pass barycenter layout deterministic', () => {
    const first = [...layoutPhilosophyConstellation(PHILOSOPHY_CORPUS.nodes, PHILOSOPHY_CORPUS.edges)];
    const second = [...layoutPhilosophyConstellation(PHILOSOPHY_CORPUS.nodes, PHILOSOPHY_CORPUS.edges)];
    expect(second).toEqual(first);
  });

  it('shows compiler timing in a ready boarding card and launches that exact journey', () => {
    const onConfigureLaunch = vi.fn();
    const atrium = new Atrium(container, { onNavigate, onConfigureLaunch });
    container.querySelector('[data-journey-id="seq-ph-plato-ascent"]').click();

    const inspection = container.querySelector('.atrium-journey-inspection');
    expect(inspection.textContent).toContain('compiler total');
    expect(inspection.textContent).toMatch(/min|sec/);
    inspection.querySelector('[data-action="configure-launch"]').click();
    expect(onConfigureLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seq-ph-plato-ascent' }),
      expect.objectContaining({ expandedJourneyId: 'seq-ph-plato-ascent' })
    );

    atrium.destroy();
  });

  it('navigates a reviewed editorial echo across domains while preserving prior selection', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-select-id="ph-thinker-aristotle"]').click();
    const echo = container.querySelector('[data-echo-id="echo-aristotle-constitution"]');
    expect(echo).not.toBeNull();
    echo.click();

    expect(container.querySelector('[data-domain="history"]').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.atrium-detail h2').textContent).toContain('United States Constitution');
    container.querySelector('[data-domain="philosophy"]').click();
    expect(container.querySelector('.atrium-detail h2').textContent).toBe('Aristotle');

    atrium.destroy();
  });

  it('labels nodes without a cleared point honestly', () => {
    const atrium = new Atrium(container, { onNavigate, onConfigureLaunch: vi.fn() });
    container.querySelector('[data-select-id="ph-thinker-xenophanes"]').click();
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('Corpus passage pending');
    expect(container.querySelector('.atrium-launch-gate button')).toBeNull();
    expect(container.querySelector('.atrium-launch-pending').getAttribute('role')).toBe('status');
    atrium.destroy();
  });

  it('surfaces repaired journey-only coverage instead of calling it pending', () => {
    const atrium = new Atrium(container, { onNavigate, onConfigureLaunch: vi.fn() });
    container.querySelector('[data-select-id="ph-period-early-greek"]').click();
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('Journey available');
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('1 curated journey is ready');
    expect(container.querySelector('[data-journey-id="seq-ph-archai-being"]')).not.toBeNull();
    expect(container.querySelector('.atrium-launch-gate button')).toBeNull();
    atrium.destroy();
  });

  it('explains accepted non-launch records instead of presenting generic failure', () => {
    const atrium = new Atrium(container, { onNavigate });
    container.querySelector('[data-select-id="ph-school-alexandrian-neoplatonism"]').click();
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('Context node');
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('heterogeneous Alexandrian commentary tradition');

    container.querySelector('[data-domain="history"]').click();
    container.querySelector('[data-select-id="hist-mexican-insurgency"]').click();
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('Evidence-bound');
    expect(container.querySelector('.atrium-launch-gate').textContent).toContain('No authoritative verbatim transcript');
    atrium.destroy();
  });
});
