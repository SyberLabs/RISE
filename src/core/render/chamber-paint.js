/**
 * Node-only Chamber painter.
 *
 * Opens one Chromium stage per job and captures frames at explicit
 * presentation time as raw RGBA — the same contract as clerk
 * `renderFrameRgba`. This is a projection of the score, not a PNG
 * screenshot and not a screen recording of rAF. Vite is started once
 * for the painter, not per frame.
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { presentationMs } from './clock.js';
import { atomAt, visualRunAt } from './plan.js';
import { fail } from './errors.js';
import { decodeImage } from './decode.js';
import { galleryWallAt } from '../visual-presence.js';
import { resolveCaptionStyle } from './caption-style.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const STAGE_PATH = '/src/core/render/chamber-stage.html';

function findPlaywrightChrome() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(root)) return null;
  const names = readdirSync(root);
  const headless = names.filter(name => name.startsWith('chromium_headless_shell-')).sort().at(-1);
  const full = names.filter(name => name.startsWith('chromium-') && !name.includes('headless')).sort().at(-1);
  const candidates = [];
  if (headless) {
    candidates.push(join(root, headless, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
  }
  if (full) {
    candidates.push(join(root, full, 'chrome-win64', 'chrome.exe'));
  }
  return candidates.find(existsSync) || null;
}

async function launchChromium() {
  const sandbox = process.env.PLAYWRIGHT_BROWSERS_PATH || '';
  const home = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (sandbox.includes('cursor-sandbox-cache') && existsSync(home)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = home;
  }
  const options = { headless: true, args: ['--disable-dev-shm-usage'] };
  try {
    return await chromium.launch(options);
  } catch (error) {
    const executablePath = findPlaywrightChrome();
    if (executablePath) return chromium.launch({ ...options, executablePath });
    throw error;
  }
}

function bytesToDataUrl(bytes, mimeType = 'image/jpeg') {
  const view = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : null;
  if (!view) return null;
  return `data:${mimeType};base64,${Buffer.from(view).toString('base64')}`;
}

function stillsFromInventory(inventory = {}) {
  const stills = [];
  for (const asset of inventory.assets || []) {
    if (asset.kind && asset.kind !== 'image') continue;
    if (asset.dataUrl) {
      stills.push({ id: asset.assetId, dataUrl: asset.dataUrl });
      continue;
    }
    if (asset.bytes) {
      const dataUrl = bytesToDataUrl(asset.bytes, asset.mimeType || 'image/jpeg');
      if (dataUrl) {
        stills.push({ id: asset.assetId, dataUrl });
        continue;
      }
    }
    const decoded = decodeImage(asset);
    stills.push({
      id: asset.assetId,
      width: decoded.width,
      height: decoded.height,
      rgba: Array.from(decoded.rgba)
    });
  }
  return stills;
}

function stillFrameFor(run, stills, timeMs) {
  if (!stills.length || !run) return { stillId: null, incomingStillId: null, dissolve: 1 };
  const personalId = run.cue?.config?.personalAssetId;
  if (personalId && stills.some(item => item.id === personalId)) {
    return { stillId: personalId, incomingStillId: null, dissolve: 1 };
  }
  if (run.assetId && stills.some(item => item.id === run.assetId)) {
    return { stillId: run.assetId, incomingStillId: null, dissolve: 1 };
  }
  if (run.cueKind === 'visual:sourced:gallery' || run.cueKind === 'visual:sourced:collection') {
    const elapsedMs = Math.max(0, timeMs - (run.fromMs || 0));
    const durationMs = Math.max(0, (run.toMs || 0) - (run.fromMs || 0));
    const wall = galleryWallAt(elapsedMs, stills.length, {
      durationMs,
      cadence: run.cue?.config?.galleryCadence
    });
    const outgoing = wall.outgoingIndex == null ? null : stills[wall.outgoingIndex];
    const incoming = wall.incomingIndex == null ? null : stills[wall.incomingIndex];
    return {
      stillId: outgoing?.id || incoming?.id || null,
      incomingStillId: outgoing && incoming && outgoing.id !== incoming.id ? incoming.id : null,
      dissolve: outgoing ? wall.mix : (incoming ? wall.mix : 1)
    };
  }
  return { stillId: null, incomingStillId: null, dissolve: 1 };
}

function outputSize(plan, scale) {
  return {
    width: Math.max(1, Math.round(plan.viewport.width * scale)),
    height: Math.max(1, Math.round(plan.viewport.height * scale))
  };
}

/**
 * Portrait profiles are the phone Chamber: the ≤640px stylesheet
 * and a retina buffer matching the job. Landscape keeps 1× CSS pixels.
 */
function chamberView(plan, scale) {
  const out = outputSize(plan, scale);
  if (out.height <= out.width) {
    return { ...out, cssWidth: out.width, cssHeight: out.height, dpr: 1 };
  }
  const cssWidth = 540;
  const cssHeight = Math.round(out.height * (cssWidth / out.width));
  return {
    ...out,
    cssWidth,
    cssHeight,
    dpr: out.width / cssWidth
  };
}

export async function openChamberPainter({
  plan,
  scale = 1,
  inventory = {},
  ffmpegLog = console.log,
  caption
} = {}) {
  if (!plan) fail('RENDER_CHAMBER_PLAN', 'Chamber paint needs a compiled plan', '$.plan');
  const view = chamberView(plan, scale);
  const server = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.js'),
    server: { port: 4178, strictPort: false, open: false },
    logLevel: 'error'
  });
  await server.listen();
  const origin = server.resolvedUrls?.local?.[0];
  if (!origin) {
    await server.close();
    fail('RENDER_CHAMBER_SERVER', 'Vite did not bind a local URL for the Chamber stage', '$.server');
  }

  let browser;
  try {
    browser = await launchChromium();
  } catch (error) {
    await server.close();
    fail('RENDER_CHAMBER_BROWSER',
      'Chromium is required to paint Chamber frames',
      '$.playwright',
      { reason: error.message });
  }

  const page = await browser.newPage({
    viewport: { width: view.cssWidth, height: view.cssHeight },
    deviceScaleFactor: view.dpr,
    colorScheme: 'dark'
  });
  page.setDefaultTimeout(180_000);

  let stills = stillsFromInventory(inventory);
  let currentPlan = plan;
  let appliedCaption = resolveCaptionStyle(caption);
  const kinds = [...new Set((plan.visualRuns || []).map(run => run.cueKind))].join(', ') || 'visual:still';

  try {
    await page.goto(new URL(STAGE_PATH, origin).href, {
      waitUntil: 'networkidle',
      timeout: 60_000
    });
    await page.waitForFunction(() => window.__stage?.ready === true, null, { timeout: 30_000 });
    appliedCaption = await page.evaluate(async (args) => {
      await window.__stage.prepare(args);
      return window.__stage.caption || null;
    }, {
      width: view.width,
      height: view.height,
      seed: plan.seed,
      stills,
      caption
    });
    const type = await page.evaluate(() => {
      const el = document.getElementById('atom-display');
      return {
        family: el ? getComputedStyle(el).fontFamily : null,
        crimson: document.fonts.check('400 27px "Crimson Pro"')
      };
    });
    ffmpegLog(`Chamber stage ${view.cssWidth}×${view.cssHeight} @${view.dpr} → ${view.width}×${view.height} · ${kinds} · ${type.family}${type.crimson ? '' : ' (Crimson Pro missing)'}`);
  } catch (error) {
    await browser.close();
    await server.close();
    fail('RENDER_CHAMBER_STAGE',
      'The Chamber stage failed to load',
      '$.stage',
      { reason: error.message });
  }

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser.close();
    await server.close();
  };

  return {
    width: view.width,
    height: view.height,
    caption: appliedCaption ?? resolveCaptionStyle(caption),
    async readCaption() {
      return page.evaluate(() => ({
        caption: window.__stage.caption || null,
        glass: document.getElementById('atom-display')?.classList.contains('glass-tile') === true,
        captionMode: document.querySelector('.chamber')?.classList.contains('caption-mode') === true,
        fontFamily: document.getElementById('atom-display')
          ? getComputedStyle(document.getElementById('atom-display')).fontFamily
          : null
      }));
    },
    async setPlan(nextPlan) {
      currentPlan = nextPlan;
    },
    async setStills(nextStills = []) {
      stills = nextStills;
      await page.evaluate((items) => {
        window.__stage.replaceStills(items);
      }, stills);
    },
    async capture(frameIndex) {
      const timeMs = presentationMs(frameIndex, currentPlan.frameRate);
      const atom = atomAt(currentPlan, timeMs);
      const run = visualRunAt(currentPlan, timeMs);
      const cueKind = run?.cueKind || 'visual:still';
      const stillFrame = stillFrameFor(run, stills, timeMs);
      await page.evaluate(async (state) => {
        await window.__stage.paint(state);
      }, {
        text: atom?.text || '',
        cueKind,
        cue: run?.cue || { kind: 'still' },
        elapsedMs: run ? timeMs - run.fromMs : 0,
        durationMs: run ? run.toMs - run.fromMs : 0,
        seed: currentPlan.seed,
        stillId: stillFrame.stillId,
        incomingStillId: stillFrame.incomingStillId,
        dissolve: stillFrame.dissolve,
        caption
      });
      if (frameIndex === 0 || (frameIndex + 1) % 30 === 0) {
        ffmpegLog(`Chamber frame ${frameIndex + 1}/${currentPlan.frameCount}`);
      }
      const shot = await page.evaluate(async () => window.__stage.captureRgba());
      const bytes = Buffer.from(shot.rgba, 'base64');
      return {
        width: shot.width,
        height: shot.height,
        rgba: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        timeMs,
        frameIndex
      };
    },
    close
  };
}
