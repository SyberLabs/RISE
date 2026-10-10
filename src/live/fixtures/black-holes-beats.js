/**
 * The black holes answer as a model writes it beat by beat (the line format,
 * docs/specs/LIVE-CURRENT-EVENTS-V1.md "Beats streamed"): a said beat, a native
 * scene and a hold that cues it, a figure, a shown line nobody says, a
 * generated scene with its cues, and a last said beat. It is what the venue's
 * demo streams (adapters/mock.js), and it is written by hand, apart from the
 * Current it must seal to (BLACK_HOLES_BEATS_CURRENT), so a test of one against
 * the other is not a parser checked against itself.
 */

const DISK = `export default function scene(rise) {
  const { lib } = rise;
  const disk = { spin: 0.2, glow: 0.35 };
  return {
    frame(t) {
      lib.clear();
      const ctx = rise.ctx;
      const d = rise.size.dpr;
      const cx = (rise.size.width / 2) * d;
      const cy = (rise.size.height / 2) * d;
      const r = Math.min(rise.size.width, rise.size.height) * 0.16 * d;
      for (let i = 0; i < 48; i += 1) {
        const a = (i / 48) * Math.PI * 2 + (t / 1000) * disk.spin;
        ctx.fillStyle = lib.color('highlight', disk.glow * (0.4 + (0.6 * (i % 6)) / 6));
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 2, cy + Math.sin(a) * r * 0.55, r * 0.14, r * 0.07, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = lib.color('background');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    },
    cue(name, { instant }) {
      if (name === 'spin') return lib.tween(disk, { spin: 1.4 }, { ms: 1200, instant });
      if (name === 'flare') return lib.tween(disk, { glow: 0.95 }, { ms: 1500, instant });
    }
  };
}`;

const HORIZON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <title>The event horizon</title>
  <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 6" opacity="0.6"/>
  <circle cx="100" cy="100" r="44" fill="currentColor"/>
  <text x="100" y="196" text-anchor="middle" font-size="11" fill="currentColor">event horizon</text>
</svg>`;

const SAID = Object.freeze({
    what: 'A black hole is a region of space where gravity is so strong that nothing, not even light, can escape once it is inside.',
    horizon: 'Its edge is the event horizon: past it, escaping would take more than the speed of light.',
    disk: 'Matter falling towards it gathers in a disk, and is heated until it glows.',
    shadow: 'The black hole itself stays dark. What we photograph is the shadow it casts on that light.'
});

/** What the model writes. */
export const BLACK_HOLES_BEATS_TEXT = [
    `@say ${SAID.what}`,
    '@scene field attractor palette=purple',
    '@hold 1800 scene=field cue=calm',
    '@scene horizon svg',
    '```svg',
    HORIZON,
    '```',
    `@say scene=horizon place=caption ${SAID.horizon}`,
    '@show hold=1600 size=display The point of no return',
    '@scene disk code',
    '```js',
    DISK,
    '```',
    `@say scene=disk cue=spin ${SAID.disk}`,
    '@hold 2400 cue=flare',
    `@say ${SAID.shadow}`,
    ''
].join('\n');

/** What it must seal to: the scenes and beats of the rise.current.v2, as a model would have written them whole. */
export const BLACK_HOLES_BEATS_CURRENT = Object.freeze({
    scenes: [
        { id: 'field', engine: 'attractor', params: { palette: 'purple' } },
        { id: 'horizon', svg: HORIZON },
        { id: 'disk', code: DISK }
    ],
    beats: [
        { say: SAID.what },
        { hold: { ms: 1800 }, scene: 'field', cue: 'calm' },
        { say: SAID.horizon, scene: 'horizon', place: 'caption' },
        { show: 'The point of no return', hold: { ms: 1600 }, size: 'display' },
        { say: SAID.disk, scene: 'disk', cue: 'spin' },
        { hold: { ms: 2400 }, cue: 'flare' },
        { say: SAID.shadow }
    ]
});

/**
 * What the demo answers when the reader interjects (docs/plans/LIVE-CURRENT.md §17): two beats inside the room, then
 * how the reading goes on. Asked to skip, or for the short version, it replaces the rest; otherwise it resumes.
 */
export const INTERJECTION_ANSWERS = Object.freeze({
    resume: [
        '@say Good question: the horizon is not a surface you could touch.',
        '@say It is only the distance past which light can no longer climb back out.',
        '@then resume',
        ''
    ].join('\n'),
    replace: [
        '@say In short: a black hole is gravity so strong that not even light can leave it.',
        '@say That is the whole of it; the rest was detail.',
        '@then replace',
        ''
    ].join('\n')
});

/** The answer for a question: black holes, or a plain sentence that it knows nothing else; an interjection's, its own. */
export function beatsTextFor(request) {
    if (request.intent === 'interject') return /\b(skip|short)\b/iu.test(request.prompt) ? INTERJECTION_ANSWERS.replace : INTERJECTION_ANSWERS.resume;
    if (/black\s*holes?/iu.test(request.prompt)) return BLACK_HOLES_BEATS_TEXT;
    return '@say This demonstration can only explain black holes.\n';
}
