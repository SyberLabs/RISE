/**
 * LIVE-001: what a host model writes is what the reader is given.
 *
 * A Current's text, its source coordinates, its theme and each passage's visual survive
 * Current → Experience Program → Session → the live Player. rise-current.test.js already holds the
 * program's cues for every theme and the wrapper against a direct compile; player.live.test.js holds
 * each atom presented once and in order on an unthemed, unvisualled Current. This file holds what they
 * leave open, on a Current that uses every visual, a literal passage, text outside ASCII and a span.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { compileRiseCurrent, RISE_CURRENT_THEME_IDS, RISE_CURRENT_THEMES, validateRiseCurrent } from '../core/rise-current.js';
import { cueForAtom } from '../core/visual-scheduler.js';
import { jevColors } from '../core/jev-palette.js';

const LONG = 'When a sentence runs on past what one breath can carry, through clause after clause and turn after turn, '
    + 'the compiler splits it into pieces the reader can take in, and every word it had must still be there at the end.';
const SPAN_TEXT = 'Its boundary is called the event horizon. It is not a surface you could touch.';
const SPAN = { fromCharacter: SPAN_TEXT.indexOf('event'), toCharacter: SPAN_TEXT.indexOf('horizon.') + 'horizon.'.length, quoteStart: 'event', quoteEnd: 'horizon.' };

const CURRENT = Object.freeze({
    schema: 'rise.current.v1',
    id: 'parity',
    title: 'Parity',
    origin: { kind: 'model', name: 'Scripted answer', provider: 'mock' },
    segments: [
        { id: 'opening', text: 'Light bends.', visual: 'attractor' },
        { id: 'long', text: LONG, visual: 'genesis' },
        { id: 'span', text: SPAN_TEXT, visual: 'still', dives: [{ id: 'note', text: 'A note.', anchor: SPAN }] },
        { id: 'world', text: 'Café naïve — “quoted” 界は広い 🌊 and Ωmega.', visual: 'attractor' },
        { id: 'literal', text: 'Read [PAUSE] and a | bar as words.', visual: 'genesis', literal: true },
        { id: 'close', text: 'That is all. It ends here.' }
    ]
});

const prefix = (count, theme) => ({
    ...CURRENT,
    ...(theme ? { theme } : {}),
    segments: CURRENT.segments.slice(0, count).map(segment => ({ ...segment }))
});
const words = text => text.split(/\s+/u).filter(Boolean);
const withoutId = ({ id, ...atom }) => atom;
const segmentAtoms = (session, segmentId) => session.atoms.filter(atom => atom.sourceId === segmentId);

/** The cue a passage asked for, as the theme's table draws it. */
function expectedCue(segment, theme) {
    const visual = segment.visual ?? 'still';
    if (visual === 'still') return { kind: 'still' };
    return { kind: 'field', renderer: visual, config: theme ? { ...RISE_CURRENT_THEMES[theme][visual] } : {} };
}

describe('Current → Session parity', () => {
    it('the fixture is a valid Current that compiles', () => {
        expect(() => validateRiseCurrent(CURRENT)).not.toThrow();
        expect(compileRiseCurrent(CURRENT).atoms.length).toBeGreaterThan(CURRENT.segments.length);
    });

    it('carries every word of each passage into its atoms, in order, and nothing else', () => {
        const session = compileRiseCurrent(CURRENT);
        for (const segment of CURRENT.segments) {
            expect(words(segmentAtoms(session, segment.id).map(atom => atom.content).join(' ')), segment.id)
                .toEqual(words(segment.text));
        }
        // Passages follow one another in the Current's order; anything between them has no words.
        const order = session.atoms.map(atom => atom.sourceId).filter(Boolean);
        expect([...new Set(order)]).toEqual(CURRENT.segments.map(segment => segment.id));
        expect(order).toEqual([...order].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
        const between = session.atoms.filter(atom => !CURRENT.segments.some(segment => segment.id === atom.sourceId));
        expect(between.flatMap(atom => words(atom.content ?? ''))).toEqual([]);
        // The sources are the passages verbatim, under their own ids.
        expect(session.sources.map(source => [source.id, session.sourceTexts.get(source.id)]))
            .toEqual(CURRENT.segments.map(segment => [segment.id, segment.text]));
    });

    it('anchors every movement and visual to its own passage, and keeps a span’s characters', () => {
        const { experienceProgram } = compileRiseCurrent(CURRENT);
        const [movements, visuals, threads] = experienceProgram.tracks;
        const ids = CURRENT.segments.map(segment => [segment.id]);
        expect(movements.clips.map(clip => clip.anchor.sourceIds)).toEqual(ids);
        expect(visuals.clips.map(clip => clip.anchor.sourceIds)).toEqual(ids);
        expect(threads.clips.map(clip => clip.anchor)).toEqual([
            { sourceIds: ['span'], ...SPAN }
        ]);
    });

    it('stamps each atom of a spanned passage with the characters it shows, tiling the passage in order', () => {
        const session = compileRiseCurrent(CURRENT);
        let cursor = 0;
        for (const atom of segmentAtoms(session, 'span')) {
            expect(atom.sourceCharacterStart).toBeGreaterThanOrEqual(cursor);
            expect(words(SPAN_TEXT.slice(atom.sourceCharacterStart, atom.sourceCharacterEnd))).toEqual(words(atom.content));
            cursor = atom.sourceCharacterEnd;
        }
        expect(SPAN_TEXT.slice(cursor).trim()).toBe('');
    });

    it('compiles the same Current to the same atoms every time, and each longer Current extends the shorter one unchanged', () => {
        for (const theme of [undefined, ...RISE_CURRENT_THEME_IDS]) {
            const full = compileRiseCurrent(prefix(CURRENT.segments.length, theme));
            expect(compileRiseCurrent(prefix(CURRENT.segments.length, theme)).atoms.map(withoutId), theme).toEqual(full.atoms.map(withoutId));
            for (let count = 1; count < CURRENT.segments.length; count += 1) {
                const shorter = compileRiseCurrent(prefix(count, theme)).atoms.map(withoutId);
                const longer = compileRiseCurrent(prefix(count + 1, theme)).atoms.map(withoutId);
                expect(longer.slice(0, shorter.length), `${theme} ${count}`).toEqual(shorter);
            }
        }
    });

    it('resolves every atom to the visual its own passage asked for, in each theme’s drawing, and the page to the theme’s colours', () => {
        for (const theme of [undefined, ...RISE_CURRENT_THEME_IDS]) {
            const session = compileRiseCurrent(prefix(CURRENT.segments.length, theme));
            for (const segment of CURRENT.segments) {
                for (const atom of segmentAtoms(session, segment.id)) {
                    expect(cueForAtom(session.visualProgram, atom).cue, `${theme} ${segment.id}`).toEqual(expectedCue(segment, theme));
                }
            }
            expect(session.presentation, theme).toEqual(theme ? { colorTheme: theme, colors: jevColors(theme) } : null);
        }
    });
});

describe('the live Player plays what was compiled', () => {
    let player;
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
                'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
        });
    });
    afterEach(() => {
        player?.destroy();
        player = null;
        vi.useRealTimers();
    });

    it('presents exactly the compiled atoms, once each and in order, as the Current grows passage by passage', async () => {
        const theme = 'cobalt';
        const sessions = CURRENT.segments.map((_, index) => compileRiseCurrent(prefix(index + 1, theme)));
        const shown = [];
        player = new Player(sessions[0]);
        player.setLive(true);
        player.on('atom', ({ atom, index, concealed }) => { if (!concealed) shown.push({ index, atom }); });
        let complete = 0;
        player.on('complete', () => { complete += 1; });
        player.play();
        await vi.advanceTimersByTimeAsync(60_000);
        for (const session of sessions.slice(1)) {
            player.extend(session);
            await vi.advanceTimersByTimeAsync(60_000);
        }
        player.setLive(false);
        await vi.advanceTimersByTimeAsync(60_000);

        const compiled = sessions.at(-1);
        expect(shown.map(({ index }) => index)).toEqual(compiled.atoms.map((_, index) => index));
        expect(shown.map(({ atom }) => withoutId(atom))).toEqual(compiled.atoms.map(withoutId));
        expect(complete).toBe(1);
        // What was presented carries its passage's visual intent.
        for (const { atom } of shown) {
            const segment = CURRENT.segments.find(item => item.id === atom.sourceId);
            if (segment) expect(cueForAtom(compiled.visualProgram, atom).cue, segment.id).toEqual(expectedCue(segment, theme));
        }
    });
});
