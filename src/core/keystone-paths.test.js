/**
 * The path helpers moved to a leaf module so a synchronous navigation on
 * the first-load path could ask "is this try-rise?" without importing the
 * Archive. These assert the move changed nothing.
 */
import { describe, expect, it } from 'vitest';
import {
    KEYSTONE_ROUTE_PREFIX,
    TRY_RISE_PATH,
    isTryRisePath,
    keystonePath
} from './keystone-paths.js';
import * as keystones from '../content/keystones.js';

const PATHS = [
    '/try-rise',
    '/try-rise/',
    '/try-rise//',
    '/try-rise/extra',
    '/keystone/meditations',
    '/keystone/',
    '/',
    '',
    null,
    undefined,
    '/TRY-RISE'
];

describe('keystone-paths', () => {
    it('names the corridor the deployment redirects to', () => {
        expect(TRY_RISE_PATH).toBe('/try-rise');
        expect(KEYSTONE_ROUTE_PREFIX).toBe('/keystone/');
    });

    it('answers for try-rise ignoring trailing slashes, and nothing else', () => {
        expect(isTryRisePath('/try-rise')).toBe(true);
        expect(isTryRisePath('/try-rise/')).toBe(true);
        expect(isTryRisePath('/try-rise/extra')).toBe(false);
        expect(isTryRisePath('/keystone/meditations')).toBe(false);
        expect(isTryRisePath('/')).toBe(false);
        expect(isTryRisePath(null)).toBe(false);
    });

    it('builds a keystone path from a slug, trimmed and lowered', () => {
        expect(keystonePath(' Meditations ')).toBe('/keystone/meditations');
        expect(keystonePath('')).toBe('/keystone/');
    });
});

describe('keystones.js re-exports them unchanged', () => {
    it('is the same function, not a copy that can drift', () => {
        expect(keystones.isTryRisePath).toBe(isTryRisePath);
        expect(keystones.keystonePath).toBe(keystonePath);
        expect(keystones.TRY_RISE_PATH).toBe(TRY_RISE_PATH);
        expect(keystones.KEYSTONE_ROUTE_PREFIX).toBe(KEYSTONE_ROUTE_PREFIX);
    });

    it('agrees with the canonical helper on every path shape', () => {
        for (const path of PATHS) {
            expect(keystones.isTryRisePath(path), String(path))
                .toBe(isTryRisePath(path));
        }
    });
});
