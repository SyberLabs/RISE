/**
 * The beds' audio, unlocked inside a reader's press (the card's Play). A module of its own, with no imports, so a
 * host can call it synchronously in the press, next to unlockSpeech (src/live/voices/unlock.js).
 */

/**
 * Call it synchronously inside the press's own handler, before anything is awaited. Two things, both WebKit's:
 *
 * - The context. WebKit starts an AudioContext only from a resume() made while a user gesture is being processed,
 *   where the page requires one for audio, as a WKWebView does by default (WebCore/Modules/webaudio/AudioContext.cpp,
 *   willBeginPlayback). The engine's own resume comes several awaits after the press, so it is asked here too. Its
 *   first step calls context.resume() synchronously.
 * - The audio session. On iOS, WebKit puts Web Audio playing alone under the Ambient category, which the ring/silent
 *   switch mutes, and under Playback when an audible <audio> or <video> plays
 *   (WebCore/platform/audio/cocoa/MediaSessionManagerCocoa.mm, updateSessionState). The browser's voice is spoken by
 *   the app itself, so the voice is heard and the beds are not. `navigator.audioSession.type = 'playback'` asks for
 *   Playback directly, but WebKit ignores it in a document without the microphone permission
 *   (DOMAudioSession.cpp, setType), as a host's card may be. So a silent file is also played in a loop, and that does
 *   not depend on the permission. An <audio> must start in a press too. Only a browser with `navigator.audioSession`
 *   (WebKit) gets either: nowhere else does a switch mute Web Audio.
 *
 * @param {object} [options]
 * @param {{context?: {state: string}, resume?: Function}} [options.engine] the app's audio engine, if it is known yet
 * @param {object} [options.navigator]
 * @param {Function} [options.Audio] the HTMLAudioElement constructor
 * @param {string} [options.silence] the address of a short silent sound file of RISE's
 * @param {object} [options.keeper] the loop an earlier press started, to play again
 * @returns {object|null} the silent loop, playing, or null where none is needed
 */
export function unlockAudio({ engine, navigator, Audio, silence, keeper = null } = {}) {
    try {
        if (engine?.context && engine.context.state !== 'running') void Promise.resolve(engine.resume?.()).catch(() => {});
    } catch { /* an engine that cannot resume is resumed by its own path, or not at all */ }
    const session = navigator?.audioSession;
    if (!session) return null;
    try { session.type = 'playback'; } catch { /* the loop below asks for the same session */ }
    if (!keeper && (typeof Audio !== 'function' || !silence)) return null;
    try {
        if (!keeper) {
            keeper = new Audio(silence);
            keeper.loop = true;
        }
        void Promise.resolve(keeper.play()).catch(() => {});
    } catch { /* without the loop the beds keep WebKit's own session */ }
    return keeper;
}
