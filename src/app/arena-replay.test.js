import { describe, expect, it, vi } from 'vitest';
import { ARENA_CASE, ARENA_REPLAY_FILE, arenaIndexFixture, arenaReplayFixture } from '../test/arena-run.fixture.js';
import { arenaCase, loadArenaRun, mountArenaReplay } from './arena-replay.js';
import { arenaFromPath } from '../core/jev-demo-path.js';
import { resolveJevReading } from './jev-reading.js';

const files = (index = arenaIndexFixture(), run = arenaReplayFixture()) => async path => {
  if (path === '/content/arena/index.json') return index;
  if (path === `/content/arena/${ARENA_REPLAY_FILE}`) return run;
  throw new Error(`${path}: 404`);
};

async function mount(options) {
  const section = document.createElement('section');
  const launch = vi.fn(async () => {});
  const go = vi.fn();
  await mountArenaReplay(section, { launch, go, load: files(), ...options });
  return { section, launch, go };
}

describe('arena replay', () => {
  it('reads the arena list, a case, and a case\'s decider from the address, and nothing else', () => {
    expect(arenaFromPath('/arena')).toEqual({ caseId: null, decider: null });
    expect(arenaFromPath('/arena/')).toEqual({ caseId: null, decider: null });
    expect(arenaFromPath('/arena/quiet-evening')).toEqual({ caseId: 'quiet-evening', decider: null });
    expect(arenaFromPath('/arena/quiet-evening/kev')).toEqual({ caseId: 'quiet-evening', decider: 'kev' });
    expect(arenaFromPath('/arena/quiet-evening/claude')).toBeNull();
    expect(arenaFromPath('/arenas')).toBeNull();
    expect(arenaFromPath('/arena/%E0')).toBeNull();
  });

  it('replays each decider\'s first run under RISE\'s replay label, through the reading gate', async () => {
    const run = await loadArenaRun(files());
    expect(run.createdAt).toBe('2026-10-07');
    expect(run.cases).toEqual([{ id: ARENA_CASE, request: 'I need a very slow, restful reading tonight.' }]);
    const deciders = arenaCase(run, ARENA_CASE);
    expect(deciders.openai.decision).toMatchObject({ model: 'rise/arena-replay-1', provider: 'RISE', sourceModel: 'gpt-6-luna-2026-09-01', requestId: 'run-0123456789ab.json' });
    expect(deciders.jev.decision.sourceModel).toBe('typesafe/jev-1.13');
    expect(deciders.kev).toEqual({ status: 'not run' });
    expect(deciders.rules).toEqual({ status: 'rejected: OUT_OF_MENU' });
    const [a, b] = await Promise.all([resolveJevReading(deciders.openai.decision), resolveJevReading(deciders.jev.decision)]);
    expect(a.text).not.toBe(b.text);
  });

  it('refuses a missing or malformed index or run, and a case the run does not have', async () => {
    const run = await loadArenaRun(files());
    expect(() => arenaCase(run, 'nope')).toThrow('no case');
    expect(() => arenaCase(run, '__proto__')).toThrow('no case');
    const index = arenaIndexFixture();
    await expect(loadArenaRun(files({ ...index, runs: [{ replay: '../secrets.json', mock: false }] }))).rejects.toThrow('names no run');
    // A mock run says nothing about any model: never replayed.
    await expect(loadArenaRun(files({ ...index, runs: index.runs.filter(entry => entry.mock) }))).rejects.toThrow('names no run');
    await expect(loadArenaRun(files(undefined, { ...arenaReplayFixture(), schema: 'other/v2' }))).rejects.toThrow('not readable');
    await expect(loadArenaRun(async () => { throw new Error('404'); })).rejects.toThrow('404');
    // A host that answers every path with the app's own page has no JSON to give.
    await expect(loadArenaRun(async () => JSON.parse('<!DOCTYPE html>'))).rejects.toThrow(SyntaxError);
  });

  it('lists the run\'s cases by the reader\'s request, each a link that moves in place', async () => {
    const { section, go } = await mount({});
    expect(section.querySelector('h1').textContent).toBe('The same request, four deciders');
    const link = section.querySelector('.arena-cases a');
    expect(link.textContent).toBe('I need a very slow, restful reading tonight.');
    expect(link.getAttribute('href')).toBe(`/arena/${ARENA_CASE}`);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(go).toHaveBeenCalledWith(`/arena/${ARENA_CASE}`);
  });

  it('sets the four deciders\' book, look, sound and pace side by side, with the model that chose them, and plays the pressed one at its own address', async () => {
    const { section, launch } = await mount({ caseId: ARENA_CASE, decider: 'jev' });
    expect(section.querySelector('h1').textContent).toBe('“I need a very slow, restful reading tonight.”');
    expect(section.querySelector('[data-arena-decider="jev"]').getAttribute('aria-current')).toBe('true');
    expect(section.querySelector('[data-arena-decider="openai"] h2').textContent).toBe('A · OpenAI Decisions — gpt-6-luna-2026-09-01');
    expect(section.querySelector('[data-arena-decider="jev"] h2').textContent).toBe('B · TypeSafe Jev — typesafe/jev-1.13');
    const choices = id => Object.fromEntries([...section.querySelectorAll(`[data-arena-decider="${id}"] dt`)]
      .map(term => [term.textContent, term.nextElementSibling.textContent]));
    expect(choices('openai')).toEqual({
      Book: 'Middlemarch, by George Eliot · final section',
      Look: 'line art · literary serif',
      Sound: 'silence',
      Pace: 'steady words'
    });
    expect(choices('jev').Book).toBe('Middlemarch, by George Eliot · opening section');
    expect(section.querySelector('[data-arena-decider="kev"]').textContent).toContain('not run');
    expect(section.querySelector('[data-arena-decider="rules"]').textContent).toContain('rejected: OUT_OF_MENU');
    expect(section.querySelectorAll('button[data-arena-play]')).toHaveLength(2);
    expect(section.textContent).toContain('Frozen result captured 2026-10-07. Independent comparison; no partnership with OpenAI or TypeSafe.');
    const play = section.querySelector('button[data-arena-play="openai"]');
    expect(play.textContent).toBe('Play this one');
    expect(play.getAttribute('aria-label')).toBe('Play this one: A · OpenAI Decisions');
    play.click();
    await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
    expect(launch.mock.calls[0][0].sourceModel).toBe('gpt-6-luna-2026-09-01');
    expect(launch.mock.calls[0][1]).toBe(`/arena/${ARENA_CASE}/openai`);
  });

  it('says plainly when there is no published run, or no such case, and links on', async () => {
    const none = await mount({ caseId: ARENA_CASE, load: async () => JSON.parse('<!DOCTYPE html>') });
    expect(none.section.querySelector('[role="status"]').textContent).toBe('No published run yet — the comparison is being captured.');
    expect(none.section.querySelector('a').getAttribute('href')).toBe('/');
    const missing = await mount({ caseId: 'nope' });
    expect(missing.section.querySelector('[role="status"]').textContent).toBe('The published run has no case “nope”.');
    expect(missing.section.querySelector('a').getAttribute('href')).toBe('/arena');
  });
});
