import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Shelves', vault: null, timestamp: Date.now() };

// Standing at one shelf, a reader should see its canon in reading
// order: classical, then literary, then esoteric.
test('a shelf shows its divisions in order; All stays flat', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-filter="western"]')).toBeVisible({ timeout: 15000 });

  // "All" is a flat grid — divisions across four canons would say nothing.
  const flat = await page.evaluate(() =>
    document.querySelectorAll('[data-division]').length);

  // Two axes: where a work is from, and what it is about.
  const axes = await page.evaluate(() =>
    [...document.querySelectorAll('.archive-axis')].map(a => ({
      label: a.querySelector('.archive-axis-label').textContent.trim(),
      buttons: [...a.querySelectorAll('.filter-btn')].map(b => b.dataset.filter)
    })));
  console.log('AXES ' + JSON.stringify(axes));
  expect(axes.map(a => a.label)).toEqual(['By tradition', 'By subject']);
  expect(axes[0].buttons).toEqual(['all', 'western', 'eastern', 'indigenous']);
  // Form & Design cuts across the traditions rather than sitting beside
  // them; every shelf must appear in exactly one row.
  expect(axes[1].buttons).toContain('form');
  const seen = axes.flatMap(a => a.buttons);
  expect(new Set(seen).size).toBe(seen.length);

  await page.locator('[data-filter="western"]').click();
  const western = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    names: [...document.querySelectorAll('.archive-division-name')].map(n => n.textContent.trim()),
    cards: document.querySelectorAll('.archive-card').length,
    unplaced: document.querySelectorAll('[data-division="other"]').length
  }));

  await page.locator('[data-filter="indigenous"]').click();
  const indigenous = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    cards: document.querySelectorAll('.archive-card').length
  }));

  console.log('ALL flat divisions: ' + flat);
  console.log('WESTERN ' + JSON.stringify(western));
  console.log('INDIGENOUS ' + JSON.stringify(indigenous));

  expect(flat).toBe(0);
  // The Library's expansion added 'imaginative' between the
  // discursive and the esoteric — poetry and story are neither
  // argument nor mystery, and had been filed as whichever fit worse.
  expect(western.divisions).toEqual(['classical', 'literary', 'imaginative', 'esoteric']);
  // A COUNT IS NOT THE INVARIANT. This asserted 14 cards and broke the
  // moment the Library grew to 110 texts — punishing acquisition, which
  // is the thing the shelf exists to permit. What must hold is that the
  // shelf is populated and every work on it is filed.
  expect(western.cards).toBeGreaterThan(10);
  // Nothing unplaced: every work is filed within its canon.
  expect(western.unplaced).toBe(0);
  // A shelf of one division renders flat rather than labelling the obvious.
  expect(indigenous.divisions).toEqual([]);
  expect(indigenous.cards).toBeGreaterThan(0);
});

/**
 * The table of contents.
 *
 * A long work is entered at a division, not at its first word. Before
 * this, choosing War and Peace handed the Chamber 560,000 words in one
 * reading, and choosing the Mahabharata handed it 2.9 million.
 *
 * The assertions that matter are the negative ones. The generated
 * sections this is derived from carry prose where their names should
 * be — 27% of the corpus — so what is being guarded is that no reader
 * is ever offered "part. Anna Pávlovna Schérer on the contrary,
 * despite her forty years," as the name of a chapter.
 */
async function openLibrary(page) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-filter="western"]')).toBeVisible({ timeout: 15000 });
}

test('a long work opens at its contents, in its own division noun', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="war-and-peace"]').first().click();

  const sheet = page.locator('.toc-sheet');
  await expect(sheet).toBeVisible({ timeout: 30000 });

  const r = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.toc-entry-label')].map(e => e.textContent.trim());
    return {
      count: labels.length,
      noun: document.querySelector('.toc-weight-noun')?.textContent.trim(),
      total: document.querySelector('.toc-weight-count')?.textContent.trim(),
      first: labels.slice(0, 4),
      // Every label must be a division, never a sentence of Tolstoy.
      prose: labels.filter(l => l.length > 40 || /[,;]$/.test(l))
    };
  });
  console.log('TOC ' + JSON.stringify(r).slice(0, 400));

  expect(r.noun).toBe('chapters');
  expect(Number(r.total)).toBeGreaterThan(300);
  expect(r.first[0]).toMatch(/^Chapter /);
  // THE CENTRAL GUARANTEE.
  expect(r.prose).toEqual([]);
});

test('choosing a chapter reads that chapter, not the book', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="war-and-peace"]').first().click();
  await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30000 });

  await page.locator('.toc-entry').first().click();
  // The sheet closes and the orbital receives the chapter.
  await expect(page.locator('.toc-sheet')).toBeHidden({ timeout: 10000 });
  // Navigation into the orbital is async; the sheet closing is not the
  // text arriving.
  await page.waitForFunction(
    () => !!window.rise?.router?.views?.get('chamber')?.instance?.config?.text,
    null, { timeout: 15000 });

  const loaded = await page.evaluate(() => {
    // The chosen text lands on the orbital's config, which is the
    // state Begin actually reads.
    const o = window.rise?.router?.views?.get('chamber')?.instance;
    return o?.config?.text ? {
      source: o.config.textSource,
      words: o.config.text.split(/\s+/).filter(Boolean).length
    } : null;
  });
  console.log('CHAPTER ' + JSON.stringify(loaded));

  expect(loaded).not.toBeNull();
  expect(loaded.source).toContain('Chapter');
  // A chapter, not the whole of it. War and Peace is 560,000 words.
  expect(loaded.words).toBeGreaterThan(200);
  expect(loaded.words).toBeLessThan(12000);
});

test('the contents can be searched, and closed without choosing', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="war-and-peace"]').first().click();
  await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30000 });

  const all = await page.locator('.toc-entry').count();
  await page.locator('.toc-search-input').fill('Chapter XV');
  await page.waitForTimeout(300);
  const filtered = await page.locator('.toc-entry').count();
  console.log('SEARCH all=' + all + ' filtered=' + filtered);
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(all);

  await page.keyboard.press('Escape');
  await expect(page.locator('.toc-sheet')).toBeHidden({ timeout: 10000 });
  // Escaping is not choosing: the reader is still at the shelf.
  await expect(page.locator('[data-filter="western"]')).toBeVisible();
});

test('a short work goes straight to the Chamber, with no contents to open', async ({ page }) => {
  // A table of contents with one row is a door with a sign reading
  // "door". Kabir's Songs is 11,515 words and is read whole.
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="kabir-songs"]').first().click();
  await page.waitForFunction(
    () => !!window.rise?.router?.views?.get('chamber')?.instance?.config?.text,
    null, { timeout: 20000 });
  expect(await page.locator('.toc-sheet').count()).toBe(0);

  const loaded = await page.evaluate(() => {
    const o = window.rise?.router?.views?.get('chamber')?.instance;
    return o?.config?.textSource || null;
  });
  console.log('WHOLE ' + JSON.stringify(loaded));
  expect(loaded).toBeTruthy();
});
