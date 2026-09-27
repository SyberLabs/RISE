import { readFile, writeFile } from 'node:fs/promises';

const [casesPath, optionsPath, outputPath] = process.argv.slice(2);
if (!casesPath || !optionsPath || !outputPath || process.argv.length !== 5) {
  console.error('Usage: node scripts/jev-eval-live.mjs CASES.json OPTIONS.json OUTPUT.json');
  process.exit(2);
}

const cases = JSON.parse(await readFile(casesPath, 'utf8'));
const options = JSON.parse(await readFile(optionsPath, 'utf8'));
if (!Array.isArray(cases) || cases.length < 1 || cases.length > 16
  || cases.some(item => typeof item.id !== 'string' || typeof item.intent !== 'string'
    || item.intent.length < 3 || item.intent.length > 240)) {
  throw new Error('Provide 1 to 16 cases with valid Jev reading intents.');
}
const fields = Object.keys(options);
const rows = [];
const models = new Set();
for (const item of cases) {
  try {
    const response = await fetch('https://rise.syberlabs.io/api/jev-recommend', {
      method: 'POST',
      headers: { Origin: 'https://rise.syberlabs.io', 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: item.intent, schemaVersion: 2 }),
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
      [field, result.config[field]])) });
  } catch (cause) {
    rows.push({ id: item.id, error: cause?.name || 'request failure' });
  }
}
await writeFile(outputPath, `${JSON.stringify({ model: [...models].join(', ') || 'unreported', rows }, null, 2)}\n`);
console.log(`Captured ${rows.filter(row => row.decision).length}/${cases.length} live Jev decisions in ${outputPath}`);
