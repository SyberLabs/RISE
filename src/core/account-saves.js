import { validateLocalWork } from './local-works.js';
import { accountRequest as request, AccountError, ERRORS, expectedAccountHeaders } from './account-service.js';
export { ACCOUNT_ORIGIN, ACCOUNT_SIGN_IN, getAccount, listAccountSaves } from './account-service.js';
const MAX_BYTES = 1024 * 1024;

export function workPayload(record) {
  validateLocalWork(record);
  // Explicit fields: no settings, provider credentials, media or other browser stores.
  const { schema, id, title, author, text, cuts, labels, sourceName, createdAt, noun, authored, reason } = record;
  if (typeof title !== 'string' || !title.trim() || title.length > 1000
    || (author != null && typeof author !== 'string')
    || (sourceName != null && typeof sourceName !== 'string')
    || (createdAt != null && typeof createdAt !== 'string')
    || (noun != null && typeof noun !== 'string')
    || (authored != null && typeof authored !== 'boolean')
    || (reason != null && typeof reason !== 'string')) throw new AccountError('This work contains invalid metadata.');
  return { schema: 'rise.account-work.v1', work: { schema, id, title, author, text, cuts, labels, sourceName, createdAt, noun, authored, reason } };
}

export async function saveAccountWork(record, requestId, expectedUserId, fetcher) {
  const body = JSON.stringify({ app: 'rise', name: record.title.slice(0, 100), payload: workPayload(record), requestId });
  if (new TextEncoder().encode(JSON.stringify(JSON.parse(body).payload)).byteLength > MAX_BYTES) throw new AccountError(ERRORS[413], 413);
  return request('/saves', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SyberLabs-Account': 'v1', ...expectedAccountHeaders(expectedUserId) }, body }, fetcher);
}

export async function restoreAccountWork(id, store, { replace = false, expectedUserId, fetcher } = {}) {
  const body = await request(`/saves/${encodeURIComponent(id)}`, { headers: expectedAccountHeaders(expectedUserId) }, fetcher);
  const save = body.save;
  if (save?.app !== 'rise' || save.payload?.schema !== 'rise.account-work.v1') throw new AccountError('This backup is not a RISE text work.');
  let record;
  try { record = workPayload(save.payload.work).work; }
  catch { throw new AccountError('This backup failed validation. Your browser library is unchanged.'); }
  await store.save(record, { replaceExisting: replace });
  return record;
}
