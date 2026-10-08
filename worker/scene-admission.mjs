import { parse } from 'acorn';
import { BEAT_LIMITS } from '../src/core/beats.js';
import { sceneCodeBytes } from '../src/core/experience-program.js';
import { SHADOWED_GLOBALS, STATIC_ONLY_NAMES } from '../src/scenes/scene-bans.js';

/**
 * Static admission of a generated scene's code, before a Current that carries
 * it is accepted (docs/superpowers/specs/2026-10-08-creative-control-design.md
 * §8, §12). The code is parsed, never run: a Worker has no eval, and admission
 * must not depend on executing what a model wrote.
 *
 * The rules, in order: at most SCENE_CODE_BYTES of UTF-8; an ES module that
 * parses (a module is strict, so `with` does not); exactly one default export,
 * a plain function; no import of any kind; no `debugger`; no banned name used
 * as a name anywhere; a `reportsCompletion` export, if any, a boolean literal.
 *
 * A banned name is refused wherever it is an identifier, a local name that
 * shadows a global included: telling a shadowing local from a global reference
 * needs scope analysis, and refusing the name outright is simpler and errs on
 * the closed side. Only a non-computed property name (`a.fetch`, `{ fetch: 1 }`,
 * a method or class field called `fetch`) is not a name and is admitted.
 *
 * This is the first of two locks. Nothing static sees every path to a global
 * (`[].constructor.constructor` reaches Function without naming it), so the
 * scene worker also shadows the names it can, and seals the `constructor` of
 * every function prototype, before the code is loaded
 * (src/scenes/scene-worker.js).
 */

export const SCENE_CODE_BYTES = BEAT_LIMITS.code;

/** The names §8 says a scene may not reach: every name the scene worker shadows, and the ones it cannot. */
export const BANNED_SCENE_NAMES = Object.freeze([...SHADOWED_GLOBALS, ...STATIC_ONLY_NAMES]);

const MAX_DIAGNOSTICS = 10;
const BANNED = new Set(BANNED_SCENE_NAMES);
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const DEFAULT_EXPORT = 'a scene is an ES module with one default export function, export default function scene(rise) { return { frame(t, dt) {} }; }';

/** A diagnostic at a node's start, its column counted from one as a browser's stack trace counts it. */
const at = (node, rule, message) => ({ line: node?.loc?.start.line ?? null, column: node ? node.loc.start.column + 1 : null, rule, message });

/** One diagnostic as the sentence a model reads. */
export function describeDiagnostic({ line, column, message }) {
  return `${line === null ? '' : `line ${line}${column === null ? '' : `, column ${column}`}: `}${message}.`;
}

/** Whether an Identifier under `parent[key]` is a property name rather than a name. */
function propertyName(parent, key) {
  if (parent.computed) return false;
  if (parent.type === 'MemberExpression') return key === 'property';
  if (parent.type === 'Property') return key === 'key' && !parent.shorthand;
  return (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key';
}

/** Every node in source order, with its parent and the key it hangs from. */
function walk(node, visit, parent = null, key = null) {
  visit(node, parent, key);
  for (const [field, value] of Object.entries(node)) {
    if (field === 'loc') continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === 'object' && typeof child.type === 'string') walk(child, visit, node, field);
    }
  }
}

function exportsOf(program) {
  const found = [];
  let defaults = 0;
  for (const node of program.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      defaults += 1;
      const fn = node.declaration;
      if (!FUNCTIONS.has(fn.type) || fn.async || fn.generator) found.push(at(node, 'default-export', DEFAULT_EXPORT));
    } else if (node.type === 'ExportNamedDeclaration' && node.source === null) {
      for (const specifier of node.specifiers) {
        // ES2022 lets an exported name be a string: `export { x as "default" }`.
        const name = specifier.exported.name ?? specifier.exported.value;
        if (name === 'default') { defaults += 1; found.push(at(specifier, 'default-export', DEFAULT_EXPORT)); }
        if (name === 'reportsCompletion') {
          found.push(at(specifier, 'reports-completion', '`reportsCompletion` is exported as `export const reportsCompletion = true;`, a boolean literal'));
        }
      }
      for (const declarator of node.declaration?.declarations ?? []) {
        const literal = declarator.init?.type === 'Literal' && typeof declarator.init.value === 'boolean';
        if (declarator.id.name === 'reportsCompletion' && !literal) {
          found.push(at(declarator, 'reports-completion', '`reportsCompletion` is a boolean literal, true or false'));
        }
      }
    }
  }
  if (defaults === 0) found.push(at(null, 'default-export', DEFAULT_EXPORT));
  else if (defaults > 1) found.push(at(program.body.find(node => node.type === 'ExportDefaultDeclaration'), 'default-export', DEFAULT_EXPORT));
  return found;
}

function forbidden(program) {
  const found = [];
  walk(program, (node, parent, key) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ImportExpression'
      || ((node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') && node.source)) {
      found.push(at(node, 'import', 'a scene imports nothing: it has `rise` and `rise.lib`'));
    } else if (node.type === 'DebuggerStatement') {
      found.push(at(node, 'debugger', '`debugger` is not available to a scene'));
    } else if (node.type === 'Identifier' && BANNED.has(node.name) && !(parent && propertyName(parent, key))) {
      found.push(at(node, 'banned-name', `\`${node.name}\` is not available to a scene, and the name is refused even as a local name`));
    }
  });
  return found;
}

/**
 * @param {unknown} code a scene's `code`, as a Current carries it
 * @returns {{ok: true} | {ok: false, diagnostics: Array<{line: number|null, column: number|null, rule: string, message: string}>}}
 */
export function admitSceneCode(code) {
  if (typeof code !== 'string' || sceneCodeBytes(code) > SCENE_CODE_BYTES) {
    return { ok: false, diagnostics: [at(null, 'size', `a scene's code is text of at most ${SCENE_CODE_BYTES.toLocaleString('en-US')} bytes`)] };
  }
  let program;
  try {
    program = parse(code, { ecmaVersion: 2022, sourceType: 'module', locations: true });
  } catch (error) {
    const where = error?.loc ?? null;
    const reason = String(error?.message ?? 'it does not parse').replace(/\s*\(\d+:\d+\)$/u, '');
    return { ok: false, diagnostics: [{ line: where?.line ?? null, column: where ? where.column + 1 : null, rule: 'syntax', message: `the code does not parse as a module: ${reason}` }] };
  }
  const diagnostics = [...exportsOf(program), ...forbidden(program)]
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
    .slice(0, MAX_DIAGNOSTICS);
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true };
}
