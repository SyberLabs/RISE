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

test('the voice never blocks the reading, and never ships unasked', async ({ page }) => {
  // The 92 MB model must not be fetched because someone opened the
  // Chamber. Only a reading that asks for a voice pays for one.
  const fetched = [];
  await page.route('**huggingface.co**', r => { fetched.push(r.request().url()); return r.continue(); });

  await enterChamber(page, false, PLAIN);
  await page.waitForTimeout(3000);

  const r = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    return { voice: !!ch?.voice, recitation: ch?.recitationEnabled };
  });
  console.log('NO_VOICE ' + JSON.stringify(r) + ' model requests: ' + fetched.length);

  // No recitation, no Voice instance, no model fetch.
  expect(r.recitation).toBe(false);
  expect(r.voice).toBe(false);
  expect(fetched).toEqual([]);
});

test('a recitation reading advances even before speech is ready', async ({ page }) => {
  // The contract from RECITATION-SPEC section 2: a reading that cannot
  // be spoken is read SILENTLY, never stalled. The model takes seconds
  // to load, so the first atoms are always unspoken — and the reading
  // must not wait for them.
  await enterChamber(page, true);

  // Sample the atom INDEX rather than the text: an empty display is a
  // legitimate state — pause atoms render nothing — so text alone
  // cannot tell a stalled reading from a resting one.
  const at = () => page.evaluate(() =>
    window.rise?.router?.views?.get('chamber-session')?.instance?.player?.sessionState?.currentIndex ?? -1);
  const before = await at();
  await page.waitForTimeout(4000);
  const after = await at();

  const r = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    return { hasVoice: !!ch?.voice, failed: ch?.voice?._failed, playing: ch?.player?.state };
  });
  console.log('ADVANCES ' + JSON.stringify({ ...r, before, after }));

  expect(r.hasVoice).toBe(true);
  // Whatever happened to the model, the reading moved on.
  expect(after).toBeGreaterThan(before);
});

test('the control turns recitation on, and the choice survives a return', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
  }, { gate: GATE, seed: SEED });
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  // Recitation lives in the TEMPORAL orbit, beside pace and chunking —
  // it modifies how the text is presented, not the imagery.
  await page.locator('.orbit-node[data-orbit="temporal"]').click();
  await expect(page.locator('[data-recitation="on"]')).toBeVisible({ timeout: 15000 });

  // The note explains the download BEFORE it happens, so enabling a
  // voice is never a surprise.
  const noteHiddenAtFirst = await page.locator('[data-recitation-note]').isHidden();
  await page.locator('[data-recitation="on"]').click();

  const after = await page.evaluate(() => {
    const o = window.rise?.router?.views?.get('chamber')?.instance;
    return {
      config: o?.config?.recitation,
      noteShown: !document.querySelector('[data-recitation-note]')?.hidden,
      onActive: document.querySelector('[data-recitation="on"]')?.classList.contains('active'),
      offActive: document.querySelector('[data-recitation="off"]')?.classList.contains('active')
    };
  });
  console.log('CONTROL ' + JSON.stringify({ noteHiddenAtFirst, ...after }));

  expect(noteHiddenAtFirst).toBe(true);
  expect(after.config).toEqual({ enabled: true });
  expect(after.noteShown).toBe(true);
  expect(after.onActive).toBe(true);
  expect(after.offActive).toBe(false);

  // Begin persists the dials; returning must not reset the choice.
  await page.locator('[data-close="temporal"]').click();
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  if (await warn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await warn.locator('#safety-accept').click();
  }
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });

  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}').recitation);
  console.log('PERSISTED ' + JSON.stringify(persisted));
  expect(persisted).toEqual({ enabled: true });
});
