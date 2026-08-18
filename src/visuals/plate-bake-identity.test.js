/**
 * A sliced bake must produce the same plate as a whole one.
 *
 * The engines' own stepBake tests compare the drawn parameters — the same
 * attractor, the same palette, the same accepted seed. Those come from the
 * seeded PRNG before any slicing, so they would agree even if the sliced
 * accumulation or development diverged. What decides whether the reader sees
 * the same picture is the field the splats build, the tone pass over it, and
 * the pixels written out, so this compares those.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Ostensoria } from './ostensoria.js';
import { Apparitio } from './apparitio.js';

/** The last ImageData handed to putImageData, which is the finished plate. */
function capturingContext() {
    const written = [];
    // The shared 2d stub is a Proxy that invents a vi.fn for any property
    // read, so a marker property on the context would always read truthy.
    const wrapped = new WeakSet();
    const original = HTMLCanvasElement.prototype.getContext;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(function getContext(type) {
            const ctx = original.call(this, type);
            if (ctx && !wrapped.has(ctx)) {
                wrapped.add(ctx);
                const put = ctx.putImageData;
                ctx.putImageData = (image, ...rest) => {
                    written.push(Uint8ClampedArray.from(image.data));
                    return put?.call?.(ctx, image, ...rest);
                };
            }
            return ctx;
        });
    return { written, restore: () => spy.mockRestore() };
}

/**
 * A checksum, not a deep compare: these arrays run to hundreds of thousands
 * of elements each and `toEqual` over them costs more than the bake does.
 *
 * It hashes the underlying BYTES. Mixing the elements of a Float32Array
 * directly would coerce each one to int32 and truncate the fraction, which on
 * values that live between 0 and 1 would compare almost nothing at all.
 */
function checksum(values) {
    if (!values) return 'absent';
    const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
        h = Math.imul(h ^ bytes[i], 0x01000193);
    }
    return `${values.length}:${h >>> 0}`;
}

function drain(engine, seed) {
    engine.beginBake(null, seed);
    let guard = 0;
    while (!engine.stepBake(8)) {
        guard += 1;
        if (guard > 20_000) throw new Error('stepBake never finished');
    }
    return guard;
}

describe.each([
    ['Ostensoria', Ostensoria, 'LUX-1234'],
    ['Apparitio', Apparitio, 'SERAPH-1234']
])('%s bakes the same plate whole or sliced', (name, Engine, seed) => {
    let capture;

    beforeEach(() => { capture = capturingContext(); });
    afterEach(() => { capture.restore(); });

    it('accumulates the same field and writes the same pixels', () => {
        const whole = new Engine();
        whole.generate(null, seed);
        const wholePlate = capture.written.at(-1);

        const sliced = new Engine();
        const slices = drain(sliced, seed);
        const slicedPlate = capture.written.at(-1);

        // The slicing has to be real, or this proves nothing.
        expect(slices).toBeGreaterThan(1);
        expect(sliced.ready).toBe(true);

        expect(checksum(sliced.fieldDev)).toBe(checksum(whole.fieldDev));
        expect(sliced.fMax).toBe(whole.fMax);
        expect(checksum(sliced.baseR)).toBe(checksum(whole.baseR));
        expect(checksum(sliced.baseG)).toBe(checksum(whole.baseG));
        expect(checksum(sliced.baseB)).toBe(checksum(whole.baseB));
        expect(checksum(sliced.glowSmall)).toBe(checksum(whole.glowSmall));

        // Grain is drawn from a table by a counter that has to survive the
        // slice boundaries, so the written pixels are the real check.
        expect(wholePlate).toBeDefined();
        expect(checksum(slicedPlate)).toBe(checksum(wholePlate));
    }, 60_000);

    it('the checksum notices a single changed value', () => {
        // Otherwise the comparison above proves only that both sides ran.
        const field = Float32Array.from({ length: 64 }, (_, i) => i / 64);
        const before = checksum(field);
        field[17] += 1e-6;
        expect(checksum(field)).not.toBe(before);

        const pixels = new Uint8ClampedArray(64);
        const pixelsBefore = checksum(pixels);
        pixels[9] = 1;
        expect(checksum(pixels)).not.toBe(pixelsBefore);
    });
});
