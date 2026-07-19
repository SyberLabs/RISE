import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginVisualInterlocutionSession,
  endVisualInterlocutionSession,
  grantVisualInterlocutionConsent,
  hasVisualInterlocutionConsent,
  requestVisualInterlocutionConsent,
  VisualFlashGate,
  VISUAL_CONSENT_KEY
} from './visual-safety.js';

describe('visual safety boundary', () => {
  beforeEach(() => {
    endVisualInterlocutionSession();
    sessionStorage.clear();
    document.documentElement.classList.remove('photosensitivity-mode');
    document.body.innerHTML = `
      <div id="photosensitivity-modal" class="hidden">
        <button id="safety-cancel">Cancel</button>
        <button id="safety-accept">Accept</button>
      </div>`;
  });

  it('requires an explicit acceptance before recording consent', async () => {
    const pending = requestVisualInterlocutionConsent();
    expect(hasVisualInterlocutionConsent()).toBe(false);
    document.querySelector('#safety-accept').click();

    expect(await pending).toBe(true);
    expect(sessionStorage.getItem(VISUAL_CONSENT_KEY)).toBeNull();
    expect(hasVisualInterlocutionConsent()).toBe(true);
  });

  it('refuses consent prompts while photosensitivity mode is active', async () => {
    document.documentElement.classList.add('photosensitivity-mode');
    expect(await requestVisualInterlocutionConsent()).toBe(false);
    expect(hasVisualInterlocutionConsent()).toBe(false);
  });

  it('consumes acceptance into one active chamber session, then revokes it', async () => {
    const pending = requestVisualInterlocutionConsent();
    document.querySelector('#safety-accept').click();
    expect(await pending).toBe(true);

    expect(beginVisualInterlocutionSession()).toBe(true);
    expect(sessionStorage.getItem(VISUAL_CONSENT_KEY)).toBeNull();
    expect(hasVisualInterlocutionConsent()).toBe(true);

    endVisualInterlocutionSession();
    expect(hasVisualInterlocutionConsent()).toBe(false);
  });

  it('resolves an orphaned prompt when session ownership is torn down', async () => {
    const pending = requestVisualInterlocutionConsent();
    endVisualInterlocutionSession();

    expect(await pending).toBe(false);
    expect(document.querySelector('#photosensitivity-modal').classList.contains('hidden')).toBe(true);
  });

  it('bounds rapid full-frame bursts', () => {
    grantVisualInterlocutionConsent();
    const gate = new VisualFlashGate({ minIntervalMs: 100, burstWindowMs: 1000, maxBurst: 3 });

    expect(gate.allow(0)).toBe(true);
    expect(gate.allow(50)).toBe(false);
    expect(gate.allow(100)).toBe(true);
    expect(gate.allow(200)).toBe(true);
    expect(gate.allow(300)).toBe(false);
    expect(gate.allow(1200)).toBe(true);
  });

  it('enforces rest after a long visual presence', () => {
    const gate = new VisualFlashGate();

    expect(gate.allow(0, 2000)).toBe(true);
    expect(gate.canAllow(4499, 2000)).toBe(false);
    expect(gate.lastReason).toBe('rest');
    expect(gate.canAllow(4500, 2000)).toBe(true);
  });

  it('caps projected occupancy within the rolling presence window', () => {
    const gate = new VisualFlashGate();

    expect(gate.allow(0, 2000)).toBe(true);
    expect(gate.allow(4500, 2000)).toBe(true);
    expect(gate.canAllow(9000, 2000)).toBe(false);
    expect(gate.lastReason).toBe('duty');
    expect(gate.canAllow(14001, 2000)).toBe(true);
  });
});
