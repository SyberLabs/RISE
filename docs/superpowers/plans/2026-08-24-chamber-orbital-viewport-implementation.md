# Chamber Orbital Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete pre-session Chamber composition reachable on short desktop viewports while preserving the spacious tall-screen layout, current mobile topology, and fixed playback.

**Architecture:** `.chamber-orbital` becomes the sole pre-session scroll owner. Local CSS variables express normal and approximately 80% short-desktop geometry; the global shell and playback remain unchanged.

**Tech Stack:** Vanilla JavaScript, CSS, Vitest/jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-chamber-text-materials-fit-readiness-design.md`, sections 9, 11, and 12.4.

## Global Constraints

- Do not change `body` overflow, `.chamber-display`, playback positioning, or mobile orbital topology.
- Use `100dvh`, explicit geometry, and local overflow; never use CSS `zoom` or `transform: scale()`.
- Begin and Reset remain reachable by mouse, touch, and keyboard.
- Button hit targets and text retain their current accessible minimums.

## File Structure

- `src/components/ChamberOrbital.css` — local scroll ownership and normal/short-desktop geometry tokens.
- `src/components/ChamberOrbital.layout.test.js` — static guard against global overflow and scaling regressions.
- `e2e/chamber-orbital-viewport.spec.js` — real reachability and fixed-playback matrix.

---

### Task 1: Establish local scroll ownership and geometry tokens

**Files:**

- Modify: `src/components/ChamberOrbital.css`
- Create: `src/components/ChamberOrbital.layout.test.js`

**Interfaces:**

- Consumes: `.chamber-orbital`, `.orbital-stage`, `.orbital-node`, `.orbital-center`, and `.orbital-actions`.
- Produces: `--orbital-stage-size`, `--orbital-node-size`, `--orbital-radius`, `--orbital-center-size`, plus local 100dvh vertical scroll ownership.

- [ ] **Step 1: Write the failing structural test**

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./ChamberOrbital.css', import.meta.url), 'utf8');

describe('Chamber Orbital viewport ownership', () => {
  it('owns pre-session scrolling without scaling the application shell', () => {
    expect(css).toMatch(/\.chamber-orbital\s*\{[^}]*min-height:\s*100dvh/s);
    expect(css).toMatch(/\.chamber-orbital\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.chamber-orbital\s*\{[^}]*overscroll-behavior-y:\s*contain/s);
    expect(css).not.toMatch(/\bzoom\s*:/);
    expect(css).not.toMatch(/transform:\s*scale\(/);
    expect(css).not.toMatch(/body\s*\{[^}]*overflow/s);
    expect(css).not.toMatch(/\.chamber-display\s*\{[^}]*overflow-y:\s*auto/s);
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npx vitest run src/components/ChamberOrbital.layout.test.js`

Expected: FAIL because `.chamber-orbital` does not own vertical scrolling.

- [ ] **Step 3: Implement the local geometry contract**

```css
.chamber-orbital {
  --orbital-stage-size: 600px;
  --orbital-node-size: 140px;
  --orbital-radius: 220px;
  --orbital-center-size: 260px;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  justify-content: safe center;
  scrollbar-gutter: stable;
}

.orbital-stage {
  width: var(--orbital-stage-size);
  height: var(--orbital-stage-size);
}
```

Replace the existing desktop node, radius, and center literals with their variables. Leave mobile overrides and `.chamber-display` untouched.

- [ ] **Step 4: Run the test to verify success**

Run: `npx vitest run src/components/ChamberOrbital.layout.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChamberOrbital.css src/components/ChamberOrbital.layout.test.js
git commit -m "fix: make chamber setup locally scrollable"
```

### Task 2: Compact short desktops and prove every supported viewport

**Files:**

- Modify: `src/components/ChamberOrbital.css`
- Modify: `src/components/ChamberOrbital.layout.test.js`
- Create: `e2e/chamber-orbital-viewport.spec.js`

**Interfaces:**

- Consumes: Task 1 geometry variables and production storage keys `rise-beta-session`, `rise_orbital_text_v1`, `rise_orbital_prefs_v1`.
- Produces: `@media (min-width: 769px) and (max-height: 820px)` compact geometry and browser coverage at 1366×768, 1280×720, 1440×900, 1024×600, and 390×844.

- [ ] **Step 1: Write failing compact-profile and browser tests**

Append this unit test:

```js
it('defines an explicit short-desktop profile', () => {
  expect(css).toMatch(/@media\s*\(min-width:\s*769px\)\s*and\s*\(max-height:\s*820px\)/);
  expect(css).toMatch(/--orbital-stage-size:\s*480px/);
  expect(css).toMatch(/--orbital-node-size:\s*112px/);
  expect(css).toMatch(/--orbital-radius:\s*176px/);
  expect(css).toMatch(/--orbital-center-size:\s*208px/);
});
```

Create the browser file with this exact seed and matrix:

```js
import { test, expect } from '@playwright/test';

const GATE_SESSION = { code: 'rise2025', name: 'Viewport Harness', vault: null, timestamp: Date.now() };
const SEED_TEXT = {
  text: 'First atom. Second atom. Third atom.',
  textSource: 'Viewport Seed',
  origin: null
};
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1024, height: 600 },
  { width: 390, height: 844 }
];

async function openSeededChamber(page) {
  await page.addInitScript(({ gate, text }) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(text));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ wpm: 180, audioPreset: 'silent' }));
  }, { gate: GATE_SESSION, text: SEED_TEXT });
  await page.goto('/');
  await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 10_000 });
}

for (const viewport of VIEWPORTS) {
  test(`Chamber controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSeededChamber(page);
    const begin = page.locator('#begin-btn');
    const reset = page.locator('[data-action="reset-prefs"]');
    await begin.scrollIntoViewIfNeeded();
    await expect(begin).toBeVisible();
    await reset.scrollIntoViewIfNeeded();
    await expect(reset).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await begin.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('#chamber-display').evaluate(node => getComputedStyle(node).position)).toBe('fixed');
  });
}
```

- [ ] **Step 2: Run both tests to verify failure**

```bash
npx vitest run src/components/ChamberOrbital.layout.test.js
npx playwright test e2e/chamber-orbital-viewport.spec.js
```

Expected: the compact-profile unit test and at least the 1024×600 reachability case FAIL.

- [ ] **Step 3: Implement the short-desktop profile**

```css
@media (min-width: 769px) and (max-height: 820px) {
  .chamber-orbital {
    --orbital-stage-size: 480px;
    --orbital-node-size: 112px;
    --orbital-radius: 176px;
    --orbital-center-size: 208px;
    justify-content: flex-start;
    padding-block: clamp(16px, 3dvh, 28px);
  }

  .orbital-actions {
    margin-top: clamp(12px, 2dvh, 22px);
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }
}
```

Tune only dependent connector/gap declarations that still use old desktop literals. Preserve current button min-heights and label font sizes.

- [ ] **Step 4: Run focused and release-relevant checks**

```bash
npx vitest run src/components/ChamberOrbital.layout.test.js
npx playwright test e2e/chamber-orbital-viewport.spec.js
npm run test:e2e:gate
npm run build
npm run measure:first-load
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChamberOrbital.css src/components/ChamberOrbital.layout.test.js e2e/chamber-orbital-viewport.spec.js
git commit -m "feat: adapt chamber setup to short viewports"
```

## Completion criteria

- Chamber setup owns local 100dvh scrolling; playback remains fixed.
- Begin and Reset are reachable at all five viewport sizes without horizontal overflow.
- Short-desktop geometry is explicit and approximately 80% of normal geometry.
- No global overflow, zoom, transformed shell, mobile topology, or hit-target regression is introduced.
- Focused unit, browser, browser gate, build, and first-load budget checks pass.
