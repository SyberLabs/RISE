/**
 * Night Drive — a fixed, disclosed sample of the neon night-drive look.
 *
 * The same selectors Jev's worker applies to a night-drive request
 * ("tokyo drift", "night drive", "racing", "neon"), lowered through the
 * same resolver, over a short public-domain passage. No provider call.
 */
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';

// Walt Whitman, "Song of the Open Road" (Leaves of Grass, 1856), as phrased
// in RISE's own sequence `grass-road` (src/sources/text/data/literary_deep.js).
export const NIGHT_DRIVE_TEXT = 'Afoot and light-hearted | I take to the open road, | healthy, free, | the world before me, | the long brown path before me | leading wherever I choose. | [PAUSE] | Henceforth I ask not | good-fortune, | I myself am good-fortune. | Henceforth I whimper no more, | postpone no more, | need nothing, | done with indoor complaints, | libraries, | querulous criticisms, | strong and content | I travel the open road. | [PAUSE] | The earth — that is sufficient. | I do not want the constellations | any nearer, | I know they are very well | where they are.';

export const NIGHT_DRIVE_SELECTORS = Object.freeze({
  section: 'first', wpm: 300, curve: 'flat', chunkMode: 'phrase',
  audio: 'night-drive', middleAudio: 'night-drive', finaleAudio: 'night-drive',
  visualMode: 'attractor', visualStyle: 'immersive', visualPalette: 'neon',
  visualEngine: 'fractal', middleEngine: 'apparitio', finaleEngine: 'ostensoria',
  visualArc: 'single', arcSplit: '50', kleePreset: 'chaotic', galleryCadence: 'lively',
  chamberFace: 'thick', fontSize: 'large', colorTheme: 'prism',
  textColor: 'classic', backgroundColor: 'prism', middleTheme: 'prism', finaleTheme: 'prism',
  wordFill: 'plain', projection: 'stream', revealMode: 'instant'
});

/** Session input for handleBeginSession: the exact Chamber settings, no network. */
export function nightDriveSessionInput() {
  const plan = NIGHT_DRIVE_SELECTORS;
  return {
    text: NIGHT_DRIVE_TEXT,
    textSource: 'Walt Whitman · Song of the Open Road',
    wpm: plan.wpm,
    curve: plan.curve,
    chunkMode: plan.chunkMode,
    revealMode: plan.revealMode,
    ...resolveJevChamberConfig(plan),
    visualProgram: compileJevVisualProgram(plan),
    audioProgram: compileJevAudioProgram(plan),
    origin: { view: 'portal', icon: '✧', name: 'Home', experience: 'jev-sample' }
  };
}
