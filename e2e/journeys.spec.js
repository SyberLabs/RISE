import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Journeys', vault: null, timestamp: Date.now() };

  // Journeys live in the Vault (published readings), not on the Portal.
async function openJourneys(page) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="vault"]').first().click();
  await page.locator('[data-nav="journeys"]').first().click();
  await expect(page.locator('.journeys-title')).toBeVisible({ timeout: 20000 });
}


/** Photosensitivity consent before Chamber when a Journey has imagery. */
/** War card — Demonstration sits above it, so do not use bare `.journey-begin`. */
const WAR = '[data-journey="journey-war"]';
// War and the Demonstration are deliberately withdrawn while their quotation
// anchors are re-authored against exact certified editions. These executable
// contracts return when a Journey is admitted; the threshold/reachability test
// above remains live during the deferral.
const withdrawnJourneyTest = test.skip;

async function enterReading(page) {
  await page.locator(`${WAR} .journey-begin`).click();
  // waitFor, then isVisible — isVisible alone does not wait.
  const accept = page.locator('#safety-accept');
  await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await accept.isVisible()) await accept.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
}

test('the Portal names one act, and the Vault does not offer Journeys', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  // The Portal fades its nav in; wait for it rather than racing it.
  await expect(page.locator('[data-nav="chamber"]')).toBeVisible({ timeout: 20000 });

  // The release threshold now leads with the three Keystone readings, then
  // the general Chamber. Journeys stay out of the Portal and the Vault.
  const primary = await page.evaluate(() =>
    [...document.querySelectorAll('.nav-primary .nav-item')].map(b => b.dataset.nav));
  expect(primary).toEqual(['chamber']);
  await expect(page.locator('.portal [data-nav="journeys"]')).toHaveCount(0);

  await page.locator('[data-nav="vault"]').first().click();
  await expect(page.locator('.library.vault')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-nav="journeys"]')).toHaveCount(0);
  await expect(page.locator('.vault-journeys-note')).toHaveCount(0);
});

withdrawnJourneyTest('War states its argument before asking for twenty minutes', async ({ page }) => {
  await openJourneys(page);

  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-journey="journey-war"]');
    return {
      title: el.querySelector('.journey-name')?.textContent.trim(),
      thesis: el.querySelector('.journey-thesis')?.textContent.trim(),
      movements: [...el.querySelectorAll('.journey-movement-title')].map(m => m.textContent.trim()),
      // §1.3 — every movement says how its source RESISTS the thesis.
      against: [...el.querySelectorAll('.journey-movement-against')].length,
      begin: el.querySelector('.journey-begin')?.textContent.trim(),
      disabled: el.querySelector('.journey-begin')?.disabled
    };
  });
  console.log('CARD ' + JSON.stringify(card).slice(0, 320));

  expect(card.title).toBe('War');
  expect(card.thesis).toMatch(/descends/);
  expect(card.movements).toEqual(['War in Heaven', 'The Hero Under Heaven', 'Under Steel']);
  expect(card.against).toBe(3);
  expect(card.begin).toBe('Begin');
  expect(card.disabled).toBe(false);
});

withdrawnJourneyTest('the introduction hydrates with real editions and a real duration', async ({ page }) => {
  await openJourneys(page);
  // Resolution reads whole books; give it room.
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });

  const hydrated = await page.evaluate(() => {
    const el = document.querySelector('[data-journey="journey-war"]');
    return {
      meta: [...el.querySelectorAll('.journey-meta span')].map(s => s.textContent.trim()),
      credits: [...el.querySelectorAll('.journey-credits li')].map(l => l.textContent.trim()),
      works: [...el.querySelectorAll('.journey-movement-works')].map(w => w.textContent.trim())
    };
  });
  console.log('HYDRATED ' + JSON.stringify(hydrated).slice(0, 400));

  // Editions, because that is what a reader is actually shown.
  expect(hydrated.credits.length).toBeGreaterThan(1);
  expect(hydrated.credits.join(' ')).toMatch(/trans\./);
  // Each movement names the work it draws on.
  expect(hydrated.works.join(' ')).toMatch(/Paradise Lost/);
  expect(hydrated.works.join(' ')).toMatch(/Iliad/);
  // A duration measured from the text, not the manifest's guess of 24.
  const minutes = Number(hydrated.meta.find(m => /min$/.test(m))?.replace(/\D/g, ''));
  expect(minutes).toBeGreaterThan(24);
});

withdrawnJourneyTest('Begin enters the reading directly, bypassing the orbital', async ({ page }) => {
  test.setTimeout(180000);
  await openJourneys(page);
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });

  // §3.3: a published Journey is not reconfigured on the way in.
  await enterReading(page);

  const state = await page.evaluate(() => {
    const ch = window.__RISE_TEST__?.getView('chamber-session');
    const s = ch?.session;
    return {
      // The Chamber holds the session, which is the signal that matters:
      // `currentView` lags the DOM and asserting on it tested the
      // router's bookkeeping rather than the launch.
      inChamber: !!ch?.session,
      movements: s?.movementProgram?.movements?.map(m => m.id) ?? null,
      audioCues: s?.audioProgram?.segments?.length ?? 0,
      boundaries: s?.atoms?.filter(a => a.tags?.includes('authored-boundary')).length ?? 0,
      sources: s?.sources?.length ?? 0,
      title: s?.name
    };
  });
  console.log('LAUNCHED ' + JSON.stringify(state));

  expect(state.inChamber).toBe(true);
  expect(state.movements).toEqual(['war-heaven', 'war-hero', 'war-steel']);
  // Three scored silences: two between movements, one inside Hector's.
  expect(state.boundaries).toBe(3);
  expect(state.sources).toBe(4);
  expect(state.audioCues).toBeGreaterThan(0);
});

withdrawnJourneyTest('the movement title follows the reading', async ({ page }) => {
  test.setTimeout(180000);
  await openJourneys(page);
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });
  await enterReading(page);
  await page.waitForTimeout(3000);

  const title = await page.evaluate(() => {
    const el = document.querySelector('#movement-title');
    return { text: el?.textContent.trim(), hidden: el?.hidden };
  });
  console.log('MOVEMENT ' + JSON.stringify(title));
  expect(title.text).toBe('War in Heaven');
  expect(title.hidden).toBe(false);
});

withdrawnJourneyTest('the three reported faults are gone', async ({ page }) => {
  test.setTimeout(240000);
  const cues = [];
  page.on('console', m => { if (m.text().includes('Cue activated')) cues.push(m.text()); });
  const sched = [];
  page.on('console', m => { if (m.text().includes('schedule ready')) sched.push(m.text()); });
  await page.setViewportSize({ width: 1280, height: 720 });
  await openJourneys(page);

  // 1. The view scrolls. Journeys states a whole argument; none of it
  //    below the fold was reachable.
  const scroll = await page.evaluate(() => {
    // The scrolling element is the view's own root, not the router's
    // wrapper: body is overflow:hidden, so a long view claims the
    // viewport and scrolls inside it (the Library's pattern).
    const view = document.querySelector('.journeys');
    const before = view.scrollTop;
    view.scrollTop = 400;
    return { scrollable: view.scrollHeight > view.clientHeight, moved: view.scrollTop > before };
  });
  console.log('SCROLL ' + JSON.stringify(scroll));
  expect(scroll.scrollable).toBe(true);
  expect(scroll.moved).toBe(true);

  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });
  await enterReading(page);
  await page.waitForTimeout(6000);

  // 2. The title is out of the flow: it must not take width from the
  //    text, which it did as a flex sibling for a whole movement.
  const layout = await page.evaluate(() => {
    const title = document.querySelector('#movement-title');
    const text = document.querySelector('#atom-display');
    const t = title.getBoundingClientRect();
    const a = text.getBoundingClientRect();
    return {
      title: title.textContent.trim(),
      position: getComputedStyle(title).position,
      // Centred in the field rather than beside the text.
      textCentre: Math.round(a.left + a.width / 2),
      fieldCentre: Math.round(document.querySelector('#chamber-field').getBoundingClientRect().width / 2),
      overlaps: !(t.bottom < a.top || t.top > a.bottom)
    };
  });
  console.log('LAYOUT ' + JSON.stringify(layout));
  expect(layout.position).toBe('absolute');
  // The text sits centred in the field, not shoved left by the title.
  expect(Math.abs(layout.textCentre - layout.fieldCentre)).toBeLessThan(60);

  // 3. Procedural visuals reach the cortex and something is drawn.
  const visuals = await page.evaluate(() => {
    // The cortex is a module singleton, not on window. What is
    // observable from the page is the SESSION it was configured from
    // and whether a canvas has been painted.
    const ch = window.__RISE_TEST__?.getView('chamber-session');
    const cortex = { config: ch?.session?.visualConfig?.interlocution || null };
    const canvas = document.querySelector('canvas.visual-canvas:not([hidden]), #klee-canvas');
    let painted = false;
    if (canvas?.getContext) {
      const ctx = canvas.getContext('2d');
      try {
        const d = ctx.getImageData(0, 0, Math.min(canvas.width, 80), Math.min(canvas.height, 80)).data;
        painted = d.some(v => v !== 0);
      } catch { painted = false; }
    }
    return {
      mode: ch?.session?.visualConfig?.visualMode ?? null,
      presentation: cortex.config?.presentation ?? null,
      procedural: cortex.config?.procedural ?? null,
      painted
    };
  });
  console.log('VISUALS ' + JSON.stringify(visuals));
  console.log('SCHEDULES ' + JSON.stringify(sched.map(x => x.replace(/^.*Chamber\] /, ''))));
  console.log('CUES ' + JSON.stringify(cues.map(c => c.replace(/^.*Cortex\] /, ''))));
  // The visual schedule must EXIST — its absence was silent.
  expect(sched.join(' ')).toMatch(/Visual schedule ready/);
  // And it must have activated Milton's engines.
  expect(cues.join(' ')).toMatch(/paradise-lost/);
  // The reading opens with the cortex ON, in gallery, holding Milton's
  // engines — a cue can swap a field but cannot turn one on.
  expect(visuals.mode).toBe('interlocution');
  expect(visuals.presentation).toBe('continuous');
  expect(visuals.procedural).toContain('paradise-lost');
});

withdrawnJourneyTest('the door stays open, and War asks nothing on the way in', async ({ page }) => {
  test.setTimeout(240000);
  // WAR AUTHORS A CONTINUOUS SURFACE, so there is no notice to decline:
  // the photosensitivity warning belongs to behind-stream and full-frame,
  // and a field that crossfades has nothing to warn about. What this test
  // still guards is the door — the Begin button once stayed disabled
  // reading "Preparing…" for good, because the label was only restored on
  // failure. Declining a notice is covered for a flashing surface by
  // smoke 8.
  await openJourneys(page);
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });

  await page.locator(`${WAR} .journey-begin`).click();
  const warning = page.locator('#photosensitivity-modal');
  await warning.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  expect(await warning.isVisible(), 'a continuous surface must not be gated').toBe(false);
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
  await page.waitForTimeout(5000);

  // The reading runs, and the door it came through is still a door.
  const after = await page.evaluate(() => {
    const ch = window.__RISE_TEST__?.getView('chamber-session');
    const b = document.querySelector('[data-journey="journey-war"] .journey-begin');
    return {
      reading: !!ch?.session,
      visualMode: ch?.session?.visualConfig?.visualMode ?? null,
      beginLabel: b?.textContent?.trim() ?? null,
      beginDisabled: b?.disabled ?? null
    };
  });
  console.log('DOOR ' + JSON.stringify(after));

  expect(after.reading).toBe(true);
  expect(after.visualMode).toBe('interlocution');
  // And the door is still a door: it only ever restored the label on
  // failure, so declining left it disabled reading "Preparing…" for good.
  expect(after.beginLabel).toBe('Begin');
  expect(after.beginDisabled).toBe(false);
});

withdrawnJourneyTest("Milton's engines are alive, not photographs of themselves", async ({ page }) => {
  test.setTimeout(300000);
  // Engines must keep stepping (not a single still frame).
  const failures = [];
  page.on('console', m => { if (m.text().includes('[WorkEngines]')) failures.push(m.text()); });

  await openJourneys(page);
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });
  await enterReading(page);
  await expect(page.locator('.work-engine-plane')).toHaveCount(2, { timeout: 60000 });
  await page.waitForTimeout(4000);

  // Sample centre twice; stills match, motion does not.
  const sample = () => page.evaluate(() => {
    const plane = [...document.querySelectorAll('.work-engine-plane')]
      .find(c => parseFloat(getComputedStyle(c).opacity) > 0.5);
    if (!plane) return null;
    // Centre crop — corners are flat background on these engines.
    const w = Math.min(240, plane.width);
    const h = Math.min(240, plane.height);
    if (!w || !h) return null;
    const x = Math.max(0, (plane.width >> 1) - (w >> 1));
    const y = Math.max(0, (plane.height >> 1) - (h >> 1));
    const d = plane.getContext('2d').getImageData(x, y, w, h).data;
    let lit = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 8) lit++;
      sum += d[i] + d[i + 1] + d[i + 2];
    }
    return { lit, sum };
  });

  // SAMPLE ACROSS A WINDOW, NOT ACROSS ONE GAP. `sum` is a global
  // luminance total, and a rigid rotation very nearly preserves it — so a
  // single fixed interval can land on the same phase of the engine's cycle
  // and read as motionless while the field is plainly turning. Measured:
  // the same reading drifts 0.0008% over 2.5s and 1.9% over 8.5s. Three
  // samples, widest pair, so aliasing cannot pass for a still frame.
  const first = await sample();
  await page.waitForTimeout(2500);
  const second = await sample();
  await page.waitForTimeout(6000);
  const third = await sample();
  const sums = [first, second, third].map(s => s.sum);
  const spread = (Math.max(...sums) - Math.min(...sums)) / first.sum;
  console.log('MOTION ' + JSON.stringify({ first, second, third, spread, failures: failures.length }));

  expect(failures, failures.join(' | ')).toEqual([]);
  expect(first, 'no visible engine plane').not.toBeNull();
  // Something is drawn: a dark field would be near zero.
  expect(first.lit).toBeGreaterThan(0);
  expect(first.sum).toBeGreaterThan(0);
  // And it moved — but gently. The engines were authored at demo speed;
  // behind a paragraph they run on a scaled dt, so this asserts both
  // that the field is alive and that it is not thrashing.
  expect(sums.some(sum => sum !== first.sum), 'every sample identical — a still frame').toBe(true);
  expect(spread).toBeGreaterThan(0.0001);
  expect(spread, 'the field is moving too fast to read against').toBeLessThan(0.5);
});

withdrawnJourneyTest('a movement\'s soundscape cue actually reaches the audio engine', async ({ page }) => {
  test.setTimeout(300000);
  // Audio cues must reach the engine by name (not only appear in logs).
  const delivered = [];
  page.on('console', m => {
    const t = m.text();
    // Either the engine plays it, or it says it does not know it. Both
    // prove delivery; only the second is a missing composition.
    const hit = t.match(/\[AudioEngine\] (?:Unknown soundscape|Soundscape):\s*(\S+)/);
    if (hit) delivered.push(hit[1]);
  });

  await openJourneys(page);
  await expect(page.locator(`${WAR} .journey-credits`)).toBeVisible({ timeout: 60000 });
  await enterReading(page);
  await page.waitForTimeout(10000);

  console.log('DELIVERED ' + JSON.stringify([...new Set(delivered)]));
  expect(delivered, 'no soundscape cue reached the engine').not.toEqual([]);
  expect(delivered).toContain('war-ordered-field');
});

withdrawnJourneyTest('the Demonstration is the short door, and it opens', async ({ page }) => {
  test.setTimeout(300000);
  // War is seventy-five minutes and should be. This is what you open in
  // front of somebody who has ten, and it runs on exactly the same
  // compiler, handoff, schedulers and living field — no special path.
  const DEMO = '[data-journey="demo-procedural"]';
  const cues = [];
  page.on('console', m => {
    const hit = m.text().match(/Cue activated: \S+ → procedural: (\S+) \[([^\]]+)\]/);
    if (hit) cues.push(hit[2]);
  });

  await openJourneys(page);
  // It leads, because it is the one a reader can afford to try.
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.journey-card')].map(c => c.dataset.journey));
  expect(order[0]).toBe('demo-procedural');

  await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-journey="demo-procedural"]');
    return {
      title: el.querySelector('.journey-name')?.textContent.trim(),
      minutes: [...el.querySelectorAll('.journey-meta span')]
        .map(s => s.textContent.trim()).find(t => t.includes('min')),
      disabled: el.querySelector('.journey-begin')?.disabled
    };
  });
  console.log('DEMO ' + JSON.stringify(card));
  expect(card.title).toBe('Demonstration');
  expect(card.disabled).toBe(false);
  // Short enough to show. If this creeps past a quarter of an hour it
  // has stopped being the short door.
  expect(parseInt(card.minutes, 10)).toBeLessThan(15);

  await page.locator(`${DEMO} .journey-begin`).click();
  const accept = page.locator('#safety-accept');
  await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await accept.isVisible()) await accept.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.work-engine-plane')).toHaveCount(2, { timeout: 60000 });
  await page.waitForTimeout(8000);

  console.log('DEMOCUES ' + JSON.stringify([...new Set(cues)]));
  // The reel is showing a NAMED engine, not the family at large.
  expect(cues.length).toBeGreaterThan(0);
});
