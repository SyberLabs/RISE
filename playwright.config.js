import { defineConfig } from '@playwright/test';

/**
 * E2E smoke harness — browser-level contract tests for the flows unit
 * tests cannot see (real audio graph, real routing, real persistence).
 * Runs against the production build via vite preview, because what
 * ships is what gets tested.
 *
 *   npm run test:e2e         everything, in two projects, each spec once
 *   npm run test:e2e:gate    the corridor: a fast loop before pushing, and a
 *                            required step of every pull request's CI
 */

/**
 * THE CORRIDOR, AND WHY THESE SPECS.
 *
 * A 45-minute required check is a gate people learn to route around, and
 * this one had already proved it: CI run #99 died at 29m 25s against a
 * 30-minute cap with no assertion, and the answer was to raise the cap.
 * Raising a cap does not make a slow gate safe, it makes it slower.
 *
 * Measured when the corridor was chosen (August 2026), one worker,
 * production build: 502 seconds of test time across the 18 spec files of
 * the day, of which `mobile.spec.js` alone was 200. The suite has grown
 * since.
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
 *   journeys          Home and the Vault offer no Journeys door
 *   curation          what the shelf is allowed to show
 *   url-routing       every room has an address; reload and Back keep it
 *
 * Full coverage runs in sixteen shards on main without holding the release.
 * This corridor is the local fast check before pushing and runs in every
 * pull request's required CI job. The two
 * projects partition the suite, so `playwright test` with no argument —
 * which is what each shard invokes — runs everything exactly once.
 */
/** Runs without the autoplay override; see the `admission` project. */
const ADMISSION = '**/audio-admission.spec.js';

const GATE = [
    '**/arena-replay.spec.js',
    '**/curation.spec.js',
    '**/journeys.spec.js',
    '**/keystones.spec.js',
    '**/library-divisions.spec.js',
    '**/page-mode.spec.js',
    '**/portal-hit-test.spec.js',
    '**/recitation.spec.js',
    '**/request-preview.spec.js',
    '**/scriptorium.spec.js',
    '**/smoke.spec.js',
    '**/url-routing.spec.js'
];
const e2ePort = Number(process.env.RISE_E2E_PORT) || 4317;

export default defineConfig({
    testDir: './e2e',
    globalSetup: './scripts/playwright-global-setup.mjs',
    timeout: 45_000,
    retries: 1,
    workers: 1, // one browser, sequential — flows share an audio device
    reporter: [['list'], ['github']],
    use: {
        baseURL: `http://localhost:${e2ePort}`,
        headless: true,
        viewport: { width: 1280, height: 800 },
        // Web Audio must start without a physical click's blessing
        launchOptions: {
            args: [
                '--autoplay-policy=no-user-gesture-required',
                // The self-contained card (e2e/live-mcp.spec.js) is an opaque-origin frame loading RISE
                // from the loopback preview. Chrome's Local Network Access treats that as a public page
                // reaching the local network and denies it without a prompt, which a sandboxed frame
                // cannot show. Production is public to public, so the policy never applies there.
                '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults'
            ]
        }
    },
    // Two projects that partition the suite rather than overlapping it, so
    // `playwright test` with no argument is still exactly one run of
    // everything — the split costs the full run nothing.
    projects: [
        { name: 'gate', testMatch: GATE },
        { name: 'full', testIgnore: [...GATE, ADMISSION] },
        // THE ONE PROJECT THAT PLAYS BY THE BROWSER'S RULES. Every other
        // spec runs with autoplay forced on, because a hundred tests
        // about text and layout should not each stage a click to get a
        // clock. The cost is that the suite removed the exact rule
        // production enforces, so a reading could open into a suspended
        // context, say nothing, and stay green for months. This project
        // drops the flag and asserts the invariant instead: a reading
        // may not begin until the context is running, and a gesture is
        // what makes it run.
        {
            name: 'admission',
            testMatch: ADMISSION,
            use: { launchOptions: { args: [] } }
        }
    ]
    // globalSetup owns the production build and preview server transactionally.
});
