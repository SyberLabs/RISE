// @vitest-environment node
/**
 * SyberLabs telemetry in RISE (telemetry.v1), and the connector's counts.
 *
 * What is held: nothing telemetry/events.json does not name is written, and every field it names is a closed list of
 * values or a count; each rise_present call the door admits or refuses is one data point of its host app and of what
 * the door did, and nothing the host sent is in it; and a count changes nothing: every answer is byte-identical with
 * the binding absent, present and throwing.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import { CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2 } from '../src/live/guide/index.js';
import { FOREST_AFTER_FIRE, WEATHER_CHAOS } from '../src/live/fixtures/explanations.js';
import { DRY_RUN_1_THREE_FRAMES } from '../src/core/quality/fixtures/figures.js';
import { pictureCadence } from '../src/core/quality/cadence.js';
import sample from '../src/core/changes/fixtures/2026-10-14.json' with { type: 'json' };
import allowlist from '../telemetry/events.json' with { type: 'json' };
import { RELEASE, countEvent, dataPoint } from './telemetry.mjs';
import { APP_URI, handleMcp, hostOf } from './mcp-server.mjs';

const SITE = 'https://rise.example';
const ON = { MCP_ENABLED: 'true' };
const ADMITTED = 'rise.current.admitted';
const REFUSED = 'rise.current.refused';
const CLAUDE = { 'CF-Connecting-IP': '160.79.104.10' };
const CHATGPT = { 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'openai-mcp/1.0.0' };
/** The codes the door refuses with itself, beside the validator's. */
const DOOR = ['MCP_ARGUMENTS', 'MCP_TOO_LARGE', 'SCENE_COLLECTION', 'SCENE_CODE_ADMISSION', 'SCENE_SVG_ADMISSION'];

/** An EVENTS binding that keeps what it is given. */
function recorder() {
  const points = [];
  return { points, env: { EVENTS: { writeDataPoint: point => points.push(point) } } };
}

const rpc = (method, params) => ({ jsonrpc: '2.0', id: 7, method, params });
const present = args => rpc('tools/call', { name: 'rise_present', arguments: args });
const post = (body, { env = {}, headers = {} } = {}) => handleMcp(new Request(`${SITE}/api/mcp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
}), { ...ON, ...env });
const bytes = async response => ({ status: response.status, headers: [...response.headers], body: await response.text() });

const withScene = scene => {
  const current = structuredClone(CURRENT_EXAMPLE_V2);
  current.scenes.push(scene);
  return current;
};
/** A Current of beats whose second beat starts the dry run's three frames. */
const DRY_RUN = {
  ...CURRENT_EXAMPLE_V2,
  scenes: [{ id: 'frames', svg: DRY_RUN_1_THREE_FRAMES }],
  beats: [{ say: 'Three frames.' }, { say: 'The inner eye, the outer shell, the full frame.', scene: 'frames' }]
};
/** Valid, and over the MCP-only budget (mcp-server.test.js). */
const TOO_LARGE = {
  ...BLACK_HOLES_CURRENT,
  segments: Array.from({ length: 16 }, (_, s) => ({
    id: `s${s}`,
    text: '界 '.repeat(625),
    visual: 'still',
    dives: Array.from({ length: 8 }, (_, d) => ({ id: `d${s}-${d}`, text: '界'.repeat(200), anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: '界', quoteEnd: '界' } }))
  }))
};

const ADMISSIONS = { CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2, BLACK_HOLES_CURRENT, FOREST_AFTER_FIRE, WEATHER_CHAOS, sample: sample.current, DRY_RUN };
/** What is refused, the call's arguments, and the code the refusal is counted under. */
const REFUSALS = [
  ['no Current', {}, 'MCP_ARGUMENTS'],
  ['a Current that is not an object', { current: 'Black holes' }, 'MCP_ARGUMENTS'],
  ['an argument beside the Current', { current: BLACK_HOLES_CURRENT, theme: 'jade' }, 'MCP_ARGUMENTS'],
  ['a Current over the MCP budget', { current: TOO_LARGE }, 'MCP_TOO_LARGE'],
  ['a theme off the catalog', { current: { ...BLACK_HOLES_CURRENT, theme: 'plaid' } }, 'CURRENT_THEME'],
  ['a field the validator does not know', { current: { ...BLACK_HOLES_CURRENT, mood: 'calm' } }, 'CURRENT_UNKNOWN_FIELD'],
  ['a playback marker in its text', { current: { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'a | b' }] } }, 'CURRENT_RESERVED_TEXT'],
  ['a cue to a figure', { current: { ...DRY_RUN, beats: [{ say: 'Three frames.', scene: 'frames', cue: 'spin' }] } }, 'BEAT_CUE'],
  ['a scene that names a collection', { current: withScene({ id: 'sky', engine: 'astronomy' }) }, 'SCENE_COLLECTION'],
  ['scene code its parse refuses', { current: withScene({ id: 'vector', code: 'export default function scene(rise) {\n  debugger;\n  return { frame() {} };\n}\n' }) }, 'SCENE_CODE_ADMISSION'],
  ['a figure with a script', { current: withScene({ id: 'triangle', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n  <script>alert(1)</script>\n</svg>' }) }, 'SCENE_SVG_ADMISSION']
];

afterEach(() => {
  vi.doUnmock('../src/core/rise-current.js');
  vi.resetModules();
});

describe('the allowlist', () => {
  it('is version 1 of one dataset, and each event is <system>.<object>.<outcome> with an owner and the decision it informs', () => {
    expect(allowlist.version).toBe(1);
    expect(allowlist.dataset).toBe('syberlabs_events');
    expect(Object.keys(allowlist.events)).toEqual([ADMITTED, REFUSED, 'rise.reading.begun', 'rise.reading.ended', 'rise.app.failed', 'rise.reading.first_word']);
    for (const [event, spec] of Object.entries(allowlist.events)) {
      expect(event).toMatch(/^[a-z]+\.[a-z_]+\.[a-z_]+$/u);
      expect(Object.keys(spec), event).toEqual(['owner', 'decision', 'blobs', 'doubles']);
      expect(spec.owner, event).toMatch(/\S/u);
      expect(spec.decision, event).toMatch(/\S/u);
    }
  });

  it('gives every field a closed list of values or makes it a count, and fits a data point', () => {
    for (const [event, spec] of Object.entries(allowlist.events)) {
      for (const blob of spec.blobs) {
        expect(Object.keys(blob).every(key => ['name', 'values', 'derived'].includes(key)), `${event}.${blob.name}`).toBe(true);
        expect(blob.values.length, `${event}.${blob.name}`).toBeGreaterThan(0);
        expect(blob.values.every(value => typeof value === 'string' && /^[A-Za-z0-9_]+$/u.test(value)), `${event}.${blob.name}`).toBe(true);
        expect(new Set(blob.values).size, `${event}.${blob.name}`).toBe(blob.values.length);
      }
      // A count is any whole number from 0, or one of a rising list of them, or a step up to a most.
      for (const double of spec.doubles) {
        expect([['name'], ['name', 'values'], ['name', 'max', 'step']], `${event}.${double.name}`).toContainEqual(Object.keys(double));
        if (double.values) expect(double.values.every((value, i) => Number.isSafeInteger(value) && value >= 0 && (i === 0 || value > double.values[i - 1])), `${event}.${double.name}`).toBe(true);
        if (double.max !== undefined) expect(Number.isSafeInteger(double.max) && Number.isSafeInteger(double.step) && double.step > 0 && double.max % double.step === 0, `${event}.${double.name}`).toBe(true);
      }
      const names = [...spec.blobs, ...spec.doubles].map(field => field.name);
      expect(new Set(names).size, event).toBe(names.length);
      // The event and the release lead the blobs, and the 1 the doubles; Analytics Engine takes twenty of each.
      expect(spec.blobs.length + 2).toBeLessThanOrEqual(20);
      expect(spec.doubles.length + 1).toBeLessThanOrEqual(20);
    }
  });

  it('names every code the door can refuse with, and none it cannot', () => {
    // What the validator the door calls can throw: the codes written in the modules validateRiseCurrent reaches.
    const validator = ['src/core/current-validation.js', 'src/core/rise-current.js', 'src/core/beats.js', 'src/scenes/manifests.js']
      .flatMap(file => [...readFileSync(file, 'utf8').matchAll(/'((?:CURRENT|BEAT|SCENE)_[A-Z_]+)'/gu)].map(match => match[1]))
      // compileRiseCurrent's alone: the door validates a Current and never compiles one.
      .filter(code => code !== 'CURRENT_PROJECTION');
    const codes = allowlist.events[REFUSED].blobs.find(blob => blob.name === 'code').values;
    expect(new Set(codes)).toEqual(new Set([...validator, ...DOOR, 'other']));
  });
});

describe('a data point', () => {
  const fields = { host: 'claude', beats: 3, scenes: 1 };

  it('is the event as its index, the event, the release and its values as blobs, and 1 and its counts as doubles, in the allowlist’s order', () => {
    expect(RELEASE).toBe('unknown');
    expect(dataPoint(ADMITTED, fields)).toEqual({ indexes: [ADMITTED], blobs: [ADMITTED, 'unknown', 'claude'], doubles: [1, 3, 1] });
    expect(dataPoint(ADMITTED, { scenes: 1, beats: 3, host: 'claude' })).toEqual(dataPoint(ADMITTED, fields));
    expect(dataPoint(REFUSED, { code: 'CURRENT_THEME', host: 'chatgpt' })).toEqual({ indexes: [REFUSED], blobs: [REFUSED, 'unknown', 'chatgpt', 'CURRENT_THEME'], doubles: [1] });
    expect(dataPoint('rise.reading.ended', { browser: 'safari', device: 'mobile', end: 'yes', minutes: 10 }))
      .toEqual({ indexes: ['rise.reading.ended'], blobs: ['rise.reading.ended', 'unknown', 'safari', 'mobile', 'yes'], doubles: [1, 10] });
    expect(dataPoint('rise.reading.first_word', { browser: 'edge', device: 'desktop', ms: 60_000 }))
      .toEqual({ indexes: ['rise.reading.first_word'], blobs: ['rise.reading.first_word', 'unknown', 'edge', 'desktop'], doubles: [1, 60_000] });
  });

  it('is nothing for a number off its field’s list, past its most, or between its steps', () => {
    const ended = minutes => dataPoint('rise.reading.ended', { browser: 'chrome', device: 'desktop', end: 'no', minutes });
    const first = ms => dataPoint('rise.reading.first_word', { browser: 'chrome', device: 'desktop', ms });
    expect([1, 2, 5, 10, 20, 30, 60, 120].every(minutes => ended(minutes) !== null)).toBe(true);
    for (const minutes of [0, 3, 7.5, 121, 240]) expect(ended(minutes), String(minutes)).toBeNull();
    expect([0, 50, 1250, 60_000].every(ms => first(ms) !== null)).toBe(true);
    for (const ms of [1234, 25, 60_050, -50, 1250.5]) expect(first(ms), String(ms)).toBeNull();
  });

  it('is nothing for anything the allowlist does not name', () => {
    for (const [event, given] of [
      ['rise.current.viewed', fields], ['constructor', {}], ['__proto__', {}], ['toString', {}], [undefined, fields],
      [ADMITTED, { host: 'claude', beats: 3 }],
      [ADMITTED, { ...fields, title: 'Black holes' }],
      [ADMITTED, { ...fields, host: 'gemini' }], [ADMITTED, { ...fields, host: 'Claude' }], [ADMITTED, { ...fields, host: ['claude'] }],
      [ADMITTED, { ...fields, beats: 2.5 }], [ADMITTED, { ...fields, beats: -1 }], [ADMITTED, { ...fields, beats: '3' }],
      [ADMITTED, { ...fields, beats: Number.NaN }], [ADMITTED, { ...fields, beats: Number.POSITIVE_INFINITY }],
      [REFUSED, { host: 'other', code: 'RISE refused this Current: Unknown theme' }], [REFUSED, { host: 'other', code: 'CURRENT_PROJECTION' }],
      [ADMITTED, null], [ADMITTED, undefined], [ADMITTED, 'host=claude']
    ]) {
      expect(dataPoint(event, given), `${String(event)} ${JSON.stringify(given)}`).toBeNull();
    }
  });

  it('is written where EVENTS is bound, and never throws: not without a binding, nor for one that fails', () => {
    const { points, env } = recorder();
    countEvent(env, ADMITTED, fields);
    countEvent(env, ADMITTED, { ...fields, host: 'gemini' });
    expect(points).toEqual([dataPoint(ADMITTED, fields)]);
    for (const given of [undefined, null, {}, { EVENTS: null }, { EVENTS: {} }, { EVENTS: { writeDataPoint: () => { throw new Error('the dataset is down'); } } }]) {
      expect(() => countEvent(given, ADMITTED, fields)).not.toThrow();
    }
  });
});

describe('the connector’s counts', () => {
  it('names the host: Claude by Anthropic’s egress, ChatGPT by its connector’s User-Agent at its start, and anything else other', () => {
    for (const ip of ['160.79.104.0', '160.79.106.77', '160.79.111.255']) {
      expect(hostOf(ip, undefined), ip).toBe('claude');
      expect(hostOf(ip, 'openai-mcp/1.0.0'), ip).toBe('claude');
    }
    for (const agent of ['openai-mcp/1.0.0', 'openai-mcp/2.1']) expect(hostOf('192.0.2.1', agent), agent).toBe('chatgpt');
    expect(hostOf(undefined, 'openai-mcp/1.0.0')).toBe('chatgpt');
    for (const [ip, agent] of [
      [undefined, undefined], [null, null], ['', ''], ['160.79.112.0', 'Claude-User'], ['192.0.2.1', 'Mozilla/5.0 (compatible; openai-mcp/1.0.0)'],
      ['192.0.2.1', 'OpenAI-MCP/1.0.0'], ['192.0.2.1', 'openai-mcp'], ['192.0.2.1', 'ChatGPT-User/1.0'], ['::ffff:160.79.104.1', 'curl/8.5.0']
    ]) {
      expect(hostOf(ip, agent), `${ip} ${agent}`).toBe('other');
    }
  });

  it('writes one data point for each Current the door admits: its host, its beats and its scenes', async () => {
    for (const [name, current] of Object.entries(ADMISSIONS)) {
      const { points, env } = recorder();
      const answer = await (await post(present({ current }), { env, headers: CLAUDE })).json();
      expect(answer.result.isError, name).toBeUndefined();
      const { beats, scenes } = pictureCadence(current);
      expect(points, name).toEqual([{ indexes: [ADMITTED], blobs: [ADMITTED, RELEASE, 'claude'], doubles: [1, beats, scenes] }]);
    }
    const { points, env } = recorder();
    await post(present({ current: sample.current }), { env, headers: CHATGPT });
    await post(present({ current: DRY_RUN }), { env });
    expect(points.map(point => [point.blobs[2], ...point.doubles.slice(1)])).toEqual([['chatgpt', 15, 8], ['other', 2, 1]]);
  });

  it.each(REFUSALS)('writes one data point for each Current it refuses, under the refusal’s code: %s', async (_, args, code) => {
    const { points, env } = recorder();
    const answer = await (await post(present(args), { env, headers: CHATGPT })).json();
    expect(answer.result.isError).toBe(true);
    expect(points).toEqual([{ indexes: [REFUSED], blobs: [REFUSED, RELEASE, 'chatgpt', code], doubles: [1] }]);
  });

  it('counts a refusal whose code the allowlist does not name as other', async () => {
    for (const thrown of [new TypeError('surprise'), Object.assign(new Error('A new rule'), { code: 'CURRENT_NEW_RULE' })]) {
      vi.resetModules();
      vi.doMock('../src/core/rise-current.js', async original => ({ ...await original(), validateRiseCurrent: () => { throw thrown; } }));
      const { handleMcp: door } = await import('./mcp-server.mjs');
      const { points, env } = recorder();
      await door(new Request(`${SITE}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(present({ current: BLACK_HOLES_CURRENT })) }), { ...ON, ...env });
      expect(points).toEqual([{ indexes: [REFUSED], blobs: [REFUSED, RELEASE, 'other', 'other'], doubles: [1] }]);
    }
  });

  it('writes nothing for anything else the door answers, nor for what it turns away before reading', async () => {
    const { points, env } = recorder();
    for (const body of [
      rpc('initialize', { protocolVersion: '2025-06-18' }), rpc('ping'), rpc('tools/list'), rpc('resources/list'), rpc('resources/read', { uri: APP_URI }),
      rpc('tools/call', { name: 'rise_guide', arguments: { style: 'explainer' } }), rpc('tools/call', { name: 'other', arguments: {} }),
      { jsonrpc: '2.0', method: 'notifications/initialized' }
    ]) await post(body, { env, headers: CLAUDE });
    await post(present({ current: BLACK_HOLES_CURRENT }), { env: { ...env, MCP_ENABLED: 'false' } });
    await post(present({ current: BLACK_HOLES_CURRENT }), { env, headers: { Origin: 'https://evil.example' } });
    await post(present({ current: BLACK_HOLES_CURRENT }), { env: { ...env, DECISION_LIMITER: { limit: async () => ({ success: false }) } }, headers: { 'CF-Connecting-IP': '192.0.2.1' } });
    expect(points).toEqual([]);
  });

  it('writes only what the allowlist names: no address, no User-Agent, nothing the host wrote', async () => {
    const { points, env } = recorder();
    const headers = { 'CF-Connecting-IP': '160.79.104.10', 'User-Agent': 'openai-mcp/1.0.0 (Mozilla/5.0; a reader)' };
    for (const current of Object.values(ADMISSIONS)) await post(present({ current }), { env, headers });
    for (const [, args] of REFUSALS) await post(present(args), { env, headers: { ...headers, 'CF-Connecting-IP': '192.0.2.1' } });
    expect(points).toHaveLength(Object.keys(ADMISSIONS).length + REFUSALS.length);
    for (const point of points) {
      const [event, release, ...values] = point.blobs;
      const spec = allowlist.events[event];
      expect(point.indexes).toEqual([event]);
      expect(release).toBe(RELEASE);
      expect(values).toHaveLength(spec.blobs.length);
      values.forEach((value, index) => expect(spec.blobs[index].values).toContain(value));
      expect(point.doubles).toHaveLength(spec.doubles.length + 1);
      expect(point.doubles[0]).toBe(1);
      expect(point.doubles.every(count => Number.isSafeInteger(count) && count >= 0)).toBe(true);
    }
    const written = JSON.stringify(points);
    for (const sent of ['160.79', '192.0.2', 'openai-mcp', 'Mozilla', 'reader', BLACK_HOLES_CURRENT.title, BLACK_HOLES_CURRENT.id, 'harmonograph', '<svg', 'jade', 'plaid']) {
      expect(written).not.toContain(sent);
    }
  });

  it('changes nothing the connector answers: every response is byte-identical with the binding absent, present and throwing', async () => {
    const bindings = [{}, recorder().env, { EVENTS: { writeDataPoint: () => { throw new Error('the dataset is down'); } } }, { EVENTS: null }, { EVENTS: {} }];
    const bodies = [rpc('ping'), rpc('tools/list'), ...Object.values(ADMISSIONS).map(current => present({ current })), ...REFUSALS.map(([, args]) => present(args))];
    for (const body of bodies) {
      for (const headers of [CLAUDE, CHATGPT]) {
        const [first, ...rest] = await Promise.all(bindings.map(async env => bytes(await post(body, { env, headers }))));
        for (const answer of rest) expect(answer).toEqual(first);
      }
    }
  });
});
