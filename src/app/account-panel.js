import { ACCOUNT_ORIGIN, ACCOUNT_SIGN_IN, getAccount, listAccountSaves, saveAccountWork, restoreAccountWork, workPayload } from '../core/account-saves.js';
import { LocalWorks } from '../core/local-work-store.js';
import './account-panel.css';

export function openAccountPanel({ user, trigger, onClose = () => {}, store = LocalWorks }) {
  document.querySelector('.rise-account-panel')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'rise-account-panel';
  dialog.setAttribute('aria-labelledby', 'rise-account-title');
  dialog.innerHTML = `<div class="account-panel-head"><p>SYBERLABS / RISE</p><button type="button" data-close aria-label="Close account">×</button></div>
    <h1 id="rise-account-title">Your orbit.</h1><p data-user></p>
    <p>Keep a private account backup of a text work from your browser library. Each save is a snapshot you choose.</p>
    <p class="account-panel-links"><a href="${ACCOUNT_ORIGIN}/admin/">Open portal ↗</a><a href="${ACCOUNT_ORIGIN}/admin/saves">Saved things ↗</a></p>
    <section><h2>Save a text work</h2><label for="account-local-work">Browser library</label><select id="account-local-work"></select><button type="button" data-save>Save to account</button>
    <p class="account-panel-note">Imported text only. Audio, images, journals and provider keys stay on this device.</p></section>
    <section><h2>Restore a text work</h2><label for="account-saved-work">Account backups</label><select id="account-saved-work"></select><label class="account-replace"><input type="checkbox" data-replace> Replace an existing browser copy</label><button type="button" data-restore>Restore to browser library</button></section>
    <p data-status role="status" aria-live="polite"></p><a data-sign-in href="${ACCOUNT_SIGN_IN}" hidden>Sign in again</a>`;
  dialog.querySelector('[data-user]').textContent = user.label;
  document.body.append(dialog);
  const localSelect = dialog.querySelector('#account-local-work');
  const remoteSelect = dialog.querySelector('#account-saved-work');
  const saveButton = dialog.querySelector('[data-save]');
  const restoreButton = dialog.querySelector('[data-restore]');
  const status = dialog.querySelector('[data-status]');
  let works = [];
  let attempt = null;
  let busy = false;
  let closed = false;
  const message = error => {
    status.textContent = error.message || 'Account request failed. Your browser library is unchanged.';
    dialog.querySelector('[data-sign-in]').hidden = error.status !== 401;
  };
  const fill = (select, rows, label, empty) => {
    select.replaceChildren();
    for (const row of rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = label(row); select.append(option); }
    if (!rows.length) { const option = document.createElement('option'); option.value = ''; option.textContent = empty; select.append(option); }
  };
  const buttons = () => {
    saveButton.disabled = busy || !localSelect.value;
    restoreButton.disabled = busy || !remoteSelect.value;
    localSelect.disabled = remoteSelect.disabled = dialog.querySelector('[data-replace]').disabled = busy;
  };
  const requireSameAccount = async () => {
    const current = await getAccount();
    if (current.id !== user.id) throw new Error('Your signed-in account changed. Close this panel and open Account again before saving or restoring.');
  };
  const loadLocal = async () => { works = await store.all(); if (!closed) fill(localSelect, works, row => row.title, 'No imported text works yet'); };
  const loadRemote = async () => {
    const saves = await listAccountSaves();
    if (!closed) fill(remoteSelect, saves, row => `${row.name} · ${new Date(row.createdAt).toLocaleString()}`, 'No account backups yet');
  };
  const run = async action => {
    if (busy || closed) return;
    busy = true; buttons(); status.textContent = 'Working…';
    try { await action(); } catch (error) { if (!closed) message(error); }
    finally { busy = false; if (!closed) buttons(); }
  };
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { closed = true; dialog.remove(); trigger?.focus(); onClose(); }, { once: true });
  localSelect.addEventListener('change', () => { attempt = null; buttons(); });
  saveButton.addEventListener('click', () => run(async () => {
    const selected = localSelect.value;
    await requireSameAccount();
    if (closed) return;
    const record = works.find(work => work.id === selected);
    if (!record) throw new Error('Select a browser work first.');
    const fingerprint = JSON.stringify(workPayload(record));
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, requestId: crypto.randomUUID() };
    await saveAccountWork(record, attempt.requestId);
    attempt = null;
    if (closed) return;
    status.textContent = `Saved “${record.title}” to your account.`;
    await loadRemote();
  }));
  restoreButton.addEventListener('click', () => run(async () => {
    const saveId = remoteSelect.value;
    const replace = dialog.querySelector('[data-replace]').checked;
    await requireSameAccount();
    if (closed) return;
    const record = await restoreAccountWork(saveId, store, { replace });
    if (closed) return;
    dialog.querySelector('[data-replace]').checked = false;
    await loadLocal();
    status.textContent = `Restored “${record.title}”. Open Library or Make again to see it.`;
  }));
  dialog.showModal();
  saveButton.disabled = restoreButton.disabled = true;
  void run(async () => {
    await loadLocal();
    await loadRemote();
    if (!closed) status.textContent = works.length ? 'Choose a work to save or a backup to restore.' : 'Import a text in Make to add it to your browser library.';
  });
  return dialog;
}
