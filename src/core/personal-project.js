import { validateWorkshopProject, workshopProjectToSessionConfig } from './workshop-project.js';
import { validatePiece } from './personal-piece-client.js';
import { canonicalPersonal, isPersonalProject } from './personal-identity.js';

export const PRESENTATION_VERSION = 'personal-neutral-v1';
const safeDefaults = () => ({
  reading: { wpm: 160, chunkMode: 'sentence', curve: 'flat', displayMode: 'focal' },
  visual: { surface: 'off', config: { visualMode: 'off' } },
  audio: { soundscape: 'none', audioPreset: 'silent', selectedSwellId: null },
  projection: 'stream', recitation: { enabled: false }, voiceId: null, render: { profileId: null }
});
const fail = () => { throw new Error('This file is not a restricted personal reading project.'); };
const exact = (object, keys) => {
  if (!object || typeof object !== 'object' || Array.isArray(object)
    || Object.keys(object).sort().join(',') !== [...keys].sort().join(',')) fail();
};
const idOK = value => typeof value === 'string' && /^personal-[0-9a-f-]{36}$/iu.test(value);

function validateInertDefaults(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(value).length > 8192) fail();
  if (value.recitation && value.recitation.enabled !== false) fail();
  let nodes = 0;
  const visit = (item, depth = 0) => {
    if (++nodes > 256 || depth > 8) fail();
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') { if (!Number.isFinite(item)) fail(); return; }
    if (typeof item === 'string') {
      if (item.length > 512 || /(?:[a-z][a-z0-9+.-]*:|\/\/|www\.|<|```)/iu.test(item)) fail();
      return;
    }
    if (typeof item !== 'object' || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype)) fail();
    for (const [key, child] of Object.entries(item)) {
      if (key.length > 64 || /^(?:__proto__|prototype|constructor|program|experienceProgram|assets|sources|url|uri|remote|narration)$/iu.test(key)) fail();
      visit(child, depth + 1);
    }
  };
  visit(value);
}

export function createPersonalProject(result, parent = null) {
  const piece = validatePiece(result);
  if (parent) validatePersonalProject(parent);
  if (result.writerModel !== 'qwen/qwen3.5-9b' || result.promptVersion !== 'personal-v1') fail();
  const id = `personal-${crypto.randomUUID()}`;
  return validateWorkshopProject({
    schema: 'rise.workshop-project.v1', id, title: piece.title, intent: 'personal-reading',
    sources: [{ id: 'personal-text', name: piece.title, providerId: 'local', type: 'text/plain', data: piece.paragraphs.join('\n\n') }],
    assets: [], experienceProgram: null, defaults: safeDefaults(), paceV2: true,
    provenance: {
      kind: 'personal-generated', compositionId: parent?.provenance.compositionId || id,
      parentRevisionId: parent?.id || null, writerModel: result.writerModel,
      promptVersion: result.promptVersion, presentationVersion: PRESENTATION_VERSION
    },
    revision: parent ? parent.revision + 1 : 0, updatedAt: Date.now()
  });
}

export function validatePersonalProject(value) {
  exact(value, ['schema','id','title','intent','sources','assets','experienceProgram','defaults','provenance','paceV2','revision','updatedAt']);
  if (value.schema !== 'rise.workshop-project.v1' || !idOK(value.id)
    || value.intent !== 'personal-reading' || value.paceV2 !== true
    || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0
    || !Array.isArray(value.assets) || value.assets.length || value.experienceProgram !== null
    || !Array.isArray(value.sources) || value.sources.length !== 1) fail();
  const source = value.sources[0];
  exact(source, ['id','name','providerId','type','words','data']);
  if (source.id !== 'personal-text' || source.name !== value.title || source.providerId !== 'local'
    || source.type !== 'text/plain' || typeof source.data !== 'string') fail();
  validatePiece({ title: value.title, paragraphs: source.data.split('\n\n') });
  if (source.words !== source.data.split(/\s+/u).filter(Boolean).length) fail();
  const p = value.provenance;
  exact(p, ['kind','compositionId','parentRevisionId','writerModel','promptVersion','presentationVersion']);
  if (!isPersonalProject(value) || !idOK(p.compositionId)
    || (p.parentRevisionId !== null && (!idOK(p.parentRevisionId) || p.parentRevisionId === value.id))
    || (value.revision === 0 && (p.parentRevisionId !== null || p.compositionId !== value.id))
    || (value.revision > 0 && p.parentRevisionId === null)
    || typeof p.writerModel !== 'string' || !p.writerModel || p.writerModel.length > 100
    || typeof p.promptVersion !== 'string' || !p.promptVersion || p.promptVersion.length > 100
    || typeof p.presentationVersion !== 'string' || !p.presentationVersion || p.presentationVersion.length > 100) fail();
  // Check the exact raw defaults, including every nested key, before normalization.
  if (p.presentationVersion === PRESENTATION_VERSION) {
    if (canonicalPersonal(value.defaults) !== canonicalPersonal(safeDefaults())) fail();
  } else validateInertDefaults(value.defaults);
  return validateWorkshopProject({ ...value, defaults: safeDefaults() });
}

export function importPersonalProject(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) {
    throw new Error('Personal reading imports are limited to 64 KiB.');
  }
  const value = JSON.parse(text, (key, item) => {
    if (['__proto__','prototype','constructor'].includes(key)) fail();
    return item;
  });
  const project = validatePersonalProject(value);
  return { project, notice: project.provenance.presentationVersion === PRESENTATION_VERSION
    ? 'Imported provenance is declared by this file, not verified.'
    : 'Unknown presentation version: using neutral presentation. Imported provenance is declared, not verified.' };
}

export function serializePersonalProject(project) { return JSON.stringify(validatePersonalProject(project), null, 2); }
export function personalSession(project) { return workshopProjectToSessionConfig(validatePersonalProject(project)); }
export function readablePersonalText(project) { return `${project.title}\n\n${project.sources[0].data}\n`; }

// Inline so an unkept draft never depends on a chunk a deploy may remove.
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename, rel: 'noopener' });
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportPersonalProject(project, format = 'json') {
  if (format === 'text') download(`${project.id}.txt`, readablePersonalText(project), 'text/plain;charset=utf-8');
  else download(`${project.id}.personal.json`, serializePersonalProject(project), 'application/json;charset=utf-8');
}
