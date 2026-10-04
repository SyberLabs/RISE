#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTracker, loadTasks, serveTracker, updateTask } from './lib/roadmap.mjs';

function usage() {
  return `Usage:
  node scripts/roadmap.mjs validate
  node scripts/roadmap.mjs update ID --patch FILE --expect-revision N --summary TEXT
  node scripts/roadmap.mjs serve [--port N]
  node scripts/roadmap.mjs build [--out DIR]`;
}

function option(args, name, { required = false } = {}) {
  const index = args.indexOf(name);
  if (index < 0) {
    if (required) throw new Error(`missing ${name}`);
    return undefined;
  }
  if (index === args.length - 1 || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const root = process.cwd();
  if (command === 'validate') {
    if (rest.length) throw new Error('validate accepts no options');
    const tasks = await loadTasks(root);
    console.log(`Validated ${tasks.length} tasks.`);
    return;
  }
  if (command === 'update') {
    const [id, ...flags] = rest;
    if (!id) throw new Error('update requires a task ID');
    const flagsCopy = [...flags];
    const patchFile = option(flagsCopy, '--patch', { required: true });
    const expectedText = option(flagsCopy, '--expect-revision', { required: true });
    const summary = option(flagsCopy, '--summary', { required: true });
    if (flagsCopy.length) throw new Error(`unknown option ${flagsCopy[0]}`);
    if (!/^\d+$/.test(expectedText)) throw new Error('--expect-revision must be a positive integer');
    const patch = JSON.parse(await readFile(path.resolve(root, patchFile), 'utf8'));
    const updated = await updateTask(root, id, patch, { expectedRevision: Number(expectedText), summary });
    console.log(`Updated ${updated.id} to revision ${updated.revision}.`);
    return;
  }
  if (command === 'serve') {
    const flags = [...rest];
    const portText = option(flags, '--port');
    if (flags.length) throw new Error(`unknown option ${flags[0]}`);
    const port = portText === undefined ? 4173 : Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be an integer from 1 to 65535');
    const server = await serveTracker(root, port);
    const address = server.address();
    console.log(`Roadmap dashboard listening at http://127.0.0.1:${address.port}/`);
    const close = () => server.close(() => process.exit(0));
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    return new Promise(() => {});
  }
  if (command === 'build') {
    const flags = [...rest];
    const out = option(flags, '--out');
    if (flags.length) throw new Error(`unknown option ${flags[0]}`);
    const output = path.resolve(root, out ?? '.roadmap-dashboard');
    const payload = await buildTracker(root, output);
    console.log(`Built static dashboard with ${payload.tasks.length} tasks at ${output}.`);
    return;
  }
  throw new Error(usage());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
