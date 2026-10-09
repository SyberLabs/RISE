/**
 * THE RENDERER CONTRACT IS A DOCUMENT, SO IT CAN DRIFT FROM THE CODE.
 *
 * `docs/specs/RISE-SDK.md` is what a third party builds against: another host,
 * another model provider, someone embedding RISE. Every number, name and list
 * it states is a fact about this tree, and each is checked here against the
 * constant that decides it (docs/PROJECT-KNOWLEDGE.md §2.1: a vocabulary in two
 * places needs a test that the two agree). A change to the contract fails here
 * until the document moves with it.
 *
 * Where a set can grow (a limit, an engine, a parameter, a `rise.lib` call, a
 * message, a banned name, an export of the SDK module), the check runs in both
 * directions: a new entry left out of the document fails as surely as an old
 * one left in.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from './rise-sdk.js';
import { describeManifests } from '../scenes/manifests.js';
import { createSceneLibrary } from '../scenes/scene-library.js';
import { MCP_CURRENT_BYTES } from '../live/hosts/mcp-size.js';
import { PORT_LIMITS, PROTOCOL_VERSION } from '../live/hosts/mcp-port.js';
import { sceneReportLine } from '../live/host/LiveHost.js';
import { SCENE_CODE_EXAMPLE, TOOL_NAME } from '../live/guide/index.js';
import { APP_MIME, APP_URI, GUIDE_TOOL_NAME, MAX_SCENE_LINES, MCP_PATH, PROTOCOL_VERSIONS, currentJsonSchemaV2 } from '../../worker/mcp-server.mjs';
import { admitSceneCode, describeDiagnostic } from '../../worker/scene-admission.mjs';
import { admitSvg } from './svg-admission.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = 'docs/specs/RISE-SDK.md';
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n');
const text = read(DOC);

const strip = cell => cell.replace(/`/gu, '').trim();
const NONE = '—';

/** Every Markdown table in the document, by its header cells. */
const tables = (() => {
  const found = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) { current = null; continue; }
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.every(cell => /^:?-+:?$/u.test(cell))) continue;
    if (current === null) { current = { header: cells.map(strip), rows: [] }; found.push(current); } else current.rows.push(cells);
  }
  return found;
})();

/** The rows of every table whose header begins with these cells. */
function rowsOf(...header) {
  const matching = tables.filter(table => header.every((cell, index) => table.header[index] === cell));
  expect(matching.length, `${DOC} has no table headed ${header.join(' | ')}`).toBeGreaterThan(0);
  return matching.flatMap(table => table.rows);
}

/** Everything the constants tables may name: the SDK module, and the host values it cannot import (they live above the core). */
const REGISTRY = { ...sdk, MCP_CURRENT_BYTES, PORT_LIMITS, PROTOCOL_VERSION, PROTOCOL_VERSIONS, MAX_SCENE_LINES, MCP_PATH, APP_URI, APP_MIME, TOOL_NAME, GUIDE_TOOL_NAME };

function resolve(name) {
  const [head, ...rest] = name.split('.');
  if (!Object.hasOwn(REGISTRY, head)) return { known: false };
  let value = REGISTRY[head];
  for (const key of rest) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { known: false };
    value = value[key];
  }
  return { known: true, value };
}

/** A value cell as the code's value would be written: a number with separators, a string, or a list. */
function parsed(cell, like) {
  const plain = strip(cell);
  if (typeof like === 'number') return Number(plain.replace(/[,_]/gu, ''));
  if (Array.isArray(like)) return plain === NONE ? [] : plain.split(',').map(item => item.trim());
  return plain;
}

const constantRows = rowsOf('Constant', 'Value');
const named = new Map(constantRows.map(([name, value]) => [strip(name), value]));

describe('the constants the document quotes', () => {
  it('are the code’s own values', () => {
    expect(constantRows.length, 'no constants were read, so this proved nothing').toBeGreaterThan(30);
    const wrong = [];
    for (const [name, cell] of named) {
      const { known, value } = resolve(name);
      if (!known) { wrong.push(`${name}: not a constant this contract exports`); continue; }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) { wrong.push(`${name}: an object; quote its keys`); continue; }
      const given = parsed(cell, value);
      if (JSON.stringify(given) !== JSON.stringify(value)) wrong.push(`${name}: the document says ${strip(cell)}, the code ${JSON.stringify(value)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('include every limit, both ways: a limit added to the code is a row missing here', () => {
    const missing = [];
    for (const group of ['BEAT_LIMITS', 'RISE_CURRENT_LIMITS', 'SCENE_LIMITS', 'LIBRARY_DEFAULTS']) {
      for (const key of Object.keys(sdk[group])) if (!named.has(`${group}.${key}`)) missing.push(`${group}.${key}`);
    }
    for (const key of ['report', 'reportLine', 'reports']) if (!named.has(`PORT_LIMITS.${key}`)) missing.push(`PORT_LIMITS.${key}`);
    expect(missing).toEqual([]);
  });

  it('name every export of the SDK module', () => {
    const quoted = new Set([...text.matchAll(/`([A-Z][A-Z0-9_]+)(?:\.[A-Za-z]+)?`/gu)].map(match => match[1]));
    expect(Object.keys(sdk).filter(name => !quoted.has(name))).toEqual([]);
  });

  it('state the SDK’s version where the status is', () => {
    expect(sdk.RISE_SDK_VERSION).toBe('1.0.0-provisional');
    expect(text.split('\n## ')[0]).toContain(`\`${sdk.RISE_SDK_VERSION}\``);
  });
});

describe('the SDK module', () => {
  const source = read('src/core/rise-sdk.js');

  it('is data only: every export is a value, none a function', () => {
    expect(Object.entries(sdk).filter(([, value]) => typeof value === 'function').map(([name]) => name)).toEqual([]);
  });

  it('reaches only the core and the scenes', () => {
    const targets = [...source.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map(match => match[1]);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter(target => !/^\.\/[\w-]+\.js$|^\.\.\/scenes\/[\w-]+\.js$/u.test(target))).toEqual([]);
  });
});

describe('the Current v2 the document describes', () => {
  const schema = currentJsonSchemaV2();
  const fieldTable = (header, properties, required = null) => {
    const rows = rowsOf(header, 'Required');
    expect(rows.map(([name]) => strip(name)).sort()).toEqual(Object.keys(properties).sort());
    if (required) expect(rows.filter(([, need]) => strip(need) === 'yes').map(([name]) => strip(name)).sort()).toEqual([...required].sort());
  };

  it('has the fields the tool’s schema has, and requires the same ones', () => {
    fieldTable('Field', schema.properties, schema.required);
  });

  it('has the beat fields the schema has', () => {
    fieldTable('Beat field', schema.properties.beats.items.properties);
  });

  it('has the scene fields the schema has', () => {
    const fields = Object.assign({}, ...schema.properties.scenes.items.oneOf.map(item => item.properties));
    fieldTable('Scene field', fields);
  });

  it('lists every refusal code a v2 Current can meet, and none that does not exist', () => {
    const literal = source => new Set([...source.matchAll(/'([A-Z]+_[A-Z0-9_]+)'/gu)].map(match => match[1]));
    const current = read('src/core/rise-current.js');
    const slice = (from, to) => current.slice(current.indexOf(from), current.indexOf(to));
    const required = new Set([
      ...literal(read('src/core/beats.js')), ...literal(read('src/scenes/manifests.js')), ...literal(read('src/core/current-validation.js')),
      ...literal(slice('function validateHead', 'export function validateRiseCurrent(')),
      ...literal(slice('function validateRiseCurrentV2', 'function timeBeats'))
    ]);
    const listed = rowsOf('Code', 'Refused when').map(([code]) => strip(code));
    expect(listed.length).toBeGreaterThan(10);
    expect([...required].filter(code => !listed.includes(code)).sort()).toEqual([]);
    expect(listed.filter(code => !required.has(code))).toEqual([]);
  });
});

describe('styles and typography', () => {
  it('give each style the defaults the code gives it', () => {
    const rows = rowsOf('Style', 'Place', 'Size').map(cells => cells.map(strip));
    const expected = Object.values(sdk.STYLES).map(style => [
      style.id, style.typography.place, style.typography.size,
      style.typography.type.text ?? NONE, style.typography.type.caption ?? NONE,
      style.library.ease, String(style.library.stroke), String(style.library.gridAlpha)
    ]);
    expect(rows).toEqual(expected);
  });

  it('list the faces RISE hosts, with their roles and weights', () => {
    const rows = rowsOf('Face', 'Role', 'Weight').map(cells => cells.map(strip));
    expect(rows).toEqual(sdk.TYPE_FACES.map(face => [face.id, face.role ?? NONE, String(face.weight)]));
  });
});

describe('the native engines', () => {
  it('are the manifests’ engines, with their kind, surface, legibility and cues', () => {
    const rows = rowsOf('Engine', 'Kind', 'Surface').map(cells => cells.map(strip));
    const cues = manifest => {
      const entries = Object.entries(manifest.cues);
      return entries.length ? entries.map(([name, sets]) => `${name} (${Object.entries(sets).map(([p, v]) => `${p}=${v}`).join(', ')})`).join(', ') : NONE;
    };
    expect(rows).toEqual(sdk.SCENE_MANIFESTS.map(manifest => [
      manifest.id, manifest.kind, manifest.surface, manifest.readableOverText ? 'yes' : 'no', cues(manifest)
    ]));
  });

  it('have the manifests’ parameters, bounds, defaults and cueability', () => {
    const rows = rowsOf('Engine', 'Parameter', 'Type').map(cells => cells.map(strip));
    const expected = sdk.SCENE_MANIFESTS.flatMap(manifest => Object.entries(manifest.parameters).map(([name, spec]) => [
      manifest.id, name, spec.type,
      spec.type === 'enum' ? spec.values.join(', ') : `${spec.minimum} to ${spec.maximum}`,
      String(spec.default), spec.cueable ? 'yes' : 'no'
    ]));
    expect(rows).toEqual(expected);
  });

  it('are the engines the model is told about', () => {
    const told = describeManifests().split('\n').map(line => line.slice(0, line.indexOf(':')));
    const documented = rowsOf('Engine', 'Kind', 'Surface').map(([engine]) => strip(engine)).filter(engine => engine !== 'still');
    expect(documented).toEqual(told);
  });
});

describe('generated scenes', () => {
  it('document every name rise.lib has', () => {
    const ctx = new Proxy({}, { get: () => () => {} });
    const lib = createSceneLibrary({ ctx, size: { width: 100, height: 100, dpr: 1 }, theme: {} });
    const rows = rowsOf('rise.lib', 'Signature').map(([name]) => strip(name));
    expect(rows.sort()).toEqual(Object.keys(lib).sort());
  });

  it('document every protocol message, both ways', () => {
    const rows = rowsOf('Message', 'Type').map(cells => cells.map(strip));
    const documented = Object.fromEntries(rows.map(([message, type]) => [message, type]));
    const expected = Object.fromEntries([
      ...Object.entries(sdk.TO_WORKER).map(([key, type]) => [`TO_WORKER.${key}`, type]),
      ...Object.entries(sdk.TO_HOST).map(([key, type]) => [`TO_HOST.${key}`, type])
    ]);
    expect(documented).toEqual(expected);
  });

  it('name exactly the banned names, in the two locks that hold them', () => {
    const listed = lead => {
      const line = text.split('\n').find(item => item.startsWith(lead));
      expect(line, `${DOC} has no line starting ${lead}`).toBeDefined();
      return [...line.slice(lead.length).matchAll(/`([^`]+)`/gu)].map(match => match[1]);
    };
    expect(listed('- **Shadowed in the worker and refused by admission:**')).toEqual([...sdk.SHADOWED_GLOBALS]);
    expect(listed('- **Refused by admission only:**')).toEqual([...sdk.STATIC_ONLY_NAMES]);
  });

  it('show the module a model writes as the guide shows it', () => {
    expect(text).toContain(SCENE_CODE_EXAMPLE);
  });

  it('quote the admission’s refusal lines as the server writes them', () => {
    const code = 'export default function scene(rise) {\n  const data = fetch(\'/x\');\n  return { frame() {} };\n}';
    const [diagnostic] = admitSceneCode(code).diagnostics;
    expect(text).toContain(`Scene "vector" was refused: ${describeDiagnostic(diagnostic)}`);
    const parses = /ecmaVersion:\s*(\d+)/u.exec(read('worker/scene-admission.mjs'))[1];
    expect(text).toContain(`ES${parses}`);
  });

  it('quote the runtime report as the card writes it', () => {
    expect(text).toContain(sceneReportLine({ sceneId: 'vector', phase: 'frame', message: 'TypeError: v.draw is not a function', where: 'scene.js:14:5' }));
    expect(text).toContain(sceneReportLine({ sceneId: 'vector', phase: 'flash' }));
    const lead = /const REPORT_LEAD = '([^']+)'/u.exec(read('src/live/hosts/mcp-port.js'))[1];
    expect(text).toContain(lead);
  });
});

describe('figures', () => {
  it('list exactly the elements a figure may use, as admission keeps them', () => {
    const line = text.split('\n').find(item => item.startsWith('- **Elements a figure may use:**'));
    expect(line, `${DOC} has no line listing the figure's elements`).toBeDefined();
    expect([...line.matchAll(/`([^`]+)`/gu)].map(match => match[1])).toEqual([...sdk.SVG_ELEMENTS]);
    expect(sdk.SVG_ELEMENTS).not.toContain('feImage');
  });

  it('quote the admission’s refusal line as the server writes it', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n  <script>alert(1)</script>\n</svg>';
    const [diagnostic] = admitSvg(svg).diagnostics;
    expect(text).toContain(`Scene "triangle" was refused: ${describeDiagnostic(diagnostic)}`);
  });

  it('quote the card’s report of a figure it refused or could not draw', () => {
    expect(text).toContain(sceneReportLine({ sceneId: 'triangle', phase: 'admission', message: 'line 2, column 3: <script> is not an element a figure may use', where: null }));
    expect(text).toContain(sceneReportLine({ sceneId: 'triangle', phase: 'image', message: '', where: null }));
  });
});
