import { Player, estimateInterlocutionCount } from '../core/player.js';
import {
  GALLERY_CADENCE_DEFAULT,
  VISUAL_PRESENCE_DEFAULT_MS,
  normalizeGalleryCadence,
  normalizePresentation,
  isContinuousPresentation
} from '../core/visual-presence.js';
import {
  beginNonFlashingVisualSession,
  beginVisualInterlocutionSession,
  endVisualInterlocutionSession,
  requestVisualInterlocutionConsent
} from '../core/visual-safety.js';
import { normalizeVisualSelection, resolveSessionWordFill } from '../core/visual-selection.js';

export async function createChamberSession(operations, container, sessionData) {
    const session = sessionData || operations.currentSession;

    if (!session || !session.atoms || session.atoms.length === 0) {
        console.error('[RISE] Cannot start chamber: no session data or atoms');
        operations.showToast('No content available for session', 3000);
        operations.router.back();
        return { destroy: () => { } };
    }

    const authoredVisualMode = session.visualConfig?.visualMode || 'off';
    let visualMode = authoredVisualMode;
    let activateDeferredVisuals = async () => true;
    let recitationVoice = null;

    // A SPATIAL reading runs no temporal visual machinery.
    // Page Mode has no flash economy and no advance clock
    // (PAGE-MODE-SPEC §4), so a session that opens as a page
    // must not request interlocution consent, preload a flash
    // pool, or start Gallery,
    // attractor, Genesis, or focal engines — all of which
    // would otherwise run invisibly beneath the page, burning
    // CPU/GPU/network and contradicting the projection. The
    // authorial configuration remains immutable across the
    // projection boundary. PageReader needs it to spatially
    // lower held fields and the authored program; only temporal
    // EXECUTION is deferred until the Stream owns the session.
    const spatialLaunch = session.projection === 'page';
    if (spatialLaunch) visualMode = 'off';

    try {
        // A reading is the first thing that needs either of
        // these, so this is where they arrive. Chamber.js
        // imports the same cortex singleton, so opening the
        // Chamber was always going to pay for it; opening the
        // Portal no longer is.
        const visualCortex = await operations.ensureVisualCortex();
        await operations.ensureAudioEngine();

        // Consent is an interaction phase, not a loading task. It
        // must resolve before the opaque preparation overlay can
        // cover the page, and before audio or Player ownership
        // begins. Acceptance becomes a one-session capability.
        // GALLERY IS NOT A FLASH, SO IT IS NOT GATED. The
        // notice describes brief high-contrast exposures
        // between moments of reading; the continuous field
        // never flashes and never goes black, so raising the
        // photosensitivity warning over it asks a reader to
        // accept a risk this surface does not carry. An
        // unstated presentation is treated as flashing —
        // the cortex's own default is full-frame.
        const presentation = session.visualConfig?.interlocution?.presentation;
        const flashes = !isContinuousPresentation(presentation);
        if (visualMode === 'interlocution' && flashes) {
            const consentScope = session.visualConfig?.consentScope;
            const consented = await requestVisualInterlocutionConsent(consentScope);
            const activated = consented && beginVisualInterlocutionSession(consentScope);
            if (!activated) {
                visualMode = 'off';
                session.visualConfig = { ...session.visualConfig, visualMode: 'off' };
                operations.showToast('Visual flashes remain off until the safety notice is accepted.', 4000);
            }
        } else if (visualMode === 'interlocution') {
            // Gallery: no notice, but the capability still has
            // to be granted or the cortex renders nothing —
            // skipping the whole block turned Gallery's imagery
            // off, which the browser suite caught.
            beginNonFlashingVisualSession(session.visualConfig?.consentScope);
        } else {
            endVisualInterlocutionSession();
        }

        // Only enter the non-interactive preparation phase after
        // the safety decision has completed.
        operations.showLoading('Preparing Session');

        // Start the selected neural voice during preparation, not
        // after the first atom is already on screen. It builds a
        // contiguous eight-phrase lead while the rest of session
        // setup proceeds; the Chamber is not shown until that
        // lead is ready (or preparation degrades cleanly).
        let recitationReady = Promise.resolve(false);
        if (session.recitation?.enabled === true) {
            operations.updateLoadingStatus('Preparing spoken voice...');
            const { Voice } = await import('../audio/voice.js');
            recitationVoice = new Voice({
                audioEngine: operations.audioEngine,
                voiceId: session.voiceId
            });
            recitationVoice.enabled = true;
            recitationReady = recitationVoice.prepare(session.atoms, 0)
                .catch(() => false);
        }

        // Start audio initialization early to minimize lag on chamber entry.
        // It belongs inside this failure boundary so blocked Web Audio cannot
        // strand the loading overlay or the router transition.
        const hasSoundscape = session.soundscape && session.soundscape !== 'none';
        const hasAudio = (session.audioPreset && session.audioPreset !== 'silent')
            || session.selectedSwellId
            || hasSoundscape
            // A Journey scores its own audio and never sets
            // any of the above. Without this the engine's
            // session is never started for one, and the
            // schedule's commands arrive at a layer that is
            // not listening.
            || session.audioProgram?.segments?.length > 0
            || session.recitation?.enabled === true;

        if (hasAudio) {
            operations.updateLoadingStatus('Stabilizing carrier frequencies...');
            operations.audioEngine.stopAmbient();
            operations.audioEngine.sessionActive = true;
            const durationSec = (session.totalDuration || 0) / 1000;
            await operations.audioEngine.startSession({
                // Exclusive beds: a soundscape is a finished mix, so
                // it displaces the pure-tone preset if both slipped in.
                preset: session.audioPreset !== 'silent' && !hasSoundscape ? session.audioPreset : null,
                soundscape: hasSoundscape ? session.soundscape : null,
                swellId: session.selectedSwellId,
                // A scored swell lane owns the swells. Without
                // this the entry trigger fires too, and with no
                // default chosen it fires a RANDOM one — which is
                // how an authored swell came back layered over
                // itself, offset by the reading's first atoms.
                entrySwell: !(session.audioProgram?.lanes?.swell?.segments?.length),
                entrainment: {
                    mode: session.entrainmentMode || 'binaural',
                    waveform: session.entrainmentWaveform || 'sine',
                    curve: session.curve || 'flat',
                    durationSec,
                    autoRamp: !!(session.curve && session.curve !== 'flat')
                }
            });
        } else {
            operations.audioEngine.stopAmbient();
            operations.audioEngine.sessionActive = true;
        }

        operations.updateLoadingStatus('Creating player...');
        const player = new Player(session);

        // The player is the sole clock: entrainment ramps
        // follow canonical reading progress, so pauses,
        // visual presences, and hidden tabs hold the beat
        // instead of letting wall time drift it forward.
        if (hasAudio) {
            player.on('progress', ({ progress }) => {
                operations.audioEngine.setEntrainmentPosition(progress);
            });
        }

        // Every new reading installs an authoritative cortex
        // identity. Persistent/off modes clear it here; Rhythmic
        // modes install their complete identity below so an
        // interlocution -> interlocution transition cannot depend
        // on a diff against the prior reading's singleton state.
        const visualSetupMode = spatialLaunch ? authoredVisualMode : visualMode;
        if (visualSetupMode !== 'interlocution') {
            visualCortex.resetSessionVisualIdentity();
        }

        // Configure visual cortex based on the consented mode.
        if (visualSetupMode === 'interlocution') {
            operations.updateLoadingStatus('Loading visual engine...');
            const activeTypes = [];
            const rawInterlocution = session.visualConfig.interlocution || {};
            const interlocution = {
                ...rawInterlocution,
                ...normalizeVisualSelection(rawInterlocution),
                wordFill: resolveSessionWordFill({
                    ...rawInterlocution,
                    wordFill: rawInterlocution.wordFill ?? session.visualConfig?.wordFill
                })
            };
            // Keep the runtime session truthful for diagnostics and
            // downstream consumers. Procedural means no sourced art;
            // mixed sources survive only under an explicit Blend.
            session.visualConfig.interlocution = interlocution;

            // Flatten all procedural types. No implicit fallback —
            // an empty selection is a valid "stillness" choice, and
            // visual packages only arrive through explicit configs.
            if (interlocution.procedural) {
                activeTypes.push(...interlocution.procedural);
            }

            // Flatten all sourced types
            if (interlocution.sourced) {
                const sourced = interlocution.sourced;
                const retiredMetSelected = sourced.some(s =>
                    typeof s === 'string' && s.startsWith('met-'));
                // Specifically add all selected Wikimedia categories
                const wikimediaCategories = sourced.filter(s => 
                    s !== 'global-pool' && 
                    s !== 'custom' && 
                    !s.startsWith('personal:') &&
                    !s.startsWith('met-')
                );
                activeTypes.push(...wikimediaCategories);
                // Add active session assets specifically
                if (sourced.includes('custom')) {
                    activeTypes.push('custom');
                }
                // Add global pool specifically
                if (sourced.includes('global-pool')) {
                    activeTypes.push('global-pool');
                }
                // Add all personal sequences specifically
                activeTypes.push(...sourced.filter(s => s.startsWith('personal:')));

                // Met-only saved presets predate the provider's
                // retirement. Preserve their documented procedural
                // fallback; mixed presets simply discard the stale id.
                if (retiredMetSelected && activeTypes.length === 0) {
                    activeTypes.push('klee');
                }
            }

            // Custom visuals from this session are now handled via the 'custom' flag in interlocution.sourced
            // which is managed by the Chamber's VisualNavigator

            // Responsive interlocutions: score the session's timeline
            // before preload so the flame queue renders plan-driven
            // fractals (palette/variations/tone by signal) that cover
            // the text's emotional arc. Null when responsive is off.
            let semanticSignals = null;
            // MemoryCore reaches workshop-asset-durability and the
            // workshop project model; this one call for pinned
            // Global Pool URIs is the only thing app.js wants from
            // it, and it is on the reading path, not the shell's.
            const { MemoryCore } = await import('../core/memory.js');
            if (interlocution.responsive && session.atoms?.length) {
                const { scoreAtoms, sampleTrackSignals } = await import('../core/conductor.js');
                session.semanticTrack = session.semanticTrack || scoreAtoms(session.atoms);
                // Flame seeding drives palettes/structure — a mood behavior
                if (interlocution.responsiveMood ?? true) {
                    semanticSignals = sampleTrackSignals(session.semanticTrack, 10);
                }
                console.log('[RISE] Responsive interlocutions: track scored,',
                    semanticSignals ? `${semanticSignals.length} flame seed signals sampled` : 'mood off (no flame seeding)');
            }

                visualCortex.beginSessionVisualIdentity({
                    enabled: true,
                    frequency: interlocution.frequency ?? 0.2,
                    duration: interlocution.duration ?? VISUAL_PRESENCE_DEFAULT_MS,
                    galleryCadence: normalizeGalleryCadence(
                        interlocution.galleryCadence ?? GALLERY_CADENCE_DEFAULT
                    ),
                    renderLanguage: 'native',   // ASCII retired 2026-08-06
                    presentation: normalizePresentation(interlocution.presentation),
                    activeTypes: activeTypes,
                    kleePreset: interlocution.kleePreset ?? 'random',
                    harmonographClimate: interlocution.harmonographClimate ?? 'auto',
                    // Attractor is a LISTED procedural, not a mode
                    // of its own, so its dials arrive here with the
                    // rest of the interlocution. The cortex reads
                    // config.attractor for system, palette and form.
                    attractor: interlocution.attractor ?? null,
                    // EVERY FIELD HERE IS NAMED BY HAND, so one
                    // left out is silently dropped on the last hop
                    // between compiler and renderer while surviving
                    // the whole pipeline before it. That is how an
                    // authored relation once lost its subject and
                    // Haiti drew a Union Jack; imagery.test.js
                    // guards the wiring rather than the modules.
                    customVisuals: session.customVisuals || [],
                    sequenceVisualAssets: session.sequenceVisualAssets || [],
                    // Resolve stable Global Pool IDs once at
                    // session entry. The flash hot path receives a
                    // pinned URI set and never rereads shared state.
                    globalVisuals: interlocution.sourced?.includes('global-pool')
                        ? MemoryCore.resolveGlobalImageUris(interlocution.globalPool)
                        : [],
                    sourced: interlocution.sourced || [],
                    wordFill: interlocution.wordFill,
                    semanticSignals: semanticSignals
                });

            // Preload visuals
            const estimatedFlashCount = estimateInterlocutionCount(
                session,
                interlocution.frequency ?? 0.2
            );
            if (spatialLaunch) {
                // Configuration is inert without a Stream host or
                // presentation opportunity. Defer capability and
                // asset work until the reader actually leaves Page.
                activateDeferredVisuals = async () => {
                    const directPresentation = session.visualConfig
                      ?.interlocution?.presentation;
                    const directFlashes = !isContinuousPresentation(directPresentation);
                    const consentScope = session.visualConfig?.consentScope;
                    const activated = directFlashes
                      ? (await requestVisualInterlocutionConsent(consentScope))
                        && beginVisualInterlocutionSession(consentScope)
                      : beginNonFlashingVisualSession(consentScope);
                    if (!activated) {
                        visualCortex.updateConfig({ enabled: false });
                        operations.showToast(
                          'Visual flashes remain off until the safety notice is accepted.',
                          4000
                        );
                        return false;
                    }
                    await visualCortex.preloadProgram(session.visualProgram);
                    await visualCortex.preload(estimatedFlashCount);
                    return true;
                };
            } else {
                await visualCortex.preloadProgram(session.visualProgram);
                await visualCortex.preload(estimatedFlashCount);
            }
        } else if (visualSetupMode === 'focals') {
            // Focals mode: persistent gentle focal point (handled by Chamber renderer)
            // No visual cortex preloading needed - focals are persistent, not probabilistic
            console.log('[RISE] Focals mode active:', session.visualConfig.focals);
        } else if (visualSetupMode === 'attractor') {
            // Attractor mode: persistent strange-attractor field (handled by Chamber renderer)
            // No visual cortex preloading needed - the field is continuous, not probabilistic
            console.log('[RISE] Attractor mode active:', session.visualConfig.attractor);
        } else if (visualSetupMode === 'genesis') {
            // Genesis mode: continuously growing Klee field (handled by Chamber renderer)
            console.log('[RISE] Genesis mode active:', session.visualConfig.genesis);
        }



        operations.updateLoadingStatus('Entering chamber...');

        const { Chamber } = await import('../components/Chamber.js');

        if (recitationVoice) {
            operations.updateLoadingStatus('Building the spoken lead...');
            await recitationReady;
        }

        // Brief delay for smooth transition
        await new Promise(resolve => setTimeout(resolve, 300));

        operations.hideLoading();

        return new Chamber(container, {
            session: session,
            player: player,
            voice: recitationVoice,
            autoStart: true,
            audioEngine: operations.audioEngine,
            getSettings: () => operations.settings,
            onSettingsChange: (key, value) => operations.handleSettingsChange(key, value),
            onDataCleared: () => operations.handleDataCleared(),
            onEnterStream: activateDeferredVisuals,
            onExit: (reason, data) => {
                // Cleanup
                player.stop();
                endVisualInterlocutionSession();
                visualCortex.updateConfig({ enabled: false });
                operations.audioEngine.stopSession();

                // Force disposal of the instance so next session starts fresh
                const view = operations.router.views.get('chamber-session');
                if (view && view.instance) {
                    view.instance.destroy();
                    view.instance = null;
                }

                if (reason === 'continue') {
                    void operations.continueLibraryReading(session);
                } else if (reason === 'workshop' && data && data.text) {
                    operations.router.navigate('workshop', {
                        data: { draftIntent: 'new-recursion', text: data.text }
                    });
                } else if (session.isPreview && (reason === 'back' || reason === 'exit' || reason === 'close')) {
                    operations.router.navigate('workshop'); // Isolate previews
                } else if (reason === 'back' || reason === 'exit' || reason === 'close') {
                    operations.router.navigate('chamber'); // Back to orbital prep
                }
            }
        });
    } catch (error) {
        console.error('[RISE] Session initialization failed:', error);
        recitationVoice?.destroy();
        endVisualInterlocutionSession();
        // Reached through the catch, so either subsystem may have
        // been what failed to arrive. Teardown must not need them.
        operations._visualCortex?.updateConfig({ enabled: false });
        await operations.audioEngine?.stopSession({
            resumeAmbient: operations.settings?.enableAmbient === true,
            immediate: true
        })?.catch(() => {});
        operations.hideLoading();
        operations.showToast('Failed to initialize session', 3000);
        operations.router.back();
        return { destroy: () => { } };
    }
}
