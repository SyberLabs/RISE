#!/usr/bin/env node
/**
 * Render a Chamber catalog: every museum/science collection, every
 * procedural substyle, and every attractor configuration.
 *
 *   node scripts/render-catalog.mjs
 *   node scripts/render-catalog.mjs --only procedural
 *   node scripts/render-catalog.mjs --only attractor --skip-existing
 *   node scripts/render-catalog.mjs --only collections --out out/render/catalog
 *
 * Collection stills are admitted here (fetched and hashed) before any
 * frame is painted. The renderer itself does not call museum APIs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../src/core/experience-program.js';
import { compileSession } from '../src/core/session-compiler.js';
import { contentHashOf, contentHashOfBytes } from '../src/core/render/hash.js';
import { RENDER_JOB_SCHEMA } from '../src/core/render/environment.js';
import { admitRenderJob, pinnedRendererForProfile } from '../src/core/render/job.js';
import { compileRenderPlan } from '../src/core/render/plan.js';
import { mixAudio } from '../src/core/render/audio-mix.js';
import { encodeMp4 } from '../src/core/render/encode-mp4.js';
import { openChamberPainter } from '../src/core/render/chamber-paint.js';
import { MUSEUM_CATEGORIES, MuseumProvider } from '../src/sources/visual/museum.js';
import { SCIENCE_PREFIX } from '../src/content/science/imagery/provider.js';
import { SCIENCE_CATEGORIES } from '../src/content/science/imagery/science-pins.js';
import {
  ATTRACTOR_FORMS,
  ATTRACTOR_PALETTES,
  ATTRACTOR_SYSTEMS,
  HARMONOGRAPH_CLIMATES,
  KLEE_PRESETS,
  OSTENSORIA_PALETTES,
  APPARITIO_PALETTES
} from '../src/core/visual-style-definitions.js';
import { PROCEDURAL_PATTERNS as PROCEDURAL_LIST } from '../src/core/visual-registry.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');
const PROFILE = 'social-portrait-1080';
const STILLS_PER_COLLECTION = 4;
const FETCH_HEADERS = {
  'User-Agent': 'RISE-catalog/0.1 (private review; Art Institute / science pins)'
};

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (process.argv[index + 1] == null || process.argv[index + 1].startsWith('--')) return true;
  return process.argv[index + 1];
}

const scale = Number(arg('--scale', '1')) || 1;
const only = arg('--only', 'all');
const onlyId = arg('--id', null);
const skipExisting = Boolean(arg('--skip-existing', false));
const outRoot = resolve(arg('--out', join(ROOT, '..', 'out', 'render', 'catalog')));

function slug(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function proceduralTakes() {
  const takes = [];
  for (const pattern of PROCEDURAL_LIST) {
    if (pattern.id === 'klee') {
      for (const preset of KLEE_PRESETS) {
        takes.push({
          group: 'procedural',
          id: `klee-${preset.id}`,
          title: `Klee · ${preset.name}`,
          cue: { kind: 'procedural', collections: ['klee'], config: { preset: preset.id } }
        });
      }
      continue;
    }
    if (pattern.id === 'harmonograph') {
      for (const climate of HARMONOGRAPH_CLIMATES) {
        takes.push({
          group: 'procedural',
          id: `harmonograph-${climate.id}`,
          title: `Harmonograph · ${climate.name}`,
          cue: {
            kind: 'procedural',
            collections: ['harmonograph'],
            config: { climate: climate.id }
          }
        });
      }
      continue;
    }
    if (pattern.id === 'ostensoria') {
      for (const palette of OSTENSORIA_PALETTES) {
        takes.push({
          group: 'procedural',
          id: `ostensoria-${palette.id}`,
          title: `Iris Plates · ${palette.name}`,
          cue: {
            kind: 'procedural',
            collections: ['ostensoria'],
            config: { palette: palette.id }
          }
        });
      }
      continue;
    }
    if (pattern.id === 'apparitio') {
      for (const palette of APPARITIO_PALETTES) {
        takes.push({
          group: 'procedural',
          id: `apparitio-${palette.id}`,
          title: `Spectral Plates · ${palette.name}`,
          cue: {
            kind: 'procedural',
            collections: ['apparitio'],
            config: { palette: palette.id }
          }
        });
      }
      continue;
    }
    takes.push({
      group: 'procedural',
      id: pattern.id,
      title: pattern.name,
      cue: { kind: 'procedural', collections: [pattern.id] }
    });
  }
  return takes;
}

function attractorTakes() {
  const takes = [];
  for (const system of ATTRACTOR_SYSTEMS) {
    for (const palette of ATTRACTOR_PALETTES) {
      for (const form of ATTRACTOR_FORMS) {
        takes.push({
          group: 'attractor',
          id: `attractor-${system.id}-${palette.id}-${form}`,
          title: `Attractor · ${system.name} · ${palette.name} · ${form}`,
          cue: {
            kind: 'field',
            renderer: 'attractor',
            config: { system: system.id, palette: palette.id, form }
          }
        });
      }
    }
  }
  return takes;
}

function collectionSpecs() {
  const specs = Object.entries(MUSEUM_CATEGORIES).map(([id, category]) => ({
    group: 'collections',
    id: `aic-${id}`,
    title: category.name,
    collectionId: `aic-${id}`,
    provider: 'museum',
    categoryId: id
  }));
  for (const [id, category] of Object.entries(SCIENCE_CATEGORIES)) {
    specs.push({
      group: 'collections',
      id: `${SCIENCE_PREFIX}${id}`,
      title: category.name,
      collectionId: `${SCIENCE_PREFIX}${id}`,
      provider: 'science',
      categoryId: id
    });
  }
  return specs;
}

function programFor(cue, programId) {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: programId,
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [SOURCE_ID] },
          data: { index: 0, title: 'Catalog' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'v1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue
        }],
        fallback: { kind: 'still' }
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        clips: [{
          id: 'bed-1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora', fadeMs: 400 }
        }],
        fallback: { kind: 'silence', fadeMs: 400 }
      },
      {
        id: 'reading',
        kind: 'reading',
        clips: [{
          id: 'pace-1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'pace', wpm: 150, chunkMode: 'phrase' }
        }]
      }
    ]
  });
}

async function compileTake(take, stills = []) {
  const program = programFor(take.cue, `catalog-${take.id}`);
  const sources = [{ id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }];
  const sessionInput = { wpm: 150, chunkMode: 'phrase', curve: 'flat' };
  const session = compileSession({
    ...sessionInput,
    experienceProgram: program,
    sources
  });
  const sourceHash = await contentHashOf(`${SOURCE_ID}:${SOURCE_TEXT}`);
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
      rights: { status: 'verified', distributionAllowed: false, credit: still.credit || '' }
    });
  }
  const job = (await admitRenderJob({
    schema: RENDER_JOB_SCHEMA,
    id: `render-catalog-${take.id}`.slice(0, 160),
    projectId: 'project-catalog',
    projectRevision: 1,
    programHash: await contentHashOf(program),
    sourceSnapshots: [{ sourceId: SOURCE_ID, contentHash: sourceHash }],
    assetSnapshots,
    profile: PROFILE,
    viewport: { width: 1080, height: 1920, pixelRatio: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    durationMs: session.totalDuration,
    seed: `catalog:${take.id}`,
    renderer: pinnedRendererForProfile(PROFILE),
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

async function admitMuseum(categoryId, title) {
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

async function admitScience(categoryId, title) {
  console.log(`Admitting ${title} (sci-${categoryId})…`);
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

async function encodeTake(stage, take, compiled, outputPath) {
  await stage.setPlan(compiled.plan);
  await stage.setStills(compiled.stills);
  const audio = mixAudio(compiled.plan);
  console.log(`Muxing ${take.title} · ${compiled.plan.frameCount} frames → ${outputPath}`);
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

function wantedGroups() {
  if (only === 'all' || only === true) return new Set(['collections', 'procedural', 'attractor']);
  return new Set([String(only)]);
}

async function main() {
  const groups = wantedGroups();
  mkdirSync(outRoot, { recursive: true });
  const results = [];

  const procedural = groups.has('procedural') ? proceduralTakes() : [];
  const attractors = groups.has('attractor') ? attractorTakes() : [];
  const collectionDefs = (groups.has('collections') ? collectionSpecs() : [])
    .filter(spec => !onlyId || onlyId === true || spec.id === onlyId);
  const proceduralTakesFiltered = procedural.filter(take => !onlyId || onlyId === true || take.id === onlyId);
  const attractorTakesFiltered = attractors.filter(take => !onlyId || onlyId === true || take.id === onlyId);

  const collectionTakes = [];
  for (const spec of collectionDefs) {
    const stills = spec.provider === 'science'
      ? await admitScience(spec.categoryId, spec.title)
      : await admitMuseum(spec.categoryId, spec.title);
    if (!stills.length) {
      results.push({
        group: spec.group,
        id: spec.id,
        title: spec.title,
        status: 'skipped',
        reason: 'No admitted stills'
      });
      continue;
    }
    collectionTakes.push({
      group: spec.group,
      id: spec.id,
      title: spec.title,
      cue: { kind: 'sourced', collections: [spec.collectionId] },
      stills
    });
  }

  const queue = [...proceduralTakesFiltered, ...attractorTakesFiltered, ...collectionTakes];
  if (!queue.length) {
    writeFileSync(join(outRoot, 'catalog.json'), `${JSON.stringify({ results }, null, 2)}\n`);
    console.log('Nothing to render.');
    return;
  }

  const first = queue[0];
  const firstCompiled = await compileTake(first, first.stills || []);
  const stage = await openChamberPainter({
    plan: firstCompiled.plan,
    scale,
    inventory: {},
    ffmpegLog: console.log
  });
  await stage.setStills(firstCompiled.stills);

  try {
    for (const [index, take] of queue.entries()) {
      const dir = join(outRoot, take.group);
      mkdirSync(dir, { recursive: true });
      const outputPath = join(dir, `${slug(take.id)}.mp4`);
      if (skipExisting && existsSync(outputPath)) {
        console.log(`Skip existing ${take.title}`);
        results.push({ group: take.group, id: take.id, title: take.title, status: 'exists', path: outputPath });
        continue;
      }
      console.log(`\n[${index + 1}/${queue.length}] ${take.title}`);
      const compiled = index === 0 && take === first
        ? firstCompiled
        : await compileTake(take, take.stills || []);
      try {
        await encodeTake(stage, take, compiled, outputPath);
        results.push({
          group: take.group,
          id: take.id,
          title: take.title,
          status: 'wrote',
          path: outputPath,
          frames: compiled.plan.frameCount,
          durationMs: compiled.plan.durationMs
        });
      } catch (error) {
        console.error(`  failed: ${error.message}`);
        results.push({
          group: take.group,
          id: take.id,
          title: take.title,
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
    only,
    counts: {
      wrote: results.filter(item => item.status === 'wrote').length,
      skipped: results.filter(item => item.status === 'skipped' || item.status === 'exists').length,
      failed: results.filter(item => item.status === 'failed').length
    },
    results
  };
  writeFileSync(join(outRoot, 'catalog.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nCatalog complete · ${manifest.counts.wrote} wrote · ${manifest.counts.skipped} skipped · ${manifest.counts.failed} failed`);
  console.log(outRoot);
}

await main();
