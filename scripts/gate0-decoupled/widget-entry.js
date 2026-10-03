import { AttractorField } from '../../src/visuals/attractor.js';
import { CLIENT_LOG_LIMIT, createWidgetController } from './widget-runtime.mjs';

const surface = document.querySelector('#surface');
const status = document.querySelector('#status');
const list = document.querySelector('#log');
const instanceId = crypto.randomUUID();
const pending = new Map();
const cleanups = [];
let nextId = 0;
let stopped = false;
let initialSeen = false;

const now = () => new Date().toISOString();
const errorCategory = code => code === -32601 ? 'unsupported_method' : code === -32602 ? 'invalid_request' : code === -32001 ? 'permission_refused' : 'host_error';
const showStill = () => {
  surface.replaceChildren();
  const still = document.createElement('div');
  still.className = 'still-surface';
  still.textContent = 'STATIC STILL SURFACE';
  surface.append(still);
};

function renderLog() {
  list.replaceChildren();
  for (const item of controller.log.slice(-CLIENT_LOG_LIMIT)) {
    const row = document.createElement('li');
    row.textContent = JSON.stringify({ widgetInstanceId: instanceId, ...item });
    list.append(row);
  }
}

const controller = createWidgetController({
  mountAttractor(intensity) {
    surface.replaceChildren();
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0';
    surface.append(host);
    const field = new AttractorField(host, { intensity, adaptive: false });
    surface.dataset.rendererId = instanceId;
    surface.dataset.intensity = String(intensity);
    return field;
  },
  setIntensity(intensity, field) {
    const accepted = field.setIntensity(intensity);
    if (accepted) surface.dataset.intensity = String(intensity);
    return accepted;
  },
  showStill,
  onRecord: renderLog
});

function updateSurface(snapshot, source, decision) {
  if (snapshot) surface.dataset.serverSequence = String(snapshot.sequence);
  if (decision.status === 'applied') {
    surface.dataset.appliedSequence = String(snapshot.sequence);
    surface.dataset.runId = snapshot.runId;
    surface.dataset.rendererId = controller.renderer ? instanceId : '';
    document.querySelector('#server-sequence').textContent = `Server sequence ${snapshot.sequence}`;
    document.querySelector('#applied-sequence').textContent = `Widget applied sequence ${snapshot.sequence}`;
    document.querySelector('#delivery-source').textContent = `Delivery source: ${source}`;
    document.querySelector('#server-times').textContent = `Admission received ${snapshot.serverReceivedAt ?? 'none'}; applied ${snapshot.serverAppliedAt ?? 'none'}; observed ${snapshot.observedAt}.`;
  }
  status.textContent = `Widget status: ${decision.status}${snapshot ? `, server sequence ${snapshot.sequence}` : ''}${decision.status === 'applied' ? `, widget applied ${snapshot.sequence}` : ''}.`;
}

function logError(kind, error) {
  controller.appendEvidence({ type: kind, at: now(), errorCode: Number.isSafeInteger(error?.code) ? error.code : null, errorCategory: error?.category ?? 'host_error' });
}

function send(method, params = {}) {
  if (stopped) return Promise.reject(Object.assign(new Error('Widget stopped'), { category: 'stopped' }));
  if (pending.size >= 4) return Promise.reject(Object.assign(new Error('Host request limit reached'), { category: 'request_limit' }));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Object.assign(new Error('Host request timed out'), { category: 'timeout' }));
    }, 8000);
    pending.set(id, { resolve, reject, timer, method });
    parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}

function callTool(name, args, source) {
  return send('tools/call', { name, arguments: args }).then(result => {
    if (result?.isError === true) throw Object.assign(new Error('Host refused the tool call'), { category: 'tool_refusal' });
    const snapshot = result?.structuredContent;
    const decision = controller.accept(snapshot, source);
    updateSurface(decision.snapshot ?? null, source, decision);
    return decision;
  }).catch(error => {
    if (!stopped) {
      logError('host_request_error', error);
      document.querySelector('#reader-status').textContent = `${name}: ${error.category === 'timeout' ? 'host request timed out' : error.category === 'tool_refusal' ? 'host refused the request' : 'host request failed'}.`;
    }
    return { status: 'request_failed' };
  });
}

function messageSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return Infinity; }
}

function onMessage(event) {
  if (stopped || event.source !== parent || messageSize(event.data) > 8192) return;
  const message = event.data;
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') return;
  if (message.id !== undefined && message.method === undefined) {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) {
      const code = Number.isSafeInteger(message.error.code) ? message.error.code : null;
      item.reject(Object.assign(new Error('Host RPC failed'), { code, category: errorCategory(code) }));
    } else item.resolve(message.result);
    return;
  }
  if (message.id === undefined && message.method === 'ui/notifications/tool-result') {
    const data = message.params?.structuredContent;
    const source = initialSeen ? 'host_notification' : 'initial_render';
    const decision = controller.accept(data, source);
    if (decision.status === 'applied' && source === 'initial_render') initialSeen = true;
    updateSurface(decision.snapshot ?? null, source, decision);
    return;
  }
  if (message.method === 'ui/resource-teardown' && (typeof message.id === 'string' || (typeof message.id === 'number' && Number.isSafeInteger(message.id)))) {
    event.source.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
    teardown();
  }
}

function addListener(target, type, listener) {
  target.addEventListener(type, listener);
  cleanups.push(() => target.removeEventListener(type, listener));
}

function marker(method, label) {
  const entry = { type: 'reader_marker', deliverySource: 'reader_action', method, dispatchedAt: now(), acknowledgmentAt: null, acknowledgment: 'pending' };
  controller.appendEvidence(entry);
  document.querySelector('#reader-status').textContent = `${label}: sent; waiting for host acknowledgment.`;
  send(method, method === 'ui/message'
    ? { role: 'user', content: [{ type: 'text', text: 'RISE GATE 0 READER MARKER' }] }
    : { content: [{ type: 'text', text: 'RISE GATE 0 READER MARKER' }] }).then(() => {
    if (stopped) return;
    entry.acknowledgmentAt = now();
    entry.acknowledgment = 'host_rpc_acknowledged; model receipt unverified';
    renderLog();
    document.querySelector('#reader-status').textContent = `${label}: host RPC acknowledged; model receipt unverified.`;
  }).catch(error => {
    if (stopped) return;
    entry.acknowledgmentAt = now();
    entry.acknowledgment = Number.isSafeInteger(error.code) ? 'host_rpc_rejected' : error.category === 'timeout' ? 'host_rpc_timed_out' : 'host_rpc_failed';
    entry.errorCode = Number.isSafeInteger(error.code) ? error.code : null;
    entry.errorCategory = error.category ?? 'host_error';
    renderLog();
    document.querySelector('#reader-status').textContent = `${label}: ${entry.acknowledgment} (${entry.errorCategory}${entry.errorCode === null ? '' : ` ${entry.errorCode}`}).`;
  });
}

function teardown() {
  if (stopped) return;
  stopped = true;
  controller.teardown();
  for (const item of pending.values()) {
    clearTimeout(item.timer);
    item.reject(Object.assign(new Error('Widget stopped'), { category: 'stopped' }));
  }
  pending.clear();
  while (cleanups.length) cleanups.pop()();
  surface.replaceChildren();
  document.body.dataset.stopped = 'true';
}

addListener(window, 'message', onMessage);
addListener(window, 'pagehide', teardown);
for (const [id, listener] of [
  ['set-04', () => callTool('rise_set_visual', { runId: controller.runId, visual: 'attractor', intensity: 0.4 }, 'reader_mutation')],
  ['set-075', () => callTool('rise_set_visual', { runId: controller.runId, visual: 'attractor', intensity: 0.75 }, 'reader_mutation')],
  ['still', () => callTool('rise_set_visual', { runId: controller.runId, visual: 'still' }, 'reader_mutation')],
  ['read', () => callTool('rise_read_visual', { runId: controller.runId }, 'manual_read')],
  ['stop', teardown],
  ['context', () => marker('ui/update-model-context', 'Model context update')],
  ['message', () => marker('ui/message', 'Message to conversation')]
]) addListener(document.getElementById(id), 'click', listener);
addListener(document.getElementById('export'), 'click', () => {
  const data = { runId: controller.runId, widgetInstanceId: instanceId, entries: controller.log };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rise-gate0-decoupled-log.json';
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#instance').textContent = `Widget instance ${instanceId}.`;
send('ui/initialize', { appInfo: { name: 'rise-gate0-decoupled', version: '0.1.0' }, appCapabilities: {}, protocolVersion: '2025-11-25' })
  .then(() => { if (!stopped) parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*'); })
  .catch(error => { if (!stopped) { logError('initialize_error', error); status.textContent = 'Widget status: host initialization failed.'; } });
