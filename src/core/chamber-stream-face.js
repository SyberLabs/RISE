/**
 * Chamber live-stream face allowlist. Chrome (Inter, JetBrains Mono)
 * stays out of this list. Unknown or empty ids fall back to literary.
 */

export const CHAMBER_STREAM_FACES = Object.freeze([
    Object.freeze({ id: 'literary', label: 'Crimson Pro' }),
    Object.freeze({ id: 'display', label: 'Marcellus' }),
    Object.freeze({ id: 'thick', label: 'Space Grotesk' }),
    Object.freeze({ id: 'jp', label: 'Noto Serif JP' })
]);

const ALLOWED = new Set(CHAMBER_STREAM_FACES.map((face) => face.id));

export function resolveChamberStreamFace(id) {
    return ALLOWED.has(id) ? id : 'literary';
}
