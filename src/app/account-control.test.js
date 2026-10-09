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

it('invalidates an old panel restore when a global refresh observes another account', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  const { LocalWorks } = await import('../core/local-work-store.js');
  const { draftLocalWork } = await import('../core/local-works.js');
  const { workPayload } = await import('../core/account-saves.js');
  const work = draftLocalWork({ title: 'An account draft', text: 'The old account text.' });
  const write = vi.spyOn(LocalWorks, 'save');
  vi.spyOn(LocalWorks, 'all').mockResolvedValue([]);
  vi.spyOn(LocalWorks, 'get').mockResolvedValue(null);
  let accountId = 'A';
  let resumeDetail;
  const ok = body => ({ ok: true, json: async () => ({ version: 1, ...body }) });
  vi.stubGlobal('fetch', async url => {
    if (url.endsWith('/account')) return ok({ user: { id: accountId, label: accountId } });
    if (url.endsWith('/saves/backup')) return new Promise(resolve => { resumeDetail = () => resolve(ok({ save: { app: 'rise', payload: workPayload(work) } })); });
    return ok({ saves: [{ id: 'backup', app: 'rise', name: 'Draft', createdAt: '2026-10-08' }] });
  });
  control = mountAccountControl();
  await vi.waitFor(() => expect(document.querySelector('.rise-account-control').textContent).toBe('Account'));
  document.querySelector('.rise-account-control').click();
  await vi.waitFor(() => expect(document.querySelector('[data-restore]')?.disabled).toBe(false));
  document.querySelector('[data-restore]').click();
  await vi.waitFor(() => expect(resumeDetail).toBeTypeOf('function'));
  accountId = 'B';
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 0));
  resumeDetail();
  await vi.waitFor(() => expect(document.querySelector('[data-status]').textContent).toContain('no longer current'));
  expect(write).not.toHaveBeenCalled();
  document.querySelector('dialog').close();
  vi.restoreAllMocks();
});


it('keeps the study entrance without looking up identity on mount or focus', async () => {
  vi.stubGlobal('location', { pathname: '/live', search: '?eval=1&n=0&seed=1' });
  const fetcher = vi.fn().mockRejectedValue(new Error('no study network'));
  vi.stubGlobal('fetch', fetcher);
  control = mountAccountControl();
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector('.rise-account-control').textContent).toBe('Sign in');
  expect(fetcher).not.toHaveBeenCalled();
});

it('puts no entrance over the reading in a host card, and looks up no identity on mount or focus', async () => {
  vi.resetModules();
  const meta = document.createElement('meta');
  meta.name = 'rise-embed'; meta.content = '/live?embed=mcp&voice=paced';
  document.head.append(meta);
  try {
    const { mountAccountControl: mountCardAccount } = await import('./account-control.js');
    const fetcher = vi.fn().mockRejectedValue(new Error('no card account network'));
    vi.stubGlobal('fetch', fetcher);
    control = mountCardAccount();
    window.dispatchEvent(new Event('focus'));
    await new Promise(resolve => setTimeout(resolve, 0));
    // The card's sign-in is a row of its Settings sheet, opened outside the card (stage-controls.js).
    expect(document.querySelector('.rise-account-control')).toBeNull();
    expect(document.body.classList.contains('has-rise-account')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    control.destroy();
  } finally { meta.remove(); vi.resetModules(); }
});

it('still refreshes identity on the ordinary reader-owned live page', async () => {
  vi.stubGlobal('location', { pathname: '/live', search: '?provider=openai&voice=paced' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, user: { id: 'u', label: 'Reader' } }) }));
  control = mountAccountControl();
  await vi.waitFor(() => expect(document.querySelector('.rise-account-control').textContent).toBe('Account'));
});


it('defers focus lookup while an existing page enters a study and resumes after leaving', async () => {
  const location = { pathname: '/settings', search: '' };
  vi.stubGlobal('location', location);
  const fetcher = vi.fn().mockRejectedValue(new Error('signed out'));
  vi.stubGlobal('fetch', fetcher);
  control = mountAccountControl();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetcher).toHaveBeenCalledTimes(1);
  location.pathname = '/live'; location.search = '?eval=later';
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetcher).toHaveBeenCalledTimes(1);
  location.pathname = '/settings'; location.search = '';
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('clears a remembered account when an authenticated page enters a study', async () => {
  const location = { pathname: '/settings', search: '' };
  vi.stubGlobal('location', location);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, user: { id: 'u', label: 'Reader' } }) }));
  control = mountAccountControl();
  const link = document.querySelector('.rise-account-control');
  await vi.waitFor(() => expect(link.textContent).toBe('Account'));
  location.pathname = '/live'; location.search = '?eval=later';
  window.dispatchEvent(new Event('focus'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(link.textContent).toBe('Sign in');
});

it('does not adopt a late profile after entering a study without window focus', async () => {
  const location = { pathname: '/settings', search: '' };
  vi.stubGlobal('location', location);
  let settle;
  vi.stubGlobal('fetch', () => new Promise(resolve => { settle = () => resolve({ ok: true, json: async () => ({ version: 1, user: { id: 'A', label: 'A' } }) }); }));
  control = mountAccountControl();
  location.pathname = '/live'; location.search = '?eval=1';
  settle();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector('.rise-account-control').textContent).toBe('Sign in');
});

it('does not open a remembered account panel in a study without window focus', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  const { LocalWorks } = await import('../core/local-work-store.js');
  vi.spyOn(LocalWorks, 'all').mockResolvedValue([]);
  try {
    const location = { pathname: '/settings', search: '' };
    vi.stubGlobal('location', location);
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, user: { id: 'A', label: 'A' }, saves: [] }) }));
    vi.stubGlobal('fetch', fetcher);
    control = mountAccountControl();
    const link = document.querySelector('.rise-account-control');
    await vi.waitFor(() => expect(link.textContent).toBe('Account'));
    const before = fetcher.mock.calls.length;
    location.pathname = '/live'; location.search = '?eval=later';
    link.addEventListener('click', event => event.preventDefault());
    link.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.querySelector('.rise-account-panel')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(before);
    expect(link.textContent).toBe('Sign in');
  } finally { vi.restoreAllMocks(); }
});

it('refuses a remembered panel restore before any request after entering a study without focus', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  const { LocalWorks } = await import('../core/local-work-store.js');
  const write = vi.spyOn(LocalWorks, 'save');
  vi.spyOn(LocalWorks, 'all').mockResolvedValue([]);
  vi.spyOn(LocalWorks, 'get').mockResolvedValue(null);
  try {
    const location = { pathname: '/settings', search: '' };
    vi.stubGlobal('location', location);
    const fetcher = vi.fn(async url => ({ ok: true, json: async () => ({ version: 1, ...(url.endsWith('/account') ? { user: { id: 'A', label: 'A' } } : { saves: [{ id: 'backup', app: 'rise', name: 'Backup', createdAt: '2026-10-09' }] }) }) }));
    vi.stubGlobal('fetch', fetcher);
    control = mountAccountControl();
    await vi.waitFor(() => expect(document.querySelector('.rise-account-control').textContent).toBe('Account'));
    document.querySelector('.rise-account-control').click();
    await vi.waitFor(() => expect(document.querySelector('[data-restore]')?.disabled).toBe(false));
    const before = fetcher.mock.calls.length;
    location.pathname = '/live'; location.search = '?eval=later';
    document.querySelector('[data-restore]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-status]').textContent).toContain('no longer current'));
    expect(fetcher).toHaveBeenCalledTimes(before);
    expect(write).not.toHaveBeenCalled();
    document.querySelector('dialog').close();
  } finally { vi.restoreAllMocks(); }
});

it('retains explicit sign-in navigation in a study', () => {
  vi.stubGlobal('location', { pathname: '/live', search: '?eval=1' });
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  control = mountAccountControl();
  const link = document.querySelector('.rise-account-control');
  let prevented;
  link.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); });
  link.click();
  expect(prevented).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
