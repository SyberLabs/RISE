/**
 * R.I.S.E. Player Engine
 * Controls playback of atom sequences with precise timing
 */

import { SessionState } from './models.js';
import { responsiveFrequency } from './conductor.js';
import {
    VISUAL_PRESENCE_DEFAULT_MS,
    minimumVisualPresenceRest,
    normalizeVisualPresence
} from './visual-presence.js';

function isInterlocutionEligibleAtom(atom) {
    return atom?.modality === 'text'
        && typeof atom.content === 'string'
        && atom.content.trim().length > 0;
}

/**
 * Rhythmic visuals are interstitial: a completed semantic atom may lead into
 * another semantic atom through at most one visual presence. Blank, authored
 * pause, paragraph, and source-boundary atoms deliberately break eligibility.
 */
function isInterlocutionEligibleBoundary(atoms, index) {
    return isInterlocutionEligibleAtom(atoms?.[index])
        && isInterlocutionEligibleAtom(atoms?.[index + 1]);
}

function createInterlocutionStats() {
    return {
        opportunities: 0,
        probabilityRejected: 0,
        cadenceRejected: 0,
        sourceRejected: 0,
        renderRejected: 0,
        aborted: 0,
        presented: 0,
        skipped: 0,
        visibleDurationMs: 0
    };
}

function normalizeInterlocutionResult(result, requestedDurationMs) {
    if (result && typeof result === 'object' && typeof result.presented === 'boolean') {
        const visibleDuration = Number(result.presentedDurationMs);
        return {
            presented: result.presented,
            requestedDurationMs: normalizeVisualPresence(
                result.requestedDurationMs ?? requestedDurationMs
            ),
            presentedDurationMs: Number.isFinite(visibleDuration)
                ? Math.max(0, visibleDuration)
                : (result.presented ? requestedDurationMs : 0),
            reason: typeof result.reason === 'string'
                ? result.reason
                : (result.presented ? 'presented' : 'render-failed')
        };
    }

    // Preserve compatibility with extensions written for the former boolean
    // contract while keeping all built-in accounting explicit.
    const presented = result !== false && result?.rendered !== false;
    return {
        presented,
        requestedDurationMs,
        presentedDurationMs: presented ? requestedDurationMs : 0,
        reason: presented ? 'presented' : 'render-failed'
    };
}

function rejectionCounterFor(reason) {
    if (['cadence', 'rest', 'duty', 'rapid-start', 'burst'].includes(reason)) {
        return 'cadenceRejected';
    }
    if (['source-unavailable', 'not-ready', 'no-content'].includes(reason)) {
        return 'sourceRejected';
    }
    if (reason === 'aborted' || reason === 'config-changed') return 'aborted';
    return 'renderRejected';
}

/**
 * Estimate demand from eligible semantic transitions. Frequency is a
 * probability per boundary, so chunking mode intentionally shapes visual
 * density: Word is staccato, Phrase is measured, and Sentence contemplative.
 */
export function estimateInterlocutionCount(session, frequency = 0.2) {
    const probability = Math.max(0, Math.min(1, Number(frequency) || 0));
    if (!session || probability === 0) return 0;

    const atoms = session.atoms || [];
    let eligibleBoundaries = 0;
    let eligibleDuration = 0;
    for (let index = 0; index < atoms.length - 1; index++) {
        if (!isInterlocutionEligibleBoundary(atoms, index)) continue;
        eligibleBoundaries++;
        const duration = Number(atoms[index].duration);
        if (Number.isFinite(duration) && duration > 0) eligibleDuration += duration;
    }

    if (eligibleBoundaries === 0) return 0;

    let presence = normalizeVisualPresence(
        session.visualConfig?.interlocution?.duration ?? VISUAL_PRESENCE_DEFAULT_MS
    );
    // Responsive sessions contract duration to 75–100% of the selected
    // value; estimating with the midpoint keeps variety from depleting
    // late in highly active sessions.
    if (session.visualConfig?.interlocution?.responsive) {
        presence = normalizeVisualPresence(presence * 0.85);
    }
    const opportunities = eligibleBoundaries * probability;
    const restLimitedPresentations = eligibleDuration
        / minimumVisualPresenceRest(presence);

    return Math.ceil(Math.min(
        eligibleBoundaries,
        opportunities,
        restLimitedPresentations
    )) + 2;
}

/**
 * Event types emitted by the player
 * @typedef {'atom' | 'progress' | 'state' | 'complete'} PlayerEvent
 */

/**
 * The Player controls the temporal flow of atoms during a session.
 * It handles timing, pausing, and emits events for the display layer.
 */
export class Player {
    /**
     * @param {import('./models.js').Session} session 
     */
    constructor(session) {
        this.sessionState = new SessionState(session);
        this.listeners = new Map();
        this.timerId = null;
        this.progressFrameId = null; // For smooth progress animation
        this.transitionDuration = 300; // ms for fade transitions
        this.atomStartTime = null;
        this.currentAtomRemainingTime = null;
        this.speedFactor = 1.0; // Dynamic multiplier (1.0 = normal, 0.5 = 2x speed)
        this.speechSyncId = 0; // Guard against late callbacks from old speech requests
        this.sessionWallStartTime = null;
        this.interlocutionStats = createInterlocutionStats();
        this._playbackEpoch = 0;

        // BOUNDARY TRANSACTION: a flash only ever intercepts a COMPLETED
        // atom. If a pause interrupts the flash before the next atom was
        // prepared, resuming must advance past the completed atom — never
        // replay it. Open when a roll wins, closed on normal completion.
        this._boundaryFlash = null;

        // READING CLOCK: one monotonic accumulator that advances only
        // while the state is 'playing'. Progress and elapsed derive from
        // it — never from wall time, which jumps across tab suspension,
        // system sleep, and clock adjustments. Wall time remains a
        // separate, honest metric (sessionWallStartTime).
        this._reading = { accumulatedMs: 0, tickAnchor: null };

        // Prefix duration sums make remaining-time O(1) per progress
        // frame instead of a per-frame scan of every remaining atom.
        const atoms = session?.atoms || [];
        this._prefixDurations = new Float64Array(atoms.length + 1);
        for (let i = 0; i < atoms.length; i++) {
            const duration = Number(atoms[i]?.duration);
            this._prefixDurations[i + 1] = this._prefixDurations[i]
                + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
        }
        this._totalAuthoredMs = this._prefixDurations[atoms.length];

        // Hidden tabs suspend RAF while wall time races ahead. Policy:
        // auto-pause when hidden, auto-resume only if WE paused it.
        this._autoPausedByVisibility = false;
        this._boundVisibility = () => this._handleVisibilityChange();
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', this._boundVisibility);
        }
    }

    // ─── Reading clock ───

    _readingNow() {
        return this._reading.accumulatedMs + (this._reading.tickAnchor !== null
            ? performance.now() - this._reading.tickAnchor
            : 0);
    }

    _readingResume() {
        if (this._reading.tickAnchor === null) {
            this._reading.tickAnchor = performance.now();
        }
    }

    _readingPause() {
        if (this._reading.tickAnchor !== null) {
            this._reading.accumulatedMs += performance.now() - this._reading.tickAnchor;
            this._reading.tickAnchor = null;
        }
    }

    _handleVisibilityChange() {
        if (typeof document === 'undefined') return;
        if (document.hidden && ['playing', 'interlocuting'].includes(this.sessionState.state)) {
            this._autoPausedByVisibility = true;
            this.pause();
        } else if (!document.hidden && this._autoPausedByVisibility
            && this.sessionState.state === 'paused') {
            this._autoPausedByVisibility = false;
            this.play();
        }
    }

    /**
     * Subscribe to player events
     * @param {PlayerEvent} event 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.listeners.get(event).delete(callback);
    }

    /**
     * Emit an event to all listeners
     * @param {PlayerEvent} event 
     * @param {*} data 
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                callback(data);
            }
        }
    }

    /**
     * Start or resume playback
     */
    play() {
        if (this.sessionState.state === 'playing' || this.sessionState.state === 'interlocuting') return;
        if (this.sessionState.isComplete) return;

        // Clear any pending timer from previous state
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        const previousState = this.sessionState.state;
        this.sessionState.state = 'playing';
        this._readingResume();
        // A deliberate play is never a visibility resume
        if (previousState === 'paused') this._autoPausedByVisibility = false;

        if (previousState === 'idle') {
            this.sessionState.startTime = Date.now();
            this.sessionWallStartTime = this.sessionState.startTime;
        } else if (previousState === 'paused' && this.sessionState.pausedAt) {
            // Adjust start time to account for paused duration
            const pauseDuration = Date.now() - this.sessionState.pausedAt;
            this.sessionState.startTime += pauseDuration;
        }

        this.emit('state', { state: 'playing' });
        this.startProgressAnimation();

        // Close an interrupted boundary transaction: the pause landed
        // mid-flash, before the next atom was prepared. The atom at the
        // transaction index already completed its full display — resume
        // by advancing past it, never by replaying it. (If the covered
        // hook already advanced, the index no longer matches and the
        // remaining-time resume below handles it.)
        const boundaryFlash = this._boundaryFlash;
        this._boundaryFlash = null;
        if (previousState === 'paused'
            && boundaryFlash
            && boundaryFlash.index === this.sessionState.currentIndex
            && this.currentAtomRemainingTime === null) {
            this.sessionState.advance();
        }

        const isResuming = (previousState === 'paused' && this.currentAtomRemainingTime !== null);
        this.scheduleNextAtom(isResuming);
    }

    /**
     * Pause playback
     */
    pause() {
        if (this.sessionState.state !== 'playing' && this.sessionState.state !== 'interlocuting') return;

        const wasInterlocuting = this.sessionState.state === 'interlocuting';
        this.sessionState.state = 'paused';
        this._readingPause();

        if (wasInterlocuting) {
            try {
                this.interlocutionCancelHandler?.('paused');
            } catch (error) {
                console.warn('[Player] Interlocution pause cancellation failed:', error);
            }
        }

        if (!wasInterlocuting) {
            this.sessionState.pausedAt = Date.now();
        }

        if (this.atomStartTime !== null) {
            const consumed = performance.now() - this.atomStartTime;
            if (this.currentAtomRemainingTime === null) {
                const atom = this.sessionState.currentAtom;
                this.currentAtomRemainingTime = Math.max(atom.duration * this.speedFactor, 50);
            }
            this.currentAtomRemainingTime = Math.max(0, this.currentAtomRemainingTime - consumed);
            this.atomStartTime = null;
        }

        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        this.stopProgressAnimation();
        
        // Stop any ongoing speech immediately
        if (this.voiceSyncEnabled && this.speakFn) {
            this.speakFn(null, { stop: true });
        }
        
        this.emit('state', { state: 'paused' });
    }

    /**
     * Toggle play/pause
     */
    toggle() {
        if (this.sessionState.state === 'playing' || this.sessionState.state === 'interlocuting') {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Stop playback and reset
     */
    stop() {
        this._playbackEpoch++;
        try {
            this.interlocutionCancelHandler?.('aborted');
        } catch (error) {
            console.warn('[Player] Interlocution cancellation failed:', error);
        }
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        this.stopProgressAnimation();
        this.atomStartTime = null;
        this.currentAtomRemainingTime = null;
        this.sessionWallStartTime = null;
        this._reading = { accumulatedMs: 0, tickAnchor: null };
        this._autoPausedByVisibility = false;
        this._boundaryFlash = null;
        this.interlocutionStats = createInterlocutionStats();
        this.sessionState.reset();
        this.emit('state', { state: 'idle' });
    }

    /**
     * Enable voice-synced progression
     * @param {boolean} enabled 
     * @param {Function} speakFn - Function to call to speak text, receives (text, options)
     */
    setVoiceSync(enabled, speakFn = null) {
        this.voiceSyncEnabled = enabled;
        this.speakFn = speakFn;
        console.log(`[Player] Voice sync: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Register a callback to handle visual interlocutions natively within the Engine
     * @param {Function} handlerFn - Async function receiving duration, signal,
     *   and lifecycle hooks; resolves when a presence completes
     * @param {Function|null} cancelFn - Synchronously cancels an active presentation
     */
    setInterlocutionHandler(handlerFn, cancelFn = null) {
        this.interlocutionHandler = handlerFn;
        this.interlocutionCancelHandler = typeof cancelFn === 'function' ? cancelFn : null;
    }

    /**
     * Set the real-time speed multiplier
     * @param {number} factor - e.g. 0.8 for 20% faster
     */
    setSpeedFactor(factor) {
        const parsed = Number(factor);
        this.speedFactor = Number.isFinite(parsed)
            ? Math.max(0.1, Math.min(5.0, parsed))
            : 1.0;
        console.log(`[Player] Speed factor set to: ${this.speedFactor}`);
    }

    /**
     * Manually advance to next atom (used by voice sync callback)
     */
    advanceToNext() {
        if (this.sessionState.state !== 'playing') return;
        this.currentAtomRemainingTime = null;
        
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        this.processNextNode();
    }

    /**
     * Attempt one boundary-locked interlocution opportunity without advancing
     * the text. The caller owns the completed-atom -> presence -> next-atom
     * sequence.
     */
    async attemptInterlocution(lifecycle = {}) {
        if (this.sessionState.state !== 'playing') return;
        const playbackEpoch = this._playbackEpoch;
        let rendered = false;
        
        const visualConfig = this.sessionState.session.visualConfig;
        const visualMode = visualConfig?.visualMode || 'off';

        if (visualMode === 'interlocution' && this.interlocutionHandler) {
            const interlocution = visualConfig.interlocution || {};
            this.interlocutionStats.opportunities++;

            // Responsive interlocutions (opt-in): the semantic track scales
            // flash probability with passage arousal, and the signal is
            // forwarded so the handler can pick generator/preset/duration.
            // Without the flag or a track this is the raw platform behavior.
            let frequency = interlocution.frequency ?? 0.3;
            let signal = null;
            const track = this.sessionState.session.semanticTrack;
            if (interlocution.responsive && Array.isArray(track)) {
                signal = track[this.sessionState.currentIndex] || null;
                // Frequency scaling is the rhythm intent — gated independently
                // of mood so a deliberately tuned pulse can stay fixed
                if (interlocution.responsiveRhythm ?? true) {
                    frequency = responsiveFrequency(frequency, signal);
                }
            }

            frequency = Math.max(0, Math.min(1, Number(frequency) || 0));
            if (Math.random() < frequency) {
                // We rolled a flash! Intercept the sequence. The atom at
                // currentIndex has fully completed its display; open the
                // boundary transaction so an interrupting pause resumes
                // PAST it instead of replaying it.
                this._boundaryFlash = { index: this.sessionState.currentIndex };
                this.sessionState.state = 'interlocuting';
                this.emit('state', { state: 'interlocuting' });

                // Pause the reading clock — presence time is not reading time
                this._readingPause();
                this.sessionState.pausedAt = Date.now();
                this.stopProgressAnimation();

                try {
                    // Visual failures must never become playback failures.
                    const requestedDurationMs = normalizeVisualPresence(
                        interlocution.duration ?? VISUAL_PRESENCE_DEFAULT_MS
                    );
                    const result = await this.interlocutionHandler(
                        requestedDurationMs,
                        signal,
                        lifecycle
                    );
                    if (playbackEpoch !== this._playbackEpoch) return false;
                    const presentation = normalizeInterlocutionResult(result, requestedDurationMs);
                    rendered = presentation.presented;
                    this.interlocutionStats.visibleDurationMs += presentation.presentedDurationMs;
                    if (presentation.presented) {
                        this.interlocutionStats.presented++;
                    } else {
                        this.interlocutionStats.skipped++;
                        const counter = rejectionCounterFor(presentation.reason);
                        this.interlocutionStats[counter]++;
                    }
                } catch (error) {
                    if (playbackEpoch !== this._playbackEpoch) return false;
                    this.interlocutionStats.skipped++;
                    this.interlocutionStats.renderRejected++;
                    this.emit('error', { phase: 'interlocution', error });
                    console.warn('[Player] Interlocution failed; continuing playback:', error);
                } finally {
                    // Stop, exit, or a user pause owns the resulting state.
                    if (this.sessionState.state === 'interlocuting') {
                        // Normal completion: playback continues through
                        // processNextNode, which advances the boundary
                        // itself — the transaction is complete.
                        this._boundaryFlash = null;
                        if (this.sessionState.pausedAt) {
                            this.sessionState.startTime += (Date.now() - this.sessionState.pausedAt);
                            this.sessionState.pausedAt = null;
                        }
                        this.sessionState.state = 'playing';
                        this._readingResume();
                        this.emit('state', { state: 'playing' });
                        this.startProgressAnimation();
                    }
                }

                // If the user exited, stopped, or paused during the flash, abort.
                if (this.sessionState.state !== 'playing') return;
            } else {
                this.interlocutionStats.probabilityRejected++;
                this.interlocutionStats.skipped++;
            }
        }
        
        return rendered;
    }

    /**
     * Complete the current atom, optionally occupy its semantic boundary with
     * one visual presence, then advance exactly once. Timer and voice playback
     * intentionally share this path.
     */
    async processNextNode() {
        if (this.sessionState.state !== 'playing') return;

        const atoms = this.sessionState.session.atoms;
        if (isInterlocutionEligibleBoundary(atoms, this.sessionState.currentIndex)) {
            const playbackEpoch = this._playbackEpoch;
            let preparedNextAtom = false;
            await this.attemptInterlocution({
                onCovered: () => {
                    if (preparedNextAtom || playbackEpoch !== this._playbackEpoch) return;
                    if (!['interlocuting', 'paused'].includes(this.sessionState.state)) return;
                    this.sessionState.advance();
                    preparedNextAtom = true;
                    this._prepareCurrentAtom({ concealed: true });
                }
            });
            if (this.sessionState.state !== 'playing') return;
            if (preparedNextAtom) {
                // The next atom is already stable behind the fully opaque
                // visual. Start its full reading duration only after reveal.
                this.scheduleNextAtom(false, { alreadyPrepared: true });
                return;
            }
        }

        this.sessionState.advance();
        this.scheduleNextAtom();
    }

    _prepareCurrentAtom({ concealed = false } = {}) {
        const atom = this.sessionState.currentAtom;
        if (!atom) return false;
        this.emit('atom', {
            atom,
            index: this.sessionState.currentIndex,
            total: this.sessionState.session.atomCount,
            concealed
        });
        this.currentAtomRemainingTime = Math.max(atom.duration * this.speedFactor, 50);
        return true;
    }

    /**
     * Schedule the next atom to display
     * @param {boolean} isResuming - true if resuming from pause, guarantees no re-emit blink
     * @param {Object} [options]
     * @param {boolean} [options.alreadyPrepared] - the atom was emitted while
     *   concealed and should begin normally without being emitted a second time
     */
    scheduleNextAtom(isResuming = false, { alreadyPrepared = false } = {}) {
        // Guard: only schedule if actually playing
        if (this.sessionState.state !== 'playing') return;

        // Clear any pending timer to prevent race conditions
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        const atom = this.sessionState.currentAtom;

        if (!atom) {
            // Session complete — reading time from the monotonic clock,
            // wall time honestly separate
            this.sessionState.state = 'complete';
            this._readingPause();
            this.sessionState.elapsedTime = Math.round(this._readingNow());
            const wallDurationMs = this.sessionWallStartTime === null
                ? this.sessionState.elapsedTime
                : Date.now() - this.sessionWallStartTime;
            this.emit('progress', {
                progress: 1,
                elapsed: this.sessionState.elapsedTime,
                total: this.sessionState.elapsedTime,
                remaining: 0,
                index: this.sessionState.currentIndex,
                atomCount: this.sessionState.session.atomCount
            });
            this.emit('state', { state: 'complete' });
            this.emit('complete', {
                duration: this.sessionState.elapsedTime,
                readingDurationMs: this.sessionState.elapsedTime,
                presenceDurationMs: this.interlocutionStats.visibleDurationMs,
                wallDurationMs,
                presentedCount: this.interlocutionStats.presented,
                skippedCount: this.interlocutionStats.skipped,
                interlocution: { ...this.interlocutionStats },
                atomCount: this.sessionState.session.atomCount
            });
            return;
        }

        // Emit current atom only if we're not just safely resuming
        if (!isResuming && !alreadyPrepared) {
            this._prepareCurrentAtom();
        }

        // Voice sync mode: let speech control timing
        if (this.voiceSyncEnabled && this.speakFn) {
            this.atomStartTime = performance.now();
            // Increment sync ID to orphan any callbacks from previous atoms
            const currentSyncId = ++this.speechSyncId;

            // Speak the atom text, advance when speech ends
            if (!isResuming) {
                this.speakFn(atom.content, {
                    onEnd: () => {
                        // Guard: Only proceed if we haven't advanced/paused/synced to a new ID
                        if (this.speechSyncId !== currentSyncId) return;
                        if (this.sessionState.state !== 'playing') return;

                        // Small buffer after speech ends
                        const targetTime = performance.now() + 200;
                        const checkBuffer = (timestamp) => {
                            if (this.speechSyncId !== currentSyncId) return;
                            if (this.sessionState.state !== 'playing') return;
                            
                            if (timestamp >= targetTime) {
                                this.currentAtomRemainingTime = null;
                                this.processNextNode();
                            } else {
                                this.timerId = requestAnimationFrame(checkBuffer);
                            }
                        };
                        this.timerId = requestAnimationFrame(checkBuffer);
                    }
                });
            } else {
                // If resuming, we don't restart the text (could be jarring), 
                // BUT we need to ensure the timer still knows how to advance.
                // In voice sync, if we pause, we stop speaking. 
                // Technically we should resume the text from where it was, 
                // but SpeechSynthesis makes that hard. For now, we will 
                // just advance after the normal duration if resuming.
                const remaining = this.currentAtomRemainingTime || 2000; // Fallback to 2s if no remaining time
                const targetTime = performance.now() + remaining;

                const checkTime = (timestamp) => {
                    if (this.speechSyncId !== currentSyncId) return;
                    if (this.sessionState.state !== 'playing') return;
                    
                    if (timestamp >= targetTime) {
                        this.currentAtomRemainingTime = null;
                        this.processNextNode();
                    } else {
                        this.timerId = requestAnimationFrame(checkTime);
                    }
                };
                this.timerId = requestAnimationFrame(checkTime);
            }
            return;
        }
        // Timer mode: preserve the atom as one uninterrupted perceptual unit.
        // Any visual opportunity is evaluated only after this timer completes,
        // inside processNextNode, before the next atom is emitted.
        const displayTime = this.currentAtomRemainingTime;
        this.atomStartTime = performance.now();
        const targetTime = this.atomStartTime + displayTime;

        const checkTime = (timestamp) => {
            if (this.sessionState.state !== 'playing') return;
            
            if (timestamp >= targetTime) {
                this.timerId = null;
                this.atomStartTime = null;
                this.currentAtomRemainingTime = null;
                void this.processNextNode();
            } else {
                this.timerId = requestAnimationFrame(checkTime);
            }
        };
        
        this.timerId = requestAnimationFrame(checkTime);
    }

    /**
     * Start continuous progress animation for smooth progress bar
     */
    startProgressAnimation() {
        // Cancel any existing animation
        this.stopProgressAnimation();

        const animate = () => {
            if (this.sessionState.state !== 'playing') return;

            const elapsed = this._readingNow();
            const remaining = this.calculateRemainingTime();
            const totalDuration = elapsed + remaining;
            const progress = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 1;

            this.emit('progress', {
                elapsed,
                total: totalDuration,
                remaining,
                progress,
                index: this.sessionState.currentIndex,
                atomCount: this.sessionState.session.atomCount
            });

            // Continue animation if still playing
            if (progress < 1 && this.sessionState.state === 'playing') {
                this.progressFrameId = requestAnimationFrame(animate);
            }
        };

        // Paint an accurate initial value immediately, then let one animation
        // frame loop own every subsequent update. Atom boundaries must not
        // inject index-based values into this elapsed-time timeline.
        animate();
    }

    /**
     * Stop the progress animation loop
     */
    stopProgressAnimation() {
        if (this.progressFrameId) {
            cancelAnimationFrame(this.progressFrameId);
            this.progressFrameId = null;
        }
    }

    /**
     * Calculate remaining time in milliseconds
     * @returns {number}
     */
    calculateRemainingTime() {
        // O(1) via prefix sums — the old per-frame scan of every
        // remaining atom made the progress bar itself a jank source on
        // long Word-mode sessions.
        const prefix = this._prefixDurations;
        const index = this.sessionState.currentIndex;
        const lastIndex = prefix.length - 1;
        if (index >= lastIndex) return 0;

        // Atoms after the current one, at the current speed
        let remaining = (this._totalAuthoredMs - prefix[index + 1]) * this.speedFactor;

        // The current atom: live remainder when mid-flight, else full
        if (this.currentAtomRemainingTime !== null) {
            const consumed = this.atomStartTime !== null
                ? performance.now() - this.atomStartTime
                : 0;
            remaining += Math.max(0, this.currentAtomRemainingTime - consumed);
        } else {
            remaining += (prefix[index + 1] - prefix[index]) * this.speedFactor;
        }

        return Math.round(remaining);
    }

    /**
     * Get current state
     * @returns {PlayerState}
     */
    get state() {
        return this.sessionState.state;
    }

    /**
     * Get current progress (0-1)
     * @returns {number}
     */
    get progress() {
        return this.sessionState.progress;
    }

    /**
     * Get elapsed time in milliseconds
     * @returns {number}
     */
    get elapsed() {
        // The monotonic reading clock: pause, interlocution, hidden
        // tabs, and wall-clock jumps never inflate it
        if (this.sessionState.state === 'complete') {
            return this.sessionState.elapsedTime;
        }
        return Math.round(this._readingNow());
    }

    /**
     * Destroy the player and clean up
     */
    destroy() {
        this.stop();
        if (typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener('visibilitychange', this._boundVisibility);
        }
        this.listeners.clear();
    }
}
