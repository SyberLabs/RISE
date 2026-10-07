/**
 * SHA-256 over bytes that arrive in pieces.
 *
 * The platform digest (`crypto.subtle.digest`) wants the whole input in one
 * buffer. A Kev weight file is gigabytes and streams from the network into
 * Cache Storage, and back out of it as a Blob, so its digest is taken one
 * chunk at a time instead. Checked against the platform digest in the test.
 */

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** A hash to feed `update(Uint8Array)` any number of times, then `digest()` once for the hex string. */
export function sha256Stream() {
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    const block = new Uint8Array(64);
    let fill = 0;
    let length = 0;

    function compress(bytes, offset) {
        for (let i = 0; i < 16; i++) {
            const at = offset + i * 4;
            w[i] = (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
        }
        for (let i = 16; i < 64; i++) {
            const x = w[i - 15];
            const y = w[i - 2];
            const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
            const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const t1 = (hh + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
            const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
            hh = g; g = f; f = e; e = (d + t1) | 0;
            d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d;
        h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }

    return {
        update(chunk) {
            length += chunk.length;
            let offset = 0;
            if (fill) {
                const take = Math.min(64 - fill, chunk.length);
                block.set(chunk.subarray(0, take), fill);
                fill += take;
                offset = take;
                if (fill < 64) return;
                compress(block, 0);
                fill = 0;
            }
            for (; offset + 64 <= chunk.length; offset += 64) compress(chunk, offset);
            if (offset < chunk.length) {
                block.set(chunk.subarray(offset));
                fill = chunk.length - offset;
            }
        },
        digest() {
            block[fill++] = 0x80;
            if (fill > 56) {
                block.fill(0, fill);
                compress(block, 0);
                fill = 0;
            }
            block.fill(0, fill, 56);
            const bits = length * 8;
            const view = new DataView(block.buffer);
            view.setUint32(56, Math.floor(bits / 0x1_0000_0000));
            view.setUint32(60, bits >>> 0);
            compress(block, 0);
            return [...h].map(word => word.toString(16).padStart(8, '0')).join('');
        }
    };
}
