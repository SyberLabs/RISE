import { afterEach, describe, expect, it } from 'vitest';
import { ERASABLE_LOCAL_KEYS, USER_DATA_KEYS } from './user-data-keys.js';
import {
    clearProgress,
    holdsArcanum,
    houseSeals,
    markRead,
    readProgress,
    readState
} from './school-progress.js';

const KEY = 'rise_school_progress_v1';
const EMPTY = { v: 1, read: {} };

function store(value) {
    localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

describe('school progress', () => {
    afterEach(() => localStorage.clear());

    it('is registered, so export carries it and erase clears it', () => {
        expect(USER_DATA_KEYS.schoolProgress).toBe(KEY);
        expect(ERASABLE_LOCAL_KEYS).toContain(KEY);
    });

    it('starts empty', () => {
        expect(readProgress()).toEqual(EMPTY);
    });

    it('reads anything malformed as empty', () => {
        for (const bad of ['{not json', 'null', '[]', '"x"', { v: 2, read: {} }, { v: 1, read: [] }, { v: 1 }]) {
            store(bad);
            expect(readProgress(), JSON.stringify(bad)).toEqual(EMPTY);
        }
    });

    it('keeps only records the canon holds, in the shape it writes', () => {
        const at = '2026-10-16T12:00:00.000Z';
        store({
            v: 1,
            read: {
                'sun.meditations': { entries: ['Book 1'], at },
                'saturn.tao-te-ching': { entries: [], at, whole: true },
                'sun.nothing': { entries: ['Book 1'], at },
                'sun.fragments': { entries: 'Book 1', at },
                'sun.ethics': { entries: [7], at },
                'sun.enneads': { entries: [], at: 12 },
                'sun.nature': { entries: [], at, whole: 'yes' }
            }
        });
        expect(readProgress()).toEqual({
            v: 1,
            read: {
                'sun.meditations': { entries: ['Book 1'], at },
                'saturn.tao-te-ching': { entries: [], at, whole: true }
            }
        });
    });

    it('ignores a record the canon does not hold', () => {
        markRead('sun.nothing', 'Book 1');
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(readProgress()).toEqual(EMPTY);
    });

    it('marks an entry once, however often it is finished', () => {
        markRead('sun.meditations', 'Book 1');
        markRead('sun.meditations', 'Book 1');
        markRead('sun.meditations', 'Book 2');
        const record = readProgress().read['sun.meditations'];
        expect(record.entries).toEqual(['Book 1', 'Book 2']);
        expect(Number.isNaN(Date.parse(record.at))).toBe(false);
    });

    it('refuses an entry id that is not a short string', () => {
        markRead('sun.meditations', 'x'.repeat(161));
        markRead('sun.meditations', 7);
        expect(readProgress()).toEqual(EMPTY);
    });

    it('bounds the entries a record can hold', () => {
        const entries = Array.from({ length: 1100 }, (_, i) => `Part ${i}`);
        store({ v: 1, read: { 'sun.meditations': { entries, at: '2026-10-16T12:00:00.000Z' } } });
        expect(readProgress().read['sun.meditations'].entries).toHaveLength(1024);
    });

    it('climbs from unread through begun to read as entries are finished', () => {
        expect(readState('sun.meditations', 3)).toBe('unread');
        markRead('sun.meditations', 'Book 1');
        expect(readState('sun.meditations', 3)).toBe('begun');
        markRead('sun.meditations', 'Book 2');
        markRead('sun.meditations', 'Book 3');
        expect(readState('sun.meditations', 3)).toBe('read');
    });

    it('reads a whole work as read, whatever its entry count', () => {
        markRead('saturn.tao-te-ching');
        expect(readState('saturn.tao-te-ching', 81)).toBe('read');
        expect(readState('saturn.tao-te-ching', 0)).toBe('read');
    });

    it('never calls entries read against an unknown entry count', () => {
        markRead('sun.meditations', 'Book 1');
        expect(readState('sun.meditations', 0)).toBe('begun');
        expect(readState('sun.meditations')).toBe('begun');
    });

    it('counts a house\'s seals and holds its arcanum once a degree-3 text is read', () => {
        expect(houseSeals('sun')).toBe(0);
        expect(holdsArcanum('sun')).toBe(false);

        markRead('sun.meditations');
        markRead('sun.fragments', 'Fragment 1');
        expect(houseSeals('sun')).toBe(1);
        expect(houseSeals('sun', id => (id === 'sun.fragments' ? 1 : 0))).toBe(2);
        expect(holdsArcanum('sun')).toBe(false);

        markRead('sun.ethics', 'Part I');
        expect(holdsArcanum('sun')).toBe(false);
        expect(holdsArcanum('sun', id => (id === 'sun.ethics' ? 1 : 0))).toBe(true);
        expect(houseSeals('saturn')).toBe(0);
    });

    it('erases the record', () => {
        markRead('sun.meditations');
        clearProgress();
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(readProgress()).toEqual(EMPTY);
    });

    it('survives an origin whose storage throws on access', () => {
        const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() { throw new DOMException('denied', 'SecurityError'); }
        });
        try {
            expect(readProgress()).toEqual(EMPTY);
            expect(() => markRead('sun.meditations')).not.toThrow();
            expect(readState('sun.meditations', 1)).toBe('unread');
            expect(() => clearProgress()).not.toThrow();
        } finally {
            Object.defineProperty(globalThis, 'localStorage', own);
        }
    });
});
