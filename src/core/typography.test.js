import { describe, expect, it } from 'vitest';
import { resolveTypeFace, stepFontSize, TYPE_FACES, TYPE_NAMES, TYPE_ROLES } from './typography.js';

describe('faces', () => {
  it('are named by role or by id, and every role has one face', () => {
    expect(resolveTypeFace('book-serif').id).toBe('crimson-pro');
    expect(resolveTypeFace('crimson-pro').role).toBe('book-serif');
    expect(resolveTypeFace('handwritten').family).toMatch(/^'Caveat'/u);
    expect(resolveTypeFace('comic-sans')).toBeNull();
    expect(resolveTypeFace(undefined)).toBeNull();
    for (const role of TYPE_ROLES) expect(resolveTypeFace(role).role).toBe(role);
  });

  it('offer every face RISE hosts, once, and nothing it does not', () => {
    expect(new Set(TYPE_FACES.map(face => face.id)).size).toBe(TYPE_FACES.length);
    expect(TYPE_NAMES).toEqual([...TYPE_ROLES, ...TYPE_FACES.map(face => face.id)]);
    for (const face of TYPE_FACES) expect(face.family.startsWith("'")).toBe(true);
  });
});

describe('sizes relative to the reader', () => {
  it('step from the reader’s size and stop at the ends', () => {
    expect(stepFontSize('medium', 'smaller')).toBe('small');
    expect(stepFontSize('medium', 'as-set')).toBe('medium');
    expect(stepFontSize('medium', undefined)).toBe('medium');
    expect(stepFontSize('medium', 'larger')).toBe('large');
    expect(stepFontSize('medium', 'display')).toBe('xlarge');
    expect(stepFontSize('xlarge', 'larger')).toBe('xlarge');
    expect(stepFontSize('small', 'smaller')).toBe('small');
  });

  it('treats fit as the largest size, and an unknown base as medium', () => {
    expect(stepFontSize('fit', 'smaller')).toBe('large');
    expect(stepFontSize(undefined, 'larger')).toBe('large');
  });
});
