import { estimateCompiledDuration } from '../../core/session-compiler.js';
import { ATRIUM_PASSAGES } from './catalog.js';
import { ATRIUM_PAYLOADS } from './handoff.js';
import { sensoryConfigFor } from './launches.js';
import { evaluateJourneyReadiness } from './readiness.js';

const passageById = new Map(ATRIUM_PASSAGES.map(passage => [passage.id, passage]));

function payloadText(entry) {
  if (typeof entry === 'string') return entry;
  return typeof entry?.text === 'string' ? entry.text : '';
}

function seconds(ms) {
  return Math.max(1, Math.round(ms / 1000));
}

export function formatAtriumDuration(durationMs) {
  const totalSeconds = seconds(durationMs);
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

export function compileAtriumItinerary(launch, options = {}) {
  const readiness = evaluateJourneyReadiness(launch, options.passages, options.sources);
  if (!readiness.ready) return { ready: false, totalDuration: 0, segments: [], reasons: readiness.reasons };
  const config = options.config || sensoryConfigFor(launch.domain);
  const payloads = options.payloads || ATRIUM_PAYLOADS;
  const segments = launch.segments.map(segment => {
    const passage = passageById.get(segment.passageId);
    const text = payloadText(payloads[segment.passageId]);
    const duration = estimateCompiledDuration({
      ...config,
      title: passage?.label || launch.title,
      text,
      sources: [{ id: segment.passageId, name: passage?.label || segment.passageId, type: 'text', data: text }]
    });
    return {
      ...segment,
      label: passage?.label || segment.passageId,
      duration,
      durationLabel: formatAtriumDuration(duration)
    };
  });
  const allSources = segments.map(segment => ({
    id: segment.passageId,
    name: segment.label,
    type: 'text',
    data: payloadText(payloads[segment.passageId])
  }));
  const totalDuration = estimateCompiledDuration({ ...config, title: launch.title, sources: allSources });
  return {
    ready: true,
    config,
    segments,
    totalDuration,
    totalLabel: formatAtriumDuration(totalDuration)
  };
}
