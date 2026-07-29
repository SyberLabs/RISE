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
  // Recitation lives in the AUDIO orbit. It began in Temporal on the
  // argument that it presents TEXT — true, but a reader looking for a
  // voice looks under Audio, and a dead "Text-to-Speech" toggle was
  // already sitting there answering the question wrongly.
  await page.locator('.orbit-node[data-orbit="audio"]').click();
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

  // The voice picker appears with recitation and offers only voices
  // worth hearing — the model ships twenty-four and grades one F+.
  const voices = await page.evaluate(() => {
    const sec = document.querySelector('#voice-select-section');
    return {
      shown: sec && !sec.hidden,
      options: [...document.querySelectorAll('#voice-select option')].map(o => o.value)
    };
  });
  console.log('VOICES ' + JSON.stringify(voices));
  expect(voices.shown).toBe(true);
  expect(voices.options[0]).toBe('af_heart');
  expect(voices.options).not.toContain('am_adam');

  // Begin persists the dials; returning must not reset the choice.
  await page.locator('[data-close="audio"]').click();
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

/**
 * The generation storm, in a real browser.
 *
 * A unit test can prove `prime()` makes no request before the model is
 * loaded. It cannot prove the Chamber does not CALL it in a way that
 * produces one anyway, and the failure was in exactly that seam: the
 * Chamber primes on every atom, the model takes tens of seconds to
 * fetch, and each doomed request cleared its own in-flight flag so the
 * next atom queued it again. Several a second, for the whole download.
 *
 * The reader never saw a voice error. They heard the drones tear into a
 * buzz — Web Audio underrunning behind a saturated main thread — and on
 * one occasion lost the tab.
 *
 * So this asserts a RATE, and deliberately runs for the part of the
 * session where the model is still on the wire.
 */
test('the voice makes no storm while its model is still loading', async ({ page }) => {
  const voiceLogs = [];
  page.on('console', (m) => {
    if (m.text().includes('[Voice]')) voiceLogs.push(m.text());
  });

  // Long enough that the reading is still going when the window closes.
  // SEED runs out after four atoms, which would have this test passing
  // because nothing happened rather than because nothing went wrong.
  const LONG = {
    text: Array.from({ length: 40 }, (_, i) =>
      `Phrase number ${i} | carries enough words | to occupy a moment of reading.`
    ).join('\n\n'),
    textSource: 'Storm', origin: null
  };
  await enterChamber(page, true, LONG);
  // Long enough to cross many atoms at 150 wpm while 92 MB downloads.
  await page.waitForTimeout(20000);

  const state = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    const v = ch?.voice;
    return {
      hasVoice: !!v,
      index: ch?.player?.sessionState?.currentIndex ?? -1,
      loaded: v?._loaded ?? null,
      generating: v?._generating?.size ?? null,
      cached: v?._cache?.size ?? null
    };
  });
  console.log('STORM ' + JSON.stringify(state) + ' warnings=' + voiceLogs.length);

  // The reading must actually have advanced, or this proves nothing.
  expect(state.hasVoice).toBe(true);
  expect(state.index).toBeGreaterThan(3);

  // Before the fix this was in the hundreds. One line per distinct
  // cause is the contract; the allowance is for genuinely different
  // causes, not repetition of one.
  expect(voiceLogs.length).toBeLessThanOrEqual(3);

  // And nothing may be left wedged as permanently in-flight.
  expect(state.generating).toBeLessThanOrEqual(8);
});
