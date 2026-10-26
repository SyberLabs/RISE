/**
 * The face, still: the open eye at arrival as one inline SVG (docs/plans/LIVE-CURRENT.md §22). The venue shows it
 * before the face's worker has drawn, and keeps it as the poster wherever the engine cannot run.
 *
 * The petals are 36 thin strokes over a lit disc rather than the engine's 108 filled petals: a first paint pays for
 * a few hundred bytes, not a few hundred paths. Its geometry is the engine's at arrival, in a 100-unit square.
 */
import { ORACLE_SKINS, ORACLE_STATES } from '../../scenes/engines/oracle.js';

export const FACE_SKINS = Object.freeze(Object.keys(ORACLE_SKINS));

const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const fixed = value => Number(value.toFixed(2));

/** A skin's dark, the room around the eye, as a CSS colour; Sophia's for a skin it does not know. */
export function faceDark(name) {
    return rgb(ORACLE_SKINS[FACE_SKINS.includes(name) ? name : 'sophia'].trail);
}

/** Whether a skin is a light room's (a pale ground, ink for words); not for a skin it does not know. */
export function faceLight(name) {
    return FACE_SKINS.includes(name) && ORACLE_SKINS[name].light === true;
}

/**
 * A skin's colours as CSS custom properties, for the room the face rests in; Sophia's for a skin it does not know.
 * `--live-core` is the base of the room's words: a dark skin's core, a light skin's ink. `--live-deep` is the skin's
 * deepest colour, a light room's night for what is made of light.
 */
export function facePalette(name) {
    const skin = ORACLE_SKINS[FACE_SKINS.includes(name) ? name : 'sophia'];
    return { '--live-ground': rgb(skin.trail), '--live-iris': rgb(skin.iris), '--live-core': rgb(skin.ink ?? skin.core), '--live-glow': rgb(skin.glow), '--live-deep': rgb(skin.deep) };
}

/** The still eye in a skin, as SVG markup; Sophia for a skin it does not know. */
export function faceStill(name) {
    const skinName = FACE_SKINS.includes(name) ? name : 'sophia';
    const skin = ORACLE_SKINS[skinName];
    const { open } = ORACLE_STATES.arrival;
    const R = 100 * (0.075 + open * 0.035);
    const reach = R * 1.1;
    const pupil = R * 0.34;
    const id = `face-still-${skinName}`;
    const petals = Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return `<line data-part="petal" x1="50" y1="50" x2="${fixed(50 + reach * Math.cos(a))}" y2="${fixed(50 + reach * Math.sin(a))}"/>`;
    }).join('');
    const nodes = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return `<circle data-part="node" cx="${fixed(50 + 25 * Math.cos(a))}" cy="${fixed(50 + 25 * Math.sin(a))}" r="3.5" fill="url(#${id}-node)"/>`;
    }).join('');
    return `<svg class="live-face__still" data-skin="${skinName}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">`
        + '<defs>'
        + `<radialGradient id="${id}-iris"><stop offset="0" stop-color="${rgb(skin.core)}" stop-opacity="0.35"/><stop offset="1" stop-color="${rgb(skin.iris)}" stop-opacity="0.12"/></radialGradient>`
        + `<radialGradient id="${id}-pupil"><stop offset="0" stop-color="${rgb(skin.deep)}" stop-opacity="0.95"/><stop offset="0.55" stop-color="${rgb(skin.glow)}" stop-opacity="0.55"/><stop offset="1" stop-color="${rgb(skin.iris)}" stop-opacity="0.25"/></radialGradient>`
        // A light skin's node is a bead of ink, as the engine draws it.
        + (skin.light
            ? `<radialGradient id="${id}-node"><stop offset="0" stop-color="${rgb(skin.iris)}" stop-opacity="0.5"/><stop offset="0.45" stop-color="${rgb(skin.glow)}" stop-opacity="0.3"/><stop offset="1" stop-color="${rgb(skin.glow)}" stop-opacity="0"/></radialGradient>`
            : `<radialGradient id="${id}-node"><stop offset="0" stop-color="${rgb(skin.core)}" stop-opacity="0.55"/><stop offset="0.4" stop-color="${rgb(skin.glow)}" stop-opacity="0.4"/><stop offset="0.7" stop-color="${rgb(skin.iris)}" stop-opacity="0.22"/><stop offset="1" stop-color="${rgb(skin.iris)}" stop-opacity="0"/></radialGradient>`)
        + '</defs>'
        + `<rect width="100" height="100" fill="${rgb(skin.trail)}"/>`
        + nodes
        + `<circle data-part="iris" cx="50" cy="50" r="${fixed(reach)}" fill="url(#${id}-iris)"/>`
        + `<g stroke="${rgb(skin.iris)}" stroke-opacity="0.32" stroke-width="0.25" stroke-linecap="round">${petals}</g>`
        + `<circle data-part="pupil" cx="50" cy="50" r="${fixed(pupil)}" fill="url(#${id}-pupil)"/>`
        + `<circle data-part="catchlight" cx="${fixed(50 - pupil * 0.35)}" cy="${fixed(50 - pupil * 0.38)}" r="${fixed(pupil * 0.16)}" fill="${rgb(skin.core)}" fill-opacity="0.72"/>`
        + '</svg>';
}
