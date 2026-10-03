import { createRunState, dispatch, mutateVisual, startGate0Server, APP_MIME, PROTOCOL_VERSIONS } from '../gate0/server.mjs';

export const DECOUPLED_WIDGET_URI = 'ui://rise/gate0/v2.html';
const OPEN_TOOL = 'rise_open_visual';
const SET_TOOL = 'rise_set_visual';
const READ_TOOL = 'rise_read_visual';

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataRecord(value, allowedKeys, requiredKeys = []) {
  if (!plainObject(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string' || !allowedKeys.includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => !Object.hasOwn(descriptors[key], 'value')) || requiredKeys.some(key => !Object.hasOwn(descriptors, key))) return null;
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

export function createDecoupledRunState(options = {}) {
  return createRunState(options);
}

function snapshot(state) {
  const mutation = state.log.at(-1);
  return Object.freeze({
    runId: state.runId,
    sequence: state.sequence,
    visual: state.visual,
    intensity: state.intensity,
    serverReceivedAt: mutation?.serverReceivedAt ?? null,
    serverAppliedAt: mutation?.serverAppliedAt ?? null,
    observedAt: state.now()
  });
}

const toolReply = (id, result) => new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const rpcError = (id, code, message) => new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const noContent = () => new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } });
const dataError = message => ({ isError: true, content: [{ type: 'text', text: message }] });
const dataSuccess = (data, message) => ({ structuredContent: data, content: [{ type: 'text', text: message }] });

const toolDefinitions = widgetUri => [
  {
    name: OPEN_TOOL,
    title: 'Open visual surface',
    description: 'Open the visual surface once to start this run. Use rise_set_visual afterward to change the existing surface.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: widgetUri, visibility: ['model'], prefersBorder: true }, 'openai/outputTemplate': widgetUri }
  },
  {
    name: SET_TOOL,
    title: 'Set visual state',
    description: 'Mutate the current RAM run’s visual state. Pass its current runId. This updates server state; it does not promise delivery to an already open widget.',
    inputSchema: { type: 'object', properties: { runId: { type: 'string' }, visual: { type: 'string', enum: ['attractor', 'still'] }, intensity: { type: 'number', minimum: 0.4, maximum: 0.75 } }, required: ['runId', 'visual'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ['model', 'app'] } }
  },
  {
    name: READ_TOOL,
    title: 'Read visual state',
    description: 'Read the current RAM run snapshot. A reader-initiated read is diagnostic and is not automatic widget delivery.',
    inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ['model', 'app'] } }
  }
];

function callTool(name, args, state, widgetUri) {
  if (name === OPEN_TOOL) {
    const safeArgs = dataRecord(args, []);
    if (!safeArgs || Reflect.ownKeys(safeArgs).length !== 0) return dataError('Refused open request. Use an empty object. No state changed.');
    return { ...dataSuccess(snapshot(state), 'Opened the current visual run without changing its sequence.'), _meta: { ui: { resourceUri: widgetUri } } };
  }
  if (name === READ_TOOL) {
    const safeArgs = dataRecord(args, ['runId'], ['runId']);
    if (!safeArgs || typeof safeArgs.runId !== 'string' || safeArgs.runId !== state.runId) return dataError('Refused read request. Supply the current runId. No state changed.');
    return dataSuccess(snapshot(state), 'Read the current visual run without changing its sequence.');
  }
  if (name === SET_TOOL) {
    const safeArgs = dataRecord(args, ['runId', 'visual', 'intensity'], ['runId', 'visual']);
    if (!safeArgs || typeof safeArgs.runId !== 'string' || safeArgs.runId !== state.runId) return dataError('Refused mutation. Supply the current runId. No state changed.');
    const mutationArgs = { visual: safeArgs.visual };
    if (Object.hasOwn(safeArgs, 'intensity')) mutationArgs.intensity = safeArgs.intensity;
    const result = mutateVisual(state, mutationArgs, state.now());
    if (result.isError) return result;
    return dataSuccess(snapshot(state), result.content[0].text);
  }
  return null;
}

export function dispatchDecoupled(message, state, widgetHtml) {
  if (!plainObject(message) || message.jsonrpc !== '2.0') return rpcError(null, -32600, 'Invalid request');
  const { id, method, params } = message;
  if (typeof method !== 'string' || id === undefined) return noContent();
  if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isFinite(id))) return rpcError(null, -32600, 'Invalid request');
  if (method === 'tools/list') return toolReply(id, { tools: toolDefinitions(DECOUPLED_WIDGET_URI) });
  if (method === 'tools/call') {
    const name = params?.name;
    const result = callTool(name, params?.arguments, state, DECOUPLED_WIDGET_URI);
    return result ? toolReply(id, result) : rpcError(id, -32602, 'Unknown tool');
  }
  if (method === 'resources/list') return toolReply(id, { resources: [{ uri: DECOUPLED_WIDGET_URI, name: 'rise-gate0-decoupled', title: 'RISE Gate 0 decoupled visual surface', description: 'Local experimental visual widget.', mimeType: APP_MIME }] });
  if (method === 'resources/read') {
    if (params?.uri !== DECOUPLED_WIDGET_URI) return rpcError(id, -32002, 'Resource not found');
    return toolReply(id, { contents: [{ uri: DECOUPLED_WIDGET_URI, mimeType: APP_MIME, text: widgetHtml, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } } }] });
  }
  if (method === 'initialize') {
    const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
    return toolReply(id, { protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0], capabilities: { tools: { listChanged: false }, resources: { listChanged: false } }, serverInfo: { name: 'rise-gate0-decoupled', title: 'RISE Gate 0 decoupled local experiment', version: '0.1.0' }, instructions: 'Local experiment only. Open the visual surface once, then use rise_set_visual for mutations and rise_read_visual for explicit diagnostic reads. The server holds one RAM-only run and resets on restart.' });
  }
  if (method === 'ping') return toolReply(id, {});
  return dispatch(message, state, widgetHtml);
}

export async function startDecoupledServer({ port = 4320, widgetHtml, testHarnessHtml = null, state } = {}) {
  if (typeof widgetHtml !== 'string') throw new TypeError('widgetHtml must be supplied as a string');
  const runState = state ?? createDecoupledRunState();
  return startGate0Server({
    port,
    testHarnessHtml,
    state: runState,
    dispatchRequest: (message, currentState, html) => dispatchDecoupled(message, currentState, html),
    widgetHtml
  });
}
