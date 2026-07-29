export const VOICE_PACK_SCHEMA = 'rise.recitation-voice-pack.v1';
export const DEFAULT_VOICE_ID = 'af_heart';

/**
 * Markup in a reading is choreography, not speech. Keep this transform shared
 * by the offline pack builder and the browser lookup: a single character of
 * disagreement would turn a valid asset into a silent cache miss.
 */
export function speakableText(atomOrText) {
    const raw = typeof atomOrText === 'string'
        ? atomOrText
        : atomOrText?.content;
    if (typeof raw !== 'string') return '';
    return raw
        .replace(/\*/g, '')
        .replace(/\|/g, ' ')
        .replace(/\[(PAUSE|HOLD|FLASH)\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeVoiceText(atomOrText) {
    return speakableText(atomOrText).normalize('NFKC');
}

/**
 * A deterministic, browser-and-Node-safe key. The manifest also stores the
 * normalized text and lookup verifies it, so a theoretical 32-bit collision
 * can only become a miss, never the wrong spoken phrase.
 */
export function voiceAssetKey(atomOrText) {
    const text = normalizeVoiceText(atomOrText);
    if (!text) return '';

    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}
