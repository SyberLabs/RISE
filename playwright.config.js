import { defineConfig } from '@playwright/test';

/**
 * E2E smoke harness — browser-level contract tests for the flows unit
 * tests cannot see (real audio graph, real routing, real persistence).
 * Runs against the production build via vite preview, because what
 * ships is what gets tested.
 *
 *   npm run test:e2e
 */
export default defineConfig({
    testDir: './e2e',
    timeout: 45_000,
    retries: 1,
    workers: 1, // one browser, sequential — flows share an audio device
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:4317',
        headless: true,
        viewport: { width: 1280, height: 800 },
        // Web Audio must start without a physical click's blessing
        launchOptions: {
            args: ['--autoplay-policy=no-user-gesture-required']
        }
    },
    webServer: {
        command: 'npm run build && npx vite preview --port 4317 --strictPort',
        url: 'http://localhost:4317',
        reuseExistingServer: true,
        timeout: 120_000
    }
});
