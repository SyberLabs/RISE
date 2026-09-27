import { describe, expect, it } from 'vitest';
import { validatePiece } from './personal-piece-contract.js';

const words = n => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const piece = paragraphs => ({ title: 'T', paragraphs });

describe('shared prose contract', () => {
  it('keeps single line breaks and rejects control and separator characters', () => {
    expect(() => validatePiece(piece([`${words(30)}\n${words(30)}`, words(60)]))).not.toThrow();
    for (const bad of ['\t', '\u0001', '\u0085', ' ', ' ', '\v']) {
      expect(() => validatePiece(piece([`${words(30)}${bad}${words(30)}`, words(60)])), JSON.stringify(bad)).toThrow();
    }
  });
  it('bounds total text so a server-accepted piece always fits the browser response limit', () => {
    const long = paragraph => `${words(20)} ${'a'.repeat(paragraph)}`;
    expect(() => validatePiece(piece([1, 2, 3, 4, 5].map(() => long(1000))))).toThrow();
    const largest = piece([1, 2, 3, 4].map(() => long(640)));
    expect(() => validatePiece(largest)).not.toThrow();
    const response = JSON.stringify({ requestId: crypto.randomUUID(), ...largest, writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' });
    expect(response.length * 2).toBeLessThan(16384);
  });
});
