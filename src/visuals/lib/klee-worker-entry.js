/**
 * Klee module worker — density contours and grain tiles off the UI thread.
 * Bundled by Vite via `new Worker(new URL(...), { type: 'module' })`, so it
 * shares the exact implementations in klee-core.js with the engine's sync
 * fallback paths (no drift between worker and non-worker rendering).
 */
import { analyzeDensityGrid, buildTextureBytes } from './klee-core.js';

self.onmessage = ({ data }) => {
    try {
        if (data.task === 'analyze-density') {
            const field = new Float32Array(data.density);
            const result = analyzeDensityGrid(
                field, data.gridResolution, data.width, data.height, data.threshold ?? 3
            );
            self.postMessage({ id: data.id, result });
            return;
        }
        if (data.task === 'build-texture') {
            const pixels = buildTextureBytes(data.seed, data.size, data.intensity);
            self.postMessage(
                { id: data.id, result: { size: data.size, pixels: pixels.buffer } },
                [pixels.buffer]
            );
            return;
        }
        throw new Error(`Unknown Klee worker task: ${data.task}`);
    } catch (error) {
        self.postMessage({ id: data.id, error: error.message });
    }
};
