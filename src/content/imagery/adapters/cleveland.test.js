import { describe, expect, it, vi } from 'vitest';
import { resolveClevelandWork } from './cleveland.js';

/**
 * The Cleveland accession fix (PERICOPE-IMAGERY-SPEC §9): the API's
 * object endpoint accepts both a numeric object id and a dotted
 * accession number, and a work resolved by its accession must adopt
 * its own canonical numeric id so it is never pinned twice.
 */

const cmaRecord = (id, accession) => ({
    ok: true,
    json: async () => ({
        data: {
            id,
            accession_number: accession,
            title: 'The Baptism of Christ',
            creators: [{ description: 'Master (Flemish, 1500–1560)' }],
            creation_date: 'c. 1520',
            share_license_status: 'CC0',
            images: { web: { url: 'https://openaccess-cdn.clevelandart.org/x/web.jpg' } },
            url: 'https://clevelandart.org/art/1953.143'
        }
    })
});

describe('Cleveland accession handling', () => {
    it('resolves a DOTTED accession number and adopts the canonical numeric id', async () => {
        const fetchImpl = vi.fn(async () => cmaRecord(130377, '1953.143'));
        const work = await resolveClevelandWork('1953.143', { fetchImpl });
        expect(work).not.toBeNull();
        // requested by accession, but pinned under the stable numeric id
        expect(work.id).toBe('cleveland:130377');
        // the request went to the accession path, URL-encoded
        expect(fetchImpl.mock.calls[0][0]).toContain('/1953.143');
    });

    it('still resolves a numeric object id', async () => {
        const fetchImpl = vi.fn(async () => cmaRecord(94979, '1935.22'));
        const work = await resolveClevelandWork('94979', { fetchImpl });
        expect(work.id).toBe('cleveland:94979');
    });

    it('rejects a non-id string before spending a fetch', async () => {
        const fetchImpl = vi.fn();
        const work = await resolveClevelandWork('DROP TABLE', { fetchImpl });
        expect(work).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('withholds a Copyrighted work (rights gate unchanged)', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                data: {
                    id: 1, accession_number: '1.1', title: 'x',
                    share_license_status: 'Copyrighted',
                    images: { web: { url: 'https://x/y.jpg' } }
                }
            })
        }));
        const work = await resolveClevelandWork('1.1', { fetchImpl });
        // normalizeWork withholds UNKNOWN rights
        expect(work).toBeNull();
    });
});
