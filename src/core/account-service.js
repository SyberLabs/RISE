export const ACCOUNT_ORIGIN = 'https://syberlabs.io';
export const ACCOUNT_SIGN_IN = `${ACCOUNT_ORIGIN}/auth/signin?next=${encodeURIComponent('/admin/return?app=rise')}`;
const API = `${ACCOUNT_ORIGIN}/admin/api/v1`;

export class AccountError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

export const ERRORS = {
  401: 'Sign in to your SyberLabs account to save or restore a work.',
  403: 'Account access is unavailable from this site.',
  404: 'This backup is no longer available.',
  409: 'This save could not be added. Your account may be full; download backups from the portal.',
  413: 'This work is too large for an account backup (1 MB maximum).',
  503: 'Account storage is temporarily unavailable. Your browser library is unchanged.'
};

export async function accountRequest(path, options = {}, fetcher = globalThis.fetch) {
  let response;
  try { response = await fetcher(`${API}${path}`, { ...options, credentials: 'include' }); }
  catch { throw new AccountError('Could not reach your account. Your browser library is unchanged.'); }
  if (!response.ok) {
    let error;
    try { error = (await response.json())?.error; } catch { /* Status remains useful for non-JSON failures. */ }
    if (response.status === 409 && error === 'account_changed') {
      throw new AccountError('Your account changed. Close and reopen Account before saving or restoring.', 409);
    }
    throw new AccountError(ERRORS[response.status] || 'Account request failed. Your browser library is unchanged.', response.status);
  }
  let body;
  try { body = await response.json(); } catch { throw new AccountError('Account returned an unreadable response.'); }
  if (body?.version !== 1) throw new AccountError('Account returned an unsupported response.');
  return body;
}

export async function getAccount(fetcher) {
  const body = await accountRequest('/account', {}, fetcher);
  if (!body.user || typeof body.user.id !== 'string' || typeof body.user.label !== 'string') throw new AccountError('Account returned an unreadable profile.');
  return body.user;
}

export function expectedAccountHeaders(expectedUserId) {
  if (typeof expectedUserId !== 'string' || !expectedUserId.trim()) {
    throw new AccountError('Open your account before saving or restoring a backup.');
  }
  return { 'X-SyberLabs-Expected-User': expectedUserId };
}

export async function listAccountSaves(expectedUserId, fetcher) {
  const body = await accountRequest('/saves?app=rise', { headers: expectedAccountHeaders(expectedUserId) }, fetcher);
  if (!Array.isArray(body.saves)) throw new AccountError('Account returned an unreadable backup list.');
  return body.saves.filter(save => save.app === 'rise' && typeof save.id === 'string' && typeof save.name === 'string');
}

