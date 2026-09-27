import { jevPalette } from './jev-palette.js';

const CADENCES = Object.freeze({ slow: 0.15, balanced: 0.5, lively: 0.85 });

/** Expand one Jev Choice decision into the exact existing Chamber controls. */
export function resolveJevChamberConfig(plan) {
  const psychedelic = plan.visualStyle === 'psychedelic';
  const visualMode = psychedelic ? 'interlocution' : plan.visualMode;
  const visualEngine = psychedelic ? 'fractal' : plan.visualEngine;
  const galleryCadence = psychedelic ? 'lively' : plan.galleryCadence;
  const colorTheme = psychedelic ? 'prism' : plan.colorTheme;
  const wordFill = plan.wordFill === 'same'
    && visualMode === 'interlocution'
    && plan.chamberFace === 'thick'
    && plan.fontSize === 'fit'
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
    audioPreset: ['focus', 'deep', 'gateway'].includes(plan.audio) ? plan.audio : 'silent',
    soundscape: ['aurora', 'faded-signal'].includes(plan.audio) ? plan.audio : 'none',
    entrainmentMode: 'binaural',
    entrainmentWaveform: 'sine',
    recitation: { enabled: false },
    voiceId: null,
    visualConfig,
    presentation: {
      chamberFace: plan.chamberFace,
      fontSize: plan.fontSize,
      colorTheme,
      colors: jevPalette(colorTheme)
    },
    projection: visualMode === 'off' && plan.visualStyle !== 'immersive'
      ? plan.projection : 'stream'
  };
}
