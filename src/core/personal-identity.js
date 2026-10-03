// Deliberately small: MemoryCore uses this on the initial load path.
export const isPersonalProject = value => value?.provenance?.kind === 'personal-generated';
export const isPersonalId = id => typeof id === 'string' && id.startsWith('personal-');

export function canonicalPersonal(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalPersonal).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalPersonal(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Examine the original input, before permissive Workshop normalization can erase changes.
export function guardPersonalOverwrite(stored, incoming) {
  const previous = stored.find(item => item.id === incoming.id);
  if (!isPersonalProject(previous) && !isPersonalId(previous?.id)
    && !isPersonalProject(incoming) && !isPersonalId(incoming.id)) return null;
  if (!isPersonalProject(incoming) || !isPersonalId(incoming.id)) {
    throw new Error('Personal readings cannot be overwritten through Workshop.');
  }
  if (!previous) return null;
  if (canonicalPersonal(previous) !== canonicalPersonal(incoming)) {
    throw new Error('This personal reading ID already contains different content. Import refused.');
  }
  return previous;
}
