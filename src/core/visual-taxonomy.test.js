/**
 * The visual taxonomy — the rules a reader will feel, before a pixel is drawn.
 *
 * The panel is the largest piece of the redesign and its core is not a view:
 * one tree, four categories, one exclusivity rule. Settling it here means the
 * navigator is a rendering problem, the way settling the partition made the
 * admit room one.
 */
import { describe, expect, it } from 'vitest';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';
import {
  FIELD,
  VISUAL_TAXONOMY,
  categoryOf,
  describeField,
  galleryMembers,
  isBlend,
  leafById,
  substylesFor,
  taxonomyLeaves,
  toggleField
} from './visual-taxonomy.js';

/** Find any node — branch or leaf — by id, walking the whole tree. */
function leafOrBranch(id, node = VISUAL_TAXONOMY) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = leafOrBranch(id, child);
    if (found) return found;
  }
  return null;
}

describe('the tree', () => {
  it('opens Off, then Visual with three rooms in order', () => {
    const top = VISUAL_TAXONOMY.children.map(n => n.id);
    expect(top).toEqual(['off', 'visual']);
    const visual = VISUAL_TAXONOMY.children[1].children.map(n => n.id);
    expect(visual).toEqual(['focal', 'gallery', 'dynamic']);
  });

  it('divides Gallery into Procedural, Sourced, Personal', () => {
    const gallery = leafOrBranch('gallery');
    expect(gallery.children.map(n => n.id))
      .toEqual(['gallery-procedural', 'gallery-sourced', 'personal']);
  });

  it('holds the drawing engines under Dynamic, Attractor and Genesis first', () => {
    const dynamic = leafOrBranch('dynamic');
    expect(dynamic.children.map(n => n.id))
      .toEqual(['attractor', 'klee', 'harmonograph', 'ostensoria', 'apparitio']);
    // The renames the creator settled, surfaced as labels over registry ids.
    expect(leafById('klee').label).toBe('Genesis');
    expect(leafById('ostensoria').label).toBe('Iris Plates');
    expect(leafById('apparitio').label).toBe('Spectral Plates');
  });
});

describe('every engine is placed', () => {
  it('categorises each registered procedural engine exactly once', () => {
    // THE GUARD THE FLAT DROPDOWN NEVER HAD. A new engine in the registry that
    // this tree does not name fails here rather than reaching a reader as an
    // uncategorised line — the vocabulary-in-two-places defect, refused.
    const registered = LISTED_PROCEDURAL_PATTERNS.map(p => p.id).sort();
    const placed = taxonomyLeaves()
      .filter(l => l.engineId && registered.includes(l.engineId))
      .map(l => l.engineId).sort();
    expect(placed).toEqual(registered);
  });

  it('puts the drawing engines in Dynamic and the held fields in Gallery', () => {
    expect(categoryOf('attractor')).toBe(FIELD.DYNAMIC);
    expect(categoryOf('harmonograph')).toBe(FIELD.DYNAMIC);
    expect(categoryOf('ostensoria')).toBe(FIELD.DYNAMIC);
    expect(categoryOf('fractal')).toBe(FIELD.GALLERY);
    expect(categoryOf('turrell')).toBe(FIELD.GALLERY);
    expect(categoryOf('neural')).toBe(FIELD.GALLERY);
    expect(categoryOf('rockgarden')).toBe(FIELD.GALLERY);
  });
});

describe('substyles are linked, not copied', () => {
  it('gives Attractor its three benches from the shared definitions', () => {
    const benches = substylesFor('attractor').map(b => b.key);
    expect(benches).toEqual(['system', 'palette', 'form']);
    expect(substylesFor('attractor')[0].options.length).toBeGreaterThan(0);
  });
  it('gives Genesis its presets and Harmonograph its climates', () => {
    expect(substylesFor('klee')[0].key).toBe('preset');
    expect(substylesFor('harmonograph')[0].key).toBe('climate');
    expect(substylesFor('fractal')).toEqual([]);   // a plain field has no bench
  });
});

describe('the one rule: exclusive vs blendable', () => {
  it('clears the room when an exclusive field is chosen', () => {
    let on = new Set();
    on = toggleField(on, 'attractor');
    expect([...on]).toEqual(['attractor']);
    on = toggleField(on, 'focal');            // focal is exclusive
    expect([...on]).toEqual(['focal']);
    on = toggleField(on, 'off');              // off is the empty room
    expect([...on]).toEqual([]);
  });

  it('lets gallery sources accumulate — that accumulation is Blend', () => {
    let on = new Set();
    on = toggleField(on, 'fractal');
    on = toggleField(on, 'by-manner');
    on = toggleField(on, 'personal');
    expect(galleryMembers(on).sort()).toEqual(['by-manner', 'fractal', 'personal']);
    expect(isBlend(on)).toBe(true);
    expect(describeField(on)).toBe('Blend · 3 in gallery');
  });

  it('a single gallery source is not yet a blend', () => {
    const on = toggleField(new Set(), 'turrell');
    expect(isBlend(on)).toBe(false);
    expect(describeField(on)).toBe('Turrell Fields');
  });

  it('choosing a Dynamic field clears a standing gallery blend', () => {
    let on = new Set(['fractal', 'by-manner']);
    on = toggleField(on, 'klee');
    expect([...on]).toEqual(['klee']);
    expect(isBlend(on)).toBe(false);
  });

  it('toggling the same leaf twice returns to empty, and never mutates the input', () => {
    const start = new Set(['fractal']);
    const off = toggleField(start, 'fractal');
    expect([...off]).toEqual([]);
    expect([...start]).toEqual(['fractal']);   // input untouched
  });
});
