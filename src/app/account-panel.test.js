// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { openAccountPanel } from './account-panel.js';
import { draftLocalWork } from '../core/local-works.js';

HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
const work = draftLocalWork({ title: 'A poem', text: 'The moon is bright.' });
const store = { all: async () => [work], get: vi.fn(), save: vi.fn() };
const ok = body => ({ ok: true, json: async () => ({ version: 1, ...body }) });
afterEach(() => { document.querySelector('dialog')?.close(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('rejects a save when another tab changed the signed-in account', async () => {
  const fetcher = vi.fn(async url => url.endsWith('/account') ? ok({ user: { id: 'other', label: 'Other' } }) : ok({ saves: [] }));
  vi.stubGlobal('fetch', fetcher);
  const dialog = openAccountPanel({ user: { id: 'original', label: 'Reader' }, store });
  const button = dialog.querySelector('[data-save]');
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  button.click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('account changed'));
  expect(fetcher.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
});

it('retains the same request id when a failed explicit save is retried', async () => {
  const ids = [];
  vi.stubGlobal('fetch', async (url, options) => {
    if (options.method === 'POST') {
      ids.push(JSON.parse(options.body).requestId);
      if (ids.length === 1) throw new Error('network failed after upload');
      return ok({ save: { id: 's1' } });
    }
    return url.endsWith('/account') ? ok({ user: { id: 'u', label: 'Reader' } }) : ok({ saves: [] });
  });
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store });
  const button = dialog.querySelector('[data-save]');
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  button.click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('Could not reach'));
  button.click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('Saved “A poem”'));
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});

it('locks the chosen private work while account validation is pending', async () => {
  const second = draftLocalWork({ title: 'Second private work', text: 'Another private document.' });
  let validateAccount;
  let posted;
  vi.stubGlobal('fetch', async (url, options) => {
    if (url.endsWith('/account')) return new Promise(resolve => { validateAccount = () => resolve(ok({ user: { id: 'u', label: 'Reader' } })); });
    if (options.method === 'POST') { posted = JSON.parse(options.body); return ok({ save: { id: 's1' } }); }
    return ok({ saves: [] });
  });
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store: { ...store, all: async () => [work, second] } });
  const button = dialog.querySelector('[data-save]');
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  button.click();
  const select = dialog.querySelector('#account-local-work');
  expect(select.disabled).toBe(true);
  expect(dialog.querySelector('#account-saved-work').disabled).toBe(true);
  expect(dialog.querySelector('[data-replace]').disabled).toBe(true);
  select.value = second.id; // Even a programmatic change must not switch the authorized payload.
  validateAccount();
  await vi.waitFor(() => expect(posted?.payload.work.id).toBe(work.id));
});

it('keeps a committed save successful when only the backup list refresh fails and refresh never uploads again', async () => {
  let listReads = 0;
  let posts = 0;
  vi.stubGlobal('fetch', async (url, options) => {
    if (url.endsWith('/account')) return ok({ user: { id: 'u', label: 'Reader' } });
    if (options.method === 'POST') { posts++; return ok({ save: { id: 's1' } }); }
    if (++listReads === 2) throw new Error('list unavailable after commit');
    return ok({ saves: [{ id: 's1', app: 'rise', name: work.title, createdAt: '2026-10-09T01:00:00Z', bytes: 400 }] });
  });
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store });
  const button = dialog.querySelector('[data-save]');
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  button.click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('Saved “A poem” to your account. Backups could not refresh.'));
  expect(button.textContent).toBe('Saved to account');
  expect(button.disabled).toBe(true);
  dialog.querySelector('[data-refresh]').click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('refreshed'));
  expect(posts).toBe(1);
  expect(button.disabled).toBe(true);
});

it('preserves selections on refresh, shows selected metadata safely, and resets replacement consent on selection and refresh', async () => {
  const second = draftLocalWork({ title: 'Second private work', text: 'Another private document.' });
  const saves = [
    { id: 's1', app: 'rise', name: 'First backup', createdAt: '2026-10-09T01:00:00Z', bytes: 400 },
    { id: 's2', app: 'rise', name: '<img src=x onerror=alert(1)>', createdAt: '2026-10-09T02:00:00Z', bytes: 2048 }
  ];
  vi.stubGlobal('fetch', async url => url.endsWith('/account') ? ok({ user: { id: 'u', label: 'Reader' } }) : ok({ saves }));
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store: { ...store, all: async () => [work, second] } });
  const local = dialog.querySelector('#account-local-work');
  const remote = dialog.querySelector('#account-saved-work');
  const replace = dialog.querySelector('[data-replace]');
  await vi.waitFor(() => expect(dialog.querySelector('[data-refresh]').disabled).toBe(false));
  local.value = second.id; local.dispatchEvent(new Event('change'));
  replace.checked = true;
  remote.value = 's2'; remote.dispatchEvent(new Event('change'));
  expect(replace.checked).toBe(false);
  expect(dialog.querySelector('[data-local-summary]').textContent).toContain('Second private work · 3 words');
  expect(dialog.querySelector('[data-backup-summary]').textContent).toContain('<img src=x onerror=alert(1)> · Saved');
  expect(dialog.querySelector('[data-backup-summary]').textContent).toContain('2 KB');
  expect(dialog.querySelector('img')).toBeNull();
  replace.checked = true;
  dialog.querySelector('[data-refresh]').click();
  expect(replace.checked).toBe(false);
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('refreshed'));
  expect(local.value).toBe(second.id);
  expect(remote.value).toBe('s2');
  expect([...dialog.querySelectorAll('section')].every(section => section.getAttribute('aria-busy') === 'false')).toBe(true);
  expect(dialog.querySelector('[data-status]').closest('[aria-busy]')).toBeNull();
});

it('keeps loading and unavailable backups distinct from an empty library and announces status outside busy sections', async () => {
  let rejectList;
  let listReady = false;
  vi.stubGlobal('fetch', async url => {
    if (url.endsWith('/account')) return ok({ user: { id: 'u', label: 'Reader' } });
    if (listReady) return ok({ saves: [] });
    return new Promise((_resolve, reject) => { rejectList = reject; });
  });
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store });
  await vi.waitFor(() => expect(rejectList).toBeTypeOf('function'));
  expect(dialog.querySelector('[data-backup-summary]').textContent).toBe('Loading account backups…');
  expect(dialog.querySelector('[data-status]').textContent).toBe('Loading browser library and account backups…');
  expect(dialog.querySelector('[data-status]').closest('[aria-busy]')).toBeNull();
  expect(dialog.querySelector('section').getAttribute('aria-busy')).toBe('true');
  expect(dialog.querySelector('[data-restore]').disabled).toBe(true);
  rejectList(new Error('offline'));
  await vi.waitFor(() => expect(dialog.querySelector('[data-refresh]').disabled).toBe(false));
  expect(dialog.querySelector('[data-backup-summary]').textContent).toContain('unavailable');
  expect(dialog.querySelector('#account-saved-work').disabled).toBe(true);
  expect(dialog.querySelector('[data-restore]').disabled).toBe(true);
  listReady = true;
  dialog.querySelector('[data-refresh]').click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-backup-summary]').textContent).toBe('No account backups yet.'));
});

it.each([[409, 'account_changed'], [401, 'unauthorized']])('keeps committed success and specific recovery after a %s list refusal', async (errorStatus, errorCode) => {
  let listReads = 0;
  vi.stubGlobal('fetch', async (url, options) => {
    if (url.endsWith('/account')) return ok({ user: { id: 'u', label: 'Reader' } });
    if (options.method === 'POST') return ok({ save: { id: 's1' } });
    if (++listReads === 2) return { ok: false, status: errorStatus, json: async () => ({ version: 1, error: errorCode }) };
    return ok({ saves: [] });
  });
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store });
  await vi.waitFor(() => expect(dialog.querySelector('[data-save]').disabled).toBe(false));
  dialog.querySelector('[data-save]').click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('Saved “A poem” to your account. Backups could not refresh.'));
  expect(dialog.querySelector('[data-status]').textContent).not.toContain('Use Refresh');
  if (errorStatus === 409) {
    expect(dialog.querySelector('[data-backup-summary]').textContent).toContain('Close this panel and reopen');
    expect(dialog.querySelector('[data-refresh]').disabled).toBe(true);
  } else {
    expect(dialog.querySelector('[data-backup-summary]').textContent).toContain('Sign in');
    expect(dialog.querySelector('[data-sign-in]').hidden).toBe(false);
  }
  expect(dialog.querySelector('[data-restore]').disabled).toBe(true);
});

it('keeps valid browser works with account-ineligible metadata usable and reports refusal only on explicit save', async () => {
  const localOnly = draftLocalWork({ title: 'A'.repeat(1001), text: 'A valid browser text.' });
  const fetcher = vi.fn(async url => url.endsWith('/account') ? ok({ user: { id: 'u', label: 'Reader' } }) : ok({ saves: [] }));
  vi.stubGlobal('fetch', fetcher);
  const dialog = openAccountPanel({ user: { id: 'u', label: 'Reader' }, store: { ...store, all: async () => [localOnly] } });
  await vi.waitFor(() => expect(dialog.querySelector('[data-save]').disabled).toBe(false));
  dialog.querySelector('[data-save]').click();
  await vi.waitFor(() => expect(dialog.querySelector('[data-status]').textContent).toContain('invalid metadata'));
  expect(dialog.querySelector('[data-refresh]').disabled).toBe(false);
  expect(fetcher.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
});
