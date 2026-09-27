import { validatePiece } from './personal-piece-contract.js';
export { validatePiece } from './personal-piece-contract.js';

// A deadline races the entire response read, including transports that ignore abort.
export async function requestPersonalPiece(input, { signal, fetcher = fetch, deadlineMs = 35000 } = {}) {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  let timer;
  let abort;
  const interrupted = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(new Error('Request cancelled.')); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The writer took too long. No automatic retry was made.'));
    }, deadlineMs);
  });
  try {
    if (signal?.aborted) throw new Error('Request cancelled.');
    return await Promise.race([interrupted, (async () => {
      const response = await fetcher('/api/personal-piece', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, ...input }), signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 503) throw new Error('The writer is currently unavailable. You can still read, import, and keep existing pieces.');
        if (response.status === 409) throw new Error('This request was already used; its response cannot be recovered. No automatic retry was made.');
        if (response.status === 429) throw new Error('The writing limit has been reached. Please try later.');
        throw new Error('The writer could not complete this request. No automatic retry was made.');
      }
      const text = await response.text();
      if (text.length > 16384) throw new Error('The writer returned an oversized response.');
      let result;
      try { result = JSON.parse(text); } catch { throw new Error('The writer returned an invalid response.'); }
      if (!result || Object.keys(result).sort().join(',') !== 'paragraphs,promptVersion,requestId,title,writerModel'
        || result.requestId !== requestId || result.writerModel !== 'qwen/qwen3.5-9b'
        || result.promptVersion !== 'personal-v1') throw new Error('The writer returned invalid response metadata.');
      return { ...validatePiece(result), writerModel: result.writerModel, promptVersion: result.promptVersion };
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
