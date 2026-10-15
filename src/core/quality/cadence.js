/**
 * How often a Current changes its picture (docs/plans/RISE-CHANGES.md, Quality gates): its beats, the distinct
 * scenes they start, and the longest run of beats under one picture. A beat that starts the scene already showing
 * changes nothing; the beats before the first scene are one run. A v1 Current is measured by its segments, each
 * segment's `visual` its picture, one left out the look's own.
 */
export function pictureCadence(current) {
  const parts = Array.isArray(current?.beats) ? current.beats.map(beat => ({ starts: beat?.scene !== undefined, scene: beat?.scene }))
    : Array.isArray(current?.segments) ? current.segments.map(segment => ({ starts: true, scene: segment?.visual ?? null }))
      : [];
  const scenes = new Set();
  let showing;
  let hold = 0;
  let longestHold = 0;
  parts.forEach((part, index) => {
    if (part.starts) scenes.add(part.scene);
    if (index > 0 && part.starts && part.scene !== showing) hold = 0;
    if (part.starts) showing = part.scene;
    hold += 1;
    longestHold = Math.max(longestHold, hold);
  });
  return { beats: parts.length, scenes: scenes.size, longestHold };
}
