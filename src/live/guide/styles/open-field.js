/**
 * Open Field: free expression, the ten looks' guidance consolidated
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §11). The
 * guidance says how to write in the style; the two worked Currents are real
 * ones the validator accepts and whose scenes the server admits (held by
 * src/live/guide/index.test.js, and run headless by npm run eval:creative).
 */
import { RISE_CURRENT_LOOKS } from '../../../core/rise-current.js';
import { TYPE_ROLES } from '../../../core/typography.js';
import { LOOK_HINTS } from '../looks.js';

const ORIGIN = Object.freeze({ kind: 'model', name: 'Your name', provider: 'Who runs you' });

const SWARM_SCENE = [
    'export default function scene(rise) {',
    '  const { lib, size } = rise;',
    '  const state = { spread: 1, turn: 0, glow: 0.35 };',
    '  const count = 48;',
    '  return {',
    '    frame(t) {',
    '      lib.clear();',
    '      const ctx = rise.ctx;',
    '      const cx = size.width / 2;',
    '      const cy = size.height / 2;',
    '      const r = Math.min(size.width, size.height) * 0.32;',
    '      const drift = rise.reducedMotion ? 0 : t / 4000;',
    '      for (let i = 0; i < count; i += 1) {',
    '        const a = (i / count) * Math.PI * 2 + state.turn + drift;',
    '        const b = a * 3 + drift * 2;',
    '        const x = cx + Math.cos(a) * r * state.spread + Math.cos(b) * r * 0.25;',
    '        const y = cy + Math.sin(a) * r * state.spread + Math.sin(b) * r * 0.25;',
    '        ctx.globalAlpha = state.glow;',
    '        ctx.fillStyle = i % 3 === 0 ? lib.palette.highlight : lib.palette.accent;',
    '        ctx.beginPath();',
    '        ctx.arc(x * size.dpr, y * size.dpr, 3 * size.dpr, 0, Math.PI * 2);',
    '        ctx.fill();',
    '      }',
    '      ctx.globalAlpha = 1;',
    '    },',
    '    cue(name, { instant }) {',
    "      if (name === 'gather') return lib.tween(state, { spread: 0.25, glow: 0.9 }, { ms: 2400, instant });",
    "      if (name === 'open') return lib.tween(state, { spread: 1.2, turn: Math.PI, glow: 0.5 }, { ms: 3200, instant });",
    '    }',
    '  };',
    '}'
].join('\n');

export const EXAMPLES = Object.freeze([
    {
        prompt: 'Create your own RISE reading about the sea at night.',
        current: {
            schema: 'rise.current.v2',
            id: 'the-sea-at-night',
            title: 'The sea at night',
            theme: 'cobalt',
            look: 'nocturne',
            style: 'open-field',
            origin: ORIGIN,
            scenes: [
                { id: 'swell', engine: 'attractor', params: { system: 'thomas', palette: 'blue', speed: 0.5 } },
                { id: 'deep', engine: 'living-flame', params: { preset: 'glacial-silk', energy: 0.3 } }
            ],
            beats: [
                { say: 'At night the sea forgets its colour.', scene: 'swell', sound: 'soft-rain' },
                { hold: { ms: 3000 } },
                { say: 'It keeps only its motion, a long breath that never quite finishes.', cue: 'calm' },
                { show: 'listen', hold: { ms: 2000 }, size: 'display', type: 'display' },
                { say: 'Under the surface, slower still, something like a fire burns cold.', scene: 'deep', transition: { ms: 1500 } },
                { hold: { ms: 3500 }, cue: 'surge' },
                { say: 'By morning it will be blue again, and pretend it was always so.', place: 'caption', cue: 'calm' }
            ]
        }
    },
    {
        prompt: 'Express yourself: what is it like to have a thought?',
        current: {
            schema: 'rise.current.v2',
            id: 'a-thought-forming',
            title: 'A thought, forming',
            theme: 'amethyst',
            style: 'open-field',
            type: { text: 'display-serif' },
            origin: ORIGIN,
            scenes: [{ id: 'swarm', code: SWARM_SCENE }],
            beats: [
                { show: 'A thought, forming', hold: { ms: 2500 }, scene: 'swarm', size: 'display', sound: 'mystery' },
                { say: 'Before a thought has words, it is a scattering.', place: 'top', size: 'smaller' },
                { hold: { ms: 2500 } },
                { say: 'Small things, circling, not yet touching.' },
                { hold: { ms: 2600 }, cue: 'gather' },
                { say: 'Then something draws them in, and for a moment they are one.', emphasis: ['one'] },
                { hold: { ms: 2000 } },
                { say: 'And then it opens again, a little changed, into the next.', cue: 'open' },
                { show: 'Every thought is a weather.', hold: { ms: 3500 }, type: 'handwritten' }
            ]
        }
    }
]);

export const GUIDANCE = [
    'Open Field ("style": "open-field")',
    '',
    'Free expression: a reading that is yours to shape, for when the reader asks you to create, to express yourself, or for a mood more than a lesson.',
    '',
    'What the style sets for you: a beat that sets no place is in the centre, at the reader\'s own size; captions take a display serif; the text keeps the look\'s face, or the reader\'s. In your code scene, rise.lib eases every tween out (quick to start, soft to land) and draws labels in a display serif.',
    '',
    'How to write it:',
    `- Choose a "look" for the whole reading, and a "theme" for its colours: ${RISE_CURRENT_LOOKS.map(id => `${id} (${LOOK_HINTS[id]})`).join(', ')}. Or write a scene of your own; or start under a look and cut to your scene.`,
    '- Make rhythm with place and size: a "display" title shown on its own, a "smaller" aside at "top", a sentence alone in the centre.',
    `- Faces are yours to choose, by role: ${TYPE_ROLES.join(', ')}. One face for the text ("type" on the Current) and one for a moment ("type" on a beat) is plenty.`,
    '- Let holds breathe: a picture alone for two to six seconds between sentences is a beat too.',
    '- A code scene here is generative: particles, curves, slowly turning shapes, drawn with rise.ctx and rise.lib together. It changes on cues, drifts with t, and stands still when rise.reducedMotion is true. Nothing strobes: RISE freezes a scene that flashes.',
    '- A bed under the whole reading suits the style: a "sound" atmosphere or music on the first beat (aurora, starlight, soft-rain, piano, mystery…).'
].join('\n');
