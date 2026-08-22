/**
 * Workshop Component
 * Session building interface
 *
 * Design principles:
 * - Progressive disclosure
 * - Most "app-like" space but still maintains design principles
 * - Generous spacing, no cluttered toolbars
 */

import { SourceBrowser } from './SourceBrowser.js';
import { MemoryCore } from '../core/memory.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { namingModal } from './NamingModal.js';
import { safeUrl } from '../core/sanitize.js';
import { requestVisualInterlocutionConsent } from '../core/visual-safety.js';
import { snapCharacterRangeToTokens } from '../core/source-span.js';
import {
  formatGalleryCadence,
  GALLERY_CADENCE_DEFAULT,
  galleryCadenceValueText,
  isContinuousPresentation,
  normalizeGalleryCadence,
  VISUAL_PRESENCE_DEFAULT_MS
} from '../core/visual-presence.js';
import {
  assignVisualSpan,
  createSequenceVisualAsset,
  eraseVisualSpan,
  SEQUENCE_ASSET_STORAGE_IDB,
  VISUAL_SCORE_COLORS,
  VisualScoreLaneError
} from '../core/visual-score-lane.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import {
  dataImageUriToBlob,
  WorkshopMedia
} from '../core/workshop-media.js';
import { editorAssetSupports } from '../core/editor-asset.js';
import {
  createVisualScoreHistory,
  recordVisualScoreCommand,
  redoVisualScoreCommand,
  undoVisualScoreCommand,
  visualScoreHistoryStatus
} from '../core/visual-score-history.js';
import {
  applyWorkshopAudioAsset,
  audioScoreAssetFromId,
  applyPersonalAudioAsWholeReading,
  personalAudioEditorAsset,
  personalAudioIsWholeReading,
  personalBedSoundscapeId,
  PERSONAL_BED_PREFIX,
  WORKSHOP_AUDIO_ASSETS,
  WorkshopAudioPreviewController,
  workshopAudioAsset,
  workshopAudioEditorAsset,
  workshopAudioAssetIsCurrent
} from '../core/workshop-audio.js';
import {
  assignAudioSpan,
  AUDIO_SCORE_COLORS,
  AudioScoreLaneError,
  compileWorkshopScoreProgram,
  eraseAudioSpan
} from '../core/audio-score-lane.js';
import { renderWorkshopStudioShell } from './workshop/WorkshopStudioShell.js';
import { renderCombinedPassageAssignment } from './workshop/PassageAssignmentCard.js';
import { buildSequenceMapGroups } from './workshop/sequence-map.js';
import {
  inspectorContextLabel,
  normalizeInspectorContext
} from './workshop/workshop-ui-state.js';
import {
  applyEditorAssetDefault,
  buildWorkshopVisualAssetRegistry,
  projectAssetIdFromEditorAsset
} from './workshop/workshop-visual-assets.js';
import {
  ATTRACTOR_FORMS,
  ATTRACTOR_PALETTES,
  ATTRACTOR_SYSTEMS,
  FOCAL_GLYPHS,
  HARMONOGRAPH_CLIMATES,
  KLEE_PRESETS,
  OSTENSORIA_PALETTES,
  APPARITIO_PALETTES,
  normalizeConfigurableVisualCue,
  normalizeFieldStyle,
  normalizeProceduralStyle,
  personalFocalAssetIdFromCue,
  ROSE_MODES,
  visualCueIsConfigurable,
  visualCueStyleSummary
} from '../core/visual-style-definitions.js';
import {
  exportCuratorContext
} from '../core/curator-context.js';
import {
  describeImportFailure,
  downloadJsonFile,
  parseExperienceProgramJson,
  serializeExperienceProgram,
  unloadableLibrarySourcesError,
  workshopProjectFromImportedProgram
} from '../core/experience-program-io.js';
import {
  workshopProjectToBlueprintView
} from '../core/workshop-project.js';
import { resolveProgramLibrarySources } from '../core/scriptorium-resolve.js';
import {
  EXPORT_MP4_PATH,
  kernelRequestFromWorkshopPayload,
  renderCliCommand
} from '../core/render/kernel-request.js';
import { visualFallbackCueFromConfig } from '../core/visual-program.js';
import { assertQuotationAnchorsAgainstSources } from '../core/source-span.js';
import './SourceBrowser.css';
import { REMOTE_IMAGE_ATTRS } from '../visuals/remote-image.js';

const MAX_TEXT_FILE_BYTES = READING_LIMITS.maxTextCharacters;
const MAX_IMAGE_FILE_BYTES = READING_LIMITS.maxImageFileBytes;
const MAX_VIDEO_FILE_BYTES = READING_LIMITS.maxVideoFileBytes;
const MAX_CUSTOM_VISUALS = READING_LIMITS.maxSequenceAssets;
const MAX_RENDERED_LANE_CLIPS = 160;

function studioViewportForWidth(width) {
  if (width < 768) return 'phone';
  if (width < 1180) return 'tablet';
  return 'desktop';
}

function validStudioSurface(surface) {
  return ['score', 'sources', 'assets', 'inspector'].includes(surface) ? surface : 'score';
}

function projectEditorAssetId(asset) {
  return `${asset?.kind === 'video' ? 'project-video' : 'project-image'}:${asset?.id}`;
}

/** Read MP4 metadata without beginning playback or retaining an object URL. */
function probeVideoDurationMs(blob) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(blob);
    let settled = false;
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeAttribute('src');
      try { video.load(); } catch { /* detached */ }
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(value);
    };
    const timeout = setTimeout(() => finish(null, new Error('Video metadata timed out')), 10000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const durationMs = Math.round(Number(video.duration) * 1000);
      if (!Number.isInteger(durationMs) || durationMs <= 0) {
        finish(null, new Error('Video duration is unavailable'));
      } else finish(durationMs);
    };
    video.onerror = () => finish(null, new Error('Video metadata could not be decoded'));
    video.src = url;
  });
}

function createDefaultSessionData() {
  return {
    experienceProgramId: `workshop-${crypto.randomUUID()}`,
    title: '',
    intent: 'custom',
    sources: [],
    wpm: 200,
    curve: 'flat',
    chunkMode: 'word',
    displayMode: 'focal',
    audioPreset: 'silent',
    soundscape: 'none',
    selectedSwellId: null,
    visualConfig: {
      visualMode: 'off',
      focals: {
        type: 'standard',
        standardGlyph: 'breath',
        personalImage: null
      },
      attractor: {
        system: 'aizawa'
      },
      genesis: {
        preset: 'random',
        glass: true
      },
      livingText: {
        enabled: false
      },
      interlocution: {
        sourceFamily: 'procedural',
        procedural: [],
        sourced: [],
        globalPool: {
          mode: 'all',
          assetIds: []
        },
        frequency: 0.3,
        duration: VISUAL_PRESENCE_DEFAULT_MS,
        galleryCadence: GALLERY_CADENCE_DEFAULT,
        presentation: 'continuous',
        renderLanguage: 'native',
        kleePreset: 'random',
        harmonographClimate: 'auto',
        responsive: false,
        responsiveMood: true,
        responsiveRhythm: true
      }
    },
    customVisuals: [],
    sequenceVisualAssets: [],
    visualScoreAssignments: [],
    audioScoreAssignments: []
  };
}

function cloneSessionData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeSessionData(data = {}) {
  const defaults = createDefaultSessionData();
  const incoming = cloneSessionData(data);
  const visualConfig = incoming.visualConfig || {};

  const legacyVisuals = Array.isArray(incoming.customVisuals) ? incoming.customVisuals : [];
  const restoredAssets = Array.isArray(incoming.sequenceVisualAssets)
    ? incoming.sequenceVisualAssets
    : legacyVisuals.map((uri, index) => ({
      id: `legacy-asset-${index + 1}`,
      uri,
      name: `Sequence image ${index + 1}`,
      color: VISUAL_SCORE_COLORS[index % VISUAL_SCORE_COLORS.length]
    }));
  const sequenceVisualAssets = restoredAssets
    .slice(0, MAX_CUSTOM_VISUALS)
    .map((asset, index) => {
      try {
        return createSequenceVisualAsset({
          ...asset,
          color: asset?.color || VISUAL_SCORE_COLORS[index % VISUAL_SCORE_COLORS.length]
        });
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  // MIGRATION: `audioPreset` used to double as a swell flag.
  //
  // Setting a personal recording as the default wrote `audioPreset:'personal'`,
  // which is not a tone the engine knows — so the bed reported Silence, the
  // engine warned about an unknown preset, and choosing a tone afterwards
  // silently discarded the recording. A personal file placed under the whole
  // reading is a BASE layer now, so the old pair is rewritten as one.
  if (incoming.audioPreset === 'personal') {
    incoming.soundscape = incoming.selectedSwellId
      ? personalBedSoundscapeId(incoming.selectedSwellId)
      : (incoming.soundscape && incoming.soundscape !== 'none' ? incoming.soundscape : 'none');
    incoming.audioPreset = 'silent';
    incoming.selectedSwellId = null;
  }

  const focals = { ...defaults.visualConfig.focals, ...(visualConfig.focals || {}) };
  if (typeof focals.personalAssetId === 'string') {
    const personalAsset = sequenceVisualAssets.find(asset =>
      asset.id === focals.personalAssetId && asset.kind !== 'video' && asset.uri);
    if (personalAsset) {
      focals.type = 'personal';
      focals.personalImage = personalAsset.uri;
    }
  }

  return {
    ...defaults,
    ...incoming,
    sources: Array.isArray(incoming.sources) ? incoming.sources : [],
    experienceProgramId: typeof incoming.experienceProgramId === 'string'
      ? incoming.experienceProgramId
      : defaults.experienceProgramId,
    customVisuals: sequenceVisualAssets
      .filter(asset => asset.kind !== 'video')
      .map(asset => asset.uri)
      .filter(uri => typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:'))),
    sequenceVisualAssets,
    visualScoreAssignments: Array.isArray(incoming.visualScoreAssignments)
      ? incoming.visualScoreAssignments.slice(0, 512)
      : [],
    audioScoreAssignments: Array.isArray(incoming.audioScoreAssignments)
      ? incoming.audioScoreAssignments.slice(0, 1024)
      : [],
    visualConfig: {
      ...defaults.visualConfig,
      ...visualConfig,
      focals,
      attractor: { ...defaults.visualConfig.attractor, ...(visualConfig.attractor || {}) },
      genesis: { ...defaults.visualConfig.genesis, ...(visualConfig.genesis || {}) },
      livingText: { ...defaults.visualConfig.livingText, ...(visualConfig.livingText || {}) },
      interlocution: {
        ...defaults.visualConfig.interlocution,
        ...(visualConfig.interlocution || {})
      }
    }
  };
}

export class Workshop {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onCreateSession = options.onCreateSession || (() => { });
    this.visualConsentScope = crypto.randomUUID();

    this.sessionData = createDefaultSessionData();
    this.activeBlueprintId = null;
    this.activeDraftKind = 'new';
    this.editorDirty = false;
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();
    /** @type {Map<string, Blob>} */
    this.pendingMediaBlobs = new Map();
    /** @type {Set<string>} */
    this.localObjectUrls = new Set();
    // Unsaved drafts are intentionally memory-only. They survive navigation
    // within this app instance, but are never written to browser storage.
    this.suspendedDrafts = [];
    this.resetArmed = false;
    this.resetTimer = null;
    this.assetRemovalArmedId = null;
    this.assetRemovalTimer = null;
    this.sourceRemovalArmedId = null;
    this.sourceRemovalTimer = null;
    this.announcementTimer = null;

    this.sourceBrowser = null;
    this.sourcePreviewModal = null;
    this.sourcePreviewEscapeHandler = null;

    // Store bound keyboard handler for proper cleanup
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);
    this._active = false;

    // Track drag state
    this.isDragging = false;
    this.activeScoreSourceId = null;
    this.selectedScoreAssetId = null;
    this.selectedEditorAssetId = null;
    this.visualAssetGroup = 'all';
    this.visualAssetSearch = '';
    this.visualAssetStyleDrafts = new Map();
    this.personalFocalChooser = null;
    this.pendingPersonalFocalUploadTarget = null;
    this.selectedScoreAssignmentId = null;
    this.selectedAudioAssignmentId = null;
    this.inspectorContext = normalizeInspectorContext({ kind: 'project' });
    this.workshopIssue = null;
    this.lastScoreMutationLane = 'visual';
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.scoredActivationUndo = null;
    this.visualSelectionCaptureTimer = null;
    this.visualSelectionPointerDown = false;
    this.restoringVisualSelection = false;
    this.visualScoreHistory = createVisualScoreHistory();
    this.audioScoreHistory = createVisualScoreHistory();
    this.pendingAgentProposal = null;
    this.scoreView = 'visual';
    this.personalSwells = [];
    this.collectionPreviewCache = new Map();
    this.collectionPreviewAbortController = new AbortController();
    this.collectionPreviewResolver = options.resolveCollectionPreview
      || this.resolveCollectionPreview.bind(this);
    this.museumPreviewProvider = null;
    this.activeAssetLane = 'visual';
    this.studioViewport = studioViewportForWidth(options.viewportWidth ?? window.innerWidth ?? 1280);
    this.studioSurface = 'score';
    this.responsiveFocusOrigin = null;
    this.fileDialogReturnFocus = null;
    this.boundSelectionChangeHandler = () => {
      if (!this.visualSelectionPointerDown) this.scheduleVisualScoreSelectionCapture(40);
    };
    this.boundResizeHandler = () => {
      this.syncStudioViewport();
      this.positionScoreSelectionPopover();
    };
    this.selectedAudioAssetId = this.currentAudioAssetId();
    this.audioPreviewState = { state: 'idle', assetId: null };
    this.audioPreview = new WorkshopAudioPreviewController({
      engineProvider: options.audioEngineProvider || (() => window.rise?.audioEngine || null),
      durationMs: options.audioPreviewDurationMs || 12000,
      onChange: status => {
        this.audioPreviewState = status;
        if (this.container.isConnected) this.refreshAudioStudio();
      }
    });

    this.render();
    this.attachEvents();
  }

  update(data) {
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();
    if (!data) {
      this.updateSequencePicker();
      return;
    }

    if (data.blueprintId) {
      this.openSavedBlueprint(data.blueprintId);
      return;
    }

    if (data.text) {
      const suspended = this.suspendCurrentDraft();
      const blank = createDefaultSessionData();
      this.replaceEditorData(blank, {
        kind: 'recursion'
      });
      this.addSource({
        id: `synthesis-${Date.now()}`,
        name: 'Chamber Synthesis',
        type: 'text/plain',
        data: data.text,
        metadata: {
           source: 'chamber-recursion'
        }
      }, { id: 'recursion', name: 'Recursion Memory' });
      this.updateSequencePicker();
      if (suspended) {
        this.showToast('Your unfinished Workshop draft is available above');
      }
    }
  }

  isCurrentDraftDirty() {
    return this.editorDirty;
  }

  markEditorDirty() {
    this.editorDirty = true;
  }

  getDraftLabel(data = this.sessionData) {
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (title) return title;
    const firstSource = Array.isArray(data.sources) ? data.sources[0]?.name : '';
    return firstSource || 'Untitled sequence';
  }

  suspendCurrentDraft() {
    if (!this.isCurrentDraftDirty()) return false;

    this.suspendedDrafts.unshift({
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: this.getDraftLabel(),
      data: cloneSessionData(this.sessionData),
      kind: this.activeDraftKind,
      blueprintId: this.activeBlueprintId,
      dirty: true
    });
    return true;
  }

  replaceEditorData(data, options = {}) {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.resetArmed = false;
    if (this.assetRemovalTimer) clearTimeout(this.assetRemovalTimer);
    this.assetRemovalTimer = null;
    this.assetRemovalArmedId = null;
    if (this.sourceRemovalTimer) clearTimeout(this.sourceRemovalTimer);
    this.sourceRemovalTimer = null;
    this.sourceRemovalArmedId = null;
    this.sourceBrowser?.destroy?.();
    this.sourceBrowser = null;
    this.visualConsentScope = crypto.randomUUID();

    this.sessionData = normalizeSessionData(data);
    delete this.sessionData.updatedAt;
    this.activeBlueprintId = options.blueprintId || null;
    this.activeDraftKind = options.kind || (this.activeBlueprintId ? 'saved' : 'new');
    this.editorDirty = options.dirty === true;
    this.activeScoreSourceId = this.sessionData.sources[0]?.id || null;
    this.selectedScoreAssetId = this.sessionData.sequenceVisualAssets[0]?.id
      || this.sessionData.visualScoreAssignments[0]?.assetId
      || null;
    this.selectedEditorAssetId = this.selectedScoreAssetId
      ? this.editorAssetIdForScoreAsset(this.selectedScoreAssetId)
      : null;
    this.visualAssetGroup = 'all';
    this.visualAssetSearch = '';
    this.visualAssetStyleDrafts = new Map();
    this.personalFocalChooser = null;
    this.pendingPersonalFocalUploadTarget = null;
    this.selectedScoreAssignmentId = null;
    this.selectedAudioAssignmentId = null;
    this.inspectorContext = normalizeInspectorContext({ kind: 'project' });
    this.workshopIssue = null;
    this.lastScoreMutationLane = 'visual';
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.scoredActivationUndo = null;
    this.visualScoreHistory = createVisualScoreHistory();
    this.audioScoreHistory = createVisualScoreHistory();
    this.pendingAgentProposal = null;
    this.scoreView = 'visual';
    this.audioPreview?.stop();
    this.activeAssetLane = 'visual';
    this.studioSurface = 'score';
    this.responsiveFocusOrigin = null;
    this.selectedAudioAssetId = this.currentAudioAssetId();

    this.render();
    this.attachEvents();
  }

  startNewSequence({ preserveCurrent = true, notify = false } = {}) {
    if (preserveCurrent) this.suspendCurrentDraft();
    const blank = createDefaultSessionData();
    this.replaceEditorData(blank, {
      kind: 'new'
    });
    if (notify) this.showToast('Workshop reset');
  }

  openSavedBlueprint(blueprintId, { preserveCurrent = true } = {}) {
    void this.openSavedBlueprintAsync(blueprintId, { preserveCurrent });
    return true;
  }

  async openSavedBlueprintAsync(blueprintId, { preserveCurrent = true } = {}) {
    this.savedBlueprints = await MemoryCore.getWorkshopBlueprintsHydrated();
    const blueprint = this.savedBlueprints.find(item => item.id === blueprintId);
    if (!blueprint) {
      this.showToast('That sequence is no longer in the Vault');
      this.updateSequencePicker();
      return false;
    }

    if (preserveCurrent) this.suspendCurrentDraft();
    this.revokeLocalMediaUrls();
    this.pendingMediaBlobs.clear();
    const editable = normalizeSessionData(blueprint);
    // `schema` AND `id` LEAVE TOGETHER. A blueprint view carries
    // `schema: rise.workshop-project.v1`, and dropping only the id leaves
    // a payload that answers isWorkshopProject() and cannot pass
    // validateWorkshopProject — which is what handleCreateSession calls
    // when it sees the schema. An editor draft is a session config, not a
    // project.
    delete editable.schema;
    delete editable.project;
    delete editable.id;
    delete editable.updatedAt;
    this.replaceEditorData(editable, {
      blueprintId,
      kind: 'saved'
    });
    return true;
  }

  restoreSuspendedDraft(draftId) {
    const index = this.suspendedDrafts.findIndex(draft => draft.id === draftId);
    if (index < 0) return false;

    const [draft] = this.suspendedDrafts.splice(index, 1);
    this.suspendCurrentDraft();
    this.replaceEditorData(draft.data, {
      blueprintId: draft.blueprintId,
      kind: draft.kind,
      dirty: draft.dirty
    });
    return true;
  }

  renderSequenceOptions() {
    const blueprints = this.savedBlueprints;
    const isBlank = !this.activeBlueprintId && !this.isCurrentDraftDirty();
    const currentLabel = this.getDraftLabel();
    const options = [
      `<option value="new" ${isBlank ? 'selected' : ''}>+ New sequence</option>`
    ];

    if (!this.activeBlueprintId && !isBlank) {
      options.push(`<option value="current" selected>Current draft — ${this.escapeHtml(currentLabel)}</option>`);
    }

    if (this.suspendedDrafts.length > 0) {
      options.push('<optgroup label="Unsaved in this app">');
      this.suspendedDrafts.forEach(draft => {
        options.push(`<option value="draft:${this.escapeHtml(draft.id)}">Unsaved — ${this.escapeHtml(draft.label)}</option>`);
      });
      options.push('</optgroup>');
    }

    if (blueprints.length > 0) {
      options.push('<optgroup label="Saved to Vault">');
      blueprints.forEach(blueprint => {
        const selected = blueprint.id === this.activeBlueprintId ? 'selected' : '';
        options.push(`<option value="saved:${this.escapeHtml(blueprint.id)}" ${selected}>${this.escapeHtml(this.getDraftLabel(blueprint))}</option>`);
      });
      options.push('</optgroup>');
    }

    return options.join('');
  }

  getEditorStatus() {
    if (this.activeBlueprintId) {
      return this.isCurrentDraftDirty()
        ? 'Editing a saved sequence · changes remain private until saved'
        : 'Editing a saved sequence from the Vault';
    }
    if (this.activeDraftKind === 'recursion') {
      return 'New from Recursion · not saved';
    }
    if (this.isCurrentDraftDirty()) {
      return 'Unsaved draft · available only while this app remains open';
    }
    return 'A clean canvas for a new sequence';
  }

  updateSequencePicker() {
    const picker = this.container.querySelector('#workshop-sequence-select');
    const status = this.container.querySelector('#workshop-sequence-status');
    if (picker) picker.innerHTML = this.renderSequenceOptions();
    if (status) status.textContent = this.getEditorStatus();
  }

  handleSequenceSelection(value) {
    if (!value || value === 'current') return;
    if (value === 'new') {
      this.startNewSequence({ preserveCurrent: true });
      return;
    }
    if (value.startsWith('draft:')) {
      this.restoreSuspendedDraft(value.slice('draft:'.length));
      return;
    }
    if (value.startsWith('saved:')) {
      const blueprintId = value.slice('saved:'.length);
      if (blueprintId !== this.activeBlueprintId) {
        this.openSavedBlueprint(blueprintId);
      }
    }
  }

  armOrResetSequence() {
    if (!this.isCurrentDraftDirty() && !this.activeBlueprintId) {
      this.startNewSequence({ preserveCurrent: false, notify: true });
      return;
    }

    const button = this.container.querySelector('#reset-workshop-btn');
    if (!this.resetArmed) {
      this.resetArmed = true;
      if (button) {
        button.textContent = 'Confirm Reset';
        button.classList.add('reset-armed');
      }
      this.resetTimer = setTimeout(() => {
        this.resetArmed = false;
        this.resetTimer = null;
        if (button?.isConnected) {
          button.textContent = 'Reset';
          button.classList.remove('reset-armed');
        }
      }, 3500);
      return;
    }

    this.startNewSequence({ preserveCurrent: false, notify: true });
  }

  render() {
    const visualAssets = this.visualAssetEntries();
    this.container.innerHTML = renderWorkshopStudioShell({
      editorStatus: this.getEditorStatus(),
      sequenceOptions: this.renderSequenceOptions(),
      title: this.sessionData.title,
      intent: this.sessionData.intent,
      sourceCount: this.sessionData.sources.length,
      sourcesHtml: this.renderSources(),
      assetSearch: this.visualAssetSearch,
      assetFiltersHtml: this.renderVisualAssetFilters(visualAssets),
      assetsHtml: this.renderVisualAssetRegistry(visualAssets),
      visualPresentationHtml: this.renderVisualPresentationPanel(),
      inspectorKind: this.inspectorContext.kind,
      inspectorLabel: inspectorContextLabel(this.inspectorContext),
      inspectorHtml: this.renderContextualInspector(visualAssets),
      scoreHtml: this.renderMediaScoreEditor(),
      activeAssetLane: this.activeAssetLane,
      audioAssetsHtml: this.renderAudioAssetRegistry(),
      audioSelectionHtml: this.renderSelectedAudioAsset(),
      audioSummary: this.audioSummary(),
      audioBedLabel: this.audioBedLabel(),
      audioEntryLabel: this.audioLayerLabel(),
      wordCount: this.readingWordCount(),
      readingDuration: this.readingDurationLabel(),
      studioViewport: this.studioViewport,
      studioSurface: this.studioSurface,
      selectionActionHtml: this.renderSelectionActionBar(),
      selectionPopoverHtml: this.renderScoreSelectionPopover(),
      wpm: this.sessionData.wpm,
      curve: this.sessionData.curve,
      chunkMode: this.sessionData.chunkMode,
      soundscape: this.sessionData.soundscape || 'none',
      audioPreset: this.sessionData.audioPreset || 'silent',
      curveIcon: curve => this.getCurveIcon(curve),
      audioIcon: preset => this.getAudioIcon(preset)
    });

    this.updateCreateButton();
    this.updatePersonalSwellList();
  }

  setInspectorContext(context, { navigate = false, focus = false } = {}) {
    this.inspectorContext = normalizeInspectorContext(context);
    this.refreshContextualInspector();
    if (navigate && this.studioViewport !== 'desktop') {
      this.setStudioSurface('inspector', { focus: false });
    }
    if (focus) {
      requestAnimationFrame(() => this.container.querySelector('#studio-contextual-inspector [data-inspector-focus], #studio-contextual-inspector summary, #studio-contextual-inspector button, #studio-contextual-inspector input')
        ?.focus?.({ preventScroll: true }));
    }
    return this.inspectorContext;
  }

  refreshContextualInspector() {
    const host = this.container.querySelector('#studio-contextual-inspector');
    if (!host) return false;
    this.withFocusPreserved(() => {
      host.dataset.inspectorKind = this.inspectorContext.kind;
      host.innerHTML = this.renderContextualInspector();
      const label = this.container.querySelector('.studio-inspector > .studio-pane-title strong');
      if (label) label.textContent = inspectorContextLabel(this.inspectorContext);
    });
    return true;
  }

  setWorkshopIssue(code, message, recovery = {}) {
    this.workshopIssue = {
      code: String(code || 'WORKSHOP_ERROR'),
      message: String(message || 'The requested Workshop operation could not be completed.'),
      action: recovery.action || 'show-score-surface',
      label: recovery.label || 'Return to Score'
    };
    this.inspectorContext = normalizeInspectorContext({ kind: 'issue', code: this.workshopIssue.code });
    this.refreshContextualInspector();
    if (this.studioViewport !== 'desktop') this.setStudioSurface('inspector', { focus: false });
    this.announce(this.workshopIssue.message);
  }

  renderIssueInspector() {
    const issue = this.workshopIssue;
    if (!issue) return this.renderProjectInspector();
    return `<section class="studio-context-card studio-issue-inspector" id="studio-issue-inspector" role="alert">
      <span class="studio-kicker">Needs attention · ${this.escapeHtml(issue.code)}</span>
      <h3>Workshop could not complete that action</h3>
      <p>${this.escapeHtml(issue.message)}</p>
      <div class="studio-selected-actions studio-choice-grid studio-choice-grid-2">
        <button type="button" class="btn-primary btn-compact" data-action="${this.escapeHtml(issue.action)}">${this.escapeHtml(issue.label)}</button>
        <button type="button" class="btn-ghost btn-compact" data-action="dismiss-workshop-issue">Dismiss</button>
      </div>
    </section>`;
  }

  renderProjectInspector() {
    const issueCount = this.projectIssueCount();
    return `<details class="studio-inspector-section studio-project-section" id="studio-project-inspector" open>
      <summary><span>Project</span><span data-studio-source-count="label">${this.sessionData.sources.length} source${this.sessionData.sources.length === 1 ? '' : 's'}</span></summary>
      <div class="studio-inspector-body">
        <div class="studio-project-health ${issueCount ? 'has-issues' : ''}">
          <span class="studio-kicker">Sequence health</span>
          <strong>${issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'} to resolve` : this.sessionData.sources.length ? 'Ready to compose' : 'Add a source to begin'}</strong>
          <small>${this.editorDirty ? 'Unsaved changes' : 'No unsaved changes'}</small>
        </div>
        <div class="input-group">
          <label class="input-label" for="session-title">Sequence title</label>
          <input type="text" id="session-title" class="input" placeholder="Untitled Sequence" value="${this.escapeHtml(this.sessionData.title)}" />
        </div>
        <div class="input-group"><span class="input-label">Category</span>
          <div class="intent-options studio-choice-grid studio-choice-grid-5">
            ${['focus', 'learning', 'exploration', 'reflection', 'custom'].map(intent => `<label class="radio">
              <input type="radio" name="intent" value="${intent}" ${this.sessionData.intent === intent ? 'checked' : ''} />
              <span class="radio-label text-capitalize">${intent}</span></label>`).join('')}
          </div>
        </div>
        <div class="studio-next-action">
          <span class="studio-kicker">Next useful action</span>
          <p>${this.sessionData.sources.length ? 'Highlight the source text in the Visual, Audio, or Combined tab to assign character assets.' : 'Browse the Archive or import a text source.'}</p>
          <button type="button" class="btn-secondary btn-compact" data-action="${this.sessionData.sources.length ? 'show-score-surface' : 'open-browser'}">${this.sessionData.sources.length ? 'Open Score' : 'Browse sources'}</button>
        </div>
      </div>
    </details>`;
  }

  renderPacingInspector() {
    return `<details class="studio-inspector-section" id="studio-reading-inspector" open>
      <summary><span>Reading conductor</span><span class="font-mono" data-reading-inspector-summary>${this.sessionData.wpm} WPM</span></summary>
      <div class="studio-inspector-body">
        <div class="studio-reading-metrics">
          <span><small>Material</small><strong data-reading-word-count>${this.readingWordCount()} words</strong></span>
          <span><small>Estimate</small><strong data-reading-duration>${this.escapeHtml(this.readingDurationLabel())}</strong></span>
        </div>
        <div class="input-group"><label class="input-label" for="wpm-slider"><span>Pacing</span><span class="input-label-value font-mono" id="wpm-value">${this.sessionData.wpm} WPM</span></label>
          <div class="slider-container"><input type="range" id="wpm-slider" class="slider" min="100" max="500" value="${this.sessionData.wpm}" step="10" aria-describedby="wpm-chamber-note" /></div>
          <div class="config-notice text-fog font-mono" id="wpm-chamber-note">◇ Adjustable in Chamber</div></div>
        <div class="input-group"><span class="input-label">Pacing curve</span>
          <div class="curve-options studio-compact-options studio-choice-grid studio-choice-grid-5">
            ${['flat', 'induction', 'ascent', 'wave', 'climax'].map(curve => `<button type="button" class="curve-btn ${this.sessionData.curve === curve ? 'active' : ''}" data-action="set-reading-curve" data-curve="${curve}" aria-pressed="${this.sessionData.curve === curve}"><span class="curve-icon">${this.getCurveIcon(curve)}</span><span class="curve-label text-capitalize">${curve}</span></button>`).join('')}
          </div></div>
        <div class="input-group"><span class="input-label">Chunking</span>
          <div class="chunk-options studio-choice-grid studio-choice-grid-3">
            ${['word', 'phrase', 'sentence'].map(mode => `<button type="button" class="chunk-btn ${this.sessionData.chunkMode === mode ? 'active' : ''}" data-action="set-reading-chunk" data-chunk="${mode}" aria-pressed="${this.sessionData.chunkMode === mode}">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}
          </div></div>
      </div>
    </details>`;
  }

  renderAudioAssetInspector() {
    return `<details class="studio-inspector-section" id="studio-audio-inspector" open>
      <summary><span>Atmosphere</span><span class="text-capitalize" data-audio-summary>${this.escapeHtml(this.audioSummary())}</span></summary>
      <div class="studio-inspector-body">
        <div class="studio-atmosphere-summary">
          <span><small>Whole reading</small><strong data-audio-bed>${this.escapeHtml(this.audioBedLabel())}</strong></span>
          <span><small>Highlighted</small><strong data-audio-entry>${this.escapeHtml(this.audioLayerLabel())}</strong></span>
        </div>
        <div id="studio-audio-selection">${this.renderSelectedAudioAsset()}</div>
      </div>
    </details>`;
  }

  renderSourceInspector(sourceId = this.inspectorContext.id) {
    const index = this.sessionData.sources.findIndex(source => String(source.id) === sourceId);
    const source = this.sessionData.sources[index];
    if (!source) return this.renderProjectInspector();
    const wordCount = (source.data || '').trim().split(/\s+/u).filter(Boolean).length;
    return `<section class="studio-context-card" id="studio-source-inspector">
      <span class="studio-kicker">Source ${index + 1} of ${this.sessionData.sources.length}</span>
      <h3>${this.escapeHtml(source.name)}</h3>
      <p>${wordCount.toLocaleString()} words · ${this.escapeHtml(source.metadata?.provider || source.metadata?.source || 'Project source')}</p>
      <div class="studio-selected-actions studio-choice-grid studio-choice-grid-3">
        <button type="button" class="btn-secondary btn-compact" data-action="preview-source" data-index="${index}">Preview</button>
        <button type="button" class="btn-ghost btn-compact" data-action="move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>Move up</button>
        <button type="button" class="btn-ghost btn-compact" data-action="move-down" data-index="${index}" ${index === this.sessionData.sources.length - 1 ? 'disabled' : ''}>Move down</button>
      </div>
      <button type="button" class="btn-ghost btn-compact is-destructive" data-action="remove-source" data-index="${index}">Remove source and its clips</button>
    </section>`;
  }

  renderVisualClipInspector(assignmentId = this.inspectorContext.id) {
    const assignment = this.sessionData.visualScoreAssignments.find(item => item.id === assignmentId);
    if (!assignment) return this.renderProjectInspector();
    const source = this.scoreSources().find(item => item.id === assignment.sourceId);
    const asset = this.scoreAsset(assignment.assetId, assignment);
    const excerpt = source?.text.slice(assignment.fromCharacter, assignment.toCharacter).replace(/\s+/gu, ' ').trim() || '';
    return `<section class="studio-context-card studio-clip-inspector" id="studio-visual-clip-inspector">
      <span class="studio-kicker">Passage visual</span><h3>${this.escapeHtml(asset?.name || 'Missing visual')}</h3>
      <blockquote>“${this.escapeHtml(excerpt.slice(0, 220))}${excerpt.length > 220 ? '…' : ''}”</blockquote>
      <p class="font-mono">Characters ${assignment.fromCharacter}–${assignment.toCharacter}</p>
      ${asset?.entry ? this.renderVisualStyleControls(asset.entry) : ''}
      <div class="studio-selected-actions studio-choice-grid studio-choice-grid-3">
        <button type="button" class="btn-secondary btn-compact" data-action="preview-score-assignment" data-assignment-id="${this.escapeHtml(assignment.id)}">Preview</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset" data-score-lane="visual">Replace</button>
        <button type="button" class="btn-ghost btn-compact" data-action="erase-score-assignment" data-assignment-id="${this.escapeHtml(assignment.id)}">Erase</button>
      </div>
    </section>`;
  }

  renderAudioClipInspector(assignmentId = this.inspectorContext.id) {
    const assignment = this.sessionData.audioScoreAssignments.find(item => item.id === assignmentId);
    if (!assignment) return this.renderProjectInspector();
    const source = this.scoreSources().find(item => item.id === assignment.sourceId);
    const asset = this.audioScoreAssets().find(item => item.id === assignment.assetId);
    const excerpt = source?.text.slice(assignment.fromCharacter, assignment.toCharacter).replace(/\s+/gu, ' ').trim() || '';
    return `<section class="studio-context-card studio-clip-inspector" id="studio-audio-clip-inspector">
      <span class="studio-kicker">${assignment.lane === 'swell' ? 'Layered over the reading' : 'Audio bed clip'}</span><h3>${this.escapeHtml(asset?.name || 'Missing audio')}</h3>
      <blockquote>“${this.escapeHtml(excerpt.slice(0, 220))}${excerpt.length > 220 ? '…' : ''}”</blockquote>
      <p class="font-mono">Characters ${assignment.fromCharacter}–${assignment.toCharacter}</p>
      <div class="studio-selected-actions studio-choice-grid studio-choice-grid-3">
        <button type="button" class="btn-secondary btn-compact" data-action="preview-audio-score-asset">Preview</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset" data-score-lane="audio">Replace</button>
        <button type="button" class="btn-ghost btn-compact" data-action="erase-audio-assignment" data-assignment-id="${this.escapeHtml(assignment.id)}">Erase</button>
      </div>
    </section>`;
  }

  renderCombinedClipInspector() {
    const visualId = this.inspectorContext.visualId || this.selectedScoreAssignmentId;
    const audioId = this.inspectorContext.audioId || this.selectedAudioAssignmentId;
    return `<section class="studio-context-card studio-combined-clip-inspector" id="studio-combined-clip-inspector">
      <span class="studio-kicker">Synchronized passage</span><h3>Visual + audio</h3>
      <div class="studio-combined-inspector-grid">
        <div>${this.renderVisualClipInspector(visualId)}</div>
        <div>${this.renderAudioClipInspector(audioId)}</div>
      </div>
    </section>`;
  }

  sequenceMapGroups() {
    const proposal = this.pendingAgentProposal;
    const proposedVisual = proposal?.proposedVisual || [];
    const proposedAudio = proposal?.proposedAudio || [];
    const visualAssignments = proposedVisual.length
      ? [...this.sessionData.visualScoreAssignments, ...proposedVisual.filter(item =>
        !this.sessionData.visualScoreAssignments.some(current => current.id === item.id))]
      : this.sessionData.visualScoreAssignments;
    const audioAssignments = proposedAudio.length
      ? [...this.sessionData.audioScoreAssignments, ...proposedAudio.filter(item =>
        !this.sessionData.audioScoreAssignments.some(current => current.id === item.id))]
      : this.sessionData.audioScoreAssignments;
    return buildSequenceMapGroups({
      sources: this.scoreSources(),
      visualAssignments,
      audioAssignments,
      proposedIds: proposal
        ? [...proposedVisual, ...proposedAudio].map(item => item.id)
        : null
    });
  }

  renderSequenceMapEntryDetail(entry, source) {
    const visual = entry.visual;
    const selectedAudio = entry.audio.find(item => item.id === this.selectedAudioAssignmentId)
      || entry.audio[0] || null;
    const visualAsset = visual ? this.scoreAsset(visual.assetId, visual) : null;
    const audioAssets = new Map(this.audioScoreAssets().map(asset => [asset.id, asset]));
    const excerpt = source.text.slice(entry.fromCharacter, entry.toCharacter)
      .replace(/\s+/gu, ' ').trim();
    const visualMedia = visualAsset
      ? `<div class="studio-sequence-map-thumbnail is-visual" style="--sequence-visual-color:${visualAsset.color}">
          ${this.renderEditorAssetPreview(visualAsset.entry, { alt: visualAsset.name, selected: true })}
          <span>${this.escapeHtml(visualAsset.name)}</span></div>`
      : '';
    const audioMedia = entry.audio.map(audio => {
      const asset = audioAssets.get(audio.assetId);
      return `<div class="studio-sequence-map-thumbnail is-audio" style="--sequence-audio-color:${asset?.editor?.color || AUDIO_SCORE_COLORS[0]}">
        <span class="studio-sequence-audio-glyph" aria-hidden="true">${audio.lane === 'swell' ? '✦' : '◉'}</span>
        <span>${this.escapeHtml(asset?.name || 'Missing audio')}</span></div>`;
    }).join('');
    const visualActions = visual ? `<div class="studio-sequence-map-lane-actions">
      <span><i class="is-visual" aria-hidden="true"></i>Visual</span>
      <div class="studio-choice-grid studio-choice-grid-3">
        <button type="button" class="btn-secondary btn-compact" data-action="preview-score-assignment" data-assignment-id="${this.escapeHtml(visual.id)}">Preview</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset" data-score-lane="visual">Replace</button>
        <button type="button" class="btn-ghost btn-compact" data-action="erase-score-assignment" data-assignment-id="${this.escapeHtml(visual.id)}">Erase</button>
      </div></div>` : '';
    const audioActions = entry.audio.map(audio => `<div class="studio-sequence-map-lane-actions">
      <span><i class="is-audio" aria-hidden="true"></i>${audio.lane === 'swell' ? 'Layer' : 'Audio bed'}</span>
      <div class="studio-choice-grid studio-choice-grid-3">
        <button type="button" class="btn-secondary btn-compact" data-action="preview-audio-assignment" data-assignment-id="${this.escapeHtml(audio.id)}">Preview</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset" data-score-lane="audio">Replace</button>
        <button type="button" class="btn-ghost btn-compact" data-action="erase-audio-assignment" data-assignment-id="${this.escapeHtml(audio.id)}">Erase</button>
      </div></div>`).join('');
    return `<div class="studio-sequence-map-detail" tabindex="-1" data-inspector-focus>
      <div class="studio-sequence-map-media">${visualMedia}${audioMedia}</div>
      <blockquote>“${this.escapeHtml(excerpt.slice(0, 240))}${excerpt.length > 240 ? '…' : ''}”</blockquote>
      <p class="font-mono">Characters ${entry.fromCharacter}–${entry.toCharacter}${visual && selectedAudio ? ' · synchronized media' : ''}</p>
      ${visualAsset?.entry ? this.renderVisualStyleControls(visualAsset.entry) : ''}
      ${visualActions}${audioActions}
    </div>`;
  }

  renderSequenceMap() {
    const groups = this.sequenceMapGroups();
    const totalClips = this.sessionData.visualScoreAssignments.length
      + this.sessionData.audioScoreAssignments.length;
    return `<section class="studio-sequence-map" aria-labelledby="studio-sequence-map-title">
      <header><div><span class="studio-kicker">Whole reading</span><h3 id="studio-sequence-map-title">Composition map</h3></div>
        <span class="studio-sequence-map-count">${totalClips} clip${totalClips === 1 ? '' : 's'}</span></header>
      ${groups.length ? groups.map(group => {
        const activeSource = group.sourceId === String(this.activeScoreSourceId);
        return `<section class="studio-sequence-source ${activeSource ? 'is-active-source' : ''}" data-sequence-source-id="${this.escapeHtml(group.sourceId)}">
          <button type="button" class="studio-sequence-source-heading" data-action="select-sequence-map-source" data-source-id="${this.escapeHtml(group.sourceId)}"
            aria-pressed="${activeSource}"><span><small>Source ${group.sourceIndex + 1}</small><strong>${this.escapeHtml(group.source.name)}</strong></span>
            <em>${group.entries.length} passage${group.entries.length === 1 ? '' : 's'}</em></button>
          ${group.entries.length ? `<ol>${group.entries.map(entry => {
            const selected = entry.visual?.id === this.selectedScoreAssignmentId
              || entry.audio.some(item => item.id === this.selectedAudioAssignmentId);
            const visualAsset = entry.visual
              ? this.scoreAsset(entry.visual.assetId, entry.visual)
              : null;
            const audioAssets = new Map(this.audioScoreAssets().map(asset => [asset.id, asset]));
            const selectedAudio = entry.audio.find(item => item.id === this.selectedAudioAssignmentId) || entry.audio[0];
            const excerpt = group.source.text.slice(entry.fromCharacter, entry.toCharacter).replace(/\s+/gu, ' ').trim().slice(0, 92);
            const labels = [visualAsset?.name, ...entry.audio.map(audio => audioAssets.get(audio.assetId)?.name)].filter(Boolean);
            return `<li class="studio-sequence-map-entry ${selected ? 'is-selected' : ''} ${entry.status === 'proposed' ? 'is-proposed' : ''} ${entry.visual ? 'has-visual' : ''} ${entry.audio.length ? 'has-audio' : ''} ${entry.visual && entry.audio.length ? 'is-synchronized' : ''}"
                data-sequence-entry-key="${this.escapeHtml(entry.key)}"
                ${entry.visual ? `data-sequence-visual-id="${this.escapeHtml(entry.visual.id)}"` : ''}
                data-sequence-audio-ids="${this.escapeHtml(entry.audio.map(item => item.id).join(' '))}"
                style="--sequence-visual-color:${visualAsset?.color || VISUAL_SCORE_COLORS[0]};--sequence-audio-color:${audioAssets.get(selectedAudio?.assetId)?.editor?.color || AUDIO_SCORE_COLORS[0]}">
              <button type="button" class="studio-sequence-map-entry-main" data-action="select-sequence-map-entry"
                ${entry.visual ? `data-visual-assignment-id="${this.escapeHtml(entry.visual.id)}"` : ''}
                ${selectedAudio ? `data-audio-assignment-id="${this.escapeHtml(selectedAudio.id)}"` : ''}
                aria-expanded="${selected}" aria-pressed="${selected}" data-focus-key="sequence-entry:${this.escapeHtml(entry.key)}">
                <span class="studio-sequence-map-rail" aria-hidden="true"><i class="is-visual"></i><i class="is-audio"></i></span>
                <span><small>${entry.fromCharacter}–${entry.toCharacter} · ${entry.visual && entry.audio.length ? 'Visual + audio' : entry.visual ? 'Visual' : entry.audio[0]?.lane === 'swell' ? 'Layer' : 'Audio'}</small>
                  <strong>${this.escapeHtml(labels.join(' + ') || 'Missing media')}</strong>
                  <span>“${this.escapeHtml(excerpt)}${excerpt.length === 92 ? '…' : ''}”</span></span>
              </button>
              ${selected ? this.renderSequenceMapEntryDetail(entry, group.source) : ''}
            </li>`;
          }).join('')}</ol>` : '<p class="studio-sequence-source-empty">No passage media assigned yet.</p>'}
        </section>`;
      }).join('') : `<div class="studio-sequence-map-empty"><span aria-hidden="true">◇</span>
        <p>Add a source to begin building the composition map.</p></div>`}
    </section>`;
  }

  projectIssueCount() {
    let count = this.workshopIssue ? 1 : 0;
    const visualAssets = new Set(this.scoreAssetLookup().keys());
    count += this.sessionData.visualScoreAssignments.filter(item => !visualAssets.has(item.assetId)).length;
    const audioAssets = new Set(this.audioScoreAssets().map(item => item.id));
    count += this.sessionData.audioScoreAssignments.filter(item => !audioAssets.has(item.assetId)).length;
    return count;
  }

  renderContextualInspector(entries = this.visualAssetEntries()) {
    let contextHtml = '';
    switch (this.inspectorContext.kind) {
      case 'pacing': contextHtml = this.renderPacingInspector(); break;
      case 'visualAsset': contextHtml = this.renderVisualInspector(entries); break;
      case 'audioAsset': contextHtml = this.renderAudioAssetInspector(); break;
      case 'source': contextHtml = this.renderSourceInspector(); break;
      case 'issue': contextHtml = this.renderIssueInspector(); break;
      case 'visualClip':
      case 'audioClip':
      case 'combinedClip': break;
      default: contextHtml = this.renderProjectInspector();
    }
    return `<div class="studio-inspector-stack">${contextHtml}${this.renderSequenceMap()}</div>`;
  }

  captureFocusKey() {
    const active = document.activeElement;
    if (!active || !this.container.contains(active)) return null;
    if (active.id) return { type: 'id', value: active.id };
    const key = active.getAttribute?.('data-focus-key');
    return key ? { type: 'key', value: key } : null;
  }

  restoreFocusKey(descriptor) {
    if (!descriptor) return false;
    const target = descriptor.type === 'id'
      ? this.container.querySelector(`#${descriptor.value}`)
      : [...this.container.querySelectorAll('[data-focus-key]')]
        .find(node => node.getAttribute('data-focus-key') === descriptor.value);
    if (!target || target.disabled || target.hidden) return false;
    target.focus({ preventScroll: true });
    return true;
  }

  withFocusPreserved(update) {
    const descriptor = this.captureFocusKey();
    update();
    this.restoreFocusKey(descriptor);
  }

  announce(message) {
    const announcer = this.container.querySelector('#studio-announcer');
    if (!announcer) return;
    if (this.announcementTimer) clearTimeout(this.announcementTimer);
    announcer.textContent = '';
    requestAnimationFrame(() => { announcer.textContent = message; });
    this.announcementTimer = setTimeout(() => {
      if (announcer.isConnected) announcer.textContent = '';
      this.announcementTimer = null;
    }, 5000);
  }

  renderSelectionActionBar() {
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    if (!selection) return '';
    const source = this.scoreSources().find(item => item.id === selection.sourceId);
    if (this.scoreView === 'combined') {
      const visualAsset = this.scoreAsset(this.selectedScoreAssetId);
      const audioAsset = this.selectedAudioScoreAsset();
      const canAssignVisual = Boolean(source && visualAsset && !this.pendingScoreConflict);
      const canAssignAudio = Boolean(source && audioAsset && !this.pendingScoreConflict);
      const excerpt = source?.text.slice(selection.fromCharacter, selection.toCharacter)
        .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Selected passage';
      return `<section class="studio-selection-bar is-combined" aria-label="Selected passage media actions">
        <p><span class="studio-kicker">Selected passage</span><strong>â€œ${this.escapeHtml(excerpt)}${excerpt.length === 72 ? 'â€¦' : ''}â€</strong>
          <small>Visual: ${this.escapeHtml(visualAsset?.name || 'not chosen')} Â· Audio: ${this.escapeHtml(audioAsset?.name || 'not chosen')}</small></p>
        <div>
          <button type="button" class="btn-ghost btn-compact" data-action="cancel-score-selection">Cancel</button>
          <button type="button" class="btn-secondary btn-compact" data-action="assign-score-lane" data-score-lane="visual"
                  ${canAssignVisual ? '' : 'disabled'}>Assign visual</button>
          <button type="button" class="btn-secondary btn-compact" data-action="assign-score-lane" data-score-lane="audio"
                  ${canAssignAudio ? '' : 'disabled'}>Assign audio</button>
        </div>
      </section>`;
    }
    const lane = this.scoreAuthoringLane();
    const asset = lane === 'audio' ? this.selectedAudioScoreAsset() : this.scoreAsset(this.selectedScoreAssetId);
    const canAssign = Boolean(source && asset && !this.pendingScoreConflict);
    const excerpt = source?.text.slice(selection.fromCharacter, selection.toCharacter)
      .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Selected passage';
    return `<section class="studio-selection-bar" aria-label="Selected passage actions">
      <p><span class="studio-kicker">Selected passage</span><strong>“${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”</strong>
        <small>${asset ? `${lane === 'audio' ? 'Audio' : 'Visual'}: ${this.escapeHtml(asset.name)}` : `Choose ${lane === 'audio' ? 'audio' : 'a visual'} to assign`}</small></p>
      <div>
        <button type="button" class="btn-ghost btn-compact" data-action="cancel-score-selection">Cancel</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset">Browse ${lane === 'audio' ? 'audio' : 'visuals'}</button>
        <button type="button" class="btn-primary btn-compact" data-action="assign-score-selection"
                ${canAssign ? '' : 'disabled'}>Assign</button>
      </div>
    </section>`;
  }

  refreshSelectionActionBar() {
    const host = this.container.querySelector('#studio-selection-actions');
    if (host) host.innerHTML = this.renderSelectionActionBar();
  }

  selectedScoreAssetEntry(entries = this.visualAssetEntries()) {
    return entries.find(entry => !entry.materialization
      && editorAssetSupports(entry.asset, 'span')
      && this.scoreAssetReference(entry) === this.selectedScoreAssetId) || null;
  }

  /**
   * SHARED MEDIA IS OFFERED, NOT HIDDEN.
   *
   * A shared entry needs copying into the project before a passage can name
   * it, and this list used to exclude anything that did — leaving the
   * `Shared media` group below permanently empty. The cost fell on the one
   * reader who could least afford it: an image is classified shared the
   * moment `activeBlueprintId` stops matching the sequence it was saved
   * under, so a reader's OWN pictures could sit in the panel and be missing
   * from this dropdown with nothing said. Offering them, and copying on
   * choice, means the list can no longer be silently short.
   */
  renderPassageAssetOptions(entries = this.visualAssetEntries()) {
    const available = entries.filter(entry =>
      !entry.hidden && editorAssetSupports(entry.asset, 'span'));
    const groups = [
      ['fields', 'Fields'], ['procedural', 'Procedural'], ['collections', 'Collections'],
      ['project', 'Project media'], ['shared', 'Shared media']
    ];
    const selectedAvailable = available.some(entry =>
      this.scoreAssetReference(entry) === this.selectedScoreAssetId);
    return `<option value="" ${selectedAvailable ? '' : 'selected'} disabled>Choose a passage visual</option>${groups
      .map(([group, label]) => {
        const items = available.filter(entry => entry.group === group);
        if (!items.length) return '';
        return `<optgroup label="${label}">${items.map(entry => {
          const summary = visualCueStyleSummary(this.visualCueForEntry(entry));
          const needsCopy = Boolean(entry.materialization);
          return `<option value="${this.escapeHtml(entry.asset.id)}"
            ${!needsCopy && this.scoreAssetReference(entry) === this.selectedScoreAssetId ? 'selected' : ''}>${this.escapeHtml(entry.asset.name)}${summary ? ` · ${this.escapeHtml(summary)}` : ''}${needsCopy ? ' — copy into project' : ''}</option>`;
        }).join('')}</optgroup>`;
      }).join('')}`;
  }

  personalFocalImages() {
    return this.sessionData.sequenceVisualAssets.filter(asset => asset.kind !== 'video');
  }

  inferPersonalFocalTarget() {
    const assignmentId = this.selectedScoreAssignmentId || this.scoreConfirmationAssignmentId;
    if (this.sessionData.visualScoreAssignments.some(item => item.id === assignmentId)) return 'clip';
    if (this.pendingScoreSelection || this.pendingScoreConflict) return 'passage';
    return 'whole-reading';
  }

  openPersonalFocalChooser(assetId = 'surface:focal', target = this.inferPersonalFocalTarget()) {
    const boundedTarget = ['passage', 'clip', 'whole-reading'].includes(target)
      ? target
      : this.inferPersonalFocalTarget();
    this.personalFocalChooser = { assetId, target: boundedTarget, expanded: false };
    this.refreshVisualLibraryAndInspector();
    this.refreshScoreSelectionUi();
    return boundedTarget;
  }

  renderPersonalFocalPicker({ target = 'whole-reading', compact = false } = {}) {
    const images = this.personalFocalImages();
    const activeId = this.personalFocalAssetIdForTarget(target);
    const active = images.find(asset => asset.id === activeId) || null;
    const expanded = this.personalFocalChooser?.target === target
      && this.personalFocalChooser.expanded === true;
    const actionCount = active ? 3 : 2;
    return `<section class="studio-personal-focal ${compact ? 'is-compact' : ''}" data-personal-focal-picker="${target}">
      ${active ? `<div class="studio-personal-focal-current">
        <img src="${safeUrl(active.uri)}" alt="" ${REMOTE_IMAGE_ATTRS} />
        <span><small>Current personal focal</small><strong>${this.escapeHtml(active.name)}</strong></span>
      </div>` : '<p>Use a durable project image as this focal.</p>'}
      <div class="studio-choice-grid studio-choice-grid-${actionCount} studio-personal-focal-actions">
        <button type="button" class="btn-secondary btn-compact" data-action="toggle-personal-focal-projects"
          data-focal-target="${target}" ${images.length ? '' : 'disabled'}>Choose Project Media</button>
        <button type="button" class="btn-secondary btn-compact" data-action="upload-personal-focal"
          data-focal-target="${target}">Upload New</button>
        ${active ? '<button type="button" class="btn-ghost btn-compact" data-action="remove-personal-focal-default">Remove</button>' : ''}
      </div>
      ${expanded ? `<div class="studio-personal-focal-projects" role="listbox" aria-label="Project images">
        ${images.map(asset => `<button type="button" role="option" class="studio-personal-focal-option"
          data-action="choose-personal-focal" data-focal-target="${target}" data-project-asset-id="${this.escapeHtml(asset.id)}"
          aria-selected="${asset.id === activeId}" ${asset.uri ? '' : 'disabled'}>
          ${asset.uri ? `<img src="${safeUrl(asset.uri)}" alt="" ${REMOTE_IMAGE_ATTRS} />` : '<span aria-hidden="true">◇</span>'}
          <strong>${this.escapeHtml(asset.name)}</strong>
        </button>`).join('')}
      </div>` : ''}
    </section>`;
  }

  personalFocalAssetIdForTarget(target = 'whole-reading') {
    if (target === 'whole-reading') {
      return this.sessionData.visualConfig?.focals?.personalAssetId || null;
    }
    if (target === 'clip') {
      const assignmentId = this.selectedScoreAssignmentId || this.scoreConfirmationAssignmentId;
      const assignment = this.sessionData.visualScoreAssignments
        .find(item => item.id === assignmentId);
      if (assignment?.cue?.kind === 'field' && assignment.cue.renderer === 'focal') {
        return normalizeFieldStyle('focal', assignment.cue.config).personalAssetId || null;
      }
    }
    const draft = this.visualAssetStyleDrafts.get('surface:focal');
    return draft?.kind === 'field' && draft.renderer === 'focal'
      ? normalizeFieldStyle('focal', draft.config).personalAssetId || null
      : null;
  }

  renderVisualStyleControls(entry, { compact = false } = {}) {
    const cue = this.visualCueForEntry(entry);
    if (!visualCueIsConfigurable(cue)) return '';
    const options = (values, selected) => values.map(item => {
      const id = typeof item === 'string' ? item : item.id;
      const name = typeof item === 'string'
        ? item.charAt(0).toUpperCase() + item.slice(1)
        : item.name;
      return `<option value="${this.escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
    }).join('');
    let controls = '';
    let supplement = '';
    let styleSummary = visualCueStyleSummary(cue);
    if (cue.kind === 'field' && cue.renderer === 'focal') {
      const config = normalizeFieldStyle('focal', cue.config);
      const chooser = this.personalFocalChooser?.assetId === entry.asset.id
        ? this.personalFocalChooser
        : null;
      const wholeReadingPersonal = !chooser
        && this.inferPersonalFocalTarget() === 'whole-reading'
        && this.sessionData.visualConfig?.focals?.type === 'personal';
      const personal = Boolean(chooser || wholeReadingPersonal || config.type === 'personal');
      const target = chooser?.target || this.inferPersonalFocalTarget();
      styleSummary = personal
        ? this.personalFocalImages().find(asset =>
          asset.id === (config.personalAssetId
            || this.personalFocalAssetIdForTarget(target)))?.name || 'Personal image'
        : styleSummary;
      controls = `<label><span>Focal form</span><select class="input-select" data-visual-style-setting="focal-glyph">
          ${options(FOCAL_GLYPHS, personal ? null : config.standardGlyph)}
          <option value="personal" ${personal ? 'selected' : ''}>Personal image</option></select></label>
        ${!personal && config.standardGlyph === 'rose' ? `<label><span>Rose rendering</span><select class="input-select" data-visual-style-setting="focal-rose-mode">
          ${options(ROSE_MODES, config.roseMode)}</select></label>` : ''}`;
      if (personal) supplement = this.renderPersonalFocalPicker({ target, compact });
    } else if (cue.kind === 'field' && cue.renderer === 'attractor') {
      const config = normalizeFieldStyle('attractor', cue.config);
      controls = `<label><span>System</span><select class="input-select" data-visual-style-setting="attractor-system">
          ${options(ATTRACTOR_SYSTEMS, config.system)}</select></label>
        <label><span>Filament</span><select class="input-select" data-visual-style-setting="attractor-palette">
          ${options(ATTRACTOR_PALETTES, config.palette)}</select></label>
        <label><span>Form</span><select class="input-select" data-visual-style-setting="attractor-form">
          ${options(ATTRACTOR_FORMS, config.form)}</select></label>`;
    } else if (cue.kind === 'field' && cue.renderer === 'genesis') {
      const config = normalizeFieldStyle('genesis', cue.config);
      controls = `<label><span>Climate</span><select class="input-select" data-visual-style-setting="genesis-preset">
          ${options(KLEE_PRESETS, config.preset)}</select></label>
        <label class="studio-style-toggle"><input type="checkbox" data-visual-style-setting="genesis-glass" ${config.glass ? 'checked' : ''}><span>Glass behind text</span></label>`;
    } else if (cue.kind === 'procedural' && cue.collections?.[0] === 'klee') {
      const config = normalizeProceduralStyle(cue.collections, cue.config);
      controls = `<label><span>Klee climate</span><select class="input-select" data-visual-style-setting="klee-preset">
        ${options(KLEE_PRESETS, config.preset)}</select></label>`;
    } else if (cue.kind === 'procedural' && cue.collections?.[0] === 'harmonograph') {
      const config = normalizeProceduralStyle(cue.collections, cue.config);
      controls = `<label><span>Harmonograph climate</span><select class="input-select" data-visual-style-setting="harmonograph-climate">
        ${options(HARMONOGRAPH_CLIMATES, config.climate)}</select></label>`;
    } else if (cue.kind === 'procedural' && cue.collections?.[0] === 'ostensoria') {
      const config = normalizeProceduralStyle(cue.collections, cue.config);
      controls = `<label><span>Iris palette</span><select class="input-select" data-visual-style-setting="ostensoria-palette">
        ${options(OSTENSORIA_PALETTES, config.palette)}</select></label>`;
    } else if (cue.kind === 'procedural' && cue.collections?.[0] === 'apparitio') {
      const config = normalizeProceduralStyle(cue.collections, cue.config);
      controls = `<label><span>Spectral palette</span><select class="input-select" data-visual-style-setting="apparitio-palette">
        ${options(APPARITIO_PALETTES, config.palette)}</select></label>`;
    }
    if (!controls) return '';
    return `<section class="studio-visual-style ${compact ? 'is-compact' : ''}" data-style-asset-id="${this.escapeHtml(entry.asset.id)}">
      <div class="studio-visual-style-heading"><span>Passage style</span><strong>${this.escapeHtml(styleSummary)}</strong></div>
      <div class="studio-visual-style-controls">${controls}</div>
      ${supplement}
      ${cue.kind === 'field' && cue.renderer === 'focal' && !supplement
        ? '<p>Choose Personal image to use or upload durable Project Media.</p>' : ''}
    </section>`;
  }

  /** The audio lane's counterpart to `renderPassageAssetOptions`. */
  renderPassageAudioOptions() {
    const assets = this.audioScoreAssets();
    return `<option value="" ${this.selectedAudioAssetId ? '' : 'selected'} disabled>Choose passage audio</option>${assets
      .map(asset => `<option value="${this.escapeHtml(asset.id)}"
        ${asset.id === this.selectedAudioAssetId ? 'selected' : ''}>${this.escapeHtml(asset.name)}</option>`)
      .join('')}`;
  }

  /** Choose what to assign without leaving the tab the reader is working in. */
  selectPassageAudioAsset(assetId) {
    const asset = this.audioScoreAssets().find(item => item.id === assetId);
    if (!asset) return false;
    this.selectedAudioAssetId = asset.id;
    this.refreshScoreSelectionUi();
    return true;
  }

  renderScoreSelectionPopover() {
    if (this.scoreView === 'combined' && (this.pendingScoreSelection || this.pendingScoreConflict)) {
      return this.renderCombinedSelectionPopover();
    }
    if (this.sessionData.audioScoreAssignments.some(item => item.id === this.scoreConfirmationAssignmentId)) {
      return this.renderAudioSelectionPopover();
    }
    if (this.scoreAuthoringLane() === 'audio') return this.renderAudioSelectionPopover();
    const entries = this.visualAssetEntries();
    const assignment = this.sessionData.visualScoreAssignments
      .find(item => item.id === this.scoreConfirmationAssignmentId);
    if (assignment) {
      const source = this.scoreSources().find(item => item.id === assignment.sourceId);
      const assignedAsset = this.scoreAsset(assignment.assetId, assignment);
      const candidate = this.scoreAsset(this.selectedScoreAssetId);
      const candidateEntry = this.selectedScoreAssetEntry(entries);
      const excerpt = source?.text.slice(assignment.fromCharacter, assignment.toCharacter)
        .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Assigned passage';
      return `<section class="studio-passage-popover is-confirmation" role="dialog"
          aria-label="Visual assignment confirmation" data-assignment-id="${this.escapeHtml(assignment.id)}">
        <div class="studio-passage-popover-heading">
          <span class="studio-passage-swatch" style="--passage-color:${assignedAsset?.color || VISUAL_SCORE_COLORS[0]}" aria-hidden="true"></span>
          <p><span class="studio-kicker">Passage visual assigned</span>
            <strong>${this.escapeHtml(assignedAsset?.name || 'Missing visual')}</strong>
            <small>“${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”</small></p>
        </div>
        <label class="studio-passage-picker"><span>Replace with</span>
          <select class="input-select" data-passage-asset-picker data-focus-key="passage-asset-picker">
            ${this.renderPassageAssetOptions(entries)}
          </select>
        </label>
        ${candidateEntry ? this.renderVisualStyleControls(candidateEntry, { compact: true }) : ''}
        <div class="studio-passage-actions">
          <button type="button" class="btn-ghost btn-compact" data-action="preview-score-assignment"
            data-assignment-id="${this.escapeHtml(assignment.id)}">Preview</button>
          <button type="button" class="btn-secondary btn-compact" data-action="replace-score-confirmation"
            data-assignment-id="${this.escapeHtml(assignment.id)}"
            ${candidate && candidate.id !== assignment.assetId && candidateEntry ? '' : 'disabled'}>Replace</button>
          <button type="button" class="btn-ghost btn-compact" data-action="erase-score-assignment"
            data-assignment-id="${this.escapeHtml(assignment.id)}">Erase</button>
          <button type="button" class="btn-primary btn-compact" data-action="dismiss-score-confirmation">Done</button>
        </div>
      </section>`;
    }

    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    if (!selection) return '';
    const source = this.scoreSources().find(item => item.id === selection.sourceId);
    const asset = this.scoreAsset(this.selectedScoreAssetId);
    const entry = this.selectedScoreAssetEntry(entries);
    const excerpt = source?.text.slice(selection.fromCharacter, selection.toCharacter)
      .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Selected passage';
    const canAssign = Boolean(source && asset && entry && !this.pendingScoreConflict);
    return `<section class="studio-passage-popover ${this.pendingScoreConflict ? 'has-conflict' : ''}"
        role="dialog" aria-label="Assign a visual to the selected passage">
      <div class="studio-passage-popover-heading">
        <span class="studio-passage-swatch" style="--passage-color:${asset?.color || VISUAL_SCORE_COLORS[0]}" aria-hidden="true"></span>
        <p><span class="studio-kicker">Selected passage</span>
          <strong>“${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”</strong>
          <small>${this.pendingScoreConflict ? 'Overlaps an existing passage visual' : asset ? `Ready for ${this.escapeHtml(asset.name)}` : 'Choose a passage visual'}</small></p>
      </div>
      <label class="studio-passage-picker"><span>Passage visual</span>
        <select class="input-select" data-passage-asset-picker data-focus-key="passage-asset-picker">
          ${this.renderPassageAssetOptions(entries)}
        </select>
      </label>
      ${entry ? this.renderVisualStyleControls(entry, { compact: true }) : ''}
      <div class="studio-passage-actions">
        <button type="button" class="btn-ghost btn-compact" data-action="cancel-score-selection">Cancel</button>
        <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset">Browse all</button>
        ${this.canAuthorIntentionalStillness() && !this.pendingScoreConflict
          ? '<button type="button" class="btn-secondary btn-compact" data-action="assign-score-stillness">Intentional stillness</button>'
          : ''}
        ${this.pendingScoreConflict
          ? '<button type="button" class="btn-primary btn-compact" data-action="replace-score-overlap">Replace overlap</button>'
          : `<button type="button" class="btn-primary btn-compact" data-action="assign-score-selection"
              ${canAssign ? '' : 'disabled'}>Assign visual</button>`}
      </div>
    </section>`;
  }

  renderCombinedSelectionPopover() {
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    if (!selection) return '';
    const source = this.scoreSources().find(item => item.id === selection.sourceId);
    const visualEntries = this.visualAssetEntries();
    const visualAsset = this.scoreAsset(this.selectedScoreAssetId);
    const visualEntry = this.selectedScoreAssetEntry(visualEntries);
    const audioAsset = this.selectedAudioScoreAsset();
    const exactVisual = this.sessionData.visualScoreAssignments.find(item => item.sourceId === selection.sourceId
      && item.fromCharacter === selection.fromCharacter && item.toCharacter === selection.toCharacter);
    const exactAudio = this.sessionData.audioScoreAssignments.find(item => item.sourceId === selection.sourceId
      && item.fromCharacter === selection.fromCharacter && item.toCharacter === selection.toCharacter
      && (!audioAsset || item.lane === audioAsset.lane));
    const conflictLane = this.pendingScoreConflict?.scoreLane || null;
    const excerpt = source?.text.slice(selection.fromCharacter, selection.toCharacter)
      .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Selected passage';
    const canAssignVisual = Boolean(source && visualAsset && visualEntry && !exactVisual && !this.pendingScoreConflict);
    const canAssignAudio = Boolean(source && audioAsset && !exactAudio && !this.pendingScoreConflict);
    return renderCombinedPassageAssignment({
      hasConflict: Boolean(this.pendingScoreConflict),
      conflictLane,
      excerpt,
      excerptTruncated: excerpt.length === 72,
      visualOptionsHtml: this.renderPassageAssetOptions(visualEntries),
      visualStyleHtml: visualEntry ? this.renderVisualStyleControls(visualEntry, { compact: true }) : '',
      canAuthorStillness: this.canAuthorIntentionalStillness(),
      audioOptionsHtml: this.renderPassageAudioOptions(),
      canAssignVisual,
      canAssignAudio,
      exactVisual: Boolean(exactVisual),
      exactAudio: Boolean(exactAudio),
      defaultLane: this.activeAssetLane
    });
  }

  renderAudioSelectionPopover() {
    const assignment = this.sessionData.audioScoreAssignments
      .find(item => item.id === this.scoreConfirmationAssignmentId);
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    if (!assignment && !selection) return '';
    const sourceId = assignment?.sourceId || selection?.sourceId;
    const source = this.scoreSources().find(item => item.id === sourceId);
    const active = assignment
      ? this.audioScoreAssets().find(asset => asset.id === assignment.assetId)
      : this.selectedAudioScoreAsset();
    const range = assignment || selection;
    const excerpt = source?.text.slice(range.fromCharacter, range.toCharacter)
      .replace(/\s+/gu, ' ').trim().slice(0, 72) || 'Selected passage';
    const canAssign = Boolean(source && active && !this.pendingScoreConflict);
    return `<section class="studio-passage-popover audio-passage-popover ${assignment ? 'is-confirmation' : ''} ${this.pendingScoreConflict ? 'has-conflict' : ''}"
      role="dialog" aria-label="${assignment ? 'Audio assignment confirmation' : 'Assign audio to the selected passage'}"
      ${assignment ? `data-assignment-id="${this.escapeHtml(assignment.id)}"` : ''}>
      <div class="studio-passage-popover-heading">
        <span class="studio-passage-swatch" style="--passage-color:${active?.editor?.color || AUDIO_SCORE_COLORS[0]}" aria-hidden="true"></span>
        <p><span class="studio-kicker">${assignment ? 'Passage audio assigned' : 'Selected passage'}</span>
          <strong>${this.escapeHtml(active?.name || `“${excerpt}${excerpt.length === 72 ? '…' : ''}”`)}</strong>
          <small>${assignment ? `“${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”` : active ? `Ready for ${this.escapeHtml(active.name)}` : 'Choose passage audio'}</small></p>
      </div>
      <label class="studio-passage-picker"><span>${assignment ? 'Replace with' : 'Passage audio'}</span>
        <select class="input-select" data-passage-audio-picker data-focus-key="passage-audio-picker">
          ${this.renderPassageAudioOptions()}
        </select>
      </label>
      <div class="studio-passage-actions">
        ${assignment ? `<button type="button" class="btn-ghost btn-compact" data-action="preview-audio-score-asset">Preview</button>
          <button type="button" class="btn-secondary btn-compact" data-action="replace-active-score-asset">Replace</button>
          <button type="button" class="btn-ghost btn-compact" data-action="erase-active-score-assignment">Erase</button>
          <button type="button" class="btn-primary btn-compact" data-action="dismiss-score-confirmation">Done</button>`
          : `<button type="button" class="btn-ghost btn-compact" data-action="cancel-score-selection">Cancel</button>
          <button type="button" class="btn-secondary btn-compact" data-action="choose-score-asset">Browse audio</button>
          ${this.pendingScoreConflict
            ? '<button type="button" class="btn-primary btn-compact" data-action="replace-score-overlap">Replace overlap</button>'
            : `<button type="button" class="btn-primary btn-compact" data-action="assign-score-selection" ${canAssign ? '' : 'disabled'}>Assign audio</button>`}`}
      </div>
    </section>`;
  }

  refreshScoreSelectionUi() {
    this.withFocusPreserved(() => {
      this.refreshSelectionActionBar();
      const canAssign = Boolean((this.pendingScoreSelection || this.pendingScoreConflict)
        && (this.scoreView === 'combined'
          ? this.scoreAsset(this.selectedScoreAssetId) || this.selectedAudioScoreAsset()
          : this.scoreAuthoringLane() === 'audio'
            ? this.selectedAudioScoreAsset()
            : this.scoreAsset(this.selectedScoreAssetId))
        && !this.pendingScoreConflict);
      this.container.querySelectorAll('.visual-score-toolbar [data-action="assign-score-selection"]')
        .forEach(button => { button.disabled = !canAssign; });
      this.container.querySelectorAll('.visual-score-toolbar [data-action="assign-score-lane"]')
        .forEach(button => {
          const selection = this.pendingScoreSelection;
          const audio = button.dataset.scoreLane === 'audio';
          const asset = audio ? this.selectedAudioScoreAsset() : this.scoreAsset(this.selectedScoreAssetId);
          const assignments = audio
            ? this.sessionData.audioScoreAssignments
            : this.sessionData.visualScoreAssignments;
          const alreadyAssigned = Boolean(selection && assignments.some(item => item.sourceId === selection.sourceId
            && item.fromCharacter === selection.fromCharacter && item.toCharacter === selection.toCharacter
            && (!audio || !asset || item.lane === asset.lane)));
          button.disabled = !selection || !asset || alreadyAssigned || Boolean(this.pendingScoreConflict);
        });
      const host = this.container.querySelector('#studio-selection-popover');
      if (host) host.innerHTML = this.renderScoreSelectionPopover();
    });
    requestAnimationFrame(() => this.positionScoreSelectionPopover());
  }

  positionScoreSelectionPopover() {
    const popover = this.container.querySelector('.studio-passage-popover');
    if (!popover || this.studioViewport === 'phone') return;
    const assignmentId = popover.dataset.assignmentId;
    let targetRect = assignmentId
      ? [...this.container.querySelectorAll('.visual-score-mark')]
        .find(mark => mark.dataset.assignmentId === assignmentId)?.getBoundingClientRect()
      : null;
    if (!targetRect && (this.pendingScoreSelection || this.pendingScoreConflict)) {
      targetRect = this.rangeForPendingScoreSelection()?.getBoundingClientRect?.();
    }
    if (!targetRect || (!targetRect.width && !targetRect.height)) return;
    const margin = 12;
    const width = popover.offsetWidth || 360;
    const height = popover.offsetHeight || 220;
    const viewportWidth = window.innerWidth || 1280;
    const viewportHeight = window.innerHeight || 800;
    const left = Math.max(margin, Math.min(targetRect.left + (targetRect.width / 2) - (width / 2), viewportWidth - width - margin));
    const below = targetRect.bottom + 10;
    const top = below + height <= viewportHeight - margin
      ? below
      : Math.max(margin, targetRect.top - height - 10);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.transform = 'none';
  }

  syncStudioViewport(width = window.innerWidth ?? 1280) {
    const next = studioViewportForWidth(width);
    if (next === this.studioViewport) return false;
    this.studioViewport = next;
    if (next === 'desktop') this.studioSurface = 'score';
    this.syncStudioSurface();
    return true;
  }

  syncStudioSurface() {
    const root = this.container.querySelector('.workshop-studio');
    if (!root) return;
    root.dataset.studioViewport = this.studioViewport;
    root.dataset.studioSurface = this.studioSurface;
    this.container.querySelectorAll('[data-studio-surface-target]').forEach(button => {
      const active = button.dataset.studioSurfaceTarget === this.studioSurface;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  setStudioSurface(surface, { origin = null, focus = true } = {}) {
    const next = validStudioSurface(surface);
    if (origin && next !== 'score') this.responsiveFocusOrigin = origin;
    this.studioSurface = next;
    this.syncStudioSurface();
    if (!focus) return true;
    const targets = {
      score: '#visual-score-text, #studio-score-title',
      sources: '[data-action="open-browser"], #studio-sources-title',
      assets: '#visual-asset-search, #studio-assets-title',
      inspector: '#studio-contextual-inspector summary, #studio-contextual-inspector [data-inspector-focus], #studio-contextual-inspector button'
    };
    requestAnimationFrame(() => this.container.querySelector(targets[next])?.focus?.({ preventScroll: true }));
    return true;
  }

  closeStudioSurface() {
    this.studioSurface = 'score';
    this.syncStudioSurface();
    const origin = this.responsiveFocusOrigin;
    this.responsiveFocusOrigin = null;
    requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus({ preventScroll: true });
      else this.container.querySelector('#visual-score-text')?.focus({ preventScroll: true });
    });
  }

  scrollInspectorClipIntoView(assignmentId, { focus = false } = {}) {
    if (!assignmentId) return;
    requestAnimationFrame(() => {
      const entry = [...this.container.querySelectorAll('.studio-sequence-map-entry')]
        .find(node => node.dataset.sequenceVisualId === assignmentId
          || node.dataset.sequenceAudioIds?.split(/\s+/u).includes(assignmentId));
      if (!entry) return;
      entry.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      if (focus) entry.querySelector('.studio-sequence-map-detail')?.focus?.({ preventScroll: true });
    });
  }

  scrollScoreClipIntoView({ visualId = null, audioId = null } = {}) {
    requestAnimationFrame(() => {
      const mark = [...this.container.querySelectorAll('#visual-score-text .media-score-mark')]
        .find(node => node.dataset.assignmentId === visualId
          || node.dataset.assignmentId === audioId
          || node.dataset.visualAssignmentId === visualId
          || node.dataset.audioAssignmentId === audioId);
      if (!mark) return;
      mark.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      this.container.querySelector('#visual-score-text')?.focus?.({ preventScroll: true });
    });
  }

  selectSequenceMapEntry(visualId = null, audioId = null) {
    let selected = false;
    if (visualId && audioId) selected = this.selectCombinedAssignments(visualId, audioId);
    else if (visualId) selected = this.selectScoreAssignment(visualId);
    else if (audioId) selected = this.selectAudioAssignment(audioId);
    if (selected === false) return false;
    this.scrollScoreClipIntoView({ visualId, audioId });
    if (this.studioViewport !== 'desktop') this.setStudioSurface('score', { focus: false });
    return true;
  }

  cancelPendingScoreSelection({ announce = true } = {}) {
    if (!this.pendingScoreSelection && !this.pendingScoreConflict) return false;
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    window.getSelection?.()?.removeAllRanges?.();
    this.refreshSelectionActionBar();
    this.updateVisualScoreEditor();
    if (announce) this.announce('Passage selection cancelled.');
    return true;
  }

  readingWordCount(data = this.sessionData) {
    return data.sources.reduce((total, source) => {
      const text = typeof source?.data === 'string' ? source.data.trim() : '';
      return total + (text ? text.split(/\s+/u).length : 0);
    }, 0);
  }

  readingDurationLabel(data = this.sessionData) {
    const seconds = Math.ceil((this.readingWordCount(data) / Math.max(1, data.wpm || 200)) * 60);
    if (seconds < 60) return `${seconds || 0} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
  }

  currentAudioAssetId(data = this.sessionData) {
    const soundscape = data.soundscape || 'none';
    if (soundscape.startsWith(PERSONAL_BED_PREFIX)) {
      return `swell:${soundscape.slice(PERSONAL_BED_PREFIX.length)}`;
    }
    if (soundscape !== 'none') return `soundscape:${soundscape}`;
    return `tone:${data.audioPreset || 'silent'}`;
  }

  selectedPersonalAudio() {
    if (!this.selectedAudioAssetId?.startsWith('swell:')) return null;
    const id = this.selectedAudioAssetId.slice('swell:'.length);
    return this.personalSwells.find(item => item.id === id) || null;
  }

  audioBedLabel(data = this.sessionData) {
    const soundscape = data.soundscape || 'none';
    if (soundscape.startsWith(PERSONAL_BED_PREFIX)) {
      const id = soundscape.slice(PERSONAL_BED_PREFIX.length);
      return this.personalSwells.find(item => item.id === id)?.name || 'Personal audio';
    }
    if (soundscape !== 'none') {
      return workshopAudioAsset(`soundscape:${soundscape}`)?.name || soundscape;
    }
    if (data.audioPreset && data.audioPreset !== 'silent') {
      return workshopAudioAsset(`tone:${data.audioPreset}`)?.name || data.audioPreset;
    }
    return 'Silence';
  }

  audioSummary(data = this.sessionData) {
    return this.audioBedLabel(data);
  }

  wholeReadingAudioWash(data = this.sessionData) {
    const soundscape = data.soundscape || 'none';
    if (soundscape === 'none' && (data.audioPreset || 'silent') === 'silent') return null;
    const asset = audioScoreAssetFromId(this.currentAudioAssetId(data), this.personalSwells);
    return {
      label: this.audioBedLabel(data),
      color: asset?.editor?.color || AUDIO_SCORE_COLORS[0]
    };
  }

  /**
   * What the highlights add over the whole-reading layer. Counted rather than
   * named: a passage layer belongs to its passage, and the Composition map is
   * where each one is read.
   */
  audioLayerLabel(data = this.sessionData) {
    const clips = (data.audioScoreAssignments || []).length;
    if (!clips) return 'None';
    return `${clips} passage${clips === 1 ? '' : 's'}`;
  }

  renderAudioAssetRegistry() {
    return WORKSHOP_AUDIO_ASSETS.map(asset => {
      const selected = asset.id === this.selectedAudioAssetId;
      const current = workshopAudioAssetIsCurrent(this.sessionData, asset);
      const playing = this.audioPreviewState.assetId === asset.id;
      return `<article class="studio-audio-card ${selected ? 'selected' : ''} ${current ? 'is-current' : ''}"
          data-audio-card-id="${asset.id}">
        <button type="button" data-action="select-audio-asset" data-audio-asset-id="${asset.id}"
                role="option" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}"
                data-focus-key="audio-asset:${asset.id}"
                aria-label="${this.escapeHtml(`${asset.name}, ${asset.kind}${current ? ', sounds under the whole reading' : ''}`)}">
          <span class="studio-audio-icon" aria-hidden="true">${asset.icon}</span>
          <span><strong>${this.escapeHtml(asset.name)}</strong><small>${this.escapeHtml(asset.description)}</small></span>
          <span class="studio-audio-badges"><em>Bed</em>${current ? '<em>Current</em>' : ''}${playing ? '<em>Previewing</em>' : ''}</span>
        </button>
      </article>`;
    }).join('');
  }

  audioScoreAssets() {
    const builtIns = WORKSHOP_AUDIO_ASSETS
      .map(workshopAudioEditorAsset)
      .filter(asset => asset && editorAssetSupports(asset, 'span'));
    // One entry per recording. Where it is placed decides what it does.
    const personal = this.personalSwells.map(personalAudioEditorAsset).filter(Boolean);
    return [...builtIns, ...personal];
  }

  selectedAudioScoreAsset() {
    return this.audioScoreAssets().find(asset => asset.id === this.selectedAudioAssetId) || null;
  }

  scoreAuthoringLane() {
    if (this.scoreView === 'audio') return 'audio';
    if (this.scoreView === 'visual') return 'visual';
    return this.activeAssetLane === 'audio' ? 'audio' : 'visual';
  }

  renderSelectedAudioAsset() {
    const personal = this.selectedPersonalAudio();
    const asset = workshopAudioAsset(this.selectedAudioAssetId) || (personal ? {
      id: this.selectedAudioAssetId, kind: 'personal', value: personal.id, name: personal.name,
      icon: '★', description: 'Your own recording. Set it under the whole reading, or highlight a passage to layer it there.'
    } : null);
    if (!asset) {
      return '<p class="studio-inspector-empty">Choose audio from the Audio library.</p>';
    }
    const current = personal
      ? personalAudioIsWholeReading(this.sessionData, personal.id)
      : workshopAudioAssetIsCurrent(this.sessionData, asset);
    const playing = this.audioPreviewState.assetId === asset.id;
    return `<div class="studio-audio-selection">
      <div class="studio-audio-selection-title"><span aria-hidden="true">${asset.icon}</span>
        <div><span class="studio-kicker">Whole reading</span>
          <h3>${this.escapeHtml(asset.name)}</h3></div></div>
      <p class="input-note text-fog">${this.escapeHtml(asset.description)}</p>
      <div class="studio-selected-actions">
        <button type="button" class="btn-primary btn-compact" data-action="apply-audio-default"
                ${current ? 'disabled' : ''}>${current ? 'Sounds under the whole reading' : 'Set for whole reading'}</button>
        <button type="button" class="btn-secondary btn-compact" data-action="preview-audio-default"
                ${asset.value === 'silent' ? 'disabled' : ''}>${playing ? 'Restart preview' : 'Preview'}</button>
        <button type="button" class="btn-ghost btn-compact" data-action="stop-audio-preview"
                ${this.audioPreviewState.state === 'playing' ? '' : 'disabled'}>Stop</button>
      </div>
      <p class="studio-preview-status" aria-live="polite">${playing ? 'Previewing this atmosphere · stops automatically' : 'Preview is bounded and never changes the project.'}</p>
    </div>`;
  }

  refreshReadingStudio() {
    const setText = (selector, value) => {
      this.container.querySelectorAll(selector).forEach(node => { node.textContent = value; });
    };
    setText('[data-reading-summary]', `${this.sessionData.wpm} WPM · ${this.sessionData.chunkMode}`);
    setText('[data-reading-curve]', `${this.sessionData.curve} curve`);
    setText('[data-reading-inspector-summary]', `${this.sessionData.wpm} WPM`);
    setText('#wpm-value', `${this.sessionData.wpm} WPM`);
    setText('[data-reading-word-count]', `${this.readingWordCount()} words`);
    setText('[data-reading-duration]', this.readingDurationLabel());
    this.container.querySelectorAll('[data-curve]').forEach(button => {
      const active = button.dataset.curve === this.sessionData.curve;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.container.querySelectorAll('[data-chunk]').forEach(button => {
      const active = button.dataset.chunk === this.sessionData.chunkMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  refreshAudioStudio() {
    this.withFocusPreserved(() => {
      const registry = this.container.querySelector('#audio-assets-list');
      const selection = this.container.querySelector('#studio-audio-selection');
      if (registry) registry.innerHTML = this.renderAudioAssetRegistry();
      if (selection) selection.innerHTML = this.renderSelectedAudioAsset();
      this.container.querySelectorAll('[data-audio-summary]').forEach(node => {
        node.textContent = this.audioSummary();
      });
      this.container.querySelectorAll('[data-audio-bed]').forEach(node => {
        node.textContent = this.audioBedLabel();
      });
      this.container.querySelectorAll('[data-audio-entry]').forEach(node => {
        node.textContent = this.audioLayerLabel();
      });
    });
  }

  setAssetLane(lane) {
    this.activeAssetLane = lane === 'audio' ? 'audio' : 'visual';
    this.container.querySelectorAll('[data-asset-lane]').forEach(button => {
      const active = button.dataset.assetLane === this.activeAssetLane;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const visual = this.container.querySelector('#studio-visual-library-panel');
    const audio = this.container.querySelector('#studio-audio-library-panel');
    const addActions = this.container.querySelector('.studio-asset-add-actions');
    if (visual) visual.hidden = this.activeAssetLane !== 'visual';
    if (audio) audio.hidden = this.activeAssetLane !== 'audio';
    if (addActions) addActions.hidden = this.activeAssetLane !== 'visual';
    if (this.activeAssetLane === 'audio') void this.updatePersonalSwellList();
    if (this.scoreView === 'combined') this.updateVisualScoreEditor();
  }

  selectAudioAsset(assetId) {
    if (!workshopAudioAsset(assetId) && !audioScoreAssetFromId(assetId, this.personalSwells)) return false;
    this.selectedAudioAssetId = assetId;
    this.inspectorContext = normalizeInspectorContext({ kind: 'audioAsset', id: assetId });
    if (!(this.scoreView === 'combined' && (this.pendingScoreSelection || this.pendingScoreConflict))) {
      this.scoreView = 'audio';
    }
    this.setAssetLane('audio');
    this.refreshContextualInspector();
    this.refreshAudioStudio();
    this.updateVisualScoreEditor();
    return true;
  }

  applySelectedAudioDefault() {
    const personal = this.selectedPersonalAudio();
    const next = personal
      ? applyPersonalAudioAsWholeReading(personal.id)
      : applyWorkshopAudioAsset(this.sessionData, this.selectedAudioAssetId);
    Object.assign(this.sessionData, next);
    this.audioPreview.stop();
    this.markEditorDirty();
    this.refreshAudioStudio();
    // The wash across the scored text names the base layer, so the canvas has
    // to be redrawn by the act that changes it.
    this.updateVisualScoreEditor();
    this.updateSequencePicker();
    return true;
  }

  async previewSelectedAudioDefault(swellId = null) {
    const assetId = this.selectedAudioAssetId;
    if (!assetId) return false;
    const personal = this.selectedPersonalAudio();
    if (!personal && workshopAudioAsset(assetId)?.value === 'silent') return false;
    await this.audioPreview.play(assetId, { swellId: swellId || personal?.id || null });
    return true;
  }

  /* Legacy panel-stack markup was removed in Phase 4. The Studio shell is the
     only authoring surface; compatibility now lives at the project boundary. */
  openSourceBrowser() {
    this.sourceBrowser = new SourceBrowser({
      mode: 'text', // Workshop only needs text sources; visuals are handled separately
      providerIds: ['library-archive'],
      autoSelectProviderId: 'library-archive',
      onSelect: (item, provider) => {
        this.addSource(item, provider);
        if (this.studioViewport !== 'desktop') {
          this.setStudioSurface('score', { focus: false });
        }
        this.sourceBrowser?.close();
      },
      onClose: () => {
        this.sourceBrowser = null;
        requestAnimationFrame(() => {
          this.container.querySelector('#visual-score-text')?.focus({ preventScroll: true });
        });
      }
    });
  }

  /**
   * Simple toast notification
   */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  addSource(item, provider) {
    // Normalize array payloads (e.g. ArXiv search results returning multiple structured objects)
    let normalizedData = item.data;
    if (Array.isArray(item.data)) {
        normalizedData = item.data.map(d => {
            if (typeof d === 'string') return d;
            return d.content || d.data || JSON.stringify(d);
        }).join('\n\n--- ◈ SOURCE DIVIDER ◈ ---\n\n');
    }

    // Persist as pure string representation
    item.data = normalizedData;

    // LINE ENDINGS ARE NORMALISED HERE, AND ONLY HERE.
    //
    // A passage span is a pair of character offsets into this string, and the
    // offsets are measured by walking the rendered text. The HTML parser turns
    // CRLF and lone CR into LF, so a source that keeps its carriage returns is
    // one the editor and the text disagree about: a selection is stored short
    // by the number of CRs before it, the highlight lands somewhere the reader
    // did not choose, and overlap is then judged between ranges nobody
    // selected — which reads as "Replace overlap" clearing passages that do
    // not overlap. Pasted articles and downloaded .txt files carry CRLF as a
    // matter of course; the Archive's own payloads never do, which is why this
    // only ever bit imported text.
    if (typeof item.data === 'string') {
      item.data = item.data.replace(/\r\n?/gu, '\n');
    }

    // Count words in content
    let words = 0;
    if (typeof item.data === 'string') {
      words = item.data.split(/\s+/).filter(w => w.length > 0).length;
    }

    this.sessionData.sources.push({
      id: item.id,
      name: item.name,
      providerId: provider.id,
      type: item.type,
      words: words,
      data: item.data,
      metadata: item.metadata
    });
    if (!this.activeScoreSourceId) this.activeScoreSourceId = item.id;

    this.markEditorDirty();
    this.updateSourcesList();
    this.updateCreateButton();
    this.updateSequencePicker();
    console.log('[Workshop] Added source:', item.name);
  }

  renderSources() {
    return this.sessionData.sources.map((source, index) => {
      // Generate preview text (first 100 chars)
      const previewText = typeof source.data === 'string'
        ? source.data.substring(0, 100).replace(/\n/g, ' ').trim() + (source.data.length > 100 ? '...' : '')
        : '';

      const isFirst = index === 0;
      const isLast = index === this.sessionData.sources.length - 1;

      return `
        <div class="source-item card" data-source-index="${index + 1}">
          <div class="source-item-header">
            <button type="button" class="source-name text-light" data-action="inspect-source" data-source-id="${this.escapeHtml(String(source.id))}">${this.escapeHtml(source.name)}</button>
            <div class="source-actions-mini">
              <button type="button" class="btn-icon" data-action="preview-source" data-index="${index}" title="Preview content">
                ◎
              </button>
              <button type="button" class="btn-icon" data-action="move-up" data-index="${index}" ${isFirst ? 'disabled' : ''} title="Move up">
                ▲
              </button>
              <button type="button" class="btn-icon" data-action="move-down" data-index="${index}" ${isLast ? 'disabled' : ''} title="Move down">
                ▼
              </button>
              <button type="button" class="btn-icon" data-action="remove-source" data-index="${index}" title="Remove">
                ✕
              </button>
            </div>
          </div>
          <span class="source-meta">${source.words.toLocaleString()} words · ${source.providerId || 'local'}</span>
          ${previewText ? `<span class="source-preview">${this.escapeHtml(previewText)}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show source preview modal
   */
  showSourcePreview(index) {
    const source = this.sessionData.sources[index];
    if (!source) return;
    this.closeSourcePreview?.();
    const returnFocus = document.activeElement;

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'source-preview-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'source-preview-title');
    modal.innerHTML = `
      <div class="source-preview-content" tabindex="-1">
        <header class="source-preview-header">
          <h3 id="source-preview-title">${this.escapeHtml(source.name)}</h3>
          <button type="button" class="btn-icon source-preview-close" aria-label="Close source preview">✕</button>
        </header>
        <div class="source-preview-body">
          <pre class="source-preview-text">${this.escapeHtml(typeof source.data === 'string' ? source.data : JSON.stringify(source.data, null, 2))}</pre>
        </div>
        <footer class="source-preview-footer">
          <span class="text-fog">${source.words} words</span>
          <button type="button" class="btn-secondary source-preview-close">Close</button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('open'));

    // Close handlers
    let closed = false;
    const closeModal = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', escHandler);
      modal.classList.remove('open');
      setTimeout(() => {
        modal.remove();
        if (this.sourcePreviewModal === modal) {
          this.sourcePreviewModal = null;
          this.sourcePreviewEscapeHandler = null;
          this.closeSourcePreview = null;
        }
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      }, 200);
    };

    modal.querySelectorAll('.source-preview-close').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      } else if (e.key === 'Tab') {
        const focusable = [...modal.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    this.sourcePreviewModal = modal;
    this.sourcePreviewEscapeHandler = escHandler;
    this.closeSourcePreview = closeModal;
    document.addEventListener('keydown', escHandler);
    modal.querySelector('.source-preview-content')?.focus();
  }

  visualAssetEntries() {
    return buildWorkshopVisualAssetRegistry({
      projectAssets: this.sessionData.sequenceVisualAssets,
      globalAssets: MemoryCore.getGlobalImageAssets(),
      savedBlueprints: this.savedBlueprints.filter(item => item.id !== this.activeBlueprintId),
      visualConfig: this.sessionData.visualConfig
    });
  }

  visualCueForEntry(entry, assignment = null) {
    if (!entry?.asset?.cueTemplate) return null;
    const reference = this.scoreAssetReference(entry);
    const activeAssignment = assignment || this.sessionData.visualScoreAssignments
      .find(item => item.id === (this.selectedScoreAssignmentId || this.scoreConfirmationAssignmentId));
    if (activeAssignment?.assetId === reference && activeAssignment.cue) {
      return normalizeConfigurableVisualCue(activeAssignment.cue);
    }
    return this.visualAssetStyleDrafts.get(entry.asset.id)
      || normalizeConfigurableVisualCue(entry.asset.cueTemplate);
  }

  configuredVisualEntry(entry) {
    const cueTemplate = this.visualCueForEntry(entry);
    return cueTemplate ? { ...entry, asset: { ...entry.asset, cueTemplate } } : entry;
  }

  canAuthorIntentionalStillness() {
    return visualFallbackCueFromConfig(this.sessionData.visualConfig).kind !== 'still';
  }

  visualScoreReferenceCounts() {
    const counts = new Map();
    for (const assignment of this.sessionData.visualScoreAssignments) {
      counts.set(assignment.assetId, (counts.get(assignment.assetId) || 0) + 1);
      const personalFocalAssetId = personalFocalAssetIdFromCue(assignment.cue);
      if (personalFocalAssetId) {
        counts.set(personalFocalAssetId, (counts.get(personalFocalAssetId) || 0) + 1);
      }
    }
    return counts;
  }

  selectedVisualAssetEntry(entries = this.visualAssetEntries()) {
    return entries.find(entry => !entry.hidden && entry.asset.id === this.selectedEditorAssetId) || null;
  }

  scoreAssetReference(entry) {
    return projectAssetIdFromEditorAsset(entry.asset) || entry.asset.id;
  }

  editorAssetIdForScoreAsset(assetId) {
    const projectAsset = this.sessionData.sequenceVisualAssets.find(asset => asset.id === assetId);
    return projectAsset ? projectEditorAssetId(projectAsset) : assetId;
  }

  visualScoreAssets(entries = this.visualAssetEntries()) {
    return [
      ...this.sessionData.sequenceVisualAssets,
      ...entries
        .filter(entry => !entry.materialization && entry.asset.cueTemplate
          && editorAssetSupports(entry.asset, 'span')
          && entry.asset.kind !== 'sequence-image')
        .map(entry => entry.asset)
    ];
  }

  async resolveCollectionPreview(collectionRef, { signal } = {}) {
    if (collectionRef === 'global-pool') {
      const image = MemoryCore.getGlobalImageAssets().find(item => safeUrl(item?.uri));
      return image ? { url: image.uri, alt: image.name || 'Personal library sample' } : null;
    }
    if (!collectionRef?.startsWith('aic-')) return null;
    const { MuseumProvider } = await import('../sources/visual/museum.js');
    if (signal?.aborted) return null;
    this.museumPreviewProvider ||= new MuseumProvider();
    const images = await this.museumPreviewProvider.getImagesInCategory(
      collectionRef.slice('aic-'.length),
      1,
      { signal, timeoutMs: 5000 }
    );
    const image = images.find(item => safeUrl(item?.url));
    return image ? { url: image.url, alt: image.title || 'Collection sample' } : null;
  }

  ensureCollectionPreview(entry) {
    const preview = entry?.asset?.editor?.preview;
    if (preview?.kind !== 'sample') return Promise.resolve(null);
    const current = this.collectionPreviewCache.get(preview.ref);
    if (current?.status === 'ready' || current?.status === 'unavailable') {
      return Promise.resolve(current.value || null);
    }
    if (current?.promise) return current.promise;

    const state = { status: 'loading', value: null, promise: null };
    const promise = Promise.resolve(this.collectionPreviewResolver(preview.ref, {
      signal: this.collectionPreviewAbortController.signal
    })).then(value => {
      const url = safeUrl(value?.url);
      state.status = url ? 'ready' : 'unavailable';
      state.value = url ? { url, alt: value?.alt || entry.asset.name } : null;
      return state.value;
    }).catch(error => {
      if (error?.name === 'AbortError') return null;
      console.warn(`[Workshop] Collection preview unavailable for ${preview.ref}:`, error);
      state.status = 'unavailable';
      return null;
    }).finally(() => {
      state.promise = null;
      if (this.container.isConnected) this.refreshVisualLibraryAndInspector();
    });
    state.promise = promise;
    this.collectionPreviewCache.set(preview.ref, state);
    if (this.container.isConnected) this.refreshVisualLibraryAndInspector();
    return promise;
  }

  visualSurface() {
    const mode = this.sessionData.visualConfig?.visualMode;
    if (mode === 'focals') return 'focal';
    if (mode === 'interlocution') return 'scored';
    return ['off', 'attractor', 'genesis'].includes(mode) ? mode : 'off';
  }

  isVisualAssetDefault(entry) {
    const asset = entry.asset;
    const config = this.sessionData.visualConfig || {};
    if (asset.kind === 'project-surface') {
      return asset.provenance.surface === this.visualSurface();
    }
    if (asset.kind === 'sequence-image' && asset.provenance.projectOwned === true) {
      return config.visualMode === 'focals'
        && config.focals?.type === 'personal'
        && config.focals?.personalAssetId === asset.provenance.projectAssetId;
    }
    if (config.visualMode !== 'interlocution') return false;
    if (asset.kind === 'procedural') {
      return config.interlocution?.procedural?.includes(asset.cueTemplate.collections[0]) === true;
    }
    if (asset.kind === 'sourced-collection') {
      return config.interlocution?.sourced?.includes(asset.cueTemplate.collections[0]) === true;
    }
    return false;
  }

  renderVisualAssetFilters(entries = this.visualAssetEntries()) {
    const visibleEntries = entries.filter(entry => !entry.hidden);
    const groups = [
      ['all', 'All'], ['project', 'Project'], ['collections', 'Collections'],
      ['procedural', 'Procedural'], ['shared', 'Shared'], ['fields', 'Fields']
    ];
    return groups.map(([id, label]) => {
      const count = id === 'all' ? visibleEntries.length
        : visibleEntries.filter(entry => entry.group === id).length;
      return `<button type="button" class="studio-asset-filter ${this.visualAssetGroup === id ? 'active' : ''}"
          data-action="filter-visual-assets" data-asset-group="${id}"
          aria-pressed="${this.visualAssetGroup === id}">${label}<span>${count}</span></button>`;
    }).join('');
  }

  renderEditorAssetPreview(entry, { alt = '', selected = false } = {}) {
    const asset = entry.asset;
    const preview = asset.editor.preview;
    if (preview.kind === 'image') {
      return `<img src="${safeUrl(preview.ref)}" alt="${this.escapeHtml(alt)}" loading="lazy" ${REMOTE_IMAGE_ATTRS} />`;
    }
    if (preview.kind === 'video') {
      return `<video src="${safeUrl(preview.ref)}" aria-label="${this.escapeHtml(alt)}"
        muted playsinline preload="metadata"></video>`;
    }
    const sample = preview.kind === 'sample'
      ? this.collectionPreviewCache.get(preview.ref)
      : null;
    if (sample?.status === 'ready' && sample.value?.url) {
      return `<img src="${sample.value.url}" alt="${this.escapeHtml(sample.value.alt || alt)}" ${REMOTE_IMAGE_ATTRS}
        data-preview-ref="${this.escapeHtml(preview.ref)}" data-preview-status="ready" loading="lazy" />`;
    }
    const style = entry.previewStyle ? ` style="background:${entry.previewStyle}"` : '';
    const status = sample?.status || 'representative';
    return `<span class="studio-preview-render is-${preview.kind}" data-preview-ref="${this.escapeHtml(preview.ref)}"
      data-preview-status="${status}"${style}>
      <span aria-hidden="true">${this.escapeHtml(entry.symbol || asset.name.slice(0, 1))}</span>
      ${selected ? `<small>${preview.kind === 'generator' ? 'Generator'
        : status === 'loading' ? 'Loading sample'
          : status === 'unavailable' ? 'Sample unavailable' : 'Collection sample'}</small>` : ''}
    </span>`;
  }

  renderVisualAssetRegistry(entries = this.visualAssetEntries()) {
    const query = this.visualAssetSearch.trim().toLowerCase();
    const visible = entries.filter(entry => {
      if (entry.hidden) return false;
      if (this.visualAssetGroup !== 'all' && entry.group !== this.visualAssetGroup) return false;
      const searchText = [entry.asset.name, entry.asset.kind, entry.group,
        entry.asset.provenance.provider].filter(Boolean).join(' ').toLowerCase();
      return !query || searchText.includes(query);
    });
    if (!visible.length) {
      return `<div class="studio-asset-empty">
        <span aria-hidden="true">◇</span>
        <p>No visual assets match this view.</p>
        <button type="button" class="btn-secondary btn-compact" data-action="clear-asset-filters">Show all</button>
      </div>`;
    }
    const referencesByAsset = this.visualScoreReferenceCounts();
    return visible.map((entry, index) => {
      const asset = entry.asset;
      const selected = asset.id === this.selectedEditorAssetId;
      const defaulted = this.isVisualAssetDefault(entry);
      const projectAssetId = projectAssetIdFromEditorAsset(asset);
      const scoreReference = this.scoreAssetReference(entry);
      const references = editorAssetSupports(asset, 'span')
        ? referencesByAsset.get(scoreReference) || 0
        : 0;
      const capability = asset.capability === 'span' ? 'Passage visual'
        : asset.capability === 'default' ? 'Whole-reading visual' : 'Passage + whole reading';
      const image = asset.editor.preview.kind === 'image' || asset.editor.preview.kind === 'video';
      const globalId = entry.materialization?.originId?.startsWith('global:')
        ? entry.materialization.originId.slice('global:'.length)
        : null;
      const projectIndex = projectAssetId
        ? this.sessionData.sequenceVisualAssets.findIndex(item => item.id === projectAssetId)
        : -1;
      const styleSummary = visualCueStyleSummary(this.visualCueForEntry(entry));
      return `<article class="studio-asset-card ${selected ? 'selected' : ''} ${defaulted ? 'is-default' : ''}"
          style="--asset-color:${asset.editor.color}">
        <button type="button" class="studio-asset-card-main" data-action="select-editor-asset"
                data-editor-asset-id="${this.escapeHtml(asset.id)}" role="option"
                aria-selected="${selected}" tabindex="${selected || (!this.selectedEditorAssetId && index === 0) ? '0' : '-1'}"
                data-focus-key="visual-asset:${this.escapeHtml(asset.id)}"
                aria-label="${this.escapeHtml(`${asset.name}, ${asset.kind.replaceAll('-', ' ')}, ${capability}${defaulted ? ', active default' : ''}${references ? `, ${references} clips` : ''}`)}">
          <span class="studio-asset-preview ${image ? 'is-image' : `is-${asset.editor.preview.kind}`}">
            ${this.renderEditorAssetPreview(entry)}
          </span>
          <span class="studio-asset-copy">
            <strong>${this.escapeHtml(asset.name)}</strong>
            <small>${this.escapeHtml(styleSummary || asset.kind.replaceAll('-', ' '))}</small>
          </span>
          <span class="studio-asset-badges">
            <span>${capability}</span>
            ${defaulted ? '<span class="is-active">Active</span>' : ''}
            ${references ? `<span>${references} clip${references === 1 ? '' : 's'}</span>` : ''}
          </span>
        </button>
        ${globalId ? `<button type="button" class="studio-asset-remove" data-action="remove-global"
            data-global-id="${this.escapeHtml(globalId)}" aria-label="Remove ${this.escapeHtml(asset.name)} from shared images">×</button>` : ''}
        ${projectIndex >= 0 ? `<button type="button" class="studio-asset-remove" data-action="remove-visual"
            data-index="${projectIndex}" aria-label="Remove ${this.escapeHtml(asset.name)} from this project">×</button>` : ''}
      </article>`;
    }).join('');
  }

  renderSelectedVisualAsset(entry) {
    if (!entry) {
      return `<div class="studio-inspector-empty">
        <span aria-hidden="true">◇</span>
        <p>Choose an asset to inspect its preview, capabilities, and available actions.</p>
      </div>`;
    }
    const asset = entry.asset;
    const image = asset.editor.preview.kind === 'image' || asset.editor.preview.kind === 'video';
    const capability = asset.capability === 'span' ? 'Passage visual'
      : asset.capability === 'default' ? 'Whole-reading visual' : 'Passage and whole-reading visual';
    const assignment = this.sessionData.visualScoreAssignments
      .find(item => item.id === this.selectedScoreAssignmentId);
    const scoreReference = this.scoreAssetReference(entry);
    const choosingPersonalFocal = entry.asset.id === 'surface:focal'
      && this.personalFocalChooser?.assetId === entry.asset.id;
    const actions = [];
    if (entry.materialization) {
      actions.push(`<button type="button" class="btn-primary btn-compact" data-action="materialize-editor-asset"
          data-editor-asset-id="${this.escapeHtml(asset.id)}">Copy to project & use</button>`);
    } else if (editorAssetSupports(asset, 'span')) {
      if (assignment && assignment.assetId !== scoreReference) {
        actions.push(`<button type="button" class="btn-primary btn-compact" data-action="replace-score-asset"
          data-assignment-id="${this.escapeHtml(assignment.id)}">Apply to selected clip</button>`);
      } else if (assignment) {
        actions.push('<p class="studio-asset-ready"><span></span>Current clip asset</p>');
      } else {
        actions.push('<p class="studio-asset-ready"><span></span>Ready for a selected passage</p>');
      }
    }
    if (!entry.materialization && editorAssetSupports(asset, 'default') && !choosingPersonalFocal) {
      actions.push(`<button type="button" class="btn-secondary btn-compact" data-action="set-editor-asset-default"
          data-editor-asset-id="${this.escapeHtml(asset.id)}"
          ${this.isVisualAssetDefault(entry) ? 'disabled' : ''}>${this.isVisualAssetDefault(entry) ? 'Used for whole reading' : 'Use for whole reading'}</button>`);
    }
    return `<div class="studio-selected-asset" style="--asset-color:${asset.editor.color}">
      <div class="studio-selected-preview ${image ? 'is-image' : ''}">
        ${this.renderEditorAssetPreview(entry, { alt: asset.name, selected: true })}
      </div>
      <div><span class="studio-kicker">${this.escapeHtml(asset.kind.replaceAll('-', ' '))}</span>
        <h3>${this.escapeHtml(asset.name)}</h3></div>
      <p class="input-note text-fog">${capability} · ${this.escapeHtml(asset.provenance.provider || 'Project asset')}</p>
      ${this.renderVisualStyleControls(entry)}
      <div class="studio-selected-actions">${actions.join('')}</div>
    </div>`;
  }

  renderVisualSurfaceControls() {
    const config = this.sessionData.visualConfig;
    const surface = this.visualSurface();
    const interlocution = config.interlocution || {};
    let controls = '';
    if (surface === 'focal') {
      const personal = this.sessionData.visualConfig?.focals?.type === 'personal'
        || this.personalFocalChooser?.target === 'whole-reading';
      controls = `<label class="input-label" for="studio-focal-glyph">Focal form</label>
        <select class="input-select" id="studio-focal-glyph" data-visual-setting="focal-glyph">
          ${FOCAL_GLYPHS.map(item => `<option value="${item.id}" ${!personal && config.focals?.standardGlyph === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
          <option value="personal" ${personal ? 'selected' : ''}>Personal image</option>
        </select>
        ${!personal && config.focals?.standardGlyph === 'rose' ? `<label class="input-label" for="studio-focal-rose-mode">Rose rendering</label>
          <select class="input-select" id="studio-focal-rose-mode" data-visual-setting="focal-rose-mode">
            ${ROSE_MODES.map(item => `<option value="${item.id}" ${(config.focals?.roseMode || 'vitrum') === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
          </select>` : ''}
        ${personal ? this.renderPersonalFocalPicker({ target: 'whole-reading' }) : ''}`;
    } else if (surface === 'attractor') {
      controls = `<label class="input-label" for="studio-attractor-system">System</label>
        <select class="input-select" id="studio-attractor-system" data-visual-setting="attractor-system">
          ${ATTRACTOR_SYSTEMS.map(item => `<option value="${item.id}" ${config.attractor?.system === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
        <label class="input-label" for="studio-attractor-palette">Filament</label>
        <select class="input-select" id="studio-attractor-palette" data-visual-setting="attractor-palette">
          ${ATTRACTOR_PALETTES.map(item => `<option value="${item.id}" ${config.attractor?.palette === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
        <label class="input-label" for="studio-attractor-form">Form</label>
        <select class="input-select" id="studio-attractor-form" data-visual-setting="attractor-form">
          ${ATTRACTOR_FORMS.map(id => `<option value="${id}" ${(config.attractor?.form || 'mirror') === id ? 'selected' : ''}>${id[0].toUpperCase()}${id.slice(1)}</option>`).join('')}
        </select>`;
    } else if (surface === 'genesis') {
      controls = `<label class="input-label" for="studio-genesis-preset">Climate</label>
        <select class="input-select" id="studio-genesis-preset" data-visual-setting="genesis-preset">
          ${KLEE_PRESETS.map(item => `<option value="${item.id}" ${config.genesis?.preset === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
        <label class="studio-toggle"><input type="checkbox" data-visual-setting="genesis-glass" ${config.genesis?.glass !== false ? 'checked' : ''} /> Glass behind text</label>`;
    } else if (surface === 'scored') {
      // GALLERY LEADS AND GALLERY IS THE DEFAULT, matching the reader's
      // Visual panel. The Workshop had kept Gallery last and fallen back
      // to full-frame when a composition named no surface — so an author
      // starting a piece was handed the one surface that cuts to black,
      // while a reader who expressed no preference was handed the one
      // that never does. The same choice should not have two answers
      // depending on which room you are standing in.
      // Persisted ids remain stable; labels state the visual relationship to
      // the reading instead of exposing runtime vocabulary.
      const presentations = [
        ['continuous', 'Gallery'],
        ['behind-stream', 'Background Flash'],
        ['full-frame', 'Foreground Flash']
      ];
      controls = `<label class="input-label">Presentation</label>
        <div class="studio-surface-options studio-presentation-options">${presentations.map(([id, label]) => `<button type="button"
          class="btn-secondary btn-compact ${interlocution.presentation === id || (!interlocution.presentation && id === 'continuous') ? 'active' : ''}"
          data-action="set-scored-presentation" data-presentation="${id}"
          aria-pressed="${interlocution.presentation === id || (!interlocution.presentation && id === 'continuous')}">${label}</button>`).join('')}</div>
        ${isContinuousPresentation(interlocution.presentation) ? `
          <label class="input-label" for="studio-gallery-cadence">Gallery cadence</label>
          <div class="studio-cadence-control">
            <input type="range" class="slider" id="studio-gallery-cadence" data-visual-setting="gallery-cadence"
                   min="0" max="1" step="0.05" value="${interlocution.galleryCadence ?? GALLERY_CADENCE_DEFAULT}"
                   aria-valuetext="${this.escapeHtml(galleryCadenceValueText(interlocution.galleryCadence ?? GALLERY_CADENCE_DEFAULT))}" />
            <strong data-gallery-cadence-value>${formatGalleryCadence(interlocution.galleryCadence ?? GALLERY_CADENCE_DEFAULT)}</strong>
            <div class="studio-cadence-scale" aria-hidden="true"><span>Contemplative · 30 s</span><span>Lively · 8 s</span></div>
          </div>`
          : `<label class="input-label" for="studio-visual-frequency">Frequency · ${Math.round((interlocution.frequency ?? 0.3) * 100)}%</label>
          <input type="range" class="slider" id="studio-visual-frequency" data-visual-setting="visual-frequency"
                 min="0.05" max="1" step="0.05" value="${interlocution.frequency ?? 0.3}" />
          <label class="input-label" for="studio-visual-presence">Presence</label>
          <select class="input-select" id="studio-visual-presence" data-visual-setting="visual-presence">
            ${[150, 200, 300, 450, 700, 1000, 1400, 2000].map(ms => `<option value="${ms}" ${Number(interlocution.duration) === ms ? 'selected' : ''}>${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</option>`).join('')}
          </select>`}
        <label class="studio-toggle"><input type="checkbox" data-visual-setting="responsive" ${interlocution.responsive ? 'checked' : ''} /> Respond to the reading</label>`;
    } else {
      controls = '<p class="input-note text-fog">The reading remains text-only. Authored clips are preserved but inactive.</p>';
    }
    const surfaces = [['off', 'Off'], ['focal', 'Focal'], ['attractor', 'Attractor'], ['genesis', 'Genesis'], ['scored', 'Scored']];
    return `<div class="studio-surface-options studio-reading-surface-options">${surfaces.map(([id, label]) => `<button type="button"
        class="btn-secondary btn-compact ${surface === id ? 'active' : ''}" data-action="set-visual-surface"
        data-visual-surface="${id}" aria-pressed="${surface === id}">${label}</button>`).join('')}</div>
      <div class="studio-surface-config">${controls}</div>`;
  }

  renderVisualPresentationPanel() {
    const inactiveClips = this.visualSurface() !== 'scored' && this.sessionData.visualScoreAssignments.length;
    return `<details class="studio-library-presentation" open>
      <summary><span><span class="studio-kicker">Sequence default</span><strong>Presentation</strong></span>
        <span class="text-capitalize">${this.visualSurface()}</span></summary>
      <div class="studio-library-presentation-body">
        ${inactiveClips ? `<p class="studio-visual-warning">${this.sessionData.visualScoreAssignments.length} visual clip${this.sessionData.visualScoreAssignments.length === 1 ? '' : 's'} preserved · inactive on this surface</p>` : ''}
        ${this.renderVisualSurfaceControls()}
      </div>
    </details>`;
  }

  renderVisualInspector(entries = this.visualAssetEntries()) {
    const selected = this.selectedVisualAssetEntry(entries);
    const selectedLabel = selected?.asset?.name || 'None';
    return `<details class="studio-inspector-section studio-visual-inspector" id="studio-visual-inspector" open>
      <summary><span>Selected visual</span><span>${this.escapeHtml(selectedLabel)}</span></summary>
      <div class="studio-inspector-body">
        ${this.renderSelectedVisualAsset(selected)}
      </div>
    </details>`;
  }

  refreshVisualLibraryAndInspector() {
    this.withFocusPreserved(() => {
      const entries = this.visualAssetEntries();
      const filters = this.container.querySelector('.studio-asset-filters');
      const registry = this.container.querySelector('#visual-assets-list');
      const presentation = this.container.querySelector('#studio-visual-presentation');
      if (filters) filters.innerHTML = this.renderVisualAssetFilters(entries);
      if (registry) registry.innerHTML = this.renderVisualAssetRegistry(entries);
      if (presentation) presentation.innerHTML = this.renderVisualPresentationPanel();
      this.refreshContextualInspector();
    });
  }

  /**
   * `navigate: false` for the picker inside the passage popover. Choosing what
   * to assign is not a request to change tab, and in the Combined view it moved
   * the reader to Visual mid-selection.
   */
  selectEditorAsset(assetId, { navigate = true } = {}) {
    const entry = this.visualAssetEntries().find(item => item.asset.id === assetId);
    if (!entry) return false;
    this.selectedEditorAssetId = entry.asset.id;
    this.inspectorContext = normalizeInspectorContext({ kind: 'visualAsset', id: entry.asset.id });
    if (navigate && !(this.scoreView === 'combined' && (this.pendingScoreSelection || this.pendingScoreConflict))) {
      this.scoreView = 'visual';
    }
    if (!entry.materialization && editorAssetSupports(entry.asset, 'span')) {
      this.selectedScoreAssetId = this.scoreAssetReference(entry);
      this.updateVisualScoreEditor();
    }
    this.refreshVisualLibraryAndInspector();
    this.refreshSelectionActionBar();
    if (this._active && entry.asset.editor.preview.kind === 'sample') {
      void this.ensureCollectionPreview(entry);
    }
    return true;
  }

  /**
   * Copy a shared image into this project so a passage can name it.
   *
   * THE SOURCE MAY BE A BLOB, NOT ONLY A DATA URI. A shared entry is either a
   * global-pool image (inline `data:`) or an image belonging to another saved
   * sequence — and a saved sequence keeps its media in IndexedDB, so its uri
   * hydrates as `blob:`. Accepting only `data:` meant the one route back for
   * a durable image refused it, which is how a reader's own pictures could sit
   * in the panel unusable: re-scoped as shared the moment `activeBlueprintId`
   * stopped matching, then declined by the very control offered to fix that.
   */
  async materializeEditorAsset(assetId) {
    const entry = this.visualAssetEntries().find(item => item.asset.id === assetId);
    if (!entry?.materialization) return false;
    const uri = entry.materialization.uri;
    const originAssetId = entry.asset.provenance?.projectAssetId || null;
    let blob = null;
    try {
      if (typeof uri === 'string' && uri.startsWith('data:image/')) {
        blob = dataImageUriToBlob(uri);
      } else if (originAssetId) {
        // The durable copy, read straight from the store that owns it.
        const record = await WorkshopMedia.get(originAssetId);
        blob = record?.data instanceof Blob ? record.data : null;
      }
      if (!blob && typeof uri === 'string' && uri.startsWith('blob:')) {
        const response = await fetch(uri);
        blob = await response.blob();
      }
    } catch {
      blob = null;
    }
    if (!(blob instanceof Blob) || !String(blob.type || '').startsWith('image/')) {
      this.showToast('Shared image could not be copied into this project');
      return false;
    }
    const asset = this.addSequenceVisualAssetFromBlob(
      blob,
      entry.materialization.name || entry.asset.name,
      {
        origin: entry.asset.provenance.origin || 'shared-registry',
        snapshotOf: entry.materialization.originId,
        provider: entry.asset.provenance.provider || 'Personal Library'
      }
    );
    if (!asset) return false;
    this.selectedEditorAssetId = `project-image:${asset.id}`;
    this.updateVisualAssetsList();
    this.showToast(`${asset.name} copied into this project`);
    return true;
  }

  async setEditorAssetDefault(assetId) {
    const entry = this.visualAssetEntries().find(item => item.asset.id === assetId);
    if (!entry || entry.asset.capability === 'span') return false;
    const configuredEntry = this.configuredVisualEntry(entry);
    const next = applyEditorAssetDefault(this.sessionData.visualConfig, configuredEntry);
    const configuredCue = configuredEntry.asset.cueTemplate;
    if (configuredCue?.kind === 'field') {
      if (configuredCue.renderer === 'focal') next.focals = { ...configuredCue.config };
      if (configuredCue.renderer === 'attractor') next.attractor = { ...configuredCue.config };
      if (configuredCue.renderer === 'genesis') next.genesis = { ...configuredCue.config };
    }
    if (next.visualMode === 'interlocution') {
      const accepted = await requestVisualInterlocutionConsent(this.visualConsentScope);
      if (!accepted) return false;
    }
    this.sessionData.visualConfig = next;
    this.scoredActivationUndo = null;
    this.container.querySelector('.visual-score-activation-notice')?.remove();
    this.selectedEditorAssetId = entry.asset.id;
    this.markEditorDirty();
    this.refreshVisualLibraryAndInspector();
    this.updateSequencePicker();
    return true;
  }

  async applyPersonalFocalAsset(assetId, target = this.inferPersonalFocalTarget()) {
    const asset = this.sessionData.sequenceVisualAssets
      .find(item => item.id === assetId && item.kind !== 'video');
    if (!asset) return false;
    const boundedTarget = ['passage', 'clip', 'whole-reading'].includes(target)
      ? target
      : this.inferPersonalFocalTarget();
    this.personalFocalChooser = null;
    const focalCue = normalizeConfigurableVisualCue({
      kind: 'field', renderer: 'focal',
      config: { type: 'personal', personalAssetId: asset.id }
    });
    this.visualAssetStyleDrafts.set('surface:focal', focalCue);
    this.selectedScoreAssetId = 'surface:focal';
    this.selectedEditorAssetId = 'surface:focal';

    if (boundedTarget === 'whole-reading') {
      this.sessionData.visualConfig = {
        ...(this.sessionData.visualConfig || {}),
        visualMode: 'focals',
        focals: {
          type: 'personal', personalAssetId: asset.id, personalImage: asset.uri
        }
      };
      this.scoredActivationUndo = null;
      this.container.querySelector('.visual-score-activation-notice')?.remove();
      this.markEditorDirty();
      this.refreshVisualLibraryAndInspector();
      this.updateSequencePicker();
      this.announce(`${asset.name} is now the whole-reading focal.`);
      return true;
    }

    if (boundedTarget === 'clip') {
      const assignmentId = this.selectedScoreAssignmentId || this.scoreConfirmationAssignmentId;
      const replaced = this.replaceScoreAssignmentAsset(assignmentId, 'surface:focal', focalCue);
      if (replaced) this.announce(`${asset.name} replaced the selected passage focal.`);
      return replaced;
    }

    this.inspectorContext = normalizeInspectorContext({
      kind: 'visualAsset', id: 'surface:focal'
    });
    this.refreshVisualLibraryAndInspector();
    this.refreshScoreSelectionUi();
    this.updateVisualScoreEditor();
    this.announce(`${asset.name} is ready to assign to the selected passage.`);
    return true;
  }

  removePersonalFocalDefault() {
    const config = this.sessionData.visualConfig || {};
    if (config.focals?.type !== 'personal' && !config.focals?.personalAssetId) return false;
    this.sessionData.visualConfig = {
      ...config,
      visualMode: 'focals',
      focals: {
        ...(config.focals || {}),
        type: 'standard',
        standardGlyph: config.focals?.standardGlyph || 'breath',
        personalAssetId: null,
        personalImage: null
      }
    };
    this.personalFocalChooser = null;
    this.visualAssetStyleDrafts.set('surface:focal', normalizeConfigurableVisualCue({
      kind: 'field', renderer: 'focal',
      config: { type: 'standard', standardGlyph: config.focals?.standardGlyph || 'breath' }
    }));
    this.selectedEditorAssetId = 'surface:focal';
    this.markEditorDirty();
    this.refreshVisualLibraryAndInspector();
    this.updateSequencePicker();
    this.announce('Personal focal removed. The reading now uses the standard focal.');
    return true;
  }

  async setVisualSurface(surface) {
    if (surface === 'scored') {
      const accepted = await requestVisualInterlocutionConsent(this.visualConsentScope);
      if (!accepted) return false;
      this.activateScoredVisualSurface();
      this.scoredActivationUndo = null;
      this.markEditorDirty();
      this.refreshVisualLibraryAndInspector();
      this.updateSequencePicker();
      return true;
    }
    const assetId = `surface:${surface}`;
    return this.setEditorAssetDefault(assetId);
  }

  updateVisualSetting(setting, value, checked = false) {
    const config = this.sessionData.visualConfig;
    if (setting === 'focal-glyph') {
      config.focals = {
        ...(config.focals || {}), type: 'standard', standardGlyph: value,
        personalAssetId: null, personalImage: null
      };
      this.personalFocalChooser = null;
    } else if (setting === 'focal-rose-mode') {
      config.focals = { ...(config.focals || {}), roseMode: value };
    } else if (setting === 'attractor-system') {
      config.attractor = { ...(config.attractor || {}), system: value };
    } else if (setting === 'attractor-palette') {
      config.attractor = { ...(config.attractor || {}), palette: value };
    } else if (setting === 'attractor-form') {
      config.attractor = { ...(config.attractor || {}), form: value };
    } else if (setting === 'genesis-preset') {
      config.genesis = { ...(config.genesis || {}), preset: value };
    } else if (setting === 'genesis-glass') {
      config.genesis = { ...(config.genesis || {}), glass: checked };
    } else if (setting === 'visual-presence') {
      config.interlocution = { ...(config.interlocution || {}), duration: Number(value) };
    } else if (setting === 'visual-frequency') {
      config.interlocution = { ...(config.interlocution || {}), frequency: Number(value) };
    } else if (setting === 'gallery-cadence') {
      config.interlocution = { ...(config.interlocution || {}), galleryCadence: Number(value) };
    } else if (setting === 'responsive') {
      config.interlocution = { ...(config.interlocution || {}), responsive: checked };
    } else {
      return false;
    }
    this.markEditorDirty();
    this.updateSequencePicker();
    return true;
  }

  scoreSources(data = this.sessionData) {
    return (data.sources || []).map(source => ({
      id: String(source.id),
      name: source.name || 'Untitled source',
      text: typeof source.data === 'string' ? source.data : ''
    }));
  }

  activeScoreSource() {
    const sources = this.scoreSources();
    return sources.find(source => source.id === this.activeScoreSourceId) || sources[0] || null;
  }

  scoreAsset(assetId, assignment = null) {
    const editorAssetId = this.editorAssetIdForScoreAsset(assetId);
    const entry = this.visualAssetEntries().find(item => item.asset.id === editorAssetId);
    if (!entry) return null;
    let resolvedEntry = entry;
    let asset = entry.asset;
    const personalFocalAssetId = personalFocalAssetIdFromCue(
      assignment?.cue || this.visualCueForEntry(entry, assignment));
    const personalFocal = personalFocalAssetId
      ? this.sessionData.sequenceVisualAssets.find(item =>
        item.id === personalFocalAssetId && item.kind !== 'video')
      : null;
    if (personalFocal?.uri) {
      asset = {
        ...asset,
        name: `Focal · ${personalFocal.name}`,
        editor: { ...asset.editor, preview: { kind: 'image', ref: personalFocal.uri } }
      };
      resolvedEntry = { ...entry, asset };
    }
    return {
      id: assetId,
      editorAssetId,
      name: asset.name,
      color: asset.editor.color,
      preview: asset.editor.preview,
      uri: ['image', 'video'].includes(asset.editor.preview.kind) ? asset.editor.preview.ref : null,
      entry: resolvedEntry
    };
  }

  scoreAssetLookup(entries = this.visualAssetEntries()) {
    const lookup = new Map();
    for (const entry of entries) {
      if (entry.materialization || !editorAssetSupports(entry.asset, 'span')) continue;
      const assetId = this.scoreAssetReference(entry);
      const asset = entry.asset;
      lookup.set(assetId, {
        id: assetId,
        editorAssetId: asset.id,
        name: asset.name,
        color: asset.editor.color,
        preview: asset.editor.preview,
        uri: ['image', 'video'].includes(asset.editor.preview.kind) ? asset.editor.preview.ref : null,
        entry
      });
    }
    return lookup;
  }

  addSequenceVisualAssetFromBlob(blob, name = 'Sequence image', provenance = null) {
    if (!(blob instanceof Blob) || !String(blob.type || '').startsWith('image/')) {
      this.showToast('Sequence images must be image files');
      return null;
    }
    if (blob.size <= 0 || blob.size > MAX_IMAGE_FILE_BYTES) {
      this.showToast('Images must be 8 MB or smaller');
      return null;
    }
    if (this.sessionData.sequenceVisualAssets.length >= MAX_CUSTOM_VISUALS) {
      this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
      return null;
    }
    const id = `asset-${crypto.randomUUID()}`;
    const objectUrl = URL.createObjectURL(blob);
    this.localObjectUrls.add(objectUrl);
    const asset = createSequenceVisualAsset({
      id,
      name,
      provenance,
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: blob.type,
      byteLength: blob.size,
      uri: objectUrl,
      color: VISUAL_SCORE_COLORS[
        this.sessionData.sequenceVisualAssets.length % VISUAL_SCORE_COLORS.length
      ]
    });
    this.pendingMediaBlobs.set(id, blob);
    this.sessionData.sequenceVisualAssets.push(asset);
    this.sessionData.customVisuals = this.sessionData.sequenceVisualAssets
      .filter(item => item.kind !== 'video')
      .map(item => item.uri)
      .filter(Boolean);
    this.selectedScoreAssetId = asset.id;
    this.selectedEditorAssetId = `project-image:${asset.id}`;
    this.markEditorDirty();
    return asset;
  }

  addSequenceVideoAssetFromBlob(blob, name, durationMs, provenance = null) {
    if (!(blob instanceof Blob) || String(blob.type || '') !== 'video/mp4') {
      this.showToast('Sequence video must be an MP4 file');
      return null;
    }
    if (blob.size <= 0 || blob.size > MAX_VIDEO_FILE_BYTES) {
      this.showToast('MP4 files must be 96 MB or smaller');
      return null;
    }
    if (this.sessionData.sequenceVisualAssets.length >= MAX_CUSTOM_VISUALS) {
      this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
      return null;
    }
    const id = `asset-${crypto.randomUUID()}`;
    const objectUrl = URL.createObjectURL(blob);
    this.localObjectUrls.add(objectUrl);
    const asset = createSequenceVisualAsset({
      id, kind: 'video', name: name || 'Sequence video', provenance,
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: 'video/mp4', byteLength: blob.size, durationMs,
      audioPolicy: 'muted', timeMode: 'loop', uri: objectUrl,
      color: VISUAL_SCORE_COLORS[
        this.sessionData.sequenceVisualAssets.length % VISUAL_SCORE_COLORS.length
      ]
    });
    this.pendingMediaBlobs.set(id, blob);
    this.sessionData.sequenceVisualAssets.push(asset);
    this.selectedScoreAssetId = asset.id;
    this.selectedEditorAssetId = projectEditorAssetId(asset);
    this.markEditorDirty();
    return asset;
  }

  /** @deprecated Prefer addSequenceVisualAssetFromBlob for new uploads. */
  addSequenceVisualAsset(uri, name = 'Sequence image', provenance = null) {
    if (typeof uri === 'string' && uri.startsWith('data:image/')) {
      try {
        return this.addSequenceVisualAssetFromBlob(dataImageUriToBlob(uri), name, provenance);
      } catch {
        this.showToast('Could not read image data');
        return null;
      }
    }
    if (this.sessionData.sequenceVisualAssets.length >= MAX_CUSTOM_VISUALS) {
      this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
      return null;
    }
    const asset = createSequenceVisualAsset({
      id: `asset-${crypto.randomUUID()}`,
      uri,
      name,
      provenance,
      color: VISUAL_SCORE_COLORS[
        this.sessionData.sequenceVisualAssets.length % VISUAL_SCORE_COLORS.length
      ]
    });
    this.sessionData.sequenceVisualAssets.push(asset);
    this.sessionData.customVisuals = this.sessionData.sequenceVisualAssets
      .filter(item => item.kind !== 'video')
      .map(item => item.uri)
      .filter(Boolean);
    this.selectedScoreAssetId = asset.id;
    this.selectedEditorAssetId = `project-image:${asset.id}`;
    this.markEditorDirty();
    return asset;
  }

  removeSequenceVisualAsset(index) {
    const asset = this.sessionData.sequenceVisualAssets[index];
    if (!asset) return;
    const removesWholeReadingFocal = this.sessionData.visualConfig?.focals?.personalAssetId === asset.id;
    const removesDraftFocal = personalFocalAssetIdFromCue(
      this.visualAssetStyleDrafts.get('surface:focal')) === asset.id;
    const removedAssignments = this.sessionData.visualScoreAssignments
      .filter(item => item.assetId === asset.id
        || personalFocalAssetIdFromCue(item.cue) === asset.id).length;
    if (typeof asset.uri === 'string' && asset.uri.startsWith('blob:')
      && this.localObjectUrls.has(asset.uri)) {
      URL.revokeObjectURL(asset.uri);
      this.localObjectUrls.delete(asset.uri);
    }
    this.pendingMediaBlobs.delete(asset.id);
    WorkshopMedia.revokeObjectUrl(asset.id);
    this.sessionData.sequenceVisualAssets.splice(index, 1);
    this.sessionData.customVisuals = this.sessionData.sequenceVisualAssets
      .filter(item => item.kind !== 'video')
      .map(item => item.uri)
      .filter(Boolean);
    this.sessionData.visualScoreAssignments = this.sessionData.visualScoreAssignments
      .filter(item => item.assetId !== asset.id
        && personalFocalAssetIdFromCue(item.cue) !== asset.id);
    if (removesDraftFocal) this.visualAssetStyleDrafts.delete('surface:focal');
    if (removesWholeReadingFocal) {
      const focals = this.sessionData.visualConfig.focals || {};
      this.sessionData.visualConfig = {
        ...this.sessionData.visualConfig,
        visualMode: 'focals',
        focals: {
          ...focals, type: 'standard', standardGlyph: focals.standardGlyph || 'breath',
          personalAssetId: null, personalImage: null
        }
      };
    }
    if (this.selectedScoreAssetId === asset.id) {
      this.selectedScoreAssetId = this.sessionData.sequenceVisualAssets[0]?.id || null;
    }
    if (this.selectedEditorAssetId === projectEditorAssetId(asset)) {
      this.selectedEditorAssetId = this.selectedScoreAssetId
        ? this.editorAssetIdForScoreAsset(this.selectedScoreAssetId)
        : null;
    }
    if (removedAssignments) {
      this.selectedScoreAssignmentId = null;
      this.showToast(`Removed image and ${removedAssignments} visual assignment${removedAssignments === 1 ? '' : 's'}`);
    }
    this.markEditorDirty();
  }

  requestSequenceVisualAssetRemoval(index, button = null) {
    const asset = this.sessionData.sequenceVisualAssets[index];
    if (!asset) return false;
    const references = this.visualScoreReferenceCounts().get(asset.id) || 0;
    if (references > 0 && this.assetRemovalArmedId !== asset.id) {
      this.assetRemovalArmedId = asset.id;
      if (this.assetRemovalTimer) clearTimeout(this.assetRemovalTimer);
      if (button) {
        button.textContent = 'Confirm';
        button.setAttribute('aria-label', `Confirm removal of ${asset.name} and ${references} visual clips`);
        button.focus({ preventScroll: true });
      }
      this.announce(`${asset.name} is used by ${references} visual clip${references === 1 ? '' : 's'}. Activate Confirm to remove both.`);
      this.assetRemovalTimer = setTimeout(() => {
        this.assetRemovalArmedId = null;
        this.assetRemovalTimer = null;
        if (button?.isConnected) {
          button.textContent = '×';
          button.setAttribute('aria-label', `Remove ${asset.name} from this project`);
        }
      }, 5000);
      return false;
    }
    if (this.assetRemovalTimer) clearTimeout(this.assetRemovalTimer);
    this.assetRemovalTimer = null;
    this.assetRemovalArmedId = null;
    this.removeSequenceVisualAsset(index);
    this.updateVisualAssetsList();
    this.announce(`${asset.name} removed${references ? ` with ${references} referenced clip${references === 1 ? '' : 's'}` : ''}.`);
    return true;
  }

  renderLegacyHighlightedScoreText(source, assetsById = this.scoreAssetLookup()) {
    const assignments = this.sessionData.visualScoreAssignments
      .filter(item => item.sourceId === source.id)
      .sort((a, b) => a.fromCharacter - b.fromCharacter);
    let cursor = 0;
    const fragments = [];
    for (const assignment of assignments) {
      if (!Number.isInteger(assignment.fromCharacter)
        || !Number.isInteger(assignment.toCharacter)
        || assignment.fromCharacter < cursor
        || assignment.toCharacter > source.text.length) continue;
      fragments.push(this.escapeHtml(source.text.slice(cursor, assignment.fromCharacter)));
      const asset = assetsById.get(assignment.assetId);
      const excerpt = source.text.slice(assignment.fromCharacter, assignment.toCharacter)
        .replace(/\s+/gu, ' ').trim().slice(0, 72);
      fragments.push(`<mark class="visual-score-mark ${assignment.id === this.selectedScoreAssignmentId ? 'active' : ''}"
        data-action="select-score-assignment" data-assignment-id="${this.escapeHtml(assignment.id)}"
        data-focus-key="score-highlight:${this.escapeHtml(assignment.id)}" tabindex="0" role="button"
        aria-pressed="${assignment.id === this.selectedScoreAssignmentId}"
        aria-label="${this.escapeHtml(`${asset?.name || 'Missing visual'} assigned to “${excerpt}${excerpt.length === 72 ? '…' : ''}”`)}"
        style="--score-color: ${asset?.color || VISUAL_SCORE_COLORS[0]};"
        title="${this.escapeHtml(asset?.name || 'Assigned visual')}">${this.escapeHtml(
          source.text.slice(assignment.fromCharacter, assignment.toCharacter)
        )}</mark>`);
      cursor = assignment.toCharacter;
    }
    fragments.push(this.escapeHtml(source.text.slice(cursor)));
    return fragments.join('');
  }

  renderHighlightedScoreText(source, assetsById = this.scoreAssetLookup()) {
    const visual = this.scoreView === 'audio' ? [] : this.sessionData.visualScoreAssignments
      .filter(item => item.sourceId === source.id);
    const audio = this.scoreView === 'visual' ? [] : this.sessionData.audioScoreAssignments
      .filter(item => item.sourceId === source.id);
    const audioAssets = new Map(this.audioScoreAssets().map(asset => [asset.id, asset]));
    const boundaries = [...new Set([0, source.text.length,
      ...visual.flatMap(item => [item.fromCharacter, item.toCharacter]),
      ...audio.flatMap(item => [item.fromCharacter, item.toCharacter])])]
      .filter(value => Number.isInteger(value) && value >= 0 && value <= source.text.length)
      .sort((a, b) => a - b);
    const fragments = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const from = boundaries[index];
      const to = boundaries[index + 1];
      if (to <= from) continue;
      const visualClip = visual.find(item => item.fromCharacter <= from && item.toCharacter >= to);
      const audioClip = audio.find(item => item.fromCharacter <= from && item.toCharacter >= to);
      const text = this.escapeHtml(source.text.slice(from, to));
      if (!visualClip && !audioClip) {
        fragments.push(text);
        continue;
      }
      const visualAsset = visualClip ? assetsById.get(visualClip.assetId) : null;
      const audioAsset = audioClip ? audioAssets.get(audioClip.assetId) : null;
      const selected = visualClip?.id === this.selectedScoreAssignmentId
        || audioClip?.id === this.selectedAudioAssignmentId;
      const target = this.scoreAuthoringLane() === 'audio' && audioClip ? audioClip : visualClip || audioClip;
      const action = visualClip && audioClip && this.scoreView === 'combined'
        ? 'select-combined-assignment'
        : target?.lane ? 'select-audio-assignment' : 'select-score-assignment';
      const names = [visualAsset?.name, audioAsset?.name].filter(Boolean).join(' + ');
      fragments.push(`<mark class="visual-score-mark media-score-mark ${audioClip ? 'audio-score-mark' : ''} ${visualClip && audioClip ? 'combined-score-mark' : ''} ${selected ? 'active' : ''}"
        data-action="${action}" data-assignment-id="${this.escapeHtml(target?.id || '')}"
        ${visualClip && audioClip ? `data-visual-assignment-id="${this.escapeHtml(visualClip.id)}" data-audio-assignment-id="${this.escapeHtml(audioClip.id)}"` : ''}
        tabindex="0" role="button"
        aria-pressed="${selected}" aria-label="${this.escapeHtml(names || 'Assigned media')}"
        style="--score-color:${visualAsset?.color || VISUAL_SCORE_COLORS[0]};--audio-score-color:${audioAsset?.editor?.color || AUDIO_SCORE_COLORS[0]}"
        title="${this.escapeHtml(names || 'Assigned media')}">${text}</mark>`);
    }
    return fragments.join('');
  }

  renderAudioScoreAssignments(source) {
    const assets = new Map(this.audioScoreAssets().map(asset => [asset.id, asset]));
    const assignments = this.sessionData.audioScoreAssignments
      .filter(item => item.sourceId === source?.id)
      .sort((a, b) => a.fromCharacter - b.fromCharacter);
    if (!assignments.length) return '<p class="visual-score-empty text-fog">No audio passages scored in this source.</p>';
    return assignments.slice(0, MAX_RENDERED_LANE_CLIPS).map(assignment => {
      const asset = assets.get(assignment.assetId);
      const excerpt = source.text.slice(assignment.fromCharacter, assignment.toCharacter)
        .replace(/\s+/gu, ' ').trim().slice(0, 72);
      return `<div class="visual-score-clip audio-score-clip ${assignment.id === this.selectedAudioAssignmentId ? 'active' : ''}"
          style="--score-color:${asset?.editor?.color || AUDIO_SCORE_COLORS[0]}">
        <button type="button" class="visual-score-clip-main" data-action="select-audio-assignment"
          data-assignment-id="${this.escapeHtml(assignment.id)}" aria-pressed="${assignment.id === this.selectedAudioAssignmentId}">
          <span class="visual-score-swatch" aria-hidden="true"></span>
          <span><strong>${this.escapeHtml(asset?.name || 'Missing audio')}</strong>
          <small>${assignment.lane === 'swell' ? 'Layer' : 'Audio bed'} · “${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”</small></span>
        </button>
        <button type="button" class="btn-icon visual-score-erase" data-action="erase-audio-assignment"
          data-assignment-id="${this.escapeHtml(assignment.id)}" aria-label="Erase audio assignment">×</button>
      </div>`;
    }).join('');
  }

  renderVisualScoreAssignments(source, assetsById = this.scoreAssetLookup()) {
    const assignments = this.sessionData.visualScoreAssignments
      .filter(item => item.sourceId === source?.id)
      .sort((a, b) => a.fromCharacter - b.fromCharacter);
    if (!assignments.length) {
      return '<p class="visual-score-empty text-fog">No visual passages scored in this source.</p>';
    }
    const selected = assignments.find(item => item.id === this.selectedScoreAssignmentId);
    const rendered = assignments.slice(0, MAX_RENDERED_LANE_CLIPS);
    if (selected && !rendered.includes(selected)) rendered.push(selected);
    const clips = rendered.map(assignment => {
      const asset = assetsById.get(assignment.assetId);
      const excerpt = source.text.slice(assignment.fromCharacter, assignment.toCharacter)
        .replace(/\s+/g, ' ').trim().slice(0, 72);
      return `<div class="visual-score-clip ${assignment.id === this.selectedScoreAssignmentId ? 'active' : ''}"
          style="--score-color: ${asset?.color || VISUAL_SCORE_COLORS[0]};">
        <button type="button" class="visual-score-clip-main" data-action="select-score-assignment"
                data-assignment-id="${this.escapeHtml(assignment.id)}"
                data-focus-key="score-clip:${this.escapeHtml(assignment.id)}"
                aria-pressed="${assignment.id === this.selectedScoreAssignmentId}">
          <span class="visual-score-swatch" aria-hidden="true"></span>
          <span><strong>${this.escapeHtml(asset?.name || 'Missing visual')}</strong>
          <small>“${this.escapeHtml(excerpt)}${excerpt.length === 72 ? '…' : ''}”</small></span>
        </button>
        <button type="button" class="btn-icon visual-score-erase" data-action="erase-score-assignment"
                data-assignment-id="${this.escapeHtml(assignment.id)}" aria-label="Erase visual assignment">×</button>
      </div>`;
    }).join('');
    if (assignments.length <= rendered.length) return clips;
    return `${clips}<p class="visual-score-lane-limit" role="status">Showing ${rendered.length} of ${assignments.length} clips. Every passage remains available from its source highlight.</p>`;
  }

  renderMediaScoreEditor() {
    if (this.scoreView === 'visual') return this.renderVisualScoreEditor();
    const source = this.activeScoreSource();
    const lane = this.scoreAuthoringLane();
    const visualHistory = visualScoreHistoryStatus(this.visualScoreHistory);
    const audioHistory = visualScoreHistoryStatus(this.audioScoreHistory);
    const history = lane === 'audio' ? audioHistory : visualHistory;
    if (!source) {
      return `<section class="visual-score-editor is-empty" aria-labelledby="media-score-title">
        <h3 id="media-score-title">Media Score</h3>
        <p class="input-note text-fog">Add a text source to author passage visuals and audio.</p>
      </section>`;
    }
    const visualAssets = this.scoreAssetLookup();
    const audioAsset = this.selectedAudioScoreAsset();
    const visualAsset = this.scoreAsset(this.selectedScoreAssetId);
    const selectedAsset = lane === 'audio' ? audioAsset : visualAsset;
    const pending = (this.pendingScoreConflict?.selection || this.pendingScoreSelection)?.sourceId === source.id
      ? (this.pendingScoreConflict?.selection || this.pendingScoreSelection) : null;
    const canAssign = Boolean(pending && selectedAsset && !this.pendingScoreConflict);
    const canAssignVisual = Boolean(pending && visualAsset && !this.pendingScoreConflict);
    const canAssignAudio = Boolean(pending && audioAsset && !this.pendingScoreConflict);
    const wash = lane === 'audio' ? this.wholeReadingAudioWash() : null;
    return `<section class="visual-score-editor media-score-editor" aria-labelledby="media-score-title" data-score-view="${this.scoreView}">
      <div class="media-score-view-tabs" role="tablist" aria-label="Score view">
        ${['visual', 'audio', 'combined'].map(view => `<button type="button" role="tab"
          class="${this.scoreView === view ? 'active' : ''}" aria-selected="${this.scoreView === view}"
          data-action="set-score-view" data-score-view="${view}">${view[0].toUpperCase()}${view.slice(1)}</button>`).join('')}
      </div>
      <div class="visual-score-header">
        <div><h3 id="media-score-title">${this.scoreView === 'combined' ? 'Combined Score' : `${lane === 'audio' ? 'Audio' : 'Visual'} Score`}</h3>
          <p class="input-note text-fog">${this.scoreView === 'combined'
            ? 'Select one passage, then assign its visual and audio independently from the combined passage card.'
            : lane === 'audio'
            ? 'Your own recordings layer over the whole-reading bed and duck it. A bed replaces it for that passage instead, because only one atmosphere can sound at a time. Audio uses underlines; visuals use filled highlights.'
            : 'Choose a visual, select its passage, then assign. Colours are editor guides only.'}</p></div>
        <div class="visual-score-header-actions">
          ${this.scoreView === 'combined' ? `<div class="visual-score-history studio-combined-history studio-choice-grid studio-choice-grid-4" aria-label="Visual and audio score histories">
              <button type="button" class="btn-ghost btn-compact" data-action="undo-score-lane" data-score-lane="visual" ${visualHistory.canUndo ? '' : 'disabled'}>Undo visual</button>
              <button type="button" class="btn-ghost btn-compact" data-action="redo-score-lane" data-score-lane="visual" ${visualHistory.canRedo ? '' : 'disabled'}>Redo visual</button>
              <button type="button" class="btn-ghost btn-compact" data-action="undo-score-lane" data-score-lane="audio" ${audioHistory.canUndo ? '' : 'disabled'}>Undo audio</button>
              <button type="button" class="btn-ghost btn-compact" data-action="redo-score-lane" data-score-lane="audio" ${audioHistory.canRedo ? '' : 'disabled'}>Redo audio</button>
            </div>` : `<div class="visual-score-history" aria-label="${lane} score history">
              <button type="button" class="btn-ghost btn-compact" data-action="undo-active-score" ${history.canUndo ? '' : 'disabled'}>Undo</button>
              <button type="button" class="btn-ghost btn-compact" data-action="redo-active-score" ${history.canRedo ? '' : 'disabled'}>Redo</button>
            </div>`}
          <select id="visual-score-source" class="input-select" aria-label="Source to score">
            ${this.scoreSources().map(item => `<option value="${this.escapeHtml(item.id)}" ${item.id === source.id ? 'selected' : ''}>${this.escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="visual-score-workspace">
        <div class="visual-score-text-column">
          ${wash ? `<p class="score-whole-reading-audio" style="--whole-reading-audio-color:${wash.color}">
            <span aria-hidden="true"></span><span><strong>${this.escapeHtml(wash.label)}</strong> sounds under the whole reading. Highlight a passage to layer audio over it.</span></p>` : ''}
          <div id="visual-score-text" class="visual-score-text" tabindex="0" role="textbox"
            aria-label="Selectable source text for ${this.scoreView === 'combined' ? 'combined media' : lane} scoring" aria-multiline="true"
            ${wash ? `data-whole-reading-audio="${this.escapeHtml(wash.label)}" style="--whole-reading-audio-color:${wash.color}"` : ''}
            data-source-id="${this.escapeHtml(source.id)}">${this.renderHighlightedScoreText(source, visualAssets)}</div>
          <div class="visual-score-toolbar">
            <span id="visual-score-selection" class="text-fog" aria-live="polite">${this.pendingScoreConflict
              ? `This passage overlaps an existing ${lane} clip. Replace it deliberately.`
              : pending ? 'Passage selected.' : `Select a passage for ${lane} authoring.`}</span>
            ${this.scoreView === 'combined'
              ? `<button type="button" class="btn-secondary btn-compact" data-action="assign-score-lane" data-score-lane="visual" ${canAssignVisual ? '' : 'disabled'}>Assign visual</button>
                <button type="button" class="btn-secondary btn-compact" data-action="assign-score-lane" data-score-lane="audio" ${canAssignAudio ? '' : 'disabled'}>Assign audio</button>`
              : `<button type="button" class="btn-secondary btn-compact" data-action="assign-score-selection" ${canAssign ? '' : 'disabled'}>Assign ${lane}</button>`}
            <button type="button" class="btn-secondary btn-compact ${this.pendingScoreConflict ? '' : 'hidden'}" id="replace-score-overlap" data-action="replace-score-overlap">Replace overlap</button>
          </div>
        </div>
      </div>
      ${this.scoreView !== 'audio' ? `<div class="visual-score-lane" role="region" aria-label="Visual assignments">
        <span class="studio-kicker">Visual lane</span>${this.renderVisualScoreAssignments(source, visualAssets)}</div>` : ''}
      ${this.scoreView !== 'visual' ? `<div class="visual-score-lane audio-score-lane" role="region" aria-label="Audio assignments">
        <span class="studio-kicker">Audio lane</span>${this.renderAudioScoreAssignments(source)}</div>` : ''}
    </section>`;
  }

  renderVisualScoreEditor() {
    const source = this.activeScoreSource();
    if (!source) {
      return `<section class="visual-score-editor is-empty" aria-labelledby="visual-score-title">
        <h3 id="visual-score-title">Visual Score</h3>
        <p class="input-note text-fog">Add a text source to begin scoring visuals against passages.</p>
      </section>`;
    }
    const assetsById = this.scoreAssetLookup();
    const history = visualScoreHistoryStatus(this.visualScoreHistory);
    const pending = (this.pendingScoreConflict?.selection || this.pendingScoreSelection)?.sourceId === source.id
      ? (this.pendingScoreConflict?.selection || this.pendingScoreSelection)
      : null;
    const pendingExcerpt = pending
      ? source.text.slice(pending.fromCharacter, pending.toCharacter).replace(/\s+/g, ' ').slice(0, 80)
      : '';
    const canAssign = Boolean(pending && this.scoreAsset(this.selectedScoreAssetId) && !this.pendingScoreConflict);
    const selectionStatus = this.pendingScoreConflict
      ? 'This passage overlaps an existing visual. Replace it deliberately or select another passage.'
      : pending
        ? `Selected â€œ${this.escapeHtml(pendingExcerpt)}${pendingExcerpt.length === 80 ? 'â€¦' : ''}â€`
        : 'Select a passage in the text.';
    return `<section class="visual-score-editor" aria-labelledby="visual-score-title">
      <div class="media-score-view-tabs" role="tablist" aria-label="Score view">
        ${['visual', 'audio', 'combined'].map(view => `<button type="button" role="tab"
          class="${this.scoreView === view ? 'active' : ''}" aria-selected="${this.scoreView === view}"
          data-action="set-score-view" data-score-view="${view}">${view[0].toUpperCase()}${view.slice(1)}</button>`).join('')}
      </div>
      <div class="visual-score-header">
        <div>
          <h3 id="visual-score-title">Visual Score</h3>
          <p class="input-note text-fog">Choose a visual, select its passage, then assign. Colours are editor guides only.</p>
        </div>
        <div class="visual-score-header-actions">
          <div class="visual-score-history" aria-label="Visual score history">
            <button type="button" class="btn-ghost btn-compact" data-action="undo-visual-score"
              aria-label="Undo visual score edit" ${history.canUndo ? '' : 'disabled'}>Undo</button>
            <button type="button" class="btn-ghost btn-compact" data-action="redo-visual-score"
              aria-label="Redo visual score edit" ${history.canRedo ? '' : 'disabled'}>Redo</button>
          </div>
          <select id="visual-score-source" class="input-select" aria-label="Source to score">
            ${this.scoreSources().map(item => `<option value="${this.escapeHtml(item.id)}"
              ${item.id === source.id ? 'selected' : ''}>${this.escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      ${this.scoredActivationUndo ? `<div class="visual-score-activation-notice" role="status">
        <span><strong>Scored visuals activated.</strong> Preview and Run will now perform passage visuals.</span>
        <button type="button" class="btn-ghost btn-compact" data-action="undo-scored-activation">Undo</button>
      </div>` : ''}
      <div class="visual-score-workspace">
        <div class="visual-score-text-column">
          <div id="visual-score-text" class="visual-score-text" tabindex="0" role="textbox"
               aria-label="Selectable source text for visual scoring" aria-multiline="true"
               data-source-id="${this.escapeHtml(source.id)}">${this.renderHighlightedScoreText(source, assetsById)}</div>
          <div class="visual-score-toolbar">
            <span id="visual-score-selection" class="text-fog" aria-live="polite">${selectionStatus}</span>
            <button type="button" class="btn-secondary btn-compact" data-action="assign-score-selection"
                    ${canAssign ? '' : 'disabled'}>Assign passage visual</button>
            <button type="button" class="btn-secondary btn-compact ${this.pendingScoreConflict ? '' : 'hidden'}" id="replace-score-overlap"
                    data-action="replace-score-overlap">Replace overlap</button>
          </div>
        </div>
      </div>
      <div class="visual-score-lane" id="visual-score-lane" role="region" aria-label="Visual assignments">
        ${this.renderVisualScoreAssignments(source, assetsById)}
      </div>
    </section>`;
  }

  async updatePersonalSwellList() {
    const list = this.container.querySelector('#personal-swell-list');
    if (!list) return;

    const swells = await PersonalSwells.getAll();
    this.personalSwells = swells;
    if (swells.length === 0) {
      list.innerHTML = `<div class="empty-sources text-fog" style="padding: 1rem; border: none;">No personal audio uploaded</div>`;
      return;
    }

    list.innerHTML = swells.map((swell) => `
      <div class="swell-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid var(--color-shadow);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="icon" style="color: var(--color-threshold); font-size: 0.8rem;">♪</span>
          <span style="font-size: 13px; color: var(--color-cloud);">${this.escapeHtml(swell.name)}</span>
        </div>
        <div style="display: flex; gap: 5px;">
          <button type="button" class="btn-ghost btn-compact" data-action="select-personal-swell-asset" data-id="${swell.id}"
                  aria-label="Select ${this.escapeHtml(swell.name)}">Select</button>
          <button type="button" class="btn-icon" data-action="preview-personal-swell" data-id="${swell.id}"
                  aria-label="Preview ${this.escapeHtml(swell.name)}" style="color: var(--color-mist); font-size: 10px;">◎</button>
          <button type="button" class="btn-icon" data-action="remove-personal-swell" data-id="${swell.id}"
                  aria-label="Remove ${this.escapeHtml(swell.name)}" style="color: var(--color-rose); font-size: 10px;">✕</button>
        </div>
      </div>
    `).join('');
  }

  getCurveIcon(curve) {
    const icons = {
      flat: '─',
      induction: '╲',
      ascent: '╱',
      wave: '∿',
      climax: '∧'
    };
    return icons[curve] || '─';
  }

  getAudioIcon(preset) {
    const icons = {
      silent: '○',
      focus: '◇',
      deep: '◈',
      gateway: '⬡'
    };
    return icons[preset] || '○';
  }

  updateVisualScoreEditor() {
    const current = this.container.querySelector('.visual-score-editor');
    this.withFocusPreserved(() => {
      if (current) current.outerHTML = this.renderMediaScoreEditor();
    });
    this.attachVisualScoreEvents();
    this.refreshScoreSelectionUi();
    if (this.pendingScoreSelection || this.pendingScoreConflict) {
      requestAnimationFrame(() => this.restorePendingDomSelection());
    }
  }

  attachVisualScoreEvents() {
    this.container.querySelector('#visual-score-source')?.addEventListener('change', event => {
      this.activeScoreSourceId = event.target.value;
      this.selectedScoreAssignmentId = null;
      this.selectedAudioAssignmentId = null;
      this.pendingScoreSelection = null;
      this.pendingScoreConflict = null;
      this.updateVisualScoreEditor();
      this.setInspectorContext({ kind: 'source', id: event.target.value });
    });
    const text = this.container.querySelector('#visual-score-text');
    if (!text) return;
    text.addEventListener('pointerdown', () => {
      this.visualSelectionPointerDown = true;
      this.scoreConfirmationAssignmentId = null;
      this.refreshScoreSelectionUi();
    });
    text.addEventListener('pointerup', () => {
      this.visualSelectionPointerDown = false;
      this.scheduleVisualScoreSelectionCapture(0);
    });
    text.addEventListener('pointercancel', () => {
      this.visualSelectionPointerDown = false;
    });
    text.addEventListener('mouseup', () => this.captureVisualScoreSelection());
    text.addEventListener('touchend', () => this.scheduleVisualScoreSelectionCapture(80), { passive: true });
    text.addEventListener('keyup', () => this.captureVisualScoreSelection());
    text.addEventListener('scroll', () => this.positionScoreSelectionPopover(), { passive: true });
  }

  scheduleVisualScoreSelectionCapture(delay = 0) {
    if (!this._active && !this.container.isConnected) return;
    if (this.visualSelectionCaptureTimer) clearTimeout(this.visualSelectionCaptureTimer);
    this.visualSelectionCaptureTimer = setTimeout(() => {
      this.visualSelectionCaptureTimer = null;
      this.captureVisualScoreSelection();
    }, Math.max(0, delay));
  }

  rangeForSourceOffsets(root, fromCharacter, toCharacter) {
    if (!root || !Number.isInteger(fromCharacter) || !Number.isInteger(toCharacter)) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.nodeValue?.length || 0;
      if (!startNode && fromCharacter <= consumed + length) {
        startNode = node;
        startOffset = Math.max(0, fromCharacter - consumed);
      }
      if (toCharacter <= consumed + length) {
        endNode = node;
        endOffset = Math.max(0, toCharacter - consumed);
        break;
      }
      consumed += length;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
    return range;
  }

  rangeForPendingScoreSelection() {
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    const root = this.container.querySelector('#visual-score-text');
    if (!selection || !root || root.dataset.sourceId !== selection.sourceId) return null;
    return this.rangeForSourceOffsets(root, selection.fromCharacter, selection.toCharacter);
  }

  /**
   * A ROOM THE AUTHOR HAS LEFT DOES NOT TOUCH THE DOCUMENT'S SELECTION.
   *
   * This is scheduled a frame ahead by every re-render that happens while a
   * passage is pending, and it writes `window.getSelection()` — which belongs to
   * the document, not to this Workshop. So a frame scheduled just before the
   * author navigated away arrived after the next surface had been mounted, and
   * replaced that surface's selection with a range inside a container that is no
   * longer in the document. The next capture then found the selection outside
   * its own text and dropped it: a passage the author had just made, gone,
   * roughly one time in a hundred and never reproducibly.
   *
   * `querySelector` walks a detached tree perfectly well, so the range was
   * built and installed without anything erroring. The frame is not cancelled —
   * it is refused on arrival, which is the check that also holds for the frame
   * already in flight when a container is swapped.
   */
  restorePendingDomSelection() {
    if (!this.container.isConnected) return false;
    const range = this.rangeForPendingScoreSelection();
    const selection = window.getSelection?.();
    if (!range || !selection) return false;
    this.restoringVisualSelection = true;
    selection.removeAllRanges();
    selection.addRange(range);
    requestAnimationFrame(() => {
      this.restoringVisualSelection = false;
      this.positionScoreSelectionPopover();
    });
    return true;
  }

  captureVisualScoreSelection() {
    if (this.restoringVisualSelection || this.visualSelectionPointerDown) return false;
    const root = this.container.querySelector('#visual-score-text');
    const source = this.activeScoreSource();
    const selection = window.getSelection?.();
    if (!root || !source || !selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return false;

    const beforeStart = document.createRange();
    beforeStart.selectNodeContents(root);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = document.createRange();
    beforeEnd.selectNodeContents(root);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    let fromCharacter = beforeStart.toString().length;
    let toCharacter = beforeEnd.toString().length;
    while (fromCharacter < toCharacter && /\s/u.test(source.text[fromCharacter])) fromCharacter += 1;
    while (toCharacter > fromCharacter && /\s/u.test(source.text[toCharacter - 1])) toCharacter -= 1;
    if (toCharacter <= fromCharacter) return false;
    const snapped = snapCharacterRangeToTokens(source.text, fromCharacter, toCharacter);
    if (!snapped) return false;
    const expanded = snapped.fromCharacter !== fromCharacter
      || snapped.toCharacter !== toCharacter;
    fromCharacter = snapped.fromCharacter;
    toCharacter = snapped.toCharacter;

    const unchanged = this.pendingScoreSelection?.sourceId === source.id
      && this.pendingScoreSelection.fromCharacter === fromCharacter
      && this.pendingScoreSelection.toCharacter === toCharacter
      && !this.pendingScoreConflict;
    this.pendingScoreSelection = { sourceId: source.id, fromCharacter, toCharacter };
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    const status = this.container.querySelector('#visual-score-selection');
    const replace = this.container.querySelector('#replace-score-overlap');
    if (replace) replace.classList.add('hidden');
    if (status) {
      const excerpt = source.text.slice(fromCharacter, toCharacter).replace(/\s+/g, ' ').slice(0, 80);
      status.textContent = `Selected “${excerpt}${excerpt.length === 80 ? '…' : ''}”`;
    }
    this.refreshScoreSelectionUi();
    if (!unchanged) this.announce(`${expanded ? 'Selection expanded to complete words. ' : ''}${this.scoreView === 'combined'
      ? 'Passage selected. Choose passage visual and audio, then assign either lane.'
      : `Passage selected. Choose passage ${this.scoreAuthoringLane() === 'audio' ? 'audio' : 'visual'} and assign it.`}`);
    return true;
  }

  commitVisualScoreCommand(type, assignments, selectedAfter = null) {
    this.visualScoreHistory = recordVisualScoreCommand(this.visualScoreHistory, {
      type,
      before: this.sessionData.visualScoreAssignments,
      after: assignments,
      selectedBefore: this.selectedScoreAssignmentId,
      selectedAfter
    });
    this.sessionData.visualScoreAssignments = [...assignments];
    this.selectedScoreAssignmentId = selectedAfter;
    this.lastScoreMutationLane = 'visual';
    this.markEditorDirty();
  }

  restoreVisualScoreHistory(result, verb) {
    this.visualScoreHistory = result.history;
    if (!result.snapshot) return false;
    this.sessionData.visualScoreAssignments = [...result.snapshot.assignments];
    this.selectedScoreAssignmentId = result.snapshot.selectedAssignmentId;
    const selected = this.sessionData.visualScoreAssignments
      .find(item => item.id === this.selectedScoreAssignmentId);
    if (selected) {
      this.activeScoreSourceId = selected.sourceId;
      this.selectedScoreAssetId = selected.assetId;
      this.selectedEditorAssetId = this.editorAssetIdForScoreAsset(selected.assetId);
    }
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.markEditorDirty();
    this.refreshVisualScoreView();
    this.updateSequencePicker();
    this.showToast(`${verb} ${result.command.type.replaceAll('-', ' ')}`);
    return true;
  }

  undoVisualScore() {
    return this.restoreVisualScoreHistory(
      undoVisualScoreCommand(this.visualScoreHistory),
      'Undid'
    );
  }

  redoVisualScore() {
    return this.restoreVisualScoreHistory(
      redoVisualScoreCommand(this.visualScoreHistory),
      'Redid'
    );
  }

  replaceScoreAssignmentAsset(
    assignmentId,
    assetId = this.selectedScoreAssetId,
    cueOverride = null
  ) {
    const assignment = this.sessionData.visualScoreAssignments
      .find(item => item.id === assignmentId);
    const replacement = this.scoreAsset(assetId);
    if (!assignment || !replacement) return false;
    const replacementCue = this.visualCueForEntry(replacement.entry);
    const configurableCue = cueOverride
      ? normalizeConfigurableVisualCue(cueOverride)
      : visualCueIsConfigurable(replacementCue) ? replacementCue : null;
    const sameCue = JSON.stringify(assignment.cue || null)
      === JSON.stringify(configurableCue || null);
    if (assignment.assetId === assetId && sameCue) return false;
    const assignments = this.sessionData.visualScoreAssignments.map(item => {
      if (item.id !== assignmentId) return item;
      const next = { ...item, assetId };
      delete next.cue;
      if (configurableCue) next.cue = configurableCue;
      return Object.freeze(next);
    });
    this.commitVisualScoreCommand('replace-asset', assignments, assignmentId);
    this.activateScoredVisualSurface();
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = assignment.id;
    this.refreshVisualScoreView();
    this.updateSequencePicker();
    return true;
  }

  updateVisualStyleSetting(assetId, setting, value, checked = false) {
    const entry = this.visualAssetEntries().find(item => item.asset.id === assetId && !item.hidden);
    if (!entry) return false;
    if (setting === 'focal-glyph' && value === 'personal'
      && entry.asset.cueTemplate?.kind === 'field'
      && entry.asset.cueTemplate.renderer === 'focal') {
      this.openPersonalFocalChooser(assetId);
      return true;
    }
    const current = this.visualCueForEntry(entry);
    if (!visualCueIsConfigurable(current)) return false;
    let next = null;
    if (current.kind === 'field' && current.renderer === 'focal') {
      const config = { ...normalizeFieldStyle('focal', current.config) };
      if (setting === 'focal-glyph') config.standardGlyph = value;
      else if (setting === 'focal-rose-mode') config.roseMode = value;
      else return false;
      next = { kind: 'field', renderer: 'focal', config: normalizeFieldStyle('focal', config) };
    } else if (current.kind === 'field' && current.renderer === 'attractor') {
      const config = { ...normalizeFieldStyle('attractor', current.config) };
      if (setting === 'attractor-system') config.system = value;
      else if (setting === 'attractor-palette') config.palette = value;
      else if (setting === 'attractor-form') config.form = value;
      else return false;
      next = { kind: 'field', renderer: 'attractor', config: normalizeFieldStyle('attractor', config) };
    } else if (current.kind === 'field' && current.renderer === 'genesis') {
      const config = { ...normalizeFieldStyle('genesis', current.config) };
      if (setting === 'genesis-preset') config.preset = value;
      else if (setting === 'genesis-glass') config.glass = checked;
      else return false;
      next = { kind: 'field', renderer: 'genesis', config: normalizeFieldStyle('genesis', config) };
    } else if (current.kind === 'procedural' && current.collections?.[0] === 'klee'
      && setting === 'klee-preset') {
      next = { ...current, config: normalizeProceduralStyle(current.collections, { preset: value }) };
    } else if (current.kind === 'procedural' && current.collections?.[0] === 'harmonograph'
      && setting === 'harmonograph-climate') {
      next = { ...current, config: normalizeProceduralStyle(current.collections, { climate: value }) };
    } else if (current.kind === 'procedural' && current.collections?.[0] === 'ostensoria'
      && setting === 'ostensoria-palette') {
      next = { ...current, config: normalizeProceduralStyle(current.collections, { palette: value }) };
    } else if (current.kind === 'procedural' && current.collections?.[0] === 'apparitio'
      && setting === 'apparitio-palette') {
      next = { ...current, config: normalizeProceduralStyle(current.collections, { palette: value }) };
    } else return false;
    next = normalizeConfigurableVisualCue(next);
    this.visualAssetStyleDrafts.set(entry.asset.id, next);

    const assignmentId = this.selectedScoreAssignmentId || this.scoreConfirmationAssignmentId;
    const assignment = this.sessionData.visualScoreAssignments.find(item => item.id === assignmentId);
    if (assignment?.assetId === this.scoreAssetReference(entry)) {
      const assignments = this.sessionData.visualScoreAssignments.map(item => item.id === assignment.id
        ? Object.freeze({ ...item, cue: next }) : item);
      this.commitVisualScoreCommand('configure-visual', assignments, assignment.id);
      this.scoreConfirmationAssignmentId = assignment.id;
    }
    this.refreshVisualLibraryAndInspector();
    this.refreshScoreSelectionUi();
    this.updateSequencePicker();
    return true;
  }

  activateScoredVisualSurface() {
    const config = this.sessionData.visualConfig || { visualMode: 'off' };
    if (config.visualMode === 'interlocution') return false;
    this.sessionData.visualConfig = {
      ...config,
      visualMode: 'interlocution',
      interlocution: {
        ...(config.interlocution || {}),
        fallbackCue: visualFallbackCueFromConfig(config)
      }
    };
    return true;
  }

  assignPendingVisualScore(overlap = 'reject', assetId = this.selectedScoreAssetId) {
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    const source = this.scoreSources().find(item => item.id === selection?.sourceId);
    const asset = this.scoreAsset(assetId);
    const status = this.container.querySelector('#visual-score-selection');
    if (!source || !selection) {
      if (status) status.textContent = 'Select a passage in the source text first.';
      return false;
    }
    if (!asset) {
      if (status) status.textContent = 'Choose a passage visual first.';
      return false;
    }
    try {
      const activatesScoredSurface = this.sessionData.visualScoreAssignments.length === 0
        && this.visualSurface() !== 'scored';
      const previousVisualConfig = activatesScoredSurface
        ? cloneSessionData(this.sessionData.visualConfig)
        : null;
      const assignments = assignVisualSpan({
        assignments: this.sessionData.visualScoreAssignments,
        source,
        assetId: asset.id,
        assignmentId: `visual-${crypto.randomUUID()}`,
        fromCharacter: selection.fromCharacter,
        toCharacter: selection.toCharacter,
        overlap,
        cue: visualCueIsConfigurable(this.visualCueForEntry(asset.entry))
          ? this.visualCueForEntry(asset.entry)
          : null
      });
      const added = assignments[assignments.length - 1];
      this.commitVisualScoreCommand(
        overlap === 'replace' ? 'replace-overlap' : 'assign',
        assignments,
        added.id
      );
      this.pendingScoreSelection = null;
      this.pendingScoreConflict = null;
      this.activateScoredVisualSurface();
      this.scoreConfirmationAssignmentId = added.id;
      this.workshopIssue = null;
      this.inspectorContext = normalizeInspectorContext({ kind: 'visualClip', id: added.id });
      if (activatesScoredSurface) {
        this.scoredActivationUndo = {
          assignmentId: added.id,
          visualConfig: previousVisualConfig
        };
      }
      window.getSelection?.()?.removeAllRanges?.();
      this.refreshVisualScoreView();
      this.refreshScoreSelectionUi();
      this.updateSequencePicker();
      this.announce(`${asset.name} assigned to the selected passage.${activatesScoredSurface ? ' Scored visuals activated.' : ''}`);
      if (this.studioViewport === 'phone') this.setStudioSurface('score', { focus: false });
      return true;
    } catch (error) {
      if (error instanceof VisualScoreLaneError && error.code === 'VISUAL_SCORE_OVERLAP') {
        this.pendingScoreConflict = { selection, conflicts: error.details.conflicts, scoreLane: 'visual' };
        this.container.querySelector('#replace-score-overlap')?.classList.remove('hidden');
        if (status) status.textContent = 'This passage overlaps an existing visual. Replace it deliberately or select another passage.';
        this.refreshScoreSelectionUi();
        this.announce('The selected passage overlaps an existing visual. Choose Replace overlap to continue.');
        return false;
      }
      if (status) status.textContent = error.message || 'Unable to assign that passage.';
      this.setWorkshopIssue(error.code || 'VISUAL_ASSIGNMENT_FAILED', error.message || 'Unable to assign that passage.', {
        action: 'show-score-surface', label: 'Choose another passage'
      });
      return false;
    }
  }

  commitAudioScoreCommand(type, assignments, selectedAfter = null) {
    this.audioScoreHistory = recordVisualScoreCommand(this.audioScoreHistory, {
      type,
      before: this.sessionData.audioScoreAssignments,
      after: assignments,
      selectedBefore: this.selectedAudioAssignmentId,
      selectedAfter
    });
    this.sessionData.audioScoreAssignments = [...assignments];
    this.selectedAudioAssignmentId = selectedAfter;
    this.lastScoreMutationLane = 'audio';
    this.markEditorDirty();
  }

  restoreAudioScoreHistory(result, verb) {
    this.audioScoreHistory = result.history;
    if (!result.snapshot) return false;
    this.sessionData.audioScoreAssignments = [...result.snapshot.assignments];
    this.selectedAudioAssignmentId = result.snapshot.selectedAssignmentId;
    const selected = this.sessionData.audioScoreAssignments
      .find(item => item.id === this.selectedAudioAssignmentId);
    if (selected) {
      this.activeScoreSourceId = selected.sourceId;
      this.selectedAudioAssetId = selected.assetId;
    }
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.markEditorDirty();
    this.refreshVisualScoreView();
    this.updateSequencePicker();
    this.showToast(`${verb} ${result.command.type.replaceAll('-', ' ')}`);
    return true;
  }

  undoAudioScore() {
    return this.restoreAudioScoreHistory(undoVisualScoreCommand(this.audioScoreHistory), 'Undid');
  }

  redoAudioScore() {
    return this.restoreAudioScoreHistory(redoVisualScoreCommand(this.audioScoreHistory), 'Redid');
  }

  assignPendingAudioScore(overlap = 'reject') {
    const selection = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    const source = this.scoreSources().find(item => item.id === selection?.sourceId);
    const asset = this.selectedAudioScoreAsset();
    if (!source || !selection || !asset) return false;
    const exactVisual = this.sessionData.visualScoreAssignments.find(item =>
      item.sourceId === selection.sourceId
      && item.fromCharacter === selection.fromCharacter
      && item.toCharacter === selection.toCharacter);
    try {
      const assignments = assignAudioSpan({
        assignments: this.sessionData.audioScoreAssignments,
        assets: this.audioScoreAssets(),
        source,
        assetId: asset.id,
        assignmentId: `${asset.lane}-${crypto.randomUUID()}`,
        fromCharacter: selection.fromCharacter,
        toCharacter: selection.toCharacter,
        overlap,
        ...(exactVisual ? { syncGroup: `sync-${exactVisual.id}` } : {})
      });
      const added = assignments[assignments.length - 1];
      this.commitAudioScoreCommand(overlap === 'replace' ? 'replace-overlap' : 'assign', assignments, added.id);
      this.pendingScoreSelection = null;
      this.pendingScoreConflict = null;
      this.scoreConfirmationAssignmentId = added.id;
      this.workshopIssue = null;
      this.inspectorContext = normalizeInspectorContext({ kind: 'audioClip', id: added.id });
      window.getSelection?.()?.removeAllRanges?.();
      this.refreshVisualScoreView();
      this.refreshScoreSelectionUi();
      this.updateSequencePicker();
      this.announce(`${asset.name} assigned as ${asset.lane === 'swell' ? 'a layer over the reading' : 'an audio bed'}.${exactVisual ? ' It is synchronized with the matching visual.' : ''}`);
      return true;
    } catch (error) {
      if (error instanceof AudioScoreLaneError && error.code === 'AUDIO_SCORE_OVERLAP') {
        this.pendingScoreConflict = { selection, conflicts: error.details.conflicts, lane: asset.lane, scoreLane: 'audio' };
        this.refreshScoreSelectionUi();
        this.announce(`The selected passage overlaps an existing ${asset.lane} clip.`);
        return false;
      }
      this.showToast(error.message || 'Unable to assign that passage audio');
      this.setWorkshopIssue(error.code || 'AUDIO_ASSIGNMENT_FAILED', error.message || 'Unable to assign that passage audio', {
        action: 'show-score-surface', label: 'Choose another passage'
      });
      return false;
    }
  }

  /**
   * Combined authoring keeps one stable passage active while each media lane
   * commits through its own transactional history. This avoids forcing the
   * author to reconstruct the same browser selection for the second lane.
   */
  assignPendingCombinedLane(lane, overlap = 'reject') {
    if (!['visual', 'audio'].includes(lane)) return false;
    const active = this.pendingScoreConflict?.selection || this.pendingScoreSelection;
    if (!active) return false;
    const selection = { ...active };
    this.activeAssetLane = lane;
    const assigned = lane === 'audio'
      ? this.assignPendingAudioScore(overlap)
      : this.assignPendingVisualScore(overlap);
    this.scoreView = 'combined';
    if (!assigned) {
      this.refreshScoreSelectionUi();
      return false;
    }
    this.pendingScoreSelection = selection;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.updateVisualScoreEditor();
    this.refreshScoreSelectionUi();
    requestAnimationFrame(() => this.restorePendingDomSelection());
    return true;
  }

  selectAudioAssignment(assignmentId) {
    if (this.pendingScoreSelection) return false;
    const assignment = this.sessionData.audioScoreAssignments.find(item => item.id === assignmentId);
    if (!assignment) return false;
    this.activeScoreSourceId = assignment.sourceId;
    this.selectedAudioAssetId = assignment.assetId;
    this.selectedAudioAssignmentId = assignment.id;
    this.selectedScoreAssignmentId = null;
    this.scoreConfirmationAssignmentId = null;
    this.inspectorContext = normalizeInspectorContext({ kind: 'audioClip', id: assignment.id });
    this.refreshVisualScoreView();
    this.scrollInspectorClipIntoView(assignment.id);
    this.announce('Audio clip selected. Preview, Replace, and Erase are available.');
    if (this.studioViewport !== 'desktop') this.setStudioSurface('inspector');
    return true;
  }

  assignIntentionalStillness() {
    if (!this.canAuthorIntentionalStillness()) return false;
    return this.assignPendingVisualScore('reject', 'surface:off');
  }

  requestSourceRemoval(index, button = null) {
    const source = this.sessionData.sources[index];
    if (!source) return false;
    const visualReferences = this.sessionData.visualScoreAssignments
      .filter(item => item.sourceId === source.id).length;
    const audioReferences = this.sessionData.audioScoreAssignments
      .filter(item => item.sourceId === source.id).length;
    const references = visualReferences + audioReferences;
    if (references > 0 && this.sourceRemovalArmedId !== source.id) {
      this.sourceRemovalArmedId = source.id;
      if (this.sourceRemovalTimer) clearTimeout(this.sourceRemovalTimer);
      if (button) {
        button.textContent = 'Confirm';
        button.setAttribute('aria-label', `Confirm removal of ${source.name} and ${references} media clips`);
        button.focus({ preventScroll: true });
      }
      const breakdown = [
        visualReferences ? `${visualReferences} visual` : '',
        audioReferences ? `${audioReferences} audio` : ''
      ].filter(Boolean).join(' and ');
      this.announce(`${source.name} is used by ${breakdown} clip${references === 1 ? '' : 's'}. Activate Confirm to remove the source and those clips.`);
      this.sourceRemovalTimer = setTimeout(() => {
        this.sourceRemovalArmedId = null;
        this.sourceRemovalTimer = null;
        if (button?.isConnected) {
          button.textContent = button.closest('#studio-source-inspector') ? 'Remove source and its clips' : '✕';
          button.setAttribute('aria-label', `Remove ${source.name}`);
        }
      }, 5000);
      return false;
    }
    if (this.sourceRemovalTimer) clearTimeout(this.sourceRemovalTimer);
    this.sourceRemovalTimer = null;
    this.sourceRemovalArmedId = null;
    this.removeSource(index);
    this.announce(`${source.name} removed${references ? ` with ${visualReferences} visual and ${audioReferences} audio clip${references === 1 ? '' : 's'}` : ''}.`);
    return true;
  }

  selectCombinedAssignments(visualId, audioId) {
    if (this.pendingScoreSelection) return false;
    const visual = this.sessionData.visualScoreAssignments.find(item => item.id === visualId);
    const audio = this.sessionData.audioScoreAssignments.find(item => item.id === audioId);
    if (!visual || !audio || visual.sourceId !== audio.sourceId) return false;
    this.activeScoreSourceId = visual.sourceId;
    this.selectedScoreAssignmentId = visual.id;
    this.selectedAudioAssignmentId = audio.id;
    this.selectedScoreAssetId = visual.assetId;
    this.selectedAudioAssetId = audio.assetId;
    this.selectedEditorAssetId = this.editorAssetIdForScoreAsset(visual.assetId);
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.inspectorContext = normalizeInspectorContext({
      kind: 'combinedClip', visualId: visual.id, audioId: audio.id
    });
    this.refreshVisualScoreView();
    this.scrollInspectorClipIntoView(visual.id);
    this.announce('Synchronized visual and audio clips selected. Both are available in the Inspector.');
    if (this.studioViewport !== 'desktop') this.setStudioSurface('inspector');
    return true;
  }

  eraseAudioAssignment(assignmentId) {
    const assignments = eraseAudioSpan(this.sessionData.audioScoreAssignments, assignmentId);
    const selectedAfter = this.selectedAudioAssignmentId === assignmentId ? null : this.selectedAudioAssignmentId;
    this.commitAudioScoreCommand('erase', assignments, selectedAfter);
    if (this.scoreConfirmationAssignmentId === assignmentId) this.scoreConfirmationAssignmentId = null;
    this.pendingScoreConflict = null;
    this.refreshVisualScoreView();
    this.updateSequencePicker();
    this.announce('Audio assignment erased. Undo is available.');
    return true;
  }

  replaceAudioAssignmentAsset(assignmentId = this.selectedAudioAssignmentId) {
    const assignment = this.sessionData.audioScoreAssignments.find(item => item.id === assignmentId);
    const asset = this.selectedAudioScoreAsset();
    if (!assignment || !asset || assignment.assetId === asset.id || assignment.lane !== asset.lane) return false;
    const assignments = this.sessionData.audioScoreAssignments.map(item => item.id === assignmentId
      ? Object.freeze({ ...item, assetId: asset.id, lane: asset.lane }) : item);
    this.commitAudioScoreCommand('replace-asset', assignments, assignmentId);
    this.scoreConfirmationAssignmentId = assignmentId;
    this.refreshVisualScoreView();
    return true;
  }

  undoAutomaticScoredActivation() {
    if (!this.scoredActivationUndo?.visualConfig) return false;
    this.sessionData.visualConfig = cloneSessionData(this.scoredActivationUndo.visualConfig);
    this.scoredActivationUndo = null;
    this.markEditorDirty();
    this.refreshVisualLibraryAndInspector();
    this.updateVisualScoreEditor();
    this.updateSequencePicker();
    this.announce('Automatic Scored activation undone. The passage visual remains authored.');
    return true;
  }

  selectScoreAssignment(assignmentId) {
    if (this.pendingScoreSelection) return;
    const assignment = this.sessionData.visualScoreAssignments.find(item => item.id === assignmentId);
    if (!assignment) return;
    this.activeScoreSourceId = assignment.sourceId;
    this.selectedScoreAssetId = assignment.assetId;
    this.selectedEditorAssetId = this.editorAssetIdForScoreAsset(assignment.assetId);
    this.selectedScoreAssignmentId = assignment.id;
    this.pendingScoreSelection = null;
    this.pendingScoreConflict = null;
    this.scoreConfirmationAssignmentId = null;
    this.inspectorContext = normalizeInspectorContext({ kind: 'visualClip', id: assignment.id });
    this.refreshVisualScoreView();
    this.refreshSelectionActionBar();
    this.scrollInspectorClipIntoView(assignment.id);
    this.announce('Visual clip selected. Its asset and passage are available in the Inspector.');
    if (this.studioViewport !== 'desktop') this.setStudioSurface('inspector');
    return true;
  }

  eraseScoreAssignment(assignmentId) {
    const assignments = eraseVisualSpan(this.sessionData.visualScoreAssignments, assignmentId);
    const selectedAfter = this.selectedScoreAssignmentId === assignmentId
      ? null
      : this.selectedScoreAssignmentId;
    this.commitVisualScoreCommand('erase', assignments, selectedAfter);
    this.pendingScoreConflict = null;
    if (this.scoreConfirmationAssignmentId === assignmentId) {
      this.scoreConfirmationAssignmentId = null;
    }
    this.refreshVisualScoreView();
    this.announce('Visual assignment erased. Undo is available.');
    this.updateSequencePicker();
  }

  prepareSessionPayload(data = this.sessionData) {
    const payload = cloneSessionData(data);
    payload.customVisuals = (payload.sequenceVisualAssets || [])
      .filter(asset => asset.kind !== 'video')
      .map(asset => asset.uri)
      .filter(uri => typeof uri === 'string'
        && (uri.startsWith('data:image/') || uri.startsWith('blob:')));
    // Proposed Live Curator imports are score authority — do not recompile
    // over them from editor assignments, and do not drop them when empty.
    if (payload.experienceProgram?.authority === 'proposed') {
      return payload;
    }
    if ((payload.visualScoreAssignments || []).length > 0
      || (payload.audioScoreAssignments || []).length > 0) {
      const audioAssets = [...new Set((payload.audioScoreAssignments || []).map(item => item.assetId))]
        .map(id => audioScoreAssetFromId(id, this.personalSwells)).filter(Boolean);
      payload.experienceProgram = compileWorkshopScoreProgram({
        programId: payload.experienceProgramId,
        sources: this.scoreSources(payload),
        visualAssets: this.visualScoreAssets(),
        visualAssignments: payload.visualScoreAssignments || [],
        audioAssets,
        audioAssignments: payload.audioScoreAssignments || [],
        visualFallback: visualFallbackCueFromConfig(payload.visualConfig)
      });
      const assignedKinds = new Set(payload.visualScoreAssignments.map(item =>
        this.scoreAsset(item.assetId)?.entry.asset.kind).filter(Boolean));
      const sourceFamily = assignedKinds.size > 1 ? 'blend'
        : assignedKinds.has('procedural') ? 'procedural'
          : assignedKinds.has('sourced-collection') ? 'collections' : 'personal';
      payload.visualConfig = {
        ...payload.visualConfig,
        interlocution: {
          ...(payload.visualConfig?.interlocution || {}),
          sourceFamily
        }
      };
    } else if (['workshop-visual-score', 'workshop-media-score']
      .includes(payload.experienceProgram?.metadata?.kind)) {
      delete payload.experienceProgram;
    }
    return payload;
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.audioPreview.stop();
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Form submission
    const form = this.container.querySelector('#workshop-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      window.rise?.audioEngine?.playClick();
      void this.createSession();
    });
    const syncSequenceManager = (event) => {
      const ephemeral = event.target?.matches?.('#visual-asset-search');
      const clickChangesEditor = event.type === 'click' && event.target.closest(
        '[data-curve], [data-chunk], [data-mode], '
        + '[data-action="remove-source"], [data-action="remove-visual"], '
        + '[data-action="move-up"], [data-action="move-down"]'
      );
      if (!ephemeral && (event.type === 'input' || event.type === 'change' || clickChangesEditor)) {
        this.markEditorDirty();
      }
      queueMicrotask(() => {
      if (this.container.querySelector('#workshop-sequence-select')) {
        this.updateSequencePicker();
      }
      });
    };
    form?.addEventListener('input', syncSequenceManager);
    form?.addEventListener('change', syncSequenceManager);
    form?.addEventListener('click', syncSequenceManager);

    if (this.boundVisualAssetInputHandler) {
      this.container.removeEventListener('input', this.boundVisualAssetInputHandler);
      this.container.removeEventListener('change', this.boundVisualAssetInputHandler);
    }
    this.boundVisualAssetInputHandler = (event) => {
      if (event.target.matches('#session-title')) {
        this.sessionData.title = event.target.value;
        this.updateCreateButton();
        return;
      }
      if (event.type === 'change' && event.target.matches('input[name="intent"]')) {
        this.sessionData.intent = event.target.value;
        return;
      }
      if (event.target.matches('#wpm-slider')) {
        this.sessionData.wpm = Number.parseInt(event.target.value, 10);
        this.refreshReadingStudio();
        return;
      }
      if (event.type === 'change' && event.target.matches('[data-passage-asset-picker]')) {
        // Choosing a shared image is a request to bring it in. Copy first,
        // then select the project asset the copy produced, so the passage
        // names something this sequence owns.
        const chosen = this.visualAssetEntries().find(item => item.asset.id === event.target.value);
        if (chosen?.materialization) {
          void this.materializeEditorAsset(event.target.value).then(copied => {
            if (copied) this.refreshScoreSelectionUi();
          });
          return;
        }
        this.selectEditorAsset(event.target.value, { navigate: false });
        return;
      }
      if (event.type === 'change' && event.target.matches('[data-passage-audio-picker]')) {
        this.selectPassageAudioAsset(event.target.value);
        return;
      }
      if (event.target.matches('#visual-asset-search')) {
        this.visualAssetSearch = event.target.value.slice(0, 120);
        const registry = this.container.querySelector('#visual-assets-list');
        if (registry) registry.innerHTML = this.renderVisualAssetRegistry();
        return;
      }
      const styleSetting = event.target.dataset.visualStyleSetting;
      if (styleSetting) {
        if (event.type !== 'change') return;
        const assetId = event.target.closest('[data-style-asset-id]')?.dataset.styleAssetId;
        if (assetId) {
          this.updateVisualStyleSetting(assetId, styleSetting, event.target.value, event.target.checked);
        }
        return;
      }
      const setting = event.target.dataset.visualSetting;
      if (!setting) return;
      if (setting === 'focal-glyph' && event.target.value === 'personal') {
        this.openPersonalFocalChooser('surface:focal', 'whole-reading');
        return;
      }
      this.updateVisualSetting(setting, event.target.value, event.target.checked);
      if (setting === 'gallery-cadence') {
        const cadence = normalizeGalleryCadence(event.target.value);
        event.target.setAttribute('aria-valuetext', galleryCadenceValueText(cadence));
        const value = this.container.querySelector('[data-gallery-cadence-value]');
        if (value) value.textContent = formatGalleryCadence(cadence);
      }
      if (event.type === 'change' && ['focal-glyph', 'focal-rose-mode', 'attractor-system',
        'attractor-palette', 'attractor-form', 'genesis-preset', 'genesis-glass'].includes(setting)) {
        this.refreshVisualLibraryAndInspector();
      }
    };
    this.container.addEventListener('input', this.boundVisualAssetInputHandler);
    this.container.addEventListener('change', this.boundVisualAssetInputHandler);

    this.container.querySelector('#workshop-sequence-select')?.addEventListener('change', (event) => {
      window.rise?.audioEngine?.playHiss();
      this.handleSequenceSelection(event.target.value);
    });

    // Title input
    const titleInput = this.container.querySelector('#session-title');
    titleInput?.addEventListener('input', (e) => {
      this.sessionData.title = e.target.value;
      this.updateCreateButton();
    });

    // Intent radios
    const intentRadios = this.container.querySelectorAll('input[name="intent"]');
    intentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.intent = e.target.value;
      });
    });

    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmValue = this.container.querySelector('#wpm-value');
    wpmSlider?.addEventListener('input', (e) => {
      this.sessionData.wpm = parseInt(e.target.value);
      if (wpmValue) {
        wpmValue.textContent = `${this.sessionData.wpm} WPM`;
      }
      this.refreshReadingStudio();
    });

    // Curve buttons
    this.container.querySelectorAll('[data-curve]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.curve = btn.dataset.curve;
        this.refreshReadingStudio();
      });
    });

    // Chunking buttons
    this.container.querySelectorAll('[data-chunk]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.chunkMode = btn.dataset.chunk;
        this.refreshReadingStudio();
      });
    });

    // Display mode buttons
    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.displayMode = btn.dataset.mode;
        this.updateActiveButtons('[data-mode]', btn);
      });
    });

    // Source actions and Import
    const fileInput = this.container.querySelector('#file-import-input');
    const imageInput = this.container.querySelector('#image-import-input');
    const personalFocalInput = this.container.querySelector('#personal-focal-import-input');
    const globalInput = this.container.querySelector('#global-import-input');
    const programInput = this.container.querySelector('#program-import-input');
    
    fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    imageInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    personalFocalInput?.addEventListener('change', (e) => this.handlePersonalFocalUpload(e));
    globalInput?.addEventListener('change', (e) => this.handleGlobalUpload(e));
    programInput?.addEventListener('change', (e) => {
      void this.handleProgramFileImport(e);
    });
    const personalSwellInput = this.container.querySelector('#personal-swell-input');
    personalSwellInput?.addEventListener('change', (e) => this.handlePersonalSwellUpload(e));

    if (this.boundContainerClickHandler) {
      this.container.removeEventListener('click', this.boundContainerClickHandler);
    }
    this.boundContainerClickHandler = (e) => {
      const openProjectMenu = this.container.querySelector('.studio-project-menu[open]');
      if (openProjectMenu && !e.target.closest('.studio-project-menu')) {
        openProjectMenu.removeAttribute('open');
      }
      const target = e.target.closest('[data-action]');
      if (!target) return;

      target.closest('.studio-project-menu')?.removeAttribute('open');

      const action = target.dataset.action;
      if (action === 'open-browser') {
        window.rise?.audioEngine?.playHiss();
        this.openSourceBrowser();
      } else if (action === 'import-file') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        if (fileInput) fileInput.click();
      } else if (action === 'export-experience-program') {
        window.rise?.audioEngine?.playHiss();
        this.exportExperienceProgramFile();
      } else if (action === 'export-mp4') {
        window.rise?.audioEngine?.playHiss();
        void this.exportMp4();
      } else if (action === 'import-experience-program') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        void this.promptImportExperienceProgram(programInput);
      } else if (action === 'upload-image') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        if (imageInput) imageInput.click();
      } else if (action === 'upload-personal-focal') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        this.pendingPersonalFocalUploadTarget = target.dataset.focalTarget
          || this.inferPersonalFocalTarget();
        if (personalFocalInput) personalFocalInput.click();
      } else if (action === 'toggle-personal-focal-projects') {
        const targetKind = target.dataset.focalTarget || this.inferPersonalFocalTarget();
        const current = this.personalFocalChooser || {
          assetId: 'surface:focal', target: targetKind, expanded: false
        };
        this.personalFocalChooser = {
          assetId: current.assetId || 'surface:focal',
          target: targetKind,
          expanded: !(current.target === targetKind && current.expanded)
        };
        this.refreshVisualLibraryAndInspector();
        this.refreshScoreSelectionUi();
      } else if (action === 'choose-personal-focal') {
        void this.applyPersonalFocalAsset(
          target.dataset.projectAssetId,
          target.dataset.focalTarget || this.inferPersonalFocalTarget()
        );
      } else if (action === 'remove-personal-focal-default') {
        this.removePersonalFocalDefault();
      } else if (action === 'upload-global-image') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        if (globalInput) globalInput.click();
      } else if (action === 'upload-personal-swell') {
        window.rise?.audioEngine?.playHiss();
        this.fileDialogReturnFocus = target;
        if (personalSwellInput) personalSwellInput.click();
      } else if (action === 'show-studio-surface') {
        this.setStudioSurface(target.dataset.studioSurfaceTarget, { origin: target });
      } else if (action === 'show-score-surface') {
        this.setStudioSurface('score', { origin: target });
      } else if (action === 'show-project-inspector') {
        this.setInspectorContext({ kind: 'project' }, { navigate: true, focus: true });
      } else if (action === 'dismiss-workshop-issue') {
        this.workshopIssue = null;
        this.setInspectorContext({ kind: 'project' }, { navigate: true, focus: true });
      } else if (action === 'inspect-source') {
        this.activeScoreSourceId = target.dataset.sourceId;
        this.selectedScoreAssignmentId = null;
        this.selectedAudioAssignmentId = null;
        this.pendingScoreSelection = null;
        this.pendingScoreConflict = null;
        this.updateVisualScoreEditor();
        this.setInspectorContext({ kind: 'source', id: target.dataset.sourceId }, { navigate: true, focus: true });
      } else if (action === 'select-sequence-map-source') {
        this.activeScoreSourceId = target.dataset.sourceId;
        this.selectedScoreAssignmentId = null;
        this.selectedAudioAssignmentId = null;
        this.pendingScoreSelection = null;
        this.pendingScoreConflict = null;
        this.updateVisualScoreEditor();
        this.setInspectorContext({ kind: 'source', id: target.dataset.sourceId });
        if (this.studioViewport !== 'desktop') this.setStudioSurface('score', { focus: false });
      } else if (action === 'select-sequence-map-entry') {
        this.selectSequenceMapEntry(target.dataset.visualAssignmentId || null, target.dataset.audioAssignmentId || null);
      } else if (action === 'set-reading-curve') {
        this.sessionData.curve = target.dataset.curve;
        this.markEditorDirty();
        this.refreshReadingStudio();
        this.updateSequencePicker();
      } else if (action === 'set-reading-chunk') {
        this.sessionData.chunkMode = target.dataset.chunk;
        this.markEditorDirty();
        this.refreshReadingStudio();
        this.updateSequencePicker();
      } else if (action === 'close-studio-surface') {
        this.closeStudioSurface();
      } else if (action === 'choose-score-asset') {
        this.setAssetLane(target.dataset.scoreLane || this.scoreAuthoringLane());
        this.setStudioSurface('assets', { origin: target });
      } else if (action === 'cancel-score-selection') {
        this.cancelPendingScoreSelection();
      } else if (action === 'set-asset-lane') {
        this.setAssetLane(target.dataset.assetLane);
      } else if (action === 'set-score-view') {
        this.scoreView = ['visual', 'audio', 'combined'].includes(target.dataset.scoreView)
          ? target.dataset.scoreView : 'visual';
        if (this.scoreView !== 'combined') this.setAssetLane(this.scoreView);
        this.pendingScoreSelection = null;
        this.pendingScoreConflict = null;
        this.updateVisualScoreEditor();
      } else if (action === 'select-audio-asset') {
        this.selectAudioAsset(target.dataset.audioAssetId);
      } else if (action === 'select-personal-swell-asset') {
        this.selectAudioAsset(`swell:${target.dataset.id}`);
      } else if (action === 'apply-audio-default') {
        this.applySelectedAudioDefault();
      } else if (action === 'preview-audio-default') {
        void this.previewSelectedAudioDefault();
      } else if (action === 'stop-audio-preview') {
        this.audioPreview.stop();
      } else if (action === 'remove-source') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.requestSourceRemoval(index, target);
      } else if (action === 'remove-visual') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.requestSequenceVisualAssetRemoval(index, target);
      } else if (action === 'filter-visual-assets') {
        this.visualAssetGroup = target.dataset.assetGroup || 'all';
        this.refreshVisualLibraryAndInspector();
      } else if (action === 'clear-asset-filters') {
        this.visualAssetGroup = 'all';
        this.visualAssetSearch = '';
        const search = this.container.querySelector('#visual-asset-search');
        if (search) search.value = '';
        this.refreshVisualLibraryAndInspector();
      } else if (action === 'select-editor-asset') {
        this.selectEditorAsset(target.dataset.editorAssetId);
      } else if (action === 'materialize-editor-asset') {
        void this.materializeEditorAsset(target.dataset.editorAssetId);
      } else if (action === 'replace-score-asset') {
        this.replaceScoreAssignmentAsset(target.dataset.assignmentId);
      } else if (action === 'set-editor-asset-default') {
        void this.setEditorAssetDefault(target.dataset.editorAssetId);
      } else if (action === 'set-visual-surface') {
        void this.setVisualSurface(target.dataset.visualSurface);
      } else if (action === 'set-scored-presentation') {
        this.sessionData.visualConfig.interlocution = {
          ...(this.sessionData.visualConfig.interlocution || {}),
          presentation: target.dataset.presentation
        };
        this.markEditorDirty();
        this.refreshVisualLibraryAndInspector();
        this.updateSequencePicker();
      } else if (action === 'select-score-asset') {
        this.selectedScoreAssetId = target.dataset.assetId;
        this.selectedScoreAssignmentId = null;
        this.refreshVisualScoreView();
      } else if (action === 'assign-score-selection') {
        if (this.scoreAuthoringLane() === 'audio') this.assignPendingAudioScore('reject');
        else this.assignPendingVisualScore('reject');
      } else if (action === 'assign-score-stillness') {
        this.assignIntentionalStillness();
      } else if (action === 'assign-score-lane') {
        this.assignPendingCombinedLane(target.dataset.scoreLane, 'reject');
      } else if (action === 'replace-score-overlap') {
        const conflictLane = target.dataset.scoreLane || this.pendingScoreConflict?.scoreLane || this.scoreAuthoringLane();
        if (this.scoreView === 'combined') this.assignPendingCombinedLane(conflictLane, 'replace');
        else if (conflictLane === 'audio') this.assignPendingAudioScore('replace');
        else this.assignPendingVisualScore('replace');
      } else if (action === 'replace-score-confirmation') {
        this.replaceScoreAssignmentAsset(target.dataset.assignmentId);
      } else if (action === 'preview-score-assignment') {
        const assignmentId = target.dataset.assignmentId;
        this.selectScoreAssignment(assignmentId);
        this.scoreConfirmationAssignmentId = assignmentId;
        this.refreshScoreSelectionUi();
        this.scrollInspectorClipIntoView(assignmentId, { focus: true });
      } else if (action === 'preview-audio-assignment') {
        const assignmentId = target.dataset.assignmentId;
        if (this.selectAudioAssignment(assignmentId)) {
          this.scrollInspectorClipIntoView(assignmentId, { focus: true });
          void this.previewSelectedAudioDefault();
        }
      } else if (action === 'dismiss-score-confirmation') {
        this.scoreConfirmationAssignmentId = null;
        this.refreshScoreSelectionUi();
      } else if (action === 'undo-scored-activation') {
        this.undoAutomaticScoredActivation();
      } else if (action === 'undo-visual-score') {
        this.undoVisualScore();
      } else if (action === 'redo-visual-score') {
        this.redoVisualScore();
      } else if (action === 'undo-active-score') {
        if (this.scoreAuthoringLane() === 'audio') this.undoAudioScore();
        else this.undoVisualScore();
      } else if (action === 'redo-active-score') {
        if (this.scoreAuthoringLane() === 'audio') this.redoAudioScore();
        else this.redoVisualScore();
      } else if (action === 'undo-score-lane') {
        if (target.dataset.scoreLane === 'audio') this.undoAudioScore();
        else this.undoVisualScore();
      } else if (action === 'redo-score-lane') {
        if (target.dataset.scoreLane === 'audio') this.redoAudioScore();
        else this.redoVisualScore();
      } else if (action === 'select-score-assignment') {
        this.selectScoreAssignment(target.dataset.assignmentId);
      } else if (action === 'select-audio-assignment') {
        this.selectAudioAssignment(target.dataset.assignmentId);
      } else if (action === 'select-combined-assignment') {
        this.selectCombinedAssignments(target.dataset.visualAssignmentId, target.dataset.audioAssignmentId);
      } else if (action === 'erase-score-assignment') {
        this.eraseScoreAssignment(target.dataset.assignmentId);
      } else if (action === 'erase-audio-assignment') {
        this.eraseAudioAssignment(target.dataset.assignmentId);
      } else if (action === 'erase-active-score-assignment') {
        if (this.scoreAuthoringLane() === 'audio') this.eraseAudioAssignment(this.selectedAudioAssignmentId);
        else this.eraseScoreAssignment(this.selectedScoreAssignmentId);
      } else if (action === 'replace-active-score-asset') {
        if (this.scoreAuthoringLane() === 'audio') this.replaceAudioAssignmentAsset();
        else this.replaceScoreAssignmentAsset(this.selectedScoreAssignmentId);
      } else if (action === 'preview-audio-score-asset') {
        void this.previewSelectedAudioDefault();
      } else if (action === 'remove-global') {
        window.rise?.audioEngine?.playHiss();
        MemoryCore.removeGlobalImage(target.dataset.globalId);
        this.refreshVisualLibraryAndInspector();
      } else if (action === 'move-up') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.swapSources(index, index - 1);
      } else if (action === 'move-down') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.swapSources(index, index + 1);
      } else if (action === 'preview-source') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.showSourcePreview(index);
      } else if (action === 'preview-personal-swell') {
        this.selectAudioAsset(`swell:${target.dataset.id}`);
        void this.previewSelectedAudioDefault();
      } else if (action === 'remove-personal-swell') {
        window.rise?.audioEngine?.playHiss();
        const id = target.dataset.id;
        this.removePersonalSwell(id);
      } else if (action === 'save-draft') {
        window.rise?.audioEngine?.playHiss();
        void this.saveSequenceToVault();
      } else if (action === 'reset-workshop') {
        window.rise?.audioEngine?.playHiss();
        this.armOrResetSequence();
      } else if (action === 'preview') {
        this.audioPreview.stop();
        window.rise?.audioEngine?.playHiss();
        try {
          const preview = this.prepareSessionPayload(this.sessionData);
          preview.isPreview = true;
          preview.visualConfig = {
            ...preview.visualConfig,
            consentScope: this.visualConsentScope
          };
          this.workshopIssue = null;
          this.onCreateSession(preview);
        } catch (error) {
          this.showToast(error.message || 'Unable to compile the visual score');
          this.setWorkshopIssue(error.code || 'PREVIEW_COMPILE_FAILED', error.message || 'Unable to compile the media score', {
            action: 'show-project-inspector', label: 'Review project'
          });
        }
      } else if (action === 'focus-reading-inspector') {
        this.setInspectorContext({ kind: 'pacing' }, { navigate: true, focus: true });
      }
    };
    this.container.addEventListener('click', this.boundContainerClickHandler);

    if (this.boundContainerKeydownHandler) {
      this.container.removeEventListener('keydown', this.boundContainerKeydownHandler);
    }
    this.boundContainerKeydownHandler = event => this.handleStudioKeydown(event);
    this.container.addEventListener('keydown', this.boundContainerKeydownHandler);

    window.removeEventListener('resize', this.boundResizeHandler);
    window.addEventListener('resize', this.boundResizeHandler, { passive: true });
    this.syncStudioSurface();

    // Drag and drop for images
    this.attachDragDropEvents();
    this.attachVisualScoreEvents();
  }

  /**
   * Setup drag and drop event handlers for image upload
   */
  attachDragDropEvents() {
    const dropZone = this.container.querySelector('#visual-drop-zone');
    if (!dropZone) return;

    // Prevent default drag behaviors on window to allow drop zone to work
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, preventDefaults);
    });

    // Visual feedback on drag
    const highlight = () => {
      dropZone.classList.add('drag-over');
      this.isDragging = true;
    };

    const unhighlight = () => {
      dropZone.classList.remove('drag-over');
      this.isDragging = false;
    };

    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, highlight);
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, unhighlight);
    });

    // Handle drop
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Process each file
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          this.processDroppedImage(file);
        } else if (file.type === 'video/mp4') {
          void this.processDroppedVideo(file);
        }
      });
    });
  }

  /**
   * Process a dropped image file
   */
  processDroppedImage(file) {
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      this.showToast('Images must be 8 MB or smaller');
      return;
    }
    if (this.sessionData.sequenceVisualAssets.length >= MAX_CUSTOM_VISUALS) {
      this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
      return;
    }
    this.addSequenceVisualAssetFromBlob(file, file.name);
    this.updateVisualAssetsList();
    this.updateCreateButton();
  }

  async processDroppedVideo(file) {
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      this.showToast('MP4 files must be 96 MB or smaller');
      return;
    }
    try {
      const durationMs = await probeVideoDurationMs(file);
      if (this.addSequenceVideoAssetFromBlob(file, file.name, durationMs)) {
        this.updateVisualAssetsList();
        this.updateCreateButton();
      }
    } catch {
      this.showToast('Could not read MP4 metadata');
    }
  }

  handleStudioKeydown(event) {
    const actionTarget = event.target.closest?.('[data-action]:not(button)');
    if (actionTarget && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      actionTarget.click();
      return;
    }

    const tab = event.target.closest?.('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]:not(:disabled)')];
      const index = tabs.indexOf(tab);
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[nextIndex]?.focus();
      tabs[nextIndex]?.click();
      return;
    }

    const option = event.target.closest?.('[role="option"]');
    if (!option || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const listbox = option.closest('[role="listbox"]');
    if (!listbox) return;
    const options = [...listbox.querySelectorAll('[role="option"]:not(:disabled)')];
    const index = options.indexOf(option);
    const backwards = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? options.length - 1
        : (index + (backwards ? -1 : 1) + options.length) % options.length;
    event.preventDefault();
    options.forEach((item, itemIndex) => item.tabIndex = itemIndex === nextIndex ? 0 : -1);
    options[nextIndex]?.focus();
  }

  handleKeyboard(e) {
    const target = e.target;
    const editingText = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !editingText
      && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const keyboardLane = this.scoreView === 'combined' ? this.lastScoreMutationLane : this.scoreAuthoringLane();
      if (keyboardLane === 'audio') {
        if (e.shiftKey) this.redoAudioScore();
        else this.undoAudioScore();
      } else if (e.shiftKey) this.redoVisualScore();
      else this.undoVisualScore();
      return;
    }
    if (e.key === 'Escape') {
      if (this.sourcePreviewModal) {
        e.preventDefault();
        this.closeSourcePreview?.();
        return;
      }
      if (this.scoreConfirmationAssignmentId) {
        e.preventDefault();
        this.scoreConfirmationAssignmentId = null;
        this.refreshScoreSelectionUi();
        return;
      }
      if (this.studioViewport !== 'desktop' && this.studioSurface !== 'score') {
        e.preventDefault();
        this.closeStudioSurface();
        return;
      }
      if (this.pendingScoreSelection || this.pendingScoreConflict) {
        e.preventDefault();
        this.cancelPendingScoreSelection();
        return;
      }
      this.onNavigate('portal');
    } else if (window.rise?.audioEngine && !e.repeat && e.key && e.key.length === 1) {
      // Trigger sound for alphanumeric/symbol keys
      window.rise.audioEngine.playKeyPress(e.keyCode);
    }
  }

  activate() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('keydown', this.boundKeyboardHandler);
    document.addEventListener('selectionchange', this.boundSelectionChangeHandler);
    const selected = this.selectedVisualAssetEntry();
    if (selected?.asset.editor.preview.kind === 'sample') {
      void this.ensureCollectionPreview(selected);
    }
    void MemoryCore.getWorkshopBlueprintsHydrated().then((views) => {
      if (!this._active) return;
      this.savedBlueprints = views;
      this.updateSequencePicker?.();
      this.refreshVisualLibraryAndInspector?.();
    });
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
    document.removeEventListener('selectionchange', this.boundSelectionChangeHandler);
    if (this.visualSelectionCaptureTimer) {
      clearTimeout(this.visualSelectionCaptureTimer);
      this.visualSelectionCaptureTimer = null;
    }
    this.visualSelectionPointerDown = false;
    this.audioPreview.stop();
  }

  restoreFileDialogFocus() {
    const origin = this.fileDialogReturnFocus;
    this.fileDialogReturnFocus = null;
    requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    });
  }

  async handlePersonalFocalUpload(event) {
    this.restoreFileDialogFocus();
    const input = event.target;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) {
      this.pendingPersonalFocalUploadTarget = null;
      return false;
    }
    const target = this.pendingPersonalFocalUploadTarget || this.inferPersonalFocalTarget();
    this.pendingPersonalFocalUploadTarget = null;
    const asset = this.addSequenceVisualAssetFromBlob(file, file.name, {
      origin: 'personal-focal-upload',
      provider: 'Project Media'
    });
    if (!asset) return false;
    this.updateVisualAssetsList();
    this.updateCreateButton();
    await this.applyPersonalFocalAsset(asset.id, target);
    this.showToast(`${asset.name} added to Project Media`);
    return true;
  }

  async handleFileUpload(event) {
    this.restoreFileDialogFocus();
    const file = event.target.files[0];
    if (!file) return;

    // Check if the file is an image
    if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_FILE_BYTES) {
            this.showToast('Images must be 8 MB or smaller');
            event.target.value = '';
            return;
        }
        if (this.sessionData.sequenceVisualAssets.length >= MAX_CUSTOM_VISUALS) {
            this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
            event.target.value = '';
            return;
        }
        this.addSequenceVisualAssetFromBlob(file, file.name);
        this.updateVisualAssetsList();
        this.updateCreateButton();
        event.target.value = '';
        return;
    }

    if (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
      if (file.type !== 'video/mp4') {
        this.showToast('Sequence video must be an MP4 file');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_VIDEO_FILE_BYTES) {
        this.showToast('MP4 files must be 96 MB or smaller');
        event.target.value = '';
        return;
      }
      try {
        const durationMs = await probeVideoDurationMs(file);
        this.addSequenceVideoAssetFromBlob(file, file.name, durationMs);
        this.updateVisualAssetsList();
        this.updateCreateButton();
      } catch {
        this.showToast('Could not read MP4 metadata');
      }
      event.target.value = '';
      return;
    }

    if (file.size > MAX_TEXT_FILE_BYTES) {
      this.showToast('Text files must be 2 MB or smaller');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    // Handle text parsing
    reader.onload = (e) => {
      let text = e.target.result;
      
      // Basic JSON unpacking if the user uploaded a raw JSON block
      if (file.name.endsWith('.json')) {
         try {
             const parsed = JSON.parse(text);
             // Attempt to heuristically flatten JSON values if it's an array or object
             if (Array.isArray(parsed)) {
                 text = parsed.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' ');
             } else if (typeof parsed === 'object') {
                 text = Object.values(parsed).filter(v => typeof v === 'string').join(' ');
             }
         } catch(err) {
             console.log('[Workshop] JSON parse failed, injecting as raw string.');
         }
      }

      this.addSource({
        id: `local-${Date.now()}`,
        name: file.name,
        type: file.type || 'text/plain',
        data: text,
        metadata: { source: 'local-file' }
      }, { id: 'local', name: 'Local File' });

      // Reset the input so the same file could be uploaded again if needed
      event.target.value = '';
    };
    reader.onerror = () => {
      console.error('[Workshop] Failed to read file.');
    };
    
    reader.readAsText(file);
  }

  updateActiveButtons(selector, activeBtn) {
    this.container.querySelectorAll(selector).forEach(btn => {
      btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
  }

  removeSource(index) {
    const [removed] = this.sessionData.sources.splice(index, 1);
    if (removed) {
      this.sessionData.visualScoreAssignments = this.sessionData.visualScoreAssignments
        .filter(item => item.sourceId !== removed.id);
      this.sessionData.audioScoreAssignments = this.sessionData.audioScoreAssignments
        .filter(item => item.sourceId !== removed.id);
      if (this.activeScoreSourceId === removed.id) {
        this.activeScoreSourceId = this.sessionData.sources[0]?.id || null;
      }
      this.selectedScoreAssignmentId = null;
      this.selectedAudioAssignmentId = null;
      this.pendingScoreSelection = null;
      this.pendingScoreConflict = null;
      if (this.inspectorContext.kind === 'source' && this.inspectorContext.id === String(removed.id)) {
        this.inspectorContext = normalizeInspectorContext({ kind: 'project' });
      }
      this.markEditorDirty();
    }
    this.updateSourcesList();
    this.updateCreateButton();
    this.refreshContextualInspector();
    this.updateSequencePicker();
  }

  swapSources(indexA, indexB) {
    if (indexA < 0 || indexB < 0 || indexA >= this.sessionData.sources.length || indexB >= this.sessionData.sources.length) return;
    const temp = this.sessionData.sources[indexA];
    this.sessionData.sources[indexA] = this.sessionData.sources[indexB];
    this.sessionData.sources[indexB] = temp;
    this.updateSourcesList();
  }

  updateSourcesList() {
    const sourcesList = this.container.querySelector('#sources-list');
    if (sourcesList) {
      sourcesList.innerHTML = this.sessionData.sources.length === 0
        ? '<div class="empty-sources text-fog">No sources added yet</div>'
        : this.renderSources();
    }
    const sourceCount = this.sessionData.sources.length;
    this.container.querySelectorAll('[data-studio-source-count]').forEach(element => {
      element.textContent = element.dataset.studioSourceCount === 'label'
        ? `${sourceCount} source${sourceCount === 1 ? '' : 's'}`
        : String(sourceCount);
    });
    this.refreshReadingStudio();
    this.updateVisualScoreEditor();
    this.refreshContextualInspector();
  }

  refreshVisualScoreView() {
    this.refreshVisualLibraryAndInspector();
    this.updateVisualScoreEditor();
  }

  updateVisualAssetsList() {
    this.markEditorDirty();
    this.sessionData.customVisuals = this.sessionData.sequenceVisualAssets
      .filter(item => item.kind !== 'video')
      .map(item => item.uri)
      .filter(Boolean);
    this.refreshVisualLibraryAndInspector();
    this.updateSequencePicker();
    this.updateVisualScoreEditor();
  }

  updateCreateButton() {
    const createBtn = this.container.querySelector('#create-btn');
    const isLocked = this.sessionData.sources.length === 0;
    
    if (createBtn) {
      createBtn.disabled = isLocked;
    }

  }

  revokeLocalMediaUrls() {
    for (const url of this.localObjectUrls) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    this.localObjectUrls.clear();
    for (const asset of this.sessionData?.sequenceVisualAssets || []) {
      if (asset?.id) WorkshopMedia.revokeObjectUrl(asset.id);
    }
  }

  async persistSequenceToVault() {
    const payload = this.prepareSessionPayload(this.sessionData);
    delete payload.updatedAt;
    if (this.activeBlueprintId) {
      payload.id = this.activeBlueprintId;
    } else {
      delete payload.id;
    }

    const saved = await MemoryCore.saveWorkshopBlueprintAsync(payload, {
      blobs: this.pendingMediaBlobs
    });
    if (!saved?.id) return null;
    this.pendingMediaBlobs.clear();
    this.savedBlueprints = await MemoryCore.getWorkshopBlueprintsHydrated();

    const vault = window.rise?.router?.getViewInstance('vault');
    vault?.refreshBlueprints?.();
    return saved;
  }

  /**
   * The capability document an imported score is checked against — what this
   * Workshop can actually name. It is no longer exported from here; the
   * Scriptorium owns the curator loop (docs/vision/SCRIPTORIUM-SPEC.md §1),
   * and this is only
   * the gate for Import score.
   */
  buildCuratorContextFromSurface() {
    return exportCuratorContext({
      id: `workshop-${this.activeBlueprintId || this.sessionData.experienceProgramId || 'draft'}`,
      sources: this.sessionData.sources || [],
      assets: this.sessionData.sequenceVisualAssets || [],
      // ID AND NAME ONLY: a stored swell carries its audio blob, and the
      // capability document never embeds media bytes.
      swells: (this.personalSwells || [])
        .filter(swell => swell && typeof swell.id === 'string')
        .map(swell => ({ id: swell.id, name: swell.name }))
    });
  }

  exportExperienceProgramFile() {
    try {
      const payload = this.prepareSessionPayload(this.sessionData);
      if (!payload.experienceProgram) {
        this.showToast('Score a passage before exporting a program');
        return;
      }
      const text = serializeExperienceProgram(payload.experienceProgram);
      const id = payload.experienceProgram.id || 'experience-program';
      downloadJsonFile(`${id}.experience-program.json`, text);
      this.showToast('Experience Program exported');
    } catch (error) {
      this.showToast(error.message || 'Could not export Experience Program');
    }
  }

  buildExportKernelRequest() {
    const payload = this.prepareSessionPayload(this.sessionData);
    return kernelRequestFromWorkshopPayload(payload, {
      projectId: this.activeBlueprintId || payload.experienceProgramId,
      painter: 'chamber'
    });
  }

  setExportMp4Busy(busy) {
    this.exportMp4Busy = busy;
    const button = this.container.querySelector('[data-action="export-mp4"]');
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Exporting…' : 'Export MP4';
  }

  async kernelExportAvailable() {
    try {
      const response = await fetch(EXPORT_MP4_PATH, { method: 'GET' });
      if (!response.ok) return false;
      const body = await response.json();
      return body?.available === true;
    } catch {
      return false;
    }
  }

  downloadKernelRequest(request) {
    const id = request.program?.id || request.projectId || 'experience';
    const filename = `${id}.kernel-request.json`;
    downloadJsonFile(filename, `${JSON.stringify(request, null, 2)}\n`);
    return filename;
  }

  /**
   * Write a kernel request and invoke the same Node path as the CLI.
   * The browser does not grow ffmpeg. When the local export job is
   * absent, download the JSON for `npm run render:mp4`.
   */
  async exportMp4() {
    if (this.exportMp4Busy) return;
    let request;
    try {
      request = this.buildExportKernelRequest();
    } catch (error) {
      this.showToast(error.message || 'Could not export MP4');
      return;
    }
    if (!request) {
      this.showToast('Score a passage before exporting an MP4');
      return;
    }
    this.setExportMp4Busy(true);
    try {
      const available = await this.kernelExportAvailable();
      if (!available) {
        const filename = this.downloadKernelRequest(request);
        const command = renderCliCommand(filename);
        this.announce(`No local renderer. ${command}`);
        this.showToast(`No local renderer. ${command}`);
        return;
      }
      const response = await fetch(EXPORT_MP4_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        this.showToast(body.error || 'Export MP4 failed');
        this.announce(body.error || 'Export MP4 failed');
        return;
      }
      this.announce(`Wrote ${body.mp4Path}`);
      this.showToast(`Wrote ${body.mp4Path}`);
    } catch (error) {
      this.showToast(error.message || 'Export MP4 failed');
    } finally {
      this.setExportMp4Busy(false);
    }
  }

  formatProgramIoError(error, context = null) {
    if (!error) return 'Import refused';
    if (error.code) {
      try {
        return describeImportFailure(error, { context });
      } catch {
        return `${error.code}: ${error.message}`;
      }
    }
    return error.message || 'Import refused';
  }

  async promptImportExperienceProgram(programInput) {
    const choice = await this.showProgramImportChooser();
    if (choice === 'file') {
      if (programInput) programInput.click();
      return;
    }
    if (choice === 'paste') {
      const text = await this.showProgramPasteModal();
      if (text == null) return;
      await this.importExperienceProgramText(text);
    }
  }

  showProgramImportChooser() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'naming-modal-overlay';
      overlay.innerHTML = `
        <div class="naming-modal" role="dialog" aria-modal="true" aria-label="Import Experience Program">
          <h2 class="naming-modal-title">Import score</h2>
          <p class="naming-modal-subtitle">Paste or open a rise.experience-program.v1 JSON file. Imports land as proposed Vault drafts.</p>
          <div class="naming-modal-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:flex-end">
            <button type="button" class="btn-ghost" data-choice="cancel">Cancel</button>
            <button type="button" class="btn-secondary" data-choice="paste">Paste JSON</button>
            <button type="button" class="btn-primary" data-choice="file">Open file</button>
          </div>
        </div>`;
      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish(null);
        const button = event.target.closest('[data-choice]');
        if (!button) return;
        const choice = button.dataset.choice;
        finish(choice === 'cancel' ? null : choice);
      });
      document.body.appendChild(overlay);
      overlay.querySelector('[data-choice="file"]')?.focus();
    });
  }

  showProgramPasteModal() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'naming-modal-overlay';
      overlay.innerHTML = `
        <div class="naming-modal" role="dialog" aria-modal="true" aria-label="Paste Experience Program">
          <h2 class="naming-modal-title">Paste Experience Program</h2>
          <p class="naming-modal-subtitle">rise.experience-program.v1 JSON</p>
          <textarea class="input" id="program-paste-input" rows="14"
                    style="width:min(520px,80vw);max-width:100%;font-family:ui-monospace,monospace;font-size:0.8rem"
                    spellcheck="false"></textarea>
          <div class="naming-modal-actions" style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
            <button type="button" class="btn-ghost" data-choice="cancel">Cancel</button>
            <button type="button" class="btn-primary" data-choice="import">Import</button>
          </div>
        </div>`;
      const textarea = overlay.querySelector('#program-paste-input');
      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish(null);
        const button = event.target.closest('[data-choice]');
        if (!button) return;
        if (button.dataset.choice === 'cancel') finish(null);
        else finish(textarea?.value || '');
      });
      document.body.appendChild(overlay);
      textarea?.focus();
    });
  }

  async handleProgramFileImport(event) {
    const input = event.target;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await this.importExperienceProgramText(text);
    } catch (error) {
      this.showToast(this.formatProgramIoError(error));
    }
  }

  /**
   * Load the Library works an imported score names, beside the reader's own.
   *
   * THE SCRIPTORIUM'S RESOLVER, REUSED WHOLE. It is the thing that knows the
   * extent grammar — `work`, `work#12`, `work#12:200` — and knows that a cut
   * with no honest boundary within reach is a refusal rather than a longer
   * reading. A second copy of that here is how one door learns a new word and
   * the other never hears it, which is the defect this codebase keeps paying
   * for. Import score offers the Library in its capability document; this is
   * what makes the offer true.
   *
   * ORDER AND IDENTITY. The surface keeps its own order and its own copies,
   * first; the works the score names follow, in the order the score names
   * them. An id the surface already holds is NOT re-read from the Library —
   * a Scriptorium draft reopened here already carries `middlemarch#2:200` as
   * an ordinary source, and the reader's copy is the one the gate admitted
   * the score against (createCuratorSourceReader reads `context.sources`
   * before `context.library`).
   *
   * @param {object} program validated proposed program
   * @param {object[]} surfaceSources snapshot taken before the first await,
   *   so a surface edited mid-load cannot half-apply into the project
   * @param {object|null} context the capability document the gate used
   * @returns {Promise<object[]|null>} null when something the score named
   *   could not be loaded — the reader has been told which and why, and
   *   nothing has been changed.
   */
  async resolveImportedProgramSources(program, surfaceSources, context) {
    const held = new Set(surfaceSources.map(source => source?.id).filter(Boolean));
    const { sources, missing, refused, reasons } = await resolveProgramLibrarySources(program);

    // An id the surface supplies is not the Library's to miss: the resolver
    // is handed every source the score names, and `my-notes` is not a work.
    const absent = missing.filter(id => !held.has(id));
    const unreadable = refused.filter(id => !held.has(id));
    if (absent.length || unreadable.length) {
      // ONE WORDING, TWO DOORS. This reply used to be written here, in a
      // method the Scriptorium could not reach — so the room with the copyable
      // refusal panel said `Could not load: ulysses#18:200` and stopped. The
      // phrasing belongs beside every other refusal a curator can act on.
      this.showImportRefusal(describeImportFailure(
        unloadableLibrarySourcesError({ absent, unreadable, reasons }),
        { context }
      ));
      return null;
    }

    return [...surfaceSources, ...sources.filter(source => !held.has(source.id))];
  }

  /**
   * A refusal a reader can read twice and paste back to whoever wrote the
   * score. These texts are corrections — several lines, naming ids and
   * offering alternatives — and a two-second toast destroys them before
   * they can be copied.
   */
  showImportRefusal(message) {
    const text = String(message || 'Import refused');
    this.announce('Import refused.');
    const overlay = document.createElement('div');
    overlay.className = 'naming-modal-overlay';
    overlay.innerHTML = `
      <div class="naming-modal" role="alertdialog" aria-modal="true" aria-label="Import refused">
        <h2 class="naming-modal-title">Import refused</h2>
        <textarea class="input" id="program-refusal-text" rows="12" readonly
                  style="width:min(560px,80vw);max-width:100%;font-family:ui-monospace,monospace;font-size:0.8rem"
                  spellcheck="false"></textarea>
        <div class="naming-modal-actions" style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
          <button type="button" class="btn-secondary" data-choice="copy">Copy</button>
          <button type="button" class="btn-primary" data-choice="close">Close</button>
        </div>
      </div>`;
    const field = overlay.querySelector('#program-refusal-text');
    if (field) field.value = text;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.remove();
        return;
      }
      const button = event.target.closest('[data-choice]');
      if (!button) return;
      if (button.dataset.choice === 'copy') {
        try {
          navigator.clipboard?.writeText?.(text);
        } catch { /* the text is selectable in the field either way */ }
        this.showToast('Refusal copied');
        return;
      }
      overlay.remove();
    });
    document.body.appendChild(overlay);
    overlay.querySelector('[data-choice="close"]')?.focus();
    return overlay;
  }

  setProgramImportBusy(busy) {
    this.programImportBusy = busy;
    const button = this.container.querySelector('[data-action="import-experience-program"]');
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Importing…' : 'Import JSON';
  }

  async importExperienceProgramText(text) {
    // Loading the works a score names is asynchronous, and two imports racing
    // each other would each build a project from a surface the other is about
    // to replace.
    if (this.programImportBusy) {
      this.showToast('An import is already underway');
      return;
    }
    this.setProgramImportBusy(true);
    let context = null;
    try {
      context = this.buildCuratorContextFromSurface();
      const program = parseExperienceProgramJson(text, { context });

      // SNAPSHOT BEFORE THE AWAIT. Everything below is built from this array,
      // so the project that reaches the Vault is the one the gate measured.
      const surfaceSources = [...(this.sessionData.sources || [])];

      this.announce('Loading the works this score names…');
      const sources = await this.resolveImportedProgramSources(
        program, surfaceSources, context
      );
      // Refused: the reader has the reason, and nothing here has been touched.
      if (!sources) return;

      if (!sources.length) {
        this.showToast('Add sources before importing a score that binds to them');
        return;
      }

      // Authoring gate: ambiguous quotes refuse here (curator can extend).
      // Session compile omits them so a reader never loses the reading.
      // Against the LOADED set, so a quote into a Library work is checked
      // rather than skipped for want of any text to check it against.
      assertQuotationAnchorsAgainstSources(program, sources);

      const project = workshopProjectFromImportedProgram({
        program,
        context,
        sources,
        assets: this.sessionData.sequenceVisualAssets || [],
        defaults: {
          reading: {
            wpm: this.sessionData.wpm,
            chunkMode: this.sessionData.chunkMode,
            curve: this.sessionData.curve,
            displayMode: this.sessionData.displayMode
          },
          visual: {
            surface: this.sessionData.visualConfig?.visualMode === 'interlocution'
              ? 'scored'
              : undefined,
            config: this.sessionData.visualConfig
          },
          audio: {
            soundscape: this.sessionData.soundscape,
            audioPreset: this.sessionData.audioPreset,
            selectedSwellId: this.sessionData.selectedSwellId
          },
          projection: this.sessionData.projection
        },
        title: this.sessionData.title || program.id,
        intent: this.sessionData.intent || 'custom',
        id: `curator-import-${Date.now()}`
      });

      const saved = await MemoryCore.saveWorkshopBlueprintAsync(project, {
        blobs: this.pendingMediaBlobs
      });
      if (!saved?.id) {
        this.showToast('Could not save the imported score to the Vault');
        return;
      }
      this.pendingMediaBlobs.clear();
      this.savedBlueprints = await MemoryCore.getWorkshopBlueprintsHydrated();
      window.rise?.router?.getViewInstance('vault')?.refreshBlueprints?.();

      const view = workshopProjectToBlueprintView(saved);
      this.suspendCurrentDraft();
      this.revokeLocalMediaUrls();
      this.pendingMediaBlobs.clear();
      const editable = normalizeSessionData(view);
      delete editable.id;
      delete editable.updatedAt;
      this.replaceEditorData(editable, {
        blueprintId: saved.id,
        kind: 'saved',
        dirty: false
      });
      this.showToast('Imported as proposed Vault draft');
    } catch (error) {
      // Every refusal is a correction several lines long; it goes where it
      // can be read and copied rather than into a toast that outlives it by
      // two seconds.
      this.showImportRefusal(this.formatProgramIoError(error, context));
    } finally {
      this.setProgramImportBusy(false);
    }
  }

  async saveSequenceToVault() {
    let saved;
    try {
      saved = await this.persistSequenceToVault();
    } catch (error) {
      this.showToast(error.message || 'Could not save this sequence');
      return null;
    }
    if (!saved) {
      this.showToast('Could not save this sequence');
      return null;
    }

    // Saving completes this editor transaction. Reopening for modification is
    // explicit through Workshop Sequences, so later Recursions cannot merge
    // into a configuration the user already committed to the Vault.
    this.startNewSequence({ preserveCurrent: false });
    this.showToast('Saved to Vault · Workshop cleared');
    return saved;
  }

  async createSession() {
    this.audioPreview.stop();
    let saved;
    let session;
    try {
      saved = await this.persistSequenceToVault();
      session = cloneSessionData(saved || this.prepareSessionPayload(this.sessionData));
    } catch (error) {
      this.showToast(error.message || 'Could not compile this visual score');
      return;
    }
    session.visualConfig = {
      ...session.visualConfig,
      consentScope: this.visualConsentScope
    };

    // Compile and navigate before clearing the retained Workshop instance.
    this.onCreateSession(session);
    if (saved) {
      this.startNewSequence({ preserveCurrent: false });
    }
  }

  handleGlobalUpload(event) {
    this.restoreFileDialogFocus();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const success = MemoryCore.saveGlobalImage(e.target.result, { name: file.name });
        if (success) {
            this.visualAssetGroup = 'shared';
            this.refreshVisualLibraryAndInspector();
        } else {
            alert('Could not add this image. The Global Pool holds up to 20 images and shares browser storage with your sequences.');
        }
        event.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  async handlePersonalSwellUpload(event) {
    this.restoreFileDialogFocus();
    const file = event.target.files[0];
    if (!file) return;

    const displayName = await namingModal.show(file.name, 'Name this audio', 'Personal audio');
    if (!displayName) {
      event.target.value = '';
      return;
    }
    
    this.showToast(`Decoding ${displayName}...`);
    try {
      await PersonalSwells.addSwell(file, displayName);
      await this.updatePersonalSwellList();
      this.showToast('Audio added to your shelf');
      if (window.rise?.audioEngine) {
        await window.rise.audioEngine.reloadPersonalSwells();
      }
    } catch (error) {
      console.error('[Workshop] Failed to upload personal swell:', error);
      this.showToast('Failed to upload audio');
    }
    event.target.value = '';
  }

  async removePersonalSwell(id) {
    try {
      // A recording that no longer exists cannot go on being the base layer.
      const wasWholeReading = personalAudioIsWholeReading(this.sessionData, id);
      const wasSelectedSwell = this.sessionData.selectedSwellId === id;
      await PersonalSwells.removeSwell(id);
      if (wasWholeReading) this.sessionData.soundscape = 'none';
      if (wasSelectedSwell) this.sessionData.selectedSwellId = null;
      if (wasWholeReading || wasSelectedSwell) {
        this.audioPreview.stop();
        this.markEditorDirty();
      }
      await this.updatePersonalSwellList();
      this.refreshAudioStudio();
      this.updateSequencePicker();
      this.showToast('Audio removed');
      if (window.rise?.audioEngine) {
        await window.rise.audioEngine.reloadPersonalSwells();
      }
    } catch (error) {
      console.error('[Workshop] Failed to remove swell:', error);
    }
  }

  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    if (this.assetRemovalTimer) {
      clearTimeout(this.assetRemovalTimer);
      this.assetRemovalTimer = null;
    }
    if (this.sourceRemovalTimer) {
      clearTimeout(this.sourceRemovalTimer);
      this.sourceRemovalTimer = null;
    }
    this.sourceBrowser?.destroy?.();
    this.sourceBrowser = null;
    this.closeSourcePreview?.();
    if (this.announcementTimer) {
      clearTimeout(this.announcementTimer);
      this.announcementTimer = null;
    }
    if (this.visualSelectionCaptureTimer) {
      clearTimeout(this.visualSelectionCaptureTimer);
      this.visualSelectionCaptureTimer = null;
    }
    this.collectionPreviewAbortController.abort();
    this.audioPreview.destroy();
    this.revokeLocalMediaUrls();
    this.pendingMediaBlobs.clear();
    if (this.boundContainerClickHandler) {
      this.container.removeEventListener('click', this.boundContainerClickHandler);
      this.boundContainerClickHandler = null;
    }
    if (this.boundVisualAssetInputHandler) {
      this.container.removeEventListener('input', this.boundVisualAssetInputHandler);
      this.container.removeEventListener('change', this.boundVisualAssetInputHandler);
      this.boundVisualAssetInputHandler = null;
    }
    if (this.boundContainerKeydownHandler) {
      this.container.removeEventListener('keydown', this.boundContainerKeydownHandler);
      this.boundContainerKeydownHandler = null;
    }
    window.removeEventListener('resize', this.boundResizeHandler);
    this.deactivate();
  }
}
