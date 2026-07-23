import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHAPEL_CHANTS, findChant, chantsInFamily, chantProgram } from '../content/chapel/chants.js';
import { createChantBed, isChantBedId, CHANT_BED_IDS } from './chant.js';

const VERIFIED_LICENSES = new Set(['CC0', 'PUBLIC_DOMAIN', 'CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0']);

describe('Chant registry (spec §3: no recording without established rights)', () => {
  it('every recording carries a verified license, basis, attribution, and source page', () => {
    expect(CHAPEL_CHANTS.length).toBeGreaterThanOrEqual(9);
    for (const chant of CHAPEL_CHANTS) {
      expect(VERIFIED_LICENSES.has(chant.license), `${chant.id}: ${chant.license}`).toBe(true);
      expect(chant.licenseBasis, chant.id).toMatch(/verified 2026/);
      expect(chant.attribution, chant.id).toBeTruthy();
      expect(chant.performer, chant.id).toBeTruthy();
      expect(chant.url, chant.id).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(chant.sourceUrl, chant.id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(chant.duration, chant.id).toBeGreaterThan(0);
      expect(['gregorian', 'znamenny'], chant.id).toContain(chant.family);
    }
  });

  it('excludes the held recordings: unknown-author archive rips stay out, whatever their tag', () => {
    // Two long Byzantine hymns are CC0-TAGGED on Commons but credited
    // "Unknown author" from an archive.org rip — an uploader's tag on
    // a recording they may not own is not an established right.
    const urls = CHAPEL_CHANTS.map(chant => chant.url);
    expect(urls.some(url => /Byzantine_Ecclesiastical_Hymn/.test(url))).toBe(false);
  });

  it('serves both families with real programs', () => {
    expect(chantsInFamily('gregorian').length).toBeGreaterThanOrEqual(5);
    expect(chantsInFamily('znamenny').length).toBeGreaterThanOrEqual(4);
    expect(chantProgram('gregorian')).not.toBeNull();
    expect(chantProgram('nonexistent')).toBeNull();
    expect(findChant('chant-veni-sancte-spiritus')?.license).toBe('PUBLIC_DOMAIN');
    expect(findChant('chant-of-nowhere')).toBeNull();
  });
});

function fakeCtx() {
  const gainNode = () => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  });
  return {
    currentTime: 0,
    createGain: vi.fn(gainNode),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null
    })),
    decodeAudioData: vi.fn(async () => ({ duration: 60 }))
  };
}

describe('Chant bed', () => {
  it('follows the soundscape contract and plays through the family program', async () => {
    const ctx = fakeCtx();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/ogg' },
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    const bed = createChantBed('gregorian', ctx, {}, { fetchImpl });
    expect(bed).toHaveProperty('start');
    expect(bed).toHaveProperty('stop');

    bed.start();
    await vi.waitFor(() => expect(ctx.createBufferSource).toHaveBeenCalled());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    bed.stop(true);
  });

  it('rejects non-audio responses — a rate-limit page is text/html, not a chant', async () => {
    const ctx = fakeCtx();
    let resolved;
    const settled = new Promise(fulfil => { resolved = fulfil; });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      arrayBuffer: async () => { resolved(); return new ArrayBuffer(8); }
    }));
    // decode would "succeed" on HTML bytes in this fake — exactly why
    // the guard must reject BEFORE decode: without it, garbage becomes
    // a playing source. arrayBuffer() being reached at all proves the
    // guard was bypassed.
    const bed = createChantBed('znamenny', ctx, {}, { fetchImpl });
    bed.start();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    // give the full async chain time to run to completion
    await Promise.race([settled, new Promise(fulfil => setTimeout(fulfil, 50))]);
    await new Promise(fulfil => setTimeout(fulfil, 20));
    expect(fetchImpl.mock.results.length).toBe(1);
    expect(ctx.decodeAudioData).not.toHaveBeenCalled();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
    bed.stop(true);
  });

  it('an unknown family yields null — silence, never a wrong bed', () => {
    expect(createChantBed('taize', fakeCtx(), {})).toBeNull();
  });
});

describe('Engine + policy seams', () => {
  it('the engine routes chant ids to the chant bed', () => {
    expect(isChantBedId('chant-gregorian')).toBe(true);
    expect(isChantBedId('aurora')).toBe(false);
    expect(CHANT_BED_IDS['chant-znamenny'].family).toBe('znamenny');
    const engine = readFileSync(resolve('src/audio/engine.js'), 'utf8');
    expect(engine).toContain('isChantBedId(id)');
    expect(engine).toContain('createChantBed(CHANT_BED_IDS[id].family');
  });

  it('the CSP allows the chant host — a missing host is silent absence, not an error', () => {
    const toml = readFileSync(resolve('netlify.toml'), 'utf8');
    const connectSrc = /connect-src([^;]*)/.exec(toml)?.[1] ?? '';
    expect(connectSrc).toContain('https://upload.wikimedia.org');
  });

  it('the Chapel launches in its own voice; the orbital offers both families', () => {
    const handoff = readFileSync(resolve('src/content/chapel/handoff.js'), 'utf8');
    expect(handoff).toContain("soundscape: 'chant-gregorian'");
    const orbital = readFileSync(resolve('src/components/ChamberOrbital.js'), 'utf8');
    expect(orbital).toContain('data-soundscape="chant-gregorian"');
    expect(orbital).toContain('data-soundscape="chant-znamenny"');
  });

  it('chant is Chapel-exclusive: hidden outside chapel launches, sanitized from stale prefs', () => {
    const orbital = readFileSync(resolve('src/components/ChamberOrbital.js'), 'utf8');
    // the chips carry the chapel gate…
    expect(orbital).toMatch(/chant-only[^>]*\$\{this\.isChapelSession\(\) \? '' : 'hidden'\}/s);
    // …loadText re-evaluates it once provenance is known…
    expect(orbital).toContain("chip.hidden = !this.isChapelSession()");
    // …and a persisted chant bed falls to silence outside the Chapel
    expect(orbital).toContain('_sanitizeChapelExclusives');
    expect(orbital).toMatch(/startsWith\('chant-'\)\)\s*\{\s*this\.config\.soundscape = 'none'/s);
    // [hidden] must actually hide (the option's display:flex would win otherwise)
    const css = readFileSync(resolve('src/components/ChamberOrbital.css'), 'utf8');
    expect(css).toMatch(/\.audio-preset-option\[hidden\]\s*\{[^}]*display:\s*none/);
  });

  it('caches decoded buffers per context: a repeating track fetches once', async () => {
    const ctx = fakeCtx();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/ogg' },
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    // two beds on the SAME context: the second replay of a URL must
    // come from the decoded cache, not the network
    const a = createChantBed('gregorian', ctx, {}, { fetchImpl });
    a.start();
    await vi.waitFor(() => expect(ctx.createBufferSource).toHaveBeenCalled());
    const fetchesAfterFirst = fetchImpl.mock.calls.length;
    a.stop(true);
    const b = createChantBed('gregorian', ctx, {}, { fetchImpl });
    b.start();
    await new Promise(f => setTimeout(f, 30));
    expect(fetchImpl.mock.calls.length).toBe(fetchesAfterFirst); // cache hit
    b.stop(true);
  });

  it('a family whose every track fails settles into permanent silence, not a request cycle', async () => {
    vi.useFakeTimers();
    try {
      const ctx = fakeCtx();
      const fetchImpl = vi.fn(async () => ({ ok: false, headers: { get: () => '' } }));
      const bed = createChantBed('znamenny', ctx, {}, { fetchImpl });
      bed.start();
      // walk far past many 5s retry windows
      for (let i = 0; i < 40; i++) await vi.advanceTimersByTimeAsync(5000);
      const total = fetchImpl.mock.calls.length;
      // once per track at most — never an endless cycle
      const { chantProgram } = await import('../content/chapel/chants.js');
      expect(total).toBeLessThanOrEqual(chantProgram('znamenny').length);
      // and no timer remains armed
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchImpl.mock.calls.length).toBe(total);
      bed.stop(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces each recording as it begins (the provenance contract)', async () => {
    const ctx = fakeCtx();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/ogg' },
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    const seen = [];
    const bed = createChantBed('gregorian', ctx, {}, {
      fetchImpl,
      onTrackChange: (chant) => seen.push(chant)
    });
    bed.start();
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen[0]).toHaveProperty('attribution');
    expect(seen[0]).toHaveProperty('title');
    bed.stop(true);
  });
});
