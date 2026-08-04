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

async function installVoiceWorkerStub(page) {
  // INERT, AND KEPT ONLY UNTIL THE LAST CALLER IS REWRITTEN.
  //
  // This emulates the Kokoro worker protocol — load/speak messages,
  // Float32Array samples, a Blob fallback — and the Voice has not used
  // a Worker since the static-pack pivot. It stubs `window.Worker`,
  // which nothing now constructs, so it changes nothing about any test
  // that installs it.
  //
  // Two tests were calibrated against it and failed for that reason:
  // they expected synthetic speech for arbitrary text, which the
  // architecture no longer performs. See their headers.
  //
  // Live-model/CSP coverage stays in csp-live.spec.js.
  await page.addInitScript(() => {
    class VoiceWorkerStub {
      postMessage(message) {
        queueMicrotask(() => {
          if (message.type === 'load') {
            this.onmessage?.({
              data: { id: message.id, type: 'ready', voices: ['af_heart'] }
            });
            return;
          }
          if (message.type === 'speak') {
            const samples = new Float32Array(4800);
            this.onmessage?.({
              data: {
                id: message.id,
                type: 'audio',
                samples,
                sampleRate: 24000,
                blob: new Blob([new Uint8Array(44)], { type: 'audio/wav' }),
                diagnostics: {
                  sourceByteOffset: 0,
                  sourceByteLength: samples.byteLength,
                  sourceBufferByteLength: samples.byteLength,
                  transferredByteLength: samples.byteLength,
                  peak: 0
                }
              }
            });
          }
        });
      }
      terminate() {}
    }
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      writable: true,
      value: VoiceWorkerStub
    });
  });
}

async function enterChamber(page, recitation, seed = SEED) {
  await page.setViewportSize({ width: 1280, height: 900 });
  if (recitation) await installVoiceWorkerStub(page);
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

test('an uncovered reading is read silently rather than stalled', async ({ page }) => {
  // WHAT THIS USED TO ASSERT, AND WHY IT CANNOT.
  //
  // It read `voice._speaking` and required it true. The Voice has no
  // such field and has not since the static-pack pivot — `_speaking`
  // belonged to the browser-inference runtime, which could synthesise
  // any text on demand. The assertion had been reading `undefined`.
  //
  // Recitation is now prebuilt audio: a phrase is speakable when a pack
  // covers it, and this test's text has no pack. That is the ordinary
  // case for most of the Archive, and the guarantee that matters is the
  // one a reader depends on — a reading with recitation ON and no audio
  // available must proceed at reading pace, never wait for a file that
  // is never coming.
  await enterChamber(page, true);

  // Sample the atom INDEX rather than the text: an empty display is a
  // legitimate state — pause atoms render nothing — so text alone
  // cannot tell a stalled reading from a resting one.
  const at = () => page.evaluate(() =>
    window.rise?.router?.views?.get('chamber-session')?.instance?.player?.sessionState?.currentIndex ?? -1);
  const before = await at();

  // WALL TIME AND FRAME TIME ARE DIFFERENT CLOCKS.
  //
  // This used to sleep 4000ms and then assert the index had moved. The
  // player advances on `requestAnimationFrame` (see player.js), and
  // Chromium throttles frames to near-zero for a page that is not
  // visible — so during a full parallel e2e run the sleep elapsed
  // while almost no frames were delivered, the index stayed at 0, and
  // the test failed against a reading that was working perfectly. It
  // passed 3/3 alone, which is the signature of a clock mismatch
  // rather than a defect.
  //
  // Polling for the condition measures the clock the assertion is
  // actually about. It is not a weaker test: a reading that genuinely
  // stalls never advances however long we wait, so the regression this
  // exists to catch still fails it — by timeout instead of by sleep.
  await expect.poll(at, {
    timeout: 30000,
    message: 'the reading never advanced — an uncovered reading stalled instead of reading silently'
  }).toBeGreaterThan(before);

  const after = await at();

  const r = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    return {
      hasVoice: !!ch?.voice,
      failed: ch?.voice?._failed,
      loaded: ch?.voice?._loaded,
      cached: ch?.voice?._cache?.size ?? 0,
      speaking: ch?.voice?._speaking,
      playing: ch?.player?.state
    };
  });
  console.log('ADVANCES ' + JSON.stringify({ ...r, before, after }));

  expect(r.hasVoice).toBe(true);
  // The manifest is admitted even when nothing in it covers this text.
  expect(r.failed).toBe(false);
  expect(r.loaded).toBe(true);
  // The reading moves. This is the whole point: reverent degradation
  // means silence, not a stalled reader.
  expect(after).toBeGreaterThan(before);
});

test('the control turns recitation on, and the choice survives a return', async ({ page }) => {
  await installVoiceWorkerStub(page);
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
 * So this asserts a RATE across preparation and playback. Model-load
 * behavior itself is covered by the Voice unit suite; this browser test
 * preserves the full Chamber/Player call pattern without a 92 MB fetch.
 */
test('the voice makes no request storm around preparation and playback', async ({ page }) => {
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
  // Was 2000ms, calibrated to stubbed synthesis that returned instantly.
  // Unspoken atoms advance at READING pace — roughly three seconds for
  // an eleven-word phrase at 200 wpm — so the old window could only ever
  // cross two of them.
  await page.waitForTimeout(9000);

  const state = await page.evaluate(() => {
    const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
    const v = ch?.voice;
    return {
      hasVoice: !!v,
      index: ch?.player?.sessionState?.currentIndex ?? -1,
      loaded: v?._loaded ?? null,
      // `_generating` was the inference runtime's in-flight set and is
      // another field that no longer exists. The static Voice's
      // equivalent is `_loads`: fetches of pack assets awaiting arrival.
      inFlight: v?._loads?.size ?? null,
      cached: v?._cache?.size ?? null
    };
  });
  console.log('STORM ' + JSON.stringify(state) + ' warnings=' + voiceLogs.length);

  // The reading must actually have advanced, or this proves nothing.
  expect(state.hasVoice).toBe(true);
  expect(state.index).toBeGreaterThan(1);

  // Before the fix this was in the hundreds. One line per distinct
  // cause is the contract; the allowance is for genuinely different
  // causes, not repetition of one.
  expect(voiceLogs.length).toBeLessThanOrEqual(3);

  // And nothing may be left wedged as permanently in-flight.
  expect(state.inFlight).not.toBeNull();
  expect(state.inFlight).toBeLessThanOrEqual(8);
});
