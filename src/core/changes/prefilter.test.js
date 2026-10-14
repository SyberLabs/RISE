import { describe, expect, it } from 'vitest';
import { isRecordsOnly, prefilter } from './prefilter.js';

const pull = (number, files, fileCount = files.length) => ({ number, files, fileCount });

describe('prefilter', () => {
  it('marks a pull request whose every changed file is a task record', () => {
    expect(isRecordsOnly(pull(1, ['docs/product/tasks/LIVE-027.json', 'docs/product/tasks/SVC-002.json']))).toBe(true);
  });

  it('keeps a pull request that touches anything else', () => {
    expect(isRecordsOnly(pull(2, ['docs/product/tasks/LIVE-027.json', 'src/live/host/home.js']))).toBe(false);
    expect(isRecordsOnly(pull(3, ['docs/product/README.md']))).toBe(false);
    expect(isRecordsOnly(pull(4, ['docs/product/tasks-archive/x.json']))).toBe(false);
  });

  it('keeps a pull request with no files, or with more files than were listed', () => {
    expect(isRecordsOnly(pull(5, []))).toBe(false);
    expect(isRecordsOnly(pull(6, ['docs/product/tasks/A.json'], 101))).toBe(false);
  });

  it('splits records from candidates, in order', () => {
    const pulls = [pull(9, ['src/a.js']), pull(8, ['docs/product/tasks/A.json']), pull(7, ['worker/index.mjs'])];
    const { records, candidates } = prefilter(pulls);
    expect(records.map(item => item.number)).toEqual([8]);
    expect(candidates.map(item => item.number)).toEqual([9, 7]);
  });
});
