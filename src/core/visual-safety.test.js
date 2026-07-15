import { beforeEach, describe, expect, it } from 'vitest';
import {
  grantVisualInterlocutionConsent,
  hasVisualInterlocutionConsent,
  requestVisualInterlocutionConsent,
  VisualFlashGate,
  VISUAL_CONSENT_KEY
} from './visual-safety.js';

describe('visual safety boundary', () => {
  beforeEach(() => {
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
    expect(sessionStorage.getItem(VISUAL_CONSENT_KEY)).toBe('true');
  });

  it('refuses consent prompts while photosensitivity mode is active', async () => {
    document.documentElement.classList.add('photosensitivity-mode');
    expect(await requestVisualInterlocutionConsent()).toBe(false);
    expect(hasVisualInterlocutionConsent()).toBe(false);
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
});
