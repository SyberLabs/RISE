import { describe, expect, it } from 'vitest';
import { createRecognizer, onDeviceStatus, speechRecognitionClass } from './recognition.js';

class FakeRecognition {
    static instances = [];
    constructor() {
        this.started = false;
        FakeRecognition.instances.push(this);
    }
    start() {
        this.started = true;
        this.onstart?.();
    }
    stop() {
        this.started = false;
        this.onend?.();
    }
    emit(results, resultIndex = 0) {
        this.onresult?.({
            resultIndex,
            results: results.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }))
        });
    }
    fail(error) {
        this.onerror?.({ error });
        this.started = false;
        this.onend?.();
    }
}

function listen(options = {}) {
    FakeRecognition.instances = [];
    const results = [];
    const states = [];
    let t = 0;
    const recognizer = createRecognizer({
        Recognition: FakeRecognition,
        onResult: (result) => results.push(result),
        onState: (state, detail) => states.push(detail ? `${state}:${detail}` : state),
        now: () => t,
        ...options
    });
    return { recognizer, results, states, advance: (ms) => { t += ms; }, current: () => FakeRecognition.instances.at(-1) };
}

describe('speech recognition', () => {
    it('streams interim text and emits each final once', () => {
        const { recognizer, results, states, current } = listen();
        recognizer.start();
        const recognition = current();
        expect(recognition).toMatchObject({ continuous: true, interimResults: true, lang: 'en-US' });
        expect(recognition.processLocally).toBeUndefined();
        recognition.emit([['Atlas ', false]]);
        recognition.emit([['Atlas renewal price', true], ['and the', false]]);
        recognition.emit([['Atlas renewal price', true], ['and the pipeline', false]], 1);
        expect(results).toEqual([
            { transcript: 'Atlas', isFinal: false, at: 0 },
            { transcript: 'Atlas renewal price', isFinal: true, at: 0 },
            { transcript: 'and the', isFinal: false, at: 0 },
            { transcript: 'and the pipeline', isFinal: false, at: 0 }
        ]);
        recognizer.stop();
        expect(states).toEqual(['starting', 'listening', 'stopped']);
    });

    it('restarts after the recognizer ends on its own, within a limit', () => {
        const { recognizer, states, current, advance } = listen();
        recognizer.start();
        current().fail('no-speech');
        advance(1000);
        current().fail('network');
        advance(1000);
        current().fail('network');
        expect(recognizer.state).toBe('listening');
        advance(1000);
        current().fail('network');
        expect(recognizer.state).toBe('error');
        expect(states.at(-1)).toBe('error:restart-limit');
        expect(FakeRecognition.instances).toHaveLength(4);
    });

    it('stops for good when the microphone is refused', () => {
        const { recognizer, states, current } = listen();
        recognizer.start();
        current().fail('not-allowed');
        expect(recognizer.state).toBe('error');
        expect(states).toEqual(['starting', 'listening', 'error:not-allowed']);
        expect(FakeRecognition.instances).toHaveLength(1);
    });

    it('asks for on-device recognition when required', async () => {
        const { recognizer, current } = listen({ processLocally: true });
        recognizer.start();
        expect(current().processLocally).toBe(true);
        expect(await onDeviceStatus(FakeRecognition, 'en-US')).toBe('unsupported');
        const Local = class extends FakeRecognition {
            static async available({ langs, processLocally }) {
                return langs[0] === 'en-US' && processLocally ? 'available' : 'unavailable';
            }
        };
        expect(await onDeviceStatus(Local, 'en-US')).toBe('available');
    });

    it('reports an unsupported browser instead of throwing', () => {
        expect(speechRecognitionClass({})).toBeNull();
        expect(speechRecognitionClass({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
        const states = [];
        createRecognizer({ Recognition: null, onState: (s, d) => states.push(`${s}:${d}`) }).start();
        expect(states).toEqual(['error:unsupported']);
    });
});
