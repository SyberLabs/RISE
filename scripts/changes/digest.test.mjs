import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { parseOptions, runProcess } from './digest.mjs';

test('reads --since, --out and --dry-run, and refuses anything else', () => {
  assert.deepEqual(parseOptions(['--since', '2026-10-13', '--out', 'x', '--dry-run']), { since: '2026-10-13', out: 'x', dryRun: true });
  assert.deepEqual(parseOptions([]), { since: undefined, out: undefined, dryRun: false });
  assert.throws(() => parseOptions(['--token', 'abc']));
  assert.throws(() => parseOptions(['positional']));
});

test('runs a child in a fresh directory with its files, its stdin and only the environment given', async () => {
  const script = [
    "const fs = require('node:fs');",
    "const input = fs.readFileSync(0, 'utf8');",
    "const file = fs.readFileSync('system-prompt.txt', 'utf8');",
    "process.stdout.write(JSON.stringify({ input, file, cwd: process.cwd(), token: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? null, gh: process.env.GH_TOKEN ?? null }));"
  ].join('\n');
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', script],
    input: 'the prompt',
    files: { 'system-prompt.txt': 'the system' },
    env: { CLAUDE_CODE_OAUTH_TOKEN: 'child-only', SYSTEMROOT: process.env.SYSTEMROOT ?? '' }
  });
  assert.equal(result.code, 0, result.stderr);
  const seen = JSON.parse(result.stdout);
  assert.equal(seen.input, 'the prompt');
  assert.equal(seen.file, 'the system');
  assert.equal(seen.token, 'child-only');
  assert.equal(seen.gh, null);
  assert.equal(existsSync(seen.cwd), false, 'the working directory is removed');
});

test('reports a non-zero exit with what the child wrote', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', "process.stderr.write('nope'); process.exit(3)"],
    input: '',
    files: {},
    env: { SYSTEMROOT: process.env.SYSTEMROOT ?? '' }
  });
  assert.equal(result.code, 3);
  assert.equal(result.stderr, 'nope');
});

test('ends a child that runs past its deadline', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 60000)'],
    input: '',
    files: {},
    env: { SYSTEMROOT: process.env.SYSTEMROOT ?? '' },
    timeoutMs: 200
  });
  assert.notEqual(result.code, 0);
});
