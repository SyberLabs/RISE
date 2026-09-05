import { test, expect } from '@playwright/test';

/**
 * The deployed policy, checked against the deployed site.
 *
 * This failure class is invisible to every other test by construction:
 * local dev serves no CSP header at all, so a policy that blocks a
 * subsystem passes the whole suite and fails only for real readers.
 * The unit test in src/core/csp.test.js asserts what netlify.toml SAYS;
 * this asserts what the site actually SENDS, and that a browser can
 * therefore reach the model.
 *
 * Skipped when RISE_LIVE is unset, so an offline run does not fail on
 * a network it cannot reach.
 */
const LIVE = 'https://rise-v2-symbolic-experience.netlify.app/';

test.skip(!process.env.RISE_LIVE, 'set RISE_LIVE=1 to check the deployed policy');

test('the live policy admits the voice model', async ({ page }) => {
  test.setTimeout(120000);
  const violations = [];
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to connect/i.test(t)) violations.push(t.slice(0, 160));
  });

  await page.goto(LIVE);
  const csp = await page.evaluate(async () => {
    const res = await fetch(location.href, { method: 'HEAD' });
    return res.headers.get('content-security-policy') || '';
  });

  // Ask the browser itself whether the model host is reachable — the
  // header could be right and still be overridden by something else.
  const reachable = await page.evaluate(async () => {
    try {
      const r = await fetch('https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json');
      return { ok: r.ok, status: r.status };
    } catch (e) { return { ok: false, error: String(e.message).slice(0, 120) }; }
  });

  console.log('CSP has hf: ' + csp.includes('huggingface.co'));
  console.log('CSP has cdn: ' + csp.includes('us.aws.cdn.hf.co'));
  console.log('MODEL FETCH ' + JSON.stringify(reachable));
  console.log('VIOLATIONS ' + JSON.stringify(violations));

  expect(csp).toContain('https://huggingface.co');
  expect(reachable.ok).toBe(true);
  expect(violations).toEqual([]);
});

test('the voice actually loads on the deployed site', async ({ page }) => {
  // The only test that proves the whole chain: policy, self-hosted
  // runtime, model download, and WASM compilation. Each failed
  // separately, and each looked like the others from the outside.
  test.setTimeout(300000);
  const blocked = [];
  const ortRequests = [];
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to|violates/i.test(t)) blocked.push(t.slice(0, 140));
  });
  page.on('request', r => {
    const u = r.url();
    if (/jsdelivr|unpkg/.test(u)) ortRequests.push('CDN: ' + u.slice(0, 90));
    else if (/\/ort\//.test(u)) ortRequests.push('self: ' + u.split('/').pop());
  });

  await page.addInitScript(() => {
    localStorage.setItem('rise-beta-session', JSON.stringify(
      { code: 'rise2025', name: 'Live', vault: null, timestamp: Date.now() }));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(
      { text: 'The first fire came from the thunder.', textSource: 'Live', origin: null }));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(
      {
        wpm: 150,
        chunkMode: 'phrase',
        capabilities: ['recitation-audio'],
        recitation: { enabled: true }
      }));
  });
  await page.goto(LIVE);
  await page.locator('[data-nav="chamber"]').first().click();
  await page.locator('#begin-btn').click({ timeout: 30000 });
  const warn = page.locator('#photosensitivity-modal');
  if (await warn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await warn.locator('#safety-accept').click();
  }
  // The model is ~92 MB on a cold cache; give it room.
  await page.waitForTimeout(90000);

  const voice = await page.evaluate(() => {
    const ch = window.__RISE_TEST__?.getView('chamber-session');
    return { hasVoice: !!ch?.voice, failed: ch?.voice?._failed, cached: ch?.voice?._cache?.size ?? 0 };
  });
  console.log('VOICE ' + JSON.stringify(voice));
  console.log('ORT ' + JSON.stringify([...new Set(ortRequests)].slice(0, 4)));
  console.log('BLOCKED ' + JSON.stringify(blocked));

  // The runtime came from us, never a CDN.
  expect(ortRequests.filter(r => r.startsWith('CDN'))).toEqual([]);
  expect(blocked).toEqual([]);
  expect(voice.failed).toBeFalsy();
});
