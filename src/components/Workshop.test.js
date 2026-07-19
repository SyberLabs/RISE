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
        expect(children[0].classList.contains('workshop-sequence-manager')).toBe(true);
        expect(children[1].id).toBe('workshop-form');
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

    it('exposes saved sequences and a deliberate reset control above the editor', () => {
        const { container } = makeWorkshop();

        const manager = container.querySelector('.workshop-sequence-manager');
        expect(manager.querySelector('#workshop-sequence-select')).not.toBeNull();
        expect(manager.textContent).toContain('Workshop Sequences');
        expect(container.querySelector('[data-action="reset-workshop"]')).not.toBeNull();

        container.remove();
    });
});

describe('Workshop draft lifecycle', () => {
    it('opens Recursion on a clean canvas and keeps prior unsaved work memory-only', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        workshop.sessionData.title = 'Unfinished study';
        workshop.addSource({
            id: 'draft-source',
            name: 'Draft source',
            type: 'text/plain',
            data: 'material still being arranged'
        }, { id: 'local' });

        workshop.update({ draftIntent: 'new-recursion', text: 'what remained after the session' });

        expect(workshop.sessionData.title).toBe('');
        expect(workshop.sessionData.sources).toHaveLength(1);
        expect(workshop.sessionData.sources[0].metadata.source).toBe('chamber-recursion');
        expect(workshop.suspendedDrafts).toHaveLength(1);
        expect(localStorage.getItem('rise_workshop_v1')).toBeNull();

        const draftId = workshop.suspendedDrafts[0].id;
        const picker = container.querySelector('#workshop-sequence-select');
        picker.value = `draft:${draftId}`;
        picker.dispatchEvent(new Event('change', { bubbles: true }));

        expect(workshop.sessionData.title).toBe('Unfinished study');
        expect(workshop.sessionData.sources[0].name).toBe('Draft source');
        expect(workshop.suspendedDrafts.some(draft => draft.data.sources[0]?.metadata?.source === 'chamber-recursion')).toBe(true);

        workshop.destroy();
        container.remove();
    });

    it('clears a saved sequence and reopens it for explicit editing without duplicating it', () => {
        localStorage.removeItem('rise_workshop_v1');
        const { workshop, container } = makeWorkshop();

        workshop.sessionData.title = 'First form';
        workshop.addSource({
            id: 'one',
            name: 'Source one',
            type: 'text/plain',
            data: 'one two three'
        }, { id: 'local' });
        container.querySelector('[data-action="save-draft"]').click();

        const [saved] = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(workshop.sessionData.title).toBe('');
        expect(workshop.sessionData.sources).toHaveLength(0);

        const picker = container.querySelector('#workshop-sequence-select');
        picker.value = `saved:${saved.id}`;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        expect(workshop.sessionData.title).toBe('First form');

        const titleInput = container.querySelector('#session-title');
        titleInput.value = 'Revised form';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        container.querySelector('[data-action="save-draft"]').click();

        const blueprints = JSON.parse(localStorage.getItem('rise_workshop_v1'));
        expect(blueprints).toHaveLength(1);
        expect(blueprints[0].id).toBe(saved.id);
        expect(blueprints[0].title).toBe('Revised form');
        expect(workshop.sessionData.sources).toHaveLength(0);

        workshop.destroy();
        container.remove();
        localStorage.removeItem('rise_workshop_v1');
    });

    it('requires confirmation before Reset discards the active draft', () => {
        const { workshop, container } = makeWorkshop();
        const titleInput = container.querySelector('#session-title');
        titleInput.value = 'Do not discard accidentally';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const reset = container.querySelector('[data-action="reset-workshop"]');
        reset.click();
        expect(workshop.sessionData.title).toBe('Do not discard accidentally');
        expect(reset.textContent).toContain('Confirm Reset');

        reset.click();
        expect(workshop.sessionData.title).toBe('');
        expect(workshop.suspendedDrafts).toHaveLength(0);

        workshop.destroy();
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
