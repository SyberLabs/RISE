import { describe, expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { resolveJevReading } from './jev-reading.js';
import { sampleJevSceneDecision } from './jev-scene-demo.js';

describe('Jev scene sample', () => {
  it('admits a released Middlemarch dual-scene reading without model text', async () => {
    const decision = sampleJevSceneDecision();
    expect(decision.workId).toBe('middlemarch');
    expect(decision.editionId).toBe(releaseInventory.middlemarch.editionId);
    expect(decision.sourceRevision).toBe(releaseInventory.middlemarch.sourceRevision);
    expect(decision.config.visualArc).toBe('dual');
    expect(decision.config.visualProgram.segments).toHaveLength(2);
    expect(decision).not.toHaveProperty('text');
    const reading = await resolveJevReading(decision);
    expect(reading.visualProgram.segments).toHaveLength(2);
    expect(reading.text.length).toBeGreaterThan(0);
  });
});
