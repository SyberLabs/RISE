import { afterEach, describe, expect, it, vi } from 'vitest';
import { READING_LIMITS } from './reading-limits.js';
import { SESSION_LIMITS, compileSession } from './session-compiler.js';
import {
  WORKSHOP_PROJECT_LIMITS,
  validateWorkshopProject,
  workshopEditorDataToProject
} from './workshop-project.js';
import {
  SEQUENCE_ASSET_STORAGE_IDB,
  createSequenceVisualAsset,
  sequenceAssetForPersistence
} from './visual-score-lane.js';
import {
  WorkshopMedia,
  dataImageUriToBlob
} from './workshop-media.js';
import {
  ensureWorkshopAssetsDurable,
  hydrateWorkshopAssets
} from './workshop-asset-durability.js';
import { MemoryCore } from './memory.js';
import { safeUrl } from './sanitize.js';

// Shaped like a real object URL — `blob:<origin>/<uuid>` — because safeUrl
// now checks the origin, and a fixture the platform would never mint tests
// nothing about the rule it is standing in for.
const OBJECT_URL_MOON = `blob:${location.origin}/8f2c1e40-moon`;

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function editorWithSource(text, assets = []) {
  return {
    id: 'project-limits',
    title: 'Limits',
    intent: 'custom',
    sources: [{
      id: 'source-1',
      name: 'Source',
      providerId: 'local',
      type: 'text/plain',
      data: text
    }],
    wpm: 200,
    paceV2: true,
    chunkMode: 'word',
    curve: 'flat',
    displayMode: 'focal',
    soundscape: 'none',
    audioPreset: 'silent',
    visualConfig: { visualMode: 'off' },
    sequenceVisualAssets: assets,
    visualScoreAssignments: [],
    audioScoreAssignments: []
  };
}

describe('P0-A shared reading limits', () => {
  it('keeps Workshop and Session on one character authority', () => {
    expect(WORKSHOP_PROJECT_LIMITS.maxSourceCharacters).toBe(READING_LIMITS.maxTextCharacters);
    expect(WORKSHOP_PROJECT_LIMITS.maxTotalCharacters).toBe(READING_LIMITS.maxTotalChars);
    expect(SESSION_LIMITS.maxTextCharacters).toBe(READING_LIMITS.maxTextCharacters);
    expect(SESSION_LIMITS.maxTotalChars).toBe(READING_LIMITS.maxTotalChars);
    expect(WORKSHOP_PROJECT_LIMITS.maxSourceCharacters).toBe(SESSION_LIMITS.maxTextCharacters);
  });

  it('refuses a single source above the shared character ceiling at Workshop validate', () => {
    const text = 'a'.repeat(READING_LIMITS.maxTextCharacters + 1);
    expect(() => workshopEditorDataToProject(editorWithSource(text), { id: 'over' }))
      .toThrow(expect.objectContaining({ code: 'WORKSHOP_PROJECT_SOURCE_TEXT' }));
  });

  it('refuses combined sources above the shared total ceiling at Workshop validate', () => {
    const half = 'a'.repeat(READING_LIMITS.maxTotalChars / 2 + 1);
    const editor = editorWithSource(half);
    editor.sources.push({
      id: 'source-2',
      name: 'Source 2',
      providerId: 'local',
      type: 'text/plain',
      data: half
    });
    expect(() => workshopEditorDataToProject(editor, { id: 'over-total' }))
      .toThrow(expect.objectContaining({ code: 'WORKSHOP_PROJECT_TOTAL_TEXT' }));
  });

  it('compiles every project that validates at the shared ceiling', () => {
    const text = 'word '.repeat(20).trim();
    const project = workshopEditorDataToProject(editorWithSource(text, [{
      id: 'moon',
      uri: TINY_PNG,
      name: 'Moon',
      color: '#7fd4a4'
    }]), { id: 'ok' });

    expect(() => compileSession({
      title: project.title,
      sources: project.sources,
      sequenceVisualAssets: project.assets,
      experienceProgram: project.experienceProgram,
      wpm: project.defaults.reading.wpm,
      chunkMode: project.defaults.reading.chunkMode,
      curve: project.defaults.reading.curve,
      visualConfig: project.defaults.visual.config,
      soundscape: project.defaults.audio.soundscape,
      audioPreset: project.defaults.audio.audioPreset
    })).not.toThrow();
  });
});

describe('P0-A durable Workshop media contracts', () => {
  afterEach(() => {
    localStorage.clear();
    MemoryCore._hydratedWorkshopViews = null;
    vi.restoreAllMocks();
  });

  it('creates idb metadata without embedding a URI', () => {
    const asset = createSequenceVisualAsset({
      id: 'asset-1',
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: 'image/png',
      byteLength: 32,
      name: 'Field',
      color: '#7fd4a4'
    });
    const persisted = sequenceAssetForPersistence(asset);
    expect(persisted.storage).toBe(SEQUENCE_ASSET_STORAGE_IDB);
    expect(persisted).not.toHaveProperty('uri');
    expect(persisted.mimeType).toBe('image/png');
  });

  it('refuses oversized inline assets at the project boundary', () => {
    const huge = `data:image/png;base64,${'A'.repeat(70 * 1024)}`;
    expect(() => validateWorkshopProject({
      schema: 'rise.workshop-project.v1',
      id: 'huge',
      title: 'Huge',
      intent: 'custom',
      sources: [{
        id: 'source-1', name: 'S', providerId: 'local', type: 'text/plain',
        data: 'Still water.', words: 2
      }],
      assets: [{ id: 'big', uri: huge, name: 'Big' }],
      experienceProgram: null,
      defaults: {
        reading: { wpm: 200, chunkMode: 'word', curve: 'flat', displayMode: 'focal' },
        visual: { surface: 'off', config: { visualMode: 'off' } },
        audio: { soundscape: 'none', audioPreset: 'silent', selectedSwellId: null },
        projection: 'stream',
        recitation: { enabled: false },
        voiceId: null
      },
      provenance: {},
      paceV2: true,
      updatedAt: 1
    })).toThrow(expect.objectContaining({ code: 'WORKSHOP_PROJECT_INLINE_TOO_LARGE' }));
  });

  it('decodes data:image URIs into Blobs for durable put', () => {
    const blob = dataImageUriToBlob(TINY_PNG);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('ensureWorkshopAssetsDurable puts pending blobs and returns meta-only assets', async () => {
    const blob = dataImageUriToBlob(TINY_PNG);
    const put = vi.spyOn(WorkshopMedia, 'put').mockResolvedValue({
      id: 'asset-moon',
      projectId: 'proj-1',
      mimeType: 'image/png',
      byteLength: blob.size
    });
    vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(true);

    const durable = await ensureWorkshopAssetsDurable('proj-1', [{
      id: 'asset-moon',
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: 'image/png',
      byteLength: blob.size,
      name: 'Moon',
      color: '#7fd4a4'
    }], new Map([['asset-moon', blob]]));

    expect(put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'asset-moon',
      projectId: 'proj-1',
      data: blob
    }));
    expect(durable[0].storage).toBe(SEQUENCE_ASSET_STORAGE_IDB);
    expect(durable[0]).not.toHaveProperty('uri');
  });

  it('hydrateWorkshopAssets resolves object URLs for idb metadata', async () => {
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockResolvedValue(OBJECT_URL_MOON);
    const hydrated = await hydrateWorkshopAssets([{
      id: 'asset-moon',
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: 'image/png',
      byteLength: 12,
      name: 'Moon',
      color: '#7fd4a4'
    }]);
    expect(hydrated[0].uri).toBe(OBJECT_URL_MOON);
    expect(safeUrl(hydrated[0].uri)).toBe(OBJECT_URL_MOON);
  });

  it('saveWorkshopBlueprintAsync writes metadata-only JSON via durable ensure', async () => {
    const blob = dataImageUriToBlob(TINY_PNG);
    vi.spyOn(WorkshopMedia, 'put').mockResolvedValue({
      id: 'asset-moon',
      projectId: 'proj-async',
      mimeType: 'image/png',
      byteLength: blob.size
    });
    vi.spyOn(WorkshopMedia, 'has').mockResolvedValue(true);
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockResolvedValue(OBJECT_URL_MOON);
    vi.spyOn(WorkshopMedia, 'delete').mockResolvedValue(undefined);

    const saved = await MemoryCore.saveWorkshopBlueprintAsync(
      editorWithSource('Still water reflects the moon.', [{
        id: 'asset-moon',
        storage: SEQUENCE_ASSET_STORAGE_IDB,
        mimeType: 'image/png',
        byteLength: blob.size,
        name: 'Moon',
        color: '#7fd4a4'
      }]),
      { blobs: new Map([['asset-moon', blob]]) }
    );

    expect(saved.sequenceVisualAssets[0].uri).toBe(OBJECT_URL_MOON);
    const raw = JSON.parse(localStorage.getItem('rise_workshop_v1'));
    expect(raw[0].assets[0].storage).toBe(SEQUENCE_ASSET_STORAGE_IDB);
    expect(raw[0].assets[0]).not.toHaveProperty('uri');
    expect(JSON.stringify(raw[0].assets[0]).length).toBeLessThan(blob.size + 200);
  });
});
