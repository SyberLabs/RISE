import { describe, expect, it, vi } from 'vitest';
import { KEV_WORKER_POLICY, isKevWorkerScript } from './kev-worker-script.mjs';
import worker from './index.mjs';

const ORIGIN = 'https://rise.example';

describe('Kev worker script', () => {
    it('is recognised only at its hashed asset path', () => {
        expect(isKevWorkerScript('/assets/kev-worker-B1YReAsQ.js')).toBe(true);
        expect(isKevWorkerScript('/assets/embed-worker-B1YReAsQ.js')).toBe(true);
        for (const path of ['/assets/kev-worker-x.js/../index.js', '/assets/kev-check-1.js', '/enterprise', '/assets/kev-worker-.css']) {
            expect(isKevWorkerScript(path)).toBe(false);
        }
    });

    it('replaces the site policy with its own and keeps the asset intact', async () => {
        const site = "default-src 'self'; script-src 'self'";
        const env = { ASSETS: { fetch: vi.fn(async () => new Response('self.onmessage=()=>{}', {
            status: 200, headers: { 'Content-Security-Policy': site, 'Content-Type': 'text/javascript', 'Cache-Control': 'immutable' }
        })) } };
        const response = await worker.fetch(new Request(`${ORIGIN}/assets/kev-worker-B1YReAsQ.js`), env);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Security-Policy')).toBe(KEV_WORKER_POLICY);
        expect(response.headers.get('Cache-Control')).toBe('immutable');
        expect(await response.text()).toBe('self.onmessage=()=>{}');
        const embed = await worker.fetch(new Request(`${ORIGIN}/assets/embed-worker-B1YReAsQ.js`), env);
        expect(embed.headers.get('Content-Security-Policy')).toBe(KEV_WORKER_POLICY);
        expect(KEV_WORKER_POLICY).toContain("default-src 'none'");
        expect(KEV_WORKER_POLICY).not.toContain("'unsafe-eval'");
        expect(KEV_WORKER_POLICY).not.toMatch(/script-src[^;]*https:/u);
    });
});
