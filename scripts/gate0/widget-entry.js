import { AttractorField } from '../../src/visuals/attractor.js';
import { createVisualController, CLIENT_LOG_LIMIT } from './widget-runtime.mjs';

const surface = document.querySelector('#surface');
const status = document.querySelector('#status');
const list = document.querySelector('#log');
const instanceId = crypto.randomUUID();
const pending = new Map();
const cleanups = [];
let nextId = 0;
let stopped = false;

function send(method, params) {
  if (stopped || pending.size >= 4) return Promise.reject(new Error('Widget is closing or host request limit reached'));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Host acknowledgement timed out')); }, 8000);
    pending.set(id, { resolve, reject, timer });
    parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}

function showStill() {
  surface.replaceChildren();
  const still = document.createElement('div');
  still.className = 'still-surface';
  still.textContent = 'STATIC STILL SURFACE';
  surface.append(still);
}

const controller = createVisualController({
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
    const changed = field.setIntensity(intensity);
    if (changed) surface.dataset.intensity = String(intensity);
    return changed;
  },
  showStill,
  onRecord: renderLog
});

function renderLog() {
  list.replaceChildren();
  for (const item of controller.log.slice(-CLIENT_LOG_LIMIT)) {
    const row = document.createElement('li');
    row.textContent = JSON.stringify({ runId: controller.runId, widgetInstanceId: instanceId, ...item });
    list.append(row);
  }
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
    if (message.error || message.result?.isError === true) item.reject(new Error('Host rejected request'));
    else item.resolve(message.result);
    return;
  }
  if (message.id === undefined && message.method === 'ui/notifications/tool-result') {
    const decision = controller.accept(message.params?.structuredContent, true);
    status.textContent = `Widget status: ${decision.status}${decision.snapshot ? `, sequence ${decision.snapshot.sequence}` : ''}.`;
    if (decision.status === 'applied') surface.dataset.sequence = String(decision.snapshot.sequence);
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

function evidence(kind) {
  controller.appendEvidence({ type: 'manual_voice_observation', evidence: 'manual', kind, observedAt: new Date().toISOString() });
}

function marker(method, label) {
  const entry = { type: 'reader_marker', evidence: 'host_rpc', method, dispatchedAt: new Date().toISOString(), acknowledgmentAt: null, acknowledgment: 'pending' };
  controller.appendEvidence(entry);
  document.querySelector('#reader-status').textContent = `${label}: dispatched; waiting for host acknowledgment.`;
  send(method, method === 'ui/message'
    ? { role: 'user', content: [{ type: 'text', text: 'RISE GATE 0 READER MARKER' }] }
    : { content: [{ type: 'text', text: 'RISE GATE 0 READER MARKER' }] }).then(() => {
    entry.acknowledgmentAt = new Date().toISOString();
    entry.acknowledgment = 'host_rpc_acknowledged; voice receipt unverified';
    renderLog();
    document.querySelector('#reader-status').textContent = `${label}: host RPC acknowledged. This does not prove the voice model saw or answered.`;
  }).catch(error => {
    if (stopped) return;
    entry.acknowledgmentAt = new Date().toISOString();
    entry.acknowledgment = error.message === 'Host rejected request' ? 'host_rpc_rejected' : 'host_rpc_failed_or_timed_out';
    renderLog();
    if (error.message === 'Host rejected request') document.querySelector('#reader-status').textContent = `${label}: host rejected the request.`;
  });
}

function teardown() {
  if (stopped) return;
  stopped = true;
  controller.teardown();
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Widget torn down')); }
  pending.clear();
  while (cleanups.length) cleanups.pop()();
  surface.replaceChildren();
  document.body.dataset.teardown = 'complete';
}

addListener(window, 'message', onMessage);
addListener(window, 'pagehide', teardown);
for (const [id, fn] of [
  ['context', () => marker('ui/update-model-context', 'Model context update')],
  ['message', () => marker('ui/message', 'Message to conversation')],
  ['speech-start', () => evidence('speech_start')],
  ['speech-end', () => evidence('speech_end')],
  ['voice-ack', () => evidence('audible_reader_acknowledgment')]
]) addListener(document.getElementById(id), 'click', fn);
addListener(document.getElementById('export'), 'click', () => {
  const data = { runId: controller.runId, widgetInstanceId: instanceId, entries: controller.log };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rise-gate0-log.json';
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#instance').textContent = `Widget instance ${instanceId}; a host-created replacement gets a new ID.`;
send('ui/initialize', { appInfo: { name: 'rise-gate0', version: '0.1.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' })
  .then(() => parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*'))
  .catch(() => { status.textContent = 'Widget status: host initialization failed.'; });
