/**
 * Acquisition providers — injectable adapters behind the one gateway.
 *
 * None of these write storage. AIC is pinned-id resolution, not search.
 * A provider failure returns no candidates; it never selects a substitute.
 */

import { resolveAicWork } from '../content/atrium/imagery/adapters/aic.js';
import { isDisplayable } from '../content/atrium/imagery/works.js';
import {
  ARCHIVE_TEXT_REFUSE_SCORE,
  inspectArchiveText
} from './archive-text-inspect.js';
import {
  ACQUISITION_CANDIDATE_SCHEMA,
  AcquisitionError,
  assertHttpsAllowlisted,
  failAcquisition,
  fetchAllowlisted,
  generationConsentGranted,
  parseAicObjectId,
  parseArchiveWorkId,
  rightsFromAtrium,
  unknownRights
} from './acquisition.js';
import { contentHashOf, contentHashOfBytes } from './render/hash.js';
import { RENDER_LIMITS } from './render/limits.js';

const IIIF_HOST = 'https://www.artic.edu/iiif/2';

function imageIdFromWork(work) {
  const url = String(work?.imageUrl || '');
  const match = url.match(/\/iiif\/2\/([^/]+)\//);
  return match ? decodeURIComponent(match[1]) : null;
}

function iiifUrl(imageId) {
  return `${IIIF_HOST}/${encodeURIComponent(imageId)}/full/843,/0/default.jpg`;
}

function candidateBase(request, fields) {
  const candidate = {
    schema: ACQUISITION_CANDIDATE_SCHEMA,
    requestId: request.id,
    kind: request.kind,
    ...fields
  };
  return candidate;
}

export function createAicProvider({ resolveWork = resolveAicWork, fetchImpl } = {}) {
  return {
    id: 'aic',
    kinds: ['image'],
    preferences: ['public-domain'],
    async inspect(request, options = {}) {
      const objectId = parseAicObjectId(request.objectId || request.query);
      if (!objectId) return [];
      const doResolve = resolveWork || resolveAicWork;
      let work = null;
      try {
        work = await doResolve(objectId, { fetchImpl: options.fetchImpl || fetchImpl });
      } catch (error) {
        if (error instanceof AcquisitionError) throw error;
        failAcquisition('ACQUISITION_FETCH', 'Provider request failed', '$.provider', {
          reason: error?.message || 'provider'
        });
      }
      if (!work || !isDisplayable(work)) return [];
      const imageId = imageIdFromWork(work);
      if (!imageId) return [];
      try {
        assertHttpsAllowlisted(work.imageUrl, '$.sourceUrl');
      } catch (error) {
        if (error instanceof AcquisitionError) return [];
        throw error;
      }
      return [candidateBase(request, {
        id: `cand-aic-${objectId}`,
        origin: 'remote-acquisition',
        provider: 'aic',
        objectId,
        imageId,
        title: work.title,
        creator: work.artist,
        credit: [work.artist, work.title, work.sourceName].filter(Boolean).join(' — '),
        description: work.title,
        sourceUrl: work.sourceUrl,
        expectedMime: 'image/jpeg',
        rights: rightsFromAtrium(work)
      })];
    },
    async fetch(candidate, _request, options = {}) {
      if (!candidate.imageId) {
        failAcquisition('ACQUISITION_PROVIDER', 'AIC candidate is missing imageId', '$.imageId');
      }
      return fetchAllowlisted(iiifUrl(candidate.imageId), {
        fetchImpl: options.fetchImpl || fetchImpl,
        kind: 'image',
        maxBytes: RENDER_LIMITS.maxImageFileBytes
      });
    }
  };
}

export function createUploadProvider() {
  return {
    id: 'upload',
    kinds: ['image', 'document'],
    preferences: ['project-media'],
    async inspect(request, options = {}) {
      const bytes = options.bytes instanceof Uint8Array ? options.bytes : null;
      const mimeType = String(options.mimeType || '').trim();
      if (!bytes || !mimeType) return [];
      if (request.kind === 'image' && !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) {
        failAcquisition('ACQUISITION_MIME', 'Upload MIME is not an admitted image', '$.mimeType', {
          mimeType
        });
      }
      if (bytes.byteLength > (request.kind === 'document'
        ? options.maxTextCharacters || 2_000_000
        : RENDER_LIMITS.maxImageFileBytes)) {
        failAcquisition('ACQUISITION_SIZE', 'Upload exceeds the kind ceiling', '$.byteLength');
      }
      return [candidateBase(request, {
        id: `cand-upload-${request.id}`,
        origin: 'upload',
        provider: 'upload',
        title: options.title || 'Direct upload',
        expectedMime: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
        rights: options.rights || unknownRights()
      })];
    },
    async fetch(_candidate, _request, options = {}) {
      const bytes = options.bytes instanceof Uint8Array ? options.bytes : null;
      if (!bytes) failAcquisition('ACQUISITION_BYTES', 'Upload fetch needs the original bytes', '$.bytes');
      return {
        bytes,
        mimeType: String(options.mimeType || '').trim()
      };
    }
  };
}

export function createGeneratedProvider({ generate } = {}) {
  return {
    id: 'generated-image',
    kinds: ['image'],
    preferences: ['generated'],
    async inspect(request, options = {}) {
      if (!generationConsentGranted(options.consent)) return [];
      return [candidateBase(request, {
        id: `cand-gen-${request.id}`,
        origin: 'generated',
        provider: 'generated-image',
        title: 'Generated image',
        expectedMime: 'image/png',
        rights: unknownRights(),
        warnings: ['generated-status-is-not-rights']
      })];
    },
    async fetch(candidate, request, options = {}) {
      if (!generationConsentGranted(options.consent)) {
        failAcquisition('ACQUISITION_CONSENT_REQUIRED',
          'Generated acquisition needs explicit consent and a cost acknowledgement', '$.consent');
      }
      const run = options.generate || generate;
      if (typeof run !== 'function') {
        failAcquisition('ACQUISITION_GENERATOR_UNAVAILABLE',
          'No generator is bound after consent was granted', '$.generate');
      }
      const promptDigest = await contentHashOf(request.query);
      const result = await run({
        request,
        promptDigest,
        consent: options.consent
      });
      const bytes = result?.bytes instanceof Uint8Array ? result.bytes : null;
      if (!bytes) {
        failAcquisition('ACQUISITION_BYTES', 'Generator produced no image bytes', '$.bytes');
      }
      const mimeType = String(result.mimeType || 'image/png').trim();
      return {
        bytes,
        mimeType,
        promptDigest,
        generator: result.model || result.generator || 'generated-image',
        safetyResult: result.safetyResult || 'unmoderated',
        inputs: Array.isArray(result.inputs) ? result.inputs : null,
        createdAt: result.createdAt || null
      };
    }
  };
}

function editionStatement(edition) {
  if (edition == null) return null;
  if (typeof edition === 'string') return edition.trim() || null;
  return edition.statement
    || [edition.translator, edition.publisher, edition.year].filter(Boolean).join(', ')
    || null;
}

function catalogRecord(item) {
  if (!item || typeof item !== 'object') return null;
  const meta = item.meta && typeof item.meta === 'object' ? item.meta : item;
  if (!meta.id) return null;
  return {
    id: meta.id,
    title: meta.title,
    author: meta.author,
    edition: editionStatement(meta.edition),
    basis: meta.basis,
    payloadChecksum: meta.payloadChecksum || null,
    sourceSha256: meta.sourceSha256 || null
  };
}

function utf8Bytes(text) {
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  return bytes;
}

export function createArchiveTextProvider({ catalog = [] } = {}) {
  return {
    id: 'archive-text',
    kinds: ['document'],
    preferences: ['project-media'],
    async inspect(request, options = {}) {
      const relationship = request.relationship
        || (request.workId || parseArchiveWorkId(request.query) ? 'archive' : 'project-only');
      const workId = request.workId || parseArchiveWorkId(request.query);
      const list = options.catalog || catalog;
      let identity = options.identity || null;
      if (relationship === 'archive') {
        if (!workId) {
          failAcquisition('ACQUISITION_ARCHIVE_IDENTITY',
            'Archive text must name a catalog work id', '$.workId');
        }
        const found = (list || []).map(catalogRecord).find(item => item && item.id === workId);
        if (!found) {
          failAcquisition('ACQUISITION_ARCHIVE_IDENTITY',
            `Work ${workId} is not in the Archive catalog`, '$.workId');
        }
        identity = {
          title: found.title,
          author: found.author,
          edition: found.edition,
          basis: found.basis,
          payloadChecksum: found.payloadChecksum
        };
      }
      if (!identity?.title || !identity?.author || !identity?.edition || !identity?.basis) {
        failAcquisition('ACQUISITION_ARCHIVE_IDENTITY',
          'Text admission needs title, author, edition, and rights basis', '$.identity');
      }
      const raw = options.text;
      if (raw == null && relationship !== 'archive') {
        failAcquisition('ACQUISITION_TEXT_EMPTY', 'Project text admission needs the edition bytes',
          '$.text');
      }
      const warnings = [];
      let inspect = null;
      if (typeof raw === 'string') {
        const normalized = raw.normalize('NFC');
        if (!normalized.trim()) {
          failAcquisition('ACQUISITION_TEXT_EMPTY', 'Admitted text is empty', '$.text');
        }
        inspect = inspectArchiveText(normalized);
        if (inspect.score > ARCHIVE_TEXT_REFUSE_SCORE) {
          failAcquisition('ACQUISITION_TEXT_CLEANSING',
            'This edition fails Archive cleansing and cannot be admitted', '$.text', {
              score: inspect.score
            });
        }
        if (inspect.warnings.includes('watch')) warnings.push('watch');
        inspect = {
          apparatus: inspect.apparatus,
          gibberish: inspect.gibberish,
          furniture: inspect.furniture,
          symbols: inspect.symbols,
          score: inspect.score,
          sampleChars: inspect.sampleChars,
          lines: inspect.lines,
          encodingChanged: normalized !== raw
        };
      } else {
        warnings.push('payload-not-sampled');
      }
      return [candidateBase(request, {
        id: `cand-text-${request.id}`,
        origin: 'upload',
        provider: 'archive-text',
        workId: workId || undefined,
        relationship,
        title: identity.title,
        creator: identity.author,
        credit: [identity.author, identity.title, identity.edition].filter(Boolean).join(' — '),
        expectedMime: 'text/plain',
        rights: {
          status: relationship === 'archive' ? 'verified' : 'unknown',
          distributionAllowed: relationship === 'archive',
          license: identity.basis,
          credit: [identity.author, identity.title].filter(Boolean).join(' — '),
          evidence: identity.basis
        },
        inspect,
        warnings
      })];
    },
    async fetch(candidate, _request, options = {}) {
      const raw = options.text;
      if (typeof raw !== 'string') {
        failAcquisition('ACQUISITION_BYTES', 'Text fetch needs the edition as a string', '$.text');
      }
      const normalized = raw.normalize('NFC');
      if (!normalized.trim()) {
        failAcquisition('ACQUISITION_TEXT_EMPTY', 'Admitted text is empty', '$.text');
      }
      const report = inspectArchiveText(normalized);
      if (report.score > ARCHIVE_TEXT_REFUSE_SCORE) {
        failAcquisition('ACQUISITION_TEXT_CLEANSING',
          'This edition fails Archive cleansing and cannot be admitted', '$.text', {
            score: report.score
          });
      }
      const bytes = utf8Bytes(normalized);
      const list = options.catalog || catalog;
      const found = candidate.workId
        ? (list || []).map(catalogRecord).find(item => item && item.id === candidate.workId)
        : null;
      if (found?.payloadChecksum) {
        const hash = await contentHashOfBytes(bytes);
        if (hash !== `sha256:${found.payloadChecksum}`) {
          failAcquisition('ACQUISITION_ARCHIVE_IDENTITY',
            'Payload does not match the catalog checksum', '$.text');
        }
      }
      return { bytes, mimeType: 'text/plain' };
    }
  };
}

export function createVoiceProvider({ generate } = {}) {
  return {
    id: 'voice',
    kinds: ['voice'],
    preferences: ['project-media', 'generated'],
    async inspect(request, options = {}) {
      if (request.sourcePreference.includes('generated')) {
        if (!generationConsentGranted(options.consent)
          && request.sourcePreference.every(item => item === 'generated')) {
          failAcquisition('ACQUISITION_CONSENT_REQUIRED',
            'Generated speech needs explicit consent and a cost acknowledgement', '$.consent');
        }
        if (generationConsentGranted(options.consent)) {
          return [candidateBase(request, {
            id: `cand-voice-gen-${request.id}`,
            origin: 'generated',
            provider: 'voice',
            title: 'Generated speech',
            expectedMime: 'audio/wav',
            rights: unknownRights(),
            warnings: ['generated-status-is-not-rights']
          })];
        }
      }
      const bytes = options.bytes instanceof Uint8Array ? options.bytes : null;
      const mimeType = String(options.mimeType || '').trim();
      if (!bytes || !mimeType) return [];
      if (!/^audio\/(wav|wave|x-wav|mpeg|mp3)$/i.test(mimeType)) {
        failAcquisition('ACQUISITION_MIME', 'Spoken admission is WAV or MPEG only', '$.mimeType', {
          mimeType
        });
      }
      if (!Number.isInteger(options.durationMs) || options.durationMs <= 0) {
        failAcquisition('ACQUISITION_DURATION',
          'Spoken audio needs a duration before it can be inspected', '$.durationMs');
      }
      return [candidateBase(request, {
        id: `cand-voice-${request.id}`,
        origin: 'upload',
        provider: 'voice',
        title: options.title || 'Spoken take',
        expectedMime: mimeType === 'audio/mp3' ? 'audio/mpeg' : mimeType,
        rights: options.rights || unknownRights()
      })];
    },
    async fetch(candidate, request, options = {}) {
      if (candidate.origin === 'generated') {
        if (!generationConsentGranted(options.consent)) {
          failAcquisition('ACQUISITION_CONSENT_REQUIRED',
            'Generated speech needs explicit consent and a cost acknowledgement', '$.consent');
        }
        const run = options.generate || generate;
        if (typeof run !== 'function') {
          failAcquisition('ACQUISITION_GENERATOR_UNAVAILABLE',
            'No speech generator is bound after consent was granted', '$.generate');
        }
        const result = await run({ request, consent: options.consent });
        const bytes = result?.bytes instanceof Uint8Array ? result.bytes : null;
        if (!bytes) failAcquisition('ACQUISITION_BYTES', 'Generator produced no speech bytes', '$.bytes');
        return {
          bytes,
          mimeType: String(result.mimeType || 'audio/wav').trim(),
          durationMs: result.durationMs || options.durationMs,
          generator: result.model || result.generator || 'generated-voice',
          safetyResult: result.safetyResult || 'unmoderated',
          promptDigest: result.promptDigest || null
        };
      }
      const bytes = options.bytes instanceof Uint8Array ? options.bytes : null;
      if (!bytes) failAcquisition('ACQUISITION_BYTES', 'Voice fetch needs the original bytes', '$.bytes');
      return {
        bytes,
        mimeType: String(options.mimeType || '').trim(),
        durationMs: options.durationMs
      };
    }
  };
}

export function createDefaultAcquisitionProviders(options = {}) {
  return [
    createAicProvider(options),
    createUploadProvider(),
    createGeneratedProvider(options),
    createArchiveTextProvider(options),
    createVoiceProvider(options)
  ];
}
