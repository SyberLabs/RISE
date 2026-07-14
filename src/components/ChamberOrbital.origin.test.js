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

    it('persists last-used settings at Begin and restores them for the next visit', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');

        const first = makeOrbital();
        first.orbital.config.text = 'some text';
        first.orbital.config.wpm = 333;
        first.orbital.config.audioPreset = 'deep';
        first.orbital.config.visualInterlocution.visualMode = 'genesis';
        first.orbital.config.visualInterlocution.genesis = { preset: 'harmonic', glass: false };
        first.orbital.beginSession();
        first.orbital.destroy();
        first.container.remove();

        // A fresh orbital (the instance is destroyed whenever a session runs)
        const second = makeOrbital();
        expect(second.orbital.config.wpm).toBe(333);
        expect(second.orbital.config.audioPreset).toBe('deep');
        expect(second.orbital.config.visualInterlocution.visualMode).toBe('genesis');
        expect(second.orbital.config.visualInterlocution.genesis.preset).toBe('harmonic');
        expect(second.orbital.config.visualInterlocution.genesis.glass).toBe(false);
        // Text and origin are never persisted
        expect(second.orbital.config.text).toBeNull();
        expect(second.orbital.config.origin).toBeNull();

        second.orbital.destroy();
        second.container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
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
