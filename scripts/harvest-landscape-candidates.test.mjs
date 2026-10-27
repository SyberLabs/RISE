import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    candidate, checkedUrl, pixels, rijksDate, rijksImageIsPublicDomain, rijksMakers, shapeScreen, text, titleScreen
} from './harvest-landscape-candidates.mjs';

const cleveland = {
    id: 'cleveland:141639', sourceName: 'The Cleveland Museum of Art', title: 'Twilight in the Wilderness',
    maker: 'Frederic Edwin Church', date: '1860', rights: 'CC0',
    image: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg', imageWidth: '900', imageHeight: '559',
    full: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_print.jpg', fullWidth: '3400', fullHeight: '2112',
    page: 'https://clevelandart.org/art/1965.233'
};
const landscapes = { set: 'landscapes', source: 'cleveland', register: 'painting' };

test('a URL must be https on the source’s own host and carry no credential', () => {
    const hosts = ['openaccess-cdn.clevelandart.org'];
    assert.equal(checkedUrl('https://openaccess-cdn.clevelandart.org/a.jpg', hosts), 'https://openaccess-cdn.clevelandart.org/a.jpg');
    for (const bad of [
        'http://openaccess-cdn.clevelandart.org/a.jpg',
        'javascript:alert(1)',
        'https://evil.example/a.jpg',
        'https://openaccess-cdn.clevelandart.org.evil.example/a.jpg',
        'https://user:pass@openaccess-cdn.clevelandart.org/a.jpg',
        'https://openaccess-cdn.clevelandart.org/a.jpg?api_key=secret',
        `https://openaccess-cdn.clevelandart.org/${'a'.repeat(2001)}`,
        42, null
    ]) assert.equal(checkedUrl(bad, hosts), '', String(bad));
});

test('text is plain and bounded, pixel sizes are bounded integers', () => {
    assert.equal(text('<img src=x onerror=alert(1)>Vale &amp; Hill', 240), 'Vale & Hill');
    assert.equal(text('x'.repeat(500), 240).length, 240);
    assert.equal(text({ toString: () => 'object' }, 240), '');
    assert.equal(pixels('1536'), 1536);
    assert.equal(pixels(843), 843);
    for (const bad of ['0', '-5', '12.5', '1e9', '9999999', 'wide', null, 1.5]) assert.equal(pixels(bad), null, String(bad));
});

test('an open Cleveland work composes the chip the Reader shows: title and artist, no credit owed', () => {
    const { work } = candidate(cleveland, landscapes);
    assert.equal(work.licence, 'open');
    assert.equal(work.chip, 'Twilight in the Wilderness · Frederic Edwin Church');
    assert.equal(work.requiredCredit, '');
    assert.equal(work.thumb, cleveland.image);
    assert.equal(work.fullWidth, 3400);
});

test('an ESO photograph owes its credit with its licence', () => {
    const { work } = candidate({
        id: 'eso:potw1150a', sourceName: 'ESO', title: 'ALMA\'s world at night', maker: 'European Southern Observatory',
        rights: 'Creative Commons Attribution 4.0 International License', credit: 'ESO/B. Tafreshi (twanight.org)',
        image: 'https://cdn.eso.org/images/screen/potw1150a.jpg', imageWidth: 1280, imageHeight: 412,
        page: 'https://www.eso.org/public/images/potw1150a/'
    }, { set: 'earth-and-sky', source: 'eso', register: 'photograph' });
    assert.equal(work.licence, 'cc-by');
    assert.equal(work.requiredCredit, 'ESO/B. Tafreshi (twanight.org) · CC BY 4.0');
    assert.equal(work.chip, work.requiredCredit);
});

test('a NASA photograph is public domain with the acknowledgement NASA asks for', () => {
    const { work } = candidate({
        id: 'nasa:iss058e005282', sourceName: 'NASA Image and Video Library', title: 'View of the Earth\'s limb with an aurora',
        rights: 'Public domain (NASA) — acknowledgement required', credit: 'NASA/JSC', creditRequired: true,
        image: 'https://images-assets.nasa.gov/image/iss058e005282/iss058e005282~medium.jpg', imageWidth: 1280, imageHeight: 853,
        page: 'https://images.nasa.gov/details/iss058e005282'
    }, { set: 'earth-and-sky', source: 'nasa', register: 'photograph' });
    assert.equal(work.licence, 'public-domain-credit');
    assert.equal(work.requiredCredit, 'NASA/JSC · Public domain (NASA) — acknowledgement required');
});

test('a work refused by its rights, its id or its URLs is not a candidate', () => {
    assert.match(candidate({ ...cleveland, rights: 'All rights reserved' }, landscapes).why, /cannot be shown/);
    assert.match(candidate({ ...cleveland, rights: 'CC BY-NC 4.0' }, landscapes).why, /cannot be shown/);
    assert.equal(candidate({ ...cleveland, id: 'cleveland:1;drop' }, landscapes).why, 'malformed id');
    assert.equal(candidate({ ...cleveland, image: 'https://evil.example/a.jpg' }, landscapes).why, 'image url refused');
    assert.equal(candidate({ ...cleveland, page: 'javascript:alert(1)' }, landscapes).why, 'page url refused');
    assert.equal(candidate({ ...cleveland, title: '<b></b>' }, landscapes).why, 'no title');
});

test('the chip names the maker the Reader’s adapter reads, the sheet the maker the record names', () => {
    const { work } = candidate({ ...cleveland, chipMaker: '' }, landscapes);
    assert.equal(work.maker, 'Frederic Edwin Church');
    assert.equal(work.chip, 'Twilight in the Wilderness');
});

test('a Rijksmuseum image is public domain only by its own rights, not its metadata record’s', () => {
    const metadataCc0 = { subject_of: [{ subject_to: [{ classified_as: [{ id: 'https://creativecommons.org/publicdomain/zero/1.0/' }] }] }] };
    assert.equal(rijksImageIsPublicDomain({ ...metadataCc0, subject_to: [{ classified_as: [{ id: 'https://rightsstatements.org/vocab/InC/1.0/' }] }] }), false);
    assert.equal(rijksImageIsPublicDomain(metadataCc0), false);
    assert.equal(rijksImageIsPublicDomain({ ...metadataCc0, subject_to: [{ classified_as: [{ id: 'https://creativecommons.org/publicdomain/mark/1.0/' }] }] }), true);
    assert.equal(rijksImageIsPublicDomain(null), false);
});

test('a Rijksmuseum record’s makers and date come from its production', () => {
    const object = { produced_by: {
        timespan: { identified_by: [{ content: '1903 - 1920' }] },
        part: [
            { carried_out_by: [{ notation: { '@language': 'nl', '@value': 'Stoomsteendrukkerij Senefelder' } }] },
            { carried_out_by: [{ notation: [{ '@language': 'en', '@value': 'anonymous' }, { '@language': 'nl', '@value': 'anoniem' }] }] }
        ]
    } };
    assert.equal(rijksMakers(object), 'Stoomsteendrukkerij Senefelder');
    assert.equal(rijksDate(object), '1903 - 1920');
    assert.equal(rijksMakers({}), '');
});

test('the screens cut figure subjects and shapes a circle cannot hold', () => {
    assert.equal(titleScreen('Virgin and Child in a Landscape'), 'figure subject (title)');
    assert.equal(titleScreen('Group of Natives from Near Khyber Pass'), 'people, not a place (title)');
    assert.equal(titleScreen('Landscape with Tree and Three Men, India'), '');
    assert.equal(titleScreen('Fotoalbum oliewinning op Borneo'), 'not a landscape (title)');
    assert.equal(titleScreen('Reisablum Algerije'), 'not a landscape (title)');
    assert.equal(titleScreen('Landscapes: Album of Ten Leaves'), '');
    assert.equal(shapeScreen({ fullWidth: 3400, fullHeight: 1000 }), 'aspect 3.4:1, over 2:1');
    assert.equal(shapeScreen({ imageWidth: 640, imageHeight: 415 }), 'long edge 640 px, under 1000');
    assert.equal(shapeScreen({ fullWidth: 1536, fullHeight: 1931 }), '');
});
