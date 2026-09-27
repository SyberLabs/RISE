import { jevColors } from './jev-palette.js';

export const JEV_AUDIO_IDS = Object.freeze([
  'aurora', 'faded-signal', 'soft-rain', 'sad', 'angry', 'happy', 'excited', 'thrilling', 'scary',
  'piano', 'jazz', 'lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime',
  'wonder', 'mystery', 'chase', 'triumph', 'haunted', 'starlight'
]);

const CADENCES = Object.freeze({ slow: 0.15, balanced: 0.5, lively: 0.85 });

/** Expand one Jev Choice decision into the exact existing Chamber controls. */
export function resolveJevChamberConfig(plan) {
  // Fit only paints word chunks. A larger ordinary size is the honest
  // presentation for phrase, sentence, and paragraph readings.
  const fontSize = plan.fontSize === 'fit' && plan.chunkMode !== 'word'
    ? 'large' : plan.fontSize;
  const psychedelic = plan.visualStyle === 'psychedelic';
  const visualMode = psychedelic ? 'interlocution' : plan.visualMode;
  const visualEngine = psychedelic ? 'fractal' : plan.visualEngine;
  const galleryCadence = psychedelic ? 'lively' : plan.galleryCadence;
  const colorTheme = psychedelic ? 'prism' : plan.colorTheme;
  const wordFill = plan.wordFill === 'same'
    && visualMode === 'interlocution'
    && plan.chamberFace === 'thick'
    && fontSize === 'fit'
    && plan.chunkMode === 'word'
    ? 'same' : plan.wordFill === 'same' ? 'accent' : plan.wordFill;

  const visualConfig = { visualMode };
  if (visualMode === 'focals') {
    visualConfig.focals = { type: 'standard', standardGlyph: 'breath', personalImage: null };
  } else if (visualMode === 'genesis') {
    visualConfig.genesis = { preset: plan.kleePreset, glass: true };
  } else if (visualMode === 'attractor') {
    visualConfig.attractor = { system: 'aizawa', palette: plan.visualPalette, form: 'kaleido' };
  } else if (visualMode === 'interlocution') {
    visualConfig.livingText = { enabled: true };
    visualConfig.interlocution = {
      sourceFamily: 'procedural', procedural: [visualEngine], sourced: [],
      presentation: 'continuous', galleryCadence: CADENCES[galleryCadence],
      kleePreset: plan.kleePreset, wordFill: { mode: wordFill }
    };
  }

  return {
    audioPreset: 'silent',
    soundscape: JEV_AUDIO_IDS.includes(plan.audio) ? plan.audio : 'none',
    entrainmentMode: 'binaural',
    entrainmentWaveform: 'sine',
    recitation: { enabled: false },
    voiceId: null,
    visualConfig,
    presentation: {
      chamberFace: plan.chamberFace,
      fontSize,
      colorTheme,
      textColor: plan.textColor ?? colorTheme,
      backgroundColor: plan.backgroundColor ?? colorTheme,
      colors: jevColors(colorTheme, plan.textColor ?? colorTheme,
        plan.backgroundColor ?? colorTheme)
    },
    projection: visualMode === 'off' && plan.visualStyle !== 'immersive'
      ? plan.projection : 'stream'
  };
}
