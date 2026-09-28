import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CUDA_TORCH, KEV_CODE_REVISION, KEV_PACKAGE, KEV_REVISION, selfTest } from './rise-local.mjs';
import { KEV_CODE_REVISION as CONTRACT_CODE, KEV_REVISION as CONTRACT_REVISION } from '../src/core/decision/providers.js';

const TOKEN = 'k'.repeat(43);

function fakeServices({ run = `jaredpalmer/kev-4b@${KEV_REVISION}`, attest = KEV_REVISION, foreign = 403 } = {}) {
  return async (url, init = {}) => {
    const headers = { 'x-kev-revision': attest };
    if (url.endsWith('/v1/models')) {
      if (init.headers?.Authorization !== `Bearer ${TOKEN}`) return new Response('no', { status: 401, headers });
      return Response.json({ models: [{ name: 'kev-latest', run, base: 'Qwen/Qwen3.5-4B-Base', device: 'cuda', backend: 'torch', dtype: 'bfloat16' }] }, { headers });
    }
    if (init.headers?.Origin === 'https://evil.example') return new Response('no', { status: foreign });
    return Response.json({ model: 'kev-latest', answers: { pace: { type: 'choice', choice: '100' } } }, { headers });
  };
}

describe('local launcher', () => {
  it('pins the same Kev code and checkpoint as the reader contract', () => {
    assert.equal(KEV_CODE_REVISION, CONTRACT_CODE);
    assert.equal(KEV_REVISION, CONTRACT_REVISION);
    assert.match(KEV_PACKAGE, new RegExp(`archive/${KEV_CODE_REVISION}\\.zip$`, 'u'));
    assert.deepEqual(CUDA_TORCH, ['torch==2.8.0', '--index-url', 'https://download.pytorch.org/whl/cu128']);
  });

  it('self-test passes only for the attested pinned checkpoint behind an authenticated server', async () => {
    const log = console.log;
    const pass = await selfTest({ port: 1, kevPort: 2, token: TOKEN, fetchImpl: fakeServices() });
    assert.ok(pass.every(result => result.ok), JSON.stringify(pass));
    const generic = await selfTest({ port: 1, kevPort: 2, token: TOKEN, fetchImpl: fakeServices({ run: 'Qwen/Qwen3-4B-Instruct' }) });
    assert.equal(generic.find(result => /pinned checkpoint/u.test(result.name)).ok, false);
    const unattested = await selfTest({ port: 1, kevPort: 2, token: TOKEN, fetchImpl: fakeServices({ attest: '' }) });
    assert.equal(unattested.filter(result => !result.ok).length >= 2, true);
    const open = await selfTest({ port: 1, kevPort: 2, token: TOKEN, fetchImpl: fakeServices({ foreign: 200 }) });
    assert.equal(open.find(result => /another website/u.test(result.name)).ok, false);
    console.log = log;
  });
});
