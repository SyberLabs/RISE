/**
 * ElevenLabs as a speech provider for the provider voice (provider-tts.js), on the reader's own key.
 *
 * One request per passage: POST /v1/text-to-speech/{voice}/with-timestamps, asking for raw 16-bit PCM
 * so the samples go straight into an AudioBuffer (no decoder, no container), and for the character
 * alignment, which gives the voice a mark at the start of every word: a better clock than the browser's
 * network voices, which report no boundaries at all.
 *
 * The key stays where the caller keeps it (`getKey`, read at each request) and goes in one header to
 * api.elevenlabs.io and nowhere else; provider error text is scrubbed of it before anyone sees it.
 * ElevenLabs allows browser requests from any origin (its preflight answers `*`), and treats the key as a
 * secret to be kept out of shared pages: here it is the reader's own, in this tab's memory, as every
 * Live credential is (docs/USER-OWNED-AI.md).
 *
 * Documented 2026-10-12 at elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps and
 * …/authentication: header `xi-api-key`; body `text`, `model_id` (default eleven_multilingual_v2),
 * `voice_settings.speed` (1 is the voice's own; the docs give no range, the API accepts 0.7 to 1.2);
 * query `output_format` (`pcm_22050` among them); response `audio_base64` and `alignment`
 * { characters[], character_start_times_seconds[], character_end_times_seconds[] } for the text as sent.
 */

export const ELEVENLABS = Object.freeze({
    origin: 'https://api.elevenlabs.io',
    /** The voice spoken with until the reader names another: Rachel, the one ElevenLabs' own examples use. */
    defaultVoiceId: '21m00Tcm4TlvDq8ikWAM',
    /** The low-latency model, the same one RISE Plus voices with; multilingual_v2 is slower to first sound. */
    defaultModelId: 'eleven_flash_v2_5',
    sampleRate: 22050,
    outputFormat: 'pcm_22050',
    /** What `voice_settings.speed` accepts; a rate beyond it is made up by playback rate (provider-tts.js). */
    speed: Object.freeze({ min: 0.7, max: 1.2 }),
    /** A passage longer than this is refused before any request: the voice says passages, not documents. */
    maxChars: 5000
});

const KEY_SHAPE = /\b(sk_|xi-)?[a-f0-9]{32,}\b/giu;

/** The reader-readable reason for a refused request, by status; the key never appears in it. */
export function reasonFor(status, detail = '') {
    const text = String(detail).slice(0, 160);
    // Exhausted credit comes back as 401 or 400 with a quota detail, as well as 402.
    const credit = /quota|credit/iu.test(text) && (status === 400 || status === 401);
    if (status === 402 || credit) return { code: 'CREDIT_REQUIRED', message: 'The ElevenLabs account has no voice credit left.' };
    if (status === 401) return { code: 'KEY_REFUSED', message: 'ElevenLabs did not accept the key.' };
    if (status === 403) return { code: 'REFUSED', message: 'ElevenLabs refused this request for that key.' };
    if (status === 422) return { code: 'TEXT_REFUSED', message: 'ElevenLabs could not speak this passage.' };
    if (status === 429) return { code: 'RATE_LIMITED', message: 'ElevenLabs is rate-limiting this key; try again in a moment.' };
    if (status === 404) return { code: 'VOICE_NOT_FOUND', message: 'ElevenLabs has no voice with that id for this key.' };
    if (status >= 500) return { code: 'PROVIDER_UNAVAILABLE', message: 'ElevenLabs is not answering right now.' };
    return { code: 'REFUSED', message: `ElevenLabs answered ${status}.` };
}

/** 16-bit little-endian PCM, base64, to samples in [-1, 1]. */
export function pcm16ToSamples(base64) {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength - (bytes.byteLength % 2));
    const samples = new Float32Array(view.byteLength / 2);
    for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
    return samples;
}

/**
 * A mark at the start of every word after the first, from the character alignment of the text as sent:
 * { charIndex, tMs } in audio time. Where the alignment does not spell the text (a normalisation the
 * provider made), the marks are the proportional estimate the speech clock would make anyway, so a passage
 * is never left without them; the end is the last character's end.
 */
export function marksFrom(text, alignment) {
    const words = [...text.matchAll(/\S+/gu)].map(match => match.index).filter(index => index > 0);
    const chars = alignment?.characters;
    const starts = alignment?.character_start_times_seconds;
    const ends = alignment?.character_end_times_seconds;
    if (Array.isArray(chars) && Array.isArray(starts) && chars.length === starts.length && chars.join('') === text) {
        const durationMs = Math.round(1000 * (ends?.[ends.length - 1] ?? starts[starts.length - 1] ?? 0));
        return { marks: words.map(charIndex => ({ charIndex, tMs: Math.round(1000 * starts[charIndex]) })), durationMs, exact: true };
    }
    return { marks: [], durationMs: null, exact: false };
}

/**
 * The provider for a provider voice: `speak(text, { rate, signal })` resolves to
 * { samples, sampleRate, marks, durationMs, speed, chars } or rejects with { code, message }.
 * @param {object} options
 * @param {() => string} options.getKey the reader's key, read at each request; empty means none
 * @param {string} [options.voiceId]
 * @param {string} [options.modelId]
 * @param {typeof fetch} [options.fetch]
 */
export function createElevenLabsSpeech({ getKey, voiceId = ELEVENLABS.defaultVoiceId, modelId = ELEVENLABS.defaultModelId, fetch = globalThis.fetch } = {}) {
    if (typeof getKey !== 'function') throw new TypeError('ElevenLabs speech needs the reader’s key, read at each request');
    const url = `${ELEVENLABS.origin}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${ELEVENLABS.outputFormat}`;
    let chars = 0;
    return {
        id: 'elevenlabs',
        name: `ElevenLabs ${voiceId === ELEVENLABS.defaultVoiceId ? 'Rachel' : voiceId}`,
        modelId,
        /** Characters sent so far, which is what ElevenLabs bills. */
        get chars() { return chars; },
        async speak(text, { rate = 1, signal } = {}) {
            const key = getKey();
            if (typeof key !== 'string' || !key.trim()) throw Object.assign(new Error('Enter your ElevenLabs key to hear this voice.'), { code: 'KEY_REQUIRED' });
            if (text.length > ELEVENLABS.maxChars) throw Object.assign(new Error('This passage is too long for the voice.'), { code: 'TEXT_REFUSED' });
            const speed = Math.min(ELEVENLABS.speed.max, Math.max(ELEVENLABS.speed.min, rate));
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
                    body: JSON.stringify({ text, model_id: modelId, voice_settings: { speed } }),
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                    redirect: 'error',
                    cache: 'no-store',
                    signal
                });
            } catch (error) {
                if (error?.name === 'AbortError') throw error;
                throw Object.assign(new Error('ElevenLabs could not be reached.'), { code: 'CONNECT_FAILED' });
            }
            if (!response.ok) {
                let detail = '';
                try { detail = JSON.stringify(await response.json()); } catch { /* no body to read */ }
                const reason = reasonFor(response.status, detail.split(key).join('[key]').replace(KEY_SHAPE, '[key]'));
                throw Object.assign(new Error(reason.message), { code: reason.code, status: response.status });
            }
            let body;
            try { body = await response.json(); } catch {
                throw Object.assign(new Error('ElevenLabs sent something that was not speech.'), { code: 'PROVIDER_UNAVAILABLE' });
            }
            if (typeof body?.audio_base64 !== 'string' || !body.audio_base64) {
                throw Object.assign(new Error('ElevenLabs sent no audio for this passage.'), { code: 'PROVIDER_UNAVAILABLE' });
            }
            chars += text.length;
            const samples = pcm16ToSamples(body.audio_base64);
            const timing = marksFrom(text, body.alignment);
            const durationMs = timing.durationMs ?? Math.round(1000 * samples.length / ELEVENLABS.sampleRate);
            return { samples, sampleRate: ELEVENLABS.sampleRate, marks: timing.marks, durationMs, speed, chars: text.length, exact: timing.exact };
        }
    };
}
