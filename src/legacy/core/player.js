/**
 * R.I.S.E. Player Engine
 * Controls playback of atom sequences with precise timing
 */

import { SessionState } from './models.js';

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
        if (this.sessionState.state === 'playing') return;
        if (this.sessionState.isComplete) return;

        // Clear any pending timer from previous state
        if (this.timerId) {
            clearTimeout(this.timerId);
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
        this.scheduleNextAtom();
    }

    /**
     * Pause playback
     */
    pause() {
        if (this.sessionState.state !== 'playing') return;

        this.sessionState.state = 'paused';
        this.sessionState.pausedAt = Date.now();

        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        this.stopProgressAnimation();
        this.emit('state', { state: 'paused' });
    }

    /**
     * Toggle play/pause
     */
    toggle() {
        if (this.sessionState.state === 'playing') {
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
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        this.stopProgressAnimation();
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
     * Manually advance to next atom (used by voice sync callback)
     */
    advanceToNext() {
        if (this.sessionState.state !== 'playing') return;
        this.sessionState.advance();
        this.scheduleNextAtom();
    }

    /**
     * Schedule the next atom to display
     */
    scheduleNextAtom() {
        // Guard: only schedule if actually playing
        if (this.sessionState.state !== 'playing') return;

        // Clear any pending timer to prevent race conditions
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        const atom = this.sessionState.currentAtom;

        if (!atom) {
            // Session complete
            this.sessionState.state = 'complete';
            this.sessionState.elapsedTime = Date.now() - this.sessionState.startTime;
            this.emit('state', { state: 'complete' });
            this.emit('complete', {
                duration: this.sessionState.elapsedTime,
                atomCount: this.sessionState.session.atomCount
            });
            return;
        }

        // Emit current atom
        this.emit('atom', {
            atom,
            index: this.sessionState.currentIndex,
            total: this.sessionState.session.atomCount
        });

        // Emit progress
        this.emit('progress', {
            progress: this.sessionState.progress,
            elapsed: Date.now() - this.sessionState.startTime,
            remaining: this.calculateRemainingTime()
        });

        // Voice sync mode: let speech control timing
        if (this.voiceSyncEnabled && this.speakFn) {
            // Speak the atom text, advance when speech ends
            this.speakFn(atom.content, {
                onEnd: () => {
                    // Small buffer after speech ends
                    this.timerId = setTimeout(() => {
                        if (this.sessionState.state !== 'playing') return;
                        this.sessionState.advance();
                        this.scheduleNextAtom();
                    }, 200); // 200ms post-speech buffer
                }
            });
        } else {
            // Timer mode: use calculated duration
            const displayTime = Math.max(atom.duration, 100);

            this.timerId = setTimeout(() => {
                if (this.sessionState.state !== 'playing') return;
                this.sessionState.advance();
                this.scheduleNextAtom();
            }, displayTime);
        }
    }

    /**
     * Start continuous progress animation for smooth progress bar
     */
    startProgressAnimation() {
        // Cancel any existing animation
        this.stopProgressAnimation();

        const totalDuration = this.sessionState.session.totalDuration;

        const animate = () => {
            if (this.sessionState.state !== 'playing') return;

            // Calculate real-time progress based on elapsed time
            const elapsed = Date.now() - this.sessionState.startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            const remaining = Math.max(0, totalDuration - elapsed);

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

        this.progressFrameId = requestAnimationFrame(animate);
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
            remaining += atoms[i].duration;
        }

        return remaining;
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
