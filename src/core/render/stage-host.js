/**
 * Node-only browser host for offline stages.
 *
 * One Vite server and one Chromium page, opened once per render and held
 * for its whole duration. Both the Chamber stage and the Composition
 * stage paint at an explicit clock through this; neither records a tab.
 *
 * The bootstrap lives here rather than in either painter because it is
 * the same ninety lines in both cases, and the second stage should not
 * have needed a second copy of Chromium discovery to exist.
 *
 * VITE AND PLAYWRIGHT ARE IMPORTED WHERE THEY ARE USED, not at the top.
 * esbuild will not load under jsdom, so a static import here makes this
 * module — and every painter that reaches it — impossible to open in a
 * test environment. Deferring them keeps the whole render tree readable
 * by the sweeps that check the codebase for itself, and costs one await
 * on a path that is already starting a browser.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './errors.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

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

export async function launchChromium() {
  const { chromium } = await import('playwright');
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

/**
 * Serve `stagePath`, open it in Chromium, and wait for the page to
 * publish `window.__stage.ready`.
 *
 * @returns {Promise<{ page: import('playwright').Page, close: () => Promise<void> }>}
 */
export async function openStageHost({
  stagePath,
  cssWidth,
  cssHeight,
  dpr = 1,
  subject = 'stage',
  codePrefix = 'RENDER_STAGE',
  readyTimeoutMs = 30_000
} = {}) {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.js'),
    // The render stage transforms one known entry on demand. Repository-wide
    // HTML discovery adds no value here and can outlive a short render,
    // racing the next stage while the first server is closing.
    optimizeDeps: { noDiscovery: true },
    // A render job is a pinned snapshot. HMR or repository watching would let
    // unrelated writes (for example voice-pack checkpoints) navigate the page
    // between frames and violate that snapshot boundary.
    server: {
      port: 4178,
      strictPort: false,
      open: false,
      hmr: false,
      watch: { ignored: ['**/*'] }
    },
    logLevel: 'error'
  });
  await server.listen();
  const origin = server.resolvedUrls?.local?.[0];
  if (!origin) {
    await server.close();
    fail(`${codePrefix}_SERVER`, `Vite did not bind a local URL for the ${subject}`, '$.server');
  }

  let browser;
  try {
    browser = await launchChromium();
  } catch (error) {
    await server.close();
    fail(`${codePrefix}_BROWSER`,
      `Chromium is required to paint ${subject} frames`,
      '$.playwright',
      { reason: error.message });
  }

  const page = await browser.newPage({
    viewport: { width: cssWidth, height: cssHeight },
    deviceScaleFactor: dpr,
    colorScheme: 'dark'
  });
  page.setDefaultTimeout(180_000);

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser.close();
    await server.close();
  };

  try {
    await page.goto(new URL(stagePath, origin).href, {
      waitUntil: 'networkidle',
      timeout: 60_000
    });
    await page.waitForFunction(() => window.__stage?.ready === true, null, {
      timeout: readyTimeoutMs
    });
  } catch (error) {
    await close();
    fail(`${codePrefix}_STAGE`,
      `The ${subject} failed to load`,
      '$.stage',
      { reason: error.message });
  }

  return { page, close };
}
