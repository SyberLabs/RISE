import { describe, expect, it, vi } from 'vitest';
import { spokenAtoms, voiceReading } from './plus-voice.js';
import { recitationPackUrl } from './voice-pack-key.js';

const HASH = 'a'.repeat(64);

describe('voiceReading', () => {
  it('sends the spoken phrases and returns the pack address the session carries', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ schema: 'rise.recitation-voice-pack.v1', voiced: { hash: HASH }, voices: { el_plus: { entries: {} } } }));
    const result = await voiceReading([{ content: 'One *stressed* phrase' }, { content: '[PAUSE]' }, { content: '…' }, 'Two.'], { fetchImpl });
    expect(result).toEqual({ ok: true, voiceId: 'el_plus', pack: `/api/plus/audio/voiced/${HASH}/pack.json` });
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/voice', expect.objectContaining({ method: 'POST', body: JSON.stringify({ atoms: ['One stressed phrase', 'Two.'] }) }));
    expect(recitationPackUrl(result.pack)).toBe(result.pack);
  });

  it('hands back the Worker\'s own code when it refuses', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: { code: 'PLUS_ALLOWANCE', message: 'used up' } }, { status: 402 }));
    expect(await voiceReading(['A phrase'], { fetchImpl })).toEqual({ ok: false, code: 'PLUS_ALLOWANCE', message: 'used up' });
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
  it('admits Plus packs and nothing else under /api', () => {
    expect(recitationPackUrl('/api/plus/audio/el_plus/the-iliad/3/pack.json')).toBeTruthy();
    expect(recitationPackUrl(`/api/plus/audio/voiced/${HASH}/pack.json`)).toBeTruthy();
    expect(recitationPackUrl('/api/plus/audio/voiced/short/pack.json')).toBeNull();
    expect(recitationPackUrl('/api/plus/claim')).toBeNull();
    expect(recitationPackUrl('https://evil.example/pack.json')).toBeNull();
  });
});
