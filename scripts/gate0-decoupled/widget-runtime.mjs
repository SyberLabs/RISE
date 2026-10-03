export const CLIENT_LOG_LIMIT = 128;
export const MAX_ENVELOPE_BYTES = 8192;
export const DELIVERY_SOURCES = Object.freeze(['initial_render', 'host_notification', 'reader_mutation', 'manual_read']);

const SNAPSHOT_KEYS = ['runId', 'sequence', 'visual', 'intensity', 'serverReceivedAt', 'serverAppliedAt', 'observedAt'];
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u;

function exactDataRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== 'string' || !keys.includes(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return ownKeys.every(key => Object.hasOwn(descriptors[key], 'value'));
}

const validUtc = value => typeof value === 'string' && UTC.test(value) && Number.isFinite(Date.parse(value));

export function validateSnapshot(value) {
  try {
    if (!exactDataRecord(value, SNAPSHOT_KEYS)
      || typeof value.runId !== 'string' || value.runId.length < 1 || value.runId.length > 128
      || !Number.isSafeInteger(value.sequence) || value.sequence < 0
      || !validUtc(value.observedAt)) return null;
    if (value.sequence === 0) {
      if (value.visual !== 'still' || value.intensity !== null || value.serverReceivedAt !== null || value.serverAppliedAt !== null) return null;
    } else if (!validUtc(value.serverReceivedAt) || !validUtc(value.serverAppliedAt)) return null;
    if (value.visual === 'attractor') {
      if (typeof value.intensity !== 'number' || !Number.isFinite(value.intensity) || value.intensity < 0.4 || value.intensity > 0.75) return null;
    } else if (value.visual !== 'still' || value.intensity !== null) return null;
    return Object.freeze({
      runId: value.runId, sequence: value.sequence, visual: value.visual, intensity: value.intensity,
      serverReceivedAt: value.serverReceivedAt, serverAppliedAt: value.serverAppliedAt, observedAt: value.observedAt
    });
  } catch {
    return null;
  }
}

function envelopeSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return Infinity; }
}

export function createWidgetController({ mountAttractor, setIntensity, showStill, clock = () => new Date().toISOString(), requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id), onRecord = () => {} }) {
  let sequence = null;
  let runId = null;
  let renderer = null;
  let stopped = false;
  let frameId = null;
  const log = [];
  const record = entry => {
    log.push(entry);
    if (log.length > CLIENT_LOG_LIMIT) log.splice(0, log.length - CLIENT_LOG_LIMIT);
    onRecord(entry);
  };
  return {
    get renderer() { return renderer; },
    get sequence() { return sequence ?? 0; },
    get runId() { return runId; },
    get log() { return log.slice(); },
    get stopped() { return stopped; },
    accept(value, deliverySource) {
      if (stopped) return { status: 'ignored' };
      const receivedAt = clock();
      let status = 'refused';
      let snapshot = null;
      if (DELIVERY_SOURCES.includes(deliverySource) && envelopeSize(value) <= MAX_ENVELOPE_BYTES) {
        snapshot = validateSnapshot(value);
        const validFirstDelivery = runId !== null || deliverySource === 'initial_render';
        if (snapshot && validFirstDelivery && (runId === null || snapshot.runId === runId)) {
          if (sequence !== null && snapshot.sequence === sequence) status = 'duplicate';
          else if (sequence !== null && snapshot.sequence < sequence) status = 'stale';
          else {
            try {
              if (snapshot.visual === 'attractor') {
                if (renderer) {
                  if (setIntensity(snapshot.intensity, renderer) !== true) status = 'refused';
                  else status = 'applied';
                } else {
                  const mounted = mountAttractor(snapshot.intensity);
                  if (mounted) { renderer = mounted; status = 'applied'; }
                }
              } else {
                if (renderer) renderer.destroy();
                renderer = null;
                showStill();
                status = 'applied';
              }
            } catch { status = 'renderer_error'; }
          }
        }
      }
      const entry = {
        runId: snapshot?.runId ?? runId,
        deliverySource: DELIVERY_SOURCES.includes(deliverySource) ? deliverySource : 'invalid_source',
        serverSequence: snapshot?.sequence ?? null,
        widgetAppliedSequence: null,
        serverReceivedAt: snapshot?.serverReceivedAt ?? null,
        serverAppliedAt: snapshot?.serverAppliedAt ?? null,
        observedAt: snapshot?.observedAt ?? null,
        bridgeReceivedAt: receivedAt,
        rendererAcceptedAt: null,
        animationFrameObservedAt: null,
        status,
        visual: snapshot?.visual ?? null
      };
      if (status === 'applied') {
        sequence = snapshot.sequence;
        runId = snapshot.runId;
        entry.widgetAppliedSequence = sequence;
        entry.rendererAcceptedAt = clock();
      }
      record(entry);
      if (status === 'applied') {
        if (frameId !== null) cancelFrame(frameId);
        const acceptedSequence = sequence;
        frameId = requestFrame(() => {
          frameId = null;
          if (stopped || sequence !== acceptedSequence) return;
          entry.animationFrameObservedAt = clock();
          onRecord({ ...entry });
        });
      }
      return { status, snapshot };
    },
    appendEvidence(entry) { if (!stopped) record({ ...entry }); },
    teardown() {
      if (stopped) return;
      stopped = true;
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      renderer?.destroy();
      renderer = null;
    }
  };
}
