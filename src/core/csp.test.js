/**
 * The Content Security Policy is an allowlist, and an allowlist that
 * drifts from what the app actually fetches fails in production and
 * nowhere else — every test here passes, every build succeeds, and the
 * feature is simply dead for real readers.
 *
 * That is what happened to the Kokoro voice: the policy named ten
 * content hosts and not the two the model is served from, so speech
 * failed on the deployed site while working in every local check.
 *
 * These tests read the shipped header and assert that each host a
 * subsystem depends on is named. They are deliberately specific: a
 * generic "csp exists" test would have caught nothing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');
const voiceWorker = readFileSync(
    resolve(process.cwd(), 'src/audio/voice-worker.js'),
    'utf8'
);
const csp = toml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '';
const directive = (name) =>
    csp.split(';').map(d => d.trim()).find(d => d.startsWith(name)) ?? '';

describe('content security policy', () => {
    it('is present and parses', () => {
        expect(csp).toBeTruthy();
        expect(directive('connect-src')).toContain("'self'");
        expect(directive('default-src')).toContain("'self'");
    });

    it('names both hosts the voice model is served from', () => {
        // huggingface.co serves config.json and tokenizer.json, then
        // REDIRECTS the weights and voice data to us.aws.cdn.hf.co.
        // Allowing only the first fixes the config fetch and then fails
        // on the model — a partial fix that looks like a whole one.
        const connect = directive('connect-src');
        expect(connect).toContain('https://huggingface.co');
        expect(connect).toContain('https://us.aws.cdn.hf.co');
    });

    it('allows the worker and the blob URLs speech plays through', () => {
        // The voice runs in a worker and its audio reaches an <audio>
        // element as a blob: URL. Either restriction would break speech
        // in a way no local test surfaces.
        expect(directive('worker-src')).toContain('blob:');
        expect(directive('media-src')).toContain('blob:');
    });

    it('still names every content host the archive reads from', () => {
        // A regression guard on the ORIGINAL allowlist: adding hosts for
        // one feature must not quietly drop another's.
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

    it('keeps scripts self-hosted, and admits no CDN', () => {
        // The strongest line in the policy, and the one most tempting to
        // weaken: transformers.js fetches its ONNX runtime from
        // cdn.jsdelivr.net unless told otherwise. Allowing that would
        // let a third party execute code in the app so a voice could
        // speak — a bad trade. The worker imports the packaged runtime
        // through Vite asset URLs and sets both wasmPaths entries BEFORE
        // the first model load.
        const script = directive('script-src');
        expect(script).toContain("'self'");
        expect(script).not.toContain('jsdelivr');
        expect(script).not.toContain('unpkg');
        expect(script).not.toContain("'unsafe-inline'");
        expect(script).not.toContain("'unsafe-eval'");
        // WebAssembly must still COMPILE. This permits that and nothing
        // more — notably not eval() and not inline script.
        expect(script).toContain("'wasm-unsafe-eval'");
        expect(directive('object-src')).toBe("object-src 'none'");
        expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    });

    it('routes both ONNX runtime files through Vite assets, not public imports', () => {
        expect(voiceWorker).toContain(
            '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs'
        );
        expect(voiceWorker).toContain(
            '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'
        );
        expect(voiceWorker).toContain('mjs: ortWasmModuleUrl');
        expect(voiceWorker).toContain('wasm: ortWasmBinaryUrl');
        expect(voiceWorker).not.toContain("wasmPaths = '/ort/'");
    });

    it('retains the deploy-safe public ONNX runtime mirror', () => {
        // The worker now uses Vite-managed package assets in every mode.
        // Keep the public mirror checked as a deployment fallback until
        // an explicit asset-manifest assertion replaces it.
        for (const file of [
            'public/ort/ort-wasm-simd-threaded.jsep.mjs',
            'public/ort/ort-wasm-simd-threaded.jsep.wasm'
        ]) {
            expect(existsSync(resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
        }
    });
});
