/**
 * The reading runtime does not consult this. Callers that want an
 * evaluation ask `maybeEvaluate`, which returns before any encoder runs
 * when the flag is off. Manual configuration never has to load a model.
 */

export function affectEnabled(env = {}) {
    const value = env.RISE_AFFECT ?? env.VITE_RISE_AFFECT;
    return value === '1' || value === 'true';
}
