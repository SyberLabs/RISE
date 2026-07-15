/**
 * Workshop refinement tests — craft-first architecture (creator leads,
 * shared shelves follow), the modern Atmosphere with soundscapes, and
 * exclusive-beds behavior matching the Chamber's audio panel.
 */
import { describe, it, expect, vi } from 'vitest';

// jsdom has no indexedDB; PersonalSwells probes it during pool render
if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { Workshop } = await import('./Workshop.js');

function makeWorkshop() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const workshop = new Workshop(container, {
        onNavigate: vi.fn(),
        onCreateSession: vi.fn()
    });
    return { workshop, container };
}

describe('Workshop craft-first architecture', () => {
    it('the Sequence Creator leads; Studio Shelves follow', () => {
        const { workshop, container } = makeWorkshop();

        const content = container.querySelector('.workshop-content');
        const children = [...content.children];
        expect(children[0].id).toBe('workshop-form');
        expect(children[children.length - 1].classList.contains('workshop-shelves')).toBe(true);

        // The shelves hold both shared pools, with explanatory notes
        const shelves = container.querySelector('.workshop-shelves');
        expect(shelves.querySelector('#global-pool-list')).not.toBeNull();
        expect(shelves.querySelector('#personal-swell-list')).not.toBeNull();
        expect(shelves.querySelectorAll('.shelf-note').length).toBe(2);

        container.remove();
    });

    it('sequence images are named and explained as sequence-local', () => {
        const { container } = makeWorkshop();
        const form = container.querySelector('#workshop-form');
        expect(form.textContent).toContain("This Sequence's Images");
        expect(form.textContent).toContain('Travel with this sequence only');
        container.remove();
    });
});

describe('Workshop atmosphere: exclusive beds', () => {
    it('offers soundscapes with None active by default', () => {
        const { workshop, container } = makeWorkshop();
        const chips = container.querySelectorAll('[data-soundscape]');
        expect(chips).toHaveLength(3);
        expect(container.querySelector('[data-soundscape="none"]').classList.contains('active')).toBe(true);
        expect(workshop.sessionData.soundscape).toBe('none');
        container.remove();
    });

    it('a soundscape rests the tones; a tone bed rests the soundscape', () => {
        const { workshop, container } = makeWorkshop();

        container.querySelector('[data-audio-preset="gateway"]').click();
        expect(workshop.sessionData.audioPreset).toBe('gateway');

        container.querySelector('[data-soundscape="aurora"]').click();
        expect(workshop.sessionData.soundscape).toBe('aurora');
        expect(workshop.sessionData.audioPreset).toBe('silent');
        expect(container.querySelector('[data-audio-preset="silent"]').classList.contains('active')).toBe(true);

        container.querySelector('[data-audio-preset="deep"]').click();
        expect(workshop.sessionData.soundscape).toBe('none');
        expect(container.querySelector('[data-soundscape="none"]').classList.contains('active')).toBe(true);

        container.remove();
    });

    it("'Personal' is an entry swell, not a bed — it coexists with a soundscape", () => {
        const { workshop, container } = makeWorkshop();

        container.querySelector('[data-soundscape="faded-signal"]').click();
        container.querySelector('[data-audio-preset="personal"]').click();

        expect(workshop.sessionData.audioPreset).toBe('personal');
        expect(workshop.sessionData.soundscape).toBe('faded-signal');

        container.remove();
    });

    it('the soundscape rides the blueprint into the Vault', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        container.querySelector('[data-soundscape="aurora"]').click();
        workshop.sessionData.title = 'Aurora Session';
        container.querySelector('[data-action="save-draft"]').click();

        const [saved] = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(saved.soundscape).toBe('aurora');

        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });
});
