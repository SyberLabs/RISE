import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

/**
 * Moving the reading band is a drag on its words. A mouse drag on text is also how a page selects it, and a
 * selection is the browser's to act on (a native drag of the text, or anything on the device that reads a
 * selection aloud, which stops whatever else is speaking). So once the band is selected for moving, a press on
 * it takes no selection with it: the text is not selectable, and the press's default is prevented.
 */
let ctx;

beforeEach(() => {
    document.body.innerHTML = '<div id="stage"><div id="chamber-field"><div id="atom-display" class="atom-display">Light scatters.</div></div></div>';
    const style = document.createElement('style');
    style.textContent = readFileSync(join(import.meta.dirname, 'Chamber.css'), 'utf8');
    document.head.append(style);
    ctx = {
        container: document.getElementById('stage'),
        getSettings: () => ({}),
        onSettingsChange: () => {},
        applyBandOffset: () => {},
        _refreshProgressiveGlass: () => {},
        setBandMovable: Chamber.prototype.setBandMovable,
        _bandFootTravel: Chamber.prototype._bandFootTravel,
        _noteBand: Chamber.prototype._noteBand
    };
    Chamber.prototype.attachBandMove.call(ctx);
});

afterEach(() => {
    ctx._bandMoveCleanup?.();
    window.removeEventListener('resize', ctx._bandResize);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

const press = target => {
    const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientY: 100 });
    target.dispatchEvent(event);
    return event;
};

describe('a band selected for moving', () => {
    it('cannot have its words selected, and can again once it is put down', () => {
        const band = document.getElementById('atom-display');
        press(band);
        expect(band.classList.contains('is-band-movable')).toBe(true);
        expect(getComputedStyle(band).getPropertyValue('user-select')).toBe('none');
        ctx.setBandMovable(false);
        expect(getComputedStyle(band).getPropertyValue('user-select')).not.toBe('none');
    });

    it('takes the press that starts a move for itself, so the browser starts no selection with it', () => {
        const band = document.getElementById('atom-display');
        press(band);
        const moving = press(band);
        expect(band.classList.contains('is-band-moving')).toBe(true);
        expect(moving.defaultPrevented).toBe(true);
    });
});

/**
 * On a card on a phone with a picture (LiveHost.css, stacked), the field sets its band at its foot, in a strip
 * kept under the picture. The strip is where the words rest, not a cage: a reader may lift them over the picture
 * as far as the field's top edge less 8 px, and bring them back down to the strip, never below it. Each gesture
 * is noted for the host's trace (About this reading), so a field report shows whether the press, the moves and
 * the release reached the card or the app took the gesture (pointercancel).
 */
describe('words resting at the foot of a field with a picture', () => {
    const FIELD_TOP = 0;
    const REST_TOP = 260;
    let foot;
    let noted;
    const record = event => noted.push(event.detail);

    beforeEach(() => {
        ctx._bandMoveCleanup?.();
        window.removeEventListener('resize', ctx._bandResize);
        document.body.innerHTML = '<div id="stage"><div id="chamber-field" data-picture="figure" style="display: flex; align-items: flex-end">'
            + '<div class="atom-band" id="atom-band"><div id="atom-display" class="atom-display">Light scatters.</div></div></div></div>';
        const rect = top => () => ({ top, bottom: top + 100, left: 0, right: 390, width: 390, height: 100 });
        document.getElementById('chamber-field').getBoundingClientRect = rect(FIELD_TOP);
        // Whichever of the two moves (the phone band's box, or the words where the band has none) rests at REST_TOP.
        document.getElementById('atom-band').getBoundingClientRect = rect(REST_TOP);
        document.getElementById('atom-display').getBoundingClientRect = rect(REST_TOP);
        foot = Object.assign(Object.create(Chamber.prototype), {
            container: document.getElementById('stage'),
            getSettings: () => ({ bandOffset: -0.5 }),
            onSettingsChange: vi.fn(),
            syncFillGlyphMask: () => {},
            _refreshProgressiveGlass: () => {}
        });
        foot.attachBandMove();
        ctx = foot;
        noted = [];
        window.addEventListener('rise-band-note', record);
    });

    afterEach(() => window.removeEventListener('rise-band-note', record));

    const pointer = (type, clientY, extra = {}) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 195, clientY });
        Object.defineProperties(event, { pointerId: { value: 7 }, pointerType: { value: 'touch' } });
        Object.entries(extra).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
        document.getElementById('atom-display').dispatchEvent(event);
    };
    const offset = () => document.getElementById('chamber-field').style.getPropertyValue('--band-offset');
    const drag = (from, ...to) => {
        pointer('pointerdown', from);
        to.forEach(y => pointer('pointermove', y));
    };

    it('starts at the strip, not at the offset the reader set for a field without a picture', () => {
        expect(offset()).toBe('0px');
    });

    it('rises with the finger as far as the field\'s top edge less 8 px, and no further', () => {
        pointer('pointerdown', 300);
        pointer('pointerup', 300);
        expect(document.getElementById('atom-display').classList.contains('is-band-movable')).toBe(true);
        drag(300, 250, 180);
        expect(offset()).toBe('-120px');
        pointer('pointermove', -400);
        expect(offset()).toBe(`-${REST_TOP - FIELD_TOP - 8}px`);
        pointer('pointerup', -400);
    });

    it('comes back down to the strip and stops there, and is not written over the reader\'s own setting', () => {
        pointer('pointerdown', 300);
        drag(300, 180);
        pointer('pointerup', 180);
        expect(offset()).toBe('-120px');
        drag(180, 400, 900);
        expect(offset()).toBe('0px');
        pointer('pointerup', 900);
        expect(foot.onSettingsChange).not.toHaveBeenCalled();
    });

    it('notes a gesture as press, one move with its total, then release', () => {
        pointer('pointerdown', 300);
        drag(300, 290, 250, 180);
        pointer('pointerup', 180);
        expect(noted.map(note => note.type)).toEqual(['band.press', 'band.press', 'band.move', 'band.release']);
        expect(noted[0]).toMatchObject({ pointerType: 'touch', action: 'select' });
        expect(noted[1]).toMatchObject({ pointerType: 'touch', action: 'grab' });
        expect(noted[2]).toMatchObject({ pointerType: 'touch', dx: 0, dy: -120, offset: '-120px' });
        expect(noted[3]).toMatchObject({ pointerType: 'touch', moved: true });
    });

    it('notes band.cancel when the browser or the app takes the gesture', () => {
        pointer('pointerdown', 300);
        drag(300, 280);
        pointer('pointercancel', 280);
        expect(noted.map(note => note.type)).toEqual(['band.press', 'band.press', 'band.move', 'band.cancel']);
        expect(noted[3]).toMatchObject({ pointerType: 'touch' });
    });

    it('notes a press away from the selected words as a dismissal', () => {
        pointer('pointerdown', 300);
        document.getElementById('chamber-field').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
        expect(noted.map(note => [note.type, note.action])).toEqual([['band.press', 'select'], ['band.press', 'dismiss']]);
    });
});
