/**
 * Chant beds — recorded sacred music as soundscapes.
 *
 * A chant bed follows the soundscape contract (create → {start, stop})
 * so the whole existing pipeline serves it: the orbital's soundscape
 * picker, layer gains, exclusivity with pure-tone presets. The voices
 * are fetched audio buffers instead of synthesized oscillators.
 *
 * Program shape (spec §3): the family's tracks play in registry order,
 * a long breathing silence between tracks (the room is allowed to be
 * quiet), then the program begins again — a slow liturgical
 * alternation, never a visible restart.
 *
 * Reverent degradation: a track that fails to fetch or decode is
 * skipped after its silence gap; a family with nothing playable is
 * simply silence. The content-type guard (the HTML-for-mp3 lesson)
 * rejects any response that is not audio.
 */

import { chantProgram, findChant } from '../content/chapel/chants.js';

/** Silence between tracks — a breath, not a gap in service.
 *  (Opened at 20s; eased to 12s on listening — still a real pause,
 *  less of an absence.) */
const INTER_TRACK_SILENCE_S = 12;
/** Fade edges so entries and exits are candle-soft. */
const FADE_S = 3;

/**
 * Decoded-buffer cache, keyed per AudioContext (a buffer decoded on
 * one context is not portable to another). Values are PROMISES so a
 * track fetched twice concurrently decodes once; a null resolution
 * (failure) is also cached — a track that failed once this context's
 * life is not re-fetched every program loop. The WeakMap lets a
 * discarded context release every buffer with it.
 */
const decodedByContext = new WeakMap();

function fetchChantBuffer(ctx, chant, fetchImpl) {
    let byUrl = decodedByContext.get(ctx);
    if (!byUrl) { byUrl = new Map(); decodedByContext.set(ctx, byUrl); }
    if (byUrl.has(chant.url)) return byUrl.get(chant.url);

    const doFetch = fetchImpl || fetch;
    const promise = (async () => {
        try {
            const response = await doFetch(chant.url);
            if (!response.ok) return null;
            const contentType = response.headers.get('content-type') || '';
            // Audio or bust — a rate-limit page and an error page are both
            // text/html, and both once masqueraded as mp3s here.
            if (!/audio|ogg|mpeg|octet-stream/i.test(contentType)) {
                console.warn('[Chant] Expected audio, got', contentType, 'for', chant.id);
                return null;
            }
            const bytes = await response.arrayBuffer();
            return await ctx.decodeAudioData(bytes);
        } catch (error) {
            console.warn('[Chant] Failed to load', chant.id, error?.message || error);
            return null;
        }
    })();
    byUrl.set(chant.url, promise);
    return promise;
}

/**
 * Create a chant bed for one family.
 * @param {string} family - 'gregorian' | 'znamenny'
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {Object} [options] - { fetchImpl } test seam
 * @returns {{start: Function, stop: Function}|null}
 */
export function createChantBed(family, ctx, destination, options = {}) {
    const program = chantProgram(family);
    if (!program) return null;

    let out = null;
    let activeSource = null;
    let nextTimer = null;
    let stopped = false;
    let trackIndex = 0;
    // Once-per-bed failure: a track that fails is not retried this
    // bed instance, and when every track of the family has failed the
    // bed settles PERMANENTLY into silence for the session — no
    // endless five-second request cycle against a dead host. A later
    // session (new bed) may try again.
    const failedThisBed = new Set();

    async function playNext() {
        if (stopped) return;
        if (failedThisBed.size >= program.length) return; // the family is silent
        const chant = program[trackIndex % program.length];
        trackIndex += 1;
        if (failedThisBed.has(chant.id)) {
            nextTimer = setTimeout(playNext, 50);
            return;
        }

        const buffer = await fetchChantBuffer(ctx, chant, options.fetchImpl);
        if (stopped) return;
        if (!buffer) {
            failedThisBed.add(chant.id);
            if (failedThisBed.size >= program.length) {
                console.warn('[Chant] Every track of', family, 'failed — the bed rests in silence this session');
                return;
            }
            // Skip after a shortened breath
            nextTimer = setTimeout(playNext, 5000);
            return;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + FADE_S);
        const endAt = now + buffer.duration;
        gain.gain.setValueAtTime(1, Math.max(now + FADE_S, endAt - FADE_S));
        gain.gain.linearRampToValueAtTime(0, endAt);

        source.connect(gain);
        gain.connect(out);
        source.onended = () => {
            try { source.disconnect(); gain.disconnect(); } catch (e) { /* released */ }
            if (stopped) return;
            nextTimer = setTimeout(playNext, INTER_TRACK_SILENCE_S * 1000);
        };
        source.start(now);
        activeSource = source;
        // The provenance contract: whoever offers the recording shows
        // its credit — the bed announces each track as it begins
        try { options.onTrackChange?.(chant); } catch (e) { /* display is optional */ }
    }

    return {
        start() {
            stopped = false;
            out = ctx.createGain();
            out.gain.value = 1;
            out.connect(destination);
            playNext();
        },
        stop(instant = false) {
            stopped = true;
            clearTimeout(nextTimer);
            nextTimer = null;
            if (out) {
                const now = ctx.currentTime;
                if (instant) {
                    out.gain.cancelScheduledValues(now);
                    out.gain.setValueAtTime(0, now);
                } else {
                    out.gain.cancelScheduledValues(now);
                    out.gain.setValueAtTime(out.gain.value, now);
                    out.gain.linearRampToValueAtTime(0, now + 1.2);
                }
            }
            const held = { source: activeSource, out };
            activeSource = null;
            setTimeout(() => {
                try { held.source?.stop(); held.source?.disconnect(); } catch (e) { /* released */ }
                try { held.out?.disconnect(); } catch (e) { /* released */ }
            }, instant ? 0 : 1400);
            out = null;
        }
    };
}

/** The chant "soundscape" ids the engine and panel recognize. */
export const CHANT_BED_IDS = Object.freeze({
    'chant-gregorian': {
        family: 'gregorian',
        name: 'Gregorian Chant',
        description: 'Recorded Gregorian chant — Kyrie, office hymns, psalmody — with long breaths of silence between pieces. Attribution shown per recording.'
    },
    'chant-znamenny': {
        family: 'znamenny',
        name: 'Znamenny Chant',
        description: 'Old Russian chant of the Moscow Patriarchate choir — with long breaths of silence between pieces. Especially apt beneath the Pantocrator.'
    }
});

export function isChantBedId(id) {
    return Object.hasOwn(CHANT_BED_IDS, id);
}
