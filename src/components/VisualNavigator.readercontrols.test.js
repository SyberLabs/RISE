/**
 * TWO SWITCHES THAT SAY WHAT THEY DO, AND TOGGLE ONCE WHEN PRESSED.
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
 * on top of it.
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
        for (const action of ['living-text', 'glass']) {
            const control = row(action);
            expect(control, `${action} is a row`).toBeTruthy();
            const description = control.querySelector('.vnav-switch-note');
            expect(description, `${action} says what it does`).toBeTruthy();
            expect(description.textContent.trim().length).toBeGreaterThan(20);
        }
    });

    it('keeps a real checkbox under the styled control', () => {
        mount();
        for (const action of ['living-text', 'glass']) {
            const input = nav.container.querySelector(`[data-action="${action}"]`);
            expect(input.tagName).toBe('INPUT');
            expect(input.type).toBe('checkbox');
        }
    });

    it('ties the description to the control for a screen reader', () => {
        mount();
        for (const action of ['living-text', 'glass']) {
            const input = nav.container.querySelector(`[data-action="${action}"]`);
            const describedBy = input.getAttribute('aria-describedby');
            expect(describedBy, `${action} names its description`).toBeTruthy();
            expect(nav.container.querySelector(`#${describedBy}`)).toBeTruthy();
        }
    });

    it('toggles exactly once when the row is pressed', () => {
        mount();
        const before = nav.selection.livingText.enabled;
        // A press on the row, the way a finger lands on it. The label forwards
        // to the input natively; a second handler here would double it.
        row('living-text').click();
        expect(nav.selection.livingText.enabled, 'one press, one change')
            .toBe(!before);
    });

    it('toggles exactly once when the control itself is pressed', () => {
        mount();
        const before = nav.selection.livingText.enabled;
        const input = nav.container.querySelector('[data-action="living-text"]');
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(nav.selection.livingText.enabled).toBe(!before);
    });

    it('says why Glass cannot act, on the row, where a phone can read it', () => {
        // Under a Fit word the switch is inert — a frosted pane behind a word
        // that size is the size of the room. That was a `title` only.
        window.rise = { settings: { chamberFace: 'thick', fontSize: 'fit' } };
        mount();
        const control = row('glass');
        const input = nav.container.querySelector('[data-action="glass"]');
        expect(input.disabled).toBe(true);
        expect(control.textContent).toMatch(/frame|Fit|mask/i);
        delete window.rise;
    });

    it('lights the row it is standing on, and unlights it', () => {
        // The lit state is the row's now, so the class and the control have to
        // agree after every press. setLivingText emitted without rendering,
        // which nothing revealed while the native checkbox was the picture.
        mount();
        for (let press = 0; press < 2; press += 1) {
            row('living-text').click();
            const control = row('living-text');
            const input = nav.container.querySelector('[data-action="living-text"]');
            expect(control.classList.contains('is-on'), `press ${press + 1}`)
                .toBe(input.checked);
            expect(input.checked).toBe(nav.selection.livingText.enabled);
        }
    });

    it('does not change the settings it persists', () => {
        mount();
        row('living-text').click();
        const patch = onChange.mock.calls.at(-1)[0];
        // The keys the Chamber and storage already read. A restyle may not
        // rename what it round-trips.
        expect(patch.livingText).toMatchObject({ enabled: expect.any(Boolean) });
    });
});
