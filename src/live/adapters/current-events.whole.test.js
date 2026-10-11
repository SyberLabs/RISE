/**
 * Every Current the Worker admits reaches the card's reducer whole.
 *
 * A stored card re-opened in the chat plays the Current the Worker's
 * `rise_present` accepted. The card lowers it to events (current-events.js),
 * hands them to the runtime through the MCP adapter, and the reducer
 * (stream.js) is what the voice is given words from. So whatever the door
 * admits, the reducer must take without a single refusal, and every beat must
 * arrive with all its characters. These Currents cover the whole admitted
 * surface: the guide's worked Currents, the Sky field fixture, the streamed
 * black-holes Current, a v1 Current, and two synthetic ones that use every
 * field a rise.current.v2 may carry, at its bounds, with every native engine,
 * a generated scene and a multi-kilobyte figure.
 */
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../worker/mcp-server.mjs';
import { SOUND_IDS } from '../../audio/sound-ids.js';
import { BEAT_LIMITS, BEAT_PLACES, BEAT_SIZES, BEAT_TYPES } from '../../core/beats.js';
import { RISE_CURRENT_THEME_IDS, validateRiseCurrent } from '../../core/rise-current.js';
import { SCENE_MANIFESTS } from '../../scenes/manifests.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';
import { createRealClock } from '../clock.js';
import { BLACK_HOLES_BEATS_CURRENT } from '../fixtures/black-holes-beats.js';
import { SKY_PREMIUM_EDUCATIONAL } from '../fixtures/sky-premium-educational.js';
import { STYLE_EXAMPLES, TOOL_NAME } from '../guide/index.js';
import { createCurrentStream } from '../stream.js';
import { currentToEvents } from './current-events.js';
import { createMcpAppAdapter } from './mcp-app.js';

const ORIGIN = Object.freeze({ kind: 'model', name: 'Claude', provider: 'Anthropic' });

/** A potato's outline: a lumpy closed curve of `points` points, written to two decimals. */
function potato(cx, cy, rx, ry, seed, points = 48) {
    const at = [];
    for (let i = 0; i < points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const lump = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.cos(a * 5 + seed * 2);
        at.push(`${(cx + Math.cos(a) * rx * lump).toFixed(2)} ${(cy + Math.sin(a) * ry * lump).toFixed(2)}`);
    }
    return `M ${at[0]} L ${at.slice(1).join(' L ')} Z`;
}

const COLOURS = ['#c9a36b', '#7a3b5c', '#d8c27a', '#a0522d', '#e3d3a8', '#5b3a6e', '#b5651d', '#f0e0b0'];

/** The owner's figure, as near as it can be told: eight potato outlines and a caption, in many kilobytes. */
const POTATOES_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">',
    '  <defs><radialGradient id="skin"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>',
    ...COLOURS.map((colour, index) => {
        const cx = 100 + (index % 4) * 200;
        const cy = 120 + Math.floor(index / 4) * 170;
        const eyes = [0, 1, 2, 3, 4].map(eye => `<circle cx="${cx - 30 + eye * 15}" cy="${cy + ((eye * 7) % 11) - 5}" r="2.5" fill="#3b2a1a" fill-opacity="0.7"/>`).join('');
        return `  <g><path d="${potato(cx, cy, 70 - index * 3, 45 + index * 2, index)}" fill="${colour}" stroke="#2b1d10" stroke-width="2"/><path d="${potato(cx, cy, 60 - index * 3, 38 + index * 2, index + 1, 24)}" fill="url(#skin)"/>${eyes}</g>`;
    }),
    '  <text x="400" y="430" text-anchor="middle" font-size="22">Thousands of kinds, in every colour and shape</text>',
    '</svg>'
].join('\n');

/** A generated scene with a table that makes its module larger than one piece of source. */
const SCENE_CODE = [
    `const TABLE = [${Array.from({ length: 400 }, (_, i) => (Math.sin(i) * 100).toFixed(3)).join(', ')}];`,
    'export default function scene(rise) {',
    '  let k = 0;',
    '  return { frame() { rise.lib.clear(); k = (k + 1) % TABLE.length; }, cue(name) { if (name === "spin") k = 0; } };',
    '}',
    ''
].join('\n');

/** A native scene with every parameter of its engine at a bound: an enum's last value, a number's maximum. */
function nativeScene(manifest) {
    const params = {};
    for (const [name, spec] of Object.entries(manifest.parameters)) params[name] = spec.type === 'enum' ? spec.values.at(-1) : spec.maximum;
    return { id: `scene-${manifest.id}`, engine: manifest.id, ...(Object.keys(params).length ? { params } : {}) };
}

/** The cues a native scene takes: its named ones and a `set:` on each parameter it changes as it runs. */
function cuesFor(manifest) {
    const named = Object.keys(manifest.cues);
    const settable = Object.entries(manifest.parameters).filter(([, spec]) => spec.cueable).map(([name, spec]) => `set:${name}=${spec.minimum}`);
    return [...named, ...settable];
}

/**
 * A Current that uses every field rise.current.v2 allows, on 64 beats over 8 scenes: native engines with their
 * parameters at their bounds, a generated scene and a figure; said beats, said-and-shown, shown with a hold, holds
 * with and without maxMs; cues named and `set:`; every place, size, face and sound; transitions; emphasis.
 */
function everything(natives, id) {
    const scenes = [...natives.map(nativeScene), { id: 'scene-code', code: SCENE_CODE }, { id: 'scene-figure', svg: POTATOES_SVG }];
    const manifests = new Map(natives.map(manifest => [`scene-${manifest.id}`, manifest]));
    const sounds = Object.values(SOUND_IDS).flat();
    const beats = [{ show: 'Potatoes, before any picture.', hold: { ms: BEAT_LIMITS.holdMinMs } }];
    let running = null;
    for (let i = 1; beats.length < BEAT_LIMITS.beats; i += 1) {
        const n = beats.length;
        const beat = {};
        // A scene starts every eighth beat, in the order declared.
        if (n % 8 === 1) {
            running = scenes[Math.floor(n / 8) % scenes.length].id;
            beat.scene = running;
            beat.transition = { ms: n % 16 === 1 ? BEAT_LIMITS.transitionMaxMs : 0 };
        }
        const kind = n % 4;
        if (kind === 0) beat.hold = n % 8 === 0 ? { ms: 1200, maxMs: BEAT_LIMITS.holdMaxMs } : { ms: 900 };
        else if (kind === 1) beat.say = `Beat ${n} says something about potatoes, and the voice says all of it.`;
        else if (kind === 2) { beat.say = `Beat ${n}: x squared over two.`; beat.show = `Beat ${n}: x² / 2`; }
        else { beat.show = `Beat ${n} is shown, not said.`; beat.hold = { ms: 1500 }; }
        if (kind !== 0) {
            beat.place = BEAT_PLACES[n % BEAT_PLACES.length];
            beat.size = BEAT_SIZES[n % BEAT_SIZES.length];
            beat.type = BEAT_TYPES[n % BEAT_TYPES.length];
            beat.emphasis = ['potatoes', 'voice'].slice(0, 1 + (n % 2));
        }
        beat.sound = sounds[n % sounds.length];
        const manifest = manifests.get(running);
        const cues = running === 'scene-code' ? ['spin'] : manifest ? cuesFor(manifest) : [];
        if (cues.length && n % 8 !== 1) beat.cue = cues[n % cues.length];
        beats.push(beat);
    }
    return {
        schema: 'rise.current.v2', id, title: 'Potatoes, every kind', theme: RISE_CURRENT_THEME_IDS[0], look: 'gallery',
        style: 'premium-educational', type: { text: BEAT_TYPES[0], caption: BEAT_TYPES.at(-1) }, origin: ORIGIN, scenes, beats
    };
}

const natives = SCENE_MANIFESTS;
const ADMITTED = [
    ...Object.values(STYLE_EXAMPLES).flat().map(({ current }) => [current.id, current]),
    ['the Sky field fixture', SKY_PREMIUM_EDUCATIONAL],
    ['the streamed black holes', { schema: 'rise.current.v2', id: 'black-holes-beats', title: 'Black holes', origin: ORIGIN, ...BLACK_HOLES_BEATS_CURRENT }],
    ['a v1 Current', BLACK_HOLES_CURRENT],
    ['everything, first six engines', everything(natives.slice(0, 6), 'everything-a')],
    ['everything, the other engines', everything(natives.slice(6), 'everything-b')]
];

/** The Worker's own door: rise_present, as a host's model calls it. */
async function present(current) {
    const response = dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { current } } }, 'https://rise.invalid');
    const { result, error } = await response.json();
    expect(error).toBeUndefined();
    return result;
}

/** The card's path: the events the card made of the Current, through the MCP adapter, into the runtime's reducer. */
async function throughTheCard(current) {
    const adapter = createMcpAppAdapter({
        port: { onCurrent: () => () => {} }, clock: createRealClock(),
        admittedEvents: currentToEvents(current), admittedCurrent: current
    });
    const connection = await adapter.open({ intent: 'answer', prompt: 'The answer the assistant presents' });
    const stream = createCurrentStream({ admitScene: adapter.admitScene ?? null });
    const refused = [];
    for await (const event of connection.events) {
        const result = stream.apply(event);
        if (result.status !== 'applied') refused.push({ type: event.type, id: event.segmentId ?? event.sceneId, code: result.code });
    }
    return { stream, refused };
}

describe('a Current the Worker admits, lowered for the card', () => {
    it('the synthetic Currents are as large as a Current may be, and the figure is many kilobytes', () => {
        const [a, b] = ADMITTED.slice(-2).map(([, current]) => current);
        expect(a.beats).toHaveLength(BEAT_LIMITS.beats);
        expect(a.scenes).toHaveLength(BEAT_LIMITS.scenes);
        expect(b.scenes.map(scene => scene.engine ?? scene.id)).toEqual([...natives.slice(6).map(manifest => manifest.id), 'scene-code', 'scene-figure']);
        expect(POTATOES_SVG.length).toBeGreaterThan(8_000);
        expect(SCENE_CODE.length).toBeGreaterThan(2_000);
    });

    it.each(ADMITTED)('%s: the Worker accepts it, the reducer refuses nothing, and every beat arrives with all its words', async (_name, current) => {
        const accepted = await present(current);
        expect(accepted.isError, accepted.content?.map(item => item.text).join('\n')).not.toBe(true);

        const { stream, refused } = await throughTheCard(accepted.structuredContent.current);
        expect(refused).toEqual([]);
        const snapshot = stream.snapshot();
        expect(snapshot.refusals).toBe(0);
        expect(snapshot.phase).toBe('complete');
        expect(stream.refusedScenes).toEqual([]);

        // What plays is what was admitted: the reducer's Current lowers to the same passages, words and all. A stream
        // carries no style and no Current-wide type (they ride on the sealed Current the card compiles), so they are
        // put back to compare like with like.
        const sealed = validateRiseCurrent(current);
        const { style, type } = current;
        const read = validateRiseCurrent({ ...stream.toCurrent(), ...(style ? { style } : {}), ...(type ? { type } : {}) });
        expect(read.segments).toEqual(sealed.segments);
        const words = new Map(snapshot.segments.map(segment => [segment.id, segment.text]));
        for (const segment of sealed.segments) {
            const said = segment.spoken ?? (segment.hold ? '' : segment.text);
            expect(words.get(segment.id), segment.id).toBe(said);
        }
    });
});
