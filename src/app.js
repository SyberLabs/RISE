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
import { Portal } from './components/Portal.js';
import { ChamberOrbital } from './components/ChamberOrbital.js';
import { Chamber } from './components/Chamber.js';
import { Vault } from './components/Vault.js';
import { Library } from './components/Library.js';
import { Workshop } from './components/Workshop.js';
import { Sol } from './components/Sol.js';
import { Player } from './core/player.js';
import { chunkText } from './core/chunker.js';
import { PacingEngine, StateCurve } from './core/pacing.js';
import { initSourceSystem } from './sources/index.js';
import { Guide } from './components/Guide.js';
import { BetaGate } from './components/BetaGate.js';
import './components/BetaGate.css';

// Instantiate global engine
const pacingEngine = new PacingEngine();
import { Session } from './core/models.js';
import { visualCortex } from './visuals/visual-cortex.js';
import { errorBoundary, ErrorCategory, ErrorSeverity } from './core/error-boundary.js';

// Import styles
import './design-system.css';
import './components/Portal.css';
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
                onAccess: (session) => {
                    if (accessHandled) return; // Prevent double-handling
                    accessHandled = true;

                    console.log('[R.I.S.E.] Beta access granted:', session.name);
                    this.betaSession = session;

                    // Remove the gate
                    gateContainer.remove();

                    // Continue initialization - pass vault ID to skip portal if personalized
                    this.initializeApp({
                        personalizedVault: session.vault || null
                    });

                    resolve(true);
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
        const initAudio = async () => {
            if (this.audioEngine) {
                console.log('[R.I.S.E.] First interaction - Initializing audio context');
                await this.audioEngine.init();
                await this.audioEngine.resume();
                
                // Start menu ambience
                this.audioEngine.startAmbientPlaylist();
            }
            window.removeEventListener('mousedown', initAudio);
            window.removeEventListener('keydown', initAudio);
            window.removeEventListener('touchstart', initAudio);
        };

        window.addEventListener('mousedown', initAudio);
        window.addEventListener('keydown', initAudio);
        window.addEventListener('touchstart', initAudio);
    }

    /**
     * Setup error recovery handlers for different error categories
     */
    setupErrorRecovery() {
        // Audio errors: disable audio and continue
        errorBoundary.registerRecoveryHandler(ErrorCategory.AUDIO, (report) => {
            if (this.audioEngine) {
                this.audioEngine.stop();
            }
            this.settings.enableAmbient = false;
            this.settings.enableBinaural = false;
        });

        // Visual errors: disable visual interlocution
        errorBoundary.registerRecoveryHandler(ErrorCategory.VISUAL, (report) => {
            visualCortex.updateConfig({ enabled: false });
        });

        // Navigation errors: return to portal
        errorBoundary.registerRecoveryHandler(ErrorCategory.NAVIGATION, (report) => {
            if (this.router) {
                this.router.navigate('portal');
            }
        });

        // Playback errors: stop current session
        errorBoundary.registerRecoveryHandler(ErrorCategory.PLAYBACK, (report) => {
            if (this.currentSession) {
                this.currentSession = null;
            }
            if (this.router) {
                this.router.navigate('portal');
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
            init: (container) => {
                return new Portal(container, {
                    onNavigate: this.handleNavigate,
                    onQuickAccess: () => this.quickAccess()
                });
            }
        });

        // Vault
        this.router.registerView('vault', {
            container: document.getElementById('view-vault'),
            init: (container, data) => {
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
            init: (container, textData) => {
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

                // Show loading overlay
                this.showLoading('Preparing Session');

                // Start audio initialization early to minimize lag on chamber entry
                const hasAudio = (session.audioPreset && session.audioPreset !== 'silent') || session.selectedSwellId;
                
                if (session && hasAudio) {
                    this.updateLoadingStatus('Stabilizing carrier frequencies...');
                    this.audioEngine.stopAmbient();
                    this.audioEngine.sessionActive = true;
                    const durationSec = (session.totalDuration || 0) / 1000;
                    await this.audioEngine.startSession({ 
                        preset: session.audioPreset !== 'silent' ? session.audioPreset : null,
                        swellId: session.selectedSwellId,
                        entrainment: {
                            mode: session.entrainmentMode || 'binaural',
                            waveform: session.entrainmentWaveform || 'sine',
                            curve: session.curve || 'flat',
                            durationSec: durationSec,
                            autoRamp: !!(session.curve && session.curve !== 'flat')
                        }
                    });
                } else {
                    this.audioEngine.stopAmbient();
                    this.audioEngine.sessionActive = true;
                }

                try {
                    // Create Player instance
                    this.updateLoadingStatus('Creating player...');
                    const player = new Player(session);

                    // Configure visual cortex based on visualMode
                    const visualMode = session.visualConfig?.visualMode || 'off';

                    if (visualMode === 'interlocution') {
                        this.updateLoadingStatus('Loading visual engine...');
                        const activeTypes = [];
                        const interlocution = session.visualConfig.interlocution || {};

                        // Flatten all procedural types
                        if (interlocution.procedural) {
                            activeTypes.push(...interlocution.procedural);
                        } else {
                            // Fallback default
                            activeTypes.push('klee', 'turrell');
                        }

                        // Flatten all sourced types
                        if (interlocution.sourced) {
                            const sourced = interlocution.sourced;
                            // Specifically add all selected Wikimedia categories
                            const wikimediaCategories = sourced.filter(s => 
                                s !== 'global-pool' && 
                                s !== 'custom' && 
                                !s.startsWith('personal:')
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
                                frequency: interlocution.frequency || 0.2,
                                duration: interlocution.duration || 80,
                                activeTypes: activeTypes,
                                kleePreset: interlocution.kleePreset || 'random',
                                customVisuals: session.customVisuals || [],
                                sourced: interlocution.sourced || [],
                                semanticSignals: semanticSignals
                            });

                        // Preload visuals
                        const estimatedFlashCount = Math.floor(session.atoms.length * interlocution.frequency);
                        await visualCortex.preload(estimatedFlashCount);
                    } else if (visualMode === 'focals') {
                        // Focals mode: persistent gentle focal point (handled by Chamber renderer)
                        // No visual cortex preloading needed - focals are persistent, not probabilistic
                        console.log('[R.I.S.E.] Focals mode active:', session.visualConfig.focals);
                    } else if (visualMode === 'attractor') {
                        // Attractor mode: persistent strange-attractor field (handled by Chamber renderer)
                        // No visual cortex preloading needed - the field is continuous, not probabilistic
                        console.log('[R.I.S.E.] Attractor mode active:', session.visualConfig.attractor);
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
                                this.router.navigate('workshop', { data: { text: data.text } });
                            } else if (session.isPreview && (reason === 'back' || reason === 'exit' || reason === 'close')) {
                                this.router.navigate('workshop'); // Isolate previews
                            } else if (reason === 'back' || reason === 'exit' || reason === 'close') {
                                this.router.navigate('chamber'); // Back to orbital prep
                            }
                        }
                    });
                } catch (error) {
                    console.error('[R.I.S.E.] Session initialization failed:', error);
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
            init: (container) => {
                return new Library(container, {
                    onNavigate: this.handleNavigate,
                    onSelectText: (text, source) => this.handleTextSelection(text, source)
                });
            }
        });

        // Workshop
        this.router.registerView('workshop', {
            container: document.getElementById('view-workshop'),
            init: (container, data) => {
                const ws = new Workshop(container, {
                    onNavigate: this.handleNavigate,
                    onCreateSession: this.handleCreateSession
                });

                if (data && data.text) {
                    ws.update(data);
                }

                return ws;
            }
        });

        // Sol
        this.router.registerView('sol', {
            container: document.getElementById('view-sol'),
            init: (container) => {
                return new Sol(container, {
                    onNavigate: this.handleNavigate,
                    onLaunchSequence: (data) => this.handleSolLaunch(data)
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
    handleTextSelection(text, source) {
        // Navigate back to Chamber with text data
        this.router.navigate('chamber', {
            data: {
                text,
                source,
                config: { origin: { view: 'library', icon: '◇', name: 'Library' } }
            }
        });
    }

    /**
     * Create a full Session object from a starter sequence
     * @param {Object} sequence - Starter sequence data
     * @returns {Session} - Full session with atoms
     */
    async createSessionFromSequence(sequence) {
        // Chunk the content into atoms
        const atoms = chunkText(sequence.content, {
            mode: 'word',
            wpm: sequence.wpm || 220
        });

        // Create session object
        return new Session({
            title: sequence.name,
            atoms: atoms,
            wpm: sequence.wpm || 220,
            curve: sequence.curve || 'flat',
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

        // Chunk the text into atoms
        const atoms = chunkText(sessionConfig.text, {
            mode: sessionConfig.chunkMode || 'word',
            wpm: sessionConfig.wpm || 220
        });

        console.log('[R.I.S.E.] Chunked atoms:', atoms.length, 'atoms');
        console.log('[R.I.S.E.] First atom before pacing:', atoms[0]);

        // Apply pacing curve to atom durations
        const curveMap = {
            flat: StateCurve.flat(),
            induction: StateCurve.induction(),
            ascent: StateCurve.ascent(),
            wave: StateCurve.wave(),
            climax: StateCurve.climax()
        };
        const selectedCurve = sessionConfig.curve || 'flat';
        pacingEngine.setStateCurve(curveMap[selectedCurve] || StateCurve.flat());
        pacingEngine.setWpm(sessionConfig.wpm || 220);
        
        const pacedAtoms = pacingEngine.paceAtoms(atoms);

        // Create full session object
        const session = new Session({
            title: sessionConfig.source || sessionConfig.textSource || 'Session',
            atoms: pacedAtoms,
            wpm: sessionConfig.wpm || 220,
            curve: sessionConfig.curve || 'flat',
            audioPreset: sessionConfig.audioPreset || 'silent',
            entrainmentMode: sessionConfig.entrainmentMode || 'binaural',
            entrainmentWaveform: sessionConfig.entrainmentWaveform || 'sine',
            visualConfig: sessionConfig.visualConfig || { enabled: false },
            customVisuals: sessionConfig.customVisuals || [],
            voiceEnabled: sessionConfig.voiceEnabled || false,
            voiceId: sessionConfig.voiceId || null,
            selectedSwellId: sessionConfig.selectedSwellId || null
        });

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

        // 1. Concatenate all source strings into a single cohesive text flow
        // Inject a prominent interstitial marker block between disparate sources to allow cognitive breathing
        const compiledText = sessionData.sources.map(source => {
            const content = typeof source.data === 'string' ? source.data :
                (Array.isArray(source.data) ? source.data.join(' ') : String(source.data));
            return content.trim();
        }).join('\n\n[— ◈ SYNTHESIS BARRIER ◈ —]\n\n');

        // 2. Pass the compiled master string through the standard chunker
        const atoms = chunkText(compiledText, {
            mode: sessionData.chunkMode || 'word',
            wpm: sessionData.wpm || 220
        });

        console.log(`[R.I.S.E.] Workshop compiler built ${atoms.length} atoms across ${sessionData.sources.length} sources.`);

        // 2.5 Apply pacing curve to atom durations
        const curveMap = {
            flat: StateCurve.flat(),
            induction: StateCurve.induction(),
            ascent: StateCurve.ascent(),
            wave: StateCurve.wave(),
            climax: StateCurve.climax()
        };
        const selectedCurve = sessionData.curve || 'flat';
        pacingEngine.setStateCurve(curveMap[selectedCurve] || StateCurve.flat());
        pacingEngine.setWpm(sessionData.wpm || 220);
        
        const pacedAtoms = pacingEngine.paceAtoms(atoms);

        // 3. Assemble the final Session object
        const session = new Session({
            title: sessionData.title || `Custom Sequence (${sessionData.sources.length} sources)`,
            atoms: pacedAtoms,
            wpm: sessionData.wpm || 220,
            curve: sessionData.curve || 'flat',
            displayMode: sessionData.displayMode || 'focal',
            audioPreset: sessionData.audioPreset || 'silent',
            entrainmentMode: sessionData.entrainmentMode || 'binaural',
            entrainmentWaveform: sessionData.entrainmentWaveform || 'sine',
            selectedSwellId: sessionData.selectedSwellId || null,
            visualConfig: sessionData.visualConfig || { enabled: false },
            customVisuals: sessionData.customVisuals || [],
            isCustom: true // Flag indicating this is a workshop-generated sequence
        });

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
            this.settings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
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
        if (key === 'reducedMotion' || key === 'photosensitivityMode') {
            this.applyAccessibilitySettings();
        }

        if (key === 'masterVolume' && this.audioEngine) {
            this.audioEngine.setMasterVolume(value);
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
        } else {
            root.classList.remove('photosensitivity-mode');
        }
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
        window.addEventListener('rise-open-guide', () => {
            this.showGuide();
        });

        window.addEventListener('rise-open-settings', () => {
            // Trigger settings modal if available globally or navigate
            // For now, let's look for a settings trigger in the current view or navigate
            // If we're in portal, we might want to navigate to a settings view if it exists
            // But usually settings is a modal. Let's assume we can trigger it.
            this.showToast('Interface Settings - Coming Soon', 2000);
        });
    }

    /**
     * Show the Guide modal
     */
    showGuide() {
        if (this.guideInstance) return;

        const container = document.createElement('div');
        container.id = 'guide-container';
        document.body.appendChild(container);

        this.guideInstance = new Guide(container, {
            onClose: () => {
                this.guideInstance.destroy();
                this.guideInstance = null;
                container.remove();
            }
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.router) {
            this.router.destroy();
        }
        if (this.audioEngine) {
            this.audioEngine.stop();
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
