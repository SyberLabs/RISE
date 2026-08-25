# Portal Try RISE Seal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give only the circular Try RISE entrance a richer slate-seal depth and texture while preserving Portal hierarchy, accent-profile tracking, navigation, hit testing, reduced motion, and mobile reachability.

**Architecture:** Keep Portal markup and routing intact. Build the seal from token-driven CSS on `.portal-nav .nav-secondary .nav-try` and two non-interactive pseudo-elements; no asset, renderer, dependency, or new component is warranted.

**Tech Stack:** Vanilla JavaScript, CSS, Vitest/jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-chamber-text-materials-fit-readiness-design.md`, sections 10 and 12.4.

## Global Constraints

- Restyle only `.portal-nav .nav-secondary .nav-try`.
- Preserve the button, `data-nav="keystones"`, label, and `/try-rise` route.
- Derive color from `--color-accent-rgb`; never hard-code a profile green.
- Pseudo-elements use `pointer-events: none`.
- Reduced motion removes ornamental movement without removing depth or focus indication.

## File Structure

- `src/components/Portal.css` — token-driven seal material scoped to `.nav-try`.
- `src/components/Portal.test.js` — selector isolation, token, and non-interactive-layer guard.
- `e2e/portal-hit-test.spec.js` — real pointer, keyboard, route, and mobile containment proof.

---

### Task 1: Build and protect the token-driven circular seal

**Files:**

- Modify: `src/components/Portal.css`
- Modify: `src/components/Portal.test.js`
- Modify: `e2e/portal-hit-test.spec.js`

**Interfaces:**

- Consumes: `.portal-nav .nav-secondary .nav-try`, `--color-accent-rgb`, existing `openPortal(page)` and `hitTest(page, selector)` helpers, and `.keystones` route root.
- Produces: non-interactive rim/texture layers, tactile states, and pointer/keyboard/mobile/profile regression coverage for `[data-nav="keystones"]`.

- [x] **Step 1: Write failing component and browser tests**

At the top of `Portal.test.js`:

```js
import { readFileSync } from 'node:fs';
const portalCss = readFileSync(new URL('./Portal.css', import.meta.url), 'utf8');
```

Add:

```js
it('scopes a token-driven layered seal to Try RISE', () => {
  expect(portalCss).toMatch(/\.portal-nav\s+\.nav-secondary\s+\.nav-try\s*\{/);
  expect(portalCss).toMatch(/\.nav-try::before/);
  expect(portalCss).toMatch(/\.nav-try::after/);
  expect(portalCss).toMatch(/pointer-events:\s*none/);
  expect(portalCss).toMatch(/var\(--color-accent-rgb\)/);
  expect(portalCss).toMatch(/radial-gradient/);
  expect(portalCss).toMatch(/inset\s+0/);
  expect(portalCss).toMatch(/\.nav-try:focus-visible/);
  expect(portalCss).not.toMatch(/\.nav-item::before/);
});
```

Keep the existing assertion that exactly one `[data-nav="keystones"]` navigates to `keystones`. Add this browser test using the existing helpers:

```js
test('Try RISE remains a profile-colored reachable seal', async ({ page }) => {
  await openPortal(page);
  await page.waitForTimeout(3000);
  const { reachable, hit } = await hitTest(page, '[data-nav="keystones"]');
  expect(reachable, `Try RISE is covered by ${hit}`).toBe(true);

  const seal = page.locator('[data-nav="keystones"]');
  const material = await seal.evaluate(node => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent-rgb').trim(),
    background: getComputedStyle(node).backgroundImage,
    radius: getComputedStyle(node).borderRadius,
    beforePointerEvents: getComputedStyle(node, '::before').pointerEvents,
    afterPointerEvents: getComputedStyle(node, '::after').pointerEvents
  }));
  expect(material.accent).not.toBe('');
  expect(material.background).toContain('radial-gradient');
  expect(material.radius).toBe('50%');
  expect(material.beforePointerEvents).toBe('none');
  expect(material.afterPointerEvents).toBe('none');

  await seal.focus();
  await expect(seal).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/try-rise$/);
  await expect(page.locator('.keystones')).toBeVisible();
});

test('Try RISE remains wholly reachable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPortal(page);
  await page.waitForTimeout(3000);
  const { reachable, hit } = await hitTest(page, '[data-nav="keystones"]');
  expect(reachable, `Try RISE is covered by ${hit}`).toBe(true);
  const box = await page.locator('[data-nav="keystones"]').boundingBox();
  expect(box).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
});
```

- [x] **Step 2: Run both tests to verify failure**

```bash
npx vitest run src/components/Portal.test.js
npx playwright test e2e/portal-hit-test.spec.js --grep "Try RISE"
```

Expected: the new material assertions FAIL while existing navigation and hit testing remain green.

- [x] **Step 3: Implement the layered seal without changing markup**

Retain the existing size and placement, then replace only `.nav-try` material declarations:

```css
.portal-nav .nav-secondary .nav-try {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(var(--color-accent-rgb), 0.58);
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 24%, rgba(255, 255, 255, 0.16), transparent 27%),
    radial-gradient(circle at 50% 68%, rgba(var(--color-accent-rgb), 0.26), transparent 66%),
    linear-gradient(155deg, rgba(var(--color-accent-rgb), 0.34), rgba(20, 25, 30, 0.96) 72%);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.42),
    0 0 24px rgba(var(--color-accent-rgb), 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -8px 16px rgba(0, 0, 0, 0.28);
}

.portal-nav .nav-secondary .nav-try::before,
.portal-nav .nav-secondary .nav-try::after {
  content: '';
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
}

.portal-nav .nav-secondary .nav-try::before {
  inset: 5px;
  z-index: 0;
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.22);
}

.portal-nav .nav-secondary .nav-try::after {
  inset: 0;
  z-index: 0;
  opacity: 0.26;
  background: repeating-radial-gradient(circle at 38% 32%, transparent 0 3px,
    rgba(255, 255, 255, 0.035) 4px 5px);
  mix-blend-mode: soft-light;
}
```

Keep `.try-mark` and `.try-label` at `position: relative; z-index: 1`. Hover raises by at most one pixel, active removes the translation and deepens the inset, and `:focus-visible` uses the current focus token with an offset ring. In the existing reduced-motion query, set this button's transition and transform to none.

- [x] **Step 4: Run focused and release-relevant checks**

```bash
npx vitest run src/components/Portal.test.js
npx playwright test e2e/portal-hit-test.spec.js
npm run test:e2e:gate
npm run build
npm run measure:first-load
git diff --check
```

Expected: every command exits 0.

- [x] **Step 5: Commit**

```bash
git add src/components/Portal.css src/components/Portal.test.js e2e/portal-hit-test.spec.js
git commit -m "feat: enrich the try rise portal seal"
```

## Completion criteria

- Only Try RISE receives the new seal material.
- Accent profiles drive the seal; no fixed profile color is introduced.
- Rim, bevel, restrained texture, depth, hover, active, focus, and reduced-motion states exist.
- Pseudo-elements cannot intercept input.
- Real pointer hit testing, keyboard navigation, `/try-rise` routing, and mobile containment pass.
- Focused unit, browser, browser gate, build, and first-load budget checks pass.
