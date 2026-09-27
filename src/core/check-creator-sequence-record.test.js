import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const files = [];
const script = resolve('scripts/check-creator-sequence-record.mjs');
const valid = {
  schema: 'rise.creator-sequence.v1', id: 'creator:sample', version: 1,
  creator: { id: 'creator-1', credit: 'A Creator', permission: 'granted' },
  source: {
    title: 'A Work', author: 'An Author', edition: 'Edition 1',
    passage: { start: 'chapter-1', end: 'chapter-1' },
    fingerprint: 'a'.repeat(64), rights: 'Public domain edition'
  },
  program: { id: 'program-1', version: 1 },
  allowedVariations: [], approval: { state: 'approved' }
};

function run(record) {
  const file = join(tmpdir(), `rise-creator-${randomUUID()}.json`);
  files.push(file);
  writeFileSync(file, JSON.stringify(record));
  return spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
}

afterEach(() => { while (files.length) unlinkSync(files.pop()); });

describe('local creator record intake check', () => {
  it('accepts an approved record while stating what it has not verified', () => {
    const result = run(valid);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Structure valid');
    expect(result.stdout).toContain('rights');
  });

  it('refuses a withdrawn creator record', () => {
    const result = run({ ...valid, approval: { state: 'withdrawn' } });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid creator sequence record');
  });
});
