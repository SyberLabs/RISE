import { ACCOUNT_ORIGIN, ACCOUNT_SIGN_IN, getAccount, listAccountSaves, saveAccountWork, restoreAccountWork, workPayload } from '../core/account-saves.js';
import { LocalWorks } from '../core/local-work-store.js';
import './account-panel.css';

export function openAccountPanel({ user, trigger, onClose = () => {}, store = LocalWorks, isCurrentAccount = () => true }) {
  document.querySelector('.rise-account-panel')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'rise-account-panel';
  dialog.setAttribute('aria-labelledby', 'rise-account-title');
  dialog.innerHTML = `<div class="account-panel-head"><p>SYBERLABS / RISE</p><button type="button" data-close aria-label="Close account">×</button></div>
    <h1 id="rise-account-title">Your orbit.</h1><p data-user></p>
    <p>Keep a private account backup of a text work from your browser library. Each save is a snapshot you choose.</p>
    <p class="account-panel-links"><a href="${ACCOUNT_ORIGIN}/admin/">Open portal ↗</a><a href="${ACCOUNT_ORIGIN}/admin/saves">Saved things ↗</a></p>
    <button type="button" data-refresh aria-label="Refresh browser library and account backups">Refresh lists</button>
    <section><h2>Save a text work</h2><label for="account-local-work">Browser library</label><select id="account-local-work" aria-describedby="account-local-summary account-local-note"></select><p id="account-local-summary" class="account-selection" data-local-summary></p><button type="button" data-save>Save to account</button>
    <p id="account-local-note" class="account-panel-note">Imported text only. Audio, images, journals and provider keys stay on this device.</p></section>
    <section><h2>Restore a text work</h2><label for="account-saved-work">Account backups</label><select id="account-saved-work" aria-describedby="account-backup-summary account-replace-note"></select><p id="account-backup-summary" class="account-selection" data-backup-summary></p><label class="account-replace"><input type="checkbox" data-replace aria-describedby="account-replace-note"> Replace an existing browser copy</label><p id="account-replace-note" class="account-panel-note">A different browser copy is kept unless you allow replacement. This choice resets when you select another backup or refresh.</p><button type="button" data-restore>Restore to browser library</button></section>
    <p data-status role="status" aria-live="polite"></p><a data-sign-in href="${ACCOUNT_SIGN_IN}" hidden>Sign in again</a>`;
  dialog.querySelector('[data-user]').textContent = user.label;
  document.body.append(dialog);
  const localSelect = dialog.querySelector('#account-local-work');
  const remoteSelect = dialog.querySelector('#account-saved-work');
  const saveButton = dialog.querySelector('[data-save]');
  const restoreButton = dialog.querySelector('[data-restore]');
  const refreshButton = dialog.querySelector('[data-refresh]');
  const replaceInput = dialog.querySelector('[data-replace]');
  const status = dialog.querySelector('[data-status]');
  let works = [];
  let saves = [];
  let remoteState = 'loading';
  let remoteFailure = '';
  let attempt = null;
  let savedFingerprint = null;
  let busy = false;
  let closed = false;
  let invalidated = false;
  const message = (error, prefix = '') => {
    if (error.code === 'account_changed') { attempt = null; invalidated = true; }
    status.textContent = prefix + (error.message || 'Account request failed. Your browser library is unchanged.');
    dialog.querySelector('[data-sign-in]').hidden = error.status !== 401;
  };
  const fill = (select, rows, label, empty, preferred = select.value) => {
    select.replaceChildren();
    for (const row of rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = label(row); select.append(option); }
    if (!rows.length) { const option = document.createElement('option'); option.value = ''; option.textContent = empty; select.append(option); }
    if (rows.some(row => row.id === preferred)) select.value = preferred;
  };
  const backupDate = save => {
    const date = new Date(save.createdAt);
    return Number.isFinite(date.valueOf()) ? date.toLocaleString() : 'Date unavailable';
  };
  const details = () => {
    const work = works.find(row => row.id === localSelect.value);
    dialog.querySelector('[data-local-summary]').textContent = work
      ? `${work.title} · ${(work.text.match(/\S+/g) || []).length.toLocaleString()} words${work.sourceName ? ` · ${work.sourceName}` : ''}`
      : 'Import a text in Make to add it to this browser library.';
    const save = saves.find(row => row.id === remoteSelect.value);
    const size = save && typeof save.bytes === 'number' && Number.isFinite(save.bytes) && save.bytes >= 0
      ? ` · ${save.bytes < 1024 ? `${save.bytes} bytes` : `${(save.bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`}` : '';
    dialog.querySelector('[data-backup-summary]').textContent = remoteState === 'loading'
      ? 'Loading account backups…'
      : remoteState === 'unavailable' ? (remoteFailure || 'Account backups are unavailable. Use Refresh lists to try again.')
        : save ? `${save.name} · Saved ${backupDate(save)}${size}` : 'No account backups yet.';
  };
  const buttons = () => {
    const selected = works.find(work => work.id === localSelect.value);
    const alreadySaved = selected && savedFingerprint === JSON.stringify(workPayload(selected));
    saveButton.disabled = busy || invalidated || !localSelect.value || alreadySaved;
    saveButton.textContent = alreadySaved ? 'Saved to account' : 'Save to account';
    restoreButton.disabled = busy || invalidated || remoteState !== 'ready' || !remoteSelect.value;
    refreshButton.disabled = busy || invalidated;
    localSelect.disabled = busy || invalidated;
    remoteSelect.disabled = replaceInput.disabled = busy || invalidated || remoteState !== 'ready';
    for (const section of dialog.querySelectorAll('section')) section.setAttribute('aria-busy', String(busy));
  };
  const beforeWrite = () => {
    if (closed || invalidated || !isCurrentAccount()) throw new Error('This account panel is no longer current. Close it and open Account again. Your browser library is unchanged.');
  };
  const requireSameAccount = async () => {
    beforeWrite();
    const current = await getAccount();
    beforeWrite();
    if (current.id !== user.id) {
      invalidated = true;
      throw new Error('Your signed-in account changed. Close this panel and open Account again before saving or restoring.');
    }
  };
  const loadLocal = async () => {
    const current = await store.all();
    if (closed) return;
    works = current;
    fill(localSelect, works, row => row.title, 'No imported text works yet');
    details();
  };
  const canRefreshList = error => !invalidated && isCurrentAccount() && (error.status === 0 || error.status >= 500);
  const loadRemote = async (preferred = remoteSelect.value) => {
    remoteState = 'loading';
    remoteFailure = '';
    replaceInput.checked = false;
    details();
    try {
      beforeWrite();
      const current = await listAccountSaves(user.id);
      beforeWrite();
      saves = current;
      fill(remoteSelect, saves, row => `${row.name} · ${backupDate(row)}`, 'No account backups yet', preferred);
      remoteState = 'ready';
      details();
    } catch (error) {
      remoteState = 'unavailable';
      if (!canRefreshList(error)) remoteFailure = error.message;
      if (!closed) details();
      throw error;
    }
  };
  const run = async (action, pending = 'Working…') => {
    if (busy || closed) return;
    busy = true; buttons(); status.textContent = pending;
    try { await action(); } catch (error) { if (!closed) message(error); }
    finally { busy = false; if (!closed) buttons(); }
  };
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  // The native dialog owns Escape; the underlying reader must not navigate
  // or cancel its transition when this account panel closes.
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('close', () => { closed = true; dialog.remove(); trigger?.focus(); onClose(); }, { once: true });
  localSelect.addEventListener('change', () => { attempt = null; details(); buttons(); });
  remoteSelect.addEventListener('change', () => { replaceInput.checked = false; details(); buttons(); });
  refreshButton.addEventListener('click', () => run(async () => {
    replaceInput.checked = false;
    await requireSameAccount();
    await loadLocal();
    await loadRemote();
    status.textContent = 'Browser library and account backups refreshed.';
  }, 'Refreshing browser library and account backups…'));
  saveButton.addEventListener('click', () => run(async () => {
    const selected = localSelect.value;
    await requireSameAccount();
    if (closed) return;
    const record = works.find(work => work.id === selected);
    if (!record) throw new Error('Select a browser work first.');
    const fingerprint = JSON.stringify(workPayload(record));
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, requestId: crypto.randomUUID(), expectedUserId: user.id };
    beforeWrite();
    const result = await saveAccountWork(record, attempt.requestId, attempt.expectedUserId);
    savedFingerprint = fingerprint;
    attempt = null;
    if (closed) return;
    const savedMessage = `Saved “${record.title}” to your account.`;
    status.textContent = savedMessage;
    try { await loadRemote(result.save?.id); }
    catch (error) {
      const recovery = canRefreshList(error) ? ' Use Refresh lists to try again. ' : ' ';
      if (!closed) message(error, `${savedMessage} Backups could not refresh.${recovery}`);
    }
  }, 'Saving your chosen text work…'));
  restoreButton.addEventListener('click', () => run(async () => {
    const saveId = remoteSelect.value;
    const replace = replaceInput.checked;
    await requireSameAccount();
    if (closed) return;
    const record = await restoreAccountWork(saveId, store, { replace, expectedUserId: user.id, beforeWrite });
    if (closed) return;
    replaceInput.checked = false;
    const restoredMessage = `Restored “${record.title}”. Open Library or Make again to see it.`;
    status.textContent = restoredMessage;
    try { await loadLocal(); }
    catch (error) { if (!closed) message(error, `${restoredMessage} Browser list could not refresh. Use Refresh lists to try again. `); }
  }, 'Restoring your chosen account backup…'));
  dialog.showModal();
  saveButton.disabled = restoreButton.disabled = true;
  void run(async () => {
    await loadLocal();
    await loadRemote();
    if (!closed) status.textContent = works.length ? 'Choose a work to save or a backup to restore.' : 'Import a text in Make to add it to your browser library.';
  }, 'Loading browser library and account backups…');
  return dialog;
}
