// Markdown summary of a staging evaluation run for the GitHub job summary.
// Reads only the sanitized captures and comparison; prints no intents or secrets.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function json(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null;
}

export function latency(capture) {
  const times = (capture?.rows || []).filter(row => row.httpStatus === 200).map(row => row.wallMs)
    .sort((a, b) => a - b);
  return { p50: percentile(times, 0.5), p95: percentile(times, 0.95), max: times.at(-1) ?? null };
}

export function summary(jev, kev, result) {
  const lines = ['## Kev staging evaluation', ''];
  if (!result) {
    lines.push('**No comparison result.** A capture or the comparison failed; see the job log.', '');
  } else {
    lines.push(`**${result.passed ? 'PASSED' : 'FAILED'}**: Kev \`${result.candidateIdentity?.revision}\` vs ` +
      `Jev \`${result.baselineIdentity?.model}\``, '', '| Gate | Result |', '| --- | --- |');
    for (const [gate, ok] of Object.entries(result.gates)) lines.push(`| ${gate} | ${ok ? 'pass' : '**fail**'} |`);
    const side = run => `${run.returned} returned, ${run.invalid} invalid, explicit ` +
      `${run.explicit.passed}/${run.explicit.total}, contrast ${run.contrast.passed}/${run.contrast.total}`;
    lines.push('', `- Jev: ${side(result.baseline)}`, `- Kev: ${side(result.candidate)}`);
  }
  for (const [name, capture] of [['Jev', jev], ['Kev', kev]]) {
    if (!capture) { lines.push(`- ${name}: no capture`); continue; }
    const { p50, p95, max } = latency(capture);
    const failed = capture.rows.filter(row => row.httpStatus !== 200 || row.decisionCacheStatus !== 'miss')
      .map(row => `${row.id} (${row.httpStatus}${row.error ? ` ${row.error}` : ''}` +
        `${row.decisionCacheStatus && row.decisionCacheStatus !== 'miss' ? ' cached' : ''})`);
    lines.push(`- ${name} full-request wall time: p50 ${p50} ms, p95 ${p95} ms, max ${max} ms over ` +
      `${capture.rows.length} rows${failed.length ? `; not accepted: ${failed.join(', ')}` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dir = process.argv[2];
  const [jev, kev, result] = await Promise.all(['jev-staging.json', 'kev-staging.json', 'compare.json']
    .map(name => json(join(dir, name))));
  process.stdout.write(summary(jev, kev, result));
}
