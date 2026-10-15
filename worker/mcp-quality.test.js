// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import { CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2 } from '../src/live/guide/index.js';
import { FOREST_AFTER_FIRE, WEATHER_CHAOS } from '../src/live/fixtures/explanations.js';
import { LAYOUT_RULES } from '../src/core/quality/svg-layout.js';
import { DRY_RUN_1_THREE_FRAMES } from '../src/core/quality/fixtures/figures.js';
import sample from '../src/core/changes/fixtures/2026-10-14.json' with { type: 'json' };
import { QUALITY_BYTES, QUALITY_WORK, logQuality, qualityRecord } from './mcp-quality.mjs';

const SITE = 'https://rise.example';
const ON = { MCP_ENABLED: 'true' };
const KEYS = ['event', 'rules', 'beats', 'scenes', 'longestHold'];

/** A Current of beats whose second beat starts the dry run's three frames, whose label crosses its box. */
const DRY_RUN = {
  ...CURRENT_EXAMPLE_V2,
  scenes: [{ id: 'frames', svg: DRY_RUN_1_THREE_FRAMES }],
  beats: [{ say: 'Three frames.' }, { say: 'The inner eye, the outer shell, the full frame.', scene: 'frames' }]
};
const ADMITTED = { CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2, BLACK_HOLES_CURRENT, FOREST_AFTER_FIRE, WEATHER_CHAOS, sample: sample.current, DRY_RUN };

const call = (handleMcp, current) => handleMcp(new Request(`${SITE}/api/mcp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'rise_present', arguments: { current } } })
}), ON);
const bytes = async response => ({ status: response.status, headers: [...response.headers], body: await response.text() });

afterEach(() => {
  vi.doUnmock('./mcp-quality.mjs');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('the connector’s quality count', () => {
  it('counts the layout rules a Current’s figures break, and how often its picture changes', () => {
    expect(qualityRecord(DRY_RUN)).toEqual({ event: 'rise.quality', rules: { 'text-crosses-shape': 1 }, beats: 2, scenes: 1, longestHold: 1 });
    expect(qualityRecord(sample.current)).toEqual({ event: 'rise.quality', rules: {}, beats: 15, scenes: 8, longestHold: 3 });
    expect(qualityRecord(FOREST_AFTER_FIRE)).toMatchObject({ rules: {}, beats: FOREST_AFTER_FIRE.segments.length });
  });

  it('holds rule ids and counts only: never text, never SVG, never anything the host wrote', () => {
    const lines = [];
    logQuality(DRY_RUN, line => lines.push(line));
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(Object.keys(record)).toEqual(KEYS);
    expect(record.event).toBe('rise.quality');
    expect(Object.keys(record.rules).every(rule => [...LAYOUT_RULES, 'unchecked'].includes(rule))).toBe(true);
    expect(Object.values(record.rules).every(Number.isInteger)).toBe(true);
    for (const key of ['beats', 'scenes', 'longestHold']) expect(Number.isInteger(record[key])).toBe(true);
    for (const written of ['harmonograph', 'Three frames', '<svg', 'inner eye', DRY_RUN.title, DRY_RUN.id]) expect(lines[0]).not.toContain(written);
  });

  describe('spends at most its budget on one Current, and counts the figures it left unchecked', () => {
    const labels = count => Array.from({ length: count }, (_, i) => `<text x="${(i * 7) % 380}" y="${20 + ((i * 13) % 360)}">ab</text>`).join('');
    const figure = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="currentColor">${body}</svg>`;
    const withFigure = svg => ({ ...DRY_RUN, scenes: [...DRY_RUN.scenes, { id: 'heavy', svg }], beats: [...DRY_RUN.beats, { say: 'More.', scene: 'heavy' }] });

    it('in comparisons', () => {
      const svg = figure(labels(250));
      expect(svg.length).toBeLessThan(QUALITY_BYTES - DRY_RUN_1_THREE_FRAMES.length);
      expect(250 * 250).toBeGreaterThan(QUALITY_WORK);
      expect(qualityRecord(withFigure(svg)).rules).toEqual({ 'text-crosses-shape': 1, unchecked: 1 });
    });

    it('in figure text read', () => {
      const svg = figure(`<path d="M0,0${' L1,1'.repeat(QUALITY_BYTES / 5)}" stroke="currentColor"/>`);
      expect(svg.length).toBeGreaterThan(QUALITY_BYTES);
      expect(qualityRecord(withFigure(svg)).rules).toEqual({ 'text-crosses-shape': 1, unchecked: 1 });
    });
  });

  it('never throws: not for a Current it cannot read, nor for a log that fails', () => {
    expect(() => logQuality(null, () => {})).not.toThrow();
    expect(() => logQuality({ scenes: 'not a list', beats: 3 }, () => {})).not.toThrow();
    expect(() => logQuality(DRY_RUN, () => { throw new Error('the log is down'); })).not.toThrow();
  });

  it('logs one line for each Current the door admits, and none for one it refuses', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { handleMcp } = await import('./mcp-server.mjs');
    await call(handleMcp, DRY_RUN);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: 'rise.quality', rules: { 'text-crosses-shape': 1 } });
    await call(handleMcp, { ...DRY_RUN, theme: 'plaid' });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('changes nothing the connector answers: every response is byte-identical with and without the count', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { handleMcp: withCount } = await import('./mcp-server.mjs');
    vi.resetModules();
    vi.doMock('./mcp-quality.mjs', () => ({ logQuality: () => {} }));
    const { handleMcp: without } = await import('./mcp-server.mjs');
    for (const current of [...Object.values(ADMITTED), { ...DRY_RUN, theme: 'plaid' }, { ...DRY_RUN, scenes: [{ id: 'frames', svg: '<svg><script/></svg>' }] }]) {
      expect(await bytes(await call(withCount, current))).toEqual(await bytes(await call(without, current)));
    }
  });
});
