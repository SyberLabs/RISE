import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
    FLASHING_ENABLED,
    SAFE_PRESENTATION,
    isContinuousPresentation,
    normalizePresentation,
    presentationFlashes
} from './visual-presence.js';
import { compileSession } from './session-compiler.js';

/**
 * NO REACHABLE PRODUCTION STATE CAN PUT A FLASHING SURFACE ON THE SCREEN.
 *
 * Flashing light is the only thing in RISE that can physically hurt somebody,
 * and it is switched off in production. This file is what makes that a
 * property of the build rather than an intention: it drives real inputs
 * through the real normaliser and the real compiler, including the ones a
 * careful author would never write — a composition saved when the flashing
 * surfaces were offered, a hand-edited import, values nobody has thought of.
 *
 * It is also the reversal notice. Turning `FLASHING_ENABLED` back on flips
 * this whole file into its other half, and the assertions state exactly what
 * comes back with it, so nobody has to guess what the switch does.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const FLASHING_SURFACES = ['full-frame', 'behind-stream'];

/** Everything a stored, imported or mistyped presentation could ever be. */
const HOSTILE_INPUTS = [
    ...FLASHING_SURFACES,
    'continuous',
    'continuous-word',
    'gallery-in-the-word',
    'FULL-FRAME',
    ' full-frame ',
    'flash',
    'strobe',
    '',
    null,
    undefined,
    0,
    42,
    true,
    {},
    [],
    ['full-frame'],
    { presentation: 'full-frame' }
];

function sessionWith(presentation) {
    return compileSession({
        title: 'Probe',
        text: 'One two three four five six seven eight nine ten.',
        visualConfig: {
            visualMode: 'interlocution',
            interlocution: { presentation, procedural: ['fractal'] }
        }
    });
}

describe('flashing is disabled in production', () => {
    it('is disabled — every assertion below is conditional on this', () => {
        expect(FLASHING_ENABLED, 'flashing has been re-enabled; read this file '
            + 'before shipping it, because these are the guarantees that lapse').toBe(false);
        expect(isContinuousPresentation(SAFE_PRESENTATION),
            'the surface everything falls back to must not itself flash').toBe(true);
    });

    it('resolves every input, however hostile, to a surface that cannot flash', () => {
        for (const input of HOSTILE_INPUTS) {
            const resolved = normalizePresentation(input);
            expect(presentationFlashes(resolved),
                `${JSON.stringify(input)} resolved to ${resolved}, which flashes`).toBe(false);
        }
    });

    it('refuses a flashing surface that was explicitly and validly asked for', () => {
        // Not a typo and not corruption: a composition authored when these
        // were on offer, opened today.
        for (const surface of FLASHING_SURFACES) {
            expect(normalizePresentation(surface)).toBe(SAFE_PRESENTATION);
        }
    });

    it('compiles a saved flashing composition down to a surface that does not flash', () => {
        for (const surface of [...FLASHING_SURFACES, 'gallery-in-the-word', undefined]) {
            const compiled = sessionWith(surface);
            const presentation = compiled.visualConfig.interlocution.presentation;
            expect(presentationFlashes(presentation),
                `a session saved with ${String(surface)} still compiles to ${presentation}`)
                .toBe(false);
        }
    });

    it('leaves no shipped composition asking for a surface it will not get', () => {
        // Content may still name a flashing surface — the engine keeps the
        // code — but nothing shipped may reach a reader as a flash.
        const offenders = [];
        const walk = (dir) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) { walk(full); continue; }
                if (!entry.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry)) continue;
                const text = readFileSync(full, 'utf8');
                for (const surface of FLASHING_SURFACES) {
                    if (!text.includes(`presentation: '${surface}'`)) continue;
                    if (presentationFlashes(normalizePresentation(surface))) {
                        offenders.push(`${relative(ROOT, full).replace(/\\/gu, '/')} → ${surface}`);
                    }
                }
            }
        };
        walk(join(ROOT, 'src', 'content'));
        expect(offenders, 'shipped content names a flashing surface AND the '
            + 'normaliser would grant it').toEqual([]);
    });

    it('offers the author no control that would select one', () => {
        const workshop = readFileSync(join(ROOT, 'src/components/Workshop.js'), 'utf8');
        const options = workshop.slice(
            workshop.indexOf('const presentations = '),
            workshop.indexOf('controls = `<label class="input-label">Presentation')
        );
        expect(options).toContain('FLASHING_ENABLED');
        // The labels may still appear, but only inside the enabled branch.
        const enabledBranch = options.slice(options.indexOf('? ['), options.indexOf(': ['));
        const disabledBranch = options.slice(options.indexOf(': ['));
        for (const label of ['Background Flash', 'Foreground Flash']) {
            expect(enabledBranch, `${label} should remain available when re-enabled`)
                .toContain(label);
            expect(disabledBranch, `${label} is still offered while flashing is off`)
                .not.toContain(label);
        }
    });

    it('raises no photosensitivity notice for a risk the build cannot produce', () => {
        const factory = readFileSync(join(ROOT, 'src/app/chamber-session-factory.js'), 'utf8');
        expect(factory, 'the launch gate no longer consults the kill switch, so it '
            + 'would warn about a flash that cannot happen').toContain(
            'const flashes = FLASHING_ENABLED && !isContinuousPresentation(presentation)'
        );
    });

    it('normalises before the engine is ever configured', () => {
        // The cortex is a library and keeps the ability to draw these
        // surfaces; what matters is that nothing in production hands it one.
        // Production reaches it through exactly two doors, and both normalise.
        const factory = readFileSync(join(ROOT, 'src/app/chamber-session-factory.js'), 'utf8');
        const compiler = readFileSync(join(ROOT, 'src/core/session-compiler.js'), 'utf8');
        expect(factory).toContain('presentation: normalizePresentation(interlocution.presentation)');
        expect(compiler).toContain('presentation: normalizePresentation(raw.presentation)');
    });

    it('leaves no production caller handing the engine a raw presentation', () => {
        // `updateConfig` is the engine's own door. If production ever starts
        // pushing a presentation through it, that path needs normalising too.
        const offenders = [];
        const walk = (dir) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) { walk(full); continue; }
                if (!entry.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry)) continue;
                if (full.endsWith('visual-cortex.js')) continue;
                const text = readFileSync(full, 'utf8');
                for (const [, args] of text.matchAll(/updateConfig\(([^)]*)\)/gu)) {
                    if (args.includes('presentation')) {
                        offenders.push(relative(ROOT, full).replace(/\\/gu, '/'));
                    }
                }
            }
        };
        walk(join(ROOT, 'src'));
        expect([...new Set(offenders)], 'a production caller configures the engine '
            + 'with a presentation directly; normalise it or route it through the '
            + 'compiler').toEqual([]);
    });

    it('raises no notice on the spatial launch path either', () => {
        const factory = readFileSync(join(ROOT, 'src/app/chamber-session-factory.js'), 'utf8');
        expect(factory, 'the deferred/spatial gate stopped consulting the kill '
            + 'switch, so a page-mode launch would warn about an impossible flash')
            .toContain('const directFlashes = FLASHING_ENABLED');
    });
});
