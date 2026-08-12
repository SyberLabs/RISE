export const WORKSHOP_INSPECTOR_KINDS = Object.freeze([
  'project',
  'source',
  'visualAsset',
  'audioAsset',
  'visualClip',
  'audioClip',
  'combinedClip',
  'pacing',
  'issue'
]);

const INSPECTOR_KIND_SET = new Set(WORKSHOP_INSPECTOR_KINDS);

export function normalizeInspectorContext(context) {
  const candidate = context && typeof context === 'object' ? context : {};
  const kind = INSPECTOR_KIND_SET.has(candidate.kind) ? candidate.kind : 'project';
  return Object.freeze({
    kind,
    ...(typeof candidate.id === 'string' && candidate.id ? { id: candidate.id } : {}),
    ...(typeof candidate.visualId === 'string' && candidate.visualId ? { visualId: candidate.visualId } : {}),
    ...(typeof candidate.audioId === 'string' && candidate.audioId ? { audioId: candidate.audioId } : {}),
    ...(typeof candidate.code === 'string' && candidate.code ? { code: candidate.code } : {})
  });
}

export function workshopChoiceGridClass(count) {
  const value = Number(count);
  if (!Number.isInteger(value) || value < 1 || value > 8) return 'studio-choice-grid';
  return `studio-choice-grid studio-choice-grid-${value}`;
}

export function inspectorContextLabel(context) {
  return ({
    project: 'Project',
    source: 'Source',
    visualAsset: 'Visual asset',
    audioAsset: 'Audio asset',
    visualClip: 'Visual clip',
    audioClip: 'Audio clip',
    combinedClip: 'Synchronized clips',
    pacing: 'Reading conductor',
    issue: 'Project issue'
  })[normalizeInspectorContext(context).kind];
}
