import { expect } from '@playwright/test';
export { expect, test } from '@playwright/test';
import { answerDecisions, connectOpenRouter, openAskDialog } from './reader-connection.js';

/**
 * Open a Home header destination (library, vault, workshop). On a phone the
 * header nav sits behind the Menu button, so a reader opens the menu first.
 */
export async function openHomeNav(page, destination) {
  const link = page.locator(`.portal-nav [data-nav="${destination}"]`);
  await link.waitFor({ state: 'attached' });
  const toggle = page.locator('.portal-menu-toggle');
  if (!(await link.isVisible()) && await toggle.isVisible()) await toggle.click();
  await link.click();
}

/**
 * Open one of Home's minor rooms (chapel, scriptorium, curia). Every room
 * sits in the one Menu, so this is the same walk as a header destination.
 */
export async function openHomeRoom(page, destination) {
  await openHomeNav(page, destination);
}

/** Open Home's ask: the Menu's "Ask for a reading". The field needs a connected AI. */
export async function openHomeAsk(page) {
  await openAskDialog(page);
  await page.locator('#home-intent').waitFor();
}

/**
 * Add a fake reader-owned OpenRouter key in this browser context. Connecting
 * happens in the ask dialog, which Home reopens on return; this closes it again.
 */
export async function connectTestOpenRouter(page) {
  await connectOpenRouter(page);
  await expect(page.locator('#portal-ai')).toContainText('billed to your OpenRouter account', { timeout: 15_000 });
  await page.locator('[data-home="ask-cancel"]').click();
  await expect(page.locator('dialog.home-ask')).toBeHidden();
}

/** Route a TypeSafe Decisions request without bypassing the browser contract. */
export async function routeTestOpenRouter(page, decision, onRequest = () => {}) {
  const seen = await answerDecisions(page, decision, { onRequest });
  return () => seen.length;
}

/** Ask Home for a reading in words, then enter what the reader's provider chose. */
export async function askHome(page, intent) {
  await connectTestOpenRouter(page);
  await openHomeAsk(page);
  await page.locator('#home-intent').fill(intent);
  await page.locator('[data-home="ask"]').click();
  // Nothing plays with sound on arrival; the asked reading starts only from Read it with sound.
  await expect(page.locator('dialog.home-ask')).toBeHidden({ timeout: 15_000 });
  await page.locator('[data-home="enter"]').click();
}

/** Turn an admitted decision fixture into the provider's choices-only reply. */
