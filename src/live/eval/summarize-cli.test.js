/**
 * The script that reads the records back. It must be as careful as the study:
 * skip what is not a record, count what it leaves out, and print only the
 * conclusion the study may draw.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { load, report } from '../../../scripts/summarize-live-study.mjs';
import { COMPREHENSION, RECORD_SCHEMA } from './study.js';

let dir;
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

const record = (n, condition, correct, voice = 'browser') => {
    const answers = {};
    COMPREHENSION.forEach((item, index) => { answers[item.id] = index < correct ? item.answer : (item.answer + 1) % 4; });
    return {
        schema: RECORD_SCHEMA, participantId: n.toString(16).padStart(12, '0'), condition, startedAt: '2026-09-29T10:00:00.000Z',
        answers: { ...answers, e1: 0, o1: 0 }, ratings: condition === 'text' || condition === 'spoken' ? { coherence: 4 } : { coherence: 4, informative: 4, decorative: 4 },
        environment: { voice }
    };
};

function folder(records, extra = {}) {
    dir = mkdtempSync(join(tmpdir(), 'rise-study-'));
    records.forEach((entry, i) => writeFileSync(join(dir, `${i}.json`), JSON.stringify(entry)));
    for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text);
    return dir;
}

describe('reading records back', () => {
    it('loads every record in a folder, and names and skips what is not one', () => {
        const path = folder([record(1, 'text', 3), record(2, 'rise-current', 3)], {
            'notes.txt': 'not json', 'broken.json': '{', 'other.json': JSON.stringify({ schema: 'something else' }), 'person.json': JSON.stringify({ ...record(3, 'text', 2), name: 'A. Person' })
        });
        const { records, skipped } = load([path]);
        expect(records).toHaveLength(2);
        expect(skipped.map(name => name.split(/[\\/]/u).at(-1)).sort()).toEqual(['broken.json', 'other.json', 'person.json']);
    });

    it('says nothing at all about RISE when the groups are small, and says how many it read', () => {
        const path = folder([record(1, 'rise-current', 6), record(2, 'spoken-visualizer', 1)]);
        const text = report(load([path]));
        expect(text).toMatch(/Records read: 2\./u);
        expect(text).toMatch(/Conclusion \(insufficient\): Too few participants/u);
    });

    it('counts and leaves out a spoken run with no voice that spoke', () => {
        const path = folder([record(1, 'spoken', 3, 'paced'), record(2, 'spoken', 3, 'browser'), record(3, 'text', 3, 'paced')]);
        const text = report(load([path]));
        expect(text).toMatch(/Left out of the analysis .*: 1\./u);
    });

    it('prints the honest conclusion when a live Current did no better than a visualizer', () => {
        const same = (condition, base) => Array.from({ length: 12 }, (_, i) => record(base + i, condition, 3 + (i % 3)));
        const path = folder([...same('rise-current', 100), ...same('spoken-visualizer', 200)]);
        const text = report(load([path]));
        expect(text).toMatch(/Conclusion \(no-objective-difference\)/u);
        expect(text).toMatch(/aesthetics and experience/u);
        expect(text).toMatch(/primary +comprehension +vs spoken-visualizer/u);
    });

    it('takes files as well as folders', () => {
        const path = folder([record(1, 'text', 3)]);
        expect(load([join(path, '0.json')]).records).toHaveLength(1);
    });
});
