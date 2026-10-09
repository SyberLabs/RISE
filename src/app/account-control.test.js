// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mountAccountControl } from './account-control.js';
let control;
afterEach(() => { control?.destroy(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('keeps a sign-in entrance outside hidden route containers when account is unavailable', async () => {
  document.body.innerHTML = '<main hidden><div>Reading</div></main>';
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  control = mountAccountControl();
  await vi.waitFor(() => expect(document.querySelector('.rise-account-control').textContent).toBe('Sign in'));
  const link = document.querySelector('.rise-account-control');
  expect(link.parentNode).toBe(document.body);
  expect(new URL(link.href).searchParams.get('next')).toBe('/admin/return?app=rise');
});

it('shows account for an authenticated reader and removes listeners on teardown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, user: { id: 'u', label: 'Reader' } }) }));
  control = mountAccountControl();
  await vi.waitFor(() => expect(document.querySelector('.rise-account-control').textContent).toBe('Account'));
  control.destroy();
  expect(document.querySelector('.rise-account-control')).toBeNull();
  expect(document.body.classList.contains('has-rise-account')).toBe(false);
});
