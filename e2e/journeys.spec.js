import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Journeys', vault: null, timestamp: Date.now() };

async function openJourneys(page) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="journeys"]').first().click();
  await expect(page.locator('.journeys-title')).toBeVisible({ timeout: 20000 });
}

test('the Portal offers Journeys beside the Chamber', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  // The Portal fades its nav in; wait for it rather than racing it.
  await expect(page.locator('[data-nav="journeys"]')).toBeVisible({ timeout: 20000 });
  const primary = await page.evaluate(() =>
    [...document.querySelectorAll('.nav-primary .nav-item')].map(b => b.dataset.nav));
  console.log('PRIMARY ' + JSON.stringify(primary));
  expect(primary).toEqual(['chamber', 'journeys']);
});

test('War states its argument before asking for twenty minutes', async ({ page }) => {
  await openJourneys(page);

  const card = await page.evaluate(() => {
    const el = document.querySelector('.journey-card');
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

test('the introduction hydrates with real editions and a real duration', async ({ page }) => {
  await openJourneys(page);
  // Resolution reads whole books; give it room.
  await expect(page.locator('.journey-credits')).toBeVisible({ timeout: 60000 });

  const hydrated = await page.evaluate(() => ({
    meta: [...document.querySelectorAll('.journey-meta span')].map(s => s.textContent.trim()),
    credits: [...document.querySelectorAll('.journey-credits li')].map(l => l.textContent.trim()),
    works: [...document.querySelectorAll('.journey-movement-works')].map(w => w.textContent.trim())
  }));
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

test('Begin enters the reading directly, bypassing the orbital', async ({ page }) => {
  test.setTimeout(180000);
  await openJourneys(page);
  await expect(page.locator('.journey-credits')).toBeVisible({ timeout: 60000 });

  await page.locator('.journey-begin').click();
  // §3.3: a published Journey is not reconfigured on the way in.
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });

  const state = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
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

test('the movement title follows the reading', async ({ page }) => {
  test.setTimeout(180000);
  await openJourneys(page);
  await expect(page.locator('.journey-credits')).toBeVisible({ timeout: 60000 });
  await page.locator('.journey-begin').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
  await page.waitForTimeout(3000);

  const title = await page.evaluate(() => {
    const el = document.querySelector('#movement-title');
    return { text: el?.textContent.trim(), hidden: el?.hidden };
  });
  console.log('MOVEMENT ' + JSON.stringify(title));
  expect(title.text).toBe('War in Heaven');
  expect(title.hidden).toBe(false);
});
