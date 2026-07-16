/**
 * R.I.S.E. Player Engine
 * Controls playback of atom sequences with precise timing
 */

import { SessionState } from './models.js';
import { responsiveFrequency } from './conductor.js';

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

        if (previousState === 'idle') {
            this.sessionState.startTime = Date.now();
        } else if (previousState === 'paused' && this.sessionState.pausedAt) {
            // Adjust start time to account for paused duration
            const pauseDuration = Date.now() - this.sessionState.pausedAt;
            this.sessionState.startTime += pauseDuration;
        }

        this.emit('state', { state: 'playing' });
        this.startProgressAnimation();
        
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
        
        if (!wasInterlocuting) {
            this.sessionState.pausedAt = Date.now();
        }

        if (this.atomStartTime) {
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
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        this.stopProgressAnimation();
        this.atomStartTime = null;
        this.currentAtomRemainingTime = null;
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
     * @param {Function} handlerFn - Async function that resolves when a flash completes
     */
    setInterlocutionHandler(handlerFn) {
        this.interlocutionHandler = handlerFn;
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
     * Coordinate advancing to the next atom, rolling natively for interlocution.
     */
    async processNextNode() {
        if (this.sessionState.state !== 'playing') return;
        
        const visualConfig = this.sessionState.session.visualConfig;
        const visualMode = visualConfig?.visualMode || 'off';

        if (visualMode === 'interlocution' && this.interlocutionHandler) {
            const interlocution = visualConfig.interlocution || {};

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

            if (Math.random() < frequency) {
                // We rolled a flash! Intercept the sequence.
                this.sessionState.state = 'interlocuting';
                this.emit('state', { state: 'interlocuting' });

                // Pause the main session clock so progress doesn't artificially advance
                this.sessionState.pausedAt = Date.now();
                this.stopProgressAnimation();

                try {
                    // Visual failures must never become playback failures.
                    await this.interlocutionHandler(interlocution.duration ?? 33, signal);
                } catch (error) {
                    this.emit('error', { phase: 'interlocution', error });
                    console.warn('[Player] Interlocution failed; continuing playback:', error);
                } finally {
                    // Stop, exit, or a user pause owns the resulting state.
                    if (this.sessionState.state === 'interlocuting') {
                        if (this.sessionState.pausedAt) {
                            this.sessionState.startTime += (Date.now() - this.sessionState.pausedAt);
                            this.sessionState.pausedAt = null;
                        }
                        this.sessionState.state = 'playing';
                        this.emit('state', { state: 'playing' });
                        this.startProgressAnimation();
                    }
                }

                // If the user exited, stopped, or paused during the flash, abort.
                if (this.sessionState.state !== 'playing') return;
            }
        }
        
        // Mathematically pure continuation
        this.sessionState.advance();
        this.scheduleNextAtom();
    }

    /**
     * Schedule the next atom to display
     * @param {boolean} isResuming - true if resuming from pause, guarantees no re-emit blink
     */
    scheduleNextAtom(isResuming = false) {
        // Guard: only schedule if actually playing
        if (this.sessionState.state !== 'playing') return;

        // Clear any pending timer to prevent race conditions
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }

        const atom = this.sessionState.currentAtom;

        if (!atom) {
            // Session complete
            this.sessionState.state = 'complete';
            this.sessionState.elapsedTime = Date.now() - this.sessionState.startTime;
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
                atomCount: this.sessionState.session.atomCount
            });
            return;
        }

        // Emit current atom only if we're not just safely resuming
        if (!isResuming) {
            this.emit('atom', {
                atom,
                index: this.sessionState.currentIndex,
                total: this.sessionState.session.atomCount
            });
            // Initialize remaining time on fresh atom, applying the dynamic speed factor
            this.currentAtomRemainingTime = Math.max(atom.duration * this.speedFactor, 50);
        }

        // Track precise micro-timings
        this.atomStartTime = performance.now();

        // Voice sync mode: let speech control timing
        if (this.voiceSyncEnabled && this.speakFn) {
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
        // Timer mode: use requestAnimationFrame for deterministic timing
        const displayTime = this.currentAtomRemainingTime;
        const targetTime = this.atomStartTime + displayTime;

        const checkTime = (timestamp) => {
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

    /**
     * Start continuous progress animation for smooth progress bar
     */
    startProgressAnimation() {
        // Cancel any existing animation
        this.stopProgressAnimation();

        const animate = () => {
            if (this.sessionState.state !== 'playing') return;

            const elapsed = Date.now() - this.sessionState.startTime;
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
        const atoms = this.sessionState.session.atoms;
        let remaining = 0;

        for (let i = this.sessionState.currentIndex; i < atoms.length; i++) {
            if (i === this.sessionState.currentIndex && this.currentAtomRemainingTime !== null) {
                const consumed = this.atomStartTime ? performance.now() - this.atomStartTime : 0;
                remaining += Math.max(0, this.currentAtomRemainingTime - consumed);
            } else {
                remaining += atoms[i].duration * this.speedFactor;
            }
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
        if (!this.sessionState.startTime) return 0;
        if (this.sessionState.state === 'paused') {
            return this.sessionState.pausedAt - this.sessionState.startTime;
        }
        if (this.sessionState.state === 'complete') {
            return this.sessionState.elapsedTime;
        }
        return Date.now() - this.sessionState.startTime;
    }

    /**
     * Destroy the player and clean up
     */
    destroy() {
        this.stop();
        this.listeners.clear();
    }
}
