/**
 * How long a picture stays on screen (docs/plans/RISE-CHANGES.md): only while each following beat speaks of one of the
 * changes it shows. At the first beat whose refs share none of the picture's and that starts no scene of its own, the
 * reading returns to RISE's eye (a `still`, which the Live room shows as Sophia's eye) until the next picture. A beat
 * with no refs (an opening, a hold, a close) keeps what is showing, and RISE's engines, set for mood, are never ended.
 * Decided here, deterministically, after the composition is admitted, never by a refusal.
 */

export const EYE_SCENE = Object.freeze({ id: 'eye', engine: 'still' });

const shares = (refs, shown) => refs.some(number => shown.includes(number));

/**
 * The beats each scene is shown under: `starts` maps a beat index to what it starts (`refs` the picture's, null for an
 * engine), `refsAt` maps a beat index to its refs. Answers `{ runs: [[start, length], ...], eye }`, `eye` true when a
 * picture ends early and the eye takes its place. The composition rule counts these runs.
 */
export function shownRuns(beatCount, starts, refsAt) {
  const begins = [0];
  let shown = null;
  let eye = false;
  for (let index = 0; index < beatCount; index += 1) {
    if (starts.has(index)) {
      if (index > 0) begins.push(index);
      shown = starts.get(index).refs;
      continue;
    }
    const refs = refsAt[index] ?? [];
    if (Array.isArray(shown) && refs.length > 0 && !shares(refs, shown)) {
      begins.push(index);
      shown = null;
      eye = true;
    }
  }
  const unique = [...new Set(begins)];
  return { runs: unique.map((start, at) => [start, (unique[at + 1] ?? beatCount) - start]), eye };
}

/**
 * The Current with every picture ended where its beats stop speaking of it. `sources` is each beat's refs (the
 * contract's), `pictureRefs` each placed picture's refs by scene id. Answers `{ current, ended }`, `ended` the beats
 * that now return to the eye.
 */
export function endHeldPictures(current, { sources, pictureRefs }) {
  const beats = current.beats.map(beat => ({ ...beat }));
  let scenes = [...(current.scenes ?? [])];
  const declared = scenes.find(scene => scene.engine === 'still');
  let eyeId = declared?.id ?? null;
  const ended = [];
  let shown = null;
  beats.forEach((beat, index) => {
    if (beat.scene !== undefined) {
      shown = Object.hasOwn(pictureRefs, beat.scene) ? pictureRefs[beat.scene] : null;
      return;
    }
    const refs = sources[String(index)] ?? [];
    if (!Array.isArray(shown) || refs.length === 0 || shares(refs, shown)) return;
    if (eyeId === null) {
      eyeId = scenes.some(scene => scene.id === EYE_SCENE.id) ? 'rise-eye' : EYE_SCENE.id;
      scenes = [...scenes, { ...EYE_SCENE, id: eyeId }];
    }
    beat.scene = eyeId;
    // A cue on this beat was for the picture it no longer shows.
    delete beat.cue;
    ended.push(index);
    shown = null;
  });
  return { current: { ...current, scenes, beats }, ended };
}
