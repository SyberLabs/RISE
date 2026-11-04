/**
 * SyberLabs telemetry (telemetry.v1): what happened, counted, never who it happened to or what it was about. An event
 * is `<system>.<object>.<outcome>`; telemetry/events.json names every event and every field one may carry, each field
 * a closed list of values or a count, and nothing it does not name is written. A counted event is one data point in
 * the Analytics Engine dataset production binds as EVENTS (wrangler.production.jsonc): `indexes: [event]`,
 * `blobs: [event, release, ...the event's values]` and `doubles: [1, ...its counts]`, each in the allowlist's order.
 * Without the binding (every other configuration, the tests, a local run) nothing is written.
 *
 * A count changes nothing: it is written once the answer is built, it is never awaited, and whatever goes wrong in it
 * is let go.
 */
import EVENTS from '../telemetry/events.json' with { type: 'json' };

/**
 * The deployed commit, as far as the Worker knows it, which is not at all: CI writes the commit into dist/release.txt
 * after wrangler has bundled the Worker, and naming it here would take a deploy-time variable, a workflow change.
 */
export const RELEASE = 'unknown';

const allowed = event => (Object.hasOwn(EVENTS.events, event) ? EVENTS.events[event] : null);

/** The values the allowlist gives an event's field, for a caller that must fit what it has to them. */
export const valuesOf = (event, name) => allowed(event)?.blobs.find(blob => blob.name === name)?.values ?? [];

/**
 * An event's data point, or null for anything the allowlist does not name: an event it does not list, a field it does
 * not give the event, one of the event's fields missing, a value off its field's list, or a number that is not a count.
 */
export function dataPoint(event, fields) {
  const spec = allowed(event);
  if (spec === null || !fields || typeof fields !== 'object') return null;
  const names = [...spec.blobs, ...spec.doubles].map(field => field.name);
  if (Object.keys(fields).length !== names.length || !names.every(name => Object.hasOwn(fields, name))) return null;
  if (!spec.blobs.every(({ name, values }) => Array.isArray(values) && values.includes(fields[name]))) return null;
  if (!spec.doubles.every(({ name }) => Number.isSafeInteger(fields[name]) && fields[name] >= 0)) return null;
  return {
    indexes: [event],
    blobs: [event, RELEASE, ...spec.blobs.map(({ name }) => fields[name])],
    doubles: [1, ...spec.doubles.map(({ name }) => fields[name])]
  };
}

/** The event, counted where EVENTS is bound; whatever goes wrong is let go, because a count is never worth an answer. */
export function countEvent(env, event, fields) {
  try {
    const point = dataPoint(event, fields);
    if (point !== null) env?.EVENTS?.writeDataPoint(point);
  } catch {
    // Nothing: the answer does not wait on a count.
  }
}
