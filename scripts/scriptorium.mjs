#!/usr/bin/env vite-node
/**
 * The Scriptorium CLI's entry point, and nothing else.
 *
 * Every decision is in src/core/scriptorium-cli.js, which is in src/ so the
 * suite can drive it in-process without spawning anything. What lives here is
 * the part only a process has: argv, two streams, and an exit status. Held to
 * a dozen lines on purpose — a shell that grew a judgement of its own would be
 * a judgement no test could reach.
 *
 * VITE-NODE, NOT NODE. curator-context.js imports division-index.json without
 * an import attribute, which node's ESM loader refuses; vite resolves it. The
 * repo's other module-importing scripts run the same way.
 *
 *   npm run scriptorium -- examine score.json --length 900 --json
 */

import { runScriptoriumCli } from '../src/core/scriptorium-cli.js';

process.exitCode = await runScriptoriumCli(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`)
});
