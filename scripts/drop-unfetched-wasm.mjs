/**
 * onnxruntime-web's `/wasm` bundle names its CPU runtime with
 * `new URL('ort-wasm-simd-threaded.wasm', import.meta.url)`, so Vite emits a
 * 13.6 MiB copy into dist/ for the embed worker. The worker never asks for it:
 * it fetches the pinned copy itself, checks the digest and hands the bytes to
 * `ort.env.wasm.wasmBinary` (src/enterprise/embed-worker.js), and the runtime
 * only fetches when it is given no binary. This drops the copy nothing loads.
 *
 * The asset is matched by its bytes: Vite's worker build re-emits assets
 * without their source names. The Kev runtime
 * (`ort-wasm-simd-threaded.jspi.wasm`) is a different file: kev-worker.js
 * fetches it from this origin, so it stays.
 */

import { readFileSync } from 'node:fs';

export const UNFETCHED_WASM = 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm';

export function dropUnfetchedWasm() {
  return {
    name: 'drop-unfetched-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      const unfetched = readFileSync(UNFETCHED_WASM);
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && typeof output.source !== 'string' && unfetched.equals(output.source)) delete bundle[fileName];
      }
    }
  };
}
