import { describe, expect, it } from 'vitest';
import { pumpBakeQueue } from './plate-bake.js';

describe('pumpBakeQueue', () => {
    it('runs jobs until the queue is empty', () => {
        const seen = [];
        const queue = [
            () => { seen.push('a'); return true; },
            () => { seen.push('b'); return true; }
        ];
        expect(pumpBakeQueue(queue, 1e9)).toBe(true);
        expect(seen).toEqual(['a', 'b']);
        expect(queue).toHaveLength(0);
    });

    it('stops when a job is not finished', () => {
        let n = 0;
        const queue = [
            () => { n += 1; return n >= 3; }
        ];
        expect(pumpBakeQueue(queue, 1e9)).toBe(false);
        expect(pumpBakeQueue(queue, 1e9)).toBe(false);
        expect(pumpBakeQueue(queue, 1e9)).toBe(true);
        expect(n).toBe(3);
    });
});
