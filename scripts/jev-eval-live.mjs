// Captures live Jev decisions from the production recommendation route.
//
// Usage: node scripts/jev-eval-live.mjs CASES.json OPTIONS.json OUTPUT.json
//          [--repeat N] [--schema-version 2|3]
//
// The worker limits /api/jev-recommend to 30 requests per minute per IP
// (DECISION_LIMITER in wrangler.production.jsonc: limit 30, period 60). This
// script sends its requests one after another and refuses a run of more than
// 16 requests (cases x repeat, so at most 16 cases), which leaves headroom
// under that limit. Larger sets go in separate runs of 16 or fewer, started at
// least a minute apart. Requests over the limit come back as HTTP 429 and are
// recorded as errors, which score as failures.
//
// --repeat N asks every case N times (default 1) so the scorer can report a
// per-case pass rate. --schema-version picks the request schema: 2 (default)
// or 3. Only 3 enables the night-drive rewrite (neon look, night-drive sound)
// for Tokyo Drift style requests, so scripts/jev-eval-reference-cases.json
// expects --schema-version 3.
import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const flag = name => {
  const position = args.indexOf(name);
  if (position < 0) return undefined;
  const [, value] = args.splice(position, 2);
  return value;
};
const repeat = Number(flag('--repeat') ?? 1);
const schemaVersion = Number(flag('--schema-version') ?? 2);
const [casesPath, optionsPath, outputPath] = args;
if (!casesPath || !optionsPath || !outputPath || args.length !== 3
  || !Number.isInteger(repeat) || repeat < 1 || ![2, 3].includes(schemaVersion)) {
  console.error('Usage: node scripts/jev-eval-live.mjs CASES.json OPTIONS.json OUTPUT.json [--repeat N] [--schema-version 2|3]');
  process.exit(2);
}

const cases = JSON.parse(await readFile(casesPath, 'utf8'));
const options = JSON.parse(await readFile(optionsPath, 'utf8'));
if (!Array.isArray(cases) || cases.length < 1 || cases.length > 16
  || cases.some(item => typeof item.id !== 'string' || typeof item.intent !== 'string'
    || item.intent.length < 3 || item.intent.length > 240)) {
  throw new Error('Provide 1 to 16 cases with valid Jev reading intents.');
}
if (cases.length * repeat > 16) {
  throw new Error('Cases times repeat must be 16 or fewer requests per run (30 per minute per IP limit).');
}
const fields = Object.keys(options);
const rows = [];
const models = new Set();
for (const item of cases) for (let attempt = 0; attempt < repeat; attempt++) {
  try {
    const response = await fetch('https://rise.syberlabs.io/api/jev-recommend', {
      method: 'POST',
      headers: { Origin: 'https://rise.syberlabs.io', 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: item.intent, schemaVersion }),
      signal: AbortSignal.timeout(15000)
    });
    if (response.status !== 200) {
      rows.push({ id: item.id, error: `HTTP ${response.status}` });
      continue;
    }
    const result = await response.json();
    if (result.schemaVersion !== 2 || !result.config) {
      rows.push({ id: item.id, error: 'invalid schema v2 response' });
      continue;
    }
    if (typeof result.model === 'string') models.add(result.model);
    rows.push({ id: item.id, decision: Object.fromEntries(fields.map(field =>
      [field, field === 'pace' ? String(result.config.wpm) : result.config[field]])),
    ...(typeof result.workId === 'string' && { workId: result.workId }) });
  } catch (cause) {
    rows.push({ id: item.id, error: cause?.name || 'request failure' });
  }
}
await writeFile(outputPath, `${JSON.stringify({ model: [...models].join(', ') || 'unreported', rows }, null, 2)}\n`);
console.log(`Captured ${rows.filter(row => row.decision).length}/${cases.length * repeat} live Jev decisions in ${outputPath}`);
