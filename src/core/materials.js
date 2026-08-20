/**
 * Materials — what the reader brought, as opposed to what RISE holds.
 *
 * The Library is fifteen works in a chosen edition, whose structure is read
 * from the source and whose rights RISE answers for. A material is a file
 * somebody dragged in. RISE cannot certify it, so it MEASURES what can be
 * measured and DESCRIBES the rest, and records which of those two it did.
 *
 * This module owns the first half of that: whether a file may be taken at
 * all, and what is true about it that needs no judgement — its kind, its
 * size, and for a video its duration. It is pure and DOM-free so both the
 * Workshop and the Scriptorium can ask the same question and get the same
 * answer; the policy living in one room and being re-stated in the other is
 * this project's most frequent defect.
 *
 * What it deliberately does NOT do is guess what a picture is OF. That is the
 * half no measurement settles, and the law that governs it is the Archive's:
 * a model may propose a description and a person disposes of it.
 */

import { READING_LIMITS } from './reading-limits.js';

/** One accept string, so a file dialog and this module cannot disagree. */
export const MATERIAL_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,.mp4';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPE = 'video/mp4';

/** Human sizes, for a refusal a reader can act on. */
function megabytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * May this file be taken, and what is it?
 *
 * Pure: it reads `type`, `size` and `name` and nothing else, so it runs in a
 * test without a DOM and in a browser without a round trip.
 *
 * @param {{ type?: string, size?: number, name?: string }} file
 * @param {{ held?: number }} [options] how many materials are already held
 * @returns {{ ok: true, kind: 'image'|'video' } | { ok: false, reason: string }}
 */
export function inspectMaterial(file, { held = 0 } = {}) {
  if (!file) return { ok: false, reason: 'No file was chosen.' };

  const type = String(file.type || '');
  const name = String(file.name || '');
  const size = Number(file.size) || 0;

  if (held >= READING_LIMITS.maxSequenceAssets) {
    return {
      ok: false,
      reason: `A reading can carry up to ${READING_LIMITS.maxSequenceAssets} of your own files.`
    };
  }
  if (size <= 0) return { ok: false, reason: `${name || 'That file'} is empty.` };

  if (IMAGE_TYPES.has(type)) {
    return size > READING_LIMITS.maxImageFileBytes
      ? { ok: false, reason: `Images must be ${megabytes(READING_LIMITS.maxImageFileBytes)} or smaller.` }
      : { ok: true, kind: 'image' };
  }

  // An .mp4 whose type the browser did not fill in is still refused rather
  // than trusted: the extension is what the file is CALLED and the type is
  // what it claims to BE, and only one of those is evidence.
  if (type === VIDEO_TYPE) {
    return size > READING_LIMITS.maxVideoFileBytes
      ? { ok: false, reason: `Video must be ${megabytes(READING_LIMITS.maxVideoFileBytes)} or smaller.` }
      : { ok: true, kind: 'video' };
  }
  if (name.toLowerCase().endsWith('.mp4')) {
    return { ok: false, reason: 'Video must be an MP4 file.' };
  }

  return {
    ok: false,
    reason: `${name || 'That file'} is not a kind of file a reading can carry.`
  };
}

/**
 * How long a video runs, read from the file itself.
 *
 * Duration is the fact a composer actually spends: a score needs to know an
 * mp4 runs for eleven seconds far more than it needs to know what is in it.
 * Measured rather than declared, and so needing no one's judgement.
 *
 * @returns {Promise<number>} milliseconds
 */
export function probeVideoDurationMs(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    const done = (fn, value) => {
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      fn(value);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const seconds = Number(video.duration);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        done(reject, new Error('The MP4 states no duration.'));
        return;
      }
      done(resolve, Math.round(seconds * 1000));
    };
    video.onerror = () => done(reject, new Error('Could not read the MP4.'));
    video.src = url;
  });
}

/**
 * What the reader is told they are carrying.
 *
 * A count and its kinds, in the reader's own words rather than a byte total,
 * because the question a panel answers is "did my files arrive" and not "how
 * much storage am I using".
 */
export function describeMaterials(materials) {
  const list = Array.isArray(materials) ? materials : [];
  if (!list.length) return 'Nothing added yet.';
  const videos = list.filter(item => item.kind === 'video').length;
  const images = list.length - videos;
  const parts = [];
  if (images) parts.push(`${images} image${images === 1 ? '' : 's'}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  return parts.join(' and ');
}
