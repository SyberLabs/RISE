import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Shelves', vault: null, timestamp: Date.now() };

// Standing at the Received shelf, a reader should see forms in reading order.
test('Received and Composed stay separate; Received forms are ordered', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-filter="received"]')).toBeVisible({ timeout: 15000 });

  const filters = await page.locator('.section-filters .filter-btn')
    .evaluateAll(buttons => buttons.map(button => button.dataset.filter));
  expect(filters).toEqual(['received', 'composed']);

  const received = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    names: [...document.querySelectorAll('.archive-division-name')].map(n => n.textContent.trim()),
    cards: document.querySelectorAll('.archive-card').length,
    unplaced: document.querySelectorAll('[data-division="other"]').length
  }));

  await page.locator('[data-filter="composed"]').click();
  const composed = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    cards: document.querySelectorAll('.archive-card').length
  }));

  console.log('RECEIVED ' + JSON.stringify(received));
  console.log('COMPOSED ' + JSON.stringify(composed));

  expect(received.divisions).toEqual(['epic', 'drama', 'lyric', 'wisdom', 'essay', 'novel']);
  expect(received.names).toEqual(['Epic', 'Drama', 'Lyric', 'Wisdom', 'Essay', 'Novel']);
  expect(received.cards).toBe(15);
  expect(received.unplaced).toBe(0);
  expect(composed.cards).toBeGreaterThan(0);
});

/**
 * TOC sheet: enter long works at a division; labels are division names,
 * never prose snippets from the text.
 */
async function openLibrary(page) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-filter="received"]')).toBeVisible({ timeout: 15000 });
}

test('a long work opens at its verified contents', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="middlemarch"]').first().click();

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

  // The generated edition preserves Chapter labels but declares no counting
  // noun; the sheet therefore uses its honest generic rather than inventing.
  expect(r.noun).toBe('entries');
  expect(Number(r.total)).toBe(87);
  expect(r.first[0]).toMatch(/Chapter /);
  // Labels are division names, never prose.
  expect(r.prose).toEqual([]);
});

test('choosing a chapter reads that chapter, not the book', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="middlemarch"]').first().click();
  await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30000 });

  await page.locator('.toc-entry').first().click();
  // The sheet closes and the orbital receives the chapter.
  await expect(page.locator('.toc-sheet')).toBeHidden({ timeout: 10000 });
  // Navigation into the orbital is async; the sheet closing is not the
  // text arriving.
  await page.waitForFunction(
    () => !!window.__RISE_TEST__?.getView('chamber')?.config?.text,
    null, { timeout: 15000 });

  const loaded = await page.evaluate(() => {
    // The chosen text lands on the orbital's config, which is the
    // state Begin actually reads.
    const o = window.__RISE_TEST__?.getView('chamber');
    return o?.config?.text ? {
      source: o.config.textSource,
      words: o.config.text.split(/\s+/).filter(Boolean).length
    } : null;
  });
  console.log('CHAPTER ' + JSON.stringify(loaded));

  expect(loaded).not.toBeNull();
  expect(loaded.source).toContain('Chapter');
  // A chapter, not the whole of Middlemarch.
  expect(loaded.words).toBeGreaterThan(200);
  expect(loaded.words).toBeLessThan(12000);
});

test('the contents can be searched, and closed without choosing', async ({ page }) => {
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="middlemarch"]').first().click();
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
  await expect(page.locator('[data-filter="received"]')).toBeVisible();
});

test('a short work goes straight to the Chamber, with no contents to open', async ({ page }) => {
  // A table of contents with one row is a door with a sign reading "door".
  await openLibrary(page);
  await page.locator('[data-action="select-text"][data-id="oedipus-rex"]').first().click();
  await page.waitForFunction(
    () => !!window.__RISE_TEST__?.getView('chamber')?.config?.text,
    null, { timeout: 20000 });
  expect(await page.locator('.toc-sheet').count()).toBe(0);

  const loaded = await page.evaluate(() => {
    const o = window.__RISE_TEST__?.getView('chamber');
    return o?.config?.textSource || null;
  });
  console.log('WHOLE ' + JSON.stringify(loaded));
  expect(loaded).toBeTruthy();
});
