/**
 * What a reader actually SEES after adding a file.
 *
 * Three defects lived here at once, and all three were invisible to a suite
 * that asserted on state rather than on the panel:
 *
 *   1. The confirmation rendered and could not be seen. It had no CSS rule
 *      anywhere, so it inherited `.scriptorium-note` and came out the same dim
 *      grey as the static prose above and below it — the third of three
 *      identical paragraphs, one of which was news.
 *   2. The list line read ` · asset-5e2b0776-…`: a leading separator with
 *      nothing before it, then an internal identifier presented as a fact
 *      about the photograph.
 *   3. There were no thumbnails at all — while an object URL was already being
 *      minted for every file and held for the sole purpose of revoking it.
 *
 * A `blob:` URL here is written the way a browser writes one, against this
 * document's origin. `safeUrl` (the DOM trust boundary) rejects a blob URL
 * belonging to another document, so a mock that returns `blob:1` would render
 * no thumbnail and this file would pass while the room stayed empty.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Scriptorium } from './Scriptorium.js';

vi.mock('../core/materials.js', async (importOriginal) => ({
    ...(await importOriginal()),
    probeVideoDurationMs: vi.fn(async () => 11_000)
}));

const png = (name = 'cliff-at-dusk.png', bytes = 64) =>
    new File([new Uint8Array(bytes)], name, { type: 'image/png' });
const mp4 = (name = 'harbour.mp4', bytes = 2048) =>
    new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

describe('the materials panel, as a reader meets it', () => {
    let room;
    let minted;

    beforeEach(() => {
        minted = 0;
        // As a browser mints them: same-document, which is what safeUrl admits.
        global.URL.createObjectURL = vi.fn(() => {
            minted += 1;
            return `blob:${location.origin}/staged-${minted}`;
        });
        global.URL.revokeObjectURL = vi.fn();
        room = new Scriptorium(document.createElement('div'), {});
        room.mount();
    });

    describe('the confirmation', () => {
        it('is styled as something that happened, not as more explanation', () => {
            // The defect was an ABSENCE — no rule anywhere in the stylesheet —
            // so the assertion has to be about the stylesheet. jsdom applies no
            // imported CSS, which is precisely why nothing caught this.
            const css = readFileSync(
                join(process.cwd(), 'src/components/Scriptorium.css'), 'utf8');
            const rule = css.match(/\.scriptorium-material-notice\s*\{([^}]*)\}/u);
            expect(rule, '.scriptorium-material-notice has no rule of its own').toBeTruthy();
            // Anything but the fog it used to inherit from .scriptorium-note.
            expect(rule[1]).not.toMatch(/color:\s*var\(--scriptorium-fog\)/u);
            expect(rule[1]).toMatch(/color:/u);
        });

        it('tells a refusal apart from a confirmation', async () => {
            await room.addMaterials([png(), new File([new Uint8Array(8)],
                'notes.pdf', { type: 'application/pdf' })]);
            const notice = room.container.querySelector('.scriptorium-material-notice');
            const refused = notice.querySelector('.scriptorium-material-refused');
            const taken = notice.querySelector('.scriptorium-material-taken');
            // BOTH, not whichever came last.
            expect(refused.textContent).toMatch(/notes\.pdf/);
            expect(taken.textContent).toMatch(/1 image added/);
        });

        it('is announced to a reader who cannot see it either', async () => {
            await room.addMaterials([png()]);
            expect(room.container.querySelector('.scriptorium-material-notice')
                .getAttribute('role')).toBe('status');
        });
    });

    describe('the list line', () => {
        it('says what the file is, with no dangling separator', async () => {
            await room.addMaterials([png('cliff-at-dusk.png', 4096)]);
            const meta = room.container
                .querySelector('.scriptorium-material .scriptorium-meta').textContent.trim();
            // It used to open with the separator, because `kind` is only set
            // on a video descriptor and an image's was undefined.
            expect(meta.startsWith('·')).toBe(false);
            expect(meta).toBe('Image · 4 KB');
        });

        it('says how long a video runs', async () => {
            await room.addMaterials([mp4()]);
            expect(room.container
                .querySelector('.scriptorium-material .scriptorium-meta').textContent.trim())
                .toBe('Video · 11s · 2 KB');
        });

        it('keeps the id, labelled as the score\'s name for the file', async () => {
            await room.addMaterials([png()]);
            const id = room.materials[0].id;
            const line = room.container.querySelector('.scriptorium-material-id');
            expect(line.querySelector('code').textContent).toBe(id);
            expect(line.textContent).toMatch(/Named in the score/);
            // And not loose in the measurements, which is where it was.
            expect(room.container.querySelector('.scriptorium-material .scriptorium-meta')
                .textContent).not.toContain(id);
        });
    });

    describe('the thumbnails', () => {
        it('shows the image the reader chose', async () => {
            await room.addMaterials([png()]);
            const img = room.container.querySelector('img.scriptorium-material-thumb');
            expect(img).toBeTruthy();
            expect(img.getAttribute('src')).toBe(room.materials[0].uri);
            // The filename beside it is the accessible name; announcing the
            // tile as well would say the same thing twice.
            expect(img.getAttribute('alt')).toBe('');
            expect(img.getAttribute('aria-hidden')).toBe('true');
        });

        it('shows one tile per file, in the order they were added', async () => {
            await room.addMaterials([png('a.png'), png('b.png'), png('c.png')]);
            const thumbs = room.container.querySelectorAll('.scriptorium-material-thumb');
            expect(thumbs).toHaveLength(3);
            expect([...thumbs].map(node => node.getAttribute('src')))
                .toEqual(room.materials.map(item => item.uri));
        });

        it('renders a video as a video, never through the image path', async () => {
            await room.addMaterials([mp4()]);
            expect(room.container.querySelector('img.scriptorium-material-thumb')).toBeNull();
            const video = room.container.querySelector('.scriptorium-material-thumb video');
            expect(video).toBeTruthy();
            expect(video.getAttribute('src')).toBe(room.materials[0].uri);
            // Cheap: metadata is enough for a first frame, and it must not
            // sound in a panel the reader is only looking at.
            expect(video.getAttribute('preload')).toBe('metadata');
            expect(video.hasAttribute('muted')).toBe(true);
            // Labelled, so a tile that decodes to nothing still says what it is.
            expect(room.container.querySelector('.scriptorium-material-badge').textContent)
                .toBe('video');
        });

        it('degrades to a labelled tile, never to a broken frame', async () => {
            await room.addMaterials([png()]);
            // A descriptor whose blob has gone: rehydrated from the Vault, or
            // revoked. Persistence strips the URI on purpose.
            room.session.setMaterials(room.materials.map(item => {
                const { uri, ...rest } = item;
                void uri;
                return rest;
            }));
            room.render();
            expect(room.container.querySelector('img.scriptorium-material-thumb')).toBeNull();
            const tile = room.container.querySelector('.scriptorium-material-thumb-absent');
            expect(tile).toBeTruthy();
            expect(tile.textContent.trim()).toBe('image');
        });

        it('turns a thumbnail that will not load into an absent one', async () => {
            await room.addMaterials([png()]);
            const img = room.container.querySelector('img.scriptorium-material-thumb');
            img.dispatchEvent(new Event('error'));
            expect(img.hasAttribute('src')).toBe(false);
            expect(img.classList.contains('scriptorium-material-thumb-absent')).toBe(true);
        });

        it('never mints a URL it does not render', async () => {
            await room.addMaterials([png('a.png'), mp4('b.mp4')]);
            const rendered = room.container.querySelectorAll('[src^="blob:"]');
            expect(rendered).toHaveLength(room.objectUrls.size);
        });
    });
});
