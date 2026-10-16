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
 * engine; `rest` true for a declared still), `refsAt` maps a beat index to its refs. Answers
 * `{ runs: [{ start, length, rest, picture, cited }, ...], eye }`: `rest` true for a run of RISE's eye (the room at
 * rest, which no hold limit binds), `picture` true for a picture's run, `cited` true when every beat of a picture's run
 * cites one of its changes (a beat without refs keeps a picture showing without citing it), and `eye` true when a
 * picture ends early and the eye takes its place. The composition rule counts these runs.
 */
export function shownRuns(beatCount, starts, refsAt) {
  const runs = [{ start: 0, rest: false, picture: false, cited: false }];
  let shown = null;
  let eye = false;
  const begin = (start, rest, refs) => {
    if (runs.at(-1).start === start) runs.pop();
    runs.push({ start, rest, picture: Array.isArray(refs), cited: Array.isArray(refs) });
  };
  for (let index = 0; index < beatCount; index += 1) {
    const refs = refsAt[index] ?? [];
    if (starts.has(index)) {
      shown = starts.get(index).refs;
      begin(index, starts.get(index).rest === true, shown);
      continue;
    }
    if (Array.isArray(shown) && refs.length > 0 && !shares(refs, shown)) {
      begin(index, true, null);
      shown = null;
      eye = true;
    } else if (refs.length === 0) {
      runs.at(-1).cited = false;
    }
  }
  return { runs: runs.map(({ start, rest, picture, cited }, at) => ({ start, length: (runs[at + 1]?.start ?? beatCount) - start, rest, picture, cited })), eye };
}

/**
 * Which speaking beats (those with refs) are pictured: shown a picture that shares one of their changes, each picture
 * ended where endHeldPictures ends it. `starts` and `refsAt` are shownRuns'. Answers `{ speaking, pictured, longest,
 * unpictured }`, `unpictured` the runs of speaking beats in a row with no picture of what they speak of (a beat without
 * refs, where the eye may rest, neither counts nor breaks a run) and `longest` the longest of them.
 */
export function pictureCoverage(beatCount, starts, refsAt) {
  const unpictured = [];
  let run = [];
  let shown = null;
  let speaking = 0;
  for (let index = 0; index < beatCount; index += 1) {
    const refs = refsAt[index] ?? [];
    if (starts.has(index)) shown = starts.get(index).refs;
    else if (Array.isArray(shown) && refs.length > 0 && !shares(refs, shown)) shown = null;
    if (refs.length === 0) continue;
    speaking += 1;
    if (Array.isArray(shown) && shares(refs, shown)) {
      if (run.length) unpictured.push(run);
      run = [];
    } else {
      run.push(index);
    }
  }
  if (run.length) unpictured.push(run);
  const missing = unpictured.reduce((sum, beats) => sum + beats.length, 0);
  return { speaking, pictured: speaking - missing, longest: Math.max(0, ...unpictured.map(beats => beats.length)), unpictured };
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
