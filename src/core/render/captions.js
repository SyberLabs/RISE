/**
 * Captions from compiled atom timing. Never OCR or speech recognition.
 * Segmentation follows the reading atoms; each cue keeps source coordinates.
 */

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function formatVtt(ms) {
  const clamped = Math.max(0, ms | 0);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const milli = clamped % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milli, 3)}`;
}

function formatSrt(ms) {
  return formatVtt(ms).replace('.', ',');
}

export function captionsFromPlan(plan, { fromMs = 0, toMs = null } = {}) {
  const start = Math.max(0, fromMs | 0);
  const end = toMs == null ? Number.POSITIVE_INFINITY : toMs;
  const cues = [];
  for (const atom of plan.atoms) {
    const text = String(atom.text || '').trim();
    if (!text) continue;
    if (atom.endMs <= start || atom.startMs >= end) continue;
    cues.push(Object.freeze({
      fromMs: atom.startMs,
      toMs: atom.endMs,
      playFromMs: Math.max(atom.startMs, start) - start,
      playToMs: Math.min(atom.endMs, end) - start,
      text,
      sourceId: atom.sourceId,
      sourceCharacterStart: atom.sourceCharacterStart,
      sourceCharacterEnd: atom.sourceCharacterEnd
    }));
  }
  return Object.freeze(cues);
}

export function captionsToVtt(cues) {
  const lines = ['WEBVTT', ''];
  for (const cue of cues) {
    const from = cue.playFromMs == null ? cue.fromMs : cue.playFromMs;
    const to = cue.playToMs == null ? cue.toMs : cue.playToMs;
    lines.push(`${formatVtt(from)} --> ${formatVtt(to)}`);
    lines.push(cue.text);
    lines.push('');
  }
  return lines.join('\n');
}

export function captionsToSrt(cues) {
  const lines = [];
  cues.forEach((cue, index) => {
    const from = cue.playFromMs == null ? cue.fromMs : cue.playFromMs;
    const to = cue.playToMs == null ? cue.toMs : cue.playToMs;
    lines.push(String(index + 1));
    lines.push(`${formatSrt(from)} --> ${formatSrt(to)}`);
    lines.push(cue.text);
    lines.push('');
  });
  return lines.join('\n');
}
