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
