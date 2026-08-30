/**
 * Phone: sigil is a seal (div, aria-hidden). Pointer: button that resumes.
 * Continue strip is the labelled resume affordance when a session exists.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

    // A STILL ON A PHONE, BECAUSE THE VIDEO ASKS TO BE PLAYED.
    //
    // iOS paints a play glyph over an unstarted video and Low Power Mode
    // refuses to autoplay at all, which no amount of `playsinline`, `muted`,
    // `autoplay` or hidden -webkit-media-controls can defeat. The vessel is
    // decoration, never a player, so on a phone it is simply a picture.
    it('shows a still vessel rather than a video', () => {
        atWidth(true);
        const { container } = makePortal();
        const still = container.querySelector('.portal-sigil-vessel .vessel-still');
        expect(still, 'the vessel is not empty').not.toBeNull();
        expect(still.tagName).toBe('IMG');
        expect(still.getAttribute('src')).toBe('/rise_mobile_icon.webp');
        // Decoration announces nothing.
        expect(still.getAttribute('alt')).toBe('');
        expect(container.querySelector('.vessel-video'), 'no player on a phone').toBeNull();
    });

    // THE SEAL IS IRIDESCENT, AND THAT IS THE POINT OF IT.
    //
    // The still inherited the video's grayscale(80%) when it was first
    // introduced, which flattened blue-violet-gold to silver. The video is
    // desaturated because it has a hover state to brighten toward; a phone
    // has no hover, so the still has nothing to hold back for. Asserted in
    // the stylesheet because jsdom computes no filter of its own.
    it('shows the seal in colour rather than the video’s silver', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), 'Portal.css'),
            'utf8'
        );
        // The still's OWN rule, not the geometry it shares with the video:
        // the shared selector list names both, so anchor on what only the
        // still declares.
        const still = css.match(/\{[^{}]*-webkit-user-drag[^{}]*\}/)[0];
        expect(still, 'the still declares its own filter').toMatch(/filter:/);
        expect(still, 'and no grayscale in it').not.toMatch(/grayscale/);

        // The moving vessel keeps its silver, which its hover state needs.
        const video = css.match(/\.vessel-video \{[^}]+\}/)[0];
        expect(video).toMatch(/grayscale/);
    });

    it('never fetches the video a phone cannot start', () => {
        atWidth(true);
        const { container } = makePortal();
        // The src is assigned during the reveal; with no video element there
        // is nothing to assign, so the megabytes are never asked for.
        expect(container.innerHTML).not.toContain('real_icon.mp4');
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
        // A pointer keeps the moving vessel: it autoplays there without asking.
        expect(vessel.querySelector('.vessel-video'), 'the video stays on a pointer').not.toBeNull();
        expect(vessel.querySelector('.vessel-still')).toBeNull();
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
