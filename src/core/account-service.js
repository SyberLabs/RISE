export const ACCOUNT_ORIGIN = 'https://syberlabs.io';
export const ACCOUNT_SIGN_IN = `${ACCOUNT_ORIGIN}/auth/signin?next=${encodeURIComponent('/admin/return?app=rise')}`;
const API = `${ACCOUNT_ORIGIN}/admin/api/v1`;

export class AccountError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}

export function expectedAccountHeader(userId) {
  if (typeof userId !== 'string' || !userId) throw new AccountError('Close this panel and reopen Account to refresh your identity.', 400, 'expected_user_required');
  return { 'X-SyberLabs-Expected-User': userId };
}

export const ERRORS = {
  400: 'This account request could not be accepted. Close this panel and reopen Account before trying again.',
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
    let error = '';
    try { error = (await response.json())?.error || ''; } catch { /* generic status message */ }
    if (error === 'account_changed') throw new AccountError('Your signed-in account changed. Close this panel and reopen Account before saving or restoring.', response.status, error);
    if (error === 'expected_user_required') throw new AccountError('Close this panel and reopen Account to refresh your identity.', response.status, error);
    throw new AccountError(ERRORS[response.status] || 'Account request failed. Your browser library is unchanged.', response.status, error);
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

export async function listAccountSaves(expectedUserId, fetcher) {
  const body = await accountRequest('/saves?app=rise', { headers: expectedAccountHeader(expectedUserId) }, fetcher);
  if (!Array.isArray(body.saves)) throw new AccountError('Account returned an unreadable backup list.');
  return body.saves.filter(save => save.app === 'rise' && typeof save.id === 'string' && typeof save.name === 'string');
}
