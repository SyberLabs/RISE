/**
 * THE GLASS IS ONE SURFACE WHILE THE READING SPEAKS.
 *
 * Between two phrases the words leave and the next ones come; the pane behind
 * them stays, unless nothing is coming soon. This decides which, and nothing
 * else: the Chamber paints.
 *
 *   clear    no glass is standing (before the first words, after a dissolve)
 *   words    words are on the glass
 *   holding  the words have gone and the glass waits for the next ones
 *
 * A silence ends the hold, and the glass dissolves, when it is known to run
 * longer than `holdMs` counted from when the words left (a hold beat, a long
 * paragraph break), or when no words have come `graceMs` after they left (a
 * voice slow to begin its next passage). A pause or the end of the reading
 * dissolves a held glass; glass under words stays under them.
 */

export const GLASS_CONTINUITY = Object.freeze({
  holdMs: 1200,
  graceMs: 1500,
  wordsOutMs: 120,
  wordsInMs: 160,
  easeMs: 180,
  dissolveMs: 240,
  reducedMotionMs: 80
});

export function createGlassContinuity({
  holdMs = GLASS_CONTINUITY.holdMs,
  graceMs = GLASS_CONTINUITY.graceMs,
  now = () => performance.now(),
  dissolve
}) {
  let state = 'clear';
  let since = 0;
  let timer = null;

  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const end = () => {
    stopTimer();
    state = 'clear';
    dissolve();
  };

  return {
    get state() { return state; },

    /** Words are shown. Returns whether they arrive on glass already standing. */
    words() {
      const standing = state !== 'clear';
      stopTimer();
      state = 'words';
      return standing;
    },

    /**
     * A silence begins, or goes on, expected to last `expectedMs` (null when unknown).
     * 'hold' keeps the glass, 'dissolve' has let it go, 'clear' had none to keep.
     */
    silence(expectedMs = null) {
      if (state === 'clear') return 'clear';
      if (state === 'words') {
        state = 'holding';
        since = now();
        timer = setTimeout(end, graceMs);
      }
      if (Number.isFinite(expectedMs) && now() - since + expectedMs > holdMs) {
        end();
        return 'dissolve';
      }
      return 'hold';
    },

    /** Nothing is coming soon (a pause, the end): a held glass dissolves. Returns whether one did. */
    release() {
      if (state !== 'holding') return false;
      end();
      return true;
    },

    destroy() {
      stopTimer();
      state = 'clear';
    }
  };
}
