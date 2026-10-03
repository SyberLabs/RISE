/**
 * LIBRARY SKY: the Library drawn as a star map. Every released work is a
 * star; the works of one kind are joined into one constellation.
 *
 * Pure and fixed: the same sky on every call, laid out by a golden-angle
 * spiral inside each group's region, and lines drawn as the shortest tree
 * that joins each group. Positions are percentages of the sky box. The left
 * part of the box sits under Home's text panel, so stars keep to its right.
 *
 * Home loads this after first paint, so it may use the roll's title table,
 * but never the Library itself.
 */

import { jevReleasedWorkIds } from './jev-describe.js';
import { rollTitleOf } from './roll.js';

/** The released classics, by kind. A test fails when a released classic is missing. */
const CLASSICS = Object.freeze({
  'the-iliad': 'verse',
  'the-divine-comedy': 'verse',
  'metamorphoses': 'verse',
  'spoon-river-anthology': 'verse',
  'oedipus-rex': 'verse',
  'paradise-lost': 'verse',
  'lyrical-ballads': 'verse',
  'middlemarch': 'prose',
  'the-brothers-karamazov': 'prose',
  'literary-meditations': 'prose',
  'sacred-tao-te-ching': 'prose',
  'literary-walden': 'prose',
  'ulysses': 'prose',
  'literary-essays-emerson': 'prose',
  'confucius-analects': 'prose'
});

/** Each group's ellipse (centre and radii) and where its label is printed, in percent. */
const REGIONS = Object.freeze([
  { id: 'verse', label: 'Verse and drama', cx: 60, cy: 31, rx: 12, ry: 18, labelY: 7 },
  { id: 'prose', label: 'Prose and wisdom', cx: 72, cy: 75, rx: 19, ry: 13, labelY: 94 },
  { id: 'originals', label: 'RISE originals', cx: 86, cy: 31, rx: 9, ry: 21, labelY: 5 }
]);

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const tenth = value => Math.round(value * 10) / 10;

let sky = null;

/** The star map of every released work: frozen { stars, links, groups }. */
export function librarySky() {
  if (sky) return sky;
  const stars = jevReleasedWorkIds().map(workId => {
    const { title, author } = rollTitleOf(workId);
    const group = author === 'RISE' ? 'originals' : CLASSICS[workId];
    if (!group) throw new TypeError(`${title} has no place in the library sky.`);
    return { workId, title, author, group };
  });
  const links = [];
  for (const region of REGIONS) {
    const members = stars.filter(star => star.group === region.id);
    members.forEach((star, k) => {
      const r = Math.sqrt((k + 0.5) / members.length);
      star.x = tenth(region.cx + region.rx * r * Math.cos(k * GOLDEN_ANGLE));
      star.y = tenth(region.cy + region.ry * r * Math.sin(k * GOLDEN_ANGLE));
    });
    // Prim's tree: join the nearest outside star to the tree until none is left.
    const joined = [members[0]];
    while (joined.length < members.length) {
      let best = null;
      for (const from of joined) {
        for (const to of members) {
          if (joined.includes(to)) continue;
          const d = Math.hypot(from.x - to.x, from.y - to.y);
          if (!best || d < best.d) best = { from, to, d };
        }
      }
      joined.push(best.to);
      links.push(Object.freeze([stars.indexOf(best.from), stars.indexOf(best.to)]));
    }
  }
  sky = Object.freeze({
    stars: Object.freeze(stars.map(star => Object.freeze(star))),
    links: Object.freeze(links),
    groups: Object.freeze(REGIONS.map(({ id, label, cx, labelY }) => Object.freeze({ id, label, x: cx, y: labelY })))
  });
  return sky;
}
