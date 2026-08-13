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

export function captionsFromPlan(plan) {
  const cues = [];
  for (const atom of plan.atoms) {
    const text = String(atom.text || '').trim();
    if (!text) continue;
    cues.push(Object.freeze({
      fromMs: atom.startMs,
      toMs: atom.endMs,
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
    lines.push(`${formatVtt(cue.fromMs)} --> ${formatVtt(cue.toMs)}`);
    lines.push(cue.text);
    lines.push('');
  }
  return lines.join('\n');
}

export function captionsToSrt(cues) {
  const lines = [];
  cues.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatSrt(cue.fromMs)} --> ${formatSrt(cue.toMs)}`);
    lines.push(cue.text);
    lines.push('');
  });
  return lines.join('\n');
}
