import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
    FLASHING_ENABLED,
    IMAGE_STREAM_ENABLED,
    SAFE_PRESENTATION,
    normalizePresentation,
    presentationFlashes,
    resolvePresentation
} from './visual-presence.js';

/**
 * WHAT CHANGES WHEN `IMAGE_STREAM_ENABLED` FLIPS.
 *
 * The flag is a build constant, so these tests hand the normaliser's switches
 * in as arguments (`resolvePresentation`) rather than flipping the constant.
 * flashing-disabled.test.js holds the flag-off half: while the flag is off,
 * no reachable state can put the stream on screen.
 *
 * With the flag on, exactly one input changes: the surface named 'stream'.
 * Every other value resolves as it did, so the flag cannot bring back the
 * event economy, and a near-miss of the name cannot select the stream.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const CONTENT = join(ROOT, 'src', 'content');
const STREAM_ON = Object.freeze({ flashing: FLASHING_ENABLED, stream: true });
const STREAM_OFF = Object.freeze({ flashing: FLASHING_ENABLED, stream: false });

const OTHER_INPUTS = [
    'full-frame',
    'behind-stream',
    'continuous',
    'continuous-word',
    'gallery-in-the-word',
    'STREAM',
    ' stream ',
    'image-stream',
    'streams',
    'flash',
    '',
    null,
    undefined,
    0,
    true,
    {},
    [],
    ['stream'],
    { presentation: 'stream' }
];

describe('the image stream flag, switched on', () => {
    it('lets the surface named stream through, and nothing else changes', () => {
        expect(resolvePresentation('stream', STREAM_ON)).toBe('stream');
        for (const input of OTHER_INPUTS) {
            expect(resolvePresentation(input, STREAM_ON),
                `${JSON.stringify(input)} resolves differently with the stream on`)
                .toBe(resolvePresentation(input, STREAM_OFF));
        }
    });

    it('does not bring back the event economy', () => {
        for (const input of OTHER_INPUTS) {
            const resolved = resolvePresentation(input, { flashing: false, stream: true });
            expect(presentationFlashes(resolved),
                `${JSON.stringify(input)} resolved to ${resolved}, which flashes`).toBe(false);
        }
    });

    it('is honoured only as the literal true, so a truthy accident does not switch it on', () => {
        for (const stream of [1, 'true', 'on', {}, []]) {
            expect(resolvePresentation('stream', { flashing: false, stream })).toBe(SAFE_PRESENTATION);
        }
    });
});

describe('the one door every presentation comes through', () => {
    it('is the normaliser with the build\'s own switches', () => {
        const build = { flashing: FLASHING_ENABLED, stream: IMAGE_STREAM_ENABLED };
        for (const input of ['stream', ...OTHER_INPUTS]) {
            expect(normalizePresentation(input)).toBe(resolvePresentation(input, build));
        }
    });

    it('is the only production caller of the switchable resolver', () => {
        // A production module that called resolvePresentation could hand it
        // `stream: true` and reach the stream with the flag off.
        const offenders = [];
        const walk = (dir) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                // src/content is 127 MB of works held as data; no code there
                // calls the Chamber or the normaliser, and flashing-disabled.test.js
                // already checks it for presentation names.
                if (statSync(full).isDirectory()) { if (full !== CONTENT) walk(full); continue; }
                if (!entry.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry)) continue;
                if (full.endsWith(join('core', 'visual-presence.js'))) continue;
                if (readFileSync(full, 'utf8').includes('resolvePresentation')) {
                    offenders.push(relative(ROOT, full).replace(/\\/gu, '/'));
                }
            }
        };
        walk(join(ROOT, 'src'));
        expect(offenders).toEqual([]);
    });
});

describe('before the flag may flip', () => {
    it('keeps the list of preconditions in the spec, so none can be dropped quietly', () => {
        const spec = readFileSync(join(ROOT, 'docs/specs/IMAGE-STREAM-SPEC.md'), 'utf8');
        const start = spec.indexOf('### Before IMAGE_STREAM_ENABLED may flip');
        expect(start, 'the preconditions heading is gone from the spec').toBeGreaterThan(-1);
        const list = spec.slice(start, spec.indexOf('\n## ', start + 1));
        for (const item of ['reel compiler', 'phone', 'OS magnifier', 'backdrop blur', 'blur footprint',
            'zoom-refusal heuristic', 'notice', 'real-browser safety review']) {
            expect(list, item).toContain(item);
        }
    });
});
