import { ATRIUM_PASSAGES } from './catalog.js';
import { sensoryConfigFor } from './launches.js';
import { evaluateJourneyReadiness } from './readiness.js';
import {
  ATRIUM_PILOT_DURATION_PROFILE,
  ATRIUM_PILOT_PASSAGE_DURATIONS
} from './packs/pilot-v1/durations.js';

const passageById = new Map(ATRIUM_PASSAGES.map(passage => [passage.id, passage]));

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
  const profileMatches = Object.entries(ATRIUM_PILOT_DURATION_PROFILE)
    .every(([key, value]) => config[key] === value);
  if (!profileMatches) {
    throw new TypeError('Atrium itinerary duration metadata requires the Phrase/140 WPM/flat compiler profile.');
  }
  const segments = launch.segments.map(segment => {
    const passage = passageById.get(segment.passageId);
    const duration = ATRIUM_PILOT_PASSAGE_DURATIONS[segment.passageId];
    if (!Number.isFinite(duration)) {
      throw new TypeError(`No compiler-derived Atrium duration for ${segment.passageId}.`);
    }
    return {
      ...segment,
      label: passage?.label || segment.passageId,
      duration,
      durationLabel: formatAtriumDuration(duration)
    };
  });
  const sourceBreakDuration = Math.round((60_000 / config.wpm) * 3);
  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0)
    + Math.max(0, segments.length - 1) * sourceBreakDuration;
  return {
    ready: true,
    config,
    segments,
    totalDuration,
    totalLabel: formatAtriumDuration(totalDuration)
  };
}
