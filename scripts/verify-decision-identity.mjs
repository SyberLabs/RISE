import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validProviderResult } from '../server/decision-provider.mjs';

export function validReleaseDecision(result, env = process.env) {
  const selected = env.DECISION_PROVIDER || 'kev';
  if (selected === 'jev') {
    return validProviderResult({ ...result, provider: result?.provider || 'TypeSafe' },
      { name: 'TypeSafe', model: 'typesafe/jev-1.13' });
  }
  const model = env.KEV_MODEL || 'kev-latest';
  return selected === 'kev' && model === 'kev-latest'
    && /^[a-f0-9]{40}$/.test(env.KEV_REVISION || '')
    && result?.provider === 'Kev' && result.revision === env.KEV_REVISION
    && validProviderResult(result, { name: 'Kev', model });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!validReleaseDecision(result)) {
    console.error('Live decision does not match the configured provider, model, and revision.');
    process.exitCode = 1;
  }
}
