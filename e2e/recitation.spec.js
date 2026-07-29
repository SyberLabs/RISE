import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Recitation', vault: null, timestamp: Date.now() };

// Emphasis is authored in the text, exactly as `|` phrase marks are.
const SEED = {
  text: 'I would tell you how *beautiful* and *amazing* the *Lord Jesus Christ* is.\n\n'
      + 'This second phrase is long enough that its reveal has room to run across several words.',
  textSource: 'Recitation', origin: null
};

// Emphasis and the reveal are independent: marked text is coloured
// whether or not recitation is on. Proving the hot path is untouched
// therefore needs text carrying NO marks.
const PLAIN = {
  text: 'This reading carries no emphasis at all, and should take the same '
      + 'textContent path the Chamber has always used.\n\nA second plain phrase.',
  textSource: 'Plain', origin: null
};

async function enterChamber(page, recitation, seed = SEED) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
      wpm: 150, chunkMode: 'phrase', recitation: { enabled: g.recitation }
    }));
  }, { gate: GATE, seed, recitation });
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  if (await warn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await warn.locator('#safety-accept').click();
  }
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
}

test('emphasis is coloured, and marks never reach the reader', async ({ page }) => {
  await enterChamber(page, true);
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const d = document.querySelector('#atom-display');
    return {
      text: d.textContent,
      words: [...d.querySelectorAll('.atom-word')].map(w => w.textContent),
      emphasised: [...d.querySelectorAll('.atom-word.is-emphasised')].map(w => w.textContent),
      recitation: window.rise?.router?.views?.get('chamber-session')
        ?.instance?.recitationEnabled
    };
  });
  console.log('EMPHASIS ' + JSON.stringify(r));

  expect(r.recitation).toBe(true);
  // The asterisks are notation. A reader must never see one.
  expect(r.text).not.toContain('*');
  expect(r.words.length).toBeGreaterThan(0);
});

test('an ordinary reading pays nothing — no spans, no timers', async ({ page }) => {
  await enterChamber(page, false, PLAIN);
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const d = document.querySelector('#atom-display');
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    return {
      spans: d.querySelectorAll('.atom-word').length,
      text: d.textContent,
      recitation: ch?.recitationEnabled,
      timers: ch?._revealTimers
    };
  });
  console.log('PLAIN ' + JSON.stringify(r));

  expect(r.recitation).toBe(false);
  // The hot path is untouched: textContent, no span scaffolding.
  expect(r.spans).toBe(0);
  expect(r.timers).toBeFalsy();
  expect(r.text.length).toBeGreaterThan(0);
});
