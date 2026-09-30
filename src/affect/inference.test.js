import { describe, expect, it } from 'vitest';
import { linearCore } from './text/readout.js';
import { FEATURE_NAMES } from './text/features.js';
import { DIMENSIONS } from './dimensions.js';
import { onnxUnavailable, runReadoutSession } from './inference.js';

describe('onnx inference seam', () => {
    it('stays unavailable until a session is supplied', async () => {
        const missing = await runReadoutSession(null, [0, 1], null);
        expect(missing).toEqual(onnxUnavailable('onnx-session-not-configured'));
        expect(missing.fallback).toBe('js-linear-core');
    });

    it('reads a caller-supplied session in dimension order', async () => {
        const features = FEATURE_NAMES.map(() => 0);
        features[0] = 0.5;
        const expected = linearCore(features);
        const values = DIMENSIONS.map(dimension => expected[dimension.id]);
        const session = {
            async run() {
                return { affect: { data: Float32Array.from(values) } };
            }
        };
        const Tensor = class {
            constructor(type, data, dims) {
                this.type = type;
                this.data = data;
                this.dims = dims;
            }
        };
        const result = await runReadoutSession(session, features, Tensor);
        expect(result.available).toBe(true);
        expect(result.values[0]).toBeCloseTo(expected.valence);
        expect(result.webgpu).toBe('not-required');
    });
});
