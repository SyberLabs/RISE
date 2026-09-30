import { expect } from '@playwright/test';
export { expect, test } from '@playwright/test';
import { answerDecisions, connectOpenRouter } from './reader-connection.js';

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

/** Open Home's ask. Asking is the escape hatch: a first roll reveals it. */
export async function openHomeAsk(page) {
  await page.locator('[data-oracle="roll"]').click();
  await page.locator('[data-oracle="ask-open"]').click();
  await page.locator('#oracle-intent').waitFor();
}

/** Add a fake reader-owned OpenRouter key in this browser context. */
export async function connectTestOpenRouter(page) {
  await connectOpenRouter(page);
  await expect(page.locator('#portal-ai')).toContainText('billed to your OpenRouter account', { timeout: 15_000 });
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
  await page.locator('#oracle-intent').fill(intent);
  await page.locator('[data-oracle="ask"]').click();
  // Nothing plays on arrival; the reading starts only from Enter.
  await page.locator('[data-oracle="enter"]').click();
}

/** Turn an admitted decision fixture into the provider's choices-only reply. */
