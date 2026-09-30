/**
 * One bounded decision call on one reader-owned connection.
 *
 * No retry and no fallback: a timeout, cancellation, or refusal ends the
 * request. Nothing here knows or forwards a SyberLabs credential; the
 * connection alone decides where the request goes and how it is authorized.
 */
import { validProviderResponse, validProviderResult } from './providers.js';

export const DEFAULT_DEADLINE_MS = 8000;
const MAX_RESPONSE_BYTES = 256 * 1024;

const MESSAGES = Object.freeze({
  NOT_CONNECTED: 'Connect OpenRouter or run RISE locally to use AI suggestions. Reading and manual settings work without either.',
  TIMEOUT: 'The decision model took too long. Nothing was changed; try again.',
  CANCELED: 'The request was canceled.',
  AUTH: 'OpenRouter no longer accepts this connection. It may have expired or been revoked. Connect OpenRouter again.',
  FORBIDDEN: 'OpenRouter refused this request.',
  PAYMENT: 'Your OpenRouter account needs credits before Jev can answer.',
  RATE_LIMITED: 'The decision model is receiving too many requests. Wait a moment and try again.',
  UPSTREAM: 'The decision model returned an error.',
  UNREACHABLE: 'The decision model could not be reached.',
  UNATTESTED: 'The local model is not the pinned Kev checkpoint.',
  INVALID_RESPONSE: 'The decision model returned an answer RISE cannot use.'
});

export class DecisionError extends Error {
  constructor(code, message = MESSAGES[code] || MESSAGES.UPSTREAM) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
  }
}

export function decisionMessage(code) {
  return MESSAGES[code] || MESSAGES.UPSTREAM;
}

function statusCode(status) {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'FORBIDDEN';
  if (status === 402) return 'PAYMENT';
  if (status === 429) return 'RATE_LIMITED';
  return 'UPSTREAM';
}

async function readBounded(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new DecisionError('INVALID_RESPONSE');
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new DecisionError('INVALID_RESPONSE');
  try {
    return JSON.parse(text);
  } catch {
    throw new DecisionError('INVALID_RESPONSE');
  }
}

/**
 * @param connection {{ provider: object, request: (init: RequestInit) => Promise<Response> }}
 * @param body the System One request ({ model, state, questions })
 * @returns the provider's JSON, admitted only for the connection's provider
 */
export async function callDecision(connection, body, { signal, deadlineMs = DEFAULT_DEADLINE_MS } = {}) {
  if (!connection?.provider || typeof connection.request !== 'function') throw new DecisionError('NOT_CONNECTED');
  if (signal?.aborted) throw new DecisionError('CANCELED');
  let deadline;
  let response;
  try {
    deadline = AbortSignal.timeout(deadlineMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    response = await connection.request({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, model: connection.provider.model }),
      redirect: 'error',
      signal: combined
    });
  } catch (cause) {
    if (cause instanceof DecisionError) throw cause;
    if (deadline?.aborted) throw new DecisionError('TIMEOUT');
    if (signal?.aborted) throw new DecisionError('CANCELED');
    throw new DecisionError('UNREACHABLE');
  }
  if (!response.ok) {
    void response.body?.cancel?.().catch?.(() => {});
    throw new DecisionError(statusCode(response.status));
  }
  if (!validProviderResponse(response, connection.provider)) {
    void response.body?.cancel?.().catch?.(() => {});
    throw new DecisionError('UNATTESTED');
  }
  let value;
  try {
    value = await readBounded(response);
  } catch (cause) {
    if (cause instanceof DecisionError) throw cause;
    if (deadline.aborted) throw new DecisionError('TIMEOUT');
    if (signal?.aborted) throw new DecisionError('CANCELED');
    throw new DecisionError('INVALID_RESPONSE');
  }
  if (!validProviderResult(value, connection.provider)) throw new DecisionError('INVALID_RESPONSE');
  return value;
}
