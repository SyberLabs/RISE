import { describe, expect, it } from 'vitest';
import { histogram, measureFieldVoid, VOID_FRACTION_LIMIT } from './ostensoria-coverage.js';

describe('Ostensoria void coverage', () => {
    it('treats an empty field as fully void', () => {
        const empty = measureFieldVoid(new Float32Array(100), 0);
        expect(empty.voidFraction).toBe(1);
        expect(empty.sparse).toBe(true);
    });

    it('flags a plate only when void meets the screen limit', () => {
        const field = new Float32Array(100);
        field[0] = 4;
        field[1] = 4;
        field[2] = 4;
        field[3] = 4;
        field[4] = 4;
        const sparse = measureFieldVoid(field, 4);
        expect(sparse.inkFraction).toBe(0.05);
        expect(sparse.voidFraction).toBe(0.95);
        expect(sparse.sparse).toBe(true);
        expect(VOID_FRACTION_LIMIT).toBe(0.95);

        field[5] = 4;
        const denser = measureFieldVoid(field, 4);
        expect(denser.voidFraction).toBe(0.94);
        expect(denser.sparse).toBe(false);
    });

    it('buckets a sample into void-fraction bands', () => {
        const { counts, labels } = histogram([0.2, 0.7, 0.96, 0.995]);
        expect(labels[0]).toBe('0%–50%');
        expect(counts[0]).toBe(1);
        expect(counts[1]).toBe(1);
        expect(counts[4]).toBe(1);
        expect(counts[5]).toBe(1);
    });
});
