import { defineConfig } from '@playwright/test';

/**
 * E2E smoke harness — browser-level contract tests for the flows unit
 * tests cannot see (real audio graph, real routing, real persistence).
 * Runs against the production build via vite preview, because what
 * ships is what gets tested.
 *
 *   npm run test:e2e         everything, in two projects, each spec once
 *   npm run test:e2e:gate    the corridor, for a fast loop before pushing
 */

/**
 * THE CORRIDOR, AND WHY THESE SPECS.
 *
 * A 45-minute required check is a gate people learn to route around, and
 * this one had already proved it: CI run #99 died at 29m 25s against a
 * 30-minute cap with no assertion, and the answer was to raise the cap.
 * Raising a cap does not make a slow gate safe, it makes it slower.
 *
 * Measured on this suite, one worker, production build: 502 seconds of
 * test time across 18 spec files, of which `mobile.spec.js` alone is 200.
 * The list below is 134 seconds of that — the corridor a reader actually
 * walks, plus the two things that must never silently break.
 *
 *   smoke             the portal, a reading, audio resuming, and the
 *                     photosensitivity warning appearing and being obeyed
 *   keystones         the only public URLs RISE has
 *   library-divisions the Archive shelf into a reading, which is now also
 *                     the fetch-and-verify path for every work
 *   page-mode         the spatial projection of the same session
 *   recitation        the voice, which is the other thing with a device
 *   portal-hit-test   the first screen being clickable at all
 *   scriptorium       the refusal panel, whose whole job is phrasing
 *   journeys          an authored program launching
 *   csp-live          the policy that governs every remote fetch
 *   curation          what the shelf is allowed to show
 *
 * CI no longer stops here. The 502 seconds shard four ways to 199, so a
 * pull request runs all of it and this list is what you run locally when
 * you want an answer in two minutes rather than eight. The two projects
 * partition the suite, so `playwright test` with no argument — which is
 * what each CI shard invokes — is still exactly one run of everything.
 */
const GATE = [
    '**/csp-live.spec.js',
    '**/curation.spec.js',
    '**/journeys.spec.js',
    '**/keystones.spec.js',
    '**/library-divisions.spec.js',
    '**/page-mode.spec.js',
    '**/portal-hit-test.spec.js',
    '**/recitation.spec.js',
    '**/scriptorium.spec.js',
    '**/smoke.spec.js'
];

export default defineConfig({
    testDir: './e2e',
    globalSetup: './scripts/playwright-global-setup.mjs',
    timeout: 45_000,
    retries: 1,
    workers: 1, // one browser, sequential — flows share an audio device
    reporter: [['list'], ['github']],
    use: {
        baseURL: 'http://localhost:4317',
        headless: true,
        viewport: { width: 1280, height: 800 },
        // Web Audio must start without a physical click's blessing
        launchOptions: {
            args: ['--autoplay-policy=no-user-gesture-required']
        }
    },
    // Two projects that partition the suite rather than overlapping it, so
    // `playwright test` with no argument is still exactly one run of
    // everything — the split costs the full run nothing.
    projects: [
        { name: 'gate', testMatch: GATE },
        { name: 'full', testIgnore: GATE }
    ]
    // globalSetup owns the production build and preview server transactionally.
});
