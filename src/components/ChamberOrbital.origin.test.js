/**
 * Origin chip integration tests — launches carrying origin metadata
 * (SOL / Vault / Library) show a wayfinding chip in the orbital view
 * that returns to the originating view; plain sessions show nothing.
 */
import { describe, it, expect, vi } from 'vitest';

// jsdom has no indexedDB; PersonalSwells (unrelated to the chip) probes it
// during orbital init. A never-settling stub keeps the run clean.
if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { ChamberOrbital } = await import('./ChamberOrbital.js');

function makeOrbital() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onNavigate = vi.fn();
    const orbital = new ChamberOrbital(container, {
        onNavigate,
        onBeginSession: () => { }
    });
    return { orbital, container, onNavigate };
}

const SOL_ORIGIN = { view: 'sol', icon: '☀', name: 'SOL' };

describe('ChamberOrbital origin chip', () => {
    it('shows no chip for a plain session', () => {
        const { orbital, container } = makeOrbital();
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.loadText('some text', 'Pasted', {});
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.destroy();
        container.remove();
    });

    it('renders the chip when a launch carries origin metadata', () => {
        const { orbital, container } = makeOrbital();
        orbital.loadText('The body wakes...', 'SOL: Dawn', { origin: SOL_ORIGIN });

        const chip = container.querySelector('.orbital-origin-chip');
        expect(chip).not.toBeNull();
        expect(chip.textContent).toContain('☀');
        expect(chip.textContent).toContain('SOL');
        expect(chip.title).toBe('Return to SOL');

        orbital.destroy();
        container.remove();
    });

    it('clicking the chip navigates back to the originating view', () => {
        const { orbital, container, onNavigate } = makeOrbital();
        orbital.loadText('text', 'SOL: Dawn', { origin: SOL_ORIGIN });

        container.querySelector('.orbital-origin-chip').click();
        expect(onNavigate).toHaveBeenCalledWith('sol');

        orbital.destroy();
        container.remove();
    });

    it('clears the chip when the text is cleared', () => {
        const { orbital, container } = makeOrbital();
        orbital.loadText('text', 'Vault: Researcher', { origin: { view: 'vault', icon: '◈', name: 'Vault' } });
        expect(container.querySelector('.orbital-origin-chip')).not.toBeNull();

        orbital.clearText();
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.destroy();
        container.remove();
    });

    it('handleEscape closes an open modal and consumes the key; falls through otherwise', () => {
        const { orbital, container } = makeOrbital();

        expect(orbital.handleEscape()).toBe(false); // no modal → router may act

        orbital.openModal('visual');
        expect(orbital.activeModal).toBe('visual');
        expect(orbital.handleEscape()).toBe(true);  // consumed: modal closed
        expect(orbital.activeModal).toBeNull();

        orbital.destroy();
        container.remove();
    });

    it('a subsequent plain load replaces a previous origin', () => {
        const { orbital, container } = makeOrbital();
        orbital.loadText('text', 'SOL: Dawn', { origin: SOL_ORIGIN });
        orbital.loadText('other text', 'Pasted', {});
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.destroy();
        container.remove();
    });
});
