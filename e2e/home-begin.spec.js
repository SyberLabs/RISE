import { test, expect } from './fixtures.js';

/**
 * R2, measured: Begin to the first word within 1.5 s, the field visible the
 * whole way, no preparation overlay, no task that holds the main thread
 * (docs/product/discussions/2026-10-05-canonical-home-design.md §5, §7 row 4).
 *
 * PR 7 (A3's remainder, RDR-015) holds Home under the Read view and skips the
 * overlay and its settle; the Chamber still starts 500 ms after it mounts. The
 * numbers are read on every CI run so the gap is known, not guessed; they go
 * in the annotation, in every expect message, and on stdout, which is what the
 * list reporter prints for a failure. Headless Chromium draws with
 * SwiftShader: these bound CI, not a reader's machine.
 */
const BUDGET_MS = 1500;
const LONG_TASK_MS = 50;

async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('.home-title')).not.toBeEmpty({ timeout: 15_000 });
}

/**
 * The frame at the press: Begin live, the epigraph set still, and the reading's
 * own engine the one layer on the stage at full strength (a roll cross-fades
 * over the last for 900 ms; the press waits for that to end).
 */
async function settled(page) {
  await expect(page.locator('[data-home="enter"]')).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('.home-epigraph')).not.toBeEmpty({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => {
    const portal = window.__RISE_TEST__.getView('home');
    const layers = [...document.querySelectorAll('.reading-stage-layer')];
    return portal.stage?.current?.decision === portal.reading?.decision && layers.length === 1
      && layers[0].classList.contains('is-shown') && getComputedStyle(layers[0]).opacity === '1';
  }), { timeout: 15_000 }).toBe(true);
}

/**
 * Installed before the press, read back after the word. t0 is the pointer
 * going down on Begin; tWord the first non-empty #atom-display under
 * #view-read; one sample per frame between them says what was on screen.
 */
const observe = page => page.evaluate(() => {
  const begin = { t0: null, tWord: null, word: '', samples: [], longTasks: [] };
  window.__riseBegin = begin;
  const home = document.querySelector('#view-home');
  const read = document.querySelector('#view-read');
  const overlay = document.querySelector('#loading-overlay');
  const opacity = el => parseFloat(getComputedStyle(el).opacity);
  // How much of a view's field shows: nothing while the view is hidden, else the
  // view's opacity times the strongest matching node's.
  const field = (view, selector) => (view.hidden ? 0 : opacity(view) * Math.max(0, ...[...view.querySelectorAll(selector)].map(opacity)));

  document.querySelector('[data-home="enter"]').addEventListener('pointerdown', () => { begin.t0 = performance.now(); }, { once: true });

  new MutationObserver((records, observer) => {
    const atom = read.querySelector('#atom-display');
    if (!atom || !atom.textContent.trim()) return;
    begin.tWord = performance.now();
    begin.word = atom.textContent.trim();
    observer.disconnect();
  }).observe(read, { childList: true, characterData: true, subtree: true });

  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) begin.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ entryTypes: ['longtask'] });

  const sample = now => {
    if (begin.tWord !== null) return;
    if (begin.t0 !== null) {
      begin.samples.push({
        t: Math.round(now - begin.t0),
        home: home.hidden ? 'hidden' : opacity(home),
        stage: field(home, '.reading-stage-layer.is-shown'),
        overlay: overlay.className,
        read: read.hidden ? 'hidden' : opacity(read),
        scheduled: field(read, '.chamber-scheduled-field.is-active'),
        layers: field(read, '#chamber-continuous-field .continuous-field-layer'),
        plates: field(read, '.plate-plane')
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});

/** Today's poem as Home opens, then one roll per vivid temper: the same work and section, the temper's centre. */
const cases = [['today’s poem', null], ...['signal', 'ember', 'revel'].map(temper => [`a ${temper} roll`, temper])];

for (const [name, temper] of cases) {
  test(`Begin on ${name}: the first word within 1.5 s over a field that never leaves, with no overlay and no long task`, async ({ page }) => {
    await openHome(page);
    if (temper) {
      await page.evaluate(async temper => {
        const portal = window.__RISE_TEST__.getView('home');
        const tools = await portal.loadTools();
        const decision = tools.composeRoll({ temper: tools.TEMPERS.find(t => t.id === temper), workId: 'spoon-river-anthology', section: 'first', random: () => 0 });
        portal.showDecision(tools, decision, { temper });
      }, temper);
    }
    await settled(page);
    await observe(page);

    await page.locator('[data-home="enter"]').click();
    await page.waitForFunction(() => window.__riseBegin.tWord !== null, null, { timeout: 30_000 });
    const begin = await page.evaluate(() => window.__riseBegin);

    const firstWord = Math.round(begin.tWord - begin.t0);
    const frames = begin.samples.length;
    const overlayShown = begin.samples.filter(s => !/\bhidden\b/u.test(s.overlay));
    const fieldless = begin.samples.filter(s => Math.max(s.stage, s.scheduled, s.layers, s.plates) <= 0);
    const longest = Math.max(0, ...begin.longTasks
      .filter(task => task.start + task.duration > begin.t0 && task.start < begin.tWord)
      .map(task => task.duration));
    const at = list => (list.length ? `, from ${list[0].t} ms to ${list[list.length - 1].t} ms` : '');
    const summary = `${name}: first word ${firstWord} ms (“${begin.word.slice(0, 24)}”) | overlay shown in ${overlayShown.length} of ${frames} frames${at(overlayShown)} | no field in ${fieldless.length} of ${frames} frames${at(fieldless)} | longest long task ${Math.round(longest)} ms`;
    test.info().annotations.push({ type: 'begin-to-first-word', description: summary });
    console.log(`[home-begin] ${summary}`);

    // The line above is written before anything can throw, so a failing run
    // still prints its numbers; a missing stamp shows as NaN.
    expect(begin.t0, summary).not.toBeNull();
    expect(frames, summary).toBeGreaterThan(0);
    expect(firstWord, summary).toBeLessThanOrEqual(BUDGET_MS);
    expect(overlayShown.length, summary).toBe(0);
    expect(fieldless.length, summary).toBe(0);
    expect(longest, summary).toBeLessThanOrEqual(LONG_TASK_MS);
  });
}
