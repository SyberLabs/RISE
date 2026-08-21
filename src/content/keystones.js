/**
 * The three release Keystones are launch manifests, not a new runtime.
 *
 * Each one binds a human-facing route to one exact Archive edition and
 * division, then lowers to the same Session configuration the Chamber already
 * executes. Operational admission is fail-closed for changed bytes, missing
 * media, or incomplete voice coverage. Exact-edition certification remains a
 * separate publication gate for release artifacts and certified shelf claims.
 */

import { ingestedArchiveTexts } from './archive/index.js';
import { isArchiveEditionCertified } from './archive/certification.js';
import { hasPinnedCollection } from './imagery/provider.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { MUSEUM_CATEGORY_PINS } from '../sources/visual/museum-pins.js';
import { proceduralPattern } from '../core/visual-registry.js';
import { compileSession } from '../core/session-compiler.js';
import { Voice } from '../audio/voice.js';
import { DEFAULT_VOICE_ID, voicePackManifest } from '../audio/voice-pack.js';
import { SEQUENCE_CAPABILITIES } from '../core/sequence-capabilities.js';

export const KEYSTONE_SCHEMA = 'rise.keystone.v1';
export const KEYSTONE_ROUTE_PREFIX = '/keystone/';
export const TRY_RISE_PATH = '/try-rise';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

export const KEYSTONE_MANIFESTS = freeze([
  {
    schema: KEYSTONE_SCHEMA,
    slug: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    relation: 'Fractal Flame',
    axis: 'Mind',
    source: {
      workId: 'literary-meditations',
      editionId: 'standard-ebooks:marcus-aurelius/meditations_george-long',
      sourceRevision: 'sha256:1d5c3e8ca1cd6b9b98731ebc034a6408eea84b2642525844cd4e04f9445a2418',
      entryId: 1,
      expectedLabel: 'Book II'
    },
    visual: { kind: 'procedural', id: 'fractal' },
    soundscape: 'faded-signal',
    galleryCadence: 0.5,
    admitted: true,
    capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
  },
  {
    schema: KEYSTONE_SCHEMA,
    slug: 'metamorphoses',
    title: 'Metamorphoses',
    author: 'Ovid',
    relation: 'Iris Plates',
    axis: 'Transformation',
    source: {
      workId: 'metamorphoses',
      editionId: 'standard-ebooks:ovid/metamorphoses_various-translators',
      sourceRevision: 'sha256:6878e143e0db80039364eb328b65a33faf2c1a43a67696d74920c5a17a5bd17a',
      entryId: 116,
      expectedLabel: 'Book XIII · Story of Polyxena and Hecuba'
    },
    visual: { kind: 'procedural', id: 'ostensoria' },
    soundscape: 'aurora',
    galleryCadence: 0.5,
    admitted: true,
    capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
  },
  {
    schema: KEYSTONE_SCHEMA,
    slug: 'tintern',
    title: 'Tintern Abbey',
    author: 'William Wordsworth',
    relation: 'Landscapes',
    axis: 'World',
    source: {
      workId: 'lyrical-ballads',
      editionId: 'standard-ebooks:william-wordsworth/samuel-taylor-coleridge_lyrical-ballads',
      sourceRevision: 'sha256:24576576e9f5b402ff5c2b004c8888b5445f56e89ce9e9a52dca9c33636612d5',
      entryId: 19,
      expectedLabel: 'Volume I · Lines Written a Few Miles Above Tintern Abbey, on Revisiting the Banks of the Wye During a Tour'
    },
    visual: { kind: 'collection', id: 'aic-landscapes' },
    soundscape: 'aurora',
    galleryCadence: 0.15,
    admitted: true,
    capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
  }
]);

export function keystonePath(slug) {
  return `${KEYSTONE_ROUTE_PREFIX}${String(slug || '').trim().toLowerCase()}`;
}

export function isTryRisePath(pathname) {
  return String(pathname || '').replace(/\/+$/u, '') === TRY_RISE_PATH;
}

export function keystoneSlugFromPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/u, '');
  if (!path.startsWith(KEYSTONE_ROUTE_PREFIX)) return null;
  const slug = decodeURIComponent(path.slice(KEYSTONE_ROUTE_PREFIX.length));
  return KEYSTONE_MANIFESTS.some(item => item.slug === slug) ? slug : null;
}

export function keystoneManifest(slug) {
  return KEYSTONE_MANIFESTS.find(item => item.slug === slug) || null;
}

function sourceBlocker(code, message) {
  return Object.freeze({ code, message });
}

async function resolveSource(manifest) {
  const work = ingestedArchiveTexts().find(item => item.id === manifest.source.workId);
  if (!work) {
    return { blocker: sourceBlocker('KEYSTONE_SOURCE_MISSING', 'The exact Archive work is not registered.') };
  }
  if (work.editionId !== manifest.source.editionId
    || work.sourceRevision !== manifest.source.sourceRevision) {
    return { blocker: sourceBlocker('KEYSTONE_SOURCE_CHANGED', 'The Archive edition no longer matches this manifest.') };
  }
  const divisions = await work.getDivisions();
  const entry = divisions.entries?.find(candidate => String(candidate.id) === String(manifest.source.entryId));
  if (!entry) {
    return { blocker: sourceBlocker('KEYSTONE_ENTRY_MISSING', 'The authored division no longer exists in this edition.') };
  }
  if (entry.label !== manifest.source.expectedLabel) {
    return { blocker: sourceBlocker(
      'KEYSTONE_ENTRY_CHANGED',
      `The authored division identity changed: expected “${manifest.source.expectedLabel}”, found “${entry.label}”.`
    ) };
  }
  return { work, entry };
}

function visualAvailable(visual) {
  if (visual.kind === 'procedural') return Boolean(proceduralPattern(visual.id));
  if (visual.kind === 'collection') {
    if (hasPinnedCollection(visual.id)) return true;
    if (!visual.id.startsWith('aic-')) return false;
    const categoryId = visual.id.slice('aic-'.length);
    return Boolean(MUSEUM_CATEGORIES[categoryId]
      && MUSEUM_CATEGORY_PINS[categoryId]?.length);
  }
  return false;
}

function visualConfig(manifest) {
  const procedural = manifest.visual.kind === 'procedural' ? [manifest.visual.id] : [];
  const sourced = manifest.visual.kind === 'collection' ? [manifest.visual.id] : [];
  return {
    consentScope: globalThis.crypto?.randomUUID?.() || `keystone:${manifest.slug}`,
    visualMode: 'interlocution',
    livingText: { enabled: true },
    interlocution: {
      sourceFamily: manifest.visual.kind === 'procedural' ? 'procedural' : 'collections',
      procedural,
      sourced,
      atriumCollections: sourced,
      presentation: 'continuous',
      galleryCadence: manifest.galleryCadence,
      responsive: false
    }
  };
}

function sessionInput(manifest, work, entry, recitationEnabled) {
  return {
    name: `Keystone · ${manifest.title}`,
    title: manifest.title,
    text: entry.content,
    textSource: `${manifest.title} · ${entry.label}`,
    sourceId: `keystone:${manifest.slug}`,
    wpm: 200,
    chunkMode: 'phrase',
    curve: 'flat',
    revealMode: 'progressive',
    verseLines: entry.verse === true,
    projection: 'stream',
    soundscape: manifest.soundscape,
    audioPreset: 'silent',
    capabilities: manifest.capabilities,
    recitation: { enabled: recitationEnabled },
    voiceId: DEFAULT_VOICE_ID,
    visualConfig: visualConfig(manifest),
    origin: { view: 'keystones', icon: '✦', name: 'Keystones' },
    provenance: {
      kind: 'keystone',
      keystone: manifest.slug,
      workId: work.workId,
      editionId: work.editionId,
      sourceRevision: work.sourceRevision,
      divisionId: entry.id,
      divisionLabel: entry.label,
      certificationStatus: work.certificationStatus
    }
  };
}

/**
 * Resolve one Keystone and report every release blocker in one pass.
 * `allowIncomplete` is review-only: it returns a runnable silent session when
 * the exact source and visual exist, but never changes public readiness.
 */
export async function resolveKeystone(slug, { allowIncomplete = false } = {}) {
  const manifest = keystoneManifest(slug);
  if (!manifest) throw new TypeError(`Unknown Keystone: ${slug}`);

  const blockers = [];
  const resolved = await resolveSource(manifest);
  if (resolved.blocker) blockers.push(resolved.blocker);
  if (!visualAvailable(manifest.visual)) {
    blockers.push(sourceBlocker(
      'KEYSTONE_VISUAL_MISSING',
      manifest.visual.kind === 'collection'
        ? `The curated ${manifest.relation} collection has not been admitted.`
        : `The ${manifest.relation} engine is unavailable.`
    ));
  }
  if (resolved.work && !isArchiveEditionCertified({
    id: resolved.work.workId,
    editionId: resolved.work.editionId,
    sourceRevision: resolved.work.sourceRevision
  })) {
    blockers.push(sourceBlocker('KEYSTONE_SOURCE_UNCERTIFIED', 'The exact source edition awaits human certification.'));
  }

  let input = null;
  let coverage = Object.freeze({ speakable: 0, missing: 0, complete: false });
  // Voice coverage is independent evidence. Report it even when the visual
  // collection is absent, otherwise one early blocker hides another and the
  // release report becomes sequential whack-a-mole.
  if (resolved.work && resolved.entry) {
    const silentInput = sessionInput(manifest, resolved.work, resolved.entry, false);
    const silentSession = compileSession(silentInput);
    coverage = Object.freeze(new Voice({
      voiceId: DEFAULT_VOICE_ID,
      manifest: voicePackManifest
    }).coverage(silentSession.atoms));
    if (!coverage.complete) {
      blockers.push(sourceBlocker(
        'KEYSTONE_RECITATION_INCOMPLETE',
        `Complete recitation is unavailable (${coverage.missing} of ${coverage.speakable} phrases missing).`
      ));
    }
    const admitted = manifest.admitted === true && blockers.every(
      blocker => blocker.code === 'KEYSTONE_SOURCE_UNCERTIFIED'
    );
    if (visualAvailable(manifest.visual)
      && (blockers.length === 0 || admitted || allowIncomplete)) {
      input = sessionInput(manifest, resolved.work, resolved.entry, coverage.complete);
    }
  }

  const operationalBlockers = blockers.filter(
    blocker => blocker.code !== 'KEYSTONE_SOURCE_UNCERTIFIED'
  );
  const admitted = manifest.admitted === true
    && operationalBlockers.length === 0
    && Boolean(input);

  return Object.freeze({
    manifest,
    ready: blockers.length === 0,
    admitted,
    reviewable: Boolean(input),
    blockers: Object.freeze(blockers),
    coverage,
    sessionInput: input ? Object.freeze(input) : null
  });
}
