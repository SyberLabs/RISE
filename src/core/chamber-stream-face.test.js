import { describe, expect, it } from 'vitest';
import {
    CHAMBER_STREAM_FACES,
    resolveChamberStreamFace
} from './chamber-stream-face.js';

describe('Chamber stream face allowlist', () => {
    it('exposes only renderable Chamber faces including the shipped mono face', () => {
        const ids = CHAMBER_STREAM_FACES.map((face) => face.id);
        expect(ids).toEqual(['literary', 'display', 'thick', 'mono', 'jp']);
        expect(ids).not.toContain('inter');
    });

    it('passes through each allowlisted id', () => {
        for (const id of ['literary', 'display', 'thick', 'mono', 'jp']) {
            expect(resolveChamberStreamFace(id)).toBe(id);
        }
    });

    it('returns literary for unknown, empty, or missing ids', () => {
        for (const bad of [undefined, null, '', 'Inter', 'comic-sans', 'literary ', 0]) {
            expect(resolveChamberStreamFace(bad), String(bad)).toBe('literary');
        }
    });
});
