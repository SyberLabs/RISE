// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { attachJevDictation } from './jev-dictation.js';

let recognition;
class Recognition {
  constructor() { recognition = this; }
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function setup() {
  document.body.innerHTML = '<form><input name="intent" maxlength="240" value="A quiet reading"><button type="button" data-jev-dictate></button><span data-jev-dictation-status role="status"></span></form>';
  const form = document.querySelector('form');
  return { form, input: form.querySelector('input'), button: form.querySelector('button'), status: form.querySelector('span') };
}

it('dictates final speech into an editable Jev prompt without submitting it', () => {
  vi.stubGlobal('SpeechRecognition', Recognition);
  const { form, input, button, status } = setup();
  const submit = vi.fn();
  form.addEventListener('submit', submit);
  const cleanup = attachJevDictation(form);
  button.click();
  expect(recognition.start).toHaveBeenCalledOnce();
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(button.textContent).toContain('Stop');
  expect(status.textContent).toContain('Listening');
  recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'ignored interim' } }, { isFinal: true, 0: { transcript: ' with blue light ' } }] });
  expect(input.value).toBe('A quiet reading with blue light');
  recognition.onresult({ resultIndex: 2, results: [{ isFinal: true, 0: { transcript: ' with blue light ' } }, { isFinal: true, 0: { transcript: ' new words' } }] });
  expect(input.value).toBe('A quiet reading with blue light');
  expect(submit).not.toHaveBeenCalled();
  button.click();
  expect(recognition.stop).toHaveBeenCalledOnce();
  recognition.onend();
  expect(button.getAttribute('aria-pressed')).toBe('false');
  cleanup();
});

it('reports denied microphone access and resets the control', () => {
  vi.stubGlobal('webkitSpeechRecognition', Recognition);
  const { form, button, status } = setup();
  attachJevDictation(form);
  button.click();
  recognition.onerror({ error: 'not-allowed' });
  recognition.onend();
  expect(status.textContent).toMatch(/microphone access/i);
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

it('makes unsupported dictation unavailable and stops recording on cleanup', () => {
  const { form, button, status } = setup();
  attachJevDictation(form);
  expect(button.disabled).toBe(true);
  expect(status.textContent).toMatch(/not available/i);

  vi.stubGlobal('SpeechRecognition', Recognition);
  const supported = setup();
  const cleanup = attachJevDictation(supported.form);
  supported.button.click();
  cleanup();
  expect(recognition.abort).toHaveBeenCalledOnce();
});
