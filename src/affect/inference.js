/**
 * Browser and local inference.
 *
 * The reliable path is the JavaScript linear core: a few hundred
 * parameters do not need WebGPU. ONNX is an interchange format and an
 * optional session. A missing session is a result, not an exception.
 */

export function onnxUnavailable(reason) {
    return {
        available: false,
        reason,
        fallback: 'js-linear-core',
        webgpu: 'not-required'
    };
}

export async function runReadoutSession(session, features, Tensor) {
    if (!session || typeof session.run !== 'function' || typeof Tensor !== 'function') {
        return onnxUnavailable('onnx-session-not-configured');
    }
    const tensor = new Tensor('float32', Float32Array.from(features), [1, features.length]);
    const output = await session.run({ features: tensor });
    const data = output.affect?.data;
    if (!data) return onnxUnavailable('onnx-output-missing');
    return {
        available: true,
        provider: 'caller-session',
        values: Array.from(data),
        webgpu: 'not-required'
    };
}
