import { validateRiseCurrent } from '../src/core/rise-current.js';
import { MCP_CURRENT_BYTES, serializedUtf8Bytes } from '../src/live/hosts/mcp-size.js';
import { CURRENT_GUIDE, TOOL_NAME } from '../src/live/adapters/current-guide.js';
import { EMBED_PATH, relayHtml } from '../src/live/hosts/mcp-relay.js';
import { readText } from './live-realtime.mjs';
import { callGate0, GATE0_TOOL, GATE0_TOOL_NAME } from './mcp-gate0.mjs';

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
 * another site must not be able to make a browser talk to it), reads a bounded
 * body, and returns nothing it was sent except a validator's message, clipped.
 *
 * CHECKED AGAINST THE REFERENCE, NOT AGAINST A PRODUCT: the shapes below were
 * compared with @modelcontextprotocol/ext-apps 2.0.3 and the SDK's own client
 * (see docs/plans/LIVE-MCP.md for what was run). No product host has used it.
 */

export const MCP_PATH = '/api/mcp';
export const APP_URI = 'ui://rise/current';
export const APP_MIME = 'text/html;profile=mcp-app';
export const SERVER_INFO = Object.freeze({ name: 'rise', title: 'RISE', version: '1.0.0' });
/** Newest first. A client's version is answered with itself if it is here, and otherwise with the newest. */
export const PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const MAX_BODY_BYTES = 262_144;
const MAX_MESSAGE = 300;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

const INSTRUCTIONS = `RISE presents an answer to the reader as a spoken, visual reading. To answer with it, call ${TOOL_NAME} with a Current.`;

export const TOOL = Object.freeze({
  name: TOOL_NAME,
  title: 'Present a RISE Current',
  description: `Present your answer to the reader through RISE, which speaks it and shows it as it is spoken, and lets the reader stop at any place and ask about it. Write the answer as a Current and pass it as "current".\n\n${CURRENT_GUIDE}`,
  inputSchema: {
    type: 'object',
    properties: { current: { type: 'object', description: 'The Current, exactly as described.' } },
    required: ['current'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  // `ui` is the extension's key; the flat one is its older spelling, which some hosts still read.
  _meta: { ui: { resourceUri: APP_URI }, 'ui/resourceUri': APP_URI }
});

function http(status, body, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

const result = (id, value) => http(200, { jsonrpc: '2.0', id, result: value });
const failure = (id, code, message, data) => http(200, { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } });

/** The text of a refusal a model can act on: what was wrong and where. */
function refusal(error) {
  const message = String(error?.message ?? 'The Current was not valid').replace(/[\u0000-\u001F\u007F]/gu, ' ');
  return `RISE refused this Current: ${clip(message, MAX_MESSAGE)}. Correct it and call ${TOOL_NAME} again.`;
}

function call(id, params) {
  if (!params || typeof params !== 'object' || params.name !== TOOL_NAME) return failure(id, -32602, 'Unknown tool');
  const args = params.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args) || !args.current || typeof args.current !== 'object') {
    return result(id, { content: [{ type: 'text', text: `Call ${TOOL_NAME} with {"current": <a Current>}.` }], isError: true });
  }
  try {
    if (serializedUtf8Bytes(args.current) > MCP_CURRENT_BYTES) {
      throw new Error(`The Current exceeds the ${MCP_CURRENT_BYTES.toLocaleString('en-US')}-byte MCP limit`);
    }
    validateRiseCurrent(args.current);
  } catch (error) {
    return result(id, { content: [{ type: 'text', text: refusal(error) }], isError: true });
  }
  return result(id, {
    content: [{ type: 'text', text: 'RISE accepted this Current for presentation to the reader.' }],
    structuredContent: { current: args.current }
  });
}

function read(id, params, origin) {
  if (params?.uri !== APP_URI) return failure(id, -32002, 'Resource not found', { uri: typeof params?.uri === 'string' ? clip(params.uri, 200) : null });
  return result(id, {
    contents: [{
      uri: APP_URI,
      mimeType: APP_MIME,
      text: relayHtml({ origin, path: EMBED_PATH }),
      _meta: {
        ui: {
          // The app frames RISE's own page and nothing else, fetches nothing itself, and may use the microphone.
          csp: { frameDomains: [origin], connectDomains: [], resourceDomains: [] },
          permissions: { microphone: {} },
          prefersBorder: false
        }
      }
    }]
  });
}

/** One JSON-RPC message, answered. `null` for one that is not answered (a notification or a response). */
export function dispatch(message, origin, { gate0 = false } = {}) {
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
    case 'tools/list': return result(id, { tools: gate0 ? [TOOL, GATE0_TOOL] : [TOOL] });
    case 'tools/call': {
      if (!gate0 || params?.name !== GATE0_TOOL_NAME) return call(id, params);
      const probe = callGate0(params.arguments, Date.now());
      if (probe.log) console.log(probe.log);
      return result(id, probe.result);
    }
    case 'resources/list':
      return result(id, { resources: [{ uri: APP_URI, name: 'rise-current', title: 'RISE', description: 'Plays a Current, spoken and shown as it is spoken.', mimeType: APP_MIME }] });
    case 'resources/read': return read(id, params, origin);
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
  return dispatch(message, origin, { gate0: env.MCP_GATE0 === 'true' });
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
  const embedded = env.MCP_ENABLED === 'true' && (request.method === 'GET' || request.method === 'HEAD')
    && new URL(request.url).searchParams.get('embed') === 'mcp';
  if (!embedded) return response;
  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');
  const policy = headers.get('Content-Security-Policy');
  if (policy) headers.set('Content-Security-Policy', policy.replace(/frame-ancestors[^;]*/u, 'frame-ancestors *'));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
