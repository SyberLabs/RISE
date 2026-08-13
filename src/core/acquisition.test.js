import { describe, expect, it } from 'vitest';
import { RIGHTS } from '../content/atrium/imagery/works.js';
import {
  ACQUISITION_CANDIDATE_SCHEMA,
  ACQUISITION_REQUEST_SCHEMA,
  ACQUISITION_VERDICT_SCHEMA,
  AcquisitionError,
  acquisitionRequestFromAgentOp,
  admitAcquisitionCandidate,
  assertHttpsAllowlisted,
  fetchAcquisitionCandidate,
  inspectAcquisition,
  inspectRequestAsset,
  validateAcquisitionRequest
} from './acquisition.js';
import {
  createAicProvider,
  createArchiveTextProvider,
  createDefaultAcquisitionProviders,
  createGeneratedProvider,
  createUploadProvider
} from './acquisition-providers.js';
import { AGENT_OPERATION_SET_SCHEMA, applyAgentOperationSet } from './agent-operations.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { contentHashOf, contentHashOfBytes } from './render/hash.js';
import { PROJECT_ASSET_SCHEMA } from './render/project-asset.js';

const NOW = '2026-08-13T21:00:00.000Z';
const PROJECT_ID = 'project-memory';

function jpegBytes(fill = 7, length = 64) {
  const bytes = new Uint8Array(length).fill(fill);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

function pngBytes(fill = 9, length = 64) {
  const bytes = new Uint8Array(length).fill(fill);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function htmlBytes() {
  return new TextEncoder().encode('<!DOCTYPE html><html><body>nope</body></html>');
}

function headers(map) {
  return {
    get(name) {
      return map[String(name).toLowerCase()] ?? null;
    }
  };
}

function imageResponse(bytes, { status = 200, contentType = 'image/jpeg', contentLength } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    type: 'basic',
    headers: headers({
      'content-type': contentType,
      'content-length': String(contentLength ?? bytes.byteLength)
    }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

function aicWork(overrides = {}) {
  return {
    id: 'aic:27992',
    title: 'The Bedroom',
    artist: 'Vincent van Gogh',
    date: '1889',
    medium: 'Oil on canvas',
    rights: RIGHTS.CC0,
    imageUrl: 'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f2526b23a8/full/843,/0/default.jpg',
    fullImageUrl: 'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f2526b23a8/full/1686,/0/default.jpg',
    sourceName: 'Art Institute of Chicago',
    sourceUrl: 'https://www.artic.edu/artworks/27992',
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    schema: ACQUISITION_REQUEST_SCHEMA,
    id: 'rain-window',
    projectId: PROJECT_ID,
    kind: 'image',
    purpose: 'passage visual',
    query: 'aic:27992',
    sourcePreference: ['public-domain'],
    ...overrides
  };
}

function verdict(candidateId, decision = 'admit') {
  return {
    schema: ACQUISITION_VERDICT_SCHEMA,
    candidateId,
    decision,
    actor: 'human',
    authority: 'user',
    decidedAt: NOW
  };
}

function providers(overrides = {}) {
  const jpeg = jpegBytes();
  return createDefaultAcquisitionProviders({
    resolveWork: async () => aicWork(),
    fetchImpl: async () => imageResponse(jpeg),
    generate: async () => ({
      bytes: pngBytes(),
      mimeType: 'image/png',
      model: 'test-image-1',
      safetyResult: 'passed'
    }),
    catalog: [{
      id: 'literary-walden',
      title: 'Walden',
      author: 'Henry David Thoreau',
      edition: { statement: 'Boston, 1854', year: 1854 },
      basis: 'pre-1930-us'
    }],
    ...overrides
  });
}

async function admitFrom(requestValue, options) {
  const candidates = await inspectAcquisition(requestValue, options);
  expect(candidates.length).toBeGreaterThan(0);
  const fetched = await fetchAcquisitionCandidate(candidates[0], requestValue, options);
  return admitAcquisitionCandidate({
    ...fetched,
    verdict: verdict(fetched.candidate.id),
    projectId: PROJECT_ID,
    assetId: 'asset-acquired',
    now: NOW
  });
}

describe('rise.acquisition-request.v1', () => {
  it('validates a closed request and refuses URI identities or unknown fields', () => {
    const value = validateAcquisitionRequest(request());
    expect(value.schema).toBe(ACQUISITION_REQUEST_SCHEMA);
    expect(value.objectId).toBeUndefined();
    expect(() => validateAcquisitionRequest(request({ id: 'https://example.com/x' })))
      .toThrow(expect.objectContaining({ code: 'ACQUISITION_URI' }));
    expect(() => validateAcquisitionRequest(request({ extra: true })))
      .toThrow(expect.objectContaining({ code: 'ACQUISITION_UNKNOWN_FIELD' }));
  });

  it('maps a request-asset operation onto an acquisition request without treating it as admitted', () => {
    const mapped = acquisitionRequestFromAgentOp({
      op: 'request-asset',
      id: 'op-req',
      requestId: 'rain-window',
      kind: 'image',
      query: 'aic:27992',
      anchor: { sourceId: 'anna-1', fromCharacter: 0, toCharacter: 12 }
    }, { projectId: PROJECT_ID });
    expect(mapped.id).toBe('rain-window');
    expect(mapped.objectId).toBe('27992');
    expect(mapped.proposedAnchor.sourceId).toBe('anna-1');
  });
});

describe('acquisition inspect / fetch / admit', () => {
  it('admits a pinned AIC public-domain image after a human verdict', async () => {
    const options = { providers: providers(), now: NOW };
    const result = await admitFrom(request(), options);
    expect(result.status).toBe('admitted');
    expect(result.asset.schema).toBe(PROJECT_ASSET_SCHEMA);
    expect(result.asset.kind).toBe('image');
    expect(result.asset.mimeType).toBe('image/jpeg');
    expect(result.asset.contentHash).toBe(await contentHashOfBytes(jpegBytes()));
    expect(result.asset.rights.status).toBe('verified');
    expect(result.asset.rights.license).toBe('CC0');
    expect(result.asset.provenance.origin).toBe('remote-acquisition');
    expect(result.asset.provenance.provider).toBe('aic');
    expect(result.asset.storage.kind).toBe('workshop-idb');
  });

  it('returns no AIC candidate for unknown rights', async () => {
    const options = {
      providers: [
        createAicProvider({
          resolveWork: async () => aicWork({ rights: RIGHTS.UNKNOWN })
        })
      ]
    };
    const candidates = await inspectAcquisition(request(), options);
    expect(candidates).toEqual([]);
  });

  it('does not consult the next adapter after a provider failure', async () => {
    const options = {
      providers: [
        createAicProvider({
          resolveWork: async () => { throw new Error('AIC unreachable'); }
        }),
        createAicProvider({
          resolveWork: async () => aicWork({ id: 'aic:999', title: 'Unrelated substitute' })
        })
      ]
    };
    await expect(inspectAcquisition(request(), options))
      .rejects.toMatchObject({ code: 'ACQUISITION_FETCH' });
  });

  it('returns no candidate when the query is a search phrase rather than a pinned id', async () => {
    const candidates = await inspectAcquisition(request({
      query: 'rain on a nineteenth-century railway window',
      objectId: undefined
    }), { providers: providers() });
    expect(candidates).toEqual([]);
  });

  it('refuses redirects, HTML, and oversized responses before durable storage', async () => {
    const candidateOptions = (fetchImpl) => ({
      providers: createDefaultAcquisitionProviders({
        resolveWork: async () => aicWork(),
        fetchImpl
      })
    });
    const req = request();
    const [candidate] = await inspectAcquisition(req, candidateOptions(async () => imageResponse(jpegBytes())));

    await expect(fetchAcquisitionCandidate(candidate, req, candidateOptions(async () => ({
      ok: false,
      status: 302,
      type: 'opaqueredirect',
      headers: headers({ location: 'https://evil.example/x' }),
      arrayBuffer: async () => new ArrayBuffer(0)
    })))).rejects.toMatchObject({ code: 'ACQUISITION_REDIRECT' });

    await expect(fetchAcquisitionCandidate(candidate, req, candidateOptions(async () => imageResponse(htmlBytes(), {
      contentType: 'text/html'
    })))).rejects.toMatchObject({ code: 'ACQUISITION_HTML' });

    await expect(fetchAcquisitionCandidate(candidate, req, candidateOptions(async () => imageResponse(jpegBytes(), {
      contentLength: 9 * 1024 * 1024
    })))).rejects.toMatchObject({ code: 'ACQUISITION_SIZE' });
  });

  it('refuses a JPEG content-type whose bytes are HTML', async () => {
    const req = request();
    const options = {
      providers: createDefaultAcquisitionProviders({
        resolveWork: async () => aicWork(),
        fetchImpl: async () => imageResponse(htmlBytes(), { contentType: 'image/jpeg' })
      })
    };
    const [candidate] = await inspectAcquisition(req, options);
    await expect(fetchAcquisitionCandidate(candidate, req, options))
      .rejects.toMatchObject({ code: 'ACQUISITION_MIME' });
  });

  it('admits a direct upload through the same hash and rights path', async () => {
    const bytes = pngBytes();
    const req = request({
      query: 'studio still',
      sourcePreference: ['project-media']
    });
    const options = {
      providers: [createUploadProvider()],
      bytes,
      mimeType: 'image/png',
      now: NOW
    };
    const result = await admitFrom(req, options);
    expect(result.asset.provenance.origin).toBe('upload');
    expect(result.asset.rights.status).toBe('unknown');
    expect(result.asset.rights.distributionAllowed).toBe(false);
    expect(result.asset.contentHash).toBe(await contentHashOfBytes(bytes));
  });

  it('refuses generated images without consent and cost acknowledgement', async () => {
    const req = request({
      query: 'rain on a railway window',
      sourcePreference: ['generated']
    });
    await expect(inspectAcquisition(req, { providers: providers() }))
      .rejects.toMatchObject({ code: 'ACQUISITION_CONSENT_REQUIRED' });
  });

  it('records generator provenance and will not treat generation as verified rights', async () => {
    const req = request({
      query: 'rain on a railway window',
      sourcePreference: ['generated']
    });
    const options = {
      providers: providers(),
      consent: { generation: true, costAcknowledged: true },
      now: NOW
    };
    const result = await admitFrom(req, options);
    expect(result.asset.provenance.origin).toBe('generated');
    expect(result.asset.provenance.generator).toBe('test-image-1');
    expect(result.asset.provenance.promptDigest).toBe(await contentHashOf(req.query));
    expect(result.asset.provenance.safetyResult).toBe('passed');
    expect(result.asset.rights.status).toBe('unknown');
    expect(result.asset.rights.distributionAllowed).toBe(false);
  });

  it('refuses generation after consent if no generator is bound', async () => {
    const req = request({
      query: 'rain on a railway window',
      sourcePreference: ['generated']
    });
    const options = {
      providers: [createGeneratedProvider()],
      consent: { generation: true, costAcknowledged: true }
    };
    const [candidate] = await inspectAcquisition(req, options);
    await expect(fetchAcquisitionCandidate(candidate, req, options))
      .rejects.toMatchObject({ code: 'ACQUISITION_GENERATOR_UNAVAILABLE' });
  });

  it('admits clean project text and refuses a variorum as if it were the work', async () => {
    const catalog = [{
      id: 'literary-walden',
      title: 'Walden',
      author: 'Henry David Thoreau',
      edition: { statement: 'Boston, 1854', year: 1854 },
      basis: 'pre-1930-us'
    }];
    const clean = {
      providers: [createArchiveTextProvider({ catalog })],
      text: 'I went to the woods because I wished to live deliberately.',
      identity: {
        title: 'Notes',
        author: 'A reader',
        edition: 'project draft, 2026',
        basis: 'user-asserted'
      }
    };
    const admitted = await admitFrom({
      schema: ACQUISITION_REQUEST_SCHEMA,
      id: 'notes-1',
      kind: 'document',
      query: 'project notes',
      sourcePreference: ['project-media'],
      relationship: 'project-only'
    }, { ...clean, now: NOW });
    expect(admitted.asset.kind).toBe('document');
    expect(admitted.asset.mimeType).toBe('text/plain');
    expect(admitted.asset.storage.kind).toBe('inline');

    await expect(inspectAcquisition({
      schema: ACQUISITION_REQUEST_SCHEMA,
      id: 'hamlet-bad',
      kind: 'document',
      query: 'archive:literary-walden',
      workId: 'literary-walden',
      relationship: 'archive',
      sourcePreference: ['project-media']
    }, {
      providers: [createArchiveTextProvider({ catalog })],
      text: [
        '140. at] Ff. om. Qq.',
        '63. smote] smot Q2Q3 F2F3.',
        'Capell conj. om. Pope.'
      ].join('\n')
    })).rejects.toMatchObject({ code: 'ACQUISITION_TEXT_CLEANSING' });
  });

  it('defers audio and video until media-specific checks exist', async () => {
    await expect(inspectAcquisition(request({ kind: 'audio', query: 'swell' }), {
      providers: providers()
    })).rejects.toMatchObject({ code: 'ACQUISITION_KIND_DEFERRED' });
    await expect(inspectAcquisition(request({ kind: 'video', query: 'clip' }), {
      providers: providers()
    })).rejects.toMatchObject({ code: 'ACQUISITION_KIND_DEFERRED' });
  });

  it('will not let an agent admit a candidate', async () => {
    const options = { providers: providers(), now: NOW };
    const candidates = await inspectAcquisition(request(), options);
    const fetched = await fetchAcquisitionCandidate(candidates[0], request(), options);
    await expect(admitAcquisitionCandidate({
      ...fetched,
      verdict: {
        schema: ACQUISITION_VERDICT_SCHEMA,
        candidateId: fetched.candidate.id,
        decision: 'admit',
        actor: 'agent',
        authority: 'proposed',
        decidedAt: NOW
      },
      projectId: PROJECT_ID,
      assetId: 'asset-acquired'
    })).rejects.toMatchObject({ code: 'ACQUISITION_HUMAN_REQUIRED' });
  });

  it('keeps request-asset pending until a human admits, then the asset can be scored', async () => {
    const project = emptyWorkshopProject({ id: PROJECT_ID });
    const requestOp = {
      op: 'request-asset',
      id: 'op-req',
      requestId: 'rain-window',
      kind: 'image',
      query: 'aic:27992'
    };
    const applied = applyAgentOperationSet({
      project,
      operationSet: {
        schema: AGENT_OPERATION_SET_SCHEMA,
        id: 'ops-acq-1',
        projectId: PROJECT_ID,
        baseRevision: 0,
        operations: [requestOp]
      }
    });
    expect(applied.inspection[0].status).toBe('pending');
    expect(applied.project.assets || []).toEqual([]);

    const { request: acq, candidates } = await inspectRequestAsset(requestOp, {
      providers: providers(),
      projectId: PROJECT_ID
    });
    const fetched = await fetchAcquisitionCandidate(candidates[0], acq, { providers: providers() });
    const admitted = await admitAcquisitionCandidate({
      ...fetched,
      verdict: verdict(fetched.candidate.id),
      projectId: PROJECT_ID,
      assetId: 'asset-rain-window',
      now: NOW
    });
    expect(admitted.asset.id).toBe('asset-rain-window');
    expect(admitted.candidate.schema).toBe(ACQUISITION_CANDIDATE_SCHEMA);
  });
});

describe('acquisition refusals stay named', () => {
  it('throws AcquisitionError, never a generic TypeError, for a missing provider list', async () => {
    await expect(inspectAcquisition(request(), { providers: [] }))
      .rejects.toBeInstanceOf(AcquisitionError);
  });

  it('refuses credentials in a fetch URL before any request is made', () => {
    expect(() => assertHttpsAllowlisted('https://user:secret@www.artic.edu/iiif/2/x'))
      .toThrow(expect.objectContaining({ code: 'ACQUISITION_CREDENTIALS' }));
  });
});
