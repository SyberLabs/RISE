import { describe, expect, it } from 'vitest';
describe('neon night-drive look', () => {
  it('lowers neon to the fast Halvorsen filament with light streaks', async () => {
    const { resolveJevChamberConfig } = await import('./jev-config.js');
    const resolved = resolveJevChamberConfig({
      visualMode: 'attractor', visualStyle: 'immersive', visualPalette: 'neon', audio: 'night-drive',
      chamberFace: 'thick', fontSize: 'large', chunkMode: 'phrase', colorTheme: 'prism',
      wordFill: 'plain', projection: 'stream'
    });
    expect(resolved.visualConfig.attractor).toEqual({
      system: 'halvorsen', palette: 'neon', form: 'mirror', intensity: 0.85, speed: 2.4, streaks: true
    });
    expect(resolved.soundscape).toBe('night-drive');
  });
});
