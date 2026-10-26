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

    it('lets the exact Anthropic, OpenAI, NVIDIA and ElevenLabs API origins receive a reader-owned key, in both mirrored policies', () => {
        // The Live venue asks these from the browser on the reader's typed key (src/live/adapters/anthropic.js,
        // openai-chat.js, nvidia.js; src/live/voices/elevenlabs.js); a host missing here is blocked before fetch reaches it.
        const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8').match(/Content-Security-Policy: ([^\r\n]+)/u)?.[1] ?? '';
        for (const policy of [csp, headers]) {
            const hosts = policy.split(';').map(item => item.trim()).find(item => item.startsWith('connect-src')).split(/\s+/u);
            for (const [origin, family] of [['https://api.anthropic.com', /anthropic/u], ['https://api.openai.com', /openai/u], ['https://integrate.api.nvidia.com', /nvidia/u], ['https://api.elevenlabs.io', /elevenlabs/u]]) {
                expect(hosts.filter(host => family.test(host))).toEqual([origin]);
            }
        }
        expect(headers.trim()).toBe(csp.trim());
    });

    it('admits the Cloudflare Web Analytics beacon and its report endpoint, exactly, in both mirrored policies', () => {
        // Cloudflare injects beacon.min.js on rise.syberlabs.io and it posts to cloudflareinsights.com/cdn-cgi/rum;
        // PRIVACY.md section 7 discloses it. No other Cloudflare Insights host is admitted.
        const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8').match(/Content-Security-Policy: ([^\r\n]+)/u)?.[1] ?? '';
        for (const policy of [csp, headers]) {
            const hosts = name => policy.split(';').map(item => item.trim()).find(item => item.startsWith(name)).split(/\s+/u);
            expect(hosts('script-src').filter(host => /cloudflareinsights/u.test(host))).toEqual(['https://static.cloudflareinsights.com']);
            expect(hosts('connect-src').filter(host => /cloudflareinsights/u.test(host))).toEqual(['https://cloudflareinsights.com']);
        }
    });

    it('keeps scripts self-hosted, with no executable CDN beyond the Cloudflare Web Analytics beacon', () => {
        // blob: is the page's own scene module: a generated scene and RISE's face are loaded by import() of a
        // blob: URL inside the blob: scene worker, which inherits this policy (src/scenes/scene-worker.js). Without
        // it every scene on the site failed in production while the e2e preview, which applies no headers, passed.
        const script = directive('script-src');
        expect(script).toBe("script-src 'self' blob: https://static.cloudflareinsights.com");
        expect(directive('worker-src')).toBe("worker-src 'self' blob:");
        expect(script).not.toMatch(/unsafe-eval|unsafe-inline|\*/u);
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
