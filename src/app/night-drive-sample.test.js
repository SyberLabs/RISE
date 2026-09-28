import { describe, expect, it } from 'vitest';
import { compileSession } from '../core/session-compiler.js';
import { nightDriveSessionInput } from './night-drive-sample.js';
import { sceneSampleFromPath, isJevSceneDemoPath } from '../core/jev-demo-path.js';

describe('Night Drive sample', () => {
  it('is a public path of its own beside the Jev scene sample', () => {
    expect(sceneSampleFromPath('/night-drive')).toBe('night-drive');
    expect(sceneSampleFromPath('/night-drive/')).toBe('night-drive');
    expect(sceneSampleFromPath('/jev-scene-demo')).toBe('jev-scene');
    expect(isJevSceneDemoPath('/night-drive')).toBe(true);
    expect(sceneSampleFromPath('/')).toBe(null);
  });

  it('compiles to a short, fast, streaming neon session with the beat', () => {
    const session = compileSession({ ...nightDriveSessionInput(), title: 'Night Drive' });
    expect(session.projection).toBe('stream');
    expect(session.soundscape).toBe('night-drive');
    expect(session.visualConfig.visualMode).toBe('attractor');
    expect(session.visualConfig.attractor).toMatchObject({
      system: 'halvorsen', palette: 'neon', speed: 2.4, intensity: 0.85, streaks: true
    });
    const texts = session.atoms.map(atom => atom.content).filter(Boolean);
    expect(texts[0]).toBe('Afoot and light-hearted');
    const seconds = session.atoms.reduce((total, atom) => total + atom.duration, 0) / 1000;
    expect(seconds).toBeGreaterThan(15);
    expect(seconds).toBeLessThan(35);
  });
});
