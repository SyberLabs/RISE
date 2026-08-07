/**
 * The sigil is a control on a pointer and a seal on a phone.
 *
 * It has always meant "return to the last session". On a narrow screen it
 * cannot say so — iOS paints its own ▶ over any video it has not started,
 * so the vessel reads as a play button — and on a cold load it has
 * nothing to return to, because `window.rise.currentSession` lives in
 * memory and does not survive a reload. Every fresh visit therefore fell
 * through to the Vault: a control that looks like playback, does not
 * play, and goes somewhere unannounced.
 *
 * Nothing is lost by standing it down. The Continue strip is the same
 * action with a label and the reading's name on it, and it appears under
 * exactly the condition that makes the sigil meaningful.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Portal } from './Portal.js';

beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

// Portal schedules its sequential fade-in with setTimeout and tracks the
// ids; without destroy() those fire after the environment is torn down.
const built = [];
afterEach(() => {
    built.splice(0).forEach(portal => portal.destroy?.());
    vi.restoreAllMocks();
    delete window.matchMedia;
});

/** jsdom has no matchMedia at all, so each test states the width it means. */
function atWidth(narrow) {
    window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768px') ? narrow : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
    }));
}

function makePortal() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onQuickAccess = vi.fn();
    const portal = new Portal(container, { onNavigate: vi.fn(), onQuickAccess });
    built.push(portal);
    return { portal, container, onQuickAccess };
}

describe('on a phone the sigil is a seal', () => {
    it('renders as a div, not a button', () => {
        atWidth(true);
        const { container } = makePortal();
        const vessel = container.querySelector('.portal-sigil-vessel');
        expect(vessel).not.toBeNull();
        expect(vessel.tagName).toBe('DIV');
        expect(vessel.classList.contains('is-seal')).toBe(true);
    });

    it('is not announced as an action', () => {
        // A `button` with a label is a promise to assistive technology as
        // much as to the eye, and the promise is the thing that is not
        // keepable here.
        atWidth(true);
        const { container } = makePortal();
        const vessel = container.querySelector('.portal-sigil-vessel');
        expect(vessel.getAttribute('aria-hidden')).toBe('true');
        expect(vessel.hasAttribute('aria-label')).toBe(false);
        expect(container.querySelector('button.portal-sigil-vessel')).toBeNull();
    });

    it('does nothing when tapped', () => {
        // THE BUG ITSELF. A tap on what looked like a play control opened
        // the Vault.
        atWidth(true);
        const { container, onQuickAccess } = makePortal();
        container.querySelector('.portal-sigil-vessel').click();
        expect(onQuickAccess).not.toHaveBeenCalled();
    });

    it('still shows the vessel video — it is decoration, not absence', () => {
        atWidth(true);
        const { container } = makePortal();
        expect(container.querySelector('.portal-sigil-vessel .vessel-video')).not.toBeNull();
    });

    it('keeps the Continue strip, which is the labelled way back', () => {
        // The affordance is not removed from the phone, it is moved to the
        // element that can name what it does.
        atWidth(true);
        const { container } = makePortal();
        expect(container.querySelector('.portal-continue')).not.toBeNull();
    });
});

describe('on a pointer the sigil is still the quick way back', () => {
    it('renders as a button that says what it does', () => {
        atWidth(false);
        const { container } = makePortal();
        const vessel = container.querySelector('.portal-sigil-vessel');
        expect(vessel.tagName).toBe('BUTTON');
        expect(vessel.classList.contains('is-seal')).toBe(false);
        expect(vessel.getAttribute('aria-label')).toBe('Quick access to last session');
    });

    it('resumes on click', () => {
        atWidth(false);
        const { container, onQuickAccess } = makePortal();
        container.querySelector('.portal-sigil-vessel').click();
        expect(onQuickAccess).toHaveBeenCalledTimes(1);
    });

    it('falls back to the control where matchMedia does not exist', () => {
        // Any environment that cannot answer the question gets the
        // historical behaviour rather than a silently disabled Portal.
        delete window.matchMedia;
        const { container, onQuickAccess } = makePortal();
        expect(container.querySelector('.portal-sigil-vessel').tagName).toBe('BUTTON');
        container.querySelector('.portal-sigil-vessel').click();
        expect(onQuickAccess).toHaveBeenCalledTimes(1);
    });
});
