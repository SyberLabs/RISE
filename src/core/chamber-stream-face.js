/**
 * Chamber live-stream face allowlist. Chrome (Inter, JetBrains Mono)
 * stays out of this list. Unknown or empty ids fall back to literary.
 *
 * `label` IS THE WORD A READER SEES, never the font's own name — the family
 * behind each id is a CSS matter (ChamberOrbital.css) and naming it in the
 * chrome is a thing Chamber.settings-door.test.js explicitly forbids. Held
 * here rather than beside the radios so a fifth face cannot arrive with no
 * label and fall back to leaking its family name.
 *
 *   literary → Crimson Pro   display → Marcellus
 *   thick    → Space Grotesk jp      → Noto Serif JP
 */
export const CHAMBER_STREAM_FACES = Object.freeze([
    Object.freeze({ id: 'literary', label: 'Literary' }),
    Object.freeze({ id: 'display', label: 'Display' }),
    Object.freeze({ id: 'thick', label: 'Thick' }),
    Object.freeze({ id: 'jp', label: 'Japanese' })
]);

const ALLOWED = new Set(CHAMBER_STREAM_FACES.map((face) => face.id));

export function resolveChamberStreamFace(id) {
    return ALLOWED.has(id) ? id : 'literary';
}
