/**
 * Origin chip integration tests — launches carrying origin metadata
 * (SOL / Vault / Library) show a wayfinding chip in the orbital view
 * that returns to the originating view; plain sessions show nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileSession } from '../core/session-compiler.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import { chapelSensoryConfig } from '../content/chapel/handoff.js';

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
        orbital.loadText('SOCRATES: Begin.', 'Pasted', { chunkMode: 'phrase' });

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

    it('a reconstructed Orbital on the shared Chamber container owns the click exclusively', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const staleNavigate = vi.fn();
        const first = new ChamberOrbital(container, { onNavigate: staleNavigate });
        first.loadText('Library text', 'Library', {
            origin: { view: 'library', icon: '◇', name: 'Library' }
        });
        first.destroy();

        const currentNavigate = vi.fn();
        const second = new ChamberOrbital(container, { onNavigate: currentNavigate });
        second.loadText('Scripture', 'The Chapel · Numbers 2', {
            origin: { view: 'chapel', icon: '✛', name: 'Chapel' }
        });
        container.querySelector('.orbital-origin-chip').click();

        expect(staleNavigate).not.toHaveBeenCalled();
        expect(currentNavigate).toHaveBeenCalledTimes(1);
        expect(currentNavigate).toHaveBeenCalledWith('chapel');

        second.destroy();
        container.remove();
    });

    it('full settings re-renders replace rather than multiply delegated navigation', () => {
        const { orbital, container, onNavigate } = makeOrbital();
        orbital.loadText('Scripture', 'The Chapel · Numbers 2', {
            origin: { view: 'chapel', icon: '✛', name: 'Chapel' }
        });
        orbital.resetPrefs();
        orbital.resetPrefs();
        container.querySelector('.orbital-origin-chip').click();

        expect(onNavigate).toHaveBeenCalledTimes(1);
        expect(onNavigate).toHaveBeenCalledWith('chapel');
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

    it('normalizes and persists Gallery cadence independently from flash settings', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    presentation: 'continuous',
                    galleryCadence: 4,
                    frequency: 0.37,
                    duration: 700
                }
            }
        }));

        const { orbital, container } = makeOrbital();
        const config = orbital.config.visualInterlocution.interlocution;
        expect(config.galleryCadence).toBe(1);
        expect(config.frequency).toBe(0.37);
        expect(config.duration).toBe(700);

        orbital._persistPrefs();
        const saved = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'))
            .visualInterlocution.interlocution;
        expect(saved.galleryCadence).toBe(1);
        expect(saved.frequency).toBe(0.37);
        expect(saved.duration).toBe(700);

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

    it('retains Chapel passage boundaries and provenance through refresh and Begin', () => {
        const sources = [{
            id: 'pass-fixture',
            name: 'Test Author, Test Edition — Test passage',
            type: 'text',
            data: 'A verified packaged passage.',
            provenance: { sourceId: 'src-fixture', canonicalLocator: 'section 1' }
        }];
        const origin = {
            view: 'chapel',
            icon: '✛',
            name: 'Chapel',
            data: { bookId: 'numbers', chapter: 2 }
        };
        const provenance = { kind: 'chapel-book', bookId: 'numbers', chapter: 2 };

        const a = makeOrbital();
        a.orbital.loadText(sources[0].data, 'The Chapel · Numbers 2', { sources, origin, provenance });
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
        expect(b.onNavigate).toHaveBeenCalledWith('chapel', origin.data);
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

describe('reading-owned visual program persistence', () => {
    beforeEach(() => {
        localStorage.removeItem('rise_orbital_prefs_v1');
        localStorage.removeItem('rise_orbital_text_v1');
    });

    const visualProgram = {
        coordinateSpace: 'scripture',
        enabled: true,
        segments: [
            {
                id: 'before-pilate',
                match: { chapter: 27, verseStart: 1, verseEnd: 25 },
                cue: { kind: 'sourced', collections: ['chapel-gospel-before-pilate'] }
            },
            {
                id: 'entombment',
                match: { chapter: 27, verseStart: 57, verseEnd: Infinity },
                cue: { kind: 'sourced', collections: ['chapel-gospel-entombment'] }
            }
        ],
        fallback: { kind: 'still' }
    };

    it('survives Orbital reconstruction and reaches the second Begin payload', () => {
        const first = makeOrbital();
        first.orbital.loadText('[v 27:1] And when morning was come...', 'The Chapel · Matthew 27', {
            provenance: { kind: 'chapel-book', bookId: 'matthew', chapter: 27 },
            visualProgram
        });

        const stored = JSON.parse(localStorage.getItem('rise_orbital_text_v1'));
        expect(stored.visualProgram.segments[1].match.verseEnd).not.toBeNull();
        first.orbital.destroy();
        first.container.remove();

        const onBeginSession = vi.fn();
        const second = makeOrbital(onBeginSession);
        expect(second.orbital.config.visualProgram.segments[1].match.verseEnd).toBe(Infinity);
        second.orbital.beginSession();
        expect(onBeginSession).toHaveBeenCalledWith(expect.objectContaining({
            visualProgram: expect.objectContaining({
                coordinateSpace: 'scripture',
                segments: expect.arrayContaining([
                    expect.objectContaining({ id: 'before-pilate' }),
                    expect.objectContaining({ id: 'entombment' })
                ])
            })
        }));
        second.orbital.destroy();
        second.container.remove();
    });

    it('survives settings reset but is removed with its reading', () => {
        const first = makeOrbital();
        first.orbital.loadText('[v 27:1] Reading', 'The Chapel · Matthew 27', { visualProgram });
        first.orbital.resetPrefs();
        expect(first.orbital.config.visualProgram.segments[0].id).toBe('before-pilate');
        first.orbital.clearText();
        first.orbital.destroy();
        first.container.remove();

        const second = makeOrbital();
        expect(second.orbital.config.text).toBeNull();
        expect(second.orbital.config.visualProgram).toBeNull();
        second.orbital.destroy();
        second.container.remove();
    });

    it('repairs a pre-program persisted Gospel reading before Gallery begins', () => {
        // This is the deployed failure captured in the live console: the
        // reader entered Chamber directly from Portal, restoring Matthew 27
        // from a record written before visualProgram persistence existed.
        // Its first sourced preference survived, but no schedule could advance.
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true,
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    presentation: 'continuous',
                    procedural: [],
                    sourced: ['chapel-gospel-before-pilate']
                }
            }
        }));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: '[v 27:1] And when morning was come.\n\n[v 27:26] Then he released Barabbas.',
            textSource: 'The Chapel · Matthew 27',
            origin: {
                view: 'chapel',
                icon: '✛',
                name: 'Chapel',
                data: { bookId: 'matthew', chapter: 27 }
            },
            provenance: { kind: 'chapel-book', bookId: 'matthew', chapter: 27 }
            // Deliberately no visualProgram: legacy deployed record.
        }));

        const onBeginSession = vi.fn();
        const restored = makeOrbital(onBeginSession);
        expect(restored.orbital.config.visualProgram).toMatchObject({
            coordinateSpace: 'scripture',
            enabled: true,
            segments: expect.arrayContaining([
                expect.objectContaining({ id: 'before-pilate' }),
                expect.objectContaining({ id: 'flagellation' }),
                expect.objectContaining({ id: 'crowning-ecce-homo' })
            ])
        });

        restored.orbital.beginSession();
        expect(onBeginSession).toHaveBeenCalledWith(expect.objectContaining({
            visualProgram: expect.objectContaining({
                segments: expect.arrayContaining([
                    expect.objectContaining({ id: 'flagellation' })
                ])
            })
        }));
        const beginPayload = onBeginSession.mock.calls[0][0];
        const compiled = compileSession({
            ...beginPayload,
            title: beginPayload.source
        });
        const activated = [];
        const schedule = new VisualScheduleController(
            compiled.visualProgram,
            cue => activated.push(cue.collections?.[0] || cue.kind)
        );
        compiled.atoms.forEach(atom => schedule.observe(atom));
        expect(activated).toEqual([
            'chapel-gospel-before-pilate',
            'chapel-gospel-flagellation'
        ]);
        // Recovery is a one-time migration, not an in-memory workaround.
        expect(JSON.parse(localStorage.getItem('rise_orbital_text_v1')).visualProgram)
            .toBeDefined();

        restored.orbital.destroy();
        restored.container.remove();
    });
});

describe('ordinary reading visual identity persistence', () => {
    beforeEach(() => {
        localStorage.removeItem('rise_orbital_prefs_v1');
        localStorage.removeItem('rise_orbital_text_v1');
    });

    const chapelLaunch = (bookId, chapter) => ({
        ...chapelSensoryConfig(bookId, null, chapter),
        provenance: { kind: 'chapel-book', bookId, chapter },
        origin: {
            view: 'chapel',
            icon: '✛',
            name: 'Chapel',
            data: { bookId, chapter }
        }
    });

    it('restores Numbers 2 Doré as one reading-owned UI and runtime identity', () => {
        const first = makeOrbital();
        first.orbital.loadText(
            '[v 2:1] And the Lord spoke to Moses and Aaron, saying:',
            'The Chapel · Numbers 2',
            chapelLaunch('numbers', 2)
        );
        expect(first.orbital.config.readingVisualIdentity).toEqual({
            version: 1,
            domain: 'chapel',
            collections: ['dore:numbers']
        });
        first.orbital.destroy();
        first.container.remove();

        const onBeginSession = vi.fn();
        const restored = makeOrbital(onBeginSession);
        expect(restored.orbital.config.visualProgram).toBeNull();
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced)
            .toEqual(['dore:numbers']);
        expect(restored.orbital.config.visualInterlocution.interlocution.atriumCollections)
            .toEqual(['dore:numbers']);
        expect(restored.container.querySelector('[data-chapel-remove="dore:numbers"]'))
            .not.toBeNull();

        restored.orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0].visualConfig.interlocution.sourced)
            .toEqual(['dore:numbers']);
        restored.orbital.destroy();
        restored.container.remove();
    });

    it('migrates an already-deployed Numbers record only from its exact active assignment', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true,
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    procedural: [],
                    sourced: ['dore:numbers']
                }
            }
        }));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: '[v 2:1] The camp of Israel.',
            textSource: 'The Chapel · Numbers 2',
            provenance: { kind: 'chapel-book', bookId: 'numbers', chapter: 2 },
            origin: {
                view: 'chapel',
                data: { bookId: 'numbers', chapter: 2 }
            }
        }));

        const restored = makeOrbital();
        expect(restored.orbital.config.readingVisualIdentity?.collections)
            .toEqual(['dore:numbers']);
        expect(restored.container.querySelector('[data-chapel-remove="dore:numbers"]'))
            .not.toBeNull();
        expect(JSON.parse(localStorage.getItem('rise_orbital_text_v1')).readingVisualIdentity)
            .toEqual({
                version: 1,
                domain: 'chapel',
                collections: ['dore:numbers']
            });
        restored.orbital.destroy();
        restored.container.remove();
    });

    it('does not convert a stale broad Chapel category into Numbers imagery', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true,
            visualInterlocution: {
                visualMode: 'interlocution',
                interlocution: {
                    procedural: [],
                    sourced: ['chapel-passion']
                }
            }
        }));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: '[v 2:1] The camp of Israel.',
            textSource: 'The Chapel · Numbers 2',
            provenance: { kind: 'chapel-book', bookId: 'numbers', chapter: 2 }
        }));

        const restored = makeOrbital();
        expect(restored.orbital.config.visualProgram).toBeNull();
        expect(restored.orbital.config.readingVisualIdentity?.collections).toEqual([]);
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced).toEqual([]);
        expect(restored.container.querySelector('[data-chapel-remove]')).toBeNull();
        restored.orbital.destroy();
        restored.container.remove();
    });

    it('persists removal of Doré with the reading and keeps the Chapel tray available', () => {
        const first = makeOrbital();
        first.orbital.loadText(
            '[v 2:1] The camp of Israel.',
            'The Chapel · Numbers 2',
            chapelLaunch('numbers', 2)
        );
        first.container.querySelector('[data-chapel-remove="dore:numbers"]').click();
        expect(first.orbital.config.readingVisualIdentity?.collections).toEqual([]);
        first.orbital.destroy();
        first.container.remove();

        const onBeginSession = vi.fn();
        const restored = makeOrbital(onBeginSession);
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced).toEqual([]);
        expect(restored.container.querySelector('.vi-chapel-collections')).not.toBeNull();
        expect(restored.container.querySelector('[data-chapel-remove]')).toBeNull();
        expect(restored.container.querySelector('[data-action="chapel-add-toggle"]'))
            .not.toBeNull();
        restored.orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0].visualConfig.interlocution.sourced).toEqual([]);
        restored.orbital.destroy();
        restored.container.remove();
    });

    it('persists source replacement before refresh so Doré cannot pair with plain text', () => {
        const first = makeOrbital();
        first.orbital.loadText(
            '[v 2:1] The camp of Israel.',
            'The Chapel · Numbers 2',
            chapelLaunch('numbers', 2)
        );
        first.orbital.loadText('Plain prose.', 'Pasted', {});
        first.orbital.destroy();
        first.container.remove();

        const restored = makeOrbital();
        expect(restored.orbital.config.text).toBe('Plain prose.');
        expect(restored.orbital.config.readingVisualIdentity).toBeNull();
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced).toEqual([]);
        expect(restored.container.querySelector('.vi-chapel-collections')).toBeNull();
        restored.orbital.destroy();
        restored.container.remove();
    });

    it('keeps Matthew 27 under pericope authority without restoring broad collections', () => {
        const first = makeOrbital();
        first.orbital.loadText(
            '[v 27:1] And when morning was come.',
            'The Chapel · Matthew 27',
            chapelLaunch('matthew', 27)
        );
        const stored = JSON.parse(localStorage.getItem('rise_orbital_text_v1'));
        expect(stored.visualProgram).toBeTruthy();
        expect(stored.readingVisualIdentity).toBeNull();
        first.orbital.destroy();
        first.container.remove();

        const restored = makeOrbital();
        expect(restored.orbital.config.visualProgram?.segments?.length).toBeGreaterThan(1);
        expect(restored.orbital.config.readingVisualIdentity).toBeNull();
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced)
            .toEqual(['chapel-gospel-before-pilate']);
        expect(restored.orbital.config.visualInterlocution.interlocution.sourced)
            .not.toContain('chapel-passion');
        expect(restored.container.querySelector('.vi-program-active')).not.toBeNull();
        expect(restored.container.querySelector('.vi-chapel-collections')).toBeNull();
        restored.orbital.destroy();
        restored.container.remove();
    });
});

describe('Launch-scoped identity is not persisted as reusable preferences', () => {
    it('atriumCollections never enters the persisted prefs', () => {
        const { orbital } = makeOrbital();
        orbital.config.visualInterlocution.interlocution.atriumCollections = ['chapel-passion'];
        orbital._persistPrefs();
        const saved = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'));
        const inter = saved.visualInterlocution?.interlocution || {};
        expect('atriumCollections' in inter).toBe(false);
        orbital.destroy();
    });
});

describe('clearText resets launch-scoped visual identity (2026-07 Doré leak)', () => {
    const launchWith = (orbital, collection) => {
        orbital.loadText('text', 'Source', {
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: {
                    sourced: [collection], procedural: [],
                    atriumCollections: [collection], frequency: 0.2, duration: 1600
                }
            }
        });
    };

    // Every "From this reading" pill family must die with its text —
    // Doré cycle, engineering blueprints, and colonial-freedom plates
    // all leaked through clear-text before this fix.
    for (const collection of ['dore:numbers', 'blueprint:beam-engine', 'freedom:haiti-france', 'chapel-passion']) {
        it(`clears a ${collection.split(':')[0]} pill on clear-text`, () => {
            const { orbital } = makeOrbital();
            launchWith(orbital, collection);
            expect(orbital.config.visualInterlocution.interlocution.atriumCollections)
                .toContain(collection);
            orbital.clearText();
            expect(orbital.config.visualInterlocution.interlocution.atriumCollections).toEqual([]);
            expect(orbital.config.visualInterlocution.interlocution.sourced).toEqual([]);
            expect(orbital.viPanel._chapelLaunch).toBe(false);
            orbital.destroy();
        });
    }

    it('loading a plain source after a launch clears the prior pills', () => {
        const { orbital } = makeOrbital();
        launchWith(orbital, 'dore:numbers');
        // a plain library text carries no visual selection
        orbital.loadText('Plain prose.', 'Plain', {});
        expect(orbital.config.visualInterlocution.interlocution.atriumCollections).toEqual([]);
        expect(orbital.config.visualInterlocution.interlocution.sourced).toEqual([]);
        expect(orbital.config.visualProgram).toBeNull();
        orbital.destroy();
    });

    // The Chapel-HELD focal (an Icon, or the per-book Rosa Mystica) is
    // launch-scoped exactly like the pills: it must not outlive the reading
    // that seeded it. Before this fix, "✛ The Transfiguration · Held from
    // the Chapel" stranded in the panel after the Chapel reading was gone,
    // because a plain text carries no visualConfig and so never overwrote
    // focals (2026-07).
    const launchChapelIcon = (orbital, iconId) => {
        orbital.loadText('Chapel text', 'The Chapel · Matthew 17', {
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'icon', iconId }
            }
        });
    };

    it('releases a Chapel-held Icon focal on clear-text', () => {
        const { orbital } = makeOrbital();
        launchChapelIcon(orbital, 'icon-transfiguration');
        expect(orbital.config.visualInterlocution.focals.type).toBe('icon');
        orbital.clearText();
        expect(orbital.config.visualInterlocution.focals.type).toBe('standard');
        expect(orbital.config.visualInterlocution.focals.iconId).toBeNull();
        orbital.destroy();
    });

    it('releases a Chapel-held Icon focal when a plain text is loaded next', () => {
        const { orbital } = makeOrbital();
        launchChapelIcon(orbital, 'icon-transfiguration');
        // a plain library text carries no visualConfig — the icon must not
        // survive into it
        orbital.loadText('Plain prose.', 'Plain', {});
        expect(orbital.config.visualInterlocution.focals.type).toBe('standard');
        expect(orbital.config.visualInterlocution.focals.iconId).toBeNull();
        orbital.destroy();
    });

    it('releases a per-book Rosa Mystica focal on clear-text', () => {
        const { orbital } = makeOrbital();
        orbital.loadText('Chapel text', 'The Chapel · Psalm 23', {
            visualConfig: { visualMode: 'focals', focals: { type: 'rose', roseMode: 'vitrum' } }
        });
        expect(orbital.config.visualInterlocution.focals.type).toBe('rose');
        orbital.clearText();
        expect(orbital.config.visualInterlocution.focals.type).toBe('standard');
        orbital.destroy();
    });

    it('a standard glyph (a user choice, not Chapel-held) survives clear-text', () => {
        const { orbital } = makeOrbital();
        orbital.loadText('text', 'Source', {
            visualConfig: { visualMode: 'focals', focals: { type: 'standard', standardGlyph: 'spiral' } }
        });
        orbital.clearText();
        expect(orbital.config.visualInterlocution.focals.type).toBe('standard');
        expect(orbital.config.visualInterlocution.focals.standardGlyph).toBe('spiral');
        orbital.destroy();
    });

    it('releases an Icon lock atomically when the reader chooses Rhythmic', () => {
        const onBeginSession = vi.fn();
        const { orbital, container } = makeOrbital(onBeginSession);
        const visualProgram = {
            coordinateSpace: 'scripture',
            enabled: false,
            segments: [{
                id: 'transfiguration',
                match: { chapter: 17, verseStart: 1, verseEnd: 13 },
                cue: {
                    kind: 'sourced',
                    collections: ['chapel-gospel-transfiguration']
                }
            }],
            fallback: {
                kind: 'focal',
                focal: { type: 'icon', iconId: 'icon-transfiguration' }
            }
        };
        orbital.loadText('[v 17:1] And after six days...', 'The Chapel · Matthew 17', {
            visualProgram,
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'icon', iconId: 'icon-transfiguration' },
                interlocution: {
                    sourceFamily: 'collections',
                    procedural: [],
                    sourced: ['chapel-gospel-transfiguration'],
                    atriumCollections: ['chapel-gospel-transfiguration'],
                    presentation: 'behind-stream'
                }
            }
        });
        expect(orbital.config.visualProgram.enabled).toBe(false);

        orbital.viPanel.hasConsent = true;
        container.querySelector('[data-visual-mode="interlocution"]').click();

        expect(orbital.config.visualInterlocution.visualMode).toBe('interlocution');
        expect(orbital.config.visualInterlocution.focals).toMatchObject({
            type: 'standard',
            iconId: null
        });
        expect(orbital.config.visualInterlocution.interlocution.sourced)
            .toEqual(['chapel-gospel-transfiguration']);
        expect(orbital.config.visualProgram).toMatchObject({
            enabled: true,
            fallback: { kind: 'still' }
        });

        orbital.beginSession();
        expect(onBeginSession).toHaveBeenCalledWith(expect.objectContaining({
            visualProgram: expect.objectContaining({ enabled: true }),
            visualConfig: expect.objectContaining({
                visualMode: 'interlocution',
                focals: expect.objectContaining({ type: 'standard' })
            })
        }));
        orbital.destroy();
        container.remove();
    });

    it('replaces a Rosa Mystica program fallback when switching to Rhythmic', () => {
        const { orbital, container } = makeOrbital();
        orbital.loadText('[v 1:1] The beginning...', 'The Chapel · John 1', {
            visualProgram: {
                coordinateSpace: 'scripture',
                enabled: true,
                segments: [{
                    id: 'prologue',
                    match: { chapter: 1, verseStart: 1, verseEnd: 18 },
                    cue: {
                        kind: 'sourced',
                        collections: ['chapel-gospel-prologue']
                    }
                }],
                fallback: {
                    kind: 'focal',
                    focal: { type: 'rose', seed: 12 }
                }
            },
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'rose', seed: 12 },
                interlocution: {
                    procedural: [],
                    sourced: ['chapel-gospel-prologue']
                }
            }
        });

        orbital.viPanel.hasConsent = true;
        container.querySelector('[data-visual-mode="interlocution"]').click();

        expect(orbital.config.visualInterlocution.focals.type).toBe('standard');
        expect(orbital.config.visualProgram).toMatchObject({
            enabled: true,
            fallback: { kind: 'still' }
        });
        orbital.destroy();
        container.remove();
    });
});
