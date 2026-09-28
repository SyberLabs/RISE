/**
 * The Scene Stack's commands, as the Workshop performs them.
 *
 * Every mutation goes through workshop-scenes.js and lands in the Workshop's
 * one draft through the same commit paths the studio uses (score history,
 * dirty state, the Vault picker), so a scene made on the phone is a scene the
 * studio can open, undo and save. Refusals come back as `{ ok: false,
 * message }` for the view to show where the author is looking.
 */
import {
  cueForPick,
  editorAssetIdToLeaf,
  leafToEditorAssetId,
  moveScene,
  rewriteWrittenScene,
  scenesFromSession,
  sessionForScene,
  setSceneSound,
  setSceneVisual,
  writtenSource
} from '../../core/workshop-scenes.js';
import { taxonomyLeaves } from '../../core/visual-taxonomy.js';
import { poolOptions } from '../../core/visual-taxonomy-config.js';
import { localWorkParts } from '../../core/local-works.js';
import { visualFallbackCueFromConfig } from '../../core/visual-program.js';
import { Admit } from '../Admit.js';

const ok = () => ({ ok: true });
const refused = error => ({ ok: false, message: error?.message || 'That could not be done.' });

function attempt(fn) {
  try {
    fn();
    return ok();
  } catch (error) {
    return refused(error);
  }
}

export function createSceneApi(ws) {
  const sourceIndex = id => ws.sessionData.sources.findIndex(source => String(source.id) === String(id));
  const visualName = id => ws.scoreAsset(id)?.name || null;
  const audioName = id => ws.audioScoreAssets().find(asset => asset.id === id)?.name || null;
  const bedAssets = () => ws.audioScoreAssets().filter(asset => asset.lane === 'audio');
  const newId = prefix => `${prefix}-${crypto.randomUUID()}`;

  const afterChange = () => {
    ws.markEditorDirty();
    ws.updateSourcesList();
    ws.updateCreateButton();
    ws.refreshVisualScoreView();
    ws.updateSequencePicker();
    ws.sceneStack?.refresh();
  };

  const commitVisual = (sourceId, assetId, cue) => {
    const next = setSceneVisual(ws.sessionData, sourceId, { assetId, cue, id: newId('visual') });
    ws.commitVisualScoreCommand('assign', next.visualScoreAssignments, null);
    ws.sessionData.audioScoreAssignments = [...next.audioScoreAssignments];
    ws.activateScoredVisualSurface();
  };

  const commitSound = (sourceId, assetId) => {
    const next = setSceneSound(ws.sessionData, sourceId,
      assetId ? { assetId, assets: bedAssets(), id: newId('audio') } : null);
    ws.commitAudioScoreCommand(assetId ? 'assign' : 'erase', next.audioScoreAssignments, null);
  };

  const addWritten = (text, name = '') => {
    const previous = scenesFromSession(ws.sessionData).at(-1) || null;
    const source = writtenSource(text, { id: newId('written'), name });
    ws.addSource({ ...source }, { id: 'local', name: 'Written here' });
    // A new scene continues the last one until the author says otherwise.
    if (previous?.visual?.whole) commitVisual(source.id, previous.visual.assetId, previous.visual.cue || null);
    if (previous?.sound?.whole) commitSound(source.id, previous.sound.assetId);
  };

  return {
    scenes: () => scenesFromSession(ws.sessionData, { visualName, audioName }).map(scene => (
      scene.visual
        ? { ...scene, visual: { ...scene.visual, leafId: editorAssetIdToLeaf(scene.visual.assetId)?.leafId || null } }
        : scene)),
    sceneText: id => ws.sessionData.sources[sourceIndex(id)]?.data || '',
    title: () => ws.sessionData.title || '',
    sequence: () => {
      const data = ws.sessionData;
      return {
        visual: visualFallbackCueFromConfig(data.visualConfig).kind !== 'still',
        sound: (data.soundscape && data.soundscape !== 'none')
          || (data.audioPreset && data.audioPreset !== 'silent')
      };
    },
    dirty: () => ws.isCurrentDraftDirty(),
    pace: () => ({ wpm: ws.sessionData.wpm, chunkMode: ws.sessionData.chunkMode }),
    sequences: () => (ws.savedBlueprints || [])
      .filter(item => item.id !== ws.activeBlueprintId)
      .map(item => ({ id: item.id, title: item.title || 'Untitled sequence' })),
    soundOptions: () => bedAssets().map(asset => ({ id: asset.id, name: asset.name, detail: asset.description || '' })),
    visualConfig: () => ws.sessionData.visualConfig,
    pickableLeaves: () => {
      const registry = new Set(ws.visualAssetEntries().map(entry => entry.asset.id));
      return new Set(taxonomyLeaves().filter(leaf => {
        const pool = leaf.id === 'personal' ? 'global-pool' : poolOptions(leaf.id)[0]?.id || null;
        return registry.has(leafToEditorAssetId(leaf.id, pool));
      }).map(leaf => leaf.id));
    },

    addWritten: text => attempt(() => {
      addWritten(text);
      afterChange();
    }),
    divideAndAdd: text => new Admit({
      text,
      sourceName: 'Written here',
      directLabel: 'Make these scenes',
      onReadNow: (_text, _title, record) => {
        const parts = record ? localWorkParts(record) : [{ content: _text, label: '' }];
        const result = attempt(() => {
          for (const part of parts) if (part.content.trim()) addWritten(part.content, part.label || '');
        });
        afterChange();
        if (!result.ok) ws.showToast(result.message);
      },
      onAdmit: async record => ws.openAdmitRecord(record)
    }),
    openLibrary: () => ws.openSourceBrowser(),
    importFile: () => ws.container.querySelector('#file-import-input')?.click(),

    editScene: (id, text) => attempt(() => {
      const next = rewriteWrittenScene(ws.sessionData, id, text, { audioAssets: ws.audioScoreAssets() });
      ws.sessionData.sources = next.sources;
      ws.sessionData.visualScoreAssignments = [...next.visualScoreAssignments];
      ws.sessionData.audioScoreAssignments = [...next.audioScoreAssignments];
      afterChange();
    }),
    removeScene: id => {
      const index = sourceIndex(id);
      if (index >= 0) ws.removeSource(index);
    },
    moveScene: (from, to) => {
      const next = moveScene(ws.sessionData.sources, from, to);
      if (next === ws.sessionData.sources) return;
      ws.sessionData.sources = next;
      afterChange();
    },
    setSceneVisual: (id, pick) => attempt(() => {
      const pool = pick.leafId === 'personal' ? 'global-pool' : pick.pool;
      const editorId = leafToEditorAssetId(pick.leafId, pool);
      const entry = ws.visualAssetEntries().find(item => item.asset.id === editorId && !item.materialization);
      if (!entry) throw new Error('That visual cannot be given to a scene here. The full studio has every visual a scene can hold.');
      commitVisual(id, ws.scoreAssetReference(entry), cueForPick(pick.leafId, pick.style, entry.asset.cueTemplate));
      afterChange();
    }),
    setSceneSound: (id, assetId) => attempt(() => {
      commitSound(id, assetId || null);
      afterChange();
    }),
    setPace: ({ wpm, chunkMode } = {}) => {
      if (Number.isFinite(wpm)) ws.sessionData.wpm = wpm;
      if (chunkMode === 'word' || chunkMode === 'phrase') ws.sessionData.chunkMode = chunkMode;
      ws.markEditorDirty();
      ws.refreshReadingStudio();
    },
    rename: title => {
      ws.sessionData.title = String(title || '').slice(0, 120);
      ws.markEditorDirty();
      ws.updateSequencePicker();
    },

    openSequence: id => ws.openSavedBlueprint(id),
    save: () => ws.saveSequenceToVault(),
    exportJson: () => ws.exportExperienceProgramFile(),
    importJson: () => ws.showProgramImportChooser(),
    playScene: id => ws.previewSession(sessionForScene(ws.sessionData, id)),
    playAll: () => ws.previewSession(ws.sessionData),
    reset: () => ws.startNewSequence({ preserveCurrent: false, notify: true }),
    openStudio: () => ws.setPhoneMode('studio'),
    back: () => ws.leaveForPortal()
  };
}
