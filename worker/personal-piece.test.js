// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.mjs';

vi.mock('./personal-piece-release.mjs', () => ({ RELEASE_VERIFIED: true }));
const site = 'https://rise.example';
const id = '550e8400-e29b-41d4-a716-446655440000';
const input = { requestId: id, mode: 'create', thought: 'A quiet morning.' };
const piece = { title: 'Morning', paragraphs: [
  'The morning rests on the edge of the window, holding its light without hurry. Nothing has to happen to make the room worth noticing. A cup, a shadow, the small sound of the street: each offers a place for attention to settle for a moment.',
  'Beyond the glass, the day begins its ordinary movement. There may be no lesson waiting inside it. Still, the light shifts, and the room changes with it. For now, there is this passing brightness, this little space between one thing and the next.'
] };
const env = () => ({ PERSONAL_PIECE_ENABLED: 'true', OPENROUTER_API_KEY: 'secret', UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'redis-secret', PERSONAL_PIECE_IP_SECRET: 'a-secret-longer-than-thirty-two-characters' });
function request(value = input, headers = {}, method = 'POST') {
  return new Request(`${site}/api/personal-piece`, { method, headers: { Origin: site, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, ...(method === 'POST' ? { body: typeof value === 'string' ? value : JSON.stringify(value) } : {}) });
}
function upstream(result = piece, reservation = 1) {
  const calls = [];
  vi.stubGlobal('fetch', async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (url === 'https://redis.example') return Response.json({ result: reservation });
    return Response.json({ model: 'qwen/qwen3.5-9b', provider: 'Darkbloom', usage: { prompt_tokens: 600, completion_tokens: 180, completion_tokens_details: { reasoning_tokens: 0 } }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
  });
  return calls;
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('personal writer boundary', () => {
  it('reserves before one pinned paid call and returns only validated prose', async () => {
    const calls = upstream();
    const response = await worker.fetch(request(), env());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requestId: id, ...piece, writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' });
    expect(calls.map(c => c.url)).toEqual(['https://redis.example', 'https://openrouter.ai/api/v1/chat/completions']);
    expect(calls[1].body).toMatchObject({ model: 'qwen/qwen3.5-9b', max_tokens: 700, reasoning: { enabled: false }, provider: { only: ['darkbloom/fp4'], allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0.08, completion: 0.13, request: 0 } } });
    expect(calls[0].options.body).not.toContain('A quiet morning');
    expect(calls[0].options.body).not.toContain('192.0.2.1');
  });
  it.each([
    ['method', () => request(input, {}, 'GET'), 405],
    ['origin', () => request(input, { Origin: 'https://other.example' }), 403],
    ['content type', () => request(input, { 'Content-Type': 'text/plain' }), 415],
    ['JSON', () => request('{'), 400],
    ['unknown key', () => request({ ...input, tools: [] }), 400],
    ['UUID', () => request({ ...input, requestId: 'bad' }), 400],
    ['blank', () => request({ ...input, thought: '   ' }), 400],
    ['too long', () => request({ ...input, thought: 'x'.repeat(501) }), 400],
    ['oversized', () => request(' '.repeat(16385)), 413],
    ['bad parent', () => request({ requestId: id, mode: 'revise', instruction: 'shorter', parent: { ...piece, config: {} } }), 400]
  ])('rejects %s before external access', async (_name, make, status) => {
    const calls = upstream();
    expect((await worker.fetch(make(), env())).status).toBe(status);
    expect(calls).toHaveLength(0);
  });
  it('defaults disabled even with credentials', async () => {
    const calls = upstream(); const settings = env(); delete settings.PERSONAL_PIECE_ENABLED;
    expect((await worker.fetch(request(), settings)).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
  it.each([[0, 429], [-1, 409], [null, 503]])('does not infer after reservation result %s', async (reservation, status) => {
    const calls = upstream(piece, reservation);
    expect((await worker.fetch(request(), env())).status).toBe(status);
    expect(calls).toHaveLength(1);
  });
  it.each([{ ...piece, url: 'https://evil.example' }, { title: 'x', paragraphs: ['short', 'text'] }, { ...piece, title: 'x'.repeat(81) }, { ...piece, paragraphs: [...piece.paragraphs, ''] }])('fails malformed output without repair or refund', async output => {
    const calls = upstream(output);
    const response = await worker.fetch(request(), env());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: 'WRITER_FAILED', message: 'The reading could not be generated.' } });
    expect(calls).toHaveLength(2);
  });
  it('treats a revision parent as quoted user data', async () => {
    const calls = upstream();
    expect((await worker.fetch(request({ requestId: id, mode: 'revise', parent: piece, instruction: 'Less reassurance.' }), env())).status).toBe(200);
    expect(JSON.parse(calls[1].body.messages[1].content)).toEqual({ mode: 'revise', parent: piece, instruction: 'Less reassurance.' });
  });
  it.each(['ftp://example.com/file', '//example.com/path', 'custom+app://open', 'data:text/html,hello', 'javascript:alert(1)', 'mailto:reader@example.com'])('rejects actionable URL %s in otherwise valid prose', async url => {
    const calls = upstream({ ...piece, paragraphs: [piece.paragraphs[0], `${piece.paragraphs[1]} ${url}`] });
    expect((await worker.fetch(request(), env())).status).toBe(502);
    expect(calls).toHaveLength(2);
  });
  it('allows ordinary prose colons', async () => {
    upstream({ ...piece, paragraphs: [piece.paragraphs[0], `${piece.paragraphs[1]} Data: a word for what has been noticed. Tomorrow: another word.`] });
    expect((await worker.fetch(request(), env())).status).toBe(200);
  });
  it('bounds a hanging incoming stream by the overall deadline', async () => {
    vi.useFakeTimers(); const calls = upstream();
    const req = new Request(`${site}/api/personal-piece`, { method: 'POST', headers: { Origin: site, 'Content-Type': 'application/json' }, body: new ReadableStream({}), duplex: 'half' });
    const pending = worker.fetch(req, env());
    await vi.advanceTimersByTimeAsync(30001);
    expect((await pending).status).toBe(504);
    expect(calls).toHaveLength(0);
  });
  it.each(['redis', 'provider'])('bounds oversized %s response reads', async target => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return calls === 1 && target === 'provider' ? Response.json({ result: 1 }) : new Response(' '.repeat(target === 'redis' ? 4097 : 32769));
    });
    expect((await worker.fetch(request(), env())).status).toBe(target === 'redis' ? 503 : 502);
    expect(calls).toBe(target === 'redis' ? 1 : 2);
  });
  it.each(['redis', 'provider'])('bounds a hanging %s fetch without retry', async target => {
    vi.useFakeTimers();
    // HMAC is genuine asynchronous WebCrypto, so advance the clock after fetch starts.
    let started; const reached = new Promise(resolve => { started = resolve; }); let calls = 0;
    vi.stubGlobal('fetch', async () => { calls++; if (calls === 1 && target === 'provider') return Response.json({ result: 1 }); started(); return new Promise(() => {}); });
    const pending = worker.fetch(request(), env()); await reached;
    await vi.advanceTimersByTimeAsync(30001);
    expect((await pending).status).toBe(504);
    expect(calls).toBe(target === 'redis' ? 1 : 2);
  });
  it('does not expose provider error content or refund after an ambiguous failure', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls++; if (calls === 1) return Response.json({ result: 1 }); throw new Error('secret user thought provider details'); });
    const response = await worker.fetch(request(), env());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret');
    expect(calls).toBe(2);
  });
  it.each([undefined, { prompt_tokens: 42049, completion_tokens: 180 }, { prompt_tokens: 600, completion_tokens: 701 }, { prompt_tokens: 600, completion_tokens: 180, completion_tokens_details: { reasoning_tokens: 1 } }])('rejects missing or out-of-budget metering without retry', async usage => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => ++calls === 1 ? Response.json({ result: 1 }) : Response.json({ model: 'qwen/qwen3.5-9b', provider: 'Darkbloom', usage, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(piece) } }] }));
    expect((await worker.fetch(request(), env())).status).toBe(502);
    expect(calls).toBe(2);
  });
  it('canonicalizes UUID casing in the global dedup key', async () => {
    const calls = upstream();
    expect((await worker.fetch(request({ ...input, requestId: id.toUpperCase() }), env())).status).toBe(200);
    expect(calls[0].body[3]).toBe('personal:v1:request:550e8400-e29b-41d4-a716-446655440000');
  });
  it('changes daily pseudonyms without placing raw addresses in Redis', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    const calls = upstream(); await worker.fetch(request(), env());
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z')); await worker.fetch(request(), env());
    expect(calls[0].body[5]).not.toBe(calls[2].body[5]);
    expect(calls[0].options.body + calls[2].options.body).not.toContain('192.0.2.1');
  });
});
