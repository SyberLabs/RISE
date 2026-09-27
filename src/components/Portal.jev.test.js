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
  await vi.waitFor(() => expect(launch).toHaveBeenCalledWith(decision));

  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ intent: 'A reflective classic' })
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
  await vi.waitFor(() => expect(container.querySelector('#portal-jev-hint').textContent).toBe('Unavailable'));
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});
