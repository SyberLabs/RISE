// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATIONS, STATIONS_VERSICLE, STATIONS_RESPONSE, STATIONS_ATTRIBUTION, stationByNumber } from './stations.js';
import { buildStationsDefinition } from './stations-liturgy.js';
import { compileLiturgy } from '../../../core/liturgy-runner.js';
import { Via } from '../../../components/Via.js';

describe('The Stations (fourteen fixed steps)', () => {
  it('holds exactly fourteen stations, each with title, meditation, pinned image, and SHA-1', () => {
    expect(STATIONS).toHaveLength(14);
    STATIONS.forEach((station, index) => {
      expect(station.number).toBe(index + 1);
      expect(station.title).toBeTruthy();
      expect(station.meditation).toMatch(/^Consider/);
      expect(station.image).toMatch(/^https:\/\/upload\.wikimedia\.org\/.*VIA_CRUCIS/);
      expect(station.sha1).toMatch(/^[a-f0-9]{40}$/);
      expect(station.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    });
    // The traditional fourteen in order
    expect(STATIONS[0].title).toBe('Jesus is condemned to death');
    expect(STATIONS[3].title).toBe('Jesus meets His mother');
    expect(STATIONS[5].title).toBe('Veronica wipes the face of Jesus');
    expect(STATIONS[11].title).toBe('Jesus dies on the Cross');
    expect(STATIONS[13].title).toBe('Jesus is laid in the tomb');
    expect(stationByNumber(15)).toBeNull();
  });

  it('one coherent cycle: every image from Tiepolo at San Polo, one photographer credited', () => {
    // The spec preferred coherence over fame; here they coincide
    expect(STATIONS.every(station => /San_Polo/.test(station.image))).toBe(true);
    expect(STATIONS_ATTRIBUTION).toContain('Giandomenico Tiepolo');
    expect(STATIONS_ATTRIBUTION).toContain('Didier Descouens');
    expect(STATIONS_ATTRIBUTION).toContain('CC BY-SA 4.0');
    expect(STATIONS_ATTRIBUTION).toContain('Liguori');
  });

  it('compiles to the fixed form: 14 × (announce, versicle, meditation, silence) framed by opening and closing', () => {
    const compiled = compileLiturgy(buildStationsDefinition());
    const second = compileLiturgy(buildStationsDefinition());
    expect(JSON.stringify(compiled)).toBe(JSON.stringify(second)); // deterministic

    const phases = compiled.steps.map(step => step.state.phase);
    expect(phases.filter(phase => phase === 'announce')).toHaveLength(14);
    expect(phases.filter(phase => phase === 'versicle')).toHaveLength(14);
    expect(phases.filter(phase => phase === 'meditation')).toHaveLength(14);
    expect(phases.filter(phase => phase === 'silence')).toHaveLength(14);
    expect(phases[0]).toBe('opening');
    expect(phases[phases.length - 1]).toBe('closing');
    expect(compiled.steps.length).toBe(2 + 14 * 4);

    // The versicle is the traditional pair, byte-fixed
    const versicle = compiled.steps.find(step => step.state.phase === 'versicle');
    expect(versicle.text).toContain(STATIONS_VERSICLE);
    expect(versicle.text).toContain(STATIONS_RESPONSE);

    // A walked Way at meditation pace: 15–22 minutes carried
    const minutes = compiled.totalDurationMs / 60000;
    expect(minutes).toBeGreaterThan(12);
    expect(minutes).toBeLessThan(24);
  });
});

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const via = new Via(container, options);
  via.activate();
  return { container, via };
}

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('The Via room', () => {
  it('opens choosing: the fourteen-frame nave, sound, walked mode, one Start, full attribution', () => {
    const { container } = mount();
    expect(container.querySelectorAll('.via-nave-frame')).toHaveLength(14);
    expect(container.querySelector('[data-action="start"]')).not.toBeNull();
    expect(container.querySelector('.via-attribution').textContent).toContain('Didier Descouens');
    // manual is the default (spec: the reader walks the nave)
    expect(container.querySelector('[data-advance="manual"]').classList.contains('via-pill-selected')).toBe(true);
  });

  it('walks by hand: each click is a step; the strip marks the station', () => {
    const { container, via } = mount();
    container.querySelector('[data-action="start"]').click();
    expect(via.phase).toBe('walking');
    expect(container.querySelector('.via-text').textContent).toContain('walk with us');

    // into the first station's announcement
    container.querySelector('[data-action="advance"]').click();
    expect(container.querySelector('.via-text').textContent).toContain('The First Station');
    expect(container.querySelector('.via-art img').alt).toBe('Jesus is condemned to death');
    expect(container.querySelector('.via-strip-here')).not.toBeNull();

    // versicle → meditation → silence, same painting held
    container.querySelector('[data-action="advance"]').click();
    expect(container.querySelector('.via-text').textContent).toContain('We adore Thee');
    container.querySelector('[data-action="advance"]').click();
    expect(container.querySelector('.via-text').textContent).toMatch(/^Consider/);
    container.querySelector('[data-action="advance"]').click();
    expect(container.querySelector('.via-art-dimmed')).not.toBeNull(); // silence dims the canvas
  });

  it('Carried mode times the phases', () => {
    vi.useFakeTimers();
    const { container, via } = mount();
    container.querySelector('[data-advance="auto"]').click();
    container.querySelector('[data-action="start"]').click();
    expect(via.compiled.steps[via.stepIndex].id).toBe('via-opening');
    vi.advanceTimersByTime(9100);
    expect(via.compiled.steps[via.stepIndex].id).toBe('station-1-announce');
    vi.useRealTimers();
  });

  it('escape: walking → choosing → Chapel; the quiet exit leaves directly', () => {
    const onNavigate = vi.fn();
    const { container, via } = mount({ onNavigate });
    container.querySelector('[data-action="start"]').click();
    expect(via.handleEscape()).toBe(true);
    expect(via.phase).toBe('choosing');
    expect(via.handleEscape()).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('chapel');

    // and mid-walk, the quiet exit goes straight home
    const again = mount({ onNavigate: vi.fn() });
    again.container.querySelector('[data-action="start"]').click();
    expect(again.container.querySelector('.via-quiet-exit')).not.toBeNull();
  });

  it('contains no probabilistic machinery', () => {
    for (const path of ['src/components/Via.js', 'src/content/chapel/liturgy/stations-liturgy.js', 'src/content/chapel/liturgy/stations.js']) {
      const source = readFileSync(resolve(path), 'utf8');
      expect(source, path).not.toMatch(/Math\.random\s*\(|new ShuffleBag|\.draw\(/);
    }
  });
});
