// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Stream } from './sha256.js';

const nodeDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');

describe('streaming SHA-256', () => {
    it('matches the known answers', () => {
        expect(sha256Stream().digest()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        const abc = sha256Stream();
        abc.update(new TextEncoder().encode('abc'));
        expect(abc.digest()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('agrees with the platform digest however the bytes are split', () => {
        const bytes = new Uint8Array(300_000);
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919 + (i >> 3)) & 0xff;
        const expected = nodeDigest(bytes);
        for (const size of [1, 55, 56, 63, 64, 65, 1000, 65_536, bytes.length]) {
            const hash = sha256Stream();
            for (let offset = 0; offset < bytes.length; offset += size) hash.update(bytes.subarray(offset, offset + size));
            expect(hash.digest(), `chunks of ${size}`).toBe(expected);
        }
        // Lengths that leave every padding case: 0..130 bytes.
        for (let length = 0; length <= 130; length++) {
            const hash = sha256Stream();
            hash.update(bytes.subarray(0, length));
            expect(hash.digest(), `${length} bytes`).toBe(nodeDigest(bytes.subarray(0, length)));
        }
    });
});
