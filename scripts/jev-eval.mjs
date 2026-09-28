import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Lower bound of the Wilson score interval for k passes in n samples (default 95%). */
export function wilsonLowerBound(k, n, z = 1.96) {
  if (!(n > 0)) return 0;
  const p = k / n;
  const z2 = z * z;
  const bound = (p + z2 / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return Math.round(Math.max(0, bound) * 1e4) / 1e4;
}

export function scoreDecisions(cases, rows, options) {
  const byId = new Map();
  for (const row of rows) byId.set(row.id, [...(byId.get(row.id) || []), row]);
  const groups = new Map();
  const values = Object.fromEntries(Object.keys(options).map(key => [key, new Set()]));
  const result = {
    cases: cases.length, returned: 0, invalid: 0,
    explicit: { passed: 0, total: 0 }, contrast: { passed: 0, total: 0 },
    unique: {}, usage: { promptTokens: 0, completionTokens: 0, unreported: 0 }
  };
  const passRates = [];
  let repeated = false;
  for (const item of cases) {
    // One row per case is the original shape; several rows are repeat samples.
    const samples = byId.get(item.id) || [undefined];
    if (samples.length > 1) repeated = true;
    const decisions = [];
    let casePassed = 0;
    for (const row of samples) {
      const decision = row?.decision;
      const valid = decision && typeof decision === 'object' && !Array.isArray(decision)
        && Object.keys(decision).length === Object.keys(options).length
        && Object.entries(options).every(([key, allowed]) =>
          typeof decision[key] === 'string' && allowed.includes(decision[key]));
      if (row) result.returned++;
      if (!valid) result.invalid++;
      else for (const key of Object.keys(options)) values[key].add(decision[key]);
      let samplePassed = Boolean(valid);
      for (const [key, allowed] of Object.entries(item.expect || {})) {
        result.explicit.total++;
        if (valid && allowed.includes(decision[key])) result.explicit.passed++;
        else samplePassed = false;
      }
      for (const [field, wanted] of [['expectBook', true], ['forbidBook', false]]) {
        if (!item[field]) continue;
        result.explicit.total++;
        if (valid && typeof row.workId === 'string' && item[field].includes(row.workId) === wanted) {
          result.explicit.passed++;
        } else samplePassed = false;
      }
      if (samplePassed) casePassed++;
      decisions.push(valid ? decision : null);
      if (Number.isSafeInteger(row?.usage?.prompt_tokens)
        && Number.isSafeInteger(row?.usage?.completion_tokens)) {
        result.usage.promptTokens += row.usage.prompt_tokens;
        result.usage.completionTokens += row.usage.completion_tokens;
      } else result.usage.unreported++;
    }
    if (item.group) {
      const group = groups.get(item.group) || [];
      group.push({ item, decisions });
      groups.set(item.group, group);
    }
    passRates.push({ id: item.id, passed: casePassed, n: samples.length,
      rate: Math.round(casePassed / samples.length * 1e4) / 1e4,
      wilsonLower: wilsonLowerBound(casePassed, samples.length) });
  }
  for (const group of groups.values()) {
    if (group.length !== 2) continue;
    const [a, b] = group;
    const contrastKeys = Object.keys(a.item.expect || {})
      .filter(key => Object.hasOwn(b.item.expect || {}, key)
        && a.item.expect[key].every(value => !b.item.expect[key].includes(value)));
    for (let index = 0; index < Math.max(a.decisions.length, b.decisions.length); index++) {
      result.contrast.total++;
      const first = a.decisions[index];
      const second = b.decisions[index];
      if (first && second && contrastKeys.length
        && contrastKeys.every(key => first[key] !== second[key])) result.contrast.passed++;
    }
  }
  for (const [key, set] of Object.entries(values)) result.unique[key] = set.size;
  if (repeated) result.passRates = passRates;
  return result;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  const value = flag => {
    const position = args.indexOf(flag);
    return position < 0 ? undefined : args[position + 1];
  };
  const fixturePath = value('--cases');
  const optionsPath = value('--options');
  const inputPath = value('--input');
  const model = value('--hf-model');
  const outputPath = value('--output');
  const maxCalls = Number(value('--max-calls') || 0);
  if (!fixturePath || !optionsPath || (!inputPath && !model) || (model && !outputPath)) {
    console.error('Usage: node scripts/jev-eval.mjs --cases CASES.json --options OPTIONS.json --input RESULTS.json');
    console.error('   or: node scripts/jev-eval.mjs --cases CASES.json --options OPTIONS.json --hf-model MODEL --max-calls N --output RESULTS.json');
    process.exitCode = 2;
  } else {
    const cases = JSON.parse(await readFile(fixturePath, 'utf8'));
    const options = JSON.parse(await readFile(optionsPath, 'utf8'));
    let rows;
    if (inputPath) rows = JSON.parse(await readFile(inputPath, 'utf8'));
    else {
      if (!process.env.HF_TOKEN) throw new Error('HF_TOKEN is required for Hugging Face calls');
      if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 16 || maxCalls < cases.length) {
        throw new Error('Set --max-calls to cover cases, with an absolute cap of 16');
      }
      rows = [];
      for (const item of cases) {
        try {
          const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, temperature: 0, max_tokens: 200,
              messages: [
                { role: 'system', content: `Choose a reading presentation. Return only a JSON object with exactly these keys and one offered value for each: ${JSON.stringify(options)}. Follow explicit reader preferences.` },
                { role: 'user', content: item.intent }
              ] })
          });
          if (!response.ok) { rows.push({ id: item.id, error: `HTTP ${response.status}` }); continue; }
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          try { rows.push({ id: item.id, decision: JSON.parse(content), usage: data.usage }); }
          catch { rows.push({ id: item.id, error: 'non-JSON response', usage: data.usage }); }
        } catch (cause) { rows.push({ id: item.id, error: cause?.name || 'request failure' }); }
      }
      await writeFile(outputPath, `${JSON.stringify({ model, rows }, null, 2)}\n`);
    }
    const records = Array.isArray(rows) ? rows : rows.rows;
    const scoredCases = inputPath && args.includes('--only-recorded')
      ? cases.filter(item => records.some(row => row.id === item.id)) : cases;
    const scored = scoreDecisions(scoredCases, records, options);
    console.log(JSON.stringify({ model: model || rows.model || 'captured', ...scored }, null, 2));
  }
}
