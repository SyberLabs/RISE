/**
 * The admit room, driven the way a reader drives it.
 *
 * The physics have their own tests; these press the buttons. What is checked
 * here is the seam between the two — that the offsets on the DOM are the
 * offsets the verbs accept, that a tap-only reader can reach every result,
 * and that both exits still exist. The last one is a deliberate departure
 * from SCRIPTORIUM-STRENGTHENING-SPEC §9.1, which deletes the direct read.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Admit } from './Admit.js';
import { normalizeReaderText } from '../core/local-works.js';

const POEMS = [
    'Pyramid', 'a stone set on a stone', 'and the light going',
    '', 'Sycamore', 'the bark peels in strips', 'like a letter opened twice',
    '', 'Railroad', 'sleepers under the rain', 'counting themselves away'
].join('\r\n');

/**
 * The same poems as a record holds them after intake.
 *
 * Line endings are settled once, at intake, because a cut is an offset into
 * reader text and so is a Workshop passage span — and one file can now be both
 * a shelved work and a source there. The direct exit therefore hands back
 * NORMALISED text, and asserting the raw fixture would assert the older of two
 * offset spaces.
 */
const TEXT = normalizeReaderText(POEMS);

let room = null;
const open = (options = {}) => {
    room = new Admit({ text: POEMS, sourceName: 'poems.txt', ...options });
    return room;
};
const at = selector => room.element.querySelectorAll(selector);
const labels = () => [...at('.admit-label')].map(input => input.value);
const click = element => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

afterEach(() => {
    room?.destroy();
    room = null;
});

describe('what a reader sees first', () => {
    it('opens on the honest draft — one part, and the offer to cut', () => {
        open();
        expect(at('.admit-part')).toHaveLength(1);
        const chip = room.element.querySelector('[data-magnet="title"]');
        expect(chip.textContent).toContain('Cut at every title');
        expect(chip.textContent).toContain('2');
    });

    it('shows the prose, escaped', () => {
        open({ text: 'Ampersand & <script>alert(1)</script>' });
        const block = room.element.querySelector('.admit-block');
        expect(block.querySelector('script')).toBeNull();
        expect(block.textContent).toContain('<script>');
    });
});

describe('taps alone are enough', () => {
    it('places a joint from the rule that carries its offset', () => {
        open();
        const rule = room.element.querySelector('[data-place]');
        const offset = Number(rule.dataset.place);
        click(rule);
        expect(room.record.cuts).toContain(offset);
        expect(at('.admit-part')).toHaveLength(2);
    });

    it('joins two parts from the seam between them', () => {
        open();
        click(room.element.querySelector('[data-place]'));
        click(room.element.querySelector('[data-join]'));
        expect(at('.admit-part')).toHaveLength(1);
        expect(at('.admit-seam')).toHaveLength(0);
    });

    it('cuts at every title in one tap, and names the parts from the titles', () => {
        open();
        click(room.element.querySelector('[data-magnet="title"]'));
        expect(labels()).toEqual(['Pyramid', 'Sycamore', 'Railroad']);
        expect(room.element.querySelector('.admit-summary').textContent).toBe('3 parts');
    });

    it('keeps a name the reader typed over one the machine would compute', () => {
        open();
        click(room.element.querySelector('[data-magnet="title"]'));
        const input = at('.admit-label')[0];
        input.value = 'The stone one';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // A join below it renumbers the parts; the typed name is not a number
        // and does not move with them.
        click([...at('[data-join]')].pop());
        expect(labels()).toEqual(['The stone one', 'Sycamore']);
    });
});

describe('the two exits', () => {
    it('admits a record the Library can hold', () => {
        const onAdmit = vi.fn();
        open({ onAdmit });
        click(room.element.querySelector('[data-magnet="title"]'));
        click(room.element.querySelector('[data-action="admit"]'));
        const [record] = onAdmit.mock.calls[0];
        expect(record.schema).toBe('rise.local-work.v1');
        expect(record.id.startsWith('local-')).toBe(true);
        expect(record.labels).toHaveLength(3);
    });

    it('still reads straight through to the Chamber, with the whole text', () => {
        // §9.1 deletes this door. It is kept: the partition is an addition to
        // what a dropped file could already do, never a toll on it.
        const onReadNow = vi.fn();
        open({ onReadNow });
        click(room.element.querySelector('[data-action="read"]'));
        expect(onReadNow).toHaveBeenCalledWith(TEXT, 'poems');
    });

    it('leaves nothing behind on any exit', () => {
        for (const action of ['cancel', 'read', 'admit']) {
            open();
            click(room.element.querySelector(`[data-action="${action}"]`));
            expect(document.querySelector('.admit-overlay')).toBeNull();
        }
    });
});

describe('renaming the work', () => {
    it('does not re-mint the id', () => {
        // An id that moves is an extent that stops resolving: a score naming
        // `local-poems#2` would point at nothing the moment a title changed.
        open();
        const id = room.record.id;
        const title = room.element.querySelector('#admit-title');
        title.value = 'Something else entirely';
        title.dispatchEvent(new Event('change', { bubbles: true }));
        expect(room.record.title).toBe('Something else entirely');
        expect(room.record.id).toBe(id);
    });
});
