import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
    ERASABLE_LOCAL_KEYS,
    ERASABLE_LOCAL_KEY_PREFIXES,
    UNREGISTERED_LOCAL_KEYS,
    USER_DATA_KEYS
} from './user-data-keys.js';

/**
 * The registry is a promise to the reader, so it is checked against the tree
 * rather than against itself.
 *
 * Seven keys had drifted out of `USER_DATA_KEYS` — a Chapel icon, four
 * devotional preferences, an orbital note — because each was declared where
 * it was used and nothing ever compared the two lists. "Clear all personal
 * data" left every one of them on the device. A registry nothing enforces is
 * a list of what somebody remembered on the day.
 *
 * So this reads src/ for keys that actually reach localStorage and fails when
 * one is neither registered nor excepted with a reason.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = join(ROOT, 'src');

/** Content is text, not program: no room keeps a preference in a novel. */
const SKIP_DIRS = new Set(['content', 'test']);

function sourceFiles(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (!SKIP_DIRS.has(entry)) sourceFiles(full, out);
            continue;
        }
        if (!entry.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry)) continue;
        out.push(full);
    }
    return out;
}

/**
 * Keys a file hands to localStorage, in the two shapes this codebase writes:
 * the literal passed straight to the call, and the `const NAME_KEY = '…'`
 * a room declares at the top and passes by name.
 */
function localStorageKeysIn(text) {
    const keys = new Set();
    if (!text.includes('localStorage')) return keys;

    for (const [, key] of text.matchAll(
        /localStorage\s*\.\s*(?:set|get|remove)Item\s*\(\s*['"]([^'"]+)['"]/gu
    )) {
        keys.add(key);
    }

    // A named constant only counts when the same file also touches
    // localStorage — `visual-safety.js` declares a key for sessionStorage,
    // and an erase must not be asked to answer for it.
    for (const [, name, value] of text.matchAll(
        /(?:const|let)\s+([A-Za-z0-9_]*KEY)\s*=\s*['"]([^'"]+)['"]/gu
    )) {
        if (new RegExp(`localStorage[^\\n]*\\b${name}\\b|\\b${name}\\b[^\\n]*localStorage`, 'u').test(text)
            || new RegExp(`_setPref\\s*\\(\\s*${name}|_pref\\s*\\(\\s*${name}`, 'u').test(text)) {
            keys.add(value);
        }
    }
    return keys;
}

describe('the localStorage registry is the erase inventory', () => {
    const found = new Map();
    const labelsUsed = new Set();
    for (const file of sourceFiles(SRC)) {
        const text = readFileSync(file, 'utf8');
        const shown = relative(ROOT, file).replace(/\\/gu, '/');
        for (const key of localStorageKeysIn(text)) {
            if (!found.has(key)) found.set(key, []);
            found.get(key).push(shown);
        }
        // A room that reads its key off the registry is still using it. Once
        // the keys moved here the literals left the rooms, so reference by
        // label is the evidence of use.
        for (const [, label] of text.matchAll(/USER_DATA_KEYS\s*\.\s*([A-Za-z0-9_]+)/gu)) {
            labelsUsed.add(label);
        }
    }

    it('finds keys and registry uses at all, so a silent pass cannot mean a broken scan', () => {
        expect(found.size, 'no localStorage key literal was found in src/ — the scan is broken')
            .toBeGreaterThan(1);
        expect([...found.keys()], 'the settings key is written as a literal in app.js')
            .toContain(USER_DATA_KEYS.settings);
        expect(labelsUsed.size, 'no room reads a key off the registry — the scan is broken')
            .toBeGreaterThan(4);
        expect([...labelsUsed]).toContain('rosarySound');
    });

    it('names every key that reaches localStorage, or excepts it with a reason', () => {
        const registered = new Set(ERASABLE_LOCAL_KEYS);
        const excepted = new Set(Object.keys(UNREGISTERED_LOCAL_KEYS));
        const orphans = [...found.entries()]
            .filter(([key]) => !registered.has(key) && !excepted.has(key))
            .map(([key, files]) => `${key} (${files.join(', ')})`);

        expect(orphans, orphans.length
            ? 'These keys are written but are not in USER_DATA_KEYS, so "Clear all '
              + 'personal data" leaves them on the reader\'s device. Register each one, '
              + 'or add it to UNREGISTERED_LOCAL_KEYS with the reason it is not '
              + 'reader data.'
            : '').toEqual([]);
    });

    it('registers nothing it cannot find, so the inventory does not rot', () => {
        const written = new Set(found.keys());
        const byKey = new Map(Object.entries(USER_DATA_KEYS).map(([label, key]) => [key, label]));
        // `solPlan` outlives the room that wrote it: the Solarium is gone and
        // readers still hold plans, so it is registered and no longer written.
        const expectedAbsent = new Set([USER_DATA_KEYS.solPlan]);
        const stale = ERASABLE_LOCAL_KEYS.filter(key => !written.has(key)
            && !labelsUsed.has(byKey.get(key))
            && !expectedAbsent.has(key));

        expect(stale, 'Registered but neither written as a literal nor read off the '
            + 'registry. Either the room that wrote it is gone — in which case say so, '
            + 'as solPlan does — or the key is a typo and erase is clearing something '
            + 'that does not exist.').toEqual([]);
    });

    it('gives every exception a reason someone can weigh', () => {
        for (const [key, reason] of Object.entries(UNREGISTERED_LOCAL_KEYS)) {
            expect(reason.length, `${key} is excepted without a reason`).toBeGreaterThan(40);
        }
    });

    it('keeps the registry and its labels one to one', () => {
        const values = Object.values(USER_DATA_KEYS);
        expect(new Set(values).size, 'two labels share one key').toBe(values.length);
        const overlap = values.filter(key => key in UNREGISTERED_LOCAL_KEYS);
        expect(overlap, 'a key is both registered and excepted').toEqual([]);
    });

    it('registers the per-context Workshop lease prefix for complete erasure', () => {
        expect(ERASABLE_LOCAL_KEY_PREFIXES).toContain('rise_workshop_media_lease_v2:');
    });
});
