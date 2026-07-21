/*
 * R.I.S.E. — Main Application
 * Recursive Installation of Symbolic Experience
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
import { VISUAL_PRESENCE_DEFAULT_MS } from './core/visual-presence.js';
import { compileSession } from './core/session-compiler.js';
import { MemoryCore } from './core/memory.js';
import { initSourceSystem } from './sources/index.js';
import { BetaGate } from './components/BetaGate.js';
import './components/BetaGate.css';

import { visualCortex } from './visuals/visual-cortex.js';
import { errorBoundary, ErrorCategory, ErrorSeverity } from './core/error-boundary.js';
import {
    beginVisualInterlocutionSession,
    endVisualInterlocutionSession,
    requestVisualInterlocutionConsent
} from './core/visual-safety.js';
import { normalizeVisualSelection } from './core/visual-selection.js';

// Import styles
import './design-system.css';
import './components/Portal.css';
import './components/Atrium.css';
import './components/ChamberOrbital.css';
import './components/Chamber.css';
import './components/Library.css';
import './components/Workshop.css';
import './components/Settings.css';
import './components/Guide.css';
import './components/Sol.css';
import './premium-additions.css';

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

                    console.log('[R.I.S.E.] Beta access granted:', session.name);
                    this.betaSession = session;

                    try {
                        await this.initializeApp({
                            personalizedVault: session.vault || null
                        });
                        gateContainer.remove();
                        resolve(true);
                    } catch (error) {
                        accessHandled = false;
                        console.error('[R.I.S.E.] Application initialization failed:', error);
                        gateContainer.hidden = false;
                        gateContainer.replaceChildren();
                        const recovery = document.createElement('div');
                        recovery.className = 'beta-gate beta-gate-error';
                        const message = document.createElement('p');
                        message.textContent = 'R.I.S.E. could not initialize in this browser session.';
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
        console.log('[R.I.S.E.] Loading personalized vault:', vaultId);
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
                console.log(`[R.I.S.E.] View: ${view}`);
            }
        });

        // Register views
        this.registerViews();

        // Navigate to personalized vault or portal
        if (options.personalizedVault) {
            console.log('[R.I.S.E.] Navigating directly to personalized vault:', options.personalizedVault);
            await this.router.navigate('vault', { data: { personalizedVault: options.personalizedVault } });
        } else {
            await this.router.navigate('portal');
        }

        // Setup global utility listeners
        this.setupUtilityListeners();

        // Audio interaction listener is already set up in init()

        console.log('[R.I.S.E.] Application initialized');
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
                    console.log('[R.I.S.E.] First interaction - Initializing audio context');
                    await this.audioEngine.init();
                    await this.audioEngine.resume();
                    if (this.settings?.enableAmbient) {
                        this.audioEngine.startAmbientPlaylist();
                    }
                }
            } catch (error) {
                console.warn('[R.I.S.E.] Audio initialization unavailable:', error);
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

        // Atrium (interpretive philosophy and history discovery)
        this.router.registerView('atrium', {
            container: document.getElementById('view-atrium'),
            init: async (container, data) => {
                const { Atrium } = await import('./components/Atrium.js');
                return new Atrium(container, {
                    onNavigate: this.handleNavigate,
                    onConfigureLaunch: async (launch, origin) => {
                        try {
                            const { createAtriumJourneyHandoff } = await import('./content/atrium/handoff.js');
                            const chamberData = await createAtriumJourneyHandoff(launch, { origin });
                            await this.router.navigate('chamber', { data: chamberData });
                        } catch (error) {
                            console.error('[R.I.S.E.] Atrium handoff failed:', error);
                            this.showToast(
                                error?.code === 'ATRIUM_JOURNEY_NOT_READY'
                                    ? 'This Atrium journey is still under editorial review.'
                                    : 'Unable to verify this Atrium content pack.',
                                4000
                            );
                        }
                    },
                    domain: data?.domain,
                    viewMode: data?.viewMode,
                    selectedId: data?.selectedId,
                    expandedJourneyId: data?.expandedJourneyId
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
                    console.error('[R.I.S.E.] Cannot start chamber: no session data or atoms');
                    this.showToast('No content available for session', 3000);
                    this.router.back();
                    return { destroy: () => { } };
                }

                let visualMode = session.visualConfig?.visualMode || 'off';
                try {
                    // Consent is an interaction phase, not a loading task. It
                    // must resolve before the opaque preparation overlay can
                    // cover the page, and before audio or Player ownership
                    // begins. Acceptance becomes a one-session capability.
                    if (visualMode === 'interlocution') {
                        const consentScope = session.visualConfig?.consentScope;
                        const consented = await requestVisualInterlocutionConsent(consentScope);
                        const activated = consented && beginVisualInterlocutionSession(consentScope);
                        if (!activated) {
                            visualMode = 'off';
                            session.visualConfig = { ...session.visualConfig, visualMode: 'off' };
                            this.showToast('Visual flashes remain off until the safety notice is accepted.', 4000);
                        }
                    } else {
                        endVisualInterlocutionSession();
                    }

                    // Only enter the non-interactive preparation phase after
                    // the safety decision has completed.
                    this.showLoading('Preparing Session');

                    // Start audio initialization early to minimize lag on chamber entry.
                    // It belongs inside this failure boundary so blocked Web Audio cannot
                    // strand the loading overlay or the router transition.
                    const hasSoundscape = session.soundscape && session.soundscape !== 'none';
                    const hasAudio = (session.audioPreset && session.audioPreset !== 'silent') || session.selectedSwellId || hasSoundscape;

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

                    // Configure visual cortex based on the consented mode.
                    if (visualMode === 'interlocution') {
                        this.updateLoadingStatus('Loading visual engine...');
                        const activeTypes = [];
                        const rawInterlocution = session.visualConfig.interlocution || {};
                        const interlocution = {
                            ...rawInterlocution,
                            ...normalizeVisualSelection(rawInterlocution)
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
                            console.log('[R.I.S.E.] Responsive interlocutions: track scored,',
                                semanticSignals ? `${semanticSignals.length} flame seed signals sampled` : 'mood off (no flame seeding)');
                        }

                            visualCortex.updateConfig({
                                enabled: true,
                                frequency: interlocution.frequency ?? 0.2,
                                duration: interlocution.duration ?? VISUAL_PRESENCE_DEFAULT_MS,
                                renderLanguage: interlocution.renderLanguage === 'ascii' ? 'ascii' : 'native',
                                presentation: interlocution.presentation === 'behind-stream' ? 'behind-stream' : 'full-frame',
                                activeTypes: activeTypes,
                                kleePreset: interlocution.kleePreset ?? 'random',
                                harmonographClimate: interlocution.harmonographClimate ?? 'auto',
                                customVisuals: session.customVisuals || [],
                                // Resolve stable Global Pool IDs once at
                                // session entry. The flash hot path receives a
                                // pinned URI set and never rereads shared state.
                                globalVisuals: interlocution.sourced?.includes('global-pool')
                                    ? MemoryCore.resolveGlobalImageUris(interlocution.globalPool)
                                    : [],
                                sourced: interlocution.sourced || [],
                                semanticSignals: semanticSignals
                            });

                        // Preload visuals
                        const estimatedFlashCount = estimateInterlocutionCount(
                            session,
                            interlocution.frequency ?? 0.2
                        );
                        await visualCortex.preload(estimatedFlashCount);
                    } else if (visualMode === 'focals') {
                        // Focals mode: persistent gentle focal point (handled by Chamber renderer)
                        // No visual cortex preloading needed - focals are persistent, not probabilistic
                        console.log('[R.I.S.E.] Focals mode active:', session.visualConfig.focals);
                    } else if (visualMode === 'attractor') {
                        // Attractor mode: persistent strange-attractor field (handled by Chamber renderer)
                        // No visual cortex preloading needed - the field is continuous, not probabilistic
                        console.log('[R.I.S.E.] Attractor mode active:', session.visualConfig.attractor);
                    } else if (visualMode === 'genesis') {
                        // Genesis mode: continuously growing Klee field (handled by Chamber renderer)
                        console.log('[R.I.S.E.] Genesis mode active:', session.visualConfig.genesis);
                    }



                    // Configure Text-to-Speech if enabled
                    if (session.voiceEnabled) {
                        this.updateLoadingStatus('Configuring voice...');
                        // Set selected voice if specified
                        if (session.voiceId) {
                            await this.audioEngine.setVoice(session.voiceId);
                        }

                        // Set voice rate based on WPM for natural pacing
                        this.audioEngine.setVoiceRateFromWpm(session.wpm || 220);
                        this.audioEngine.setVoiceEnabled(true);

                        // Wire player to use voice-synced timing
                        player.setVoiceSync(true, (text, options) => {
                            this.audioEngine.speak(text, options);
                        });

                        console.log('[R.I.S.E.] TTS enabled for session', session.voiceId ? `(voice: ${session.voiceId})` : '(default voice)');
                    }

                    this.updateLoadingStatus('Entering chamber...');

                    const { Chamber } = await import('./components/Chamber.js');

                    // Brief delay for smooth transition
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Hide loading overlay
                    this.hideLoading();

                    // Create Chamber instance with player
                    return new Chamber(container, {
                        session: session,
                        player: player,
                        autoStart: true,
                        onExit: (reason, data) => {
                            // Cleanup
                            player.stop();
                            endVisualInterlocutionSession();
                            visualCortex.updateConfig({ enabled: false });
                            this.audioEngine.stopSession();

                            // Stop TTS if active
                            if (session.voiceEnabled) {
                                this.audioEngine.stopSpeaking();
                                this.audioEngine.setVoiceEnabled(false);
                            }

                            // Force disposal of the instance so next session starts fresh
                            const view = this.router.views.get('chamber-session');
                            if (view && view.instance) {
                                view.instance.destroy();
                                view.instance = null;
                            }

                            if (reason === 'workshop' && data && data.text) {
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
                    console.error('[R.I.S.E.] Session initialization failed:', error);
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
                    onDataCleared: () => {
                        this.currentSession = null;
                        window.setTimeout(() => window.location.reload(), 300);
                    }
                });
            }
        });

        // Sol
        this.router.registerView('sol', {
            container: document.getElementById('view-sol'),
            init: async (container) => {
                const { Sol } = await import('./components/Sol.js');
                return new Sol(container, {
                    onNavigate: this.handleNavigate,
                    onLaunchSequence: (data) => this.handleSolLaunch(data),
                    // My Day plan entries may bind Workshop blueprints to
                    // windows — same compile path the Vault uses
                    onLaunchBlueprint: (blueprint) => this.handleCreateSession(blueprint)
                });
            }
        });

    }

    /**
     * Handle navigation requests from components
     */
    handleNavigate(viewName, data) {
        this.router.navigate(viewName, { data });
    }

    /**
     * Handle sequence selection from Library
     * @param {string} sequenceId - ID of the selected starter sequence
     */
    async handleSequenceSelection(sequenceId) {
        console.log('[R.I.S.E.] Sequence selected:', sequenceId);

        // Import starter sequences
        const { STARTER_SEQUENCES } = await import('./content/starters.js');

        // Find the sequence
        const sequence = STARTER_SEQUENCES.find(s => s.id === sequenceId);
        if (!sequence) {
            console.error('[R.I.S.E.] Sequence not found:', sequenceId);
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
        console.log('[R.I.S.E.] Archetype launch:', data.archetype.name, 'with sequence:', data.sequence.name);

        const { archetype, sequence, config } = data;

        // Navigate to Chamber with full archetype configuration
        this.router.navigate('chamber', {
            data: {
                text: sequence.content,
                source: `${archetype.name}: ${sequence.name}`,
                config: {
                    wpm: config.wpm,
                    curve: config.curve,
                    audioPreset: config.audioPreset || 'silent',
                    soundscape: config.soundscape || 'none',
                    visualConfig: config.visualConfig || { visualMode: 'off' },
                    origin: { view: 'vault', icon: '◈', name: 'Vault' }
                }
            }
        });
    }

    /**
     * Handle Sol sequence launch
     * Navigates to Chamber with Sol configuration
     * @param {Object} data - { sequence, config }
     */
    handleSolLaunch(data) {
        console.log('[R.I.S.E.] Sol launch:', data.sequence.title);

        const { sequence, config } = data;

        // Navigate to Chamber
        this.router.navigate('chamber', {
            data: {
                text: sequence.content,
                source: `SOL: ${sequence.title}`,
                config: {
                    wpm: config.wpm,
                    curve: config.curve,
                    audioPreset: config.audioPreset || 'silent',
                    soundscape: config.soundscape || 'none',
                    visualConfig: config.visualConfig || { visualMode: 'off' },
                    origin: { view: 'sol', icon: '☀', name: 'SOL' }
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
        console.log('[R.I.S.E.] Beginning session from orbital config:', sessionConfig);
        let session;
        try {
            session = compileSession({
                ...sessionConfig,
                title: sessionConfig.source || sessionConfig.textSource || 'Session'
            });
        } catch (error) {
            console.error('[R.I.S.E.] Session compilation failed:', error);
            this.showToast(error.message || 'Unable to compile session', 4000);
            return;
        }

        console.log('[R.I.S.E.] Created session:', session);
        console.log('[R.I.S.E.] Session atoms:', session.atoms);
        console.log('[R.I.S.E.] Session.atoms[0]:', session.atoms[0]);

        // Store and navigate to chamber-session (immersion)
        this.currentSession = session;
        this.router.navigate('chamber-session', { data: session });
    }

    /**
     * Handle session creation from Workshop
     */
    handleCreateSession(sessionData) {
        console.log('[R.I.S.E.] Compiling Custom Workshop Session:', sessionData);

        if (!sessionData || !sessionData.sources || sessionData.sources.length === 0) {
            this.showToast('Cannot create session without sources', 3000);
            return;
        }

        // The canonical compiler chunks each source independently, retains
        // provenance, and inserts a timing-locked source boundary.
        let session;
        try {
            session = compileSession({
                ...sessionData,
                title: sessionData.title || `Custom Sequence (${sessionData.sources.length} sources)`,
                isCustom: true
            });
        } catch (error) {
            console.error('[R.I.S.E.] Workshop compilation failed:', error);
            this.showToast(error.message || 'Unable to compile sequence', 4000);
            return;
        }

        console.log(`[R.I.S.E.] Workshop compiler built ${session.atomCount} atoms across ${session.sources.length} sources.`);

        // 4. Route to player phase
        this.currentSession = session;

        // Ensure that preview mode routing flag passes correctly if requested
        if (sessionData.isPreview) {
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
            showProgress: true,
            showDuration: true,

            // Audio
            enableAmbient: false,
            masterVolume: 0.75,
            enableBinaural: false,

            // Safety / Accessibility
            photosensitivityMode: false,
            reducedMotion: false,

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
            const fontSizes = new Set(['small', 'medium', 'large']);
            const curves = new Set(['flat', 'induction', 'ascent', 'wave', 'climax']);
            const booleanKeys = ['showProgress', 'showDuration', 'enableAmbient', 'enableBinaural', 'photosensitivityMode', 'reducedMotion'];
            this.settings = {
                ...defaultSettings,
                fontSize: fontSizes.has(merged.fontSize) ? merged.fontSize : defaultSettings.fontSize,
                masterVolume: Number.isFinite(Number(merged.masterVolume))
                    ? Math.max(0, Math.min(1, Number(merged.masterVolume)))
                    : defaultSettings.masterVolume,
                defaultWpm: Number.isFinite(Number(merged.defaultWpm))
                    ? Math.max(50, Math.min(1000, Number(merged.defaultWpm)))
                    : defaultSettings.defaultWpm,
                defaultCurve: curves.has(merged.defaultCurve) ? merged.defaultCurve : defaultSettings.defaultCurve,
                defaultAudioPreset: typeof merged.defaultAudioPreset === 'string'
                    ? merged.defaultAudioPreset.slice(0, 80)
                    : defaultSettings.defaultAudioPreset
            };
            for (const key of booleanKeys) this.settings[key] = merged[key] === true;
        } catch (e) {
            console.warn('[R.I.S.E.] Could not load settings:', e);
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
            console.warn('[R.I.S.E.] Could not save settings:', e);
        }
    }

    /**
     * Handle settings changes
     */
    handleSettingsChange(key, value) {
        this.settings[key] = value;
        this.saveSettings();

        // Apply certain settings immediately
        if (['reducedMotion', 'photosensitivityMode', 'fontSize', 'showProgress', 'showDuration'].includes(key)) {
            this.applyAccessibilitySettings();
        }

        if (key === 'masterVolume' && this.audioEngine) {
            this.audioEngine.setMasterVolume(value);
        }
        if (key === 'enableAmbient' && this.audioEngine?.isInitialized && !this.audioEngine.sessionActive) {
            if (value) this.audioEngine.startAmbientPlaylist();
            else this.audioEngine.stopAmbient(true);
        }
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

        root.dataset.fontSize = this.settings?.fontSize || 'medium';
        root.classList.toggle('hide-session-progress', this.settings?.showProgress === false);
        root.classList.toggle('hide-session-duration', this.settings?.showDuration === false);
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
            console.error('[R.I.S.E.] Guide failed to load:', error);
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
        console.error('[R.I.S.E.] Initialization failed:', err);
    });
});

export default App;
