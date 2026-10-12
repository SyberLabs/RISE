/**
 * The venue's demonstration of the model changing the room while it plays (docs/plans/LIVE-CURRENT.md §18), asked
 * "Why is the sky blue?": the attractor over the sky; then, as the reading turns to sunset, the flame look's colours
 * and a cue to the running scene at the same place, and a second change one phrase later; a pace suggested before the
 * last beat. Asked "more vibrant" while it reads, it brightens the field before its first beat and goes on.
 * Written by hand, as a model would write it; the demo streams it (adapters/mock-beats.js).
 */

/** What the model writes. The passage after the look has several phrases, so the second change can wait one. */
export const SKY_ROOM_TEXT = [
    '@say Sunlight carries every colour at once.',
    '@scene sky attractor palette=blue',
    '@say scene=sky The air scatters blue light far more than red, so blue reaches your eye from every part of the sky.',
    '@look flame',
    '@cue sky calm',
    '@visual intensity=0.7',
    '@say At sunset, the light crosses far more air, the blue is scattered away on the long road, and what is left to reach you is red and gold.',
    '@pace 1.25',
    '@say So the sky is blue by day and red at evening, for one reason.',
    ''
].join('\n');

/** What the demo answers when the reader asks, while it reads, for more vibrant imagery. */
export const VIBRANT_ANSWER = [
    '@visual intensity=0.75',
    '@say Brighter, then: the field takes more light.',
    '@say And the reading goes on.',
    '@then resume',
    ''
].join('\n');
