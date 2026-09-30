/**
 * A `speechSynthesis` that runs on a clock the test owns.
 *
 * It behaves the way the browser one does where it matters to a voice
 * renderer: utterances queue and are spoken one at a time; `onstart` comes
 * after a latency; `onboundary` fires at each word (or never, for the voices
 * that do not report them); `pause` freezes it and `resume` carries on;
 * `cancel` stops the current utterance and drops the queue, and the cancelled
 * utterance reports `onerror` with `canceled`, or `onend`, as browsers differ.
 */
export function createFakeSpeech(clock, {
    msPerChar = 50, latencyMs = 30, boundaries = true, cancelReports = 'error', failWith = null
} = {}) {
    const queue = [];
    let current = null;
    let paused = false;

    class Utterance {
        constructor(text) {
            this.text = text;
            this.lang = '';
            this.rate = 1;
            this.voice = null;
            this.onstart = null;
            this.onend = null;
            this.onerror = null;
            this.onboundary = null;
        }
    }

    const words = text => [...text.matchAll(/\S+/gu)].map(match => match.index);

    function begin(utterance) {
        const total = utterance.text.length * msPerChar;
        const events = [{ at: latencyMs, run: () => utterance.onstart?.({}) }];
        if (boundaries) {
            for (const charIndex of words(utterance.text)) {
                events.push({ at: latencyMs + charIndex * msPerChar, run: () => utterance.onboundary?.({ name: 'word', charIndex }) });
            }
        }
        events.push({ at: latencyMs + total, run: () => { current = null; utterance.onend?.({}); next(); } });
        current = { utterance, events, index: 0, played: 0, since: null, cancel: null };
        if (failWith) {
            current.events = [{ at: latencyMs, run: () => { current = null; utterance.onerror?.({ error: failWith }); next(); } }];
        }
        schedule();
    }

    function schedule() {
        if (!current || paused) return;
        const target = current;
        const event = target.events[target.index];
        if (!event) return;
        target.since = clock.now();
        target.cancel = clock.setTimer(() => {
            target.cancel = null;
            target.played = event.at;
            target.since = clock.now();
            target.index += 1;
            event.run();
            if (current === target) schedule();
        }, Math.max(0, event.at - target.played));
    }

    function next() {
        if (current || paused) return;
        const utterance = queue.shift();
        if (utterance) begin(utterance);
    }

    return {
        Utterance,
        get speaking() { return current !== null; },
        get paused() { return paused; },
        get pending() { return queue.length; },

        speak(utterance) {
            queue.push(utterance);
            next();
        },

        pause() {
            if (paused) return;
            paused = true;
            if (current) {
                current.played += clock.now() - current.since;
                current.since = null;
                current.cancel?.();
                current.cancel = null;
            }
        },

        resume() {
            if (!paused) return;
            paused = false;
            if (current) schedule();
            else next();
        },

        cancel() {
            queue.length = 0;
            const stopped = current;
            current = null;
            if (stopped) {
                stopped.cancel?.();
                clock.setTimer(() => {
                    if (cancelReportsError()) stopped.utterance.onerror?.({ error: 'canceled' });
                    else stopped.utterance.onend?.({});
                }, 0);
            }
            paused = false;
        },

        getVoices() {
            return [{ name: 'Fake voice', lang: 'en-US' }];
        }
    };

    function cancelReportsError() {
        return cancelReports === 'error';
    }
}
