import { RISE_CURRENT_LIMITS as LIMITS, RISE_CURRENT_LOOKS, RISE_CURRENT_SCHEMA, RISE_CURRENT_SCHEMA_V2, RISE_CURRENT_STYLES, RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../src/core/rise-current.js';
import { MCP_CURRENT_BYTES, serializedUtf8Bytes } from '../src/live/hosts/mcp-size.js';
import { CURRENT_EXAMPLE, STYLE_LINES, TOOL_NAME, styleGuide } from '../src/live/guide/index.js';
import { DISPLAY_MODES } from '../src/live/hosts/mcp-port.js';
import { BEAT_CUE_PATTERN, BEAT_LIMITS, BEAT_PLACES, BEAT_SIZES, BEAT_TYPES, SCENE_ENGINES } from '../src/core/beats.js';
import { SOUND_IDS } from '../src/audio/sound-ids.js';
import { EMBED_PATH, relayHtml } from '../src/live/hosts/mcp-relay.js';
import { cardCsp, cardHtml } from '../src/live/hosts/mcp-card.js';
import { readText } from './live-realtime.mjs';
import { callGate0, GATE0_TOOL, GATE0_TOOL_NAME } from './mcp-gate0.mjs';
import { admitSceneCode, describeDiagnostic } from './scene-admission.mjs';
import { admitSvg } from '../src/core/svg-admission.js';

/**
 * RISE as an MCP server: one tool that presents a Current, and the app that shows it.
 *
 * A host's model is the provider. It calls `rise_present` with a sealed Current
 * (`rise.current.v1`); the host renders this server's app for that call and
 * hands the app the arguments; the app plays the Current (src/live/hosts/
 * mcp-relay.js, and the embedded page it frames). This server holds nothing:
 * it is stateless, keeps no session and no key, calls no model and spends
 * nothing. Its work is to say what the tool is, to refuse a Current that is not
 * valid so the model can be told why and try again, and to serve the app's
 * document. The transport is MCP's Streamable HTTP, in its simplest legal form:
 * every request is a POST answered with one JSON body, and there is no stream.
 *
 * It is off unless MCP_ENABLED is 'true'. It answers only requests from no
 * browser origin or from its own (an MCP host's server has none; a page on
 * another site must not be able to make a browser talk to it), refuses a
 * protocol version it does not speak before reading anything, holds each client
 * address but Anthropic's shared egress to the site's rate limiter where the
 * platform offers one, reads a bounded body, and returns nothing it was sent
 * except a validator's message, a scene parser's diagnostic (scene-admission.mjs), a figure's (svg-admission.js) or an argument's name, clipped.
 *
 * CHECKED AGAINST THE REFERENCE, NOT AGAINST A PRODUCT: the shapes below were
 * compared with @modelcontextprotocol/ext-apps 2.0.3 and the SDK's own client
 * (see docs/plans/LIVE-MCP.md for what was run). No product host has used it.
 */

export const MCP_PATH = '/api/mcp';
export const APP_URI = 'ui://rise/current';
export const APP_MIME = 'text/html;profile=mcp-app';
/** Each style's full guidance, as a resource: ui://rise/guide/<style>. */
const GUIDE_PREFIX = 'ui://rise/guide/';
const GUIDE_MIME = 'text/markdown';
const GUIDE_URIS = new Map(RISE_CURRENT_STYLES.map(id => [`${GUIDE_PREFIX}${id}`, id]));
/** The same guidance as a tool, for hosts whose model cannot read resources. */
export const GUIDE_TOOL_NAME = 'rise_guide';
export const SERVER_INFO = Object.freeze({ name: 'rise', title: 'RISE', version: '1.0.0' });
/** Newest first. A client's version is answered with itself if it is here, and otherwise with the newest. */
export const PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const MAX_BODY_BYTES = 262_144;
const MAX_MESSAGE = 300;
/** Lines of scene refusals in one answer, across every scene. */
export const MAX_SCENE_LINES = 10;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  // The site is https only; every response of the host says so, the static ones through _headers.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/**
 * Anthropic's published egress for Claude's connectors, 160.79.104.0/21
 * (claude.com/docs/connectors/building/authentication): every Claude user's call arrives from it, so a
 * per-address limit there would be one limit for all of them. IPv4 dotted quads only; anything else is outside.
 */
const ANTHROPIC_EGRESS = { network: (160 << 24 | 79 << 16 | 104 << 8) >>> 0, prefix: 21 };

export function inAnthropicEgress(ip) {
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(ip);
  if (!parts) return false;
  const octets = parts.slice(1).map(part => (part.length > 1 && part.startsWith('0') ? NaN : Number(part)));
  if (octets.some(octet => !(octet <= 255))) return false;
  const address = (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
  const shift = 32 - ANTHROPIC_EGRESS.prefix;
  return address >>> shift === ANTHROPIC_EGRESS.network >>> shift;
}

const RETRY_AFTER_SECONDS = 60;

// Conditional on the reader's request, as the directory's review asks: a server must not tell the model to call a tool the reader did not ask for.
const INSTRUCTIONS = `RISE presents an answer to the reader as a spoken, visual reading. When the reader asks for a reading, a spoken or visual explanation, or names RISE, answer by calling ${TOOL_NAME} with a Current. ${GUIDE_TOOL_NAME} returns the format reference for a named style: the beats, scenes and limits a Current in that style is written with, and worked examples.`;

const shortText = max => ({ type: 'string', minLength: 1, maxLength: max });

/**
 * A Current as JSON Schema, for a host's model. Every limit and catalog is the validator's own
 * (src/core/rise-current.js), not a copy. Where JSON Schema cannot say what the validator checks
 * (trimmed ids, unique ids, the total text, an anchor inside its text) the schema is looser, never
 * stricter: the validator judges, and this is what the model is told first.
 */
/** The v2 Current: beats over scenes (src/core/beats.js), beside the v1 passages. */
export function currentJsonSchemaV2() {
  const id = shortText(LIMITS.id);
  const text = shortText(BEAT_LIMITS.text);
  const hold = {
    type: 'object',
    description: 'How long the beat lasts with nothing said, in milliseconds; maxMs is the most a scene that knows it has finished may stretch it to.',
    properties: {
      ms: { type: 'integer', minimum: BEAT_LIMITS.holdMinMs, maximum: BEAT_LIMITS.holdMaxMs },
      maxMs: { type: 'integer', minimum: BEAT_LIMITS.holdMinMs, maximum: BEAT_LIMITS.holdMaxMs }
    },
    required: ['ms'],
    additionalProperties: false
  };
  const face = { type: 'string', enum: BEAT_TYPES };
  return {
    type: 'object',
    description: 'The whole answer as a Current of beats over scenes: say and show a sentence, hold while the picture plays, or show a line for a while.',
    properties: {
      schema: { const: RISE_CURRENT_SCHEMA_V2 },
      id,
      title: shortText(LIMITS.title),
      theme: { type: 'string', enum: RISE_CURRENT_THEME_IDS },
      look: { type: 'string', enum: RISE_CURRENT_LOOKS },
      style: { type: 'string', enum: RISE_CURRENT_STYLES },
      type: {
        type: 'object',
        description: 'The faces of the reading: for its text, and for its captions.',
        properties: { text: face, caption: face },
        additionalProperties: false
      },
      origin: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['model', 'human'] },
          name: { ...shortText(LIMITS.name), description: 'The model’s name, or the person’s.' },
          provider: { ...shortText(LIMITS.name), description: 'Who runs the model; given with "kind": "model" and only then.' }
        },
        required: ['kind', 'name'],
        additionalProperties: false
      },
      scenes: {
        type: 'array',
        description: 'The pictures a beat may start; a scene keeps running under the beats that follow until another starts.',
        maxItems: BEAT_LIMITS.scenes,
        items: {
          oneOf: [{
            type: 'object',
            properties: {
              id,
              engine: { type: 'string', enum: SCENE_ENGINES },
              params: { type: 'object', description: 'The engine\u2019s parameters, by the guide\u2019s list for that engine; each within its bounds.' }
            },
            required: ['id', 'engine'],
            additionalProperties: false
          }, {
            type: 'object',
            properties: {
              id,
              code: {
                type: 'string',
                minLength: 1,
                // maxLength counts characters, never more than the bytes the validator counts: looser, never stricter.
                maxLength: BEAT_LIMITS.code,
                description: `A picture you write: the text of an ES module of at most ${BEAT_LIMITS.code.toLocaleString('en-US')} bytes whose one default export function receives \`rise\` and returns { frame(t, dt), cue(name, { instant }) }. No imports, no network, no timers: time comes from \`frame\`. Draw with rise.ctx and rise.lib.`
              }
            },
            required: ['id', 'code'],
            additionalProperties: false
          }, {
            type: 'object',
            properties: {
              id,
              svg: {
                type: 'string',
                minLength: 1,
                // As for code: characters, never more than the bytes the validator counts.
                maxLength: BEAT_LIMITS.svg,
                description: `A figure you draw: one SVG document of at most ${BEAT_LIMITS.svg.toLocaleString('en-US')} bytes, shown as an image behind the words. The root <svg> has xmlns="http://www.w3.org/2000/svg" and a viewBox; draw ink in currentColor so the theme colours it. It takes no cues: a hold under it lasts its ms. No script, no event handlers, no links or images, and no href or url() outside the figure (#id only).`
              }
            },
            required: ['id', 'svg'],
            additionalProperties: false
          }]
        }
      },
      beats: {
        type: 'array',
        description: `In order; at most ${BEAT_LIMITS.totalText} characters of text in all. A beat has "say" (with "show" when what is shown differs), or "hold", or "show" with "hold".`,
        minItems: 1,
        maxItems: BEAT_LIMITS.beats,
        items: {
          type: 'object',
          properties: {
            say: { ...text, description: 'What the voice says; shown too unless "show" is given or "place" is "none".' },
            show: { ...text, description: 'What is shown, when it differs from what is said, or with "hold" and no "say": a line shown for a while.' },
            hold,
            scene: { ...id, description: 'Start this scene at this beat.' },
            cue: { type: 'string', pattern: BEAT_CUE_PATTERN, maxLength: BEAT_LIMITS.cue, description: 'A signal to the running scene: one of its cues, or set:<parameter>=<value>.' },
            transition: { type: 'object', properties: { ms: { type: 'integer', minimum: 0, maximum: BEAT_LIMITS.transitionMaxMs } }, required: ['ms'], additionalProperties: false },
            place: { type: 'string', enum: BEAT_PLACES },
            size: { type: 'string', enum: BEAT_SIZES },
            type: face,
            emphasis: { type: 'array', maxItems: BEAT_LIMITS.emphasis, items: { type: 'string', maxLength: BEAT_LIMITS.emphasisLength } },
            sound: { type: 'string', enum: [...SOUND_IDS.soundscape, ...SOUND_IDS.tone, ...SOUND_IDS.silence] }
          },
          additionalProperties: false
        }
      }
    },
    required: ['schema', 'id', 'title', 'origin', 'beats'],
    additionalProperties: false
  };
}

/** The v1 Current: passages. */
export function currentJsonSchema() {
  const id = shortText(LIMITS.id);
  return {
    type: 'object',
    description: 'The whole answer as a Current, exactly as the guide describes.',
    properties: {
      schema: { const: RISE_CURRENT_SCHEMA },
      id,
      title: shortText(LIMITS.title),
      theme: { type: 'string', enum: RISE_CURRENT_THEME_IDS },
      look: { type: 'string', enum: RISE_CURRENT_LOOKS },
      origin: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['model', 'human'] },
          name: { ...shortText(LIMITS.name), description: 'The model’s name, or the person’s.' },
          provider: { ...shortText(LIMITS.name), description: 'Who runs the model; given with "kind": "model" and only then.' }
        },
        required: ['kind', 'name'],
        additionalProperties: false
      },
      segments: {
        type: 'array',
        description: `Spoken in order; at most ${LIMITS.totalText} characters of text in all.`,
        minItems: 1,
        maxItems: LIMITS.segments,
        items: {
          type: 'object',
          properties: {
            id,
            text: shortText(LIMITS.segmentText),
            visual: { type: 'string', enum: RISE_CURRENT_VISUALS },
            dives: {
              type: 'array',
              description: 'Side notes on the text. The presentation does not show them: leave them out.',
              maxItems: LIMITS.dives,
              items: {
                type: 'object',
                properties: {
                  id,
                  text: shortText(LIMITS.diveText),
                  anchor: {
                    type: 'object',
                    properties: {
                      fromCharacter: { type: 'integer', minimum: 0 },
                      toCharacter: { type: 'integer', minimum: 1 },
                      quoteStart: { type: 'string', minLength: 1 },
                      quoteEnd: { type: 'string', minLength: 1 }
                    },
                    required: ['fromCharacter', 'toCharacter', 'quoteStart', 'quoteEnd'],
                    additionalProperties: false
                  }
                },
                required: ['id', 'text', 'anchor'],
                additionalProperties: false
              }
            },
            literal: { type: 'boolean' }
          },
          required: ['id', 'text'],
          additionalProperties: false
        }
      }
    },
    required: ['schema', 'id', 'title', 'origin', 'segments'],
    additionalProperties: false
  };
}

/** Either Current: the v1 passages, or the v2 beats. */
const CURRENT = { oneOf: [currentJsonSchema(), currentJsonSchemaV2()] };

export const TOOL = Object.freeze({
  name: TOOL_NAME,
  title: 'Present a reading in RISE',
  // What a model needs to decide to call it and to write a plain Current; a host reads it on every turn, so the
  // full guide (CURRENT_GUIDE) and the worked Currents are rise_guide's, read only when a model writes in a style.
  description: [
    'Use this when the reader asked for a spoken, visual explanation or reading of the answer, or named RISE. RISE speaks the answer in the device’s own voice and shows the words as they are spoken, over RISE’s own drawn imagery or the diagrams and figures the model writes as SVG or scene code, checked by RISE; the reader presses Play, can pause and resume, and can make the visual calmer or more vibrant. Call it once per answer, with the whole answer written as a Current and passed as "current". Do not use it for answers that need tables, code or live follow-up, and do not call it again for the same answer.',
    '',
    'A plain spoken reading is a "rise.current.v1" Current of passages ("segments"), such as:',
    JSON.stringify(CURRENT_EXAMPLE),
    'Passage text is plain words meant to be heard: no markdown, lists or headings, and no | or [PAUSE], [FLASH], [HOLD]. Begin with a short passage. "origin" names the model and who runs it.',
    '',
    `A "rise.current.v2" Current is beats over scenes: pictures that play, scene code, SVG figures. Its fields, limits, figure rules and worked Currents are in the format reference ${GUIDE_TOOL_NAME} returns for {"style": "<style>"}. Styles, for "style" on a v2 Current:`,
    ...STYLE_LINES
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: { current: CURRENT },
    required: ['current'],
    additionalProperties: false
  },
  // What structuredContent carries back: the Current the app admits (src/live/hosts/mcp-port.js), named rather than
  // spelled out again, since inputSchema already does and a host reads both on every turn.
  outputSchema: { type: 'object', properties: { current: { type: 'object', description: 'The Current as accepted, for the app that plays it.' } }, required: ['current'] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  // Anyone may call it: there is no account and nothing of the reader's to reach.
  securitySchemes: [{ type: 'noauth' }],
  _meta: {
    // `ui` is the extension's key; the flat one is its older spelling, which some hosts still read.
    ui: { resourceUri: APP_URI },
    'ui/resourceUri': APP_URI,
    // What ChatGPT shows beside the call while it runs and once it is done; at most 64 characters each.
    'openai/toolInvocation/invoking': 'Preparing the reading',
    'openai/toolInvocation/invoked': 'The reading is ready to play'
  }
});

/**
 * A style's full guidance, as a tool: a host such as claude.ai lets the reader attach resources and
 * lets its model only call tools, so the guide resources alone would never reach the model.
 */
export const GUIDE_TOOL = Object.freeze({
  name: GUIDE_TOOL_NAME,
  title: 'RISE style reference',
  description: `Returns the format reference for one RISE style: the fields, limits, scenes and worked example Currents a ${TOOL_NAME} Current in that style is written with.`,
  inputSchema: {
    type: 'object',
    properties: { style: { type: 'string', enum: RISE_CURRENT_STYLES } },
    required: ['style'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  securitySchemes: [{ type: 'noauth' }]
});

function http(status, body, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

const result = (id, value) => http(200, { jsonrpc: '2.0', id, result: value });
const failure = (id, code, message, data) => http(200, { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } });

/** Text that came from what the model sent, fit to be echoed: no control characters, clipped. */
const clean = (text, length = MAX_MESSAGE) => clip(String(text).replace(/[\u0000-\u001F\u007F]/gu, ' '), length);

/** The text of a refusal a model can act on: what was wrong and where. */
function refusal(error) {
  return `RISE refused this Current: ${clean(error?.message ?? 'The Current was not valid')}. Correct it and call ${TOOL_NAME} again.`;
}

/**
 * Every generated scene's code, parsed and held to the scene rules (scene-admission.mjs), and every figure's SVG,
 * held to the figure rules the card holds it to again (svg-admission.js): the refusal's lines, or none.
 */
function sceneRefusals(current) {
  const lines = [];
  let code = false;
  for (const scene of Array.isArray(current.scenes) ? current.scenes : []) {
    const verdict = scene?.code !== undefined ? admitSceneCode(scene.code) : scene?.svg !== undefined ? admitSvg(scene.svg) : { ok: true };
    if (verdict.ok) continue;
    code ||= scene.code !== undefined;
    for (const diagnostic of verdict.diagnostics) lines.push(clean(`Scene "${scene.id}" was refused: ${describeDiagnostic(diagnostic)}`));
  }
  return { lines: lines.slice(0, MAX_SCENE_LINES), repair: code ? 'the scene’s code' : 'the figure' };
}

function call(id, params) {
  if (!params || typeof params !== 'object' || params.name !== TOOL_NAME) return failure(id, -32602, 'Unknown tool');
  const args = params.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args) || !args.current || typeof args.current !== 'object') {
    return result(id, { content: [{ type: 'text', text: `Call ${TOOL_NAME} with {"current": <a Current>}.` }], isError: true });
  }
  const extra = Object.keys(args).find(key => key !== 'current');
  if (extra !== undefined) {
    const why = extra === 'theme' ? '"theme" belongs inside the Current, not beside it'
      : `unknown argument "${clip(extra.replace(/[\u0000-\u001F\u007F]/gu, ''), 40)}"`;
    return result(id, { content: [{ type: 'text', text: `RISE refused these arguments: ${why}. Call ${TOOL_NAME} with {"current": <a Current>} only.` }], isError: true });
  }
  try {
    if (serializedUtf8Bytes(args.current) > MCP_CURRENT_BYTES) {
      throw new Error(`The Current exceeds the ${MCP_CURRENT_BYTES.toLocaleString('en-US')}-byte MCP limit`);
    }
    validateRiseCurrent(args.current);
  } catch (error) {
    return result(id, { content: [{ type: 'text', text: refusal(error) }], isError: true });
  }
  const refused = sceneRefusals(args.current);
  if (refused.lines.length) {
    const text = [...refused.lines, `Repair ${refused.repair} and call ${TOOL_NAME} again with the whole Current.`].join('\n');
    return result(id, { content: [{ type: 'text', text }], isError: true });
  }
  // The app admits the Current from structuredContent; the model, which wrote it, is told only what was accepted.
  return result(id, {
    content: [{ type: 'text', text: receipt(args.current) }],
    structuredContent: { current: args.current }
  });
}

/** A speaking pace for the receipt's estimate only; the reader sets the real one. */
const SPOKEN_WORDS_PER_MINUTE = 150;

/** One line for the model about an accepted Current: its id, title, size and about how long it plays. */
function receipt(current) {
  const beats = Array.isArray(current.beats);
  const parts = beats ? current.beats : current.segments;
  const words = parts.map(part => (beats ? part.say : part.text) ?? '').join(' ').split(/\s+/u).filter(Boolean).length;
  const heldMs = beats ? parts.reduce((sum, beat) => sum + (beat.hold?.ms ?? 0), 0) : 0;
  const seconds = Math.max(1, Math.round((words / SPOKEN_WORDS_PER_MINUTE) * 60 + heldMs / 1000));
  const length = seconds < 90 ? `about ${seconds} seconds` : `about ${Math.round(seconds / 60)} minutes`;
  const count = `${parts.length} ${beats ? 'beat' : 'passage'}${parts.length === 1 ? '' : 's'}`;
  return `RISE is presenting "${clean(current.title, LIMITS.title)}" (id "${clean(current.id, LIMITS.id)}") to the reader: ${count}, ${length}. The reader starts it with Play.`;
}

/** rise_guide: one style's full guidance, or a refusal that names the styles and echoes nothing it was sent. */
function guide(id, params) {
  const args = params.arguments;
  const keys = args && typeof args === 'object' && !Array.isArray(args) ? Object.keys(args) : null;
  const style = keys?.length === 1 && keys[0] === 'style' && typeof args.style === 'string' && RISE_CURRENT_STYLES.includes(args.style) ? args.style : null;
  if (style === null) {
    return result(id, { content: [{ type: 'text', text: `Call ${GUIDE_TOOL_NAME} with {"style": <a style>} only; the styles are ${RISE_CURRENT_STYLES.join(', ')}.` }], isError: true });
  }
  return result(id, { content: [{ type: 'text', text: styleGuide(style) }] });
}

function read(id, params, origin, witness, card) {
  const style = GUIDE_URIS.get(params?.uri);
  if (style !== undefined) return result(id, { contents: [{ uri: params.uri, mimeType: GUIDE_MIME, text: styleGuide(style) }] });
  if (params?.uri !== APP_URI) return failure(id, -32002, 'Resource not found', { uri: typeof params?.uri === 'string' ? clip(params.uri, 200) : null });
  return result(id, {
    contents: [{
      uri: APP_URI,
      mimeType: APP_MIME,
      // The witness log (docs/plans/EMBED-WITNESS.md) is switched on by the demo config for one session; production never sets it.
      // The self-contained card (mcp-card.js) when the deployed page was given; the relay otherwise.
      text: card === null
        ? relayHtml({ origin, path: witness ? `${EMBED_PATH}&log=host` : EMBED_PATH })
        : cardHtml({ origin, indexHtml: card, path: witness ? `${EMBED_PATH}&log=host` : EMBED_PATH }),
      _meta: {
        ui: {
          // The app frames RISE's own page and nothing else, fetches nothing itself, and asks for no device.
          csp: card === null ? { frameDomains: [origin], connectDomains: [], resourceDomains: [] } : cardCsp(origin),
          prefersBorder: false
        },
        // ChatGPT's dedicated origin for the app (required to submit), under ChatGPT's own key: Claude validates
        // ui.domain against its own format and would refuse RISE's origin there.
        'openai/widgetDomain': origin,
        // Read by ChatGPT before the app loads, so that it picks the mode first: the modes the app declares at
        // ui/initialize (mcp-port.js), inline first; the app asks for another only when the reader does.
        'openai/ui': { availableDisplayModes: [...DISPLAY_MODES] },
        // Read by the host's model when the app loads, so that it need not describe the app itself.
        'openai/widgetDescription': 'A spoken reading of the answer, its words and a visual shown as they are spoken, which the reader starts with Play and can pause and resume.'
      }
    }]
  });
}

/** One JSON-RPC message, answered. `null` for one that is not answered (a notification or a response). */
export function dispatch(message, origin, { gate0 = false, witness = false, card = null } = {}) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') {
    return failure(null, -32600, 'Invalid request');
  }
  const { id, method, params } = message;
  if (typeof method !== 'string') return http(202, null);
  if (id === undefined) return http(202, null);
  if (typeof id !== 'string' && typeof id !== 'number') return failure(null, -32600, 'Invalid request');

  switch (method) {
    case 'initialize': {
      const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
      return result(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS
      });
    }
    case 'ping': return result(id, {});
    case 'tools/list': return result(id, { tools: gate0 ? [TOOL, GUIDE_TOOL, GATE0_TOOL] : [TOOL, GUIDE_TOOL] });
    case 'tools/call': {
      if (params?.name === GUIDE_TOOL_NAME) return guide(id, params);
      if (!gate0 || params?.name !== GATE0_TOOL_NAME) return call(id, params);
      const probe = callGate0(params.arguments, Date.now());
      if (probe.log) console.log(probe.log);
      return result(id, probe.result);
    }
    case 'resources/list':
      return result(id, {
        resources: [
          { uri: APP_URI, name: 'rise-current', title: 'RISE', description: 'Plays a Current: spoken in the device’s own voice and shown as it is spoken.', mimeType: APP_MIME },
          ...[...GUIDE_URIS].map(([uri, style]) => ({
            uri, name: `rise-guide-${style}`, title: `RISE style: ${style}`,
            description: `The format reference for the ${style} style, with worked Currents.`, mimeType: GUIDE_MIME
          }))
        ]
      });
    case 'resources/read': return read(id, params, origin, witness, card);
    default: return failure(id, -32601, 'Method not found');
  }
}

export async function handleMcp(request, env) {
  if (env?.MCP_ENABLED !== 'true') return http(503, { error: { code: 'MCP_UNAVAILABLE', message: 'RISE is not switched on as an MCP server.' } });
  const origin = new URL(request.url).origin;
  // A host's own server sends no Origin. A page in a browser does, and only ours may.
  const sent = request.headers.get('Origin');
  if (sent !== null && sent !== origin) return http(403, { error: { code: 'ORIGIN_DENIED', message: 'Requests from another origin are not accepted.' } });
  if (request.method !== 'POST') return http(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, { Allow: 'POST' });
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return http(415, { error: { code: 'JSON_REQUIRED', message: 'Send application/json.' } });
  }
  // A client names the version it negotiated. A malformed one is refused before anything is read; a
  // well-formed one this server does not list is served, because a host speaking a newer revision is
  // answered in this server's newest at initialize and must not be shut out of the subset it uses.
  const version = request.headers.get('MCP-Protocol-Version');
  if (version !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(version)) {
    return http(400, { error: { code: 'UNSUPPORTED_PROTOCOL_VERSION', message: `This server speaks MCP ${PROTOCOL_VERSIONS.join(', ')}.` } });
  }
  // Each client address but Anthropic's shared egress is held to the limiter live answers use
  // (wrangler.production.jsonc), before the body is read, so that every request is charged, a malformed
  // or oversized one too. It fails open: with no limiter or no address (tests, a local run), or a limiter
  // that fails, the request is served, because the route holds nothing and spends nothing a limit would protect.
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (ip && !inAnthropicEgress(ip) && typeof env.DECISION_LIMITER?.limit === 'function') {
    let allowed = true;
    try {
      allowed = (await env.DECISION_LIMITER.limit({ key: `mcp:${ip}` }))?.success === true;
    } catch {
      /* the platform's fault, not the host's */
    }
    if (!allowed) {
      // The bounded body is read only to carry the request's id back; anything unreadable answers with none.
      let id = null;
      try {
        const sent = JSON.parse(await readText(request, MAX_BODY_BYTES))?.id;
        if (typeof sent === 'string' || typeof sent === 'number') id = sent;
      } catch {
        /* too large or not JSON: the limit is answered all the same */
      }
      return http(429, {
        jsonrpc: '2.0', id,
        error: {
          code: -32000,
          message: 'Too many requests from this address in the last minute. Try again in a minute.',
          data: { code: 'RATE_LIMITED', retryAfterSeconds: RETRY_AFTER_SECONDS }
        }
      }, { 'Retry-After': String(RETRY_AFTER_SECONDS) });
    }
  }
  let text;
  try {
    text = await readText(request, MAX_BODY_BYTES);
  } catch (error) {
    return error?.message === 'size'
      ? http(413, { error: { code: 'TOO_LARGE', message: 'The request is too large.' } })
      : failure(null, -32700, 'Parse error');
  }
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return failure(null, -32700, 'Parse error');
  }
  if (Array.isArray(message)) return failure(null, -32600, 'Batches are not supported');
  // The self-contained card is the deployed page itself, read when the host asks for the app.
  let card = null;
  if (env.MCP_SELF_CONTAINED === 'true' && message?.method === 'resources/read' && message.params?.uri === APP_URI && typeof env.ASSETS?.fetch === 'function') {
    try {
      const page = await env.ASSETS.fetch(new Request(`${origin}/index.html`));
      if (page.ok) card = await page.text();
    } catch {
      /* the relay card is served instead */
    }
  }
  return dispatch(message, origin, { gate0: env.MCP_GATE0 === 'true', witness: env.MCP_WITNESS === 'true', card });
}

/**
 * `/live`, for the page an MCP app frames. A page may not be framed by another site, and RISE's
 * headers say so everywhere; this one page, asked for as `?embed=mcp` and only while MCP_ENABLED
 * is 'true', may be framed by any site, because the host's sandbox is on an origin RISE cannot
 * know. Nothing else about the response changes, and every other request for `/live` is the asset's.
 */
export async function handleLive(request, env) {
  if (typeof env?.ASSETS?.fetch !== 'function') return http(503, { error: { code: 'ASSETS_UNAVAILABLE', message: 'The site is not available.' } });
  const response = await env.ASSETS.fetch(request);
  // With the self-contained card (MCP_SELF_CONTAINED) nothing legitimately frames this page, so it keeps RISE's framing headers.
  const embedded = env.MCP_ENABLED === 'true' && env.MCP_SELF_CONTAINED !== 'true' && (request.method === 'GET' || request.method === 'HEAD')
    && new URL(request.url).searchParams.get('embed') === 'mcp';
  if (!embedded) return response;
  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');
  const policy = headers.get('Content-Security-Policy');
  if (policy) headers.set('Content-Security-Policy', policy.replace(/frame-ancestors[^;]*/u, 'frame-ancestors *'));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
