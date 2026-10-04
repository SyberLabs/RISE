import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { ATTRACTOR_VISUAL_MANIFEST } from '../../src/core/visual-control-contract.js';

export const MCP_PATH = '/mcp';
export const WIDGET_URI = 'ui://rise/gate0/v1.html';
export const APP_MIME = 'text/html;profile=mcp-app';
export const TOOL_NAME = 'rise_set_visual';
export const MAX_BODY_BYTES = 16_384;
export const MAX_LOG_ENTRIES = 128;
export const PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const TOOL = Object.freeze({
  name: TOOL_NAME,
  title: 'Set experiment visual',
  description: 'Use this during the local Gate 0 experiment to set the persistent visual surface to the RISE attractor or a still surface. This mutates the current in-memory experiment run; repeat calls advance its sequence. Attractor intensity is optional and bounded; still does not take intensity.',
  inputSchema: {
    type: 'object',
    properties: {
      visual: { type: 'string', enum: ['attractor', 'still'] },
      intensity: { type: 'number', minimum: 0.4, maximum: 0.75 }
    },
    required: ['visual'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  _meta: {
    ui: { resourceUri: WIDGET_URI, prefersBorder: true },
    'openai/outputTemplate': WIDGET_URI,
    'openai/widgetDescription': 'A local Gate 0 feasibility probe with one persistent visual and a factual timing log.'
  }
});

export function createRunState({ runId = randomUUID(), now = () => new Date().toISOString(), logLimit = MAX_LOG_ENTRIES } = {}) {
  if (!Number.isInteger(logLimit) || logLimit < 1 || logLimit > MAX_LOG_ENTRIES) throw new RangeError('logLimit is outside the Gate 0 bound');
  return { runId, now, logLimit, sequence: 0, visual: 'still', intensity: null, log: [] };
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validArgs(args) {
  if (!plainObject(args)) return false;
  const keys = Reflect.ownKeys(args);
  if (keys.some(key => typeof key !== 'string' || !['visual', 'intensity'].includes(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(args);
  if (keys.some(key => !Object.hasOwn(descriptors[key], 'value'))) return false;
  if (args.visual === 'attractor') {
    if (Object.hasOwn(args, 'intensity')) {
      const value = args.intensity;
      const bounds = ATTRACTOR_VISUAL_MANIFEST.parameters.intensity;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.minimum || value > bounds.maximum) return false;
    }
    return true;
  }
  return args.visual === 'still' && !Object.hasOwn(args, 'intensity');
}

function toolError(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export function mutateVisual(state, args, receivedAt = state.now()) {
  if (!validArgs(args)) return toolError('Refused visual request. Use {visual:"attractor"|"still"}; intensity is allowed only for attractor and must be within its manifest bounds. No state changed.');
  const visual = args.visual;
  const intensity = visual === 'attractor'
    ? (Object.hasOwn(args, 'intensity') ? args.intensity : ATTRACTOR_VISUAL_MANIFEST.parameters.intensity.default)
    : null;
  const snapshot = Object.freeze({
    runId: state.runId,
    sequence: state.sequence + 1,
    visual,
    intensity,
    serverReceivedAt: receivedAt,
    serverAppliedAt: state.now()
  });
  state.sequence = snapshot.sequence;
  state.visual = visual;
  state.intensity = intensity;
  state.log.push(snapshot);
  if (state.log.length > state.logLimit) state.log.splice(0, state.log.length - state.logLimit);
  return { structuredContent: snapshot, content: [{ type: 'text', text: `Applied visual mutation ${snapshot.sequence} to this Gate 0 run.` }] };
}

const success = (id, result) => new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const error = (id, code, message) => new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const empty = () => new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } });

export function dispatch(message, state, widgetHtml) {
  if (!plainObject(message) || message.jsonrpc !== '2.0') return error(null, -32600, 'Invalid request');
  const { id, method, params } = message;
  if (typeof method !== 'string') return empty();
  if (id === undefined) return empty();
  if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isFinite(id))) return error(null, -32600, 'Invalid request');
  switch (method) {
    case 'initialize': {
      const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
      return success(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'rise-gate0', title: 'RISE Gate 0 local probe', version: '0.1.0' },
        instructions: 'Local experiment only. Use rise_set_visual to change the attractor or still surface. The server holds one RAM-only run and resets on restart. Do not infer speech timing from tool timing.'
      });
    }
    case 'ping': return success(id, {});
    case 'tools/list': return success(id, { tools: [TOOL] });
    case 'tools/call': {
      if (params?.name !== TOOL_NAME) return error(id, -32602, 'Unknown tool');
      const result = mutateVisual(state, params.arguments, state.now());
      return success(id, result);
    }
    case 'resources/list':
      return success(id, { resources: [{ uri: WIDGET_URI, name: 'rise-gate0', title: 'RISE Gate 0 probe', description: 'Self-contained local experiment widget.', mimeType: APP_MIME }] });
    case 'resources/read':
      if (params?.uri !== WIDGET_URI) return error(id, -32002, 'Resource not found');
      return success(id, { contents: [{
        uri: WIDGET_URI,
        mimeType: APP_MIME,
        text: widgetHtml,
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true }, 'openai/widgetDescription': 'A local Gate 0 feasibility probe with a persistent visual and a bounded factual timing log.' }
      }] });
    default: return error(id, -32601, 'Method not found');
  }
}

async function readJson(request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return { tooLarge: true };
  const reader = request.body?.getReader();
  if (!reader) return { invalid: true };
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel(); return { tooLarge: true }; }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch { return { invalid: true }; }
}

export async function handleMcp(request, state, widgetHtml, expectedOrigin) {
  const url = new URL(request.url);
  if (url.pathname !== MCP_PATH) return new Response('Not found', { status: 404 });
  if (request.headers.get('origin') !== null && request.headers.get('origin') !== expectedOrigin) return new Response('Origin denied', { status: 403 });
  if (request.method !== 'POST') return new Response('Use POST', { status: 405, headers: { allow: 'POST' } });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return new Response('Send application/json', { status: 415 });
  const body = await readJson(request);
  if (body.tooLarge) return new Response('Request body too large', { status: 413 });
  if (body.invalid) return error(null, -32700, 'Parse error');
  if (Array.isArray(body.value)) return error(null, -32600, 'Batches are not supported');
  return dispatch(body.value, state, widgetHtml);
}

export async function buildWidgetHtml() {
  const result = await build({
    configFile: false, root: ROOT, mode: 'production', logLevel: 'silent',
    build: { write: false, emptyOutDir: false, minify: true,
      lib: { entry: resolve(ROOT, 'scripts/gate0/widget-entry.js'), formats: ['es'], fileName: 'gate0-widget.js' },
      rollupOptions: { output: { inlineDynamicImports: true } } }
  });
  const files = (Array.isArray(result) ? result : [result]).flatMap(output => output.output ?? []);
  const asset = files.find(file => file.type === 'chunk' && file.fileName.endsWith('.js'));
  if (!asset || asset.imports.length || asset.dynamicImports.length) throw new Error(`Gate 0 widget must bundle into one self-contained JavaScript module: ${JSON.stringify(files.map(file => ({ fileName: file.fileName, imports: file.imports, dynamicImports: file.dynamicImports })))}`);
  const script = asset.code.replace(/<\/script/giu, '<\/script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RISE Gate 0</title><style>${WIDGET_CSS}</style></head><body><main><h1>RISE Gate 0</h1><p id="instance">Waiting for the host’s visual result.</p><div id="surface" aria-label="Visual surface"></div><p>Renderer control applied means renderer state accepted the update. Frame callback observed means the browser ran a frame callback. Neither reads or verifies pixels.</p><p id="status" role="status">Widget status: waiting.</p><section><h2>Reader marker</h2><button id="context" type="button">Send marker to model context</button><button id="message" type="button">Send marker message</button><p id="reader-status">No reader marker sent.</p></section><section><h2>Manual voice observations</h2><button id="speech-start" type="button">Mark speech start</button><button id="speech-end" type="button">Mark speech end</button><button id="voice-ack" type="button">Mark audible reader acknowledgment</button><p>Manual observations only. This widget has no native speech callback and records no audio.</p></section><section><h2>Factual bounded log</h2><button id="export" type="button">Export log</button><ol id="log"></ol></section></main><script type="module">${script}</script></body></html>`;
}

const WIDGET_CSS = `:root{font:14px/1.45 system-ui,sans-serif;color:#eee;background:#111}*{box-sizing:border-box}body{margin:0;padding:12px}main{max-width:720px;margin:auto}h1,h2{font-weight:600}h1{font-size:1.1rem}h2{font-size:1rem;margin:.8em 0 .4em}p{margin:.45em 0;color:#bbb}button{margin:.25em .35em .25em 0;padding:.45em .65em;border:1px solid #555;border-radius:6px;background:#222;color:#eee}#surface{height:260px;position:relative;overflow:hidden;background:#050609;border:1px solid #333;border-radius:8px}#surface .attractor-canvas{position:absolute;inset:0;width:100%;height:100%}.still-surface{position:absolute;inset:0;display:grid;place-items:center;color:#777;background:#090a0d}#log{max-height:150px;overflow:auto;padding-left:2em;font:11px/1.35 ui-monospace,monospace}#log li{margin:.2em 0;overflow-wrap:anywhere}`;

export async function startGate0Server({ port = 4319, testHarnessHtml = null } = {}) {
  const widgetHtml = await buildWidgetHtml();
  const state = createRunState();
  let allowedOrigin;
  const server = createServer(async (incoming, response) => {
    try {
      if (incoming.method === 'GET' && incoming.url === '/__gate0/widget') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(widgetHtml);
        return;
      }
      if (testHarnessHtml && incoming.method === 'GET' && incoming.url === '/__gate0/host') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(testHarnessHtml);
        return;
      }
      const url = `${allowedOrigin}${incoming.url}`;
      const init = { method: incoming.method, headers: incoming.headers, duplex: 'half' };
      if (!['GET', 'HEAD'].includes(incoming.method)) init.body = incoming;
      const result = await handleMcp(new Request(url, init), state, widgetHtml, allowedOrigin);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Gate 0 local server error');
    }
  });
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', ready); });
  const address = server.address();
  allowedOrigin = `http://${address.address}:${address.port}`;
  return { server, state, widgetHtml, address };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { server, state, address } = await startGate0Server();
  console.log(`RISE Gate 0 local probe run ${state.runId} at http://127.0.0.1:${address.port}/mcp`);
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
