/**
 * The two decision models RISE accepts, and how their answers are admitted.
 *
 * Both are reader-owned: Jev runs through the reader's own OpenRouter key, Kev
 * runs on the reader's own computer. Neither is ever a fallback for the other,
 * and no SyberLabs credential exists anywhere in this path.
 */

export const KEV_CODE_REVISION = '9c41005b2180347c3c646dfc9e50c4428483ec6b';
export const KEV_REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
export const KEV_BASE = 'Qwen/Qwen3.5-4B-Base';
export const KEV_BASE_REVISION = '1001bb4d826a52d1f399e183466143f4da7b741b';

export const JEV = Object.freeze({
  name: 'TypeSafe',
  url: 'https://openrouter.ai/api/alpha/decisions',
  model: 'typesafe/jev-1.13',
  revision: 'jev-1.13'
});

export const KEV = Object.freeze({
  name: 'Kev',
  // Same-origin route on the loopback-only local bridge (local/bridge.mjs).
  url: '/api/local/kev/systemone',
  model: 'kev-latest',
  revision: KEV_REVISION
});

const JEV_MODEL = /^typesafe\/jev-1\.13(?:-\d{8})?$/u;

/** A served model label is only accepted from the provider that owns it. */
export function validProviderResult(value, provider) {
  if (!provider || !value || typeof value !== 'object' || Array.isArray(value) || value.error) return false;
  if (!value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return false;
  if (provider.name === 'Kev') {
    return value.model === provider.model && (value.provider === undefined || value.provider === 'Kev');
  }
  return value.provider === 'TypeSafe' && typeof value.model === 'string' && JEV_MODEL.test(value.model);
}

export function decisionIdentity(provider) {
  return provider.name === 'Kev' ? { provider: 'Kev', revision: provider.revision } : {};
}

/**
 * The local Kev server adds this header only after it has loaded and checked
 * the pinned checkpoint and base (local/kev_server.py). An answer without it
 * is not the model RISE pinned.
 */
export function validProviderResponse(response, provider) {
  return provider.name !== 'Kev' || response.headers.get('x-kev-revision') === provider.revision;
}
