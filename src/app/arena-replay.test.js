import { describe, expect, it, vi } from 'vitest';
import { ARENA_CASE, ARENA_RUN_FILE, arenaIndexFixture, arenaRunFixture } from '../test/arena-run.fixture.js';
import { loadArenaCase, mountArenaReplay } from './arena-replay.js';
import { resolveJevReading } from './jev-reading.js';

const files = (index = arenaIndexFixture(), run = arenaRunFixture()) => async path => {
  if (path === '/content/arena/index.json') return index;
  if (path === `/content/arena/${ARENA_RUN_FILE}`) return run;
  throw new Error(`${path}: 404`);
};

describe('arena replay', () => {
  it('replays each decider\'s first run under RISE\'s replay label, through the reading gate', async () => {
    const { capturedAt, deciders } = await loadArenaCase(ARENA_CASE, files());
    expect(capturedAt).toBe('2026-10-07');
    expect(deciders.openai.decision).toMatchObject({ model: 'rise/arena-replay-1', provider: 'RISE', sourceModel: 'gpt-6-luna' });
    expect(deciders.jev.decision.sourceModel).toBe('typesafe/jev-1.13');
    expect(deciders.kev).toEqual({ status: 'not run' });
    expect(deciders.rules).toEqual({ status: 'rejected: NO_BOOK' });
    const [a, b] = await Promise.all([resolveJevReading(deciders.openai.decision), resolveJevReading(deciders.jev.decision)]);
    expect(a.text).not.toBe(b.text);
  });

  it('refuses a missing or malformed index or run, and a case the run does not have', async () => {
    await expect(loadArenaCase('nope', files())).rejects.toThrow('no case');
    await expect(loadArenaCase(ARENA_CASE, files({ latest: '../secrets.json' }))).rejects.toThrow('names no run');
    await expect(loadArenaCase(ARENA_CASE, files(undefined, { ...arenaRunFixture(), schema: 'other/v2' }))).rejects.toThrow('not readable');
    await expect(loadArenaCase(ARENA_CASE, async () => { throw new Error('404'); })).rejects.toThrow('404');
  });

  it('shows the four deciders as text and buttons, and launches the pressed one at its own address', async () => {
    const section = document.createElement('section');
    const launch = vi.fn(async () => {});
    const fallback = vi.fn();
    await mountArenaReplay(section, { caseId: ARENA_CASE, decider: 'jev', launch, fallback, load: files() });
    expect(fallback).not.toHaveBeenCalled();
    expect(section.querySelector('[data-arena-decider="jev"]').getAttribute('aria-current')).toBe('true');
    expect(section.querySelector('p[data-arena-decider="kev"]').textContent).toBe('C · Kev: not run');
    expect(section.querySelector('p[data-arena-decider="rules"]').textContent).toBe('D · rules, no model: rejected: NO_BOOK');
    expect(section.textContent).toContain('Frozen result captured 2026-10-07. Independent comparison; no partnership with OpenAI or TypeSafe.');
    section.querySelector('button[data-arena-decider="openai"]').click();
    await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
    expect(launch.mock.calls[0][0].sourceModel).toBe('gpt-6-luna');
    expect(launch.mock.calls[0][1]).toBe(`/arena/${ARENA_CASE}/openai`);
  });

  it('falls back when there is nothing frozen to show', async () => {
    const fallback = vi.fn();
    await mountArenaReplay(document.createElement('section'), { caseId: 'nope', decider: 'jev', launch: vi.fn(), fallback, load: files() });
    expect(fallback).toHaveBeenCalledOnce();
  });
});
