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
