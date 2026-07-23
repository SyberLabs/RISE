// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RosaMystica, mulberry, ROSA_PETALA, ROSA_PSALM } from './rosa-mystica.js';
import { chapelSensoryConfig, seedFromBook } from '../content/chapel/handoff.js';

describe('ROSA MYSTICA (the Chapel procedural, spec §6)', () => {
  it('is deterministic under its seed', () => {
    const a = mulberry(0xBEEF)();
    const b = mulberry(0xBEEF)();
    expect(a).toBe(b);
    expect(mulberry(1)()).not.toBe(mulberry(2)());
    // and a book always receives the same window
    expect(seedFromBook('romans')).toBe(seedFromBook('romans'));
    expect(seedFromBook('romans')).not.toBe(seedFromBook('jude'));
  });

  it('guards a missing GL context: the reading proceeds without the rose', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    // jsdom has no WebGL — construction must not throw, and render is a no-op
    const rosa = new RosaMystica(host, { petala: 12, seed: 7 });
    expect(rosa.gl == null).toBe(true);
    expect(() => rosa.renderOnce()).not.toThrow();
    expect(() => rosa.setMode('verbum')).not.toThrow();
    expect(() => rosa.destroy()).not.toThrow();
    host.remove();
  });

  it('validates its parameters: petala from the fixed set, mode vitrum/verbum', () => {
    const host = document.createElement('div');
    const rosa = new RosaMystica(host, { petala: 13, mode: 'chaos', seed: 5 });
    expect(rosa.petala).toBe(12);        // 13 is not in the set
    expect(rosa.mode).toBe('vitrum');
    rosa.setPetala(24);
    expect(rosa.petala).toBe(24);
    rosa.setPetala(99);
    expect(rosa.petala).toBe(24);        // refused
    expect(ROSA_PETALA).toEqual([8, 12, 16, 24]);
    rosa.destroy();
  });

  it('VERBUM letters from Psalm 26, the Word becoming the light', () => {
    expect(ROSA_PSALM).toContain('DOMINVSILLVMINATIOMEA');
    expect(ROSA_PSALM).toContain('✠');
  });

  it('the CONCEPTUAL books read under the rose; Psalms keeps its stillness', () => {
    // an epistle: rose by default, seeded from the book
    const romans = chapelSensoryConfig('romans');
    expect(romans.visualConfig).toEqual({
      visualMode: 'focals',
      focals: { type: 'rose', petala: 12, seed: seedFromBook('romans') }
    });
    const proverbs = chapelSensoryConfig('proverbs');
    expect(proverbs.visualConfig.focals.type).toBe('rose');
    expect(proverbs.visualConfig.focals.seed).not.toBe(romans.visualConfig.focals.seed);
    // Psalms: deliberate stillness, untouched
    expect(chapelSensoryConfig('psalms').visualConfig.visualMode).toBe('off');
    // a whole Gospel reads under the rose (2026-07 review: Passion
    // imagery belongs to the Passion chapters, not the Beatitudes);
    // a Passion chapter keeps its collections
    expect(chapelSensoryConfig('john').visualConfig.visualMode).toBe('focals');
    expect(chapelSensoryConfig('john').visualConfig.focals.type).toBe('rose');
    expect(chapelSensoryConfig('john', null, 19).visualConfig.visualMode).toBe('interlocution');
    // the explicit choice works on ANY book
    expect(chapelSensoryConfig('genesis', 'rosa-mystica').visualConfig.focals.type).toBe('rose');
    // and a pinned icon still wins over the book default
    expect(chapelSensoryConfig('romans', 'icon-pantocrator-sinai').visualConfig.focals.type).toBe('icon');
  });

  it('the Chamber mounts the rose focal and tears it down; reduced-motion is honored in the engine', () => {
    const chamber = readFileSync(resolve('src/components/Chamber.js'), 'utf8');
    expect(chamber).toContain("focals.type === 'rose'");
    expect(chamber).toContain('initializeRoseFocal');
    expect(chamber).toContain('this.rosaField.destroy()');
    const engine = readFileSync(resolve('src/visuals/rosa-mystica.js'), 'utf8');
    expect(engine).toContain('prefers-reduced-motion');
    expect(engine).toMatch(/reduceMotion \? 0\.0/);
  });
});
