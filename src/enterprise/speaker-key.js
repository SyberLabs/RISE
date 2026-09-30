/**
 * Hold a key to mark audience speech. Web Speech has no speaker labels, so
 * the presenter holds a key while someone in the room speaks. An utterance
 * counts as audience if the key was down at any moment of it: the
 * recognizer's final often lands after the key is released. A final ends the
 * utterance and its mark; a key still held marks the next one by being down.
 */

export function createSpeakerKey() {
    let down = false;
    let marked = false;
    return {
        press() {
            down = true;
            marked = true;
        },
        release() {
            down = false;
        },
        get down() {
            return down;
        },
        /** Whether this recognition event is audience speech. A final ends the utterance. */
        audience(isFinal) {
            const audience = down || marked;
            marked = isFinal ? false : audience;
            return audience;
        }
    };
}
