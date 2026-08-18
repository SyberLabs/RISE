import { createEditorAsset } from './editor-asset.js';

/**
 * A personal file sounding as a BED rather than as a momentary event.
 *
 * The soundscape id it produces is the one vocabulary the engine and the
 * editor share, so it lives here beside the assets that build it rather than
 * being spelled out at both ends.
 */
export const PERSONAL_BED_PREFIX = 'personal:';
export const personalBedSoundscapeId = (swellId) => `${PERSONAL_BED_PREFIX}${swellId}`;

const AUDIO_COLORS = Object.freeze({
  silent: '#8d91a3', aurora: '#b46dce', 'faded-signal': '#ef8254',
  focus: '#d1b85c', deep: '#7769c9', gateway: '#c76f9d', swell: '#67b9c7'
});

export const WORKSHOP_AUDIO_ASSETS = Object.freeze([
  Object.freeze({
    id: 'tone:silent', kind: 'tone', value: 'silent', name: 'Silence', icon: '○',
    description: 'No continuous audio bed.'
  }),
  Object.freeze({
    id: 'soundscape:aurora', kind: 'soundscape', value: 'aurora', name: 'Aurora', icon: '✧',
    description: 'A living, slowly evolving ambient composition.'
  }),
  Object.freeze({
    id: 'soundscape:faded-signal', kind: 'soundscape', value: 'faded-signal',
    name: 'Faded Signal', icon: '◌', description: 'A weathered transmission suspended in space.'
  }),
  Object.freeze({
    id: 'tone:focus', kind: 'tone', value: 'focus', name: 'Focus', icon: '◉',
    description: 'A clear tonal bed for sustained attention.'
  }),
  Object.freeze({
    id: 'tone:deep', kind: 'tone', value: 'deep', name: 'Deep', icon: '◎',
    description: 'A lower, quieter tonal field.'
  }),
  Object.freeze({
    id: 'tone:gateway', kind: 'tone', value: 'gateway', name: 'Gateway', icon: '◈',
    description: 'A layered entrainment atmosphere.'
  }),
  Object.freeze({
    id: 'swell:personal', kind: 'swell', value: 'personal', name: 'Personal Entry', icon: '★',
    description: 'A bounded entry event from your personal shelf.'
  })
]);

export function workshopAudioEditorAsset(assetOrId) {
  const asset = typeof assetOrId === 'string' ? workshopAudioAsset(assetOrId) : assetOrId;
  if (!asset) return null;
  const isSwell = asset.kind === 'swell';
  const cueTemplate = asset.kind === 'soundscape'
    ? { kind: 'soundscape', soundscapeId: asset.value, fadeMs: 700 }
    : asset.kind === 'tone'
      ? asset.value === 'silent'
        ? { kind: 'silence', fadeMs: 500 }
        : { kind: 'tone', presetId: asset.value, fadeMs: 500 }
      : { kind: 'swell', swellId: asset.swellId || asset.value, fadeMs: 250 };
  return createEditorAsset({
    id: asset.id,
    lane: isSwell ? 'swell' : 'audio',
    kind: isSwell ? 'audio-swell' : 'audio-bed',
    name: asset.name,
    capability: isSwell ? 'default' : 'both',
    editor: {
      color: AUDIO_COLORS[asset.value] || (isSwell ? AUDIO_COLORS.swell : AUDIO_COLORS.deep),
      preview: { kind: 'audio', ref: asset.id }
    },
    provenance: { provider: 'RISE audio registry' },
    cueTemplate
  });
}

/**
 * A reader's own recording. ONE asset, two placements.
 *
 * It used to be offered twice — once as an entry swell, once as a bed — which
 * asked the reader to choose a behaviour before they had chosen a place. But
 * how long a file sounds is a property of the file, not of the slot it sits
 * in: a ten minute track "at the start" and the same track "for the whole
 * reading" are the same experience. So the file is just a file, and where it
 * goes decides what it does:
 *
 *   whole reading  → the base layer, a soundscape whose voice is theirs
 *   a highlight    → a layer stacked over the base for that passage only
 *
 * `lane: 'swell'` and the `swell` cue are the WIRE names for the overlay lane
 * and they stay, because every saved sequence and published Journey already
 * spells them that way. The reader never sees the word.
 */
export function personalAudioEditorAsset(swell) {
  if (!swell?.id || !swell?.name) return null;
  return createEditorAsset({
    id: `swell:${swell.id}`,
    lane: 'swell',
    kind: 'audio-swell',
    name: swell.name,
    capability: 'both',
    editor: { color: AUDIO_COLORS.swell, preview: { kind: 'audio', ref: swell.id } },
    provenance: { provider: 'Personal audio shelf' },
    cueTemplate: { kind: 'swell', swellId: swell.id, fadeMs: 250 }
  });
}

/**
 * Placing a personal recording under the whole reading.
 *
 * It becomes the BASE layer, not an entry event — a soundscape whose voice is
 * the reader's file. `audioPreset` is left as a tone value and never carries
 * the word `personal`: it used to, and because one field then meant two
 * things, choosing a personal file erased the tone bed while choosing a tone
 * erased the file. They no longer touch each other.
 */
export function applyPersonalAudioAsWholeReading(swellId) {
  return {
    soundscape: personalBedSoundscapeId(swellId),
    audioPreset: 'silent',
    selectedSwellId: null
  };
}

export function audioScoreAssetFromId(assetId, personalSwells = []) {
  const builtIn = workshopAudioEditorAsset(assetId);
  if (builtIn) return builtIn;
  if (typeof assetId !== 'string' || !assetId.startsWith('swell:')) return null;
  const swellId = assetId.slice('swell:'.length);
  return personalAudioEditorAsset(personalSwells.find(item => item.id === swellId)
    || { id: swellId, name: 'Personal audio' });
}

export function workshopAudioAsset(assetId) {
  return WORKSHOP_AUDIO_ASSETS.find(asset => asset.id === assetId) || null;
}

export function workshopAudioAssetIsCurrent(data, asset) {
  if (!asset) return false;
  if (asset.kind === 'soundscape') return data.soundscape === asset.value;
  if (asset.kind === 'swell') return data.audioPreset === 'personal';
  if (asset.value === 'silent') {
    return (data.soundscape || 'none') === 'none'
      && (data.audioPreset || 'silent') === 'silent';
  }
  return data.audioPreset === asset.value;
}

export function applyWorkshopAudioAsset(data, assetId) {
  const asset = workshopAudioAsset(assetId);
  if (!asset) throw new TypeError(`Unknown Workshop audio asset: ${assetId}`);
  const next = {
    soundscape: data.soundscape || 'none',
    audioPreset: data.audioPreset || 'silent',
    selectedSwellId: data.selectedSwellId || null
  };

  // One base layer: a soundscape or a tone, never both, and `audioPreset`
  // never means anything but a tone. Choosing one no longer discards the
  // reader's personal audio, because that now lives in `soundscape`.
  if (asset.kind === 'soundscape') {
    next.soundscape = asset.value;
    next.audioPreset = 'silent';
  } else if (asset.kind === 'tone') {
    next.audioPreset = asset.value;
    next.soundscape = 'none';
  }
  return next;
}

export class WorkshopAudioPreviewController {
  constructor({ engineProvider, onChange = () => {}, durationMs = 12000 } = {}) {
    this.engineProvider = engineProvider || (() => null);
    this.onChange = onChange;
    this.durationMs = Math.max(1000, Math.min(Number(durationMs) || 12000, 30000));
    this.current = null;
    this.timer = null;
    this.generation = 0;
  }

  status() {
    return this.current
      ? { state: 'playing', assetId: this.current.asset.id }
      : { state: 'idle', assetId: null };
  }

  async play(assetId, options = {}) {
    const asset = workshopAudioAsset(assetId);
    if (!asset || asset.value === 'silent') {
      this.stop();
      return this.status();
    }
    const generation = ++this.generation;
    this.stop({ advanceGeneration: false, notify: false });
    const engine = this.engineProvider();
    if (!engine) return this.status();

    await engine.init?.();
    await engine.resume?.();
    if (generation !== this.generation) return this.status();

    if (asset.kind === 'soundscape') {
      engine.applyPreset?.('silent');
      engine.startSoundscape?.(asset.value);
    } else if (asset.kind === 'tone') {
      engine.stopSoundscape?.(true);
      engine.applyPreset?.(asset.value);
    } else {
      engine.stopSwell?.(true);
      await engine.playSwell?.(options.swellId || null);
      if (generation !== this.generation) {
        engine.stopSwell?.(true);
        return this.status();
      }
    }

    this.current = { asset, engine };
    this.timer = setTimeout(() => this.stop(), this.durationMs);
    this.onChange(this.status());
    return this.status();
  }

  stop({ advanceGeneration = true, notify = true } = {}) {
    if (advanceGeneration) this.generation += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const owned = this.current;
    this.current = null;
    if (owned?.asset.kind === 'soundscape') owned.engine.stopSoundscape?.(true);
    if (owned?.asset.kind === 'tone') owned.engine.applyPreset?.('silent');
    if (owned?.asset.kind === 'swell') owned.engine.stopSwell?.(true);
    if (notify) this.onChange(this.status());
    return this.status();
  }

  destroy() {
    this.stop();
    this.onChange = () => {};
  }
}
