// Server-only configuration. Selecting Jev is an explicit rollback, never a fallback.
export function decisionProvider(env = {}) {
  const selected = env.DECISION_PROVIDER || 'kev';
  if (selected === 'jev') {
    if (!env.OPENROUTER_API_KEY?.trim()) return null;
    return { name: 'TypeSafe', url: 'https://openrouter.ai/api/alpha/decisions',
      model: 'typesafe/jev-1.13', revision: 'jev-1.13', key: env.OPENROUTER_API_KEY };
  }
  if (selected !== 'kev' || !env.KEV_API_KEY?.trim()
    || !/^[a-f0-9]{40}$/.test(env.KEV_REVISION || '')) return null;
  try {
    const url = new URL(env.KEV_BASE_URL);
    // Configuration is operator-owned; browser input must never choose this host.
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.pathname !== '/') return null;
    const model = env.KEV_MODEL || 'kev-latest';
    if (model !== 'kev-latest') return null;
    return { name: 'Kev', url: `${url.origin}/v1/systemone`, model,
      revision: env.KEV_REVISION, key: env.KEV_API_KEY };
  } catch { return null; }
}

export function validProviderResult(value, provider) {
  if (!provider || !value || typeof value !== 'object' || Array.isArray(value) || value.error) return false;
  if (provider.name === 'Kev') return value.model === provider.model
    && (value.provider === undefined || value.provider === 'Kev');
  return value.provider === 'TypeSafe' && (value.model === provider.model
    || /^typesafe\/jev-1\.13-\d{8}$/.test(value.model));
}

export function decisionIdentity(provider) {
  return provider.name === 'Kev' ? { provider: 'Kev', revision: provider.revision } : {};
}

// The SyberLabs serving wrapper emits this only after loading the pinned run.
export function validProviderResponse(response, provider) {
  return provider.name !== 'Kev' || response.headers.get('x-kev-revision') === provider.revision;
}
