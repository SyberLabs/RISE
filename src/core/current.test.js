/**
 * The Current: what every way into a reading arrives at.
 *
 * RISE has many entrances (Library, Reader Setup, Workshop, Keystones, the
 * Chapel, Jev, Home's roll) and one destination. That is only true while
 * nothing else constructs the destination, and while each entrance's output
 * satisfies the same contract. Both are checked here, because a reading has
 * more than one door and a test written against the door just built proves
 * only that two things can be wired together (PROJECT-KNOWLEDGE §2.3).
 *
 * The Current is not a new type. It is a compiled Session and the Player that
 * runs it, and this file states what it means for two of them to be the same
 * kind of thing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileSession } from './session-compiler.js';
import { workshopProjectToSessionConfig } from './workshop-project.js';
import { resolveKeystone } from '../content/keystones.js';
import { createChapelHandoff } from '../content/chapel/handoff.js';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { jevPalette } from './jev-palette.js';
import { resolveJevChamberConfig } from './jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';
import { resolveJevReading } from '../app/jev-reading.js';

const ROOT = join(import.meta.dirname, '..', '..');

function sourceFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (name === 'node_modules') continue;
            sourceFiles(path, out);
        } else if (/\.(js|mjs)$/.test(name) && !/\.test\.(js|mjs)$/.test(name)) {
            out.push(path);
        }
    }
    return out;
}

const posix = path => relative(ROOT, path).split(sep).join('/');

describe('one door', () => {
    const files = [
        ...sourceFiles(join(ROOT, 'src')),
        ...sourceFiles(join(ROOT, 'scripts'))
    ];

    it('builds a Session in the compiler and nowhere else', () => {
        const builders = files
            .filter(file => /new Session\(/.test(readFileSync(file, 'utf8')))
            .map(posix);
        expect(builders).toEqual(['src/core/session-compiler.js']);
    });

    it('builds a Player in the chamber factory and nowhere else', () => {
        const builders = files
            .filter(file => /new Player\(/.test(readFileSync(file, 'utf8')))
            .map(posix);
        expect(builders).toEqual(['src/app/chamber-session-factory.js']);
    });
});

/**
 * What every Current holds, whichever entrance made it. Each line names what
 * a broken one looks like, so a check that cannot fail is easy to spot.
 */
function contractViolations(session) {
    const found = [];
    const sourceIds = new Set(session.sources.map(source => source.id));

    if (session.sources.length === 0) found.push('no sources');
    if (session.atoms.length === 0) found.push('no atoms');
    if (!(session.totalDuration > 0)) found.push('no duration');

    session.atoms.forEach((atom, index) => {
        if (atom.position !== index) found.push(`atom ${index} sits at position ${atom.position}`);
        if (!Number.isFinite(atom.duration) || atom.duration <= 0) {
            found.push(`atom ${index} has duration ${atom.duration}`);
        }
        const boundary = atom.tags?.includes('source-break');
        if (!boundary && !sourceIds.has(atom.sourceId)) {
            found.push(`atom ${index} belongs to no source (${atom.sourceId})`);
        }
    });

    if (!['stream', 'page'].includes(session.projection)) {
        found.push(`projection is ${session.projection}`);
    }
    for (const source of session.sources) {
        if (typeof session.sourceTexts?.get(source.id) !== 'string') {
            found.push(`the exact text of ${source.id} is not held`);
        }
    }
    if (session.experienceProgram
        && session.experienceProgram.schema !== 'rise.experience-program.v1') {
        found.push('score is not a canonical Experience Program');
    }
    return found;
}

/** What is read, and how fast, and how it is shown. Not who opened it or when. */
function readingSignature(session) {
    return JSON.stringify({
        atoms: session.atoms.map(atom => [atom.content, atom.duration, atom.sourceId, atom.position]),
        wpm: session.wpm,
        chunkMode: session.chunkMode,
        curve: session.curve,
        projection: session.projection
    });
}

const TEXT = 'The water was still. The moon lay on it, and nothing moved but the light.';

describe('the contract itself', () => {
    it('is met by a plain compile', () => {
        expect(contractViolations(compileSession({ title: 'Plain', text: TEXT }))).toEqual([]);
    });

    it('names a Session that was hand-built and is not a Current', () => {
        const session = compileSession({ title: 'Plain', text: TEXT });
        session.atoms[2].position = 7;
        session.atoms[3].duration = 0;
        session.projection = 'hologram';
        expect(contractViolations(session)).toEqual([
            'atom 2 sits at position 7',
            'atom 3 has duration 0',
            'projection is hologram'
        ]);
    });

    it('tells two readings apart', () => {
        const slow = compileSession({ title: 'A', text: TEXT, wpm: 200 });
        const fast = compileSession({ title: 'A', text: TEXT, wpm: 400 });
        expect(readingSignature(slow)).not.toBe(readingSignature(fast));
    });

    it('ignores what only identifies a compile', () => {
        const one = compileSession({ title: 'A', text: TEXT });
        const two = compileSession({ title: 'B', text: TEXT, origin: { view: 'library' } });
        expect(one.id).not.toBe(two.id);
        expect(readingSignature(one)).toBe(readingSignature(two));
    });
});

describe('every entrance yields a Current', () => {
    it('Reader Setup and the Library: a config compiled directly', () => {
        expect(contractViolations(compileSession({
            title: 'Direct', text: TEXT, wpm: 300, chunkMode: 'phrase'
        }))).toEqual([]);
    });

    it('Workshop, Vault, Create and Scriptorium: a project', () => {
        const config = workshopProjectToSessionConfig({
            id: 'blueprint-1',
            title: 'A project',
            intent: 'reflection',
            sources: [{ id: 'source-1', name: 'Source', providerId: 'local', type: 'text/plain', data: TEXT }],
            wpm: 300, paceV2: true, chunkMode: 'phrase', curve: 'flat',
            displayMode: 'focal', soundscape: 'none', audioPreset: 'silent',
            visualConfig: { visualMode: 'off' }
        });
        expect(contractViolations(compileSession(config))).toEqual([]);
    });

    it('Keystones', async () => {
        const { sessionInput } = await resolveKeystone('metamorphoses', { allowIncomplete: true });
        expect(contractViolations(compileSession(sessionInput))).toEqual([]);
    }, 60_000);

    it('the Chapel', async () => {
        const handoff = await createChapelHandoff('jude');
        expect(contractViolations(compileSession({
            title: handoff.source, text: handoff.text, ...handoff.config
        }))).toEqual([]);
    }, 60_000);

    it('Jev and Home\'s roll: a decision resolved against the shelf', async () => {
        const released = releaseInventory.middlemarch;
        const selectors = {
            section: 'first', wpm: 250, curve: 'flat', chunkMode: 'phrase',
            audio: 'silent', visualMode: 'off', visualStyle: 'quiet',
            visualEngine: 'fractal', visualPalette: 'purple', kleePreset: 'random',
            visualArc: 'single', arcSplit: '50', middleEngine: 'harmonograph',
            finaleEngine: 'ostensoria', middleAudio: 'aurora', finaleAudio: 'faded-signal',
            galleryCadence: 'balanced', chamberFace: 'literary', fontSize: 'medium',
            wordFill: 'plain', colorTheme: 'classic', textColor: 'classic',
            backgroundColor: 'classic', middleTheme: 'amethyst', finaleTheme: 'prism',
            projection: 'stream', revealMode: 'instant'
        };
        const input = await resolveJevReading({
            schemaVersion: 2, requestId: 'current-contract',
            model: 'typesafe/jev-1.13', reason: 'A reviewed catalog description.',
            workId: released.workId,
            editionId: released.editionId,
            sourceRevision: released.sourceRevision,
            config: {
                ...selectors, colors: jevPalette('classic'),
                ...resolveJevChamberConfig(selectors),
                visualProgram: compileJevVisualProgram(selectors),
                audioProgram: compileJevAudioProgram(selectors)
            }
        });
        expect(contractViolations(compileSession({ ...input, title: input.textSource }))).toEqual([]);
    }, 120_000);
});

describe('the same reading through two entrances is the same Current', () => {
    it('a direct config and a Workshop project of it read identically', () => {
        const direct = compileSession({
            title: 'Same', text: TEXT, wpm: 300, chunkMode: 'phrase', curve: 'flat',
            sourceId: 'source-1', textSource: 'Source', visualConfig: { visualMode: 'off' }
        });
        const project = compileSession(workshopProjectToSessionConfig({
            id: 'blueprint-1', title: 'Same', intent: 'custom',
            sources: [{ id: 'source-1', name: 'Source', providerId: 'local', type: 'text/plain', data: TEXT }],
            wpm: 300, paceV2: true, chunkMode: 'phrase', curve: 'flat',
            displayMode: 'focal', soundscape: 'none', audioPreset: 'silent',
            visualConfig: { visualMode: 'off' }
        }));
        expect(readingSignature(project)).toBe(readingSignature(direct));
    });
});
