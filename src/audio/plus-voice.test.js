// @vitest-environment node
//
// Node, for a real IndexedDB (fake-indexeddb) that clones the stored bytes
// intact; see workshop-media.store.test.js for why jsdom does not.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spokenAtoms, voiceReading } from './plus-voice.js';
import { erasePlusAudio, forgetPlus, notePlusClaimed } from '../app/plus.js';
import { PlusVoices } from './plus-voice-store.js';
import { recitationPackUrl, voiceAssetKey } from './voice-pack-key.js';
import { Voice } from './voice.js';

const ASSET = 'voiced:abc';
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 7]);
const base64 = bytes => btoa(String.fromCharCode(...bytes));

const SCOPE = 'a'.repeat(64);
function answer(text = 'A phrase') {
  return Response.json({
    pack: {
      schema: 'rise.recitation-voice-pack.v1',
      voiced: { hash: 'a'.repeat(64) },
      voices: { el_plus: { entries: { [voiceAssetKey(text)]: { text, asset: ASSET, mimeType: 'audio/mpeg', fromMs: 0, toMs: 400 } } } }
    },
    audio: base64(MP3),
    cache: { hit: true, scope: SCOPE, expiresAt: 1_800_000_000 },
    allowance: { used: 8, limit: 105000, periodEnd: 1_800_000_000 }
  });
}

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
});
afterEach(async () => { await PlusVoices.clear(); vi.unstubAllGlobals(); });

const authenticated = (reply = answer) => vi.fn(async url => url === '/api/plus/status'
  ? Response.json({ admin: false, subscriber: true, available: false, audioScope: SCOPE }) : reply());

describe('voiceReading', () => {
  it('asks the authenticated server for every load, including after browser audio is cleared', async () => {
    const fetchImpl = authenticated(() => answer('One stressed phrase'));
    const atoms = [{ content: 'One *stressed* phrase' }, { content: '[PAUSE]' }, { content: '…' }];
    const first = await voiceReading(atoms, { fetchImpl });
    expect(first).toMatchObject({ ok: true, voiceId: 'el_plus', allowance: { used: 8, limit: 105000 } });
    await PlusVoices.clear();
    const second = await voiceReading(atoms, { fetchImpl });
    expect(second).toMatchObject({ ok: true, allowance: { used: 8 } });
    expect(fetchImpl.mock.calls.filter(([url]) => url === '/api/plus/voice')).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/voice', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ atoms: ['One stressed phrase'], voice: 'default' }) }));
  });

  it('cannot replay a previous account after the server refuses authentication', async () => {
    const first = await voiceReading(['A phrase'], { fetchImpl: authenticated() });
    expect(first.ok).toBe(true);
    const denied = vi.fn(async () => Response.json({ error: { code: 'PLUS_REQUIRED', message: 'Sign in.' } }, { status: 402 }));
    expect(await voiceReading(['A phrase'], { fetchImpl: denied })).toMatchObject({ ok: false, code: 'PLUS_REQUIRED' });
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it('serves only the returned pack asset and uses the current server pack for each voice and segmentation', async () => {
    const fetchImpl = authenticated();
    const voiced = await voiceReading(['A phrase'], { fetchImpl, voice: 'river' });
    expect(new Uint8Array(await (await voiced.fetchImpl(ASSET)).arrayBuffer())).toEqual(MP3);
    expect((await voiced.fetchImpl('/unrelated')).status).toBe(404);
    await voiceReading(['A', 'phrase'], { fetchImpl, voice: 'ember' });
    const requests = fetchImpl.mock.calls.filter(([url]) => url === '/api/plus/voice').map(([, options]) => JSON.parse(options.body));
    expect(requests).toEqual([{ atoms: ['A phrase'], voice: 'river' }, { atoms: ['A', 'phrase'], voice: 'ember' }]);
  });

  it('rejects audio when the authenticated account changed while the render was pending', async () => {
    const fetchImpl = vi.fn(async url => url === '/api/plus/status'
      ? Response.json({ subscriber: true, available: true, audioScope: 'b'.repeat(64) }) : answer());
    expect(await voiceReading(['A phrase'], { fetchImpl })).toMatchObject({ ok: false, code: 'PLUS_SESSION_CHANGED' });
  });

  it('does not admit audio if the post-render identity check fails', async () => {
    const fetchImpl = vi.fn(async url => url === '/api/plus/status' ? new Response(null, { status: 503 }) : answer());
    expect(await voiceReading(['A phrase'], { fetchImpl })).toMatchObject({ ok: false, code: 'PLUS_AUDIO_AUTH' });
  });

  it.each(['forget', 'claim'])('discards an in-flight response after %s changes the session', async action => {
    let finish;
    const fetchImpl = authenticated(() => new Promise(resolve => { finish = resolve; }));
    const pending = voiceReading(['A phrase'], { fetchImpl });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    if (action === 'forget') await forgetPlus({ fetchImpl: async () => new Response(null, { status: 204 }) });
    else notePlusClaimed();
    finish(answer());
    expect(await pending).toMatchObject({ ok: false, code: 'PLUS_SESSION_CHANGED' });
  });

  it('revokes a request started while forgetting Plus is still pending', async () => {
    let finishForget;
    const forgetting = forgetPlus({ fetchImpl: () => new Promise(resolve => { finishForget = resolve; }) });
    let finishVoice;
    const pending = voiceReading(['A phrase'], { fetchImpl: authenticated(() => new Promise(resolve => { finishVoice = resolve; })) });
    finishForget(new Response(null, { status: 204 }));
    await forgetting;
    finishVoice(answer());
    expect(await pending).toMatchObject({ ok: false, code: 'PLUS_SESSION_CHANGED' });
  });

  it('deleting account audio revokes pending playback without forgetting the receipt or allowance', async () => {
    localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: 1, allowance: { used: 8, limit: 100 } }));
    let finish;
    const pending = voiceReading(['A phrase'], { fetchImpl: authenticated(() => new Promise(resolve => { finish = resolve; })) });
    expect(await erasePlusAudio({ fetchImpl: async () => Response.json({ erased: true }) })).toEqual({ ok: true, localCleared: true });
    finish(answer());
    expect(await pending).toMatchObject({ ok: false, code: 'PLUS_SESSION_CHANGED' });
    expect(JSON.parse(localStorage.getItem('rise.plus'))).toEqual({ claimedAt: 1, allowance: { used: 8, limit: 100 } });
  });

  it('revokes previously admitted playback when Plus is forgotten', async () => {
    const voiced = await voiceReading(['A phrase'], { fetchImpl: authenticated() });
    const voice = new Voice({ voiceId: voiced.voiceId, manifest: voiced.manifest, fetchImpl: voiced.fetchImpl, signal: voiced.signal });
    voice.enabled = true;
    expect(await voice.load()).toBe(true);
    expect(voice.available).toBe(true);
    voice._decode = async bytes => bytes;
    expect(new Uint8Array(await voice._sharedBuffer(ASSET))).toEqual(MP3);
    await forgetPlus({ fetchImpl: async () => new Response(null, { status: 204 }) });
    expect((await voiced.fetchImpl(ASSET)).status).toBe(401);
    expect(voice.available).toBe(false);
  });

  it.each([
    ['PLUS_AUDIO_PENDING', 409], ['PLUS_AUDIO_UNAVAILABLE', 409], ['PLUS_AUDIO_STORAGE', 503], ['PLUS_AUDIO_FULL', 507], ['UPSTREAM', 502]
  ])('preserves %s without automatically retrying generation', async (code, status) => {
    const fetchImpl = vi.fn(async () => Response.json({ error: { code, message: 'A clear server explanation.' } }, { status }));
    expect(await voiceReading(['A phrase'], { fetchImpl })).toEqual({ ok: false, code, message: 'A clear server explanation.' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses malformed audio, and never asks for silence', async () => {
    const noAudio = authenticated(() => Response.json({ pack: { schema: 'rise.recitation-voice-pack.v1', voices: { el_plus: { entries: {} } } } }));
    expect((await voiceReading(['A phrase'], { fetchImpl: noAudio })).code).toBe('BAD_PACK');
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    expect((await voiceReading(['...', '[HOLD]'], { fetchImpl })).code).toBe('NOTHING_TO_SAY');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await voiceReading(['A phrase'], { fetchImpl })).code).toBe('OFFLINE');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(spokenAtoms(null)).toEqual([]);
  });
});

describe('recitationPackUrl', () => {
  it('admits canon Plus packs, and no voiced reading has an address', () => {
    expect(recitationPackUrl('/api/plus/audio/el_plus/the-iliad/3/pack.json')).toBeTruthy();
    expect(recitationPackUrl(`/api/plus/audio/voiced/${'a'.repeat(64)}/pack.json`)).toBeNull();
    expect(recitationPackUrl('/api/plus/claim')).toBeNull();
    expect(recitationPackUrl('https://evil.example/pack.json')).toBeNull();
  });
});
