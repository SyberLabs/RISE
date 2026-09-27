// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Portal } from './Portal.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('asks Jev once and launches the returned reading without opening another room', async () => {
  const decision = { workId: 'middlemarch', config: { wpm: 200 } };
  const provider = vi.fn(async () => Response.json(decision));
  const launch = vi.fn(async () => {});
  const navigate = vi.fn();
  vi.stubGlobal('fetch', provider);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const portal = new Portal(container, { onLaunchJevReading: launch, onNavigate: navigate });
  container.querySelector('#portal-jev-intent').value = 'A reflective classic';

  const form = container.querySelector('#portal-jev-form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  // Loading: the one button is busy and the reading's place is held.
  expect(container.querySelector('.portal-jev-submit').getAttribute('aria-busy')).not.toBeNull();
  expect(container.querySelector('#portal-jev-hint').textContent).toBe('Jev is choosing your reading…');
  expect(container.querySelector('.portal-skeleton').hidden).toBe(false);
  await vi.waitFor(() => expect(launch).toHaveBeenCalledWith(decision));

  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ intent: 'A reflective classic', schemaVersion: 2 })
  }));
  expect(navigate).not.toHaveBeenCalled();
  portal.destroy();
});

it('does not launch a reading when Jev returns an error', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Unavailable' } }, { status: 503 })));
  const launch = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const portal = new Portal(container, { onLaunchJevReading: launch });
  container.querySelector('#portal-jev-intent').value = 'A reflective classic';

  container.querySelector('#portal-jev-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const alert = container.querySelector('#portal-jev-error');
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.textContent).toContain('The reading could not be prepared. Try again.');
  // The raw cause is never the message; it waits behind a closed "Details".
  const details = alert.querySelector('.portal-alert-details');
  expect(details.hidden).toBe(false);
  expect(details.open).toBe(false);
  expect(details.querySelector('summary').textContent.trim()).toBe('Details');
  expect(alert.querySelector('.portal-alert-message').textContent).toBe('Unavailable');
  expect(alert.querySelector('.portal-alert-title').textContent).toBe('The reading could not be prepared. Try again.');
  // The request survives the failure, and the form is usable again.
  expect(container.querySelector('#portal-jev-intent').value).toBe('A reflective classic');
  expect(container.querySelector('.portal-jev-submit').disabled).toBe(false);
  expect(container.querySelector('.portal-skeleton').hidden).toBe(true);
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});

it('offers microphone dictation beside the editable Jev request', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const portal = new Portal(container);
  const form = container.querySelector('#portal-jev-form');
  const mic = form.querySelector('[data-jev-dictate]');
  expect(mic).not.toBeNull();
  expect(mic.getAttribute('aria-label')).toBe('Speak your Jev request');
  expect(mic.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(form.querySelector('[data-jev-dictation-status]')).not.toBeNull();
  expect(form.textContent).toMatch(/browser.s speech service/i);
  portal.destroy();
});
