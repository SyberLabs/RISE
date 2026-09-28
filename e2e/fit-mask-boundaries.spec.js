import { test, expect } from './fixtures.js';

/**
 * THE TWO ENDS OF A FIT READING.
 *
 * `fit-mask.spec.js` holds the middle: a dressed word is never undressed
 * to be redressed, measured at 144 strobes across 145 words before it was
 * fixed. It installs its observer AFTER `expectAtomicMaskReady`, so the
 * cold start is excluded by construction, and it never watches the exit.
 *
 * Both ends were unguarded, and both showed the same thing — the atom in
 * `--color-light` (#E8E8EC) at full Fit size, which is a near-white word
 * the size of the screen. Measured on /keystone/meditations, 1280x800,
 * production build:
 *
 *   entering   state=fallback  color=rgb(232,232,236)   400ms unthrottled
 *                                                       1.9s at 6x CPU
 *   leaving    state=inactive  color=rgb(232,232,236)   >=2.98s
 *
 * The leaving case is not a race and not a slow network: `onExit` destroyed
 * the Chamber before navigating away from it, so the word was undressed
 * while still on screen and stayed that way for the whole route transition.
 */

const GATE = { code: 'rise2025', name: 'Fit Boundaries', vault: null, timestamp: Date.now() };

/**
 * How long an opaque Fit word must be on screen before it counts as a
 * fallback rather than a flash.
 *
 * A fallback is for a wait the reader would otherwise spend looking at
 * nothing; a word that is replaced faster than this was never worth
 * showing. Measured reveal latency from the mask applying: 454ms on this
 * desktop, 2.1s at 6x CPU throttling. The floor sits under the slow case
 * and over the fast one, so a real wait still gets readable type and a
 * quick one is never interrupted by a white frame.
 */
const MIN_FALLBACK_MS = 600;
// The runtime commits to 750ms (PLAIN_DWELL_MS). The floor here sits under
// that on purpose: it has to catch a flash, not police the exact dwell, and
// per-frame sampling cannot then turn a satisfied dwell into a failure.

test.describe.configure({ timeout: 180_000 });

/** Per-frame truth about what the reader is actually being shown. */
async function startSampler(page) {
  await page.evaluate(() => {
    window.__fitSamples = [];
    const t0 = performance.now();
    const tick = () => {
      const atom = document.querySelector('#atom-display');
      if (atom) {
        const cs = getComputedStyle(atom);
        // Every ancestor can hide it, so opacity has to be walked.
        let node = atom;
        let effective = 1;
        while (node && node !== document.body) {
          effective *= parseFloat(getComputedStyle(node).opacity || '1');
          if (getComputedStyle(node).visibility === 'hidden') effective = 0;
          node = node.parentElement;
        }
        window.__fitSamples.push({
          t: Math.round(performance.now() - t0),
          text: (atom.textContent || '').trim(),
          state: atom.dataset.maskState || 'unset',
          color: cs.color,
          fontPx: Math.round(parseFloat(cs.fontSize) || 0),
          opacity: Math.round(effective * 100) / 100,
          ready: atom.classList.contains('is-mask-ready')
        });
      }
      window.__fitRaf = requestAnimationFrame(tick);
    };
    window.__fitRaf = requestAnimationFrame(tick);
  });
}

async function stopSampler(page) {
  return page.evaluate(() => {
    cancelAnimationFrame(window.__fitRaf);
    return window.__fitSamples;
  });
}

/**
 * A frame the reader sees as a bare word: text present, painted in an
 * opaque colour, and actually visible. `rgba(0, 0, 0, 0)` is the dressed
 * state, where the letters are a hole onto the imagery.
 */
const isBareWord = s => s.text.length > 0
  && s.color !== 'rgba(0, 0, 0, 0)'
  && s.opacity > 0.05;

/** Contiguous runs of bare-word frames, with when each ended. */
function bareRuns(samples) {
  const runs = [];
  let open = null;
  for (const s of samples) {
    if (isBareWord(s)) {
      if (!open) { open = { from: s.t, until: s.t, frames: 0, color: s.color, fontPx: s.fontPx, text: s.text }; runs.push(open); }
      open.until = s.t;
      open.frames += 1;
      open.endedReady = false;
    } else {
      if (open) open.endedReady = s.ready;
      open = null;
    }
  }
  return runs;
}

const describeRun = r =>
  `${r.from}-${r.until}ms (${r.frames}f, ${r.until - r.from}ms) ${r.color} ${r.fontPx}px "${r.text}"`;

async function enterMeditations(page) {
  await page.addInitScript(gate => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
  }, GATE);
  await page.goto('/keystone/meditations');
  const enter = page.locator('[data-enter]');
  await expect(enter).toBeEnabled({ timeout: 25_000 });
  await expect(enter).toHaveAttribute('data-keystone', 'meditations');
  return enter;
}

async function clearWarning(page) {
  const warning = page.locator('#photosensitivity-modal');
  const display = page.locator('#chamber-display');
  await Promise.race([
    warning.waitFor({ state: 'visible', timeout: 25_000 }),
    display.waitFor({ state: 'visible', timeout: 25_000 })
  ]);
  if (await warning.isVisible()) await warning.locator('#safety-accept').click();
  await expect(display).toBeVisible({ timeout: 25_000 });
}

test('leaving a Fit reading never undresses the word on screen', async ({ page }) => {
  // MEASURED BEFORE THE FIX: 169 frames, at least 2.98 seconds, of
  // rgb(232, 232, 236) at full Fit size between confirming Terminate and
  // the Portal arriving. `onExit` called destroy() on a view the router
  // had not faded out yet, and the router's own order — deactivate, fade,
  // hide, THEN dispose — was correct all along.
  const enter = await enterMeditations(page);
  await enter.click();
  await clearWarning(page);
  await expect(page.locator('#atom-display'))
    .toHaveAttribute('data-mask-state', 'ready', { timeout: 30_000 });

  await startSampler(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#exit-confirm')).toBeVisible({ timeout: 10_000 });
  await page.locator('#exit-confirm').click();
  await page.waitForTimeout(4_000);
  const samples = await stopSampler(page);

  const bare = bareRuns(samples);
  expect(samples.length, 'the sampler ran').toBeGreaterThan(30);
  expect(
    bare.map(describeRun),
    'the word must stay dressed, or be gone, until the Chamber is'
  ).toEqual([]);
});

test('entering a Fit reading never shows a word it is about to replace', async ({ page }) => {
  // A fallback is for a wait worth covering. An opaque word that is
  // replaced by the dressed one a few frames later was never a fallback,
  // it was a flash — and at Fit size on a dark stage it is most of the
  // screen going white and back.
  //
  // Throttled because the window is a race: the mask is applied before
  // the first word's text arrives, and whichever wins decides whether the
  // reader sees anything at all. Six times slower is a phone, and it makes
  // the race land the way the reports describe.
  const cdp = await page.context().newCDPSession(page);
  const enter = await enterMeditations(page);
  await startSampler(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await enter.click();
  await clearWarning(page);
  await expect(page.locator('#atom-display'))
    .toHaveAttribute('data-mask-state', 'ready', { timeout: 60_000 });
  await page.waitForTimeout(1_000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const samples = await stopSampler(page);

  // Only the runs that were REPLACED by the dressed word are flashes. One
  // that is still on screen when the reading is under way is the readable
  // fallback doing its job, and it is allowed to be brief at the end only
  // because something else ended it.
  const flashes = bareRuns(samples)
    .filter(r => r.endedReady && (r.until - r.from) < MIN_FALLBACK_MS);

  expect(samples.length, 'the sampler ran').toBeGreaterThan(30);
  expect(
    flashes.map(describeRun),
    `an opaque Fit word shown for under ${MIN_FALLBACK_MS}ms and then dressed`
  ).toEqual([]);
});

test('a Fit reading whose imagery never arrives is still legible', async ({ page }) => {
  // THE READER MUST NEVER GET A BLANK STAGE, and holding the word back
  // until the mask can dress it is exactly the change that could cause
  // one. Every remote mask image is refused here, which is not
  // hypothetical: a quarter of this keystone's pins already fail behind
  // Cloudflare with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin.
  //
  // What RISE actually does in that case is dress the word from a bundled
  // data-URI plate rather than fall back to plain type — measured, not
  // assumed. So the contract worth holding is legibility, not opacity:
  // whatever route it takes, a word has to become visible.
  await page.route('**/iiif/**', route => route.abort());
  await page.route('**/iiif.micr.io/**', route => route.abort());

  const enter = await enterMeditations(page);
  await enter.click();
  await clearWarning(page);

  const atom = page.locator('#atom-display');
  await expect(atom).not.toHaveText('', { timeout: 30_000 });
  await expect.poll(async () => atom.evaluate(el => {
    let node = el;
    let effective = 1;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      effective *= parseFloat(cs.opacity || '1');
      if (cs.visibility === 'hidden') effective = 0;
      node = node.parentElement;
    }
    const dressed = getComputedStyle(el).color === 'rgba(0, 0, 0, 0)'
      && !!document.querySelector('.chamber-fill-field:not(.is-hidden)');
    const plain = getComputedStyle(el).color !== 'rgba(0, 0, 0, 0)';
    return (el.textContent || '').trim().length > 0
      && effective > 0.9
      && (dressed || plain);
  }), { timeout: 20_000, message: 'a reader with no imagery still gets a visible word' })
    .toBe(true);
});
