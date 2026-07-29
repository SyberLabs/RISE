/**
 * Production policy assertions for static Recitation.
 *
 * The retired browser-inference path required model hosts, ONNX WebAssembly,
 * and a speech worker. Their absence is now a security and cost boundary.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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

    it('keeps scripts self-hosted, with no executable CDN', () => {
        const script = directive('script-src');
        expect(script).toBe("script-src 'self'");
        expect(directive('object-src')).toBe("object-src 'none'");
        expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    });
});
