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
import { compileSession } from './core/session-compiler.js';
import { resolveNextLibraryDivision } from './core/reading-continuation.js';
import {
    isWorkshopProject,
    workshopProjectToSessionConfig
} from './core/workshop-project.js';
import { BetaGate } from './components/BetaGate.js';
import { isRosaryDoor } from './core/rosary-door.js';

import { errorBoundary, ErrorCategory, ErrorSeverity } from './core/error-boundary.js';
import {
    endVisualInterlocutionSession
} from './core/visual-safety.js';
import { clampBandFraction } from './core/band-offset.js';
import { resolveChamberStreamFace } from './core/chamber-stream-face.js';
import { DEFAULT_CHAMBER_ACCENT, applyChamberAccent, migrateChamberAccent, resolveChamberAccent } from './core/chamber-accent.js';
import { resolveFontSize } from './core/chamber-type-size.js';
import { clampReadingWpm } from './core/reading-limits.js';
import { createRouteManifest } from './app/route-manifest.js';
import { installTestBridge } from './app/test-bridge.js';

// THE SHELL'S OWN STYLES, AND ONLY THOSE. app.js used to import sixteen
// stylesheets — every room's, not the Portal's — which is 220 KB of CSS
// before a reader has entered a single room. A room's stylesheet now lives
// with the room's module and arrives with it, so the Portal's cost no
// longer grows every time a room is added.
import './design-system.css';
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

        // The two heaviest subsystems in the shell, both arriving on the
        // first use rather than before the Portal paints. See
        // ensureAudioEngine / ensureVisualCortex.
        this._visualCortex = null;
        this._visualCortexLoad = null;
        this._audioEngineLoad = null;

        this.handleNavigate = this.handleNavigate.bind(this);
        this.handleCreateSession = this.handleCreateSession.bind(this);
        this.handleSettingsChange = this.handleSettingsChange.bind(this);
        this.handleSettingsTransaction = this.handleSettingsTransaction.bind(this);
        this.handleDataCleared = this.handleDataCleared.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        // Initialize global error boundary first
        errorBoundary.init();
        this.setupErrorRecovery();

        // Arm the first-interaction listener. The engine itself arrives with
        // that interaction — the BetaGate click is still the moment audio
        // starts, it is simply also the moment the engine is fetched.
        this.setupAudioInteraction();

        // Check beta access - this will call initializeApp when access is granted
        // (either immediately if already authenticated, or after user enters code)
        await this.checkBetaAccess();
    }

    /**
     * The Web Audio engine, on first use.
     *
     * 87 KB of source plus soundscapes and chant beds, none of which a
     * reader who opens the Portal and leaves has asked for. Every caller
     * gets the same instance; concurrent callers share one import.
     */
    async ensureAudioEngine() {
        if (this.audioEngine) return this.audioEngine;
        this._audioEngineLoad ||= import('./audio/engine.js')
            .then(({ AudioEngine }) => {
                this.audioEngine ||= new AudioEngine({
                    onUnavailable: (message, duration) => this.showToast(message, duration)
                });
                this.audioEngine.setMasterVolume(this.settings?.masterVolume ?? 0.75);
                return this.audioEngine;
            });
        return this._audioEngineLoad;
    }

    /**
     * The visual cortex, on first use, initialized once.
     *
     * 179 KB of engines and a stylesheet behind one singleton. Nothing on
     * the Portal path presents a visual, so nothing on the Portal path
     * should pay for one.
     */
    async ensureVisualCortex() {
        if (this._visualCortex) return this._visualCortex;
        this._visualCortexLoad ||= import('./visuals/visual-cortex.js')
            .then(({ visualCortex }) => {
                this._visualCortex = visualCortex;
                visualCortex.init();
                return visualCortex;
            });
        return this._visualCortexLoad;
    }

    /**
     * Check beta access and show gate if needed
     */
    async checkBetaAccess() {
        return new Promise((resolve) => {
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
        // Load settings from localStorage. The master volume is applied by
        // ensureAudioEngine when the engine is actually created, which is the
        // only moment there is anything to apply it to.
        this.loadSettings();

        // Apply accessibility settings immediately
        this.applyAccessibilitySettings();

        // The audio engine, the visual cortex and the source providers are
        // not created here. Each arrives at its first use — the engine on
        // the first interaction, the cortex when a reading opens, the
        // providers when a surface browses sources. Nothing the Portal
        // shows reads any of them.

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
                console.log('[RISE] First interaction - Initializing audio context');
                const engine = await this.ensureAudioEngine();
                await engine.init();
                await engine.resume();
                if (this.settings?.enableAmbient) {
                    engine.startAmbientPlaylist();
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
            this._visualCortex?.updateConfig({ enabled: false });
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
        const routes = createRouteManifest({
            handleNavigate: this.handleNavigate,
            quickAccess: () => this.quickAccess(),
            launchKeystone: slug => this.launchKeystone(slug),
            handleSequenceSelection: sequenceId => this.handleSequenceSelection(sequenceId),
            handleCreateSession: this.handleCreateSession,
            handleArchetypeLaunch: data => this.handleArchetypeLaunch(data),
            handleBeginSession: session => this.handleBeginSession(session),
            getAudioEngine: () => this.audioEngine,
            getCurrentSession: () => this.currentSession,
            getSettings: () => this.settings,
            handleSettingsChange: this.handleSettingsChange,
            handleSettingsTransaction: this.handleSettingsTransaction,
            showToast: (message, duration) => this.showToast(message, duration),
            chamberSession: {
                getCurrentSession: () => this.currentSession,
                getAudioEngine: () => this.audioEngine,
                getSettings: () => this.settings,
                getVisualCortex: () => this._visualCortex,
                router: this.router,
                ensureVisualCortex: () => this.ensureVisualCortex(),
                ensureAudioEngine: () => this.ensureAudioEngine(),
                continueLibraryReading: session => this.continueLibraryReading(session),
                handleSettingsChange: this.handleSettingsChange,
                handleDataCleared: this.handleDataCleared,
                showLoading: title => this.showLoading(title),
                updateLoadingStatus: status => this.updateLoadingStatus(status),
                hideLoading: () => this.hideLoading(),
                showToast: (message, duration) => this.showToast(message, duration)
            },
            handleTextSelection: (text, source, config) => this.handleTextSelection(text, source, config),
            refreshVaultBlueprints: () => this.router.getViewInstance('vault')?.refreshBlueprints?.(),
            handleDataCleared: this.handleDataCleared,
            launchRosary: (setId, extras) => this.router.navigate('rosarium', {
                data: { setId, iconId: extras?.iconId ?? null }
            }),
            launchChapelReading: (bookId, chapter, extras) => this.launchChapelReading(bookId, chapter, extras)
        });

        for (const route of routes) {
            this.router.registerView(route.id, {
                container: document.getElementById(route.containerId),
                init: async (container, data) => route.create(container, data, await route.load())
            });
        }
    }

    async launchChapelReading(bookId, chapter, extras) {
        try {
            const { createChapelHandoff } = await import('./content/chapel/handoff.js');
            const chamberData = await createChapelHandoff(bookId, {
                ...(chapter == null ? {} : { chapter }),
                ...(extras?.iconId ? { iconId: extras.iconId } : {})
            });
            await this.router.navigate('chamber', { data: chamberData });
        } catch (error) {
            console.error('[RISE] Chapel handoff failed:', error);
            this.showToast(
                error?.code === 'CHAPEL_PAYLOAD_INTEGRITY'
                    ? 'This book did not verify and will not be read.'
                    : 'This book is unavailable right now.',
                4000
            );
        }
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
            // reading-continuation is NOT deferred here, and pretending it
            // was is what Rollup kept reporting: models.js builds every
            // Session through createLibraryContinuation, so the module is in
            // the main chunk whatever this line says. Only the provider is
            // genuinely deferrable.
            const { ArchiveTextProvider } = await import('./sources/text/archive.js');
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
            chamberAccent: DEFAULT_CHAMBER_ACCENT,
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
                fontSize: resolveFontSize(merged.fontSize),
                chamberFace: resolveChamberStreamFace(merged.chamberFace),
                chamberAccent: resolveChamberAccent(
                    migrateChamberAccent(merged.chamberAccent, merged.chamberAccentNamed)),
                // Marks this blob as written after Slate became a hue of its
                // own, so a stored 'slate' is never mistaken for the default.
                chamberAccentNamed: true,
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
    normalizeSettingsChange(key, value) {
        // A pace is bounded where it is chosen, not where it is read. Stored
        // unbounded, a 5,000 would sit in Settings looking accepted and be
        // overridden to 1,000 by every surface that later read it.
        return key === 'defaultWpm'
            ? clampReadingWpm(value, this.settings.defaultWpm)
            : key === 'chamberFace'
                ? resolveChamberStreamFace(value)
                : key === 'chamberAccent'
                    ? resolveChamberAccent(value)
                    : key === 'chamberMask'
                    ? value === true
                    : key === 'fontSize'
                        ? resolveFontSize(value)
                        : value;
    }

    handleSettingsTransaction(changes) {
        const next = Object.fromEntries(
            Object.entries(changes).map(([key, value]) => [key, this.normalizeSettingsChange(key, value)])
        );
        const keys = Object.keys(next);
        Object.assign(this.settings, next);
        this.saveSettings();

        // Apply certain settings immediately
        if (keys.some(key => ['reducedMotion', 'photosensitivityMode', 'fontSize', 'chamberFace', 'chamberAccent', 'showProgress', 'showDuration'].includes(key))) {
            this.applyAccessibilitySettings();
        }

        if (Object.hasOwn(next, 'masterVolume') && this.audioEngine) {
            this.audioEngine.setMasterVolume(this.settings.masterVolume);
        }
        if (keys.some(key => ['chamberFace', 'chamberMask', 'fontSize'].includes(key))) {
            const chamber = this.router?.getViewInstance?.('chamber-session');
            chamber?.applyChamberStreamFace?.();
            chamber?.applyChamberMask?.();
            if (Object.hasOwn(next, 'fontSize')) chamber?.applyChamberTypeSize?.();
        }
        if (Object.hasOwn(next, 'showArtworkLabels')) {
            this._visualCortex?.setArtworkLabelsVisible(this.settings.showArtworkLabels);
        }
        if (Object.hasOwn(next, 'enableAmbient') && this.audioEngine?.isInitialized && !this.audioEngine.sessionActive) {
            if (this.settings.enableAmbient) this.audioEngine.startAmbientPlaylist();
            else this.audioEngine.stopAmbient(true);
        }
    }

    handleSettingsChange(key, value) {
        this.handleSettingsTransaction({ [key]: value });
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
            this._visualCortex?.cancelPresentation('photosensitivity');
        } else {
            root.classList.remove('photosensitivity-mode');
        }
        // The Continuous Field runs on its own clock, so a live
        // photosensitivity toggle must be pushed to it (the flash economy
        // re-checks per flash; the field does not). Suspends it when the
        // mode turns on, resumes it when the mode clears.
        this._visualCortex?.syncSafety();

        root.dataset.fontSize = resolveFontSize(this.settings?.fontSize);
        root.dataset.chamberFace = resolveChamberStreamFace(this.settings?.chamberFace);
        // The default is the bare :root, so it must CLEAR data-accent, not stamp
        // it — applyChamberAccent owns that rule for the app and the Chamber both.
        applyChamberAccent(root, this.settings?.chamberAccent);
        root.classList.toggle('hide-session-progress', this.settings?.showProgress === false);
        root.classList.toggle('hide-session-duration', this.settings?.showDuration === false);
        this._visualCortex?.setArtworkLabelsVisible(this.settings?.showArtworkLabels !== false);
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

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    installTestBridge(app, window, {
        enabled: import.meta.env.DEV || import.meta.env.VITE_RISE_TEST_API === '1'
    });
    app.init().catch(err => {
        console.error('[RISE] Initialization failed:', err);
    });
});

export default App;
