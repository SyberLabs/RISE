/*
 * RISE — Main Application
 * An audiovisual reader
 *
 * Central orchestration module that initializes and coordinates:
 * - Router (view navigation)
 * - Audio Engine (binaural entrainment, layers)
 * - Settings (persistence, accessibility)
 * - Components (Home, Read, Library, Make, Settings)
 */

import { Router, claimStaleBuildReload } from './core/router.js';
import { appHistory, appLocation } from './core/embed-address.js';
import { compileSession } from './core/session-compiler.js';
import { PACE_CURVE_IDS } from './core/pacing.js';
import { resolveNextLibraryDivision } from './core/reading-continuation.js';
import { isRosaryDoor } from './core/rosary-door.js';
import { ROUTE_ALIASES, routeFromPath } from './core/route-url.js';
import { programPath, programSlugShape } from './core/program-paths.js';
import { sceneSampleFromPath } from './core/jev-demo-path.js';
import { KEYSTONE_SESSION_ORIGIN } from './app/chamber-exit.js';

import { errorBoundary, ErrorCategory } from './core/error-boundary.js';
import {
    endVisualInterlocutionSession
} from './core/visual-safety.js';
import { clampBandFraction } from './core/band-offset.js';
import { resolveChamberStreamFace } from './core/chamber-stream-face.js';
import { resolveFontSize } from './core/chamber-type-size.js';
import { clampReadingWpm } from './core/reading-limits.js';
import { createRouteManifest } from './app/route-manifest.js';
import { preloadHome } from './app/home-preload.js';
import { installTestBridge } from './app/test-bridge.js';

// Not a room: the address opens today's poem in the reader (launchToday).
const TODAY_PATH = '/today';
import { watchTabFreshness } from './core/tab-freshness.js';
import { takeOpenRouterReturn } from './core/openrouter-callback.js';

// FIRST, before any other work: an OpenRouter sign-in returns here with a
// one-time authorization code in the URL. Lift it out of the address bar and
// history now; Home exchanges it (and clears the PKCE state) when it opens.
// Any other page load abandons a sign-in this tab started and never finished.
takeOpenRouterReturn();

// THE SHELL'S OWN STYLES, AND ONLY THOSE. app.js used to import sixteen
// stylesheets — every room's, not Home's — which is 220 KB of CSS
// before a reader has entered a single room. A room's stylesheet now lives
// with the room's module and arrives with it, so Home's cost no
// longer grows every time a room is added.
import './design-system.css';
import './core/visual-safety.css';

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
/**
 * THE FLAG HAS TO BE READ BEFORE THE ROUTER REWRITES THE ADDRESS.
 *
 * `?diag=1` turns on the audio diagnostic panel, and the panel reads it
 * the first time anything asks it to record something - which is inside
 * the audio engine, long after boot. By then the router has called
 * history.pushState with a bare path, and the query the reader typed is
 * gone: the panel concludes it was never asked for and never appears.
 * That is why it could not be seen on the deployed site while working
 * perfectly on a preview, where the flag was still in the URL at the
 * moment the first clip played.
 *
 * Read here instead, at module scope, before a route has been resolved
 * or an address rewritten, and leave the answer where the panel looks
 * for it. Costs three lines in the entry and no import.
 *
 * Goes when the panel goes.
 */
try {
    if (/(?:^|[?&])diag=1(?:&|$)/u.test(window.location.search || '')) {
        sessionStorage.setItem('rise:audio-diag', '1');
    }
} catch (e) { /* private mode: the flag lasts as long as the URL does */ }

window.addEventListener('vite:preloadError', (event) => {
    if (!claimStaleBuildReload(import.meta.url)) return;  // reloaded once already: not a deploy
    event.preventDefault();
    console.warn('[RISE] Build changed underneath this tab — reloading once.');
    window.location.reload();
});


class App {
    constructor() {
        // Read-only measurement records (setup-preview.js) outlive the router's first navigation.
        if (new URLSearchParams(appLocation().search).has('measure')) document.documentElement.dataset.riseMeasure = '';
        this.router = null;
        this.audioEngine = null;
        this.settings = null;
        this.currentSession = null;
        this.sessionLaunchRevision = 0;
        this.guideInstance = null;
        this._audioInteractionController = null;
        this._utilityController = null;
        this._historyNavigationGeneration = 0;

        // The two heaviest subsystems in the shell, both arriving on the
        // first use rather than before Home paints. See
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
        // that interaction — the first press anywhere is the moment audio
        // starts, it is simply also the moment the engine is fetched.
        this.setupAudioInteraction();

        // AND FETCH THE ENGINE BEFORE THE GESTURE, NOT BECAUSE OF IT.
        //
        // The listener above used to reach the AudioContext through a
        // dynamic import: the tap arrived, `import('./audio/engine.js')`
        // went to the network, and only when that resolved did anything
        // construct a context. A browser grants audio to a gesture, not
        // to whatever happens to run some hundreds of milliseconds after
        // one, and Safari is strictest about it - so the tap meant to
        // unlock audio could find its privilege already spent by the time
        // there was a context to unlock.
        //
        // Starting the fetch here costs nothing that was not going to be
        // paid anyway, and opens no context: ensureAudioEngine builds the
        // engine object, and only init() creates an AudioContext. By the
        // time a reader touches anything the module is resident, and the
        // gesture reaches the context without crossing the network.
        void this.ensureAudioEngine().catch(() => { /* audio stays off */ });

        try {
            await this.initializeApp({});
        } catch (error) {
            console.error('[RISE] Application initialization failed:', error);
            const recovery = document.createElement('div');
            recovery.id = 'boot-recovery';
            const message = document.createElement('p');
            message.textContent = 'RISE could not initialize in this browser session.';
            const retry = document.createElement('button');
            retry.className = 'btn-primary';
            retry.textContent = 'Retry';
            retry.addEventListener('click', () => window.location.reload(), { once: true });
            recovery.append(message, retry);
            document.body.appendChild(recovery);
            this.showToast('Initialization failed. Please retry or reload.', 5000);
        }
    }

    /**
     * The Web Audio engine, on first use.
     *
     * 87 KB of source plus soundscapes and chant beds, none of which a
     * reader who opens Home and leaves has asked for. Every caller
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
     * Home path presents a visual, so nothing on Home path
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
     * Full application initialization
     * @param {Object} options - Init options
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
        // providers when a surface browses sources. Nothing Home
        // shows reads any of them.

        this.router = new Router({
            build: import.meta.url,
            history: appHistory(),
            location: appLocation(),
            onNavigationIntent: (view, options) => this.handleNavigationIntent(view, options),
            onViewChange: (view, data) => {
                console.log(`[RISE] View: ${view}`);
            }
        });

        // Register views
        this.registerViews();
        // A direct public route is visible during the Router's fade-in. Install
        // history listeners before entering it so Back/Forward in that window
        // cannot be lost.
        this.setupUtilityListeners();

        // Finish "Connect OpenRouter". The key goes to memory only; the
        // Home shows the outcome. A failure changes nothing else.

        // Keystone paths are durable public entry points.  They resolve to a
        // threshold view first; admission and launch still happen through the
        // exact manifest gate rather than from URL text alone.
        // resolveAddress fetches keystones.js only for a Keystone path, so a
        // reader arriving at Home does not wait for that manifest.
        const pathname = appLocation().pathname;
        // A minted sequence is the same kind of public entry point. TWO
        // QUESTIONS, NOT ONE: whether this is a mint URL at all, and which
        // mint it names. A printed code outlives the sequence it names, so
        // a valid address naming nothing has to reach the threshold and be
        // told — collapsing both to "no" drops that reader on Home
        // with no idea why.
        const mintedSlug = programSlugShape(pathname);

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
        // A skin's page hands over one decision, admitted again by the normal
        // launch or Reader Setup resolver. The URL carries no reading data.
        const opened = appLocation().search.includes('invocation=')
            && await (await import('./app/invocation.js')).enterFromInvocation(appLocation().search, {
                home: () => this.router.navigate('home'),
                launch: decision => this.launchJevReading(decision),
                adjust: decision => this.adjustJevReading(decision),
                fail: message => this.showToast(message, 5000)
            });
        if (opened) {
            // The reading is open; nothing else to recover.
        } else if (staleTarget && this.router.views.has(ROUTE_ALIASES[staleTarget] ?? staleTarget)) {
            console.log('[RISE] Recovering navigation after stale build:', staleTarget);
            await this.router.navigate(staleTarget, { data: staleData, keepUrl: true });
        } else if (isRosaryDoor()) {
            await this.router.navigate('rosarium', { data: { door: true } });
        } else if (mintedSlug) {
            const { houseProgram } = await import('./content/programs/index.js');
            await this.router.navigate('mint', { data: { entry: houseProgram(mintedSlug) }, keepUrl: true });
        } else if (pathname === TODAY_PATH) {
            // The address opens the reading itself; once it is open the
            // address is Home's, so leaving it does not open it again.
            window.history.replaceState({}, '', '/');
            try {
                await this.launchToday();
            } catch (error) {
                this.showToast(error.message || 'Today’s poem could not be opened.', 5000);
                await this.router.navigate('home');
            }
        } else {
            // Every other address is the table's to resolve (route-url.js);
            // the cases above are not addresses: a hash, a query code, a
            // stale-build recovery, the minted /p/ path, which opens a
            // reading through the register rather than naming a room, and
            // /today, which opens a reading.
            const route = await this.resolveAddress();
            const shown = this.router.navigate(route.id, { data: route.data, replace: true, keepUrl: !route.rewrite });
            // Home's code is asked for first, then what Home plays with it,
            // so neither waits on the other's round trip.
            if (route.id === 'home') void preloadHome();
            await shown;
        }
        // A start route whose code will not load (blocked, or still
        // missing after the one reload) leaves nothing on screen. Home.
        if (!this.router.currentView) await this.handleNavigate('home');

        this.watchTabFreshness();

        // Audio interaction listener is already set up in init()

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
            let engine = null;
            try {
                console.log('[RISE] First interaction - Initializing audio context');
                engine = await this.ensureAudioEngine();
                await engine.init();
                await engine.resume();
                // A GESTURE IS THE ONLY THING LEFT WHEN RECOVERY HAS RUN
                // OUT OF RUNGS, so spend it on establishing the
                // postcondition rather than on another resume. This runs
                // only when RISE is not already admitted: a healthy
                // context is never disturbed, and never pays for a probe.
                if (engine.lifecycle && !engine.audible) {
                    await engine.lifecycle.ensureLive();
                }
            } catch (error) {
                console.warn('[RISE] Audio initialization unavailable:', error);
            } finally {
                // STAND DOWN ONLY ONCE THE CONTEXT IS ACTUALLY RUNNING.
                // This disarmed on the first interaction whatever came of
                // it, and an attempt can come to nothing for reasons that
                // have nothing to do with the reader: a resume that races
                // the gesture, or one a browser declines because the
                // event it arrived on did not count as activation. When
                // that happened there was nothing left listening, and
                // audio stayed off until something else happened to
                // resume it — which, for a reading, was the reader
                // pausing and playing.
                // AND STANDING DOWN IS A CLAIM ABOUT RENDERING, NOT
                // ABOUT AN OBJECT'S `state` FIELD. In the trace the two
                // disagreed for sixteen seconds.
                if (engine?.audible) {
                    this._audioInteractionController?.abort();
                }

                // AND IT HAS TO BE ABLE TO COME BACK. Standing down is
                // right while the audio is running, but iOS can take the
                // session away afterwards — the phone locks, a call
                // arrives, the reader leaves the browser — and the
                // context lands in `interrupted` with nothing listening
                // any more. The engine asks for it back when the page
                // returns to screen; where the browser wants a gesture
                // for that, this puts the listeners back so the reader's
                // next tap is spent on it.
                if (engine && !engine.onInterrupted) {
                    engine.onInterrupted = () => {
                        if (this._audioInteractionController?.signal.aborted) {
                            this.setupAudioInteraction();
                        }
                    };
                }
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
                this.settings.enableBinaural = false;
            }
            return this.audioEngine?.stopSession({ immediate: true });
        });

        // Visual errors: disable visual interlocution
        errorBoundary.registerRecoveryHandler(ErrorCategory.VISUAL, (report) => {
            endVisualInterlocutionSession();
            this._visualCortex?.updateConfig({ enabled: false });
        });

        // Navigation errors: return to portal
        errorBoundary.registerRecoveryHandler(ErrorCategory.NAVIGATION, (report) => {
            if (this.router) {
                return this.router.navigate('home');
            }
        });

        // Playback errors: stop current session
        errorBoundary.registerRecoveryHandler(ErrorCategory.PLAYBACK, (report) => {
            endVisualInterlocutionSession();
            if (this.currentSession) {
                this.currentSession = null;
            }
            if (this.router) {
                return this.router.navigate('home');
            }
        });
    }

    /**
     * Register all view containers and components
     */
    registerViews() {
        const routes = createRouteManifest({
            handleNavigate: this.handleNavigate,
            launchJevReading: (decision, options) => this.launchJevReading(decision, options),
            launchJevSample: () => this.launchJevSample(),
            launchKeystone: slug => this.launchKeystone(slug),
            adjustJevReading: (decision, exact) => this.adjustJevReading(decision, exact),
            launchToday: () => this.launchToday(),
            openMintedProgram: slug => this.openMintedProgram(slug),
            handleSequenceSelection: sequenceId => this.handleSequenceSelection(sequenceId),
            handleCreateSession: this.handleCreateSession,
            handleBeginSession: session => this.handleBeginSession(session),
            useRecipeInReading: recipe => this.useRecipeInReading(recipe),
            router: this.router,
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
                // Leaving a reading goes through the shell, not straight to
                // the router, so the rules that keep the address bar honest
                // about which surface is showing get to run.
                handleNavigate: this.handleNavigate,
                ensureVisualCortex: () => this.ensureVisualCortex(),
                ensureAudioEngine: () => this.ensureAudioEngine(),
                continueLibraryReading: session => this.continueLibraryReading(session),
                // Home offers Continue only while a begun, unfinished reading
                // is held here.
                releaseSession: session => {
                    if (this.currentSession === session) this.currentSession = null;
                },
                handleSettingsChange: this.handleSettingsChange,
                handleDataCleared: this.handleDataCleared,
                showLoading: title => this.showLoading(title),
                updateLoadingStatus: status => this.updateLoadingStatus(status),
                hideLoading: () => this.hideLoading(),
                showToast: (message, duration) => this.showToast(message, duration),
                // A scene chosen in the Visual Lab before any reading was
                // open waits here and is held by the next reading, once.
                takePendingVisualRecipe: () => {
                    const recipe = this.pendingVisualRecipe || null;
                    this.pendingVisualRecipe = null;
                    return recipe;
                }
            },
            handleTextSelection: (text, source, config) => this.handleTextSelection(text, source, config),
            refreshVaultBlueprints: () => this.router.getViewInstance('make')?.tabInstance('vault')?.refreshBlueprints?.(),
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
    handleNavigationIntent(viewName, options = {}) {
        if (viewName === 'read' && options.data?.pane === 'chamber'
            && options.launchRevision === this.sessionLaunchRevision) return;
        ++this.sessionLaunchRevision;
        this.router.getViewInstance(this.router.getCurrentView())?.navigationIntent?.();
    }

    handleNavigate(viewName, data, { replaceUrl = false } = {}) {
        // The router writes the address (src/core/route-url.js owns it).
        // Returned so a caller can wait for the outgoing view to have
        // faded out before disposing of it. See chamber-session-factory.
        return this.router.navigate(viewName, { data, replaceUrl });
    }

    /**
     * Use a Visual Lab scene in a reading. With no reading open, the existing
     * reading chooser opens and the scene waits to be held by the next one.
     */
    useRecipeInReading(recipe) {
        this.pendingVisualRecipe = recipe || null;
        this.showToast('Choose a reading. Your scene will be held in it.', 3500);
        return this.handleNavigate('library');
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
            const [{ ArchiveTextProvider }, { successorConfig }] = await Promise.all([
                import('./sources/text/archive.js'),
                import('./core/session-successor.js')
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
            const nextSession = compileSession(successorConfig(session, {
                title: `${itemName} · ${entryLabel}`,
                text: next.entry.content,
                textSource: `${itemName} · ${entryLabel}`,
                verseLines: next.entry.verse === true,
                visualConfig,
                continuation: next.continuation
            }));

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
            return false;
        }

        console.log('[RISE] Created session:', session);
        console.log('[RISE] Session atoms:', session.atoms);
        console.log('[RISE] Session.atoms[0]:', session.atoms[0]);

        // Where the reading was opened from, so leaving it can return
        // there rather than to the surface the Chamber sits in front of.
        if (sessionConfig.origin) {
            session.origin = sessionConfig.origin;
        }
        if (sessionConfig.firstReadPreview === true) {
            session.firstReadPreview = true;
        }
        // The address the reading keeps while it is open (see route-url.js).
        // The fixed sample scenes keep their own path while they read.
        const publicPath = sessionConfig.publicPath
            || (sceneSampleFromPath(window.location.pathname) ? window.location.pathname : null);
        if (publicPath) session.publicPath = publicPath;

        // Store and navigate to chamber-session (immersion)
        this.currentSession = session;
        return this.router.navigate('chamber-session', { data: session });
    }

    /** Resolve Jev's discrete choices against shipped text, then enter the reader. */
    async launchJevReading(decision, { firstReadPreview = false, publicPath = null } = {}) {
        const { resolveJevReading } = await import('./app/jev-reading.js');
        const sessionConfig = await resolveJevReading(decision);
        if (firstReadPreview) sessionConfig.firstReadPreview = true;
        // The address the reading keeps (an arena replay's own decider).
        if (publicPath) sessionConfig.publicPath = publicPath;
        if (!await this.handleBeginSession(sessionConfig)) {
            throw new Error('The selected reading could not be opened. Please try again.');
        }
    }

    /**
     * Open a proposed reading (rolled or asked) in Reader Setup with
     * everything already set, through the same edition gate as Enter.
     * `exact` ({ entryId, label }) opens that division instead of the
     * plan's section (today's poem).
     */
    async adjustJevReading(decision, exact = null) {
        const { resolveJevReading } = await import('./app/jev-reading.js');
        const { text, textSource, ...config } = await resolveJevReading(decision, exact);
        config.origin = { ...config.origin, adjusted: true };
        return this.router.navigate('chamber', { data: { text, source: textSource, config } });
    }

    /**
     * Today's poem goes straight into the reader: the day's exact poem in the
     * day's look. A tap on Home's card is the gesture that lets it play at
     * once; a cold load of /today stops on the reader's Ready screen. The
     * reading keeps Home's address, so a reload or Back lands Home rather
     * than reopening the poem.
     */
    async launchToday() {
        const { todaySession } = await import('./app/today.js');
        if (!await this.handleBeginSession({ ...await todaySession(), publicPath: '/' })) {
            throw new Error('Today’s poem could not be opened. Please try again.');
        }
    }

    /** Launch a fixed sample through the released-edition gate, without a provider call. */
    async launchJevSample() {
        if (sceneSampleFromPath(window.location.pathname) === 'night-drive') {
            const { nightDriveSessionInput } = await import('./app/night-drive-sample.js');
            if (!await this.handleBeginSession(nightDriveSessionInput())) {
                throw new Error('The sample reading could not be opened. Please try again.');
            }
            return;
        }
        const [{ sampleJevSceneDecision }, { resolveJevReading }] = await Promise.all([
            import('./app/jev-scene-demo.js'), import('./app/jev-reading.js')
        ]);
        const sessionConfig = await resolveJevReading(sampleJevSceneDecision());
        sessionConfig.origin = { ...sessionConfig.origin, experience: 'jev-sample' };
        if (!await this.handleBeginSession(sessionConfig)) {
            throw new Error('The sample reading could not be opened. Please try again.');
        }
    }

    /** Resolve, compile, and launch an exact canonical composition. */
    async launchKeystone(slug, { firstReadPreview = false } = {}) {
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
            await this.handleBeginSession({
                ...result.sessionInput,
                publicPath: keystones.keystonePath(slug),
                origin: KEYSTONE_SESSION_ORIGIN,
                firstReadPreview
            });
        } catch (error) {
            console.error('[RISE] Keystone launch refused:', error);
            this.showToast(error.message || 'This Keystone could not be opened.', 5000);
        }
    }

    /**
     * Open a minted sequence, from the threshold and never from the URL.
     *
     * THROUGH THE SAME DOORWAY A PASTE GOES THROUGH. A minted program is a
     * file in the repository rather than a file a reader wrote, and that
     * earns it a short URL — not a different gate and not a different
     * authority. `parseExperienceProgramJson` lands it `proposed` exactly
     * as it would a paste, which is the rule that keeps `published`
     * meaning "one of RISE's own Journeys" and nothing else.
     *
     * The register is consulted rather than the path: a slug that is not
     * in it has no asset, so nothing here ever builds a fetch path out of
     * what the address bar said.
     */
    async openMintedProgram(slug) {
        try {
            const { houseProgram } = await import('./content/programs/index.js');
            const entry = houseProgram(slug);
            if (!entry) {
                this.showToast('That sequence is not one RISE has minted.', 5000);
                return;
            }

            const response = await fetch(entry.asset, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`${entry.title} could not be loaded.`);

            const [io, resolver] = await Promise.all([
                import('./core/experience-program-io.js'),
                import('./core/scriptorium-resolve.js')
            ]);
            const program = io.parseExperienceProgramJson(await response.text());
            const { sources } = await resolver.resolveProgramLibrarySources(program);
            if (!sources.length) throw new Error(`${entry.title} names no work this build carries.`);
            resolver.assertResolvedProgramQuotations(program, sources);

            const project = io.workshopProjectFromImportedProgram({
                program,
                sources,
                title: entry.title,
                id: `mint:${slug}`,
                provenance: { kind: 'minted-program', slug }
            });

            await this.handleCreateSession({ ...project, publicPath: programPath(slug) });
        } catch (error) {
            console.error('[RISE] Minted sequence refused:', error);
            this.showToast(error.message || 'This sequence could not be opened.', 5000);
        }
    }

    /**
     * Handle session creation from Workshop / Vault blueprints.
     * Hydrates durable sequence images before compileSession.
     */
    async handleCreateSession(sessionData) {
        const launchRevision = ++this.sessionLaunchRevision;
        const isCurrent = () => launchRevision === this.sessionLaunchRevision;
        let sessionInput;
        try {
            if (sessionData?.provenance?.kind === 'personal-generated') {
                const { personalSession } = await import('./core/personal-project.js');
                if (!isCurrent()) return false;
                sessionInput = personalSession(sessionData);
                sessionInput.origin = { view: 'vault' };
            } else {
                // The project model is a room's, and nothing on the way to the
                // Home needs it, so it is not part of first load.
                const { isWorkshopProject, workshopProjectToSessionConfig } =
                    await import('./core/workshop-project.js');
                if (!isCurrent()) return false;
                sessionInput = isWorkshopProject(sessionData) ? workshopProjectToSessionConfig(sessionData) : sessionData;
            }
            const { hydrateSessionSequenceAssets } = await import('./core/workshop-asset-durability.js');
            if (!isCurrent()) return false;
            sessionInput = await hydrateSessionSequenceAssets(sessionInput);
            if (!isCurrent()) return false;
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
            if (!isCurrent()) return false;
            // Reserved for a payload that cannot be read at all. A missing
            // image no longer reaches here.
            console.error('[RISE] Workshop media hydrate failed:', error);
            this.showToast(error.message || 'Sequence images could not be loaded', 4000);
            return false;
        }


        if (!sessionInput || !sessionInput.sources || sessionInput.sources.length === 0) {
            this.showToast('Cannot create session without sources', 3000);
            return false;
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
            return false;
        }

        console.log(`[RISE] Workshop compiler built ${session.atomCount} atoms across ${session.sources.length} sources.`);

        // Route only while this preparation still owns the launch.
        if (!isCurrent()) return false;

        if (sessionData?.publicPath) session.publicPath = sessionData.publicPath;

        // Ensure that preview mode routing flag passes correctly if requested
        if (sessionInput.isPreview) {
            session.isPreview = true;
        }

        const navigated = await this.router.navigate('chamber-session', {
            data: session,
            force: true,
            launchRevision
        });
        if (navigated !== true || launchRevision !== this.sessionLaunchRevision) return false;
        this.currentSession = session;
        return true;
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const defaultSettings = {
            // Display
            fontSize: 'medium',
            chamberFace: 'literary',
            // Living Text tints the words of a reading that asks for it; on unless the reader turns it off.
            livingText: true,
            showProgress: true,
            showDuration: true,
            showArtworkLabels: true,

            // Audio
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
            const curves = new Set(PACE_CURVE_IDS);
            const booleanKeys = [
                'showProgress',
                'showDuration',
                'showArtworkLabels',
                'livingText',
                'enableBinaural',
                'photosensitivityMode',
                'reducedMotion'
            ];
            this.settings = {
                ...defaultSettings,
                fontSize: resolveFontSize(merged.fontSize),
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
    normalizeSettingsChange(key, value) {
        // A pace is bounded where it is chosen, not where it is read. Stored
        // unbounded, a 5,000 would sit in Settings looking accepted and be
        // overridden to 1,000 by every surface that later read it.
        return key === 'defaultWpm'
            ? clampReadingWpm(value, this.settings.defaultWpm)
            : key === 'chamberFace'
                ? resolveChamberStreamFace(value)
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
        if (keys.some(key => ['reducedMotion', 'photosensitivityMode', 'fontSize', 'chamberFace', 'showProgress', 'showDuration'].includes(key))) {
            this.applyAccessibilitySettings();
        }

        if (Object.hasOwn(next, 'masterVolume') && this.audioEngine) {
            this.audioEngine.setMasterVolume(this.settings.masterVolume);
        }
        if (keys.some(key => ['chamberFace', 'fontSize'].includes(key))) {
            const chamber = this.router?.getViewInstance?.('read')?.paneInstance('chamber');
            chamber?.applyChamberStreamFace?.();
            chamber?.applyChamberMask?.();
            if (Object.hasOwn(next, 'fontSize')) chamber?.applyChamberTypeSize?.();
        }
        if (Object.hasOwn(next, 'showArtworkLabels')) {
            this._visualCortex?.setArtworkLabelsVisible(this.settings.showArtworkLabels);
        }
        if (Object.hasOwn(next, 'livingText')) {
            this.router?.getViewInstance?.('read')?.paneInstance('chamber')?.applyLivingTextSetting?.();
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
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const prefersReducedMotion = motionQuery.matches;
        // The reader can change it mid-session; the root class follows.
        if (!this._followsMotionQuery) {
            this._followsMotionQuery = true;
            motionQuery.addEventListener?.('change', () => this.applyAccessibilitySettings());
        }

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
    /**
     * Reload a tab that did not survive being away.
     *
     * iOS Safari reclaims memory from backgrounded tabs, and a reader who
     * opens RISE the next morning gets the slate it paints on and nothing
     * else. The reflex is to reload; this does it for them. It reuses the
     * stale-build recovery payload, so the reload comes back to the view
     * they left rather than the portal.
     */
    watchTabFreshness() {
        watchTabFreshness({
            router: this.router,
            isReading: () => {
                const state = this.router?.getViewInstance('read')?.paneInstance('chamber')
                    ?.player?.sessionState?.state;
                return state === 'playing' || state === 'interlocuting';
            },
            reload: () => {
                const viewName = this.router?.currentView;
                try {
                    if (viewName) {
                        sessionStorage.setItem(
                            'rise_stale_reload', JSON.stringify({ viewName }));
                    }
                } catch (e) { /* private mode: reload to the portal */ }
                console.warn('[RISE] Tab went stale while away — reloading.');
                window.location.reload();
            },
            signal: this._utilityController?.signal
        });
    }

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
            const historyGeneration = ++this._historyNavigationGeneration;
            // Hash navigation belongs to the Rosary door. Browsers may emit
            // popstate alongside hashchange, and clearing the hash must not
            // pull an in-progress prayer back to Home.
            if (isRosaryDoor()) return;
            this.handleNavigationIntent('history');
            const route = await this.resolveAddress();
            if (historyGeneration !== this._historyNavigationGeneration) return;
            if (route.rewrite && this.router?.getCurrentView() === route.id && !this.router.transitioning
                && this.router.getViewInstance(route.id)?.activePane === route.data.pane) {
                // Already showing the room and pane the address should have named.
                this.router.updateAddress(route.data);
                return;
            }
            // A change inside a room (a catalog search, a Chapel chapter)
            // is updated in place by the router.
            await this.router?.navigate(route.id, {
                data: route.data, replace: true, skipStack: true, keepUrl: !route.rewrite
            });
            // A move to the room already showing writes nothing, so an
            // address that must be rewritten (a finished reading's) is
            // rewritten here once the room has settled.
            if (route.rewrite && historyGeneration === this._historyNavigationGeneration
                && this.router?.getCurrentView() === route.id) {
                this.router.updateAddress(route.data);
            }
         }, options);
    }

    /**
     * The room the address bar names, always a room that can open.
     * Unknown addresses, rooms this build does not register, Keystone slugs
     * the manifest does not carry, and a reading address with no reading to
     * show all land somewhere real: Home, or the Chamber's setup.
     */
    async resolveAddress() {
        const here = appLocation();
        let route = routeFromPath(here.pathname, here.search);
        if (route?.data?.pane === 'keystones' && route.data.slug) {
            const { keystoneSlugFromPath } = await import('./content/keystones.js');
            if (!keystoneSlugFromPath(here.pathname)) route = null;
        }
        // History never resurrects a reading: the Chamber is only the answer
        // while it is still on screen with its session, and not while the
        // reader is already leaving it (the address changes as a move begins).
        if (route?.id === 'read' && route.data.pane === 'chamber') {
            const showing = this.router?.getCurrentView() === 'read' && this.router.currentData?.pane === 'chamber'
                && this.currentSession && !this.router.transitioning;
            route = showing
                ? { id: 'read', data: this.router.currentData }
                : { id: 'read', data: { pane: 'setup' }, rewrite: true };
        }
        if (!route || !this.router?.views?.has(route.id)) route = { id: 'home', data: {} };
        return route;
    }

    /**
     * Same-tab `#rosary` after boot. Cold load still uses the
     * initializeApp path. Does not write location.hash.
     */
    handleRosaryDoorHash() {
        if (!isRosaryDoor() || !this.router) return;
        const library = this.router.getViewInstance('library');
        const onDoorSit = this.router.getCurrentView() === 'library'
            && library?.activePane === 'rosary'
            && library.paneInstance('rosary')?.door === true;
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
