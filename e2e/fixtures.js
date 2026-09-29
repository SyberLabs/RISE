export { expect, test } from '@playwright/test';

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

/** Ask Home for a reading in words, then enter what Jev chose. */
export async function askHome(page, intent) {
  await openHomeAsk(page);
  await page.locator('#oracle-intent').fill(intent);
  await page.locator('[data-oracle="ask"]').click();
  // Nothing plays on arrival; the reading starts only from Enter.
  await page.locator('[data-oracle="enter"]').click();
}
