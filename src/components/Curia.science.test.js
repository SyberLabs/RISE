/**
 * @vitest-environment jsdom
 *
 * THE CURIA IS WHAT MAKES THE SHORTENED CREDIT LAWFUL.
 *
 * SOURCE-EXPANSION-SPEC §3a: the Chamber's chip carries a credit as text,
 * the Curia carries the full record with URLs. The roster ruling then
 * cuts a 500-character observing-team credit at its marker and lets the
 * remainder live elsewhere, which CC BY 4.0 §3(a)(3) permits only where
 * the medium makes the full text impractical AND the full text is
 * reachable. Twenty-five works carry an elided credit.
 *
 * So these are not tests that a room renders. They are the test that a
 * promise the licence was given is actually kept.
 */
import { describe, expect, it, vi } from 'vitest';
import { Curia } from './Curia.js';
import catalog from '../sources/visual/science-catalog.generated.json';

const mount = async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    // The dev-write probe is irrelevant here and would be an open handle.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const curia = new Curia(host);
    await curia.load();
    return { curia, host };
};

describe('the Curia holds the science attribution record', () => {
    it('lists the astronomy collection on the board', async () => {
        const { curia, host } = await mount();
        const card = host.querySelector('[data-science="astronomy"]');
        expect(card, 'astronomy is absent from the Curia').toBeTruthy();
        expect(card.textContent).toContain('Astronomy');
        expect(curia.scienceCategories[0].works).toBe(
            catalog.collections.astronomy.works.length);
    });

    it('shows every elided credit in full', async () => {
        const { curia, host } = await mount();
        curia.container.querySelector('.curia-detail').hidden = false;
        curia.renderScienceDetail('astronomy');

        const elided = catalog.works.filter(w => w.creditElided);
        expect(elided.length).toBeGreaterThan(0);

        const rendered = host.querySelector('.curia-detail').textContent;
        for (const work of elided) {
            // The whole provider credit, not the chip's shortened line —
            // the shortening is only permissible because this is here.
            expect(rendered, `${work.id} full credit missing`).toContain(work.fullCredit);
        }
    });

    it('gives every work its credit, its licence and a reachable source', async () => {
        const { curia, host } = await mount();
        curia.container.querySelector('.curia-detail').hidden = false;
        curia.renderScienceDetail('astronomy');
        const detail = host.querySelector('.curia-detail');

        const ids = new Set(catalog.collections.astronomy.works);
        const works = catalog.works.filter(w => ids.has(w.id));
        expect(detail.querySelectorAll('.curia-work-record')).toHaveLength(works.length);

        const links = [...detail.querySelectorAll('.curia-work-links a')];
        expect(links.length).toBe(works.filter(w => w.sourceUrl).length);
        for (const a of links) {
            expect(a.getAttribute('href')).toMatch(/^https:\/\//);
            // A link out of the reading surface must not carry the reader
            // with it, nor hand the destination a referrer.
            expect(a.getAttribute('rel')).toContain('noopener');
            expect(a.getAttribute('rel')).toContain('noreferrer');
        }
        expect(detail.textContent).toContain(catalog.rightsVerifiedAt);
    });

    it('offers no governance verbs it cannot honour', async () => {
        // exclude/pin/move rewrite museum-pins.js. The science canon is
        // science-pins.js plus a rebuild, so a verb here would be a
        // control that silently does nothing — worse than none, because
        // it claims an authority the room does not have.
        const { curia, host } = await mount();
        curia.container.querySelector('.curia-detail').hidden = false;
        curia.renderScienceDetail('astronomy');
        expect(host.querySelectorAll('.curia-detail [data-verb]')).toHaveLength(0);
    });
});
