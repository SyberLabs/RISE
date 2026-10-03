/**
 * Production policy assertions for static Recitation.
 *
 * The retired browser-inference path required model hosts, ONNX WebAssembly,
 * and a speech worker. Their absence is now a security and cost boundary.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');
const voice = readFileSync(
    resolve(process.cwd(), 'src/audio/voice.js'),
    'utf8'
);
const csp = toml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '';
const directive = name =>
    csp.split(';').map(item => item.trim()).find(item => item.startsWith(name)) ?? '';

describe('content security policy', () => {
    it('is present and parses', () => {
        expect(csp).toBeTruthy();
        expect(directive('connect-src')).toContain("'self'");
        expect(directive('default-src')).toContain("'self'");
    });

    it('does not admit retired model or runtime capabilities', () => {
        expect(directive('connect-src')).not.toContain('huggingface.co');
        expect(directive('connect-src')).not.toContain('us.aws.cdn.hf.co');
        expect(directive('script-src')).not.toContain('wasm-unsafe-eval');
        expect(voice).not.toContain('new Worker');
        expect(voice).not.toContain('kokoro-js');
        expect(existsSync(resolve(
            process.cwd(),
            'src/audio/voice-worker.js'
        ))).toBe(false);
        expect(existsSync(resolve(
            process.cwd(),
            'public/ort/ort-wasm-simd-threaded.jsep.wasm'
        ))).toBe(false);
    });

    it('allows same-origin static voice media', () => {
        expect(directive('media-src')).toContain("'self'");
        expect(directive('media-src')).toContain('blob:');
        expect(toml).toContain('for = "/audio/recitation/*"');
    });

    it('still names every content host the archive reads from', () => {
        const connect = directive('connect-src');
        for (const host of [
            'https://www.gutenberg.org',
            'https://collectionapi.metmuseum.org',
            'https://api.artic.edu',
            'https://openaccess-api.clevelandart.org',
            'https://id.rijksmuseum.nl'
        ]) {
            expect(connect, `${host} is no longer allowed`).toContain(host);
        }
    });

    it('lets only the exact OpenRouter origin receive a reader-owned key', () => {
        const hosts = directive('connect-src').split(/\s+/u);
        expect(hosts).toContain('https://openrouter.ai');
        expect(hosts.filter(host => host.includes('openrouter'))).toEqual(['https://openrouter.ai']);
        expect(hosts).not.toContain('https:');
        expect(hosts.some(host => host.includes('*'))).toBe(false);
    });

    it('lets only the exact Google Gemini origin receive a reader-owned key, and no Google host beside it', () => {
        const hosts = directive('connect-src').split(/\s+/u);
        expect(hosts).toContain('https://generativelanguage.googleapis.com');
        expect(hosts.filter(host => /google/u.test(host))).toEqual(['https://generativelanguage.googleapis.com']);
        expect(hosts).not.toContain('https:');
        expect(hosts.some(host => host.includes('*'))).toBe(false);
    });

    it('keeps scripts self-hosted, with no executable CDN', () => {
        const script = directive('script-src');
        expect(script).toBe("script-src 'self'");
        expect(directive('object-src')).toBe("object-src 'none'");
        expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    });

    it("meets script-src 'self' on every page it serves: no inline script", () => {
        const pages = [
            'index.html', 'wormhole.html', 'enterprise.html', 'kev-check.html',
            ...readdirSync(resolve(process.cwd(), 'public'))
                .filter(name => name.endsWith('.html'))
                .map(name => `public/${name}`)
        ];
        for (const page of pages) {
            const html = readFileSync(resolve(process.cwd(), page), 'utf8');
            const inline = [...html.matchAll(/<script\b([^>]*)>/giu)]
                .filter(([, attributes]) => !/\ssrc=/iu.test(attributes))
                .map(([tag]) => tag);
            expect(inline, `${page} carries an inline script the policy refuses`).toEqual([]);
        }
    });
});
