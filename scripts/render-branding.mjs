#!/usr/bin/env node
/**
 * Render the branding reel slate: unique canon texts × unique visuals,
 * Chamber painter, burned captions, social portrait.
 *
 *   node scripts/render-branding.mjs
 *   node scripts/render-branding.mjs --id meditations-fractal
 *   node scripts/render-branding.mjs --skip-existing --out out/branding
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSession } from '../src/core/session-compiler.js';
import { contentHashOf, contentHashOfBytes } from '../src/core/render/hash.js';
import { RENDER_JOB_SCHEMA } from '../src/core/render/environment.js';
import { admitRenderJob, pinnedRendererForProfile } from '../src/core/render/job.js';
import { compileRenderPlan } from '../src/core/render/plan.js';
import { mixAudio } from '../src/core/render/audio-mix.js';
import { encodeMp4 } from '../src/core/render/encode-mp4.js';
import { openChamberPainter } from '../src/core/render/chamber-paint.js';
import { MuseumProvider } from '../src/sources/visual/museum.js';
import { SCIENCE_PREFIX } from '../src/content/science/imagery/provider.js';
import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import {
  BRANDING_CAPTION,
  BRANDING_DRAW_MS,
  BRANDING_HOLD_MS,
  BRANDING_PROFILE_ID,
  BRANDING_REELS,
  BRANDING_WPM,
  brandingProgram,
  brandingSource,
  gatherReading
} from '../src/content/branding-reels.js';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';

installContentPlaneFetch();

const ROOT = dirname(fileURLToPath(import.meta.url));
const STILLS_PER_COLLECTION = 4;
const FETCH_HEADERS = {
  'User-Agent': 'RISE-branding/0.1 (private review; Art Institute / science pins)'
};

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (process.argv[index + 1] == null || process.argv[index + 1].startsWith('--')) return true;
  return process.argv[index + 1];
}

const scale = Number(arg('--scale', '1')) || 1;
const onlyId = arg('--id', null);
const skipExisting = Boolean(arg('--skip-existing', false));
const outRoot = resolve(arg('--out', join(ROOT, '..', 'out', 'branding')));

function slug(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

async function resolveText(reel) {
  const work = ingestedArchiveTexts().find(item => item.id === reel.workId);
  if (!work) throw new Error(`Archive has no work ${reel.workId}`);
  const divisions = await work.getDivisions();
  const entries = divisions.entries || [];
  const startIndex = entries.findIndex(entry => entry.label === reel.division);
  if (startIndex < 0) {
    throw new Error(`${reel.workId} has no division “${reel.division}”`);
  }
  const text = gatherReading(entries, startIndex);
  if (!text) throw new Error(`${reel.id} resolved to empty text`);
  return brandingSource(reel, text, {
    metadata: {
      workId: work.workId || work.id,
      editionId: work.editionId,
      sourceRevision: work.sourceRevision,
      divisionLabel: reel.division
    }
  });
}

async function compileTake(reel, source, stills = []) {
  const program = brandingProgram(reel, source.id);
  const sources = [source];
  const sessionInput = { wpm: BRANDING_WPM, chunkMode: 'phrase', curve: 'flat' };
  const session = compileSession({
    ...sessionInput,
    experienceProgram: program,
    sources
  });
  const sourceHash = await contentHashOf(`${source.id}:${source.data}`);
  const assetSnapshots = [];
  const inventoryAssets = [];
  for (const still of stills) {
    assetSnapshots.push({ assetId: still.id, contentHash: still.contentHash });
    inventoryAssets.push({
      assetId: still.id,
      contentHash: still.contentHash,
      kind: 'image',
      mimeType: still.mimeType,
      byteLength: still.byteLength,
      rights: { status: 'verified', distributionAllowed: true, credit: still.credit || '' }
    });
  }
  const job = (await admitRenderJob({
    schema: RENDER_JOB_SCHEMA,
    id: `render-branding-${reel.id}`.slice(0, 160),
    projectId: 'project-branding',
    projectRevision: 1,
    programHash: await contentHashOf(program),
    sourceSnapshots: [{ sourceId: source.id, contentHash: sourceHash }],
    assetSnapshots,
    profile: BRANDING_PROFILE_ID,
    viewport: { width: 1080, height: 1920, pixelRatio: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    durationMs: session.totalDuration,
    seed: `branding:${reel.id}`,
    renderer: pinnedRendererForProfile(BRANDING_PROFILE_ID),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass: 'private-review'
    }
  })).job;
  const plan = compileRenderPlan({
    job,
    program,
    sources,
    inventory: { assets: inventoryAssets },
    sessionInput
  });
  return {
    plan,
    stills: stills.map(item => ({ id: item.id, dataUrl: item.dataUrl }))
  };
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 800) throw new Error('image too small');
  return { buffer, mimeType };
}

function workUrl(work) {
  return work?.url || work?.fullUrl || work?.image || work?.thumbUrl || work?.imageUrl || null;
}

async function admitWorks(label, works) {
  const admitted = [];
  for (const work of works) {
    if (admitted.length >= STILLS_PER_COLLECTION) break;
    const url = workUrl(work);
    if (!url || !/^https?:/i.test(url)) continue;
    try {
      const { buffer, mimeType } = await fetchBytes(url);
      const contentHash = await contentHashOfBytes(buffer);
      admitted.push({
        id: `still-${slug(String(work.id || admitted.length))}`,
        contentHash,
        mimeType,
        byteLength: buffer.byteLength,
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
        credit: work.attribution || work.requiredCredit || work.sourceName || label,
        title: work.title || work.name || label
      });
      console.log(`  admitted ${admitted.length}/${STILLS_PER_COLLECTION} · ${work.title || work.id}`);
    } catch (error) {
      console.warn(`  skip ${work.id || url}: ${error.message}`);
    }
  }
  return admitted;
}

async function admitCollection(collectionId, title) {
  if (collectionId.startsWith(SCIENCE_PREFIX)) {
    const categoryId = collectionId.slice(SCIENCE_PREFIX.length);
    console.log(`Admitting ${title} (${collectionId})…`);
    const catalogPath = join(ROOT, '..', 'src', 'sources', 'visual', 'science-catalog.generated.json');
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const collection = catalog?.collections?.[categoryId];
    const wanted = new Set(collection?.works || []);
    const works = (catalog.works || [])
      .filter(work => wanted.has(work.id))
      .slice(0, 16)
      .map(work => ({
        id: work.id,
        title: work.title,
        url: work.image || work.thumb,
        attribution: work.requiredCredit || work.fullCredit,
        sourceName: work.sourceName
      }));
    return admitWorks(title, works);
  }
  if (!collectionId.startsWith('aic-')) return [];
  const categoryId = collectionId.slice('aic-'.length);
  const provider = new MuseumProvider();
  console.log(`Admitting ${title} (${categoryId})…`);
  try {
    const works = await provider.getImagesInCategory(categoryId, 40, { timeoutMs: 35_000 });
    return admitWorks(title, Array.isArray(works) ? works.slice(0, 16) : []);
  } catch (error) {
    console.warn(`  ${title} pool failed: ${error.message}`);
    return [];
  }
}

async function encodeTake(stage, reel, compiled, outputPath) {
  await stage.setPlan(compiled.plan);
  await stage.setStills(compiled.stills);
  const audio = mixAudio(compiled.plan);
  console.log(`Muxing ${reel.title} · ${compiled.plan.frameCount} frames → ${outputPath}`);
  await encodeMp4({
    frameRate: compiled.plan.frameRate,
    audio,
    outputPath,
    frames: async (index) => {
      if (index >= compiled.plan.frameCount) return null;
      return stage.capture(index);
    }
  });
}

async function stillsFor(reel) {
  if (reel.visual.kind !== 'sourced') return [];
  const collectionId = reel.visual.collections[0];
  return admitCollection(collectionId, reel.title);
}

async function main() {
  const queue = BRANDING_REELS.filter(reel => !onlyId || onlyId === true || reel.id === onlyId);
  if (!queue.length) {
    console.error(onlyId ? `Unknown branding reel: ${onlyId}` : 'No branding reels.');
    process.exit(1);
  }

  mkdirSync(outRoot, { recursive: true });
  const results = [];
  const prepared = [];
  for (const reel of queue) {
    const outputPath = join(outRoot, `${reel.id}.mp4`);
    if (skipExisting && existsSync(outputPath)) {
      console.log(`Skip existing ${reel.title}`);
      results.push({ id: reel.id, title: reel.title, status: 'exists', path: outputPath });
      continue;
    }
    try {
      const stills = await stillsFor(reel);
      if (reel.visual.kind === 'sourced' && !stills.length) {
        results.push({
          id: reel.id,
          title: reel.title,
          status: 'skipped',
          reason: 'No admitted stills'
        });
        continue;
      }
      const source = await resolveText(reel);
      const compiled = await compileTake(reel, source, stills);
      prepared.push({ reel, compiled, outputPath });
    } catch (error) {
      results.push({
        id: reel.id,
        title: reel.title,
        status: 'failed',
        reason: error.message
      });
    }
  }

  if (!prepared.length) {
    writeFileSync(join(outRoot, 'manifest.json'), `${JSON.stringify({ results }, null, 2)}\n`);
    console.log('Nothing to render.');
    return;
  }

  const stage = await openChamberPainter({
    plan: prepared[0].compiled.plan,
    scale,
    inventory: {},
    caption: BRANDING_CAPTION,
    drawMs: BRANDING_DRAW_MS,
    holdMs: BRANDING_HOLD_MS,
    ffmpegLog: console.log
  });
  await stage.setStills(prepared[0].compiled.stills);

  try {
    for (const [index, item] of prepared.entries()) {
      console.log(`\n[${index + 1}/${prepared.length}] ${item.reel.title}`);
      try {
        await encodeTake(stage, item.reel, item.compiled, item.outputPath);
        results.push({
          id: item.reel.id,
          title: item.reel.title,
          status: 'wrote',
          path: item.outputPath,
          frames: item.compiled.plan.frameCount,
          durationMs: item.compiled.plan.durationMs
        });
      } catch (error) {
        console.error(`  failed: ${error.message}`);
        results.push({
          id: item.reel.id,
          title: item.reel.title,
          status: 'failed',
          reason: error.message
        });
      }
    }
  } finally {
    await stage.close();
  }

  const manifest = {
    out: outRoot,
    scale,
    caption: true,
    profile: BRANDING_PROFILE_ID,
    counts: {
      wrote: results.filter(item => item.status === 'wrote').length,
      skipped: results.filter(item => item.status === 'skipped' || item.status === 'exists').length,
      failed: results.filter(item => item.status === 'failed').length
    },
    results
  };
  writeFileSync(join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nBranding reels · ${manifest.counts.wrote} wrote · ${manifest.counts.skipped} skipped · ${manifest.counts.failed} failed`);
  console.log(outRoot);
}

await main();
