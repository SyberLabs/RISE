import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../experience-program.js';
import { SEQUENCE_ASSET_PREFIX } from '../visual-score-lane.js';
import { contentHashOfBytes } from './hash.js';
import {
  ASSET_TRANSFER_BUNDLE_SCHEMA,
  PROJECT_ASSET_SCHEMA,
  ProjectAssetError,
  admitTransformedAsset,
  assertDistributionAllowed,
  compileProjectAssetManifest,
  defaultUploadRights,
  importTransferBundle,
  inventoryAssetFromProjectAsset,
  packTransferBundle,
  planAssetDeletion,
  projectLibraryAudio,
  projectPersonalSwell,
  projectWorkshopMedia,
  recoverAssetFromBundle,
  referencedAssetIdsFromProgram,
  rightsCapabilities,
  validateProjectAsset,
  verifyTransferBundle
} from './project-asset.js';

const HASH = `sha256:${'ab'.repeat(32)}`;
const PARENT_HASH = `sha256:${'cd'.repeat(32)}`;
const IMAGE_ID = 'asset-rain-window';
const VIDEO_ID = 'asset-water';
const SWELL_ID = 'swell_user_bell';
const SOURCE_ID = 'source-1';
const PROJECT_ID = 'project-memory';

function pngBytes(fill = 7, length = 32) {
  return new Uint8Array(length).fill(fill);
}

function assetInput(overrides = {}) {
  return {
    schema: PROJECT_ASSET_SCHEMA,
    id: IMAGE_ID,
    projectId: PROJECT_ID,
    kind: 'image',
    mimeType: 'image/png',
    byteLength: 32,
    contentHash: HASH,
    storage: { kind: 'workshop-idb', recordId: IMAGE_ID },
    provenance: { origin: 'upload', acquiredAt: '2026-08-12T00:00:00.000Z' },
    rights: { status: 'unknown', distributionAllowed: false },
    transformations: [],
    ...overrides
  };
}

function programWith(tracks) {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'asset-score',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [SOURCE_ID] },
          data: { index: 0, title: 'One' }
        }]
      },
      ...tracks
    ]
  });
}

function imageProgram() {
  return programWith([{
    id: 'visual-main',
    kind: 'visual',
    clips: [{
      id: 'image-1',
      anchor: { sourceIds: [SOURCE_ID] },
      cue: { kind: 'sourced', collections: [`${SEQUENCE_ASSET_PREFIX}${IMAGE_ID}`] }
    }],
    fallback: { kind: 'still' }
  }]);
}

function stillProgram() {
  return programWith([{
    id: 'visual-main',
    kind: 'visual',
    clips: [{
      id: 'still-1',
      anchor: { sourceIds: [SOURCE_ID] },
      cue: { kind: 'still' }
    }],
    fallback: { kind: 'still' }
  }]);
}

function swellProgram() {
  return programWith([{
    id: 'swells',
    kind: 'swell',
    clips: [{
      id: 'swell-1',
      anchor: { sourceIds: [SOURCE_ID] },
      cue: { kind: 'swell', swellId: SWELL_ID, fadeMs: 250 }
    }]
  }]);
}

describe('rise.project-asset.v1', () => {
  it('returns a detached immutable record and refuses URIs as identities', () => {
    const input = assetInput();
    const asset = validateProjectAsset(input);
    expect(asset).not.toBe(input);
    expect(Object.isFrozen(asset)).toBe(true);
    expect(asset.schema).toBe(PROJECT_ASSET_SCHEMA);
    expect(asset.rights.status).toBe('unknown');
    expect(() => validateProjectAsset(assetInput({
      id: 'https://example.com/rain.png'
    }))).toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_URI' }));
    expect(() => validateProjectAsset(assetInput({ extra: true })))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_UNKNOWN_FIELD' }));
    expect(() => validateProjectAsset(assetInput({ mimeType: 'image/svg+xml' })))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_MIME' }));
  });

  it('projects a Workshop image record without moving its bytes', async () => {
    const bytes = pngBytes();
    const asset = await projectWorkshopMedia({
      record: {
        id: IMAGE_ID,
        projectId: PROJECT_ID,
        mimeType: 'image/png',
        byteLength: bytes.byteLength,
        createdAt: Date.parse('2026-08-12T00:00:00.000Z')
      },
      bytes
    });
    expect(asset.storage).toEqual({ kind: 'workshop-idb', recordId: IMAGE_ID });
    expect(asset.contentHash).toBe(await contentHashOfBytes(bytes));
    expect(asset.provenance.origin).toBe('upload');
    expect(asset.rights).toEqual(defaultUploadRights());
    expect(asset).not.toHaveProperty('uri');
  });

  it('projects a personal swell and a library bed onto the same schema', async () => {
    const pcm = new Uint8Array(64).fill(3);
    const swell = await projectPersonalSwell({
      record: {
        id: SWELL_ID,
        name: 'Bell',
        timestamp: Date.parse('2026-08-12T00:00:00.000Z'),
        type: 'audio/mpeg',
        byteLength: pcm.byteLength
      },
      projectId: PROJECT_ID,
      bytes: pcm
    });
    expect(swell.kind).toBe('audio');
    expect(swell.storage.kind).toBe('personal-swells-idb');
    expect(swell.contentHash).toBe(await contentHashOfBytes(pcm));

    const aurora = await projectLibraryAudio({
      assetId: 'soundscape:aurora',
      projectId: PROJECT_ID
    });
    expect(aurora.storage.kind).toBe('library');
    expect(aurora.byteLength).toBe(0);
    expect(aurora.rights.status).toBe('verified');
    expect(aurora.provenance.origin).toBe('library');
  });

  it('lets two ids share a hash and never treats the hash as editor identity', async () => {
    const bytes = pngBytes(9);
    const hash = await contentHashOfBytes(bytes);
    const left = await projectWorkshopMedia({
      record: { id: 'asset-a', projectId: PROJECT_ID, mimeType: 'image/png', byteLength: 32 },
      bytes
    });
    const right = await projectWorkshopMedia({
      record: { id: 'asset-b', projectId: PROJECT_ID, mimeType: 'image/png', byteLength: 32 },
      bytes
    });
    expect(left.id).not.toBe(right.id);
    expect(left.contentHash).toBe(hash);
    expect(right.contentHash).toBe(hash);
  });

  it('records transformation lineage and refuses to overwrite the parent', async () => {
    const parent = validateProjectAsset(assetInput({ contentHash: PARENT_HASH }));
    const cropped = pngBytes(1, 16);
    const child = await admitTransformedAsset({
      parent,
      id: 'asset-rain-window-crop',
      bytes: cropped,
      mimeType: 'image/png',
      transformation: {
        kind: 'crop',
        appliedAt: '2026-08-12T01:00:00.000Z',
        params: { x: 0, y: 0, width: 8, height: 8 }
      }
    });
    expect(child.id).toBe('asset-rain-window-crop');
    expect(child.contentHash).toBe(await contentHashOfBytes(cropped));
    expect(child.contentHash).not.toBe(parent.contentHash);
    expect(child.transformations[0]).toMatchObject({
      kind: 'crop',
      parentId: parent.id,
      parentHash: parent.contentHash
    });
    await expect(admitTransformedAsset({
      parent,
      id: parent.id,
      bytes: cropped,
      transformation: { kind: 'crop', appliedAt: '2026-08-12T01:00:00.000Z' }
    })).rejects.toMatchObject({ code: 'PROJECT_ASSET_OVERWRITE' });
  });

  it('treats interactive use as distinct from public distribution', () => {
    const unknown = validateProjectAsset(assetInput());
    expect(rightsCapabilities(unknown)).toMatchObject({
      interactive: true,
      privateReview: true,
      publicDistribution: false,
      unresolvedForPublication: true
    });
    expect(() => assertDistributionAllowed(unknown, 'public'))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_RIGHTS_UNRESOLVED' }));
    expect(assertDistributionAllowed(unknown, 'private-review').privateReview).toBe(true);

    const verified = validateProjectAsset(assetInput({
      rights: { status: 'verified', distributionAllowed: true, credit: 'User photograph' }
    }));
    expect(rightsCapabilities(verified).publicDistribution).toBe(true);
    expect(inventoryAssetFromProjectAsset(verified)).toMatchObject({
      assetId: IMAGE_ID,
      rights: { status: 'verified', distributionAllowed: true, credit: 'User photograph' }
    });
  });

  it('refuses to delete a scored asset unless the repair no longer names it', () => {
    const scored = imageProgram();
    expect(referencedAssetIdsFromProgram(scored)).toContain(IMAGE_ID);
    expect(() => planAssetDeletion({ assetId: IMAGE_ID, program: scored }))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_REFERENCED' }));
    expect(() => planAssetDeletion({
      assetId: IMAGE_ID,
      program: scored,
      repair: scored
    })).toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_REPAIR_INCOMPLETE' }));

    const planned = planAssetDeletion({
      assetId: IMAGE_ID,
      program: scored,
      repair: stillProgram()
    });
    expect(planned.allowed).toBe(true);
    expect(planned.repair).toBe('program');
    expect(referencedAssetIdsFromProgram(planned.nextProgram)).not.toContain(IMAGE_ID);

    const unused = planAssetDeletion({ assetId: VIDEO_ID, program: scored });
    expect(unused.referenced).toBe(false);
    expect(unused.nextProgram).toEqual(scored);
  });

  it('names a personal swell from the score so audio deletion uses the same gate', () => {
    expect(referencedAssetIdsFromProgram(swellProgram())).toContain(SWELL_ID);
    expect(() => planAssetDeletion({ assetId: SWELL_ID, program: swellProgram() }))
      .toThrow(expect.objectContaining({ name: 'ProjectAssetError', code: 'PROJECT_ASSET_REFERENCED' }));
  });

  it('packs a bounded transfer bundle and verifies local and remote copies the same way', async () => {
    const image = pngBytes(4);
    const swell = new Uint8Array(24).fill(5);
    const manifest = await compileProjectAssetManifest({
      projectId: PROJECT_ID,
      workshopRecords: [{
        id: IMAGE_ID,
        projectId: PROJECT_ID,
        mimeType: 'image/png',
        byteLength: image.byteLength
      }],
      swells: [{
        id: SWELL_ID,
        type: 'audio/mpeg',
        byteLength: swell.byteLength
      }],
      libraryAudioIds: ['soundscape:aurora'],
      bytesById: { [IMAGE_ID]: image, [SWELL_ID]: swell }
    });
    expect(manifest.assets).toHaveLength(3);

    const bundle = await packTransferBundle({
      jobId: 'render-memory-portrait-001',
      projectId: PROJECT_ID,
      assets: manifest.assets,
      bytesById: { [IMAGE_ID]: image, [SWELL_ID]: swell }
    });
    expect(bundle.schema).toBe(ASSET_TRANSFER_BUNDLE_SCHEMA);
    expect(bundle.parts).toHaveLength(2);
    expect(bundle.bytes[IMAGE_ID]).toEqual(image);
    expect(bundle.assets.find(asset => asset.id === 'soundscape:aurora').storage.kind)
      .toBe('library');

    const local = await verifyTransferBundle(bundle);
    const remote = await importTransferBundle({
      schema: bundle.schema,
      jobId: bundle.jobId,
      projectId: bundle.projectId,
      assets: JSON.parse(JSON.stringify(bundle.assets)),
      parts: JSON.parse(JSON.stringify(bundle.parts)),
      bundleHash: bundle.bundleHash,
      bytes: { [IMAGE_ID]: image.slice(), [SWELL_ID]: swell.slice() }
    });
    expect(local.bundleHash).toBe(remote.bundleHash);
    expect(remote.bytes[IMAGE_ID]).toEqual(image);

    const recovered = await recoverAssetFromBundle(bundle, IMAGE_ID);
    expect(recovered.asset.contentHash).toBe(await contentHashOfBytes(image));
    expect(recovered.bytes).toEqual(image);

    const tampered = {
      ...bundle,
      bytes: { [IMAGE_ID]: pngBytes(99), [SWELL_ID]: swell }
    };
    await expect(verifyTransferBundle(tampered))
      .rejects.toMatchObject({ code: 'PROJECT_ASSET_HASH_MISMATCH' });
  });

  it('refuses a transfer that names a URI or omits scored bytes', async () => {
    const bytes = pngBytes();
    const asset = await projectWorkshopMedia({
      record: {
        id: IMAGE_ID,
        projectId: PROJECT_ID,
        mimeType: 'image/png',
        byteLength: bytes.byteLength
      },
      bytes
    });
    await expect(packTransferBundle({
      projectId: PROJECT_ID,
      assets: [asset],
      bytesById: {}
    })).rejects.toMatchObject({ code: 'PROJECT_ASSET_TRANSFER_BYTES' });

    expect(() => validateProjectAsset(assetInput({
      storage: { kind: 'workshop-idb', recordId: 'blob:https://rise.local/1' }
    }))).toThrow(ProjectAssetError);
  });
});
