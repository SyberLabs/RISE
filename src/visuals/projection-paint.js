/**
 * First-paint signal shared by every field that can project through a Fit word.
 * The field owns `_projectionPainted` and `onProjectionPaint`; this is the
 * one gate that fires the callback once the host is live.
 */
export function reportProjectionPaint(field, isVisible) {
    if (field._projectionPainted) return;
    const host = field.projectionHost || field.host;
    if (!host || (!field.projectionHost && field._projectionHostCleared)) return;
    if (typeof isVisible === 'function' && !isVisible()) return;
    field._projectionPainted = true;
    field.onProjectionPaint(host);
}
