import { expect, test as base } from '@playwright/test';
export { expect } from '@playwright/test';

// Local app conformance runs with a signed-out account, without contacting the
// production account service. Dedicated account specs install their own later
// route and exercise the complete producer protocol. Requests remain observable,
// so this cannot mask the study's assertion that no account lookup occurs.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https:\/\/syberlabs\.io\/admin\/api\/v1\/(?:account|saves(?:\/[^/?]+)?)(?:\?.*)?$/u, async route => {
      const origin = route.request().headers().origin;
      const headers = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' } : {};
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type,X-SyberLabs-Expected-User', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } });
      }
      await route.fulfill({ status: 401, headers, json: { version: 1, error: 'signin_required' } });
    });
    await use(page);
  }
});
import { answerDecisions, connectOpenRouter, openAskDialog } from './reader-connection.js';

/**
 * Show the reading's controls before pressing one. They fade 3 s after the last
 * mousemove over the reading and take no pointer while faded, and a move to
 * where the pointer already is sends none; under a busy software renderer a
 * move can also be handled late. So it moves until the bar is shown.
 */
export async function revealChamberControls(page) {
  const controls = page.locator('#chamber-controls');
  await expect.poll(async () => {
    await page.mouse.move(640, 360);
    await page.mouse.move(640, 700);
    return controls.getAttribute('style');
  }, { timeout: 15_000 }).toContain('opacity: 1');
}

/**
 * Where each room sits now: the Menu names the five rooms, and every other
 * room is a tab or program inside one of them (route-url.js ROUTE_PANES).
 */
const ROOM_PATHS = {
  chamber: ['read'],
  workshop: ['make', '.make-nav [data-tab="workshop"]'],
  vault: ['make', '.make-nav [data-tab="vault"]'],
  scriptorium: ['make', '.make-nav [data-tab="scriptorium"]'],
  'visual-lab': ['make', '.make-nav [data-tab="visual-lab"]'],
  chapel: ['library', '.library-programs [data-open-pane="chapel"]'],
  curia: ['library', '.library-programs [data-open-pane="provenance"]']
};

/**
 * Open a room the way a reader does: its Menu entry, then the tab or program
 * inside the room when it is not one of the five. The Menu is a sheet behind
 * the Menu button, so a reader opens it first.
 */
export async function openHomeNav(page, destination) {
  const [entry, inside] = ROOM_PATHS[destination] || [destination];
  const link = page.locator(`.portal-nav [data-nav="${entry}"]`);
  await link.waitFor({ state: 'attached' });
  const toggle = page.locator('.portal-menu-toggle');
  if (!(await link.isVisible()) && await toggle.isVisible()) await toggle.click();
  await link.click();
  if (inside) await page.locator(inside).first().click();
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
  // Nothing plays with sound on arrival; the asked reading starts only from Begin.
  await expect(page.locator('dialog.home-ask')).toBeHidden({ timeout: 15_000 });
  await page.locator('[data-home="enter"]').click();
}

/** Turn an admitted decision fixture into the provider's choices-only reply. */
