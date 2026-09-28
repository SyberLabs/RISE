import { describe, expect, it } from 'vitest';
import {
  SEGMENTATION_LIMITS,
  canonicalSectionDigest,
  prepareVisualSource,
  segmentSource,
  sha256Hex
} from './segmentation.js';

const words = (count, word = 'word') => Array.from({ length: count }, () => word).join(' ');
const paragraph = (count, word) => `${words(count, word)}.`;

function assertCoverage(text, blocks) {
  expect(blocks[0].from).toBe(0);
  expect(blocks.at(-1).to).toBe(text.length);
  for (let i = 1; i < blocks.length; i += 1) expect(blocks[i].from).toBe(blocks[i - 1].to);
  expect(blocks.map(block => text.slice(block.from, block.to)).join('')).toBe(text);
}

describe('deterministic source segmentation', () => {
  it('prefers paragraph boundaries and groups short paragraphs toward 150-250 words', () => {
    const text = Array.from({ length: 12 }, (_, i) => paragraph(60, `p${i}`)).join('\n\n');
    const { blocks } = segmentSource(text);
    assertCoverage(text, blocks);
    for (const block of blocks.slice(0, -1)) {
      expect(block.words).toBeGreaterThanOrEqual(150);
      expect(block.words).toBeLessThanOrEqual(250);
      // Every cut sits at the start of a paragraph.
      expect(text.slice(block.to - 2, block.to)).toBe('\n\n');
    }
  });

  it('splits an oversized paragraph at sentence boundaries', () => {
    const sentence = `${words(40, 'lengthy')}.`;
    const text = Array.from({ length: 12 }, () => sentence).join(' ');
    const { blocks } = segmentSource(text);
    assertCoverage(text, blocks);
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks.slice(0, -1)) {
      expect(text.slice(block.from, block.to).trimEnd().endsWith('.')).toBe(true);
      expect(block.words).toBeLessThanOrEqual(250);
    }
  });

  it('falls back to token boundaries when one sentence exceeds the hard ceiling', () => {
    const text = words(900, 'unending');
    const { blocks } = segmentSource(text);
    assertCoverage(text, blocks);
    for (const block of blocks) {
      expect(block.to - block.from).toBeLessThanOrEqual(SEGMENTATION_LIMITS.maxBlockChars);
      expect(/\S/u.test(text[block.from])).toBe(true);
    }
  });

  it('splits a pathological single token without breaking surrogate pairs', () => {
    const token = '😀'.repeat(1500);
    const text = `start ${token} end`;
    const { blocks } = segmentSource(text);
    assertCoverage(text, blocks);
    for (const block of blocks) {
      expect(block.to - block.from).toBeLessThanOrEqual(SEGMENTATION_LIMITS.maxBlockChars);
      const code = text.charCodeAt(block.to - 1);
      if (block.to < text.length) expect(code >= 0xd800 && code <= 0xdbff).toBe(false);
    }
  });

  it('groups blocks into sections of at most eight blocks and 12,000 units', () => {
    const text = Array.from({ length: 60 }, (_, i) => paragraph(200, `s${i}`)).join('\n\n');
    const { blocks, sections } = segmentSource(text);
    assertCoverage(text, blocks);
    let next = 0;
    for (const section of sections) {
      expect(section.start).toBe(next);
      expect(section.end - section.start).toBeLessThanOrEqual(8);
      const size = blocks.slice(section.start, section.end).reduce((sum, b) => sum + b.to - b.from, 0);
      expect(size).toBeLessThanOrEqual(SEGMENTATION_LIMITS.maxSectionChars);
      next = section.end;
    }
    expect(next).toBe(blocks.length);
  });

  it('is deterministic and ignores reading speed or layout', () => {
    const text = Array.from({ length: 7 }, (_, i) => paragraph(90, `d${i}`)).join('\n\n');
    expect(segmentSource(text)).toEqual(segmentSource(text));
  });

  it('merges a short tail into the preceding block when it fits', () => {
    const text = `${paragraph(200, 'main')}\n\n${paragraph(10, 'tail')}`;
    const { blocks } = segmentSource(text);
    expect(blocks).toHaveLength(1);
  });

  it('keeps whitespace-only and empty sources honest', () => {
    expect(segmentSource('').blocks).toEqual([]);
    const { blocks } = segmentSource('   \n\n  ');
    assertCoverage('   \n\n  ', blocks);
  });
});

describe('source preparation identity', () => {
  it('derives stable block ids from source digest, text, and span', async () => {
    const text = Array.from({ length: 6 }, (_, i) => paragraph(120, `x${i}`)).join('\n\n');
    const a = await prepareVisualSource(text);
    const b = await prepareVisualSource(text);
    expect(a.sourceDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(a.blocks.map(block => block.id)).toEqual(b.blocks.map(block => block.id));
    expect(new Set(a.blocks.map(block => block.id)).size).toBe(a.blocks.length);
    a.blocks.forEach(block => expect(block.id).toMatch(/^b[0-9a-f]{20}$/u));
  });

  it('changes every identity when the source is edited', async () => {
    const text = Array.from({ length: 6 }, (_, i) => paragraph(120, `y${i}`)).join('\n\n');
    const original = await prepareVisualSource(text);
    const edited = await prepareVisualSource(`${text} Amended.`);
    expect(edited.sourceDigest).not.toBe(original.sourceDigest);
    const ids = new Set(original.blocks.map(block => block.id));
    expect(edited.blocks.some(block => ids.has(block.id))).toBe(false);
  });

  it('digests a section canonically as UTF-8 JSON of [id, text] pairs', async () => {
    const pairs = [['b1', 'Hello — world'], ['b2', 'naïve']];
    expect(await canonicalSectionDigest(pairs.map(([id, text]) => ({ id, text }))))
      .toBe(await sha256Hex(JSON.stringify(pairs)));
    expect(await sha256Hex('abc'))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
