import manifest from './voice-pack.manifest.json' with { type: 'json' };
import {
    DEFAULT_VOICE_ID,
    VOICE_PACK_SCHEMA,
    normalizeVoiceText,
    speakableText,
    voiceAssetKey
} from './voice-pack-key.js';

export {
    DEFAULT_VOICE_ID,
    VOICE_PACK_SCHEMA,
    normalizeVoiceText,
    speakableText,
    voiceAssetKey
} from './voice-pack-key.js';

const VOICE_LABELS = Object.freeze({
    af_heart: 'Heart — warm, the reference voice',
    af_bella: 'Bella — fuller, most trained',
    bf_emma: 'Emma — British, measured',
    am_michael: 'Michael — male, even',
    am_fenrir: 'Fenrir — male, darker'
});

export function getVoicePack(
    voiceId = DEFAULT_VOICE_ID,
    source = manifest
) {
    if (source?.schema !== VOICE_PACK_SCHEMA) return null;
    const pack = source.voices?.[voiceId];
    if (!pack || typeof pack !== 'object' || !pack.entries) return null;
    return pack;
}

export function resolveVoicePackEntry(
    voiceId,
    atomOrText,
    source = manifest
) {
    const text = normalizeVoiceText(atomOrText);
    const key = voiceAssetKey(text);
    if (!key) return null;

    const entry = getVoicePack(voiceId, source)?.entries?.[key];
    if (!entry || entry.text !== text || typeof entry.asset !== 'string') {
        return null;
    }
    return entry;
}

export function availableVoicePacks(source = manifest) {
    if (source?.schema !== VOICE_PACK_SCHEMA) return [];
    return Object.entries(source.voices || {})
        .filter(([, pack]) =>
            pack
            && typeof pack === 'object'
            && Object.keys(pack.entries || {}).length > 0)
        .map(([id, pack]) => ({
            id,
            label: pack.label || VOICE_LABELS[id] || id,
            entryCount: Object.keys(pack.entries).length
        }));
}

export function defaultVoicePackId(source = manifest) {
    const packs = availableVoicePacks(source);
    return packs.some(pack => pack.id === DEFAULT_VOICE_ID)
        ? DEFAULT_VOICE_ID
        : packs[0]?.id || null;
}

export const voicePackManifest = manifest;
