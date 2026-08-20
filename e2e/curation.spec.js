import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'Curation', vault: null, timestamp: Date.now() };

// Curation-only (SOURCE-CURATION-SPEC): the searched Wikimedia families
// are retired, so the panel must not offer them and no reading may cause
// a request to Commons for one.
test('the panel offers no searched category, and none is fetched', async ({ page }) => {
  const asked = [];
  await page.route('**commons.wikimedia.org**', route => {
    asked.push(decodeURIComponent(route.request().url()));
    return route.continue();
  });
  // Begin only enables once a text is chosen; seed one as the other
  // chamber specs do.
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
      text: 'A short reading, held for the panel.', textSource: 'Seed', origin: null
    }));
  }, { gate: GATE });
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20000 });

  const r = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('.vi-accordion-header')];
    const boxes = [...document.querySelectorAll('[data-sourced]')]
      .map(b => b.getAttribute('data-sourced'));
    return {
      sections: hs.filter(h => h.offsetParent !== null)
                  .map(h => h.textContent.replace(/[▲▼]/g, '').trim()),
      universalVisible: hs.some(h =>
        /Universal Diagrams/.test(h.textContent) && h.offsetParent !== null),
      offered: boxes
    };
  });
  const RETIRED = ['haeckel','botany','anatomy','astronomy','geometry','fractals','microscopy','sacred','solar','romantic'];
  console.log('PANEL ' + JSON.stringify(r));
  console.log('COMMONS_REQUESTS ' + JSON.stringify(asked.slice(0, 5)));

  expect(r.universalVisible).toBe(false);
  expect(r.offered.filter(id => RETIRED.includes(id))).toEqual([]);
  // Nothing in the entry path should reach the searched provider at all.
  expect(asked.filter(u => RETIRED.some(c => u.includes(c)))).toEqual([]);
});
