export const CLIENT_LOG_LIMIT = 128;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u;

function exactRecord(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === allowed.length && keys.every(key => typeof key === 'string' && allowed.includes(key)
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

export function validateVisualSnapshot(value) {
  const keys = ['runId', 'sequence', 'visual', 'intensity', 'serverReceivedAt', 'serverAppliedAt'];
  if (!exactRecord(value, keys) || !UUID.test(value.runId) || !Number.isSafeInteger(value.sequence) || value.sequence < 1) return null;
  const validUtc = text => typeof text === 'string' && ISO_UTC.test(text) && Number.isFinite(Date.parse(text));
  if (!validUtc(value.serverReceivedAt) || !validUtc(value.serverAppliedAt)) return null;
  if (value.visual === 'attractor') {
    if (typeof value.intensity !== 'number' || !Number.isFinite(value.intensity) || value.intensity < 0.4 || value.intensity > 0.75) return null;
  } else if (value.visual !== 'still' || value.intensity !== null) return null;
  return Object.freeze({ runId: value.runId, sequence: value.sequence, visual: value.visual, intensity: value.intensity, serverReceivedAt: value.serverReceivedAt, serverAppliedAt: value.serverAppliedAt });
}

export function acceptVisualResult(value, { trustedParent, apply, lastSequence = 0, runId = null } = {}) {
  if (!trustedParent) return { status: 'ignored' };
  let size;
  try { size = new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return { status: 'refused' }; }
  if (size > 4096) return { status: 'refused' };
  const snapshot = validateVisualSnapshot(value);
  if (!snapshot) return { status: 'refused' };
  if (runId !== null && snapshot.runId !== runId) return { status: 'refused' };
  if (snapshot.sequence === lastSequence && lastSequence !== 0) return { status: 'duplicate', snapshot };
  if (snapshot.sequence < lastSequence) return { status: 'stale', snapshot };
  if (typeof apply !== 'function' || apply(snapshot) === false) return { status: 'refused', snapshot };
  return { status: 'applied', snapshot };
}

export function createVisualController({ mountAttractor, setIntensity, showStill, clock = () => new Date().toISOString(), requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id), onRecord = () => {} }) {
  let sequence = 0;
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
    get sequence() { return sequence; },
    get runId() { return runId; },
    get log() { return log.slice(); },
    accept(value, trustedParent) {
      if (stopped) return { status: 'ignored' };
      const receivedAt = clock();
      let entry;
      const decision = acceptVisualResult(value, { trustedParent, lastSequence: sequence, runId, apply(snapshot) {
        if (snapshot.visual === 'attractor') {
          if (renderer) {
            if (setIntensity(snapshot.intensity, renderer) === false) return false;
          } else {
            renderer = mountAttractor(snapshot.intensity);
            if (!renderer) return false;
          }
        } else {
          if (renderer) renderer.destroy();
          renderer = null;
          showStill();
        }
        return true;
      } });
      entry = { runId: decision.snapshot?.runId ?? runId, sequence: decision.snapshot?.sequence ?? null, serverReceivedAt: decision.snapshot?.serverReceivedAt ?? null, serverAppliedAt: decision.snapshot?.serverAppliedAt ?? null, toolResultReceivedAt: receivedAt, visualAppliedAt: decision.status === 'applied' ? clock() : null, animationFrameObservedAt: null, status: decision.status, visual: decision.snapshot?.visual ?? null };
      record(entry);
      if (decision.status === 'applied') {
        sequence = decision.snapshot.sequence;
        runId = decision.snapshot.runId;
        if (frameId !== null) cancelFrame(frameId);
        frameId = requestFrame(() => {
          frameId = null;
          if (stopped || sequence !== decision.snapshot.sequence) return;
          entry.animationFrameObservedAt = clock();
          onRecord({ ...entry });
        });
      }
      return decision;
    },
    appendEvidence(entry) { if (!stopped) record(entry); },
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
