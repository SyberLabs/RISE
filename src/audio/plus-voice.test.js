// @vitest-environment node
//
// Node, for a real IndexedDB (fake-indexeddb) that clones the stored bytes
// intact; see workshop-media.store.test.js for why jsdom does not.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spokenAtoms, voiceReading, voicingKey } from './plus-voice.js';
import { PlusVoices } from './plus-voice-store.js';
import { recitationPackUrl, voiceAssetKey } from './voice-pack-key.js';
import { Voice } from './voice.js';

const ASSET = 'voiced:abc';
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 7]);
const base64 = bytes => btoa(String.fromCharCode(...bytes));

function answer(text = 'A phrase') {
  return Response.json({
    pack: {
      schema: 'rise.recitation-voice-pack.v1',
      voiced: { hash: 'a'.repeat(64) },
      voices: { el_plus: { entries: { [voiceAssetKey(text)]: { text, asset: ASSET, mimeType: 'audio/mpeg', fromMs: 0, toMs: 400 } } } }
    },
    audio: base64(MP3),
    allowance: { used: 8, limit: 105000, periodEnd: 1_800_000_000 }
  });
}

afterEach(async () => {
  await PlusVoices.clear();
});

describe('voiceReading', () => {
  it('sends the spoken phrases once, keeps the voicing, and asks nothing the second time', async () => {
    const fetchImpl = vi.fn(async () => answer('One stressed phrase'));
    const atoms = [{ content: 'One *stressed* phrase' }, { content: '[PAUSE]' }, { content: '…' }];

    const first = await voiceReading(atoms, { fetchImpl });
    expect(first).toMatchObject({ ok: true, voiceId: 'el_plus', allowance: { used: 8, limit: 105000 } });
    expect(first.manifest.voices.el_plus.entries).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/voice', expect.objectContaining({ method: 'POST', body: JSON.stringify({ atoms: ['One stressed phrase'], voice: 'default' }) }));
    expect(await PlusVoices.get(await voicingKey(['One stressed phrase'], 'default'))).toMatchObject({ pack: first.manifest });

    const second = await voiceReading(atoms, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ ok: true, voiceId: 'el_plus', manifest: first.manifest });
    expect(second.allowance).toBeUndefined();
  });

  it('serves the kept audio for the pack\'s own asset and nothing else', async () => {
    await voiceReading(['A phrase'], { fetchImpl: async () => answer() });
    const network = vi.fn();
    const kept = await voiceReading(['A phrase'], { fetchImpl: network });
    expect(network).not.toHaveBeenCalled();

    const response = await kept.fetchImpl(ASSET);
    expect(response.ok).toBe(true);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(MP3);
    // A second read of the same clip is answered again (the Voice may retry).
    expect((await (await kept.fetchImpl(ASSET)).arrayBuffer()).byteLength).toBe(MP3.length);
    expect((await kept.fetchImpl('/api/plus/audio/voiced/x/audio.mp3')).status).toBe(404);
  });

  it('is a pack the Voice admits, and its clip comes through the Voice\'s fetch hook', async () => {
    const voiced = await voiceReading(['A phrase'], { fetchImpl: async () => answer() });
    const voice = new Voice({ voiceId: voiced.voiceId, manifest: voiced.manifest, fetchImpl: voiced.fetchImpl });
    expect(await voice.load()).toBe(true);
    voice._decode = async bytes => bytes;
    expect(new Uint8Array(await voice._sharedBuffer(ASSET))).toEqual(MP3);
  });

  it('sends the chosen voice, and keeps each voice apart: another voice is voiced again', async () => {
    const fetchImpl = vi.fn(async () => answer());
    await voiceReading(['A phrase'], { fetchImpl, voice: 'river' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ atoms: ['A phrase'], voice: 'river' });
    await voiceReading(['A phrase'], { fetchImpl, voice: 'river' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await voiceReading(['A phrase'], { fetchImpl, voice: 'ember' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await voicingKey(['A phrase'], 'river')).not.toBe(await voicingKey(['A phrase'], 'ember'));
  });

  it('asks again for a different text, and after the store is erased', async () => {
    const fetchImpl = vi.fn(async () => answer());
    await voiceReading(['A phrase'], { fetchImpl });
    await voiceReading(['A phrase', 'and one more'], { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await PlusVoices.clear();
    await voiceReading(['A phrase'], { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('hands back the Worker\'s own code when it refuses, and keeps nothing', async () => {
    const refused = vi.fn(async () => Response.json({ error: { code: 'PLUS_ALLOWANCE', message: 'used up' } }, { status: 402 }));
    expect(await voiceReading(['A phrase'], { fetchImpl: refused })).toEqual({ ok: false, code: 'PLUS_ALLOWANCE', message: 'used up' });
    const upstream = vi.fn(async () => Response.json({ error: { code: 'UPSTREAM', message: 'later' } }, { status: 502 }));
    expect((await voiceReading(['A phrase'], { fetchImpl: upstream })).code).toBe('UPSTREAM');
    expect(await PlusVoices.get(await voicingKey(['A phrase']))).toBeNull();
  });

  it('refuses an answer that is not a pack with audio', async () => {
    const noAudio = async () => Response.json({ pack: { schema: 'rise.recitation-voice-pack.v1', voices: { el_plus: { entries: {} } } } });
    expect((await voiceReading(['A phrase'], { fetchImpl: noAudio })).code).toBe('BAD_PACK');
    const oldShape = async () => Response.json({ schema: 'rise.recitation-voice-pack.v1', voices: { el_plus: { entries: {} } } });
    expect((await voiceReading(['A phrase'], { fetchImpl: oldShape })).code).toBe('BAD_PACK');
  });

  it('still plays a voicing the store cannot keep', async () => {
    const store = { get: async () => { throw new Error('private mode'); }, put: async () => { throw new Error('full'); } };
    const result = await voiceReading(['A phrase'], { fetchImpl: async () => answer(), store });
    expect(result.ok).toBe(true);
    expect((await (await result.fetchImpl(ASSET)).arrayBuffer()).byteLength).toBe(MP3.length);
  });

  it('never asks for silence, and reports an unreachable voice', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    expect((await voiceReading(['...', '[HOLD]'], { fetchImpl })).code).toBe('NOTHING_TO_SAY');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await voiceReading(['A phrase'], { fetchImpl })).code).toBe('OFFLINE');
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
