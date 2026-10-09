// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { VoiceDemo } from './VoiceDemo.js';
import { fetchPlusStatus, fetchPlusVoices, fetchPlusPaymentLink } from '../../app/plus.js';
vi.mock('../../app/plus.js', async original => ({ ...await original(), fetchPlusStatus: vi.fn(), fetchPlusVoices: vi.fn(async () => [{ slug: 'river', label: 'River' }]), fetchPlusPaymentLink: vi.fn(async () => null) }));
let demo;
afterEach(() => { demo?.destroy(); document.body.innerHTML = ''; sessionStorage.clear(); vi.clearAllMocks(); });
const mount = async status => {
  fetchPlusStatus.mockResolvedValue(status);
  document.body.innerHTML = '<main></main>';
  const begin = vi.fn(async config => { config.origin.voiceFailure = 'Voice allowance used up. No voice was played.'; return false; });
  const engine = { init: async () => {}, resume: async () => {}, context: { state: 'running' }, audible: true };
  demo = new VoiceDemo(document.querySelector('main'), { onBeginSession: begin, ensureAudioEngine: async () => engine, getAudioEngine: () => engine });
  await demo.ready;
  await demo.audioReady;
  return begin;
};
it('gates Begin on server readiness and shows only configured sign-in paths', async () => {
  await mount({ admin: false, subscriber: false, available: false, adminLogin: false });
  expect(document.querySelector('[data-begin]').disabled).toBe(true);
  expect(document.querySelector('a[href="/api/plus/admin/login"]')).toBeNull();
  expect(document.querySelector('[data-status]').textContent).toContain('not ready');
});
it('starts from the same screen with chosen voice, editable text and visual preset', async () => {
  const begin = await mount({ admin: true, available: true });
  const input = document.querySelector('textarea');
  input.value = 'An editable beam of light.';
  input.dispatchEvent(new Event('input'));
  document.querySelector('[data-begin]').click();
  await vi.waitFor(() => expect(begin).toHaveBeenCalledTimes(1));
  expect(begin.mock.calls[0][0]).toMatchObject({ text: input.value, origin: { requireElevenLabs: true, voice: 'river' } });
  await vi.waitFor(() => expect(document.querySelector('[data-status]').textContent).toContain('allowance'));
  expect(input.value).toBe('An editable beam of light.');
});
it('does not enable Begin for an unavailable provider even with verified identity', async () => {
  await mount({ admin: true, available: false, adminLogin: true });
  expect(document.querySelector('[data-begin]').disabled).toBe(true);
});
it('keeps Begin disabled when status cannot be confirmed', async () => {
  fetchPlusStatus.mockRejectedValueOnce(new Error('offline'));
  document.body.innerHTML = '<main></main>';
  demo = new VoiceDemo(document.querySelector('main'), {});
  await demo.ready;
  expect(document.querySelector('[data-begin]').disabled).toBe(true);
  expect(document.querySelector('[data-status]').textContent).toContain('confirm');
});
it('ignores a status response after the demo is left', async () => {
  let resolve;
  fetchPlusStatus.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  document.body.innerHTML = '<main></main>';
  demo = new VoiceDemo(document.querySelector('main'), {});
  demo.deactivate();
  resolve({ admin: true, available: true });
  await demo.ready;
  expect(document.querySelector('[data-begin]').disabled).toBe(true);
});
it('does not launch another request while Begin is pending', async () => {
  await mount({ admin: true, available: true });
  let finish;
  demo.onBeginSession = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const button = document.querySelector('[data-begin]');
  button.click();
  button.click();
  await vi.waitFor(() => expect(demo.onBeginSession).toHaveBeenCalledTimes(1));
  finish(false);
});
it('spends the Begin gesture on audio before starting asynchronous voicing', async () => {
  fetchPlusStatus.mockResolvedValue({ admin: true, available: true });
  document.body.innerHTML = '<main></main>';
  const order = [];
  const engine = { init: async () => {}, context: { state: 'running' }, resume: () => { order.push('resume'); return Promise.resolve(); } };
  demo = new VoiceDemo(document.querySelector('main'), { ensureAudioEngine: async () => engine, getAudioEngine: () => engine, onBeginSession: async () => { order.push('voice'); return false; } });
  await demo.ready;
  await demo.audioReady;
  document.querySelector('[data-begin]').click();
  expect(order).toEqual(['resume']);
  await vi.waitFor(() => expect(order).toEqual(['resume', 'voice']));
});
it('preserves the editable draft and choices across administrator sign-in', async () => {
  await mount({ available: false, adminLogin: true });
  const text = document.querySelector('textarea');
  text.value = 'The light comes home.';
  text.dispatchEvent(new Event('input'));
  document.querySelector('[data-look]').value = 'still';
  document.querySelector('[data-look]').dispatchEvent(new Event('change'));
  expect(document.querySelector('a[href="/api/plus/admin/login?returnTo=voice-demo"]')).toBeTruthy();
  demo.destroy();
  await mount({ admin: true, available: true });
  expect(document.querySelector('textarea').value).toBe('The light comes home.');
  expect(document.querySelector('[data-voice]').value).toBe('river');
  expect(document.querySelector('[data-look]').value).toBe('still');
});
it('does not enable Begin before the audio engine is initialized', async () => {
  fetchPlusStatus.mockResolvedValue({ admin: true, available: true });
  document.body.innerHTML = '<main></main>';
  let initialized;
  const engine = { init: () => new Promise(resolve => { initialized = resolve; }) };
  demo = new VoiceDemo(document.querySelector('main'), { ensureAudioEngine: async () => engine });
  await demo.ready;
  expect(document.querySelector('[data-begin]').disabled).toBe(true);
  initialized();
  await demo.audioReady;
  expect(document.querySelector('[data-begin]').disabled).toBe(false);
});

it('does not contact the voice when the browser has not admitted audio', async () => {
  const begin = await mount({ admin: true, available: true });
  demo.getAudioEngine = () => ({ context: { state: 'running' }, audible: false, resume: async () => {} });
  await demo.start();
  expect(begin).not.toHaveBeenCalled();
  expect(document.querySelector('[data-status]').textContent).toContain('Press Begin again');
});
it('resets the draft only when explicitly requested', async () => {
  await mount({ admin: true, available: true });
  const text = document.querySelector('textarea');
  text.value = 'Private edited words.';
  text.dispatchEvent(new Event('input'));
  document.querySelector('[data-reset]').click();
  expect(text.value).not.toBe('Private edited words.');
  expect(sessionStorage.getItem('rise.voice-demo.draft')).toBeNull();
});

it('keeps the refusal visible when the router restores the demo after a failed launch', async () => {
  await mount({ admin: true, available: true });
  demo.onBeginSession = async config => {
    demo.deactivate();
    demo.activate();
    config.origin.voiceFailure = 'Voice allowance used up.';
    return false;
  };
  await demo.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector('[data-status]').textContent).toContain('allowance');
});

it('does not launch a stale Begin after leaving while audio resumes', async () => {
  const begin = await mount({ admin: true, available: true });
  let resume;
  demo.getAudioEngine = () => ({ context: { state: 'running' }, audible: true, resume: () => new Promise(resolve => { resume = resolve; }) });
  const starting = demo.start();
  demo.deactivate();
  demo.activate();
  resume();
  await starting;
  expect(begin).not.toHaveBeenCalled();
});
