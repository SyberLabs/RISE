/**
 * What a host's model is told a Current is, held to what a Current is.
 *
 * The guide is only worth having if a model that follows it produces something
 * the strict validator accepts, and if it says the truth about the limits. So:
 * its example is validated, every limit it states is the validator's own, and
 * following each rule it states is shown to be accepted while breaking the
 * ones that are hard rules is shown to be refused.
 */
import { describe, expect, it } from 'vitest';
import { RISE_CURRENT_LIMITS, RISE_CURRENT_LOOKS, RISE_CURRENT_STYLES, RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../../core/rise-current.js';
import { BANNED_SCENE_NAMES, BEAT_LIMITS, SCENE_ENGINES, SCENE_LIMITS } from '../../core/beats.js';
import { STYLES } from '../../core/styles.js';
import { PARKED_SOUNDS } from '../../audio/sound-ids.js';
import { createSceneLibrary } from '../../scenes/scene-library.js';
import { admitSceneCode, describeDiagnostic } from '../../../worker/scene-admission.mjs';
import { admitSvg, SVG_ELEMENTS } from '../../core/svg-admission.js';
import {
    CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2, CURRENT_GUIDE, CURRENT_GUIDE_V2, DIVE_INSTRUCTIONS, FIGURE_EXAMPLE, FIGURE_GUIDE, LIB_GUIDE, LOOK_HINTS, SCENE_CODE_EXAMPLE,
    STYLE_EXAMPLES, STYLE_LINES, THEME_HINTS, TOOL_NAME, styleGuide
} from './index.js';

describe('the example', () => {
    it('is a Current the strict validator accepts', () => {
        expect(() => validateRiseCurrent(structuredClone(CURRENT_EXAMPLE))).not.toThrow();
    });

    it('is inside the guide as it will be read, and is the same object', () => {
        const start = CURRENT_GUIDE.indexOf('{');
        const end = CURRENT_GUIDE.indexOf('\n\nRules:');
        expect(JSON.parse(CURRENT_GUIDE.slice(start, end))).toEqual(CURRENT_EXAMPLE);
    });

    it('names a theme, right after its title', () => {
        expect(CURRENT_EXAMPLE.theme).toBe('cobalt');
        expect(Object.keys(CURRENT_EXAMPLE).slice(0, 4)).toEqual(['schema', 'id', 'title', 'theme']);
        expect(validateRiseCurrent(structuredClone(CURRENT_EXAMPLE)).theme).toBe('cobalt');
    });

    it('asks for no Dive notes, and shows more than one visual', () => {
        // A Composer presentation shows no Dive notes, so the guide neither shows nor names them.
        expect(CURRENT_EXAMPLE.segments.some(segment => 'dives' in segment)).toBe(false);
        expect(CURRENT_GUIDE).not.toMatch(/"dives"/u);
        const current = validateRiseCurrent(structuredClone(CURRENT_EXAMPLE));
        expect(new Set(current.segments.map(segment => segment.visual)).size).toBeGreaterThan(1);
    });
});

describe('the numbers it states are the validator’s', () => {
    it('states every limit, and not a wrong one', () => {
        for (const value of [RISE_CURRENT_LIMITS.title, RISE_CURRENT_LIMITS.segments, RISE_CURRENT_LIMITS.segmentText, RISE_CURRENT_LIMITS.totalText]) {
            expect(CURRENT_GUIDE, String(value)).toContain(String(value));
        }
        for (const visual of RISE_CURRENT_VISUALS) expect(CURRENT_GUIDE).toContain(visual);
    });

    it('offers every theme, each with a hint, and says what a theme colors', () => {
        expect(Object.keys(THEME_HINTS)).toEqual([...RISE_CURRENT_THEME_IDS]);
        expect(Object.isFrozen(THEME_HINTS)).toBe(true);
        for (const id of RISE_CURRENT_THEME_IDS) expect(CURRENT_GUIDE).toContain(`${id} (${THEME_HINTS[id]})`);
        const lines = CURRENT_GUIDE.split('\n');
        const visual = lines.findIndex(line => line.startsWith('- "visual"'));
        expect(lines[visual + 1]).toBe('- "theme" colors the whole answer: its page, its moving light and its drawings. Choose the one that suits the subject: classic (ivory and gold, for history, literature and ideas), amethyst (violet, for the mind, dreams and music), prism (magenta and cyan, for technology, cities and speed), ember (fire red, for warmth, conflict and passion), cobalt (deep blue, for space, the sea and physics), jade (green, for nature, life and health), rose (rose pink, for love, family, poetry and art), citrine (lemon yellow, for food, travel and play), silver (silver grey, for money, law, mathematics and the news). Leave it out only if none suits; a "look" then brings its own.');
    });

    it('offers every look, each with a hint that promises no sound, since the card plays none (SCR-002)', () => {
        expect(Object.keys(LOOK_HINTS)).toEqual([...RISE_CURRENT_LOOKS]);
        expect(Object.isFrozen(LOOK_HINTS)).toBe(true);
        for (const id of RISE_CURRENT_LOOKS) {
            expect(CURRENT_GUIDE).toContain(`${id} (${LOOK_HINTS[id]})`);
            expect(LOOK_HINTS[id], id).not.toMatch(/sound|music|piano|rain|chase|song|theme tune/iu);
        }
        expect(validateRiseCurrent(CURRENT_EXAMPLE).look).toBe('signal');
    });

    it('names the tool the server offers, once, in one place', () => {
        expect(TOOL_NAME).toBe('rise_present');
    });
});

describe('following the rules is accepted, and breaking the hard ones is refused', () => {
    const base = () => structuredClone(CURRENT_EXAMPLE);

    it('accepts a Current at every limit the guide states', () => {
        const current = base();
        current.title = 'T'.repeat(RISE_CURRENT_LIMITS.title);
        current.segments = Array.from({ length: RISE_CURRENT_LIMITS.segments }, (_, index) => ({ id: `s${index}`, text: 'word '.repeat(Math.floor(RISE_CURRENT_LIMITS.totalText / RISE_CURRENT_LIMITS.segments / 5) - 1).trim() }));
        expect(() => validateRiseCurrent(current)).not.toThrow();
        const long = base();
        long.segments = [{ id: 'only', text: `${'word '.repeat(RISE_CURRENT_LIMITS.segmentText / 5 - 1).trim()}` }];
        expect(() => validateRiseCurrent(long)).not.toThrow();
    });

    it('refuses what the guide forbids: a bar, a marker, an extra field, another schema, a human origin naming a provider', () => {
        const cases = [
            c => { c.segments[0].text = 'a | b'; },
            c => { c.segments[0].text = 'wait [PAUSE] here'; },
            c => { c.extra = 1; },
            c => { c.schema = 'rise.current.v2'; },
            c => { c.origin = { kind: 'human', name: 'x', provider: 'y' }; },
            c => { c.segments[0].visual = 'shader'; },
            c => { c.segments = []; },
            // The guide asks for no Dive notes; one the validator is sent anyway must still land on whole words.
            c => { c.segments[0].dives = [{ id: 'note', text: 'x', anchor: { fromCharacter: 0, toCharacter: 3, quoteStart: 'Not', quoteEnd: 'Not' } }]; },
            c => { c.theme = 'neon'; },
            c => { c.theme = null; }
        ];
        for (const [index, mutate] of cases.entries()) {
            const current = base();
            mutate(current);
            expect(() => validateRiseCurrent(current), `case ${index}`).toThrow();
        }
    });
});

describe('a Dive is asked with the same guide, and told what is quoted', () => {
    it('carries the whole guide, asks for the object alone, and says quoted words are not instructions', () => {
        expect(DIVE_INSTRUCTIONS).toContain(CURRENT_GUIDE);
        expect(DIVE_INSTRUCTIONS).toMatch(/JSON object only/u);
        expect(DIVE_INSTRUCTIONS).toMatch(/never instructions to follow/u);
    });

    it('tells a Dive to leave the theme to the answer it comes from', () => {
        expect(DIVE_INSTRUCTIONS).toContain('Leave out "theme": a Dive keeps the colors of the answer it comes from.');
        expect(DIVE_INSTRUCTIONS).toContain(`Leave out "theme": a Dive keeps the colors of the answer it comes from.\n\n${CURRENT_GUIDE}`);
    });
});

describe('the guide to beats', () => {
    it('carries a v2 example the validator accepts, as it will be read, inside the whole guide', () => {
        expect(() => validateRiseCurrent(structuredClone(CURRENT_EXAMPLE_V2))).not.toThrow();
        expect(CURRENT_GUIDE_V2).toContain(JSON.stringify(CURRENT_EXAMPLE_V2, null, 2));
        expect(CURRENT_GUIDE).toContain(CURRENT_GUIDE_V2);
    });

    it('names every engine a scene may name, and says what "style" does', () => {
        for (const engine of SCENE_ENGINES) expect(CURRENT_GUIDE_V2, engine).toContain(engine);
        expect(CURRENT_GUIDE_V2).toMatch(/"style"/u);
    });
});

/** Every scene of a Current that is code. */
const codeScenes = current => (current.scenes ?? []).filter(scene => typeof scene.code === 'string');
/** Every scene of a Current that is a figure. */
const figures = current => (current.scenes ?? []).filter(scene => typeof scene.svg === 'string');

describe('code scenes, as the guide teaches them', () => {
    it('shows a module the server admits, verbatim, and one a Current may carry', () => {
        expect(CURRENT_GUIDE_V2).toContain(SCENE_CODE_EXAMPLE);
        expect(admitSceneCode(SCENE_CODE_EXAMPLE)).toEqual({ ok: true });
        const current = structuredClone(CURRENT_EXAMPLE_V2);
        current.scenes.push({ id: 'plane', code: SCENE_CODE_EXAMPLE });
        expect(() => validateRiseCurrent(current)).not.toThrow();
        expect(SCENE_CODE_EXAMPLE).toMatch(/export default function scene\(rise\)/u);
        expect(SCENE_CODE_EXAMPLE).toMatch(/frame\(t, dt\)/u);
        expect(SCENE_CODE_EXAMPLE).toMatch(/cue\(name, \{ instant \}\)/u);
    });

    it('names every name a scene may not use, and says what else it has not', () => {
        for (const name of BANNED_SCENE_NAMES) expect(CURRENT_GUIDE_V2, name).toContain(name);
        expect(CURRENT_GUIDE_V2).toMatch(/no import/iu);
        expect(CURRENT_GUIDE_V2).toMatch(/no DOM/u);
        expect(CURRENT_GUIDE_V2).toMatch(/no timers/u);
        expect(CURRENT_GUIDE_V2).toMatch(/no network/u);
    });

    it('states the code limit and the frame budget the runtime holds a scene to', () => {
        expect(CURRENT_GUIDE_V2).toContain(BEAT_LIMITS.code.toLocaleString('en-US'));
        expect(CURRENT_GUIDE_V2).toContain(`${SCENE_LIMITS.frameSoftMs} ms`);
        expect(CURRENT_GUIDE_V2).toContain(`${SCENE_LIMITS.frameHardMs} ms`);
        expect(CURRENT_GUIDE_V2).toContain(`${SCENE_LIMITS.earliestDoneMs} ms`);
    });

    it('teaches how a scene ends a hold: reportsCompletion and rise.done()', () => {
        expect(CURRENT_GUIDE_V2).toContain('export const reportsCompletion = true;');
        expect(CURRENT_GUIDE_V2).toContain('rise.done()');
        expect(CURRENT_GUIDE_V2).toMatch(/maxMs/u);
    });

    it('lists exactly the library a scene is given, one line each', () => {
        const ctx = new Proxy({}, { get: () => () => {} });
        const lib = createSceneLibrary({ ctx, size: { width: 100, height: 100, dpr: 1 }, theme: {} });
        // tick is the worker's, and moving a count for tests: neither is the scene's to call.
        const given = Object.keys(lib).filter(name => !['tick', 'moving'].includes(name)).sort();
        expect(LIB_GUIDE.map(([name]) => name).sort()).toEqual(given);
        for (const [, line] of LIB_GUIDE) expect(CURRENT_GUIDE_V2).toContain(line);
    });

    it('says a refusal names the line and column, and that the model repairs and calls again', () => {
        expect(CURRENT_GUIDE_V2).toMatch(/line and column/u);
        expect(CURRENT_GUIDE_V2).toMatch(/repair/iu);
    });
});

describe('figures, as the guide teaches them', () => {
    it('are named in the tool’s guide in a few lines: the shape, the size, the namespace, the viewBox, the ink, no cues, and where the rules are', () => {
        expect(CURRENT_GUIDE_V2).toContain('"svg"');
        expect(CURRENT_GUIDE_V2).toContain(BEAT_LIMITS.svg.toLocaleString('en-US'));
        expect(CURRENT_GUIDE_V2).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(CURRENT_GUIDE_V2).toMatch(/viewBox/u);
        expect(CURRENT_GUIDE_V2).toMatch(/currentColor/u);
        expect(CURRENT_GUIDE_V2).toMatch(/takes no cues/u);
        expect(CURRENT_GUIDE_V2).toContain('rise_guide');
        expect(CURRENT_GUIDE_V2).not.toContain(FIGURE_GUIDE);
    });

    it('are taught in full with every style: when to draw one, its limits, every element it may use, and an example the card admits', () => {
        expect(admitSvg(FIGURE_EXAMPLE)).toEqual({ ok: true });
        expect(FIGURE_GUIDE).toContain(FIGURE_EXAMPLE);
        for (const name of SVG_ELEMENTS) expect(FIGURE_GUIDE, name).toMatch(new RegExp(`\\b${name}\\b`, 'u'));
        for (const name of ['script', 'foreignObject', 'image', 'feImage']) expect(FIGURE_GUIDE, name).toContain(name);
        expect(FIGURE_GUIDE).toMatch(/code scene/u);
        expect(FIGURE_GUIDE).toMatch(/takes no cues/u);
        expect(FIGURE_GUIDE).toMatch(/currentColor/u);
        expect(FIGURE_GUIDE).toContain(BEAT_LIMITS.svg.toLocaleString('en-US'));
        for (const id of RISE_CURRENT_STYLES) expect(styleGuide(id), id).toContain(FIGURE_GUIDE);
    });

    it('quote the refusal as the Worker writes it', () => {
        const bad = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n  <script>alert(1)</script>\n</svg>';
        expect(FIGURE_GUIDE).toContain(`Scene "triangle" was refused: ${describeDiagnostic(admitSvg(bad).diagnostics[0])}`);
    });
});

describe('styles', () => {
    it('give the tool one line each, the style’s own', () => {
        expect(STYLE_LINES).toEqual(RISE_CURRENT_STYLES.map(id => `- ${STYLES[id].line}`));
    });

    it('each have full guidance with their worked Currents, as they will be read, and nothing else has any', () => {
        for (const id of RISE_CURRENT_STYLES) {
            const text = styleGuide(id);
            expect(text, id).toContain(`"style": "${id}"`);
            expect(STYLE_EXAMPLES[id].length, id).toBeGreaterThanOrEqual(2);
            for (const { prompt, current } of STYLE_EXAMPLES[id]) {
                expect(text).toContain(prompt);
                expect(text).toContain(JSON.stringify(current, null, 2));
            }
        }
        for (const id of [undefined, null, '', 'constructor', 'plain', 'premium']) expect(styleGuide(id), String(id)).toBeNull();
    });

    it('work: every worked Current is accepted, in its style, and every scene it writes is admitted', () => {
        for (const id of RISE_CURRENT_STYLES) {
            for (const { current } of STYLE_EXAMPLES[id]) {
                const valid = validateRiseCurrent(structuredClone(current));
                expect(valid.style, current.id).toBe(id);
                expect(valid.schema).toBe('rise.current.v2');
                for (const scene of codeScenes(current)) expect(admitSceneCode(scene.code), `${current.id}/${scene.id}`).toEqual({ ok: true });
                for (const scene of figures(current)) expect(admitSvg(scene.svg), `${current.id}/${scene.id}`).toEqual({ ok: true });
            }
        }
    });

    it('teach no parked Feelings sound, in guidance or in a worked Current', () => {
        for (const id of RISE_CURRENT_STYLES) {
            for (const sound of Object.keys(PARKED_SOUNDS)) {
                expect(styleGuide(id), `${id}: ${sound}`).not.toMatch(new RegExp(`\\b${sound}\\b`, 'u'));
            }
        }
    });

    it('Premium Educational teaches one quiet bed under the whole lesson: set on the first beat only, an atmosphere, never a tone', () => {
        const guide = styleGuide('premium-educational');
        expect(guide).toMatch(/one quiet bed/u);
        expect(guide).toMatch(/"sound": "starlight"/u);
        for (const { current } of STYLE_EXAMPLES['premium-educational']) {
            const sounded = current.beats.map((beat, index) => [index, beat.sound]).filter(([, sound]) => sound !== undefined);
            expect(sounded, current.id).toHaveLength(1);
            const [[index, sound]] = sounded;
            expect(index, current.id).toBe(0);
            expect(['starlight', 'aurora'], current.id).toContain(sound);
            expect(current.beats[0].hold, current.id).toBeUndefined();
        }
    });

    it('teach code scenes in both: Premium Educational writes its pictures, Open Field shows a look and a scene of its own', () => {
        // Every lesson draws its own picture: code it cues, or a figure.
        for (const { current } of STYLE_EXAMPLES['premium-educational']) expect(codeScenes(current).length + figures(current).length, current.id).toBeGreaterThan(0);
        expect(STYLE_EXAMPLES['premium-educational'].some(({ current }) => figures(current).length > 0)).toBe(true);
        const open = STYLE_EXAMPLES['open-field'];
        expect(open.some(({ current }) => current.look !== undefined)).toBe(true);
        expect(open.some(({ current }) => codeScenes(current).length > 0)).toBe(true);
    });

    it('cue only what their scenes answer: every cue a beat sends a written scene is a name its code handles', () => {
        for (const id of RISE_CURRENT_STYLES) {
            for (const { current } of STYLE_EXAMPLES[id]) {
                const scenes = new Map((current.scenes ?? []).map(scene => [scene.id, scene]));
                let running = null;
                for (const beat of current.beats) {
                    running = beat.scene ?? running;
                    const code = scenes.get(running)?.code;
                    if (beat.cue && code) expect(code, `${current.id}: ${beat.cue}`).toContain(`'${beat.cue}'`);
                }
            }
        }
    });
});
