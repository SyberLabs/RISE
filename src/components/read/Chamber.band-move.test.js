import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
        setBandMovable: Chamber.prototype.setBandMovable
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
