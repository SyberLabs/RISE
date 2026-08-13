/**
 * Verify a render package against its manifest.
 *
 * Answers: hashes match; source/program/assets; renderer/profile;
 * degradations; unresolved publication rights.
 */

import { contentHashOf, hashesEqual, sha256Hex } from './hash.js';
import { RENDER_MANIFEST_SCHEMA } from './environment.js';

function asText(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return String(value ?? '');
}

async function hashFile(value) {
  if (value instanceof Uint8Array) {
    return `sha256:${await sha256Hex(value)}`;
  }
  if (value && typeof value === 'object') return contentHashOf(value);
  return contentHashOf(asText(value));
}

export async function verifyRenderPackage(pack) {
  const manifest = pack['render-manifest.json'];
  const findings = [];
  const fail = (code, message) => { findings.push({ code, message }); };

  if (!manifest || manifest.schema !== RENDER_MANIFEST_SCHEMA) {
    fail('VERIFY_MANIFEST', 'Package is missing a rise.render-manifest.v1 document');
  }
  const hashes = manifest?.outputHashes || {};

  const checks = [
    ['captions.vtt', hashes.captionsVtt],
    ['captions.srt', hashes.captionsSrt],
    ['captions.json', hashes.captionsJson],
    ['credits.txt', hashes.credits],
    ['rights-report.json', hashes.rights],
    ['poster.bmp', hashes.poster],
    ['thumbnail.bmp', hashes.thumbnail]
  ];
  for (const [name, expected] of checks) {
    if (!expected) continue;
    if (pack[name] == null) {
      fail('VERIFY_MISSING_FILE', `Manifest names ${name} but the package does not contain it`);
      continue;
    }
    const actual = await hashFile(pack[name]);
    try {
      if (!hashesEqual(expected, actual)) {
        fail('VERIFY_HASH_MISMATCH', `${name} does not match the manifest hash`);
      }
    } catch {
      fail('VERIFY_HASH_MISMATCH', `${name} does not match the manifest hash`);
    }
  }

  const rights = pack['rights-report.json'] || {};
  const unresolved = Array.isArray(rights.unresolved) ? rights.unresolved : [];
  const credits = asText(pack['credits.txt']);

  const ok = findings.length === 0;
  return Object.freeze({
    ok,
    findings: Object.freeze(findings),
    answers: Object.freeze({
      hashesMatch: !findings.some(item => item.code === 'VERIFY_HASH_MISMATCH' || item.code === 'VERIFY_MISSING_FILE'),
      provenance: Object.freeze({
        jobId: manifest?.jobId || null,
        jobHash: manifest?.jobHash || null,
        programHash: manifest?.programHash || null,
        projectId: manifest?.projectId || null,
        projectRevision: manifest?.projectRevision || null,
        sourceSnapshots: manifest?.sourceSnapshots || [],
        assetSnapshots: manifest?.assetSnapshots || []
      }),
      renderer: Object.freeze({
        profile: manifest?.profile || null,
        quality: manifest?.quality || null,
        renderer: manifest?.renderer || null,
        encoder: manifest?.encoder || null,
        seed: manifest?.seed || null
      }),
      degradations: manifest?.appliedDegradations || [],
      rightsUnresolved: unresolved,
      publicationBlocked: rights.publicationBlocked === true,
      creditsPresent: credits.length > 0
    })
  });
}
