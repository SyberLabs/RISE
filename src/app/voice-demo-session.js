import { resolveJevChamberConfig } from '../core/jev-config.js';

/** Short editable original text; no catalog or copyrighted voice demo. */
export const VOICE_DEMO_SAMPLE = 'A little light moves through the dark. It gathers into a ribbon, then opens like a flower. Take a breath. Let the colors turn around the words. For a moment, the room becomes a river, and the river carries us somewhere new.';
export const VOICE_DEMO_MAX_CHARS = 1000;
export const VOICE_DEMO_LOOKS = Object.freeze([
  { id: 'prism', label: 'Psychedelic · fractal flames' },
  { id: 'flame', label: 'Ember · living flame' },
  { id: 'still', label: 'Still · words only' }
]);

export function voiceDemoSession({ text, voice = 'default', look = 'prism' }) {
  if (typeof text !== 'string' || !/[\p{L}\p{N}]/u.test(text)) throw new Error('Add a few words to hear the voice.');
  if (text.length > VOICE_DEMO_MAX_CHARS) throw new Error('Keep this short demo under 1,000 characters.');
  if (!/^[a-z0-9_-]{1,32}$/u.test(voice)) throw new Error('Choose an available voice.');
  if (!VOICE_DEMO_LOOKS.some(preset => preset.id === look)) throw new Error('Choose an available visual preset.');
  return {
    text, source: 'ElevenLabs voice demo', wpm: 240, chunkMode: 'phrase', curve: 'flat',
    ...resolveJevChamberConfig({ visualStyle: look === 'prism' ? 'psychedelic' : 'immersive',
      visualMode: look === 'still' ? 'off' : 'living-flame', colorTheme: look === 'flame' ? 'ember' : 'prism',
      chunkMode: 'phrase', fontSize: 'large', chamberFace: 'sans', wordFill: 'accent', projection: 'stream' }),
    provenance: { kind: 'local-text' },
    origin: { view: 'voice-demo', requireElevenLabs: true, voice },
    publicPath: '/voice-demo'
  };
}
