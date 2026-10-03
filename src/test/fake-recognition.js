/**
 * A speech recogniser with the events the Web Speech API documents, driven by
 * the test: `start`, `result` (interim and final), `error`, `end`. It records
 * every instance so a test can say whether a microphone was ever left open.
 */
export function createFakeRecognition({ throwOnStart = false, throwOnConstruct = false, endsOnStop = false } = {}) {
    const instances = [];
    class Recognition {
        constructor() {
            if (throwOnConstruct) throw new Error('not allowed to construct');
            this.started = false;
            this.stopped = false;
            this.aborted = false;
            this.onstart = null;
            this.onresult = null;
            this.onerror = null;
            this.onend = null;
            instances.push(this);
        }
        start() {
            if (throwOnStart) throw new Error('already started');
            this.started = true;
        }
        /** Like a browser, the end that follows a stop is queued, not immediate; `endsOnStop` has it come by itself. */
        stop() {
            this.stopped = true;
            if (endsOnStop) queueMicrotask(() => this.end());
        }
        abort() { this.aborted = true; }

        // What the test does to it.
        begin() { this.onstart?.({}); }
        say(transcript, { final = false, index = 0, results } = {}) {
            const list = results ?? [Object.assign([{ transcript, confidence: 0.9 }], { isFinal: final })];
            this.onresult?.({ resultIndex: index, results: list });
        }
        fail(error) { this.onerror?.({ error }); }
        end() { this.onend?.({}); }
    }
    Recognition.instances = instances;
    return Recognition;
}

/** Instances still holding a microphone: started, and neither stopped nor aborted. */
export const open = Recognition => Recognition.instances.filter(item => item.started && !item.stopped && !item.aborted);
