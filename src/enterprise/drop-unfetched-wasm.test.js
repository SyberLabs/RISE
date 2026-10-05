/**
 * The embed worker hands onnxruntime-web a runtime binary it fetched and
 * verified itself, so the CPU wasm Vite emits for the runtime's own URL is
 * never requested. The build drops that file; the Kev runtime, which
 * kev-worker.js fetches from this origin, stays.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dropUnfetchedWasm, UNFETCHED_WASM } from '../../scripts/drop-unfetched-wasm.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const ORT_DIST = 'node_modules/onnxruntime-web/dist';

const asset = (source) => ({ type: 'asset', source });

describe('the build drops the wasm nothing fetches', () => {
    it('removes the CPU runtime and keeps the Kev runtime and the code', () => {
        const bundle = {
            'assets/ort-wasm-simd-threaded-DcHrbrbl.wasm': asset(readFileSync(join(ROOT, UNFETCHED_WASM))),
            'assets/ort-wasm-simd-threaded.jspi-CZzFqCHi.wasm': asset(readFileSync(join(ROOT, ORT_DIST, 'ort-wasm-simd-threaded.jspi.wasm'))),
            'assets/embed-worker-CVK-xa4T.js': { type: 'chunk', code: 'export {}' },
            'assets/icon-abc123.svg': asset('<svg/>')
        };
        dropUnfetchedWasm().generateBundle({}, bundle);
        expect(Object.keys(bundle).sort()).toEqual([
            'assets/embed-worker-CVK-xa4T.js',
            'assets/icon-abc123.svg',
            'assets/ort-wasm-simd-threaded.jspi-CZzFqCHi.wasm'
        ]);
    });

    it('names the runtime the lockfile ships', () => {
        expect(UNFETCHED_WASM).toBe(`${ORT_DIST}/ort-wasm-simd-threaded.wasm`);
    });

    // Dropping the file is only safe while the worker supplies the binary.
    it('is safe because the embed worker supplies the binary itself', () => {
        const worker = readFileSync(join(import.meta.dirname, 'embed-worker.js'), 'utf8');
        expect(worker).toMatch(/ort\.env\.wasm\.wasmBinary\s*=/u);
        expect(worker).toMatch(/verified\(cache, ORT_WASM_CPU,/u);
    });
});
