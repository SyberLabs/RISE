#!/usr/bin/env node
/**
 * RISE Changes: one digest of what merged into main (docs/plans/RISE-CHANGES.md).
 *
 *   node scripts/changes/digest.mjs [--since <ISO>] [--out <dir>] [--dry-run]
 *
 * Reads GitHub through `gh` (GH_TOKEN) and asks Claude through the Claude
 * Code CLI (CLAUDE_CODE_OAUTH_TOKEN, passed to the CLI's environment only).
 * Writes `<id>.json`, `index.json` and `issue.json` (the notification's title
 * and body) to the out directory, which must be new or empty, and `run.json`
 * ({ written, id?, reason? }) in every case. It never commits, pushes or opens
 * an issue: the workflow does that, and skips it on a dry run.
 */
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createAsk } from '../../src/core/changes/claude-cli.js';
import { runDigest } from './run-digest.js';
import { serialize } from '../../src/core/changes/write.js';

const GH_MAX_BUFFER = 64 * 1024 * 1024;
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000;
const CLAUDE_MAX_OUTPUT = 8 * 1024 * 1024;

export function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { since: { type: 'string' }, out: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } },
    strict: true,
    allowPositionals: false
  });
  return { since: values.since || undefined, out: values.out, dryRun: values['dry-run'] };
}

/** `gh` with these arguments, without the Claude credential: its stdout, or an error carrying its stderr. */
export function runGh(args) {
  const { CLAUDE_CODE_OAUTH_TOKEN: _withheld, ...env } = process.env;
  return new Promise((done, fail) => {
    execFile('gh', args, { env, maxBuffer: GH_MAX_BUFFER, windowsHide: true }, (error, stdout, stderr) => {
      if (error) fail(Object.assign(new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${String(stderr).trim().slice(0, 300)}`), { stderr: String(stderr) }));
      else done(stdout);
    });
  });
}

/**
 * One child process in a fresh directory holding `files`, with `input` on its
 * stdin and only `env` for an environment; the directory is removed after.
 */
export async function runProcess({ command, args, input, files, env, timeoutMs = CLAUDE_TIMEOUT_MS }) {
  const cwd = await mkdtemp(join(tmpdir(), 'rise-changes-'));
  try {
    for (const [name, text] of Object.entries(files)) await writeFile(join(cwd, name), text, 'utf8');
    return await new Promise((done, fail) => {
      const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      const stdout = [];
      const stderr = [];
      let size = 0;
      const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
      const keep = into => chunk => {
        size += chunk.length;
        if (size > CLAUDE_MAX_OUTPUT) child.kill('SIGTERM');
        else into.push(chunk);
      };
      child.stdout.on('data', keep(stdout));
      child.stderr.on('data', keep(stderr));
      child.on('error', error => { clearTimeout(timer); fail(new Error(`${command} could not start: ${error.code ?? error.message}`)); });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        done({ code: code ?? (signal ? 128 : 1), stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
      });
      child.stdin.on('error', () => {});
      child.stdin.end(input, 'utf8');
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function outDirectory(out) {
  const dir = out ? resolve(out) : await mkdtemp(join(tmpdir(), 'rise-changes-out-'));
  await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).length) throw new Error(`${dir} is not empty; give --out a new directory`);
  return dir;
}

export async function main(argv, { env = process.env, log = line => console.log(line) } = {}) {
  const options = parseOptions(argv);
  const dir = await outDirectory(options.out);
  if (options.dryRun) log('Dry run: the files are written to the out directory only; nothing is pushed and no issue is opened.');
  const ask = createAsk({ run: runProcess, env, log });
  const result = await runDigest({ gh: runGh, ask, since: options.since, log });
  if (!result.written) {
    log(`Nothing to write: ${result.reason}.`);
    await writeFile(join(dir, 'run.json'), serialize({ written: false, reason: result.reason }));
    return result;
  }
  for (const [name, text] of Object.entries(result.files)) await writeFile(join(dir, name), text, 'utf8');
  await writeFile(join(dir, 'issue.json'), serialize(result.issue), 'utf8');
  await writeFile(join(dir, 'run.json'), serialize({ written: true, id: result.id }), 'utf8');
  log(`Wrote ${Object.keys(result.files).join(' and ')} to ${dir}.`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`RISE Changes failed: ${error.message}`);
    process.exitCode = 1;
  });
}
