/*
 * RISE — Main Application
 * An audiovisual reader
 *
 * Central orchestration module that initializes and coordinates:
 * - Router (view navigation)
 * - Audio Engine (binaural entrainment, layers)
 * - Settings (persistence, accessibility)
 * - Components (Portal, Chamber, Library, Workshop, Settings)
 */

import { Router } from './core/router.js';
import { AudioEngine } from './audio/engine.js';
import { Player, estimateInterlocutionCount } from './core/player.js';
import {
    GALLERY_CADENCE_DEFAULT,
    VISUAL_PRESENCE_DEFAULT_MS,
    normalizeGalleryCadence,
    normalizePresentation,
    isContinuousPresentation
} from './core/visual-presence.js';
import { compileSession } from './core/session-compiler.js';
import {
    isWorkshopProject,
    workshopProjectToSessionConfig
} from './core/workshop-project.js';
import { MemoryCore } from './core/memory.js';
import { initSourceSystem } from './sources/index.js';
import { BetaGate } from './components/BetaGate.js';
import './components/BetaGate.css';
import { isRosaryDoor } from './core/rosary-door.js';

import { visualCortex } from './visuals/visual-cortex.js';
import { errorBoundary, ErrorCategory, ErrorSeverity } from './core/error-boundary.js';
import {
    beginNonFlashingVisualSession,
    beginVisualInterlocutionSession,
    endVisualInterlocutionSession,
    requestVisualInterlocutionConsent
} from './core/visual-safety.js';
import { clampBandFraction } from './core/band-offset.js';
import { resolveChamberStreamFace } from './core/chamber-stream-face.js';
import { clampReadingWpm } from './core/reading-limits.js';
import { normalizeVisualSelection, normalizeWordFill } from './core/visual-selection.js';

// Import styles
import './design-system.css';
import './components/Portal.css';
import './components/Keystones.css';
import './components/ChamberOrbital.css';
import './components/Chamber.css';
import './components/Library.css';
import './components/Workshop.css';
import './components/Settings.css';
import './components/Guide.css';
import './components/Chapel.css';
import './components/Rosarium.css';
import './components/Via.css';
import './components/Curia.css';
import './components/Scriptorium.css';
import './components/Journeys.css';
import './premium-additions.css';

/**
 * A DEPLOY MUST NOT STRAND AN OPEN TAB.
 *
 * Views are loaded lazily, so the chunk names a session will need are
 * resolved from the index.html the reader loaded — possibly hours ago.
 * Ship a new build and those hashes stop existing: the app keeps working
 * until the reader opens the Chamber, at which point the import 404s and
 * the session dies with `Failed to fetch dynamically imported module`.
 *
 * The headers are already right (index.html revalidates, assets are
 * immutable); the gap is time, not caching. Vite raises this event for
 * exactly this case, and the only correct answer is to fetch the current
 * index. Reloading ONCE per session, guarded by a sentinel, because a
 * genuine network failure would otherwise reload forever.
 */
export const STALE_BUILD_SENTINEL = 'rise_reloaded_for_stale_build';

window.addEventListener('vite:preloadError', (event) => {
    if (sessionStorage.getItem(STALE_BUILD_SENTINEL)) return;  // not a deploy: a real failure
    sessionStorage.setItem(STALE_BUILD_SENTINEL, '1');
    event.preventDefault();
    console.warn('[RISE] Build changed underneath this tab — reloading once.');
    window.location.reload();
});


class App {
    constructor() {
        this.router = null;
        this.audioEngine = null;
        this.settings = null;
        this.currentSession = null;
        this.guideInstance = null;
        this._audioInteractionController = null;
        this._utilityController = null;

        // Bind methods
        this.handleNavigate = this.handleNavigate.bind(this);
        this.handleCreateSession = this.handleCreateSession.bind(this);
        this.handleSettingsChange = this.handleSettingsChange.bind(this);
        this.handleDataCleared = this.handleDataCleared.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        // Initialize global error boundary first
        errorBoundary.init();
        this.setupErrorRecovery();

        // Pre-create audio engine and set up first-interaction listener
        // This ensures audio initializes on the BetaGate click, not after portal loads
        this.audioEngine = new AudioEngine();
        this.setupAudioInteraction();

        // Check beta access - this will call initializeApp when access is granted
        // (either immediately if already authenticated, or after user enters code)
        await this.checkBetaAccess();
    }

    /**
     * Check beta access and show gate if needed
     */
    async checkBetaAccess() {
        return new Promise((resolve) => {
            // Create a container for the beta gate
            const gateContainer = document.createElement('div');
            gateContainer.id = 'beta-gate-container';
            document.body.appendChild(gateContainer);

            let accessHandled = false;

            const gate = new BetaGate(gateContainer, {
                onAccess: async (session) => {
                    if (accessHandled) return; // Prevent double-handling
                    accessHandled = true;

                    console.log('[RISE] Beta access granted:', session.name);
                    this.betaSession = session;

                    try {
                        await this.initializeApp({
                            personalizedVault: session.vault || null
                        });
                        gateContainer.remove();
                        resolve(true);
                    } catch (error) {
                        accessHandled = false;
                        console.error('[RISE] Application initialization failed:', error);
                        gateContainer.hidden = false;
                        gateContainer.replaceChildren();
                        const recovery = document.createElement('div');
                        recovery.className = 'beta-gate beta-gate-error';
                        const message = document.createElement('p');
                        message.textContent = 'RISE could not initialize in this browser session.';
                        const retry = document.createElement('button');
                        retry.className = 'btn-primary';
                        retry.textContent = 'Retry';
                        retry.addEventListener('click', () => window.location.reload(), { once: true });
                        recovery.append(message, retry);
                        gateContainer.appendChild(recovery);
                        this.showToast('Initialization failed. Please retry or reload.', 5000);
                    }
                }
            });

            // If gate rendered nothing (already authenticated via onAccess callback),
            // the accessHandled flag will be true and we don't need to do anything else.
            // If the gate is showing UI (waiting for user input), we just wait.
        });
    }

    /**
     * Load a personalized vault for an invitee
     */
    loadPersonalizedVault(vaultId) {
        console.log('[RISE] Loading personalized vault:', vaultId);
        // Navigate to vault view - the Vault component will handle personalized content
        this.router.navigate('vault', { data: { personalizedVault: vaultId } });
    }

    /**
     * Full application initialization (after beta access granted)
     * @param {Object} options - Init options
     * @param {string} options.personalizedVault - Vault ID to load directly (skips portal)
     */
    async initializeApp(options = {}) {
        // Load settings from localStorage
        this.loadSettings();
        this.audioEngine?.setMasterVolume(this.settings.masterVolume);

        // Apply accessibility settings immediately
        this.applyAccessibilitySettings();

        // Audio engine is already created in init() before the gate
        // No need to create it again here

        // Initialize visual cortex
        visualCortex.init();

        // Initialize source providers
        await initSourceSystem();

        // Initialize router
        this.router = new Router({
            onViewChange: (view, data) => {
                console.log(`[RISE] View: ${view}`);
            }
        });

        // Register views
        this.registerViews();

        // Keystone paths are durable public entry points.  They resolve to a
        // threshold view first; admission and launch still happen through the
        // exact manifest gate rather than from URL text alone.
        const { isTryRisePath, keystoneSlugFromPath } = await import('./content/keystones.js');
        const directKeystone = keystoneSlugFromPath(window.location.pathname);
        const directTryRise = isTryRisePath(window.location.pathname);

        // A reload triggered by a stale build carries the destination
        // the reader was trying to reach, so recovery is invisible to
        // them rather than dumping them back at the start.
        let staleTarget = null;
        let staleData;
        try {
            const raw = sessionStorage.getItem('rise_stale_reload');
            if (raw) {
                sessionStorage.removeItem('rise_stale_reload');
                // Written as bounded JSON; tolerate the older bare-name
                // form so a reload mid-upgrade still recovers.
                const parsed = raw.startsWith('{') ? JSON.parse(raw) : { viewName: raw };
                staleTarget = parsed?.viewName ?? null;
                staleData = parsed?.data;
            }
        } catch (e) { /* private mode, or unreadable state */ }

        // Navigate to the recovered destination, the Rosary door, a
        // personalized vault, or the portal. `#rosary` is read here
        // because the router does not own hashes.
        if (staleTarget && this.router.views.has(staleTarget)) {
            console.log('[RISE] Recovering navigation after stale build:', staleTarget);
            await this.router.navigate(staleTarget, { data: staleData });
        } else if (isRosaryDoor()) {
            await this.router.navigate('rosarium', { data: { door: true } });
        } else if (directKeystone) {
            await this.router.navigate('keystones', { data: { slug: directKeystone } });
        } else if (directTryRise) {
            await this.router.navigate('keystones');
        } else if (options.personalizedVault) {
            console.log('[RISE] Navigating directly to personalized vault:', options.personalizedVault);
            await this.router.navigate('vault', { data: { personalizedVault: options.personalizedVault } });
        } else {
            await this.router.navigate('portal');
        }

        // Setup global utility listeners
        this.setupUtilityListeners();

        // Audio interaction listener is already set up in init()

        // The tab is now running a build it fetched itself, so the
        // one-reload guard is spent and may be released. Without this a
        // reader who leaves a tab open across TWO deploys is stranded by
        // the second one, the sentinel having been set by the first.
        sessionStorage.removeItem(STALE_BUILD_SENTINEL);

        console.log('[RISE] Application initialized');
    }

    /**
     * Ensure audio engine initializes on first user interaction
     */
    setupAudioInteraction() {
        this._audioInteractionController?.abort();
        this._audioInteractionController = new AbortController();
        const listenerOptions = { signal: this._audioInteractionController.signal };
        const initAudio = async () => {
            try {
                if (this.audioEngine) {
                    console.log('[RISE] First interaction - Initializing audio context');
                    await this.audioEngine.init();
                    await this.audioEngine.resume();
                    if (this.settings?.enableAmbient) {
                        this.audioEngine.startAmbientPlaylist();
                    }
                }
            } catch (error) {
                console.warn('[RISE] Audio initialization unavailable:', error);
            } finally {
                this._audioInteractionController?.abort();
            }
        };

        window.addEventListener('mousedown', initAudio, listenerOptions);
        window.addEventListener('keydown', initAudio, listenerOptions);
        window.addEventListener('touchstart', initAudio, listenerOptions);
    }

    /**
     * Setup error recovery handlers for different error categories
     */
    setupErrorRecovery() {
        // Audio errors: disable audio and continue
        errorBoundary.registerRecoveryHandler(ErrorCategory.AUDIO, (report) => {
            if (this.settings) {
                this.settings.enableAmbient = false;
                this.settings.enableBinaural = false;
            }
            return this.audioEngine?.stopSession({ resumeAmbient: false, immediate: true });
        });

        // Visual errors: disable visual interlocution
        errorBoundary.registerRecoveryHandler(ErrorCategory.VISUAL, (report) => {
            endVisualInterlocutionSession();
            visualCortex.updateConfig({ enabled: false });
        });

        // Navigation errors: return to portal
        errorBoundary.registerRecoveryHandler(ErrorCategory.NAVIGATION, (report) => {
            if (this.router) {
                return this.router.navigate('portal');
            }
        });

        // Playback errors: stop current session
        errorBoundary.registerRecoveryHandler(ErrorCategory.PLAYBACK, (report) => {
            endVisualInterlocutionSession();
            if (this.currentSession) {
                this.currentSession = null;
            }
            if (this.router) {
                return this.router.navigate('portal');
            }
        });
    }

    /**
     * Register all view containers and components
     */
    registerViews() {
        // Portal
        this.router.registerView('portal', {
            container: document.getElementById('view-portal'),
            init: async (container) => {
                const { Portal } = await import('./components/Portal.js');
                return new Portal(container, {
                    onNavigate: this.handleNavigate,
                    onQuickAccess: () => this.quickAccess()
                });
            }
        });

        // Public release threshold
        this.router.registerView('keystones', {
            container: document.getElementById('view-keystones'),
            init: async (container, data) => {
                const { Keystones } = await import('./components/Keystones.js');
                return new Keystones(container, {
                    initialSlug: data?.slug || null,
                    onNavigate: this.handleNavigate,
                    onLaunch: slug => this.launchKeystone(slug)
                });
            }
        });

        // Vault
        this.router.registerView('vault', {
            container: document.getElementById('view-vault'),
            init: async (container, data) => {
                const { Vault } = await import('./components/Vault.js');
                return new Vault(container, {
                    onNavigate: this.handleNavigate,
                    onSelectSequence: (sequenceId) => this.handleSequenceSelection(sequenceId),
                    onSelectBlueprint: (blueprint) => this.handleCreateSession(blueprint),
                    onLaunchArchetype: (data) => this.handleArchetypeLaunch(data),
                    personalizedVault: data?.personalizedVault || null
                });
            }
        });

        // Chamber (Orbital Interface - Preparation)
        this.router.registerView('chamber', {
            container: document.getElementById('view-chamber'),
            init: async (container, textData) => {
                const { ChamberOrbital } = await import('./components/ChamberOrbital.js');
                const orbital = new ChamberOrbital(container, {
                    onBeginSession: (sessionConfig) => this.handleBeginSession(sessionConfig),
                    onNavigate: this.handleNavigate
                });

                // If text data was passed from Library, load it
                if (textData?.text) {
                    orbital.loadText(textData.text, textData.source || 'Library', textData.config);
                }

                return orbital;
            }
        });

        // Chamber Session (Immersion - actual playback)
        this.router.registerView('chamber-session', {
            container: document.getElementById('view-chamber'),
            init: async (container, sessionData) => {
                const session = sessionData || this.currentSession;

                if (!session || !session.atoms || session.atoms.length === 0) {
                    console.error('[RISE] Cannot start chamber: no session data or atoms');
                    this.showToast('No content available for session', 3000);
                    this.router.back();
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
                            this.showToast('Visual flashes remain off until the safety notice is accepted.', 4000);
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
                    this.showLoading('Preparing Session');

                    // Start the selected neural voice during preparation, not
                    // after the first atom is already on screen. It builds a
                    // contiguous eight-phrase lead while the rest of session
                    // setup proceeds; the Chamber is not shown until that
                    // lead is ready (or preparation degrades cleanly).
                    let recitationReady = Promise.resolve(false);
                    if (session.recitation?.enabled === true) {
                        this.updateLoadingStatus('Preparing spoken voice...');
                        const { Voice } = await import('./audio/voice.js');
                        recitationVoice = new Voice({
                            audioEngine: this.audioEngine,
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
                        this.updateLoadingStatus('Stabilizing carrier frequencies...');
                        this.audioEngine.stopAmbient();
                        this.audioEngine.sessionActive = true;
                        const durationSec = (session.totalDuration || 0) / 1000;
                        await this.audioEngine.startSession({
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
                        this.audioEngine.stopAmbient();
                        this.audioEngine.sessionActive = true;
                    }

                    // Create Player instance
                    this.updateLoadingStatus('Creating player...');
                    const player = new Player(session);

                    // The player is the sole clock: entrainment ramps
                    // follow canonical reading progress, so pauses,
                    // visual presences, and hidden tabs hold the beat
                    // instead of letting wall time drift it forward.
                    if (hasAudio) {
                        player.on('progress', ({ progress }) => {
                            this.audioEngine.setEntrainmentPosition(progress);
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
                        this.updateLoadingStatus('Loading visual engine...');
                        const activeTypes = [];
                        const rawInterlocution = session.visualConfig.interlocution || {};
                        const interlocution = {
                            ...rawInterlocution,
                            ...normalizeVisualSelection(rawInterlocution),
                            wordFill: normalizeWordFill(
                                rawInterlocution.wordFill ?? session.visualConfig?.wordFill
                            )
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
                        // which is managed by the VisualInterlocutionPanel

                        // Responsive interlocutions: score the session's timeline
                        // before preload so the flame queue renders plan-driven
                        // fractals (palette/variations/tone by signal) that cover
                        // the text's emotional arc. Null when responsive is off.
                        let semanticSignals = null;
                        if (interlocution.responsive && session.atoms?.length) {
                            const { scoreAtoms, sampleTrackSignals } = await import('./core/conductor.js');
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
                                // An authored pattern carries the reading's own
                                // subject: WHICH mechanism, WHICH relation.
                                // Without these the cortex falls back to its
                                // defaults and the authored relation is lost
                                // between the compiler and the renderer. Named
                                // for the Atrium, which is gone; the fields are
                                // read by the cortex, the panel and the orbital
                                // and are not going with it.
                                blueprintClimate: interlocution.blueprintClimate ?? 'auto',
                                blueprintMechanism: interlocution.blueprintMechanism ?? null,
                                freedomRelation: interlocution.freedomRelation ?? null,
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
                                    this.showToast(
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



                    this.updateLoadingStatus('Entering chamber...');

                    const { Chamber } = await import('./components/Chamber.js');

                    if (recitationVoice) {
                        this.updateLoadingStatus('Building the spoken lead...');
                        await recitationReady;
                    }

                    // Brief delay for smooth transition
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Hide loading overlay
                    this.hideLoading();

                    // Create Chamber instance with player
                    return new Chamber(container, {
                        session: session,
                        player: player,
                        voice: recitationVoice,
                        autoStart: true,
                        onEnterStream: activateDeferredVisuals,
                        onExit: (reason, data) => {
                            // Cleanup
                            player.stop();
                            endVisualInterlocutionSession();
                            visualCortex.updateConfig({ enabled: false });
                            this.audioEngine.stopSession();

                            // Force disposal of the instance so next session starts fresh
                            const view = this.router.views.get('chamber-session');
                            if (view && view.instance) {
                                view.instance.destroy();
                                view.instance = null;
                            }

                            if (reason === 'continue') {
                                void this.continueLibraryReading(session);
                            } else if (reason === 'workshop' && data && data.text) {
                                this.router.navigate('workshop', {
                                    data: { draftIntent: 'new-recursion', text: data.text }
                                });
                            } else if (session.isPreview && (reason === 'back' || reason === 'exit' || reason === 'close')) {
                                this.router.navigate('workshop'); // Isolate previews
                            } else if (reason === 'back' || reason === 'exit' || reason === 'close') {
                                this.router.navigate('chamber'); // Back to orbital prep
                            }
                        }
                    });
                } catch (error) {
                    console.error('[RISE] Session initialization failed:', error);
                    recitationVoice?.destroy();
                    endVisualInterlocutionSession();
                    visualCortex.updateConfig({ enabled: false });
                    await this.audioEngine.stopSession({
                        resumeAmbient: this.settings?.enableAmbient === true,
                        immediate: true
                    }).catch(() => {});
                    this.hideLoading();
                    this.showToast('Failed to initialize session', 3000);
                    this.router.back();
                    return { destroy: () => { } };
                }
            }
        });

        // Library
        this.router.registerView('library', {
            container: document.getElementById('view-library'),
            init: async (container) => {
                const { Library } = await import('./components/Library.js');
                return new Library(container, {
                    onNavigate: this.handleNavigate,
                    onSelectText: (text, source, config) => this.handleTextSelection(text, source, config)
                });
            }
        });

        // Journeys — authored transformations across works. Launches
        // DIRECTLY into the reading rather than through the orbital: a
        // published Journey's pace and imagery are the author's, not
        // knobs a reader finds on the way in (JOURNEYS-SPEC §3.3).
        this.router.registerView('journeys', {
            container: document.getElementById('view-journeys'),
            init: async (container) => {
                const { Journeys } = await import('./components/Journeys.js');
                return new Journeys(container, {
                    onNavigate: this.handleNavigate,
                    onBeginSession: (config) => this.handleBeginSession(config)
                });
            }
        });

        // Workshop
        this.router.registerView('workshop', {
            container: document.getElementById('view-workshop'),
            init: async (container, data) => {
                const { Workshop } = await import('./components/Workshop.js');
                const ws = new Workshop(container, {
                    onNavigate: this.handleNavigate,
                    onCreateSession: this.handleCreateSession
                });

                if (data) {
                    ws.update(data);
                }

                return ws;
            }
        });

        this.router.registerView('settings', {
            container: document.getElementById('view-settings'),
            init: async (container) => {
                const { Settings } = await import('./components/Settings.js');
                return new Settings(container, {
                    settings: this.settings,
                    onNavigate: this.handleNavigate,
                    onChange: this.handleSettingsChange,
                    onDataCleared: this.handleDataCleared
                });
            }
        });

        // The Rosarium — the Rosary's own room, entered from the Chapel
        this.router.registerView('rosarium', {
            container: document.getElementById('view-rosarium'),
            init: async (container, data) => {
                const { Rosarium } = await import('./components/Rosarium.js');
                return new Rosarium(container, {
                    onNavigate: this.handleNavigate,
                    setId: data?.setId,
                    iconId: data?.iconId,
                    door: data?.door === true
                });
            }
        });

        // The Curia — the visual canon's curation surface, entered
        // through the portal's quiet bottom-left door
        this.router.registerView('curia', {
            container: document.getElementById('view-curia'),
            init: async (container) => {
                const { Curia } = await import('./components/Curia.js');
                return new Curia(container, { onNavigate: this.handleNavigate });
            }
        });

        // The Scriptorium — Live Curator doorway (additive; Workshop
        // buttons remain until this room is proven).
        this.router.registerView('scriptorium', {
            container: document.getElementById('view-scriptorium'),
            init: async (container) => {
                const { Scriptorium } = await import('./components/Scriptorium.js');
                const room = new Scriptorium(container, {
                    onNavigate: this.handleNavigate,
                    onCreateSession: this.handleCreateSession
                });
                room.mount();
                return room;
            }
        });

        // The Via — the Stations of the Cross, entered from the Chapel
        this.router.registerView('via', {
            container: document.getElementById('view-via'),
            init: async (container) => {
                const { Via } = await import('./components/Via.js');
                return new Via(container, { onNavigate: this.handleNavigate });
            }
        });

        // The Chapel (Scripture — entered only through the portal's
        // sanctuary lamp; never in the nav row)
        this.router.registerView('chapel', {
            container: document.getElementById('view-chapel'),
            init: async (container, data) => {
                const { Chapel } = await import('./components/Chapel.js');
                return new Chapel(container, {
                    onNavigate: this.handleNavigate,
                    bookId: data?.bookId,
                    chapter: data?.chapter,
                    onLaunchRosary: (setId, extras) => {
                        // The Rosary has its own room — the Rosarium —
                        // rather than borrowing the Chamber
                        this.router.navigate('rosarium', {
                            data: { setId, iconId: extras?.iconId ?? null }
                        });
                    },
                    onLaunchReading: async (bookId, chapter, extras) => {
                        try {
                            const { createChapelHandoff } = await import('./content/chapel/handoff.js');
                            const chamberData = await createChapelHandoff(bookId, {
                                ...(chapter == null ? {} : { chapter }),
                                ...(extras?.iconId ? { iconId: extras.iconId } : {})
                            });
                            await this.router.navigate('chamber', { data: chamberData });
                        } catch (error) {
                            console.error('[RISE] Chapel handoff failed:', error);
                            // Reverent degradation: a quiet message, never a
                            // substituted text and never an error surface
                            this.showToast(
                                error?.code === 'CHAPEL_PAYLOAD_INTEGRITY'
                                    ? 'This book did not verify and will not be read.'
                                    : 'This book is unavailable right now.',
                                4000
                            );
                        }
                    }
                });
            }
        });

    }

    /**
     * Handle navigation requests from components
     */
    handleNavigate(viewName, data) {
        // Keystone URLs are real entry points, not a hash painted onto an
        // unrelated view. Leaving the release corridor explicitly returns
        // the browser to the application root so reload and Back agree with
        // the surface the reader can actually see.
        if (viewName === 'keystones'
            && !/^\/(?:try-rise|keystone(?:\/|$))/u.test(window.location.pathname)) {
            window.history.pushState({}, '', '/try-rise');
        }
        if (viewName === 'portal'
            && /^\/(?:try-rise|keystone(?:\/|$))/u.test(window.location.pathname)) {
            window.history.pushState({}, '', '/');
        }
        this.router.navigate(viewName, { data });
    }

    /**
     * Handle sequence selection from Library
     * @param {string} sequenceId - ID of the selected starter sequence
     */
    async handleSequenceSelection(sequenceId) {
        console.log('[RISE] Sequence selected:', sequenceId);

        // Import starter sequences
        const { STARTER_SEQUENCES } = await import('./content/starters.js');

        // Find the sequence
        const sequence = STARTER_SEQUENCES.find(s => s.id === sequenceId);
        if (!sequence) {
            console.error('[RISE] Sequence not found:', sequenceId);
            this.showToast('Sequence not found', 3000);
            return;
        }

        // Store and navigate directly to chamber (orbital) securely
        this.router.navigate('chamber', {
            data: {
                text: sequence.content,
                source: sequence.name,
                config: {
                    wpm: sequence.wpm,
                    curve: sequence.curve,
                    audioPreset: sequence.audioPreset || 'silent',
                    soundscape: sequence.soundscape || 'none',
                    origin: { view: 'library', icon: '◇', name: 'Library' }
                }
            }
        });
    }

    /**
     * Handle archetype launch from Vault
     * Merges archetype config with sequence content and navigates to Chamber
     * @param {Object} data - { archetype, sequence, config }
     */
    handleArchetypeLaunch(data) {
        console.log('[RISE] Archetype launch:', data.archetype.name, 'with sequence:', data.sequence.name);

        const { archetype, sequence, config } = data;

        // Navigate to Chamber with full archetype configuration
        this.router.navigate('chamber', {
            data: {
                text: sequence.content,
                source: `${archetype.name}: ${sequence.name}`,
                config: {
                    wpm: config.wpm,
                    curve: config.curve,
                    // A curated sequence may author its own chunking —
                    // the reading unit is part of the curation, not a
                    // leftover of the reader's last session
                    ...(config.chunkMode ? { chunkMode: config.chunkMode } : {}),
                    audioPreset: config.audioPreset || 'silent',
                    soundscape: config.soundscape || 'none',
                    visualConfig: config.visualConfig || { visualMode: 'off' },
                    origin: { view: 'vault', icon: '◈', name: 'Vault' }
                }
            }
        });
    }

    /**
     * Handle text selection from Library (for Chamber orbital)
     * @param {string} text - The selected text content
     * @param {string} source - Source identifier
     */
    handleTextSelection(text, source, config = {}) {
        // Navigate back to Chamber with text data
        this.router.navigate('chamber', {
            data: {
                text,
                source,
                config: {
                    ...config,
                    origin: { view: 'library', icon: '◇', name: 'Library' }
                }
            }
        });
    }

    /**
     * Continue an ordinary Archive work without weakening edition identity.
     * Journeys and other authored programs never receive this descriptor and
     * therefore retain authority over their own boundaries.
     */
    async continueLibraryReading(session) {
        try {
            const [{ ArchiveTextProvider }, { resolveNextLibraryDivision }] = await Promise.all([
                import('./sources/text/archive.js'),
                import('./core/reading-continuation.js')
            ]);
            const provider = new ArchiveTextProvider();
            const contents = await provider.getContents(session?.continuation?.workId);
            const next = resolveNextLibraryDivision(session?.continuation, contents);
            if (!next) {
                this.showToast('This was the final division in the work.', 3000);
                this.router.navigate('library', { replace: true });
                return;
            }

            const itemName = contents.item?.name || session.continuation.workId;
            const entryLabel = next.entry.title
                ? `${next.entry.label} — ${next.entry.title}`
                : next.entry.label;
            const visualConfig = {
                ...(session.visualConfig || {}),
                // Consent is granted to one temporal session, not forever to
                // a work. A flashing successor must cross the boundary again.
                consentScope: crypto.randomUUID()
            };
            const nextSession = compileSession({
                title: `${itemName} · ${entryLabel}`,
                text: next.entry.content,
                textSource: `${itemName} · ${entryLabel}`,
                wpm: session.wpm,
                chunkMode: session.chunkMode,
                curve: session.curve,
                displayMode: session.displayMode,
                verseLines: next.entry.verse === true,
                revealMode: session.revealMode,
                audioPreset: session.audioPreset,
                soundscape: session.soundscape,
                entrainmentMode: session.entrainmentMode,
                entrainmentWaveform: session.entrainmentWaveform,
                visualConfig,
                origin: session.origin,
                provenance: session.provenance,
                continuation: next.continuation,
                capabilities: session.capabilities,
                recitation: session.recitation,
                voiceId: session.voiceId,
                selectedSwellId: session.selectedSwellId,
                projection: session.projection
            });

            this.currentSession = nextSession;
            await this.router.navigate('chamber-session', {
                data: nextSession,
                force: true,
                replace: true,
                skipStack: true
            });
        } catch (error) {
            console.error('[RISE] Archive continuation refused:', error);
            this.showToast(error.message || 'The next Archive division could not be opened.', 5000);
            await this.router.navigate('library', { replace: true });
        }
    }

    /**
     * Create a full Session object from a starter sequence
     * @param {Object} sequence - Starter sequence data
     * @returns {Session} - Full session with atoms
     */
    async createSessionFromSequence(sequence) {
        return compileSession({
            title: sequence.name,
            text: sequence.content,
            textSource: sequence.name,
            wpm: sequence.wpm ?? sequence.config?.wpm,
            chunkMode: sequence.chunkMode ?? sequence.config?.chunkMode,
            curve: sequence.curve ?? sequence.config?.curve,
            displayMode: 'focal',
            audioPreset: 'silent',
            visualConfig: {
                enabled: false
            }
        });
    }

    /**
     * Handle begin session from ChamberOrbital
     * Convert orbital config into full session with atoms
     */
    async handleBeginSession(sessionConfig) {
        console.log('[RISE] Beginning session from orbital config:', sessionConfig);
        let session;
        try {
            session = compileSession({
                ...sessionConfig,
                title: sessionConfig.source || sessionConfig.textSource || 'Session'
            });
        } catch (error) {
            console.error('[RISE] Session compilation failed:', error);
            this.showToast(error.message || 'Unable to compile session', 4000);
            return;
        }

        console.log('[RISE] Created session:', session);
        console.log('[RISE] Session atoms:', session.atoms);
        console.log('[RISE] Session.atoms[0]:', session.atoms[0]);

        // Store and navigate to chamber-session (immersion)
        this.currentSession = session;
        this.router.navigate('chamber-session', { data: session });
    }

    /** Resolve, compile, and launch an exact canonical composition. */
    async launchKeystone(slug) {
        try {
            const [keystones, archive] = await Promise.all([
                import('./content/keystones.js'),
                import('./content/archive/index.js')
            ]);
            const result = await keystones.resolveKeystone(slug, {
                allowIncomplete: archive.archiveReviewEnabled()
            });
            if (!result.sessionInput) {
                const reason = result.blockers[0]?.message || 'This Keystone is not yet admitted.';
                this.showToast(reason, 5000);
                return;
            }
            const path = keystones.keystonePath(slug);
            if (window.location.pathname !== path) {
                window.history.pushState({}, '', path);
            }
            await this.handleBeginSession(result.sessionInput);
        } catch (error) {
            console.error('[RISE] Keystone launch refused:', error);
            this.showToast(error.message || 'This Keystone could not be opened.', 5000);
        }
    }

    /**
     * Handle session creation from Workshop / Vault / SOL blueprints.
     * Hydrates durable sequence images before compileSession.
     */
    async handleCreateSession(sessionData) {
        let sessionInput = isWorkshopProject(sessionData)
            ? workshopProjectToSessionConfig(sessionData)
            : sessionData;
        try {
            const { hydrateSessionSequenceAssets } = await import('./core/workshop-asset-durability.js');
            sessionInput = await hydrateSessionSequenceAssets(sessionInput);
            // A MISSING IMAGE IS NOT A REASON TO WITHHOLD THE TEXT. The
            // reading opens; the reader is told what is not in it. This
            // path used to return here, so one evicted blob cancelled the
            // whole session — the opposite of the rule the imagery has
            // followed everywhere else.
            const missing = sessionInput?.missingSequenceAssets;
            if (missing?.length) {
                // Read and removed — the report is for the reader, not for
                // the compiler, which should never see a key it does not
                // define.
                const { missingSequenceAssets, ...rest } = sessionInput;
                sessionInput = rest;
                console.warn('[RISE] Workshop media missing, reading proceeds without:', missing);
                this.showToast(
                    missing.length === 1
                        ? 'One sequence image is no longer stored — reading without it'
                        : `${missing.length} sequence images are no longer stored — reading without them`,
                    4000
                );
            }
        } catch (error) {
            // Reserved for a payload that cannot be read at all. A missing
            // image no longer reaches here.
            console.error('[RISE] Workshop media hydrate failed:', error);
            this.showToast(error.message || 'Sequence images could not be loaded', 4000);
            return;
        }
        console.log('[RISE] Compiling Custom Workshop Session:', sessionInput);

        if (!sessionInput || !sessionInput.sources || sessionInput.sources.length === 0) {
            this.showToast('Cannot create session without sources', 3000);
            return;
        }

        // The canonical compiler chunks each source independently, retains
        // provenance, and inserts a timing-locked source boundary.
        let session;
        try {
            session = compileSession({
                ...sessionInput,
                title: sessionInput.title || `Custom Sequence (${sessionInput.sources.length} sources)`,
                isCustom: true
            });
        } catch (error) {
            console.error('[RISE] Workshop compilation failed:', error);
            this.showToast(error.message || 'Unable to compile sequence', 4000);
            return;
        }

        console.log(`[RISE] Workshop compiler built ${session.atomCount} atoms across ${session.sources.length} sources.`);

        // 4. Route to player phase
        this.currentSession = session;

        // Ensure that preview mode routing flag passes correctly if requested
        if (sessionInput.isPreview) {
            session.isPreview = true;
        }

        this.router.navigate('chamber-session', { data: session });
    }

    /**
     * Quick access to last session type (from Portal sigil)
     */
    quickAccess() {
        // If we have a recent session, go to Chamber
        // Otherwise go to Vault
        if (this.currentSession) {
            this.router.navigate('chamber', { data: this.currentSession });
        } else {
            this.router.navigate('vault');
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const defaultSettings = {
            // Display
            fontSize: 'medium',
            chamberFace: 'literary',
            chamberMask: false,
            showProgress: true,
            showDuration: true,
            showArtworkLabels: true,

            // Audio
            enableAmbient: false,
            masterVolume: 0.75,
            enableBinaural: false,

            // Safety / Accessibility
            photosensitivityMode: false,
            reducedMotion: false,

            // Where the reading band sits, as a fraction of the travel
            // it has inside the field. Zero is centred.
            bandOffset: 0,

            // Session defaults
            defaultWpm: 220,
            defaultCurve: 'flat',
            defaultAudioPreset: 'silent'
        };

        try {
            const stored = localStorage.getItem('rise-settings');
            const parsed = stored ? JSON.parse(stored) : {};
            const candidate = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            const merged = { ...defaultSettings, ...candidate };
            merged.bandOffset = clampBandFraction(merged.bandOffset);
            const fontSizes = new Set(['small', 'medium', 'large']);
            const curves = new Set(['flat', 'induction', 'ascent', 'wave', 'climax']);
            const booleanKeys = [
                'showProgress',
                'showDuration',
                'showArtworkLabels',
                'enableAmbient',
                'enableBinaural',
                'photosensitivityMode',
                'reducedMotion',
                'chamberMask'
            ];
            this.settings = {
                ...defaultSettings,
                fontSize: fontSizes.has(merged.fontSize) ? merged.fontSize : defaultSettings.fontSize,
                chamberFace: resolveChamberStreamFace(merged.chamberFace),
                masterVolume: Number.isFinite(Number(merged.masterVolume))
                    ? Math.max(0, Math.min(1, Number(merged.masterVolume)))
                    : defaultSettings.masterVolume,
                // The same window the reading engine performs at, so a pace
                // this accepts is a pace the reader actually gets. `null` and
                // `''` reach the default rather than Number()'s 0 and the
                // floor it clamps to.
                defaultWpm: clampReadingWpm(merged.defaultWpm, defaultSettings.defaultWpm),
                defaultCurve: curves.has(merged.defaultCurve) ? merged.defaultCurve : defaultSettings.defaultCurve,
                defaultAudioPreset: typeof merged.defaultAudioPreset === 'string'
                    ? merged.defaultAudioPreset.slice(0, 80)
                    : defaultSettings.defaultAudioPreset
            };
            for (const key of booleanKeys) this.settings[key] = merged[key] === true;
        } catch (e) {
            console.warn('[RISE] Could not load settings:', e);
            this.settings = defaultSettings;
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('rise-settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('[RISE] Could not save settings:', e);
        }
    }

    /**
     * Handle settings changes
     */
    handleSettingsChange(key, value) {
        // A pace is bounded where it is chosen, not where it is read. Stored
        // unbounded, a 5,000 would sit in Settings looking accepted and be
        // overridden to 1,000 by every surface that later read it.
        this.settings[key] = key === 'defaultWpm'
            ? clampReadingWpm(value, this.settings.defaultWpm)
            : key === 'chamberFace'
                ? resolveChamberStreamFace(value)
                : key === 'chamberMask'
                    ? value === true
                    : value;
        this.saveSettings();

        // Apply certain settings immediately
        if (['reducedMotion', 'photosensitivityMode', 'fontSize', 'chamberFace', 'showProgress', 'showDuration'].includes(key)) {
            this.applyAccessibilitySettings();
        }

        if (key === 'masterVolume' && this.audioEngine) {
            this.audioEngine.setMasterVolume(value);
        }
        if (key === 'chamberFace' || key === 'chamberMask') {
            const chamber = this.router?.getViewInstance?.('chamber-session');
            chamber?.applyChamberStreamFace?.();
            chamber?.applyChamberMask?.();
        }
        if (key === 'showArtworkLabels') {
            visualCortex.setArtworkLabelsVisible(value);
        }
        if (key === 'enableAmbient' && this.audioEngine?.isInitialized && !this.audioEngine.sessionActive) {
            if (value) this.audioEngine.startAmbientPlaylist();
            else this.audioEngine.stopAmbient(true);
        }
    }

    handleDataCleared() {
        this.currentSession = null;
        window.setTimeout(() => window.location.reload(), 300);
    }

    /**
     * Apply accessibility settings to document
     */
    applyAccessibilitySettings() {
        const root = document.documentElement;

        // Check OS preference for reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Apply reduced motion if user or OS preference is set
        if (this.settings?.reducedMotion || prefersReducedMotion) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }

        // Apply photosensitivity mode
        if (this.settings?.photosensitivityMode) {
            root.classList.add('photosensitivity-mode');
            visualCortex.cancelPresentation('photosensitivity');
        } else {
            root.classList.remove('photosensitivity-mode');
        }
        // The Continuous Field runs on its own clock, so a live
        // photosensitivity toggle must be pushed to it (the flash economy
        // re-checks per flash; the field does not). Suspends it when the
        // mode turns on, resumes it when the mode clears.
        visualCortex.syncSafety();

        root.dataset.fontSize = this.settings?.fontSize || 'medium';
        root.dataset.chamberFace = resolveChamberStreamFace(this.settings?.chamberFace);
        root.classList.toggle('hide-session-progress', this.settings?.showProgress === false);
        root.classList.toggle('hide-session-duration', this.settings?.showDuration === false);
        visualCortex.setArtworkLabelsVisible(this.settings?.showArtworkLabels !== false);
    }

    /**
     * Show loading overlay
     */
    showLoading(title = 'Loading') {
        const overlay = document.getElementById('loading-overlay');
        const textEl = overlay?.querySelector('.loading-text');
        const statusEl = document.getElementById('loading-status');

        if (textEl) textEl.textContent = title;
        if (statusEl) statusEl.textContent = 'Initializing...';

        if (overlay) {
            overlay.classList.remove('hidden', 'fade-out');
        }
    }

    /**
     * Update loading status text
     */
    updateLoadingStatus(status) {
        const statusEl = document.getElementById('loading-status');
        if (statusEl) statusEl.textContent = status;
    }

    /**
     * Hide loading overlay with fade
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 400);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Setup listeners for global utility events (Guide, Settings)
     */
    setupUtilityListeners() {
        this._utilityController?.abort();
        this._utilityController = new AbortController();
        const options = { signal: this._utilityController.signal };
        window.addEventListener('rise-open-guide', () => {
            this.showGuide();
        }, options);

        window.addEventListener('rise-open-settings', () => {
            this.router?.navigate('settings');
        }, options);

        // `#rosary` is the door. The router does not own hashes, so an
        // already-open session that lands on the hash without a reload
        // is handled here. Clearing the hash does not yank a reader
        // out of an in-progress Rosary.
        window.addEventListener('hashchange', () => {
            this.handleRosaryDoorHash();
        }, options);

        // Router history is intentionally internal for most of RISE. The
        // three public Keystone paths are the exception: browser Back and
        // Forward must resolve the same threshold that a cold request does.
        window.addEventListener('popstate', async () => {
            // Hash navigation belongs to the Rosary door. Browsers may emit
            // popstate alongside hashchange, and clearing the hash must not
            // pull an in-progress prayer back to the Portal.
            if (isRosaryDoor() || this.router?.getCurrentView() === 'rosarium') return;
            const { isTryRisePath, keystoneSlugFromPath } = await import('./content/keystones.js');
            const slug = keystoneSlugFromPath(window.location.pathname);
            if (slug || isTryRisePath(window.location.pathname)) {
                await this.router?.navigate('keystones', {
                    data: slug ? { slug } : undefined,
                    replace: true,
                    skipStack: true
                });
                return;
            }
            await this.router?.navigate('portal', {
                replace: true,
                skipStack: true
             });
         }, options);
    }

    /**
     * Same-tab `#rosary` after boot. Cold load still uses the
     * initializeApp path. Does not write location.hash.
     */
    handleRosaryDoorHash() {
        if (!isRosaryDoor() || !this.router) return;
        const onDoorSit = this.router.getCurrentView() === 'rosarium'
            && this.router.getViewInstance('rosarium')?.door === true;
        if (onDoorSit) return;
        return this.router.navigate('rosarium', { data: { door: true } });
    }

    /**
     * Show the Guide modal
     */
    async showGuide() {
        if (this.guideInstance || this._guideLoading) return;
        this._guideLoading = true;

        const container = document.createElement('div');
        container.id = 'guide-container';
        document.body.appendChild(container);

        try {
            const { Guide } = await import('./components/Guide.js');
            this.guideInstance = new Guide(container, {
                onClose: () => {
                    this.guideInstance?.destroy();
                    this.guideInstance = null;
                    container.remove();
                }
            });
        } catch (error) {
            container.remove();
            console.error('[RISE] Guide failed to load:', error);
            this.showToast('Guide unavailable', 3000);
        } finally {
            this._guideLoading = false;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this._audioInteractionController?.abort();
        this._utilityController?.abort();
        if (this.router) {
            this.router.destroy();
        }
        if (this.audioEngine) {
            this.audioEngine.destroy();
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.rise = new App();
    window.rise.init().catch(err => {
        console.error('[RISE] Initialization failed:', err);
    });
});

export default App;
