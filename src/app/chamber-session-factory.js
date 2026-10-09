import { Player, estimateInterlocutionCount } from '../core/player.js';
import {
  FLASHING_ENABLED,
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
import { chamberExitTarget } from './chamber-exit.js';
import { createPresentationLens, sessionColorTheme, sessionColorThemeId } from '../core/session-presentation.js';
import { sessionImageryCollections } from '../core/visual-selection.js';
import { audioDiag } from '../core/audio-diagnostics.js';
import { liveExited, liveMounted, takeLivePlayer } from './live-handoff.js';
import { beginStep } from '../core/begin-steps.js';
import { SEQUENCE_CAPABILITIES } from '../core/sequence-capabilities.js';
import { PLUS_VOICE_MAX_CHARS, fetchPlusStatus, markPlusLapsed, notePlusAllowance, plusNotice, plusState, plusVoiceSlug } from './plus.js';

/**
 * Whether a reading is the reader's own material, the only kind the Plus voice
 * reads (RFC 0001 rev 3, decision D9): a Composer Current (its provenance names
 * the Current, src/core/rise-current.js), a personal reading written for this
 * reader (src/core/personal-project.js), a file the reader opened from the
 * Library (provenance `local-text`, src/components/Library.js), or a Make
 * project built only from text the reader brought (Workshop sources from a
 * file, a paste or the reader's recursion journal). Library and canon works,
 * Keystones, Journeys, today's poem and minted programs carry other
 * provenance or providers and are never voiced per reader.
 */
const OWN_SOURCE_PROVIDERS = new Set(['local', 'recursion']);
export function isReadersOwn(session) {
    const provenance = session?.provenance;
    if (typeof provenance?.currentId === 'string') return true;
    if (provenance?.kind === 'personal-generated' || provenance?.kind === 'local-text') return true;
    const sources = Array.isArray(session?.sources) ? session.sources : [];
    return session?.isCustom === true && sources.length > 0
        && sources.every(source => OWN_SOURCE_PROVIDERS.has(source?.providerId));
}

/**
 * The one place a Player is made. A host that needs a Player for a Session it
 * will present later (the live runtime, which builds its Player as the words
 * arrive) asks for it here, and hands it back through `takeLivePlayer`.
 */
export function createSessionPlayer(session) {
    return new Player(session);
}

export async function createChamberSession(operations, container, sessionData) {
    const session = sessionData || operations.getCurrentSession();
    const requiredVoice = session?.origin?.view === 'voice-demo' && session.origin.requireElevenLabs === true;
    const refuseRequiredVoice = message => {
        session.origin.voiceFailure = message;
        throw new Error(message);
    };
    // A LIVE READING ARRIVES WITH ITS PLAYER, ALREADY RUNNING OR HELD. It is the
    // one Player for the whole Current, so it is adopted, not rebuilt; and
    // because the view replaces one already on screen (a Dive, coming back), the
    // preparation overlay and its settling delay are skipped. So are they for a
    // reading begun from Home: the router keeps Home shown under the Read view
    // until this one has faded in, so Home's own field is the ground (RDR-015).
    const live = takeLivePlayer(session);
    const quiet = live || session?.origin?.view === 'home';
    const ui = quiet ? { showLoading() {}, updateLoadingStatus() {}, hideLoading() {} } : operations;
    const revision = operations.router.navigationRevision;
    const assertCurrent = () => {
        if (revision !== operations.router.navigationRevision) throw new DOMException('Launch cancelled', 'AbortError');
    };
    let preparedPlayer = null;
    beginStep('factory:start');

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
        // Chamber was always going to pay for it; opening
        // Home no longer is.
        const visualCortex = await operations.ensureVisualCortex();
        assertCurrent();
        await operations.ensureAudioEngine();
        assertCurrent();
        const audioEngine = operations.getAudioEngine();
        beginStep('factory:engines');

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
        // unstated presentation is still treated as flashing.
        // `normalizePresentation` now resolves an unknown
        // surface to Gallery rather than to full-frame, so a
        // compiled session no longer arrives here defaulted
        // into a flash; this check stands behind that for any
        // config that never passed through the compiler.
        // Imagery is slow and the Chamber is not up yet, so the fetch
        // starts here rather than when something first needs a picture.
        // Deliberately not awaited: it moves the cost earlier, it does
        // not make the reading wait on it.
        void visualCortex.warmImagery(sessionImageryCollections(session.visualConfig));

        const presentation = session.visualConfig?.interlocution?.presentation;
        // With flashing disabled nothing reaching here can flash, so the
        // notice is not raised: asking a reader to accept a risk the build
        // cannot produce is a false warning, and a false warning teaches
        // people to click through real ones.
        const flashes = FLASHING_ENABLED && !isContinuousPresentation(presentation);
        if (visualMode === 'interlocution' && flashes) {
            const consentScope = session.visualConfig?.consentScope;
            const consented = await requestVisualInterlocutionConsent(consentScope);
            assertCurrent();
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
        ui.showLoading('Preparing Session');

        // The Plus voice, for a reading of the reader's own that brings no
        // recitation of its own: kept in this browser once voiced, otherwise
        // one request, awaited, never retried. A refusal leaves the reading
        // silent and is said once the Chamber is up. The Worker voices a
        // Current, not a chapter, so a longer text is not sent.
        let plusRefused = null;
        let plusVoicing = null;
        const plus = plusState();
        const ownVoice = !live && !spatialLaunch && session.recitation?.enabled !== true && isReadersOwn(session)
            && (requiredVoice || operations.getSettings()?.plusVoice !== false);
        const entitlement = ownVoice ? await fetchPlusStatus() : null;
        assertCurrent();
        if (requiredVoice && (!ownVoice || !entitlement?.available || !(entitlement.admin || entitlement.subscriber))) {
            refuseRequiredVoice('Could not confirm ElevenLabs access or availability. Your text is still here. Check availability and try again.');
        }
        if (ownVoice && ((entitlement?.available && (entitlement.admin || entitlement.subscriber))
            || (plus.claimed && !plus.lapsed))) {
            const { spokenAtoms, voiceReading } = await import('../audio/plus-voice.js');
            assertCurrent();
            if (spokenAtoms(session.atoms).join(' ').length > PLUS_VOICE_MAX_CHARS) {
                plusRefused = 'TOO_LONG';
            } else {
                ui.updateLoadingStatus('Asking for the Plus voice...');
                const voiced = await voiceReading(session.atoms, { voice: plusVoiceSlug(requiredVoice ? session.origin.voice : operations.getSettings()?.plusVoiceSlug) });
                assertCurrent();
                if (voiced.ok) {
                    plusVoicing = voiced;
                    if (voiced.allowance) notePlusAllowance(voiced.allowance);
                    session.revealMode = 'progressive';
                    session.capabilities = [...(session.capabilities ?? []), SEQUENCE_CAPABILITIES.RECITATION_AUDIO];
                    session.recitation = { enabled: true, pack: null };
                    session.voiceId = voiced.voiceId;
                } else {
                    if (requiredVoice) refuseRequiredVoice(voiced.message || 'ElevenLabs could not render this reading. Your text is still here.');
                    plusRefused = voiced.code;
                    if (voiced.code === 'PLUS_REQUIRED' || voiced.code === 'PLUS_LAPSED') markPlusLapsed();
                }
            }
            if (requiredVoice && plusRefused) refuseRequiredVoice('This reading is too long for the ElevenLabs voice. Your text is still here.');
        }

        // Start the selected neural voice during preparation, not
        // after the first atom is already on screen. It builds a
        // contiguous eight-phrase lead while the rest of session
        // setup proceeds; the Chamber is not shown until that
        // lead is ready (or preparation degrades cleanly).
        let recitationReady = Promise.resolve(false);
        if (session.recitation?.enabled === true) {
            ui.updateLoadingStatus('Preparing spoken voice...');
            const { Voice } = await import('../audio/voice.js');
            assertCurrent();
            recitationVoice = new Voice({
                audioEngine,
                voiceId: session.voiceId,
                ...(plusVoicing
                    ? { manifest: plusVoicing.manifest, fetchImpl: plusVoicing.fetchImpl }
                    : { packUrl: session.recitation.pack })
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
            ui.updateLoadingStatus('Stabilizing carrier frequencies...');
            audioEngine.stopAmbient();
            audioEngine.sessionActive = true;
            const durationSec = (session.totalDuration || 0) / 1000;
            await audioEngine.startSession({
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
            assertCurrent();
            beginStep('factory:audio');
        } else {
            audioEngine.stopAmbient();
            audioEngine.sessionActive = true;
        }

        ui.updateLoadingStatus('Creating player...');
        const player = live ?? createSessionPlayer(session);
        preparedPlayer = player;

        // The player is the sole clock: entrainment ramps
        // follow canonical reading progress, so pauses,
        // visual presences, and hidden tabs hold the beat
        // instead of letting wall time drift it forward.
        if (hasAudio) {
            player.on('progress', ({ progress }) => {
                audioEngine.setEntrainmentPosition(progress);
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
            ui.updateLoadingStatus('Loading visual engine...');
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
            assertCurrent();
            if (interlocution.responsive && session.atoms?.length) {
                const { scoreAtoms, sampleTrackSignals } = await import('../core/conductor.js');
                assertCurrent();
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
                    // The reading's chosen colors paint the flame; readings
                    // without a declared palette keep the mood palettes.
                    flameColors: sessionColorTheme(session),
                    // The theme answers every engine knob left at its
                    // no-choice value; the plate keys are that value until
                    // a cue names a palette.
                    colorTheme: sessionColorThemeId(session),
                    ostensoriaPalette: 'auto',
                    apparitioPalette: 'auto',
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
                    // The spatial launch has its own gate, and it must
                    // consult the kill switch for the same reason the
                    // other one does.
                    const directFlashes = FLASHING_ENABLED
                      && !isContinuousPresentation(directPresentation);
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
                beginStep('factory:preload');
                await visualCortex.preloadProgram(session.visualProgram);
                assertCurrent();
                await visualCortex.preload(estimatedFlashCount);
                assertCurrent();
                beginStep('factory:preloaded');
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



        ui.updateLoadingStatus('Entering chamber...');

        const { Chamber } = await import('../components/read/Chamber.js');
        assertCurrent();
        beginStep('factory:chamber-module');

        if (recitationVoice) {
            ui.updateLoadingStatus('Building the spoken lead...');
            // THE ANSWER WAS AWAITED AND THROWN AWAY. A reading whose
            // voice could not be prepared entered anyway, with the voice
            // attached and enabled, and every phrase then came up silent
            // with nothing said about it — the reader is left wondering
            // whether they have the wrong setting or a broken build. It
            // is a legitimate outcome, the pack can be unreachable; it is
            // not a legitimate SILENT outcome.
            const spokenReady = await recitationReady;
            assertCurrent();
            audioDiag('entry', {
                spokenReady,
                context: audioEngine?.context ? audioEngine.context.state : 'none'
            });
            if (!spokenReady) {
                if (requiredVoice) refuseRequiredVoice('The ElevenLabs audio could not be prepared. No reading was started. Your text is still here.');
                operations.showToast(
                    'The spoken voice could not be prepared. The reading continues at its own pace.',
                    5000
                );
            }
        }

        // Brief delay for smooth transition
        if (!quiet) await new Promise(resolve => setTimeout(resolve, 300));
        assertCurrent();

        ui.hideLoading();

        // `presentation` already means the VISUAL presentation mode in
        // this file (line 76). This is the other kind — how the type is
        // set — so it is named for what it is.
        const presentationLens = createPresentationLens(session, operations.getSettings);

        const chamber = new Chamber(container, {
            session: session,
            player: player,
            voice: recitationVoice,
            // A live reading is shown at once and started by its host, after this view is up.
            autoStart: !live,
            hostPlays: live !== null,
            // A live host draws its own controls; the Chamber brings none of its own.
            ...(live ? { chrome: 'none' } : {}),
            audioEngine,
            // A composed reading opens in the presentation it was
            // composed for; the reader's own settings answer for
            // everything else, and for anything they reach for.
            getSettings: presentationLens.getSettings,
            onSettingsChange: (key, value) => {
                presentationLens.release(key);
                operations.handleSettingsChange(key, value);
            },
            onDataCleared: () => operations.handleDataCleared(),
            onEnterStream: activateDeferredVisuals,
            pendingVisualRecipe: operations.takePendingVisualRecipe?.() || null,
            onExit: (reason, data) => {
                // Read before stop(), which resets the Player's state.
                const complete = player.sessionState?.state === 'complete';
                // Cleanup
                if (live) liveExited(session);
                player.stop();
                if (complete) operations.releaseSession?.(session);
                endVisualInterlocutionSession();
                visualCortex.updateConfig({ enabled: false });
                audioEngine.stopSession();

                // A VIEW IS DISPOSED ONCE IT IS OFF SCREEN, NOT BEFORE.
                //
                // The router already gets this order right: deactivate,
                // fade the outgoing container out, hide it, and only then
                // dispose whatever owned it. Destroying here first took
                // that away — Chamber.destroy() does not remove its own
                // DOM, so the Fit word was undressed while still in front
                // of the reader and stayed that way for the whole
                // transition. Measured at 369ms of a 503px near-white word
                // on the way back to try-rise.
                //
                // Disposal is still forced rather than left to the router,
                // because the router disposes no room it leaves: the Read
                // room keeps its panes, so the Chamber closes its own.
                const read = operations.router.getViewInstance('read');
                const dying = read?.paneInstance('chamber') || null;
                const dispose = () => {
                    if (dying) read.closePane('chamber', dying);
                };

                const target = chamberExitTarget(reason, session, data);
                if (target?.kind === 'continue') {
                    // The next division mounts into this pane at once, so this
                    // Chamber goes first, leaving what it showed until then.
                    if (dying) read.closePane('chamber', dying, { keepElement: true });
                    void operations.continueLibraryReading(session);
                } else if (target?.kind === 'navigate') {
                    // Through the shell rather than the router, so the rules
                    // that keep the address bar honest about which surface is
                    // showing get a chance to run.
                    void Promise.resolve(operations.handleNavigate(target.view, target.data, {
                        replaceUrl: target.replaceUrl === true
                    })).catch(() => {}).then(dispose);
                } else {
                    dispose();
                }
            }
        });
        // What the Plus voice answered, in the quiet place the movement title
        // uses; and a lapse mid-reading (a clip answered 402) goes silent at
        // the next phrase with the same word.
        if (plusRefused) chamber.announceMovement(plusNotice(plusRefused));
        if (recitationVoice) {
            recitationVoice.onLapse = () => {
                if (requiredVoice) {
                    player.pause();
                    chamber.announceMovement('The ElevenLabs voice stopped. Your text remains available.');
                    return;
                }
                markPlusLapsed();
                chamber.announceMovement(plusNotice('PLUS_LAPSED'));
            };
        }
        // Its listeners are bound, so the reading can begin while the router is
        // still fading the view in.
        if (live) liveMounted();
        return chamber;
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('[RISE] Session initialization failed:', error);
        preparedPlayer?.stop();
        recitationVoice?.destroy();
        endVisualInterlocutionSession();
        // Reached through the catch, so either subsystem may have
        // been what failed to arrive. Teardown must not need them.
        operations.getVisualCortex()?.updateConfig({ enabled: false });
        await operations.getAudioEngine()?.stopSession({ immediate: true })?.catch(() => {});
        operations.hideLoading();
        if (error?.name === 'AbortError') throw error;
        if (requiredVoice) {
            session.origin.voiceFailure ||= 'The ElevenLabs reading could not start. Your text is still here.';
            operations.releaseSession?.(session);
            throw error;
        }
        // A missing optional chunk must not trigger the router's reload recovery:
        // the personal draft may not have been kept yet.
        if (session.provenance?.kind === 'personal-generated') throw new Error('Personal reading playback unavailable.');
        operations.showToast('Failed to initialize session', 3000);
        operations.releaseSession?.(session);
        operations.router.back();
        return { destroy: () => { } };
    }
}
