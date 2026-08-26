/**
 * THE PORT'S BLIND SPOT, CLOSED.
 *
 * The Visual Navigator replaced a 2,147-line panel against a written parity
 * ledger, and everything ON that ledger arrived: Cadence is a real control,
 * Living Text a real checkbox, the program lock runs through forty branches.
 * One capability did not, and the way it went missing is the point.
 *
 * `streamGlass` was a line in the config, not a heading in the panel. The
 * ledger enumerated CONCERNS, gathered by reading the old panel's surface, so
 * glass was never entered — and what is never entered is never answered for.
 * It stayed live the whole time: honoured by the Chamber, carried by the
 * compiler, set to true by a Stance, and reachable by no reader.
 *
 * A hand-built inventory can miss a key. This one is generated from the
 * compiler itself: every setting the compiler honours must be either
 * reachable in the Navigator or recorded here as deliberately fixed, with the
 * reason. Adding a setting to the compiler and no control now fails a test
 * rather than shipping a switch nobody can reach.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectionFromConfig, configPatch } from './visual-taxonomy-config.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = rel => readFileSync(join(here, rel), 'utf8');

function navigatorSource() {
    const shell = read('../components/VisualNavigator.js');
    const dir = join(here, '../components/visual-navigator');
    const parts = [shell];
    for (const file of readdirSync(dir).filter(name => name.endsWith('.js'))) {
        parts.push(readFileSync(join(dir, file), 'utf8'));
    }
    return parts.join('\n');
}

/**
 * Every `interlocution` key the session compiler writes, read from the
 * compiler rather than remembered, so the list cannot drift out of date.
 */
function compiledInterlocutionKeys() {
    const source = read('session-compiler.js');
    const start = source.indexOf('interlocution: {');
    expect(start, 'the compiler no longer builds an interlocution block')
        .toBeGreaterThan(-1);

    const keys = new Set();
    let depth = 0;
    for (const line of source.slice(start).split('\n')) {
        for (const ch of line) {
            if (ch === '{') depth += 1;
            else if (ch === '}') depth -= 1;
        }
        const match = line.match(/^\s{12}([a-zA-Z][\w]*):/);
        if (match) keys.add(match[1]);
        if (depth <= 0) break;
    }
    return keys;
}

/**
 * The disposition of each honoured setting. `reachable` means a reader can
 * change it in the Navigator; `fixed` means it is deliberately not offered,
 * and says why. There is no third answer — that is the point of the file.
 */
const DISPOSITION = Object.freeze({
    streamGlass: 'reachable',        // the one glass switch, beside Living Text
    galleryCadence: 'reachable',     // Cadence, on the Gallery
    wordFill: 'reachable',           // the whole Ink pane
    presentation: 'reachable',       // carried by the field leaves
    atriumCollections: 'reachable',  // the reading collections tray
    globalPool: 'reachable',         // the shared pool, from the Personal leaf
    kleePreset: 'reachable',         // Genesis substyle bench

    // Deliberately fixed, each for a stated reason.
    renderLanguage: 'fixed',         // ASCII retired 2026-08-06; compiler normalises
    wordFillDeclared: 'fixed',       // provenance flag, not a setting
    frequency: 'fixed',              // flash economy; authored, not read-time
    duration: 'fixed',               // presence timing, derived from presentation
    responsive: 'fixed',             // reserved; no reader-facing behaviour yet
    responsiveMood: 'fixed',
    responsiveRhythm: 'fixed'
});

describe('every honoured visual setting is reachable or recorded', () => {
    it('the compiler introduces no setting this register has not answered for', () => {
        const missing = [...compiledInterlocutionKeys()]
            .filter(key => !(key in DISPOSITION));
        expect(missing, `session-compiler honours ${missing.join(', ')} — give each a `
            + 'control in the Navigator, or record it as fixed with a reason')
            .toEqual([]);
    });

    it('the register names nothing the compiler has stopped honouring', () => {
        const compiled = compiledInterlocutionKeys();
        const stale = Object.keys(DISPOSITION).filter(key => !compiled.has(key));
        expect(stale, `no longer compiled: ${stale.join(', ')}`).toEqual([]);
    });

    it('every reachable setting survives a round trip through the selection', () => {
        // A control that cannot carry its value back out is not reachable.
        const patched = configPatch(selectionFromConfig({
            visualMode: 'interlocution',
            interlocution: { streamGlass: false }
        }));
        expect(patched.interlocution.streamGlass).toBe(false);

        const restored = configPatch(selectionFromConfig({
            visualMode: 'interlocution',
            interlocution: { streamGlass: true }
        }));
        expect(restored.interlocution.streamGlass).toBe(true);
    });

    it('glass is offered by the Navigator, not merely honoured by the engine', () => {
        // The specific regression: alive everywhere except where a hand could
        // reach it.
        const navigator = navigatorSource();
        // One control, whichever field holds the glass — see _glassOwner.
        expect(navigator).toMatch(/data-action="glass"/);
        expect(navigator).toMatch(/setGlass/);
        expect(navigator).toMatch(/_glassOwner/);
    });
});
