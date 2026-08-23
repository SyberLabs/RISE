import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  DEFAULT_VOICE_ID,
  normalizeVoiceText,
  voiceAssetKey,
  voicePackManifest
} from '../../src/audio/voice-pack.js';

const ROOT = resolve(import.meta.dirname, '../..');

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function assetPath(root, asset) {
  return join(root, String(asset || '').replace(/^\/+/, ''));
}

async function readVerifiedAsset(root, key, entry, issues) {
  try {
    const bytes = await readFile(assetPath(root, entry.asset));
    if (bytes.length <= 44
      || bytes.subarray(0, 4).toString('ascii') !== 'RIFF'
      || bytes.subarray(8, 12).toString('ascii') !== 'WAVE') {
      issues.push({ key, code: 'VOICE_ASSET_INVALID_WAV', asset: entry.asset });
      return null;
    }
    return { bytes, byteLength: bytes.length, hash: sha256(bytes) };
  } catch (error) {
    issues.push({
      key,
      code: 'VOICE_ASSET_MISSING',
      asset: entry.asset,
      reason: error.message
    });
    return null;
  }
}

/**
 * The keystone plan, imported when it is needed rather than when this file is.
 *
 * `voice-packs/keystones.mjs` resolves and compiles every keystone session in
 * a top-level await, so a STATIC import of it did that work as a side effect
 * of importing this module — before the importing script's own body had run.
 * `check-release-readiness.mjs` therefore read the corpus before it could
 * install the transport a Node process needs for `/content/...`, and the
 * release gate died on an unparseable URL instead of reporting on the release.
 * A script cannot set anything up ahead of its own imports; the only fix is
 * for the work not to happen in one.
 */
async function keystoneUses() {
  const { default: voicePlan } = await import('../voice-packs/keystones.mjs');
  const uses = [];
  const seen = new Set();
  for (let sessionIndex = 0; sessionIndex < voicePlan.sessions.length; sessionIndex += 1) {
    const session = voicePlan.sessions[sessionIndex];
    const source = voicePlan.sourceRevisions[sessionIndex];
    for (const atom of session.atoms || []) {
      const text = normalizeVoiceText(atom);
      const key = voiceAssetKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uses.push({ key, text, source });
    }
  }
  return uses;
}

export async function inspectReleaseVoiceAssets({
  publicRoot = join(ROOT, 'public'),
  distributionRoot = null
} = {}) {
  const pack = voicePackManifest.voices?.[DEFAULT_VOICE_ID];
  const entries = Object.entries(pack?.entries || {}).sort(([left], [right]) =>
    left.localeCompare(right));
  const sourceIssues = [];
  const distributionIssues = [];
  const sourceAssets = new Map();
  let totalBytes = 0;

  for (const [key, entry] of entries) {
    const inspected = await readVerifiedAsset(publicRoot, key, entry, sourceIssues);
    if (!inspected) continue;
    sourceAssets.set(key, inspected);
    totalBytes += inspected.byteLength;
    if (distributionRoot) {
      const distributed = await readVerifiedAsset(
        distributionRoot,
        key,
        entry,
        distributionIssues
      );
      if (distributed && distributed.hash !== inspected.hash) {
        distributionIssues.push({
          key,
          code: 'VOICE_ASSET_DISTRIBUTION_MISMATCH',
          asset: entry.asset
        });
      }
    }
  }

  const reviewIssues = [];
  const records = [];
  for (const use of await keystoneUses()) {
    const entry = pack?.entries?.[use.key];
    const asset = sourceAssets.get(use.key);
    if (!entry || entry.text !== use.text || !asset) {
      reviewIssues.push({
        key: use.key,
        code: 'VOICE_REVIEW_ENTRY_MISSING',
        keystone: use.source.keystone
      });
      continue;
    }
    records.push({
      key: use.key,
      text: use.text,
      asset: entry.asset,
      durationMs: entry.durationMs,
      sampleRate: entry.sampleRate,
      byteLength: asset.byteLength,
      assetHash: asset.hash,
      keystone: use.source.keystone,
      workId: use.source.workId,
      editionId: use.source.editionId,
      sourceRevision: use.source.sourceRevision,
      entryId: use.source.entryId
    });
  }

  const manifestHash = sha256(Buffer.from(JSON.stringify({
    voiceId: DEFAULT_VOICE_ID,
    records
  })));
  return Object.freeze({
    voiceId: DEFAULT_VOICE_ID,
    assetCount: entries.length,
    totalBytes,
    phraseCount: records.length,
    manifestHash,
    records: Object.freeze(records),
    sourceIssues: Object.freeze([...sourceIssues, ...reviewIssues]),
    distributionIssues: Object.freeze(distributionIssues)
  });
}
