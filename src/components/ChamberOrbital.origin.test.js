/**
 * Origin chip integration tests — launches carrying origin metadata
 * (SOL / Vault / Library) show a wayfinding chip in the orbital view
 * that returns to the originating view; plain sessions show nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom has no indexedDB; PersonalSwells (unrelated to the chip) probes it
// during orbital init. A never-settling stub keeps the run clean.
if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { ChamberOrbital } = await import('./ChamberOrbital.js');

function makeOrbital(onBeginSession = () => { }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onNavigate = vi.fn();
    const orbital = new ChamberOrbital(container, {
        onNavigate,
        onBeginSession
    });
    return { orbital, container, onNavigate };
}

const SOL_ORIGIN = { view: 'sol', icon: '☀', name: 'SOL' };

describe('ChamberOrbital origin chip', () => {
    beforeEach(() => {
        localStorage.removeItem('rise_orbital_prefs_v1');
        localStorage.removeItem('rise_orbital_text_v1');
    });

    it('shows no chip for a plain session', () => {
        const { orbital, container } = makeOrbital();
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.loadText('some text', 'Pasted', {});
        expect(container.querySelector('.orbital-origin-chip')).toBeNull();

        orbital.destroy();
        container.remove();
    });

    it('applies an editorial chunk mode carried by a launch', () => {
        const { orbital, container } = makeOrbital();
        orbital.loadText('SOCRATES: Begin.', 'Atrium', { chunkMode: 'phrase' });

        expect(orbital.config.chunkMode).toBe('phrase');
        expect(container.querySelector('[data-chunk="phrase"]').classList.contains('active')).toBe(true);

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

    it('Reset restores factory defaults and clears prefs, but keeps the loaded text', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');

        const { orbital, container } = makeOrbital();
        orbital.loadText('the text', 'SOL: Dawn', { origin: { view: 'sol', icon: '☀', name: 'SOL' } });
        orbital.config.wpm = 400;
        orbital.config.visualInterlocution.visualMode = 'genesis';
        orbital._persistPrefs();

        container.querySelector('[data-action="reset-prefs"]').click();

        expect(orbital.config.wpm).toBe(200);
        expect(orbital.config.visualInterlocution.visualMode).toBe('off');
        expect(localStorage.getItem('rise_orbital_prefs_v1')).toBeNull();
        // Session context survives — settings amnesia, not session amnesia
        expect(orbital.config.text).toBe('the text');
        expect(orbital.config.origin?.view).toBe('sol');
        expect(container.querySelector('.orbital-origin-chip')).not.toBeNull();

        // A fresh orbital starts from defaults (destroy persists the
        // now-default config, which is equivalent)
        orbital.destroy();
        container.remove();
        const fresh = makeOrbital();
        expect(fresh.orbital.config.wpm).toBe(200);
        expect(fresh.orbital.config.visualInterlocution.visualMode).toBe('off');
        fresh.orbital.destroy();
        fresh.container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
    });

    it('persists settings changed WITHOUT pressing Begin (destroy + panel-change paths)', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');

        // Simulate: ran a Genesis session earlier...
        const earlier = makeOrbital();
        earlier.orbital.config.text = 't';
        earlier.orbital.config.visualInterlocution.visualMode = 'genesis';
        earlier.orbital.beginSession();
        earlier.orbital.destroy();
        earlier.container.remove();

        // ...then switched to Focals but never pressed Begin
        const next = makeOrbital();
        expect(next.orbital.config.visualInterlocution.visualMode).toBe('genesis');
        next.orbital.config.visualInterlocution.visualMode = 'focals';
        next.orbital.destroy(); // navigating away / session start destroys the instance
        next.container.remove();

        const restored = makeOrbital();
        expect(restored.orbital.config.visualInterlocution.visualMode).toBe('focals');

        // And a hard refresh (beforeunload) also captures un-begun changes
        restored.orbital.config.visualInterlocution.visualMode = 'attractor';
        window.dispatchEvent(new Event('beforeunload'));
        const afterRefresh = makeOrbital();
        expect(afterRefresh.orbital.config.visualInterlocution.visualMode).toBe('attractor');

        restored.orbital.destroy();
        restored.container.remove();
        afterRefresh.orbital.destroy();
        afterRefresh.container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
    });

    it('replaces stale painting categories when a procedural preset is loaded', () => {
        const { orbital, container } = makeOrbital();
        orbital.config.visualInterlocution.interlocution = {
            ...orbital.config.visualInterlocution.interlocution,
            sourceFamily: 'collections',
            procedural: [],
            sourced: ['aic-oldmasters']
        };

        orbital.loadText('procedural text', 'Vault: Procedural', {
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: { procedural: ['klee'] }
            }
        });

        expect(orbital.config.visualInterlocution.interlocution).toMatchObject({
            sourceFamily: 'procedural',
            procedural: ['klee'],
            sourced: []
        });

        let payload = null;
        orbital.onBeginSession = data => { payload = data; };
        orbital.beginSession();
        expect(payload.visualConfig.interlocution).toMatchObject({
            sourceFamily: 'procedural',
            procedural: ['klee'],
            sourced: []
        });
        expect(payload.visualConfig.consentScope).toBe(orbital.visualConsentScope);

        orbital.destroy();
        container.remove();
    });

    it('infers Blend when restoring an intentional mixed legacy preference', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    procedural: ['harmonograph'],
                    sourced: ['solar']
                }
            }
        }));

        const { orbital, container } = makeOrbital();
        expect(orbital.config.visualInterlocution.interlocution).toMatchObject({
            sourceFamily: 'blend',
            procedural: ['harmonograph'],
            sourced: ['solar']
        });

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
        // The loaded text persists too (its own key) — saved settings
        // must never be stranded behind an empty text card on refresh
        expect(second.orbital.config.text).toBe('some text');

        second.orbital.destroy();
        second.container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
    });

    it('chant beds are Chapel-exclusive: revealed by chapel provenance, sanitized without it', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');
        localStorage.removeItem('rise_orbital_text_v1');

        // A plain session: chant chips hidden
        const { orbital, container } = makeOrbital();
        expect(container.querySelector('[data-soundscape="chant-gregorian"]').hidden).toBe(true);

        // A Chapel launch reveals them and keeps its chant default
        orbital.loadText('[v 1:1] In the beginning…', 'The Chapel · Genesis', {
            soundscape: 'chant-gregorian',
            provenance: { kind: 'chapel-book', bookId: 'genesis' }
        });
        expect(container.querySelector('[data-soundscape="chant-gregorian"]').hidden).toBe(false);
        expect(orbital.config.soundscape).toBe('chant-gregorian');

        // A refresh mid-Chapel restores the chapel session — chant
        // rightly stays available (the restored session IS a Chapel one)
        const { orbital: restored, container: restoredC } = makeOrbital();
        expect(restored.isChapelSession()).toBe(true);
        expect(restoredC.querySelector('[data-soundscape="chant-gregorian"]').hidden).toBe(false);

        // But a NEW plain session (chapel text gone) with a stale chant
        // preference falls back to silence rather than chanting over
        // arbitrary text
        localStorage.removeItem('rise_orbital_text_v1');
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true, soundscape: 'chant-znamenny'
        }));
        const { orbital: plain, container: plainC } = makeOrbital();
        expect(plain.config.soundscape).toBe('none');
        expect(plainC.querySelector('[data-soundscape="chant-znamenny"]').hidden).toBe(true);
    });

    it('soundscape: renders on top of the audio panel, persists, resets', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');

        const { orbital, container } = makeOrbital();

        // Section renders with None active by default
        const chips = container.querySelectorAll('[data-soundscape]');
        // None, Aurora, Faded Signal + the two chant beds
        expect(chips).toHaveLength(5);
        expect(container.querySelector('[data-soundscape="none"]').classList.contains('active')).toBe(true);

        // Selecting Aurora updates config and the orbit status
        container.querySelector('[data-soundscape="aurora"]').click();
        expect(orbital.config.soundscape).toBe('aurora');
        expect(orbital.getAudioStatus()).toBe('✧ Aurora');

        // Exclusive beds: picking a pure tone rests the soundscape…
        container.querySelector('[data-audio-preset="deep"]').click();
        expect(orbital.config.soundscape).toBe('none');
        expect(orbital.getAudioStatus()).toBe('○ Deep');
        expect(container.querySelector('[data-soundscape="none"]').classList.contains('active')).toBe(true);

        // …and picking the soundscape back rests the tones
        container.querySelector('[data-soundscape="aurora"]').click();
        expect(orbital.config.audioPreset).toBe('silent');
        expect(orbital.getAudioStatus()).toBe('✧ Aurora');
        expect(container.querySelector('[data-audio-preset="silent"]').classList.contains('active')).toBe(true);

        // Begin payload carries it
        orbital.config.text = 't';
        let payload = null;
        orbital.onBeginSession = (data) => { payload = data; };
        orbital.beginSession();
        expect(payload.soundscape).toBe('aurora');

        // Persists across instances
        orbital.destroy();
        container.remove();
        const restored = makeOrbital();
        expect(restored.orbital.config.soundscape).toBe('aurora');

        // Reset restores 'none'
        restored.container.querySelector('[data-action="reset-prefs"]').click();
        expect(restored.orbital.config.soundscape).toBe('none');

        restored.orbital.destroy();
        restored.container.remove();

        // Stale saved shapes holding both beds resolve for the soundscape
        localStorage.setItem('rise_orbital_prefs_v1',
            JSON.stringify({ soundscape: 'aurora', audioPreset: 'gateway' }));
        const norm = makeOrbital();
        expect(norm.orbital.config.soundscape).toBe('aurora');
        expect(norm.orbital.config.audioPreset).toBe('silent');
        norm.orbital.destroy();
        norm.container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
    });

    it('prefs survive a focal image too large for storage (quota shed)', () => {
        localStorage.removeItem('rise_orbital_prefs_v1');

        const { orbital, container } = makeOrbital();
        orbital.config.wpm = 275;
        // Larger than the whole localStorage quota — the raw payload
        // cannot be stored, so persistence must shed the image only
        orbital.config.visualInterlocution.focals.personalImage = 'x'.repeat(6 * 1024 * 1024);
        orbital._persistPrefs();

        const saved = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'));
        expect(saved).not.toBeNull();
        expect(saved.wpm).toBe(275);
        expect(saved.visualInterlocution.focals.personalImage).toBeNull();

        orbital.destroy();
        container.remove();
        localStorage.removeItem('rise_orbital_prefs_v1');
    });

    it('keeps Klee preset chips from overwriting the selected audio preset after restore', () => {
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: 'restored session text',
            textSource: 'Restored',
            origin: null
        }));
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            audioPreset: 'silent',
            soundscape: 'none',
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: [],
                    kleePreset: 'random'
                }
            }
        }));

        const { orbital, container } = makeOrbital();
        container.querySelector('[data-audio-preset="focus"]').click();
        expect(orbital.config.audioPreset).toBe('focus');

        // Visual chips deliberately retain their own data-preset contract.
        // They must never be observed by the audio settings handler.
        container.querySelector('[data-preset="harmonic"]').click();
        expect(orbital.config.audioPreset).toBe('focus');

        let payload = null;
        orbital.onBeginSession = data => { payload = data; };
        orbital.beginSession();
        expect(payload.audioPreset).toBe('focus');

        orbital.destroy();
        container.remove();
    });

    it('repairs an audio preset previously corrupted by a visual chip', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            audioPreset: 'harmonic',
            soundscape: 'none'
        }));

        const { orbital, container } = makeOrbital();
        expect(orbital.config.audioPreset).toBe('silent');
        expect(container.querySelector('[data-audio-preset="silent"]')
            .classList.contains('active')).toBe(true);

        orbital.destroy();
        container.remove();
        expect(JSON.parse(localStorage.getItem('rise_orbital_prefs_v1')).audioPreset)
            .toBe('silent');
    });

    it('migrates and persists legacy visual presence at the saved-preference boundary', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'procedural',
                    procedural: ['klee'],
                    sourced: [],
                    duration: 80
                }
            }
        }));

        const { orbital, container } = makeOrbital();
        expect(orbital.config.visualInterlocution.interlocution.duration).toBe(150);
        orbital._persistPrefs();
        expect(JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'))
            .visualInterlocution.interlocution.duration).toBe(150);

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

    it('the loaded text survives a refresh, with source and origin chip', () => {
        const a = makeOrbital();
        a.orbital.loadText('the persistent text', 'SOL: Dawn', { origin: SOL_ORIGIN });
        a.orbital.destroy();
        a.container.remove();

        const b = makeOrbital();
        expect(b.orbital.config.text).toBe('the persistent text');
        expect(b.orbital.config.textSource).toBe('SOL: Dawn');
        expect(b.orbital.config.origin?.view).toBe('sol');
        expect(b.container.querySelector('.orbital-origin-chip')).not.toBeNull();

        // Clearing the card clears the persistence with it
        b.orbital.clearText();
        b.orbital.destroy();
        b.container.remove();
        const c = makeOrbital();
        expect(c.orbital.config.text).toBeNull();
        expect(localStorage.getItem('rise_orbital_text_v1')).toBeNull();
        c.orbital.destroy();
        c.container.remove();
    });

    it('retains Atrium passage boundaries and provenance through refresh and Begin', () => {
        const sources = [{
            id: 'pass-fixture',
            name: 'Test Author, Test Edition — Test passage',
            type: 'text',
            data: 'A verified packaged passage.',
            provenance: { sourceId: 'src-fixture', canonicalLocator: 'section 1' }
        }];
        const origin = {
            view: 'atrium',
            icon: '⌘',
            name: 'Atrium',
            data: { domain: 'philosophy', selectedId: 'ph-fixture' }
        };
        const provenance = { kind: 'atrium-journey', journeyId: 'seq-fixture' };

        const a = makeOrbital();
        a.orbital.loadText(sources[0].data, 'Atrium · The Tested Life', { sources, origin, provenance });
        const stored = JSON.parse(localStorage.getItem('rise_orbital_text_v1'));
        expect(stored.text).toBeNull();
        expect(stored.sources).toHaveLength(1);
        a.orbital.destroy();
        a.container.remove();

        const onBeginSession = vi.fn();
        const b = makeOrbital(onBeginSession);
        expect(b.orbital.config.text).toBe(sources[0].data);
        expect(b.orbital.config.sources[0].id).toBe('pass-fixture');

        b.container.querySelector('.orbital-origin-chip').click();
        expect(b.onNavigate).toHaveBeenCalledWith('atrium', origin.data);
        b.orbital.beginSession();
        expect(onBeginSession).toHaveBeenCalledWith(expect.objectContaining({
            sources: expect.arrayContaining([expect.objectContaining({ id: 'pass-fixture' })]),
            origin,
            provenance
        }));

        b.orbital.destroy();
        b.container.remove();
    });
});
