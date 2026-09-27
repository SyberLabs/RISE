import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function scoreDecisions(cases, rows, options) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const groups = new Map();
  const values = Object.fromEntries(Object.keys(options).map(key => [key, new Set()]));
  const result = {
    cases: cases.length, returned: 0, invalid: 0,
    explicit: { passed: 0, total: 0 }, contrast: { passed: 0, total: 0 },
    unique: {}, usage: { promptTokens: 0, completionTokens: 0, unreported: 0 }
  };
  for (const item of cases) {
    const row = byId.get(item.id);
    const decision = row?.decision;
    const valid = decision && typeof decision === 'object' && !Array.isArray(decision)
      && Object.keys(decision).length === Object.keys(options).length
      && Object.entries(options).every(([key, allowed]) =>
        typeof decision[key] === 'string' && allowed.includes(decision[key]));
    if (row) result.returned++;
    if (!valid) result.invalid++;
    else for (const key of Object.keys(options)) values[key].add(decision[key]);
    for (const [key, allowed] of Object.entries(item.expect || {})) {
      result.explicit.total++;
      if (valid && allowed.includes(decision[key])) result.explicit.passed++;
    }
    if (item.group) {
      const group = groups.get(item.group) || [];
      group.push({ item, decision: valid ? decision : null });
      groups.set(item.group, group);
    }
    if (Number.isSafeInteger(row?.usage?.prompt_tokens)
      && Number.isSafeInteger(row?.usage?.completion_tokens)) {
      result.usage.promptTokens += row.usage.prompt_tokens;
      result.usage.completionTokens += row.usage.completion_tokens;
    } else result.usage.unreported++;
  }
  for (const group of groups.values()) {
    if (group.length !== 2) continue;
    result.contrast.total++;
    const [a, b] = group;
    const contrastKeys = Object.keys(a.item.expect || {})
      .filter(key => Object.hasOwn(b.item.expect || {}, key)
        && a.item.expect[key].every(value => !b.item.expect[key].includes(value)));
    if (a.decision && b.decision && contrastKeys.length
      && contrastKeys.every(key => a.decision[key] !== b.decision[key])) result.contrast.passed++;
  }
  for (const [key, set] of Object.entries(values)) result.unique[key] = set.size;
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
