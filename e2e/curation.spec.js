import { test, expect, openHomeNav } from './fixtures.js';
const GATE = { code: 'rise2025', name: 'Curation', vault: null, timestamp: Date.now() };

// Curation-only (SOURCE-CURATION-SPEC): the searched Wikimedia families
// are retired, so no reading may cause a request to Commons for one.
test('no searched category is fetched', async ({ page }) => {
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
  await openHomeNav(page, 'chamber');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20000 });

  const RETIRED = ['haeckel','botany','anatomy','astronomy','geometry','fractals','microscopy','sacred','solar','romantic'];
  console.log('COMMONS_REQUESTS ' + JSON.stringify(asked.slice(0, 5)));

  // Nothing in the entry path should reach the searched provider at all.
  expect(asked.filter(u => RETIRED.some(c => u.includes(c)))).toEqual([]);
});
