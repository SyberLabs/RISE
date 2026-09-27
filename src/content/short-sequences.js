/** Original demonstration texts. Each is a short reading, not a saved user record. */
export const SHORT_SEQUENCES = Object.freeze([
  {
    id: 'reset',
    title: 'Begin again',
    promise: 'When starting feels too big.',
    prompt: 'What is one small action you can begin today?',
    soundscape: 'aurora',
    engines: ['turrell', 'harmonograph', 'klee'],
    text: `For one breath, let the unfinished things remain unfinished.

There is still a place to begin. It may be as small as opening a page, moving a chair, or saying the first honest sentence. You do not need the whole path in view.

Notice the first reachable part. Let that be enough to start.`
  },
  {
    id: 'focus',
    title: 'Make room',
    promise: 'When too many things compete for your attention.',
    prompt: 'What will you give the next ten minutes?',
    soundscape: 'faded-signal',
    engines: ['apparitio', 'turrell', 'harmonograph'],
    text: `Several things ask for your attention. Hear them without following each one.

Now choose a single piece of work. Imagine placing the others at the edge of the room. They can wait there for ten minutes. The space in front of you belongs to this one thing.

When your attention moves away, notice. Then return.`
  },
  {
    id: 'close',
    title: 'Leave a marker',
    promise: 'When you need to stop without losing your place.',
    prompt: 'What first action will help you resume?',
    soundscape: 'sad',
    engines: ['klee', 'ostensoria', 'turrell'],
    text: `Look at what happened here. Something moved, even if it did not finish.

You can leave this moment without carrying every detail in your head. Find the edge of the work: the open question, the next line, the place where your hand would go first.

Leave yourself a marker there. When you return, you will have a beginning.`
  }
]);

/** Three bounded visual movements follow the opening, middle, and end of the text. */
export function shortSequenceSession(sequence, { sound = true } = {}) {
  if (!SHORT_SEQUENCES.includes(sequence)) throw new TypeError('Unknown short sequence.');
  return {
    text: sequence.text,
    textSource: sequence.title,
    name: sequence.title,
    origin: { view: 'short-sequences', sequenceId: sequence.id },
    provenance: { credit: 'RISE short sequences — original demonstration text', rights: 'Original text prepared for this RISE preview.' },
    wpm: 100,
    curve: 'flat',
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: sound ? sequence.soundscape : 'none',
    visualConfig: {
      visualMode: 'interlocution',
      livingText: { enabled: true },
      interlocution: {
        sourceFamily: 'procedural', procedural: [sequence.engines[0]], sourced: [],
        presentation: 'continuous', galleryCadence: 0.15,
        kleePreset: 'harmonic', wordFill: { mode: 'plain' }
      }
    },
    visualProgram: {
      coordinateSpace: 'source',
      segments: [[0, 0.3], [0.3, 0.7], [0.7, 1]].map(([fromProgress, toProgress], index) => ({
        id: `${sequence.id}-${index}`,
        match: { sourceIds: ['primary'], fromProgress, toProgress },
        cue: { kind: 'procedural', collections: [sequence.engines[index]] }
      })),
      fallback: { kind: 'still' }
    },
    projection: 'stream',
    presentation: { chamberFace: 'literary', fontSize: 'large' }
  };
}
