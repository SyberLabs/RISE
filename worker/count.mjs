/**
 * POST /api/count: the reader's anonymous event counts (telemetry.v1, worker/telemetry.mjs), one beacon each from
 * src/core/telemetry.js. What is written: a request from a page of this site (its Origin is the request's own), within
 * its address's limit (COUNT_LIMITER, wrangler.production.jsonc), of at most MAX_COUNT_BYTES of JSON
 * `{ "v": 1, "e": <event>, "f": { <field>: <value> } }` whose event is a reader's and whose fields are exactly that
 * event's own (telemetry/events.json). The browser and the device are read from the User-Agent here, and the string
 * goes no further; a number is fitted to its field. Anything else is dropped.
 *
 * Every request is answered 204 with no body, whatever became of it, so the answer tells a sender nothing; and nothing
 * a request sent is logged.
 */
import EVENTS from '../telemetry/events.json' with { type: 'json' };
import { readText } from './live-realtime.mjs';
import { countEvent } from './telemetry.mjs';

export const COUNT_PATH = '/api/count';
export const MAX_COUNT_BYTES = 512;

/** What this door reads for itself. An event with any other field the server derives (the connector's host) is not a browser's to send. */
const DERIVED = ['browser', 'device'];

/** First match wins: Edge and the other Chromium browsers name Chrome as well, and Chrome and Firefox name Safari. */
const BROWSERS = [
  ['edge', /\bEdg(?:e|A|iOS)?\//u],
  ['other', /\b(?:OPR|Opera|SamsungBrowser|YaBrowser|UCBrowser)\//u],
  ['firefox', /\b(?:Firefox|FxiOS)\//u],
  ['chrome', /\b(?:Chrome|CriOS)\//u],
  ['safari', /^(?!.*\bAndroid\b).*\bVersion\/[\d.]+.*\bSafari\//u]
];

/** A browser's family by its User-Agent: one of BROWSERS', or other. */
export const browserOf = agent => BROWSERS.find(([, pattern]) => pattern.test(agent ?? ''))?.[0] ?? 'other';

/** A phone or a tablet by its User-Agent, and a desktop otherwise (an iPad that asks for desktop sites says it is a Mac). */
export const deviceOf = agent => (/Mobi|Android|iPhone|iPad|iPod/u.test(agent ?? '') ? 'mobile' : 'desktop');

/** A plain object of exactly these keys. */
const exactly = (value, keys) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/**
 * A reader's number, fitted to its field: to the least of its values it does not pass (the greatest beyond them), or
 * rounded to its step and held between 0 and its most. Null for anything that is not a finite number, and for a field
 * the allowlist gives no fitting.
 */
function fit({ values, max, step }, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (values !== undefined) return values.find(bucket => value <= bucket) ?? values.at(-1);
  if (max !== undefined && step !== undefined) return Math.min(max, Math.max(0, Math.round(value / step) * step));
  return null;
}

/** The fields a beacon's event is counted with, or null to drop it. Its values are held to their lists when written. */
export function admitted(body, agent) {
  if (!exactly(body, ['v', 'e', 'f']) || body.v !== EVENTS.version || typeof body.e !== 'string' || !Object.hasOwn(EVENTS.events, body.e)) return null;
  const { blobs, doubles } = EVENTS.events[body.e];
  const derived = blobs.filter(blob => blob.derived !== undefined).map(blob => blob.name);
  if (derived.length !== DERIVED.length || !DERIVED.every(name => derived.includes(name))) return null;
  const sent = blobs.filter(blob => blob.derived === undefined);
  if (!exactly(body.f, [...sent, ...doubles].map(field => field.name))) return null;
  const fields = { browser: browserOf(agent), device: deviceOf(agent) };
  for (const { name } of sent) fields[name] = body.f[name];
  for (const double of doubles) {
    const value = fit(double, body.f[double.name]);
    if (value === null) return null;
    fields[double.name] = value;
  }
  return fields;
}

/** Every request, answered 204 with no body; a beacon that passes every check is counted on the way. */
export async function handleCount(request, env) {
  try {
    const ip = request.headers.get('CF-Connecting-IP')?.trim();
    // A page of this site only, and each address held to its limit before the body is read; with no limiter, no
    // address, or a limiter that fails, nothing is written.
    if (request.method === 'POST' && request.headers.get('Origin') === new URL(request.url).origin && ip
      && (await env?.COUNT_LIMITER?.limit({ key: `count:${ip}` }))?.success === true) {
      const body = JSON.parse(await readText(request, MAX_COUNT_BYTES));
      const fields = admitted(body, request.headers.get('User-Agent'));
      if (fields !== null) countEvent(env, body.e, fields);
    }
  } catch {
    // Dropped: too large, not JSON, not UTF-8, or the limiter's fault; the answer is the same.
  }
  return new Response(null, { status: 204 });
}
