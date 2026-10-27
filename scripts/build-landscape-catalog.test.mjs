import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCatalog, changes } from './build-landscape-catalog.mjs';

const eso = {
    id: 'eso:potw1222a', set: 'earth-and-sky', source: 'eso', register: 'photograph', sourceName: 'ESO',
    title: 'The southern Milky Way above ALMA', maker: 'European Southern Observatory', date: '2012-05-28',
    rights: 'Creative Commons Attribution 4.0 International License', licence: 'cc-by',
    fullCredit: 'ESO/B. Tafreshi (twanight.org)', requiredCredit: 'ESO/B. Tafreshi (twanight.org) · CC BY 4.0',
    image: 'https://cdn.eso.org/images/screen/potw1222a.jpg', imageWidth: 1280, imageHeight: 854,
    page: 'https://www.eso.org/public/images/potw1222a/'
};
const cleveland = {
    id: 'cleveland:144967', set: 'landscapes', source: 'cleveland', register: 'painting',
    sourceName: 'The Cleveland Museum of Art', title: 'Point Judith, Rhode Island', maker: 'Martin Johnson Heade',
    rights: 'CC0', licence: 'open', requiredCredit: '', fullCredit: '',
    image: 'https://openaccess-cdn.clevelandart.org/1970.161/1970.161_web.jpg', page: 'https://clevelandart.org/art/1970.161'
};
const pins = {
    landscapes: { name: 'Landscapes', favourites: ['cleveland:144967'], kept: ['cleveland:144967', 'cleveland:1'], cut: ['cleveland:2'] },
    'earth-and-sky': { name: 'Earth and sky', favourites: [], kept: ['eso:potw1222a'], cut: [] }
};

test('the catalog holds only kept works on the reviewed sheet, its credit composed again', () => {
    const sheet = { rightsVerifiedAt: '2026-10-27', works: [eso, cleveland, { ...cleveland, id: 'cleveland:2' }] };
    const { doc, refused } = buildCatalog(sheet, pins);
    assert.deepEqual(doc.collections.landscapes, { name: 'Landscapes', works: ['cleveland:144967'], favourites: ['cleveland:144967'] });
    assert.deepEqual(refused, [{ id: 'cleveland:1', why: 'not on the reviewed sheet' }]);
    assert.equal(doc.rightsVerifiedAt, '2026-10-27');
    assert.ok(!doc.works.some(w => w.id === 'cleveland:2'));
    const star = doc.works.find(w => w.id === 'eso:potw1222a');
    assert.equal(star.requiredCredit, 'ESO/B. Tafreshi (twanight.org) · CC BY 4.0');
    assert.equal(doc.works.find(w => w.id === 'cleveland:144967').favourite, true);
});

test('a work whose licence became restrictive is refused at the build', () => {
    const sheet = { rightsVerifiedAt: '2026-10-27', works: [{ ...eso, rights: 'CC BY-NC 4.0' }] };
    const { refused } = buildCatalog(sheet, { 'earth-and-sky': pins['earth-and-sky'] });
    assert.deepEqual(refused, [{ id: 'eso:potw1222a', why: 'cannot be credited' }]);
});

test('the re-check names every change in rights, owed credit and image, and nothing else', () => {
    const pinned = { licence: 'cc-by', requiredCredit: 'ESO · CC BY 4.0', image: 'https://cdn.eso.org/a.jpg' };
    assert.deepEqual(changes(pinned, { work: { ...pinned, title: 'Renamed' } }, { ok: true }), []);
    assert.deepEqual(changes(pinned, { why: 'gone from its source (404)' }), ['no longer shown: gone from its source (404)']);
    assert.deepEqual(changes(pinned, { work: { licence: 'restricted', requiredCredit: 'ESO', image: 'https://cdn.eso.org/b.jpg' } }, { ok: false, why: 'HTTP 404' }), [
        'licence cc-by → restricted',
        'credit "ESO · CC BY 4.0" → "ESO"',
        'image https://cdn.eso.org/a.jpg → https://cdn.eso.org/b.jpg',
        'image does not load: HTTP 404'
    ]);
});
