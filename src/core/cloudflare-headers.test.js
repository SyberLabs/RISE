import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const output = resolve('public/_headers');
const netlify = readFileSync(resolve('netlify.toml'), 'utf8');

function rule(path, headers) {
    const lines = headers.split(/\r?\n/u);
    const start = lines.indexOf(path);
    expect(start, `missing ${path} rule`).toBeGreaterThanOrEqual(0);
    const values = new Map();
    for (const line of lines.slice(start + 1)) {
        if (!/^\s/u.test(line)) break;
        const [, name, value] = line.match(/^\s+([^:]+):\s*(.*)$/u) || [];
        if (name) values.set(name, value);
    }
    return values;
}

describe('Cloudflare static headers', () => {
    it('copies the Netlify browser security policy onto static responses', () => {
        expect(existsSync(output)).toBe(true);
        const common = rule('/*', readFileSync(output, 'utf8'));
        const names = [
            'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy',
            'Permissions-Policy', 'Content-Security-Policy', 'Strict-Transport-Security'
        ];
        for (const name of names) {
            const escaped = name.replace(/[-]/gu, '\\-');
            const expected = netlify.match(new RegExp(`^\\s*${escaped} = "([^"]+)"`, 'm'))?.[1];
            expect(expected, `missing Netlify ${name}`).toBeTruthy();
            expect(common.get(name), name).toBe(expected);
        }
        expect(common.get('Permissions-Policy'))
            .toBe('camera=(), microphone=(self), geolocation=()');
        for (const line of readFileSync(output, 'utf8').split(/\r?\n/u)) {
            expect(line.length, 'Cloudflare header line limit').toBeLessThan(2000);
        }
    });

    it('leaves /content/arena/* to the Worker, so the app shell is never labelled a run file', () => {
        // worker/index.mjs serveArenaFile sets these headers and 404s the app shell by its text/html type.
        expect(readFileSync(output, 'utf8')).not.toMatch(/^\/content\/arena/mu);
    });

    it('revalidates the app shell and mutable content pointer', () => {
        expect(existsSync(output)).toBe(true);
        const headers = readFileSync(output, 'utf8');
        expect(rule('/index.html', headers).get('Cache-Control'))
            .toBe('public, max-age=0, must-revalidate');
        expect(rule('/content/manifest.json', headers).get('Cache-Control'))
            .toBe('public, max-age=0, must-revalidate');
    });

    it('keeps content-addressed assets immutable with the right media types', () => {
        expect(existsSync(output)).toBe(true);
        const headers = readFileSync(output, 'utf8');
        for (const path of ['/assets/*', '/fonts/*.woff2', '/audio/recitation/*', '/content/works/*']) {
            expect(rule(path, headers).get('Cache-Control'), path)
                .toBe('public, max-age=31536000, immutable');
        }
        expect(rule('/content/works/*', headers).get('Content-Type'))
            .toBe('application/json');
        expect(rule('/content/manifest.json', headers).get('Content-Type'))
            .toBe('application/json');
        expect(rule('/site.webmanifest', headers).get('Content-Type'))
            .toBe('application/manifest+json');
    });
});
