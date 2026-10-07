/**
 * `img-src` names every origin the reader loads a picture from, and no
 * other. It used to say `https:`, which let a page show a picture from
 * anywhere on the web; `connect-src` has always been an allowlist, and
 * this holds the picture side to the same posture.
 *
 * The set is derived from the data where it can be (the two generated
 * catalogues and the Chapel's hand-curated imagery) and hand-listed with
 * its evidence where the host is only known at runtime (a museum API
 * answers with the URL). Reader-supplied media never needs a host: the
 * Workshop and the personal focal hand the page `blob:` and `data:` URLs
 * (`src/core/visual-score-lane.js` rejects anything else).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import science from '../sources/visual/science-catalog.generated.json';
import audubon from '../sources/visual/audubon-catalog.generated.json';
import { DORE_PLATES } from '../content/chapel/imagery/dore.js';
import { CHAPEL_ICONS } from '../content/chapel/imagery/icons.js';
import { STATIONS } from '../content/chapel/liturgy/stations.js';
import { ROSARY_MYSTERY_WORKS } from '../content/chapel/liturgy/rosary-imagery.js';

const headers = readFileSync(resolve('public/_headers'), 'utf8');
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.*)$/mu)?.[1] ?? '';
const imgSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('img-src')) ?? '';
const sources = imgSrc.split(/\s+/u).slice(1);

const origin = url => new URL(url).origin;

/** Every https origin under an `image`/`imageUrl` key, however deep. */
function imageOrigins(value, out = new Set()) {
    if (Array.isArray(value)) value.forEach(item => imageOrigins(item, out));
    else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
            if ((key === 'image' || key === 'imageUrl') && typeof inner === 'string' && inner.startsWith('https://')) {
                out.add(origin(inner));
            } else imageOrigins(inner, out);
        }
    }
    return out;
}

// Hosts that appear in no catalogue because the picture URL is built or
// returned at runtime. Each is tied to the file that proves it is still
// in use, so a retired museum cannot linger here unnoticed.
const RUNTIME_HOSTS = {
    // Art Institute IIIF base: aic.js builds `${IIIF_BASE}/<image_id>/full/843,/0/default.jpg`.
    'https://www.artic.edu': 'src/content/imagery/adapters/aic.js',
    // Met: met.js displays `primaryImageSmall`/`primaryImage` as the API returns them;
    // the fixture carries the CDN host the real API answers with.
    'https://images.metmuseum.org': 'src/content/imagery/imagery.test.js',
    // Cleveland: cleveland.js displays `images.web.url` as the API returns it;
    // the fixture carries the CDN host the real API answers with.
    'https://openaccess-cdn.clevelandart.org': 'src/content/imagery/adapters/cleveland.test.js',
    // Rijksmuseum: rijks.js accepts only a DigitalObject access point on this host.
    'https://iiif.micr.io': 'src/content/imagery/adapters/rijks.js'
};

describe('img-src names every picture host and nothing wider', () => {
    it('is an allowlist, not a scheme', () => {
        expect(imgSrc).toBeTruthy();
        expect(sources).toContain("'self'");
        expect(sources).toContain('data:');
        expect(sources).toContain('blob:');
        expect(sources).not.toContain('https:');
        expect(sources.some(s => s.includes('*'))).toBe(false);
    });

    it('matches the catalogues, the Chapel and the runtime museums exactly', () => {
        const expected = new Set();
        // Science: the reader shows `image` (and `thumb` for the preview).
        for (const work of science.works) {
            expected.add(origin(work.image));
            expected.add(origin(work.thumb));
        }
        // Audubon: `imageService` is the IIIF base audubon.js builds from.
        for (const work of audubon.works) expected.add(origin(work.imageService));
        // Chapel: Doré plates, icons, Stations and the Rosary mysteries.
        for (const data of [DORE_PLATES, CHAPEL_ICONS, STATIONS, ROSARY_MYSTERY_WORKS]) {
            imageOrigins(data).forEach(host => expected.add(host));
        }
        for (const [host, evidence] of Object.entries(RUNTIME_HOSTS)) {
            expect(readFileSync(resolve(evidence), 'utf8'), `${evidence} no longer uses ${host}`)
                .toContain(host);
            expected.add(host);
        }

        const hosts = sources.filter(s => s.startsWith('https://'));
        expect(new Set(hosts)).toEqual(expected);
        expect(hosts.length, 'duplicate img-src host').toBe(new Set(hosts).size);
    });
});
