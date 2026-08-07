/**
 * Phone: sigil is a seal (div, aria-hidden). Pointer: button that resumes.
 * Continue strip is the labelled resume affordance when a session exists.
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
        // Seal: not announced as an actionable control.
        atWidth(true);
        const { container } = makePortal();
        const vessel = container.querySelector('.portal-sigil-vessel');
        expect(vessel.getAttribute('aria-hidden')).toBe('true');
        expect(vessel.hasAttribute('aria-label')).toBe(false);
        expect(container.querySelector('button.portal-sigil-vessel')).toBeNull();
    });

    it('does nothing when tapped', () => {
        // Seal must not invoke onQuickAccess.
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
        // Resume stays on Continue when the vessel is a seal.
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
        // No matchMedia → keep historical button behaviour.
        delete window.matchMedia;
        const { container, onQuickAccess } = makePortal();
        expect(container.querySelector('.portal-sigil-vessel').tagName).toBe('BUTTON');
        container.querySelector('.portal-sigil-vessel').click();
        expect(onQuickAccess).toHaveBeenCalledTimes(1);
    });
});
