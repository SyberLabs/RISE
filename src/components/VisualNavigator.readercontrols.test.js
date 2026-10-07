/**
 * A SWITCH THAT SAYS WHAT IT DOES, AND TOGGLES ONCE WHEN PRESSED.
 *
 * Living Text and Glass were bare checkboxes at 0.7rem with a word beside
 * them. They communicated a boolean and nothing else: not what the setting
 * does, not why a reader might want it, and — for Glass — the only
 * explanation of why it was disabled lived in a `title`, which a phone can
 * never show.
 *
 * The row is the control. That is the trap this guards: a label wrapping an
 * input already forwards a click, so ADDING a row handler is how the same
 * press becomes two toggles. The native path is kept and nothing is layered
 * on top of it. Living Text has since moved to Settings, for every reading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';

let nav = null;
let onChange = null;

const mount = (options = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    onChange = vi.fn();
    nav = new VisualNavigator(container, {
        visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous' } },
        onChange,
        ...options
    });
    return nav;
};

const row = (action) => nav.container
    .querySelector(`[data-action="${action}"]`)
    ?.closest('.vnav-switch');

afterEach(() => {
    nav?.destroy();
    nav?.container.remove();
    nav = null;
    vi.restoreAllMocks();
});

describe('the reader controls are finished controls', () => {
    it('explains each setting on the row, not in a tooltip', () => {
        mount();
        for (const action of ['glass']) {
            const control = row(action);
            expect(control, `${action} is a row`).toBeTruthy();
            const description = control.querySelector('.vnav-switch-note');
            expect(description, `${action} says what it does`).toBeTruthy();
            expect(description.textContent.trim().length).toBeGreaterThan(20);
        }
    });

    it('keeps a real checkbox under the styled control', () => {
        mount();
        for (const action of ['glass']) {
            const input = nav.container.querySelector(`[data-action="${action}"]`);
            expect(input.tagName).toBe('INPUT');
            expect(input.type).toBe('checkbox');
        }
    });

    it('ties the description to the control for a screen reader', () => {
        mount();
        for (const action of ['glass']) {
            const input = nav.container.querySelector(`[data-action="${action}"]`);
            const describedBy = input.getAttribute('aria-describedby');
            expect(describedBy, `${action} names its description`).toBeTruthy();
            expect(nav.container.querySelector(`#${describedBy}`)).toBeTruthy();
        }
    });

    it('toggles exactly once when the row is pressed', () => {
        mount();
        const before = nav.glassOn();
        // A press on the row, the way a finger lands on it. The label forwards
        // to the input natively; a second handler here would double it.
        row('glass').click();
        expect(nav.glassOn(), 'one press, one change').toBe(!before);
    });

    it('toggles exactly once when the control itself is pressed', () => {
        mount();
        const before = nav.glassOn();
        const input = nav.container.querySelector('[data-action="glass"]');
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(nav.glassOn()).toBe(!before);
    });

    it('says why Glass cannot act, on the row, where a phone can read it', () => {
        // Under a Fit word the switch is inert — a frosted pane behind a word
        // that size is the size of the room. That was a `title` only.
        mount({ getSettings: () => ({ chamberFace: 'thick', fontSize: 'fit' }) });
        const control = row('glass');
        const input = nav.container.querySelector('[data-action="glass"]');
        expect(input.disabled).toBe(true);
        expect(control.textContent).toMatch(/frame|Fit|mask/i);
    });

    it('lights the row it is standing on, and unlights it', () => {
        // The lit state is the row's now, so the class and the control have to
        // agree after every press.
        mount();
        for (let press = 0; press < 2; press += 1) {
            row('glass').click();
            const control = row('glass');
            const input = nav.container.querySelector('[data-action="glass"]');
            expect(control.classList.contains('is-on'), `press ${press + 1}`)
                .toBe(input.checked);
            expect(input.checked).toBe(nav.glassOn());
        }
    });

    it('offers no Living Text switch: it is the reader’s Setting, for every reading', () => {
        mount();
        expect(nav.container.querySelector('[data-action="living-text"]')).toBeNull();
        expect(nav.container.textContent).not.toMatch(/Living Text/u);
    });
});
