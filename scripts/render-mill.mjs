#!/usr/bin/env node
/**
 * Local render mill: localhost POST /v1/render + SQLite jobs + files.
 *
 *   npm run render:mill
 *   node scripts/render-mill.mjs --port 8787 --root out/mill
 *
 * POST rise.kernel-request.v1 (program / op-set JSON also land via intake).
 * Does not publish.
 */
import { join, resolve } from 'node:path';
import {
  MILL_DEFAULT_PORT,
  MILL_RENDER_PATH,
  closeMill,
  createMill,
  startMill
} from '../src/core/render/mill.js';

export const MILL_CLI_USAGE = `Usage: node scripts/render-mill.mjs [options]

  --port <n>    Listen port (default: ${MILL_DEFAULT_PORT})
  --root <dir>  SQLite + artifact directory (default: out/mill)
  --help        Show this message

POST ${MILL_RENDER_PATH}  rise.kernel-request.v1 JSON
GET  ${MILL_RENDER_PATH}/:id
`;

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help' || args[i] === '-h') return { help: true };
    if (args[i] === '--port') {
      values.port = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === '--root') {
      values.root = args[i + 1];
      i += 1;
    }
  }
  return values;
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.help) {
  console.log(MILL_CLI_USAGE);
  process.exit(0);
}

const port = parsed.port == null ? MILL_DEFAULT_PORT : Number(parsed.port);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('--port must be an integer 0–65535');
  process.exit(1);
}

const root = resolve(parsed.root || join('out', 'mill'));
const mill = await createMill({ root });
const { url } = await startMill(mill, { port });

console.log(`RISE mill ${url}${MILL_RENDER_PATH}`);
console.log(`SQLite ${join(root, 'mill.sqlite')}`);
console.log('Jobs are files. This process does not upload.');

const shutdown = () => {
  closeMill(mill);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
