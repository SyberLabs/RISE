/**
 * Speech unlocked inside a reader's press, for a browser voice begun later (voices/browser.js). A module of its
 * own, with no imports, so a host can call it synchronously in the press while the voice itself is still fetched.
 */

const unlocked = new WeakSet();

/**
 * Let this page speak later, from a reader's press: call it synchronously inside the press's own handler, before
 * anything is awaited. On iOS, WebKit drops a `speak()` made outside a user gesture, silently, with no event,
 * until one `speak()` has been made during one (Source/WebCore/Modules/speech/SpeechSynthesis.cpp: the
 * constructor sets RequireUserGestureForSpeechStart where the document requires a gesture for audio, as a
 * WKWebView does by default; `speak()` lifts it while processing a gesture, before it queues anything, and it
 * is the object's, so once lifted it stays lifted, and a later `cancel()` does not restore it). A reading's
 * first words come several awaits after Play, so one empty, silent utterance is spoken here, and `resume()`
 * clears an engine some page left paused. Elsewhere it is an empty utterance that ends at once. Once per engine.
 * @param {{synth?: object, Utterance?: Function}} speech
 */
export function unlockSpeech({ synth, Utterance } = {}) {
    if (!synth || typeof Utterance !== 'function' || unlocked.has(synth)) return;
    unlocked.add(synth);
    try {
        const hush = new Utterance('');
        hush.volume = 0;
        synth.speak(hush);
        synth.resume?.();
    } catch { /* a page that cannot speak has nothing to unlock */ }
}
