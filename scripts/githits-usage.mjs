#!/usr/bin/env node
// Private agent tooling only; never bundled into the product or used as a network fallback.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const home = process.env.GITHITS_USAGE_HOME ?? join(homedir(), 'Projects', 'MasterMind', 'tools', 'githits-usage');
try {
  const { node } = JSON.parse(readFileSync(join(home, 'data', 'runtime.json'), 'utf8'));
  const child = spawn(node, [join(home, 'mcp.mjs'), ...process.argv.slice(2)], {
    stdio: 'inherit', shell: false, windowsHide: true,
  });
  child.on('error', () => { console.error('GitHits private runtime could not start'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
} catch {
  console.error('Install the private MasterMind tools/githits-usage package and run install.mjs with Node 24. GITHITS_USAGE_HOME can select another private installation.');
  process.exitCode = 1;
}
