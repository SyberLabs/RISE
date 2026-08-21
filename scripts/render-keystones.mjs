#!/usr/bin/env node
/**
 * Build the three complete canonical readings with the same score used by
 * Chamber. Rendering is local; publication is explicit and certification-
 * gated. Generated MP4 bytes never enter Git by accident.
 */

import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { buildKeystoneRenderComposition } from '../src/content/keystone-render.js';
import { KEYSTONE_MANIFESTS } from '../src/content/keystones.js';
import { MUSEUM_CATEGORY_PINS } from '../src/sources/visual/museum-pins.js';
import { resolveCollection } from '../src/content/imagery/service.js';
import { contentHashOf, contentHashOfBytes } from '../src/core/render/hash.js';
import { KERNEL_REQUEST_SCHEMA } from '../src/core/render/kernel-request.js';
import { RENDER_JOB_SCHEMA } from '../src/core/render/environment.js';
import { pinnedRendererForProfile } from '../src/core/render/job.js';
import { renderProfile } from '../src/core/render/limits.js';
import { materializeExportJob } from '../src/core/render/intake.js';

const PROFILE_ID = 'keystone-landscape-1080';
const DEFAULT_OUT = join('out', 'release', 'keystones');
const MAX_STILLS = 12;

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

function flag(name) {
  return process.argv.includes(name);
}

function interleaveBySource(pins) {
  const groups = new Map();
  for (const pin of pins || []) {
    if (!groups.has(pin.source)) groups.set(pin.source, []);
    groups.get(pin.source).push(pin);
  }
  const result = [];
  for (let index = 0; result.length < (pins || []).length; index += 1) {
    for (const group of groups.values()) if (group[index]) result.push(group[index]);
  }
  return result;
}

function mimeFromResponse(response, url) {
  const declared = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].includes(declared)) return declared;
  if (/\.png(?:$|\?)/iu.test(url)) return 'image/png';
  if (/\.webp(?:$|\?)/iu.test(url)) return 'image/webp';
  return 'image/jpeg';
}

function toDataUrl(bytes, mimeType) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function safeId(value) {
  return String(value || 'work')
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 140);
}

async function landscapeAssets() {
  const pins = interleaveBySource(MUSEUM_CATEGORY_PINS.landscapes).slice(0, MAX_STILLS);
  const works = await resolveCollection({ works: pins });
  const assets = [];
  const ids = new Set();
  for (const work of works) {
    const url = work.imageUrl || work.fullImageUrl;
    if (!url || !['PUBLIC_DOMAIN', 'CC0'].includes(work.rights)) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not acquire ${url}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = mimeFromResponse(response, url);
    const id = `landscape-${safeId(work.sourceName)}-${safeId(work.id)}`;
    if (ids.has(id)) throw new Error(`Duplicate admitted landscape id: ${id}`);
    ids.add(id);
    assets.push({
      assetId: id,
      contentHash: await contentHashOfBytes(bytes),
      kind: 'image',
      mimeType,
      byteLength: bytes.byteLength,
      dataUrl: toDataUrl(bytes, mimeType),
      rights: {
        status: 'verified',
        distributionAllowed: true,
        credit: [work.title, work.artist, work.sourceName].filter(Boolean).join(' · ')
      }
    });
  }
  if (!assets.length) throw new Error('No verified landscape stills resolved for Tintern Abbey.');
  return assets;
}

async function inventoryFor(composition) {
  const source = composition.sources[0];
  const textBytes = new TextEncoder().encode(source.data);
  const assets = composition.manifest.visual.kind === 'collection'
    ? await landscapeAssets()
    : [];
  return {
    sources: [{
      sourceId: source.id,
      contentHash: await contentHashOf(source.data),
      byteLength: textBytes.byteLength,
      characterCount: source.data.length,
      editionId: composition.manifest.source.editionId,
      sourceRevision: composition.manifest.source.sourceRevision
    }],
    assets
  };
}

async function renderJob(composition, inventory, distributionClass) {
  const profile = renderProfile(PROFILE_ID);
  return {
    schema: RENDER_JOB_SCHEMA,
    id: `render-keystone-${composition.manifest.slug}`,
    projectId: `keystone-${composition.manifest.slug}`,
    projectRevision: 1,
    programHash: await contentHashOf(composition.program),
    sourceSnapshots: inventory.sources.map(source => ({
      sourceId: source.sourceId,
      contentHash: source.contentHash,
      editionId: source.editionId,
      sourceRevision: source.sourceRevision
    })),
    assetSnapshots: inventory.assets.map(asset => ({
      assetId: asset.assetId,
      contentHash: asset.contentHash
    })),
    profile: profile.id,
    viewport: { ...profile.viewport },
    frameRate: { ...profile.frameRate },
    durationMs: composition.session.totalDuration,
    seed: `keystone-${composition.manifest.slug}:1`,
    renderer: pinnedRendererForProfile(profile.id),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass
    }
  };
}

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const digest = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', chunk => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolveHash(`sha256:${digest.digest('hex')}`));
  });
}

const selected = option('--slug', 'all');
const manifests = selected === 'all'
  ? KEYSTONE_MANIFESTS
  : KEYSTONE_MANIFESTS.filter(item => item.slug === selected);
if (!manifests.length) throw new Error(`Unknown Keystone: ${selected}`);

const shouldRender = flag('--render');
const publishDir = option('--publish-dir');
const outRoot = resolve(option('--out', DEFAULT_OUT));
const scale = Number(option('--scale', '1'));
if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
  throw new Error('--scale must be greater than 0 and at most 1');
}

mkdirSync(outRoot, { recursive: true });
if (publishDir) mkdirSync(resolve(publishDir), { recursive: true });
const results = [];
for (const manifest of manifests) {
  const composition = await buildKeystoneRenderComposition(manifest.slug);
  const durationMs = composition.session.totalDuration;
  console.log(`[keystone] ${manifest.slug} · ${(durationMs / 60_000).toFixed(2)} min · ${composition.session.atoms.length} atoms`);
  if (!shouldRender) {
    results.push({ slug: manifest.slug, durationMs, status: 'planned' });
    continue;
  }
  if (publishDir && !composition.admission.releaseCertified) {
    const codes = composition.admission.blockers.map(item => item.code).join(', ');
    throw new Error(`${manifest.title} cannot publish before release certification (${codes}).`);
  }

  const inventory = await inventoryFor(composition);
  const job = await renderJob(
    composition,
    inventory,
    publishDir ? 'public' : 'private-review'
  );
  const request = {
    schema: KERNEL_REQUEST_SCHEMA,
    program: composition.program,
    sources: composition.sources,
    inventory,
    sessionInput: composition.sessionInput,
    job,
    painter: 'chamber',
    profileId: PROFILE_ID
  };
  const outDir = join(outRoot, manifest.slug);
  const artifact = await materializeExportJob({
    document: request,
    outDir,
    options: {
      painter: 'chamber',
      profileId: PROFILE_ID,
      scale,
      ffmpegPath: option('--ffmpeg', process.env.RISE_FFMPEG_PATH || null)
    }
  });
  const filename = `${manifest.slug}.mp4`;
  const publishedPath = publishDir ? join(resolve(publishDir), filename) : null;
  if (publishedPath) copyFileSync(artifact.mp4Path, publishedPath);
  results.push({
    slug: manifest.slug,
    title: manifest.title,
    durationMs,
    profile: PROFILE_ID,
    filename,
    mp4Bytes: statSync(artifact.mp4Path).size,
    mp4Hash: await sha256File(artifact.mp4Path),
    sourceRevision: manifest.source.sourceRevision,
    ...(publishedPath ? { url: `./${filename}` } : { path: artifact.mp4Path }),
    status: publishedPath ? 'published' : 'private-review'
  });
}

const manifest = {
  schema: 'rise.keystone-distribution.v1',
  generatedAt: new Date().toISOString(),
  profile: PROFILE_ID,
  scale,
  results: publishDir && existsSync(join(resolve(publishDir), 'distribution.json'))
    ? (() => {
        const existing = JSON.parse(readFileSync(
          join(resolve(publishDir), 'distribution.json'), 'utf8'
        ));
        const bySlug = new Map(
          existing?.schema === 'rise.keystone-distribution.v1'
            ? existing.results?.map(item => [item.slug, item]) || []
            : []
        );
        for (const result of results) bySlug.set(result.slug, result);
        return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
      })()
    : results
};
const manifestPath = join(publishDir ? resolve(publishDir) : outRoot, 'distribution.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[keystone] wrote ${basename(manifestPath)}`);
