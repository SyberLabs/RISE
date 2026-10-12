/** Account-private audio in the existing SQLite namespace. No raw text or public URLs.
 * 64 KiB binary values are below SQLite's 2 MB key/value limit. An owner may retain
 * 64 MiB and 1,024 render records; each miss reserves 16 MiB before any vendor call.
 * Expiry/erasure removes bytes and timings, retaining a bounded safety tombstone.
 */
const CHUNK_BYTES = 64 * 1024;
const RENDER_BYTES = 16 * 1024 * 1024;
const OWNER_BYTES = 64 * 1024 * 1024;
const MAX_RECORDS = 1024;
const RETENTION_S = 30 * 24 * 60 * 60;
const MAX_TIMINGS = 80_000;
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
const encodeAudio = bytes => {
  let encoded = '';
  for (let i = 0; i < bytes.length; i += 24 * 1024) encoded += btoa(String.fromCharCode(...bytes.subarray(i, i + 24 * 1024)));
  return encoded;
};

export class PlusAudio {
  constructor(storage) { this.storage = storage; this.kv = storage.kv; }

  records() { return [...this.kv.list({ prefix: 'render:', limit: MAX_RECORDS + 1 })]; }

  remove(render, record, reason) {
    for (let i = 0; i < (record.chunks ?? 0); i++) this.kv.delete(`chunk:${render}:${i}`);
    this.kv.put(`render:${render}`, { state: 'unavailable', reason });
  }

  async alarm() {
    const now = Math.floor(Date.now() / 1000);
    this.storage.transactionSync(() => {
      for (const [key, record] of this.records()) {
        if ((record.state === 'ready' && record.expiresAt <= now) || (record.state === 'pending' && record.at + 300 <= now)) this.remove(key.slice(7), record, record.state === 'ready' ? 'expired' : 'interrupted');
      }
    });
    await this.schedule();
    await this.storage.sync();
  }

  async schedule() {
    const expiries = this.records().filter(([, record]) => ['ready', 'pending'].includes(record.state)).map(([, record]) => record.state === 'ready' ? record.expiresAt : record.at + 300);
    if (expiries.length) await this.storage.setAlarm(Math.min(...expiries) * 1000);
    else await this.storage.deleteAlarm();
  }

  async handle(op, body, now) {
    const { render, token } = body;
    if (op === 'erase') {
      this.storage.transactionSync(() => {
        this.kv.put('generation', (this.kv.get('generation') ?? 0) + 1);
        for (const [key, record] of this.records()) this.remove(key.slice(7), record, 'erased');
      });
      await this.schedule();
      await this.storage.sync();
      return { erased: true };
    }
    if (!/^[a-f0-9]{64}$/u.test(render ?? '')) return { state: 'unavailable' };
    if (op === 'claim') {
      let answer;
      this.storage.transactionSync(() => {
        const record = this.kv.get(`render:${render}`);
        if (record) { answer = record; return; }
        const records = this.records();
        const bytes = records.reduce((sum, [, r]) => sum + (r.state === 'pending' ? RENDER_BYTES : r.bytes ?? 0), 0);
        if (records.length >= MAX_RECORDS || bytes + RENDER_BYTES > OWNER_BYTES) { answer = { state: 'full' }; return; }
        answer = { state: 'pending', token: crypto.randomUUID(), at: now, generation: this.kv.get('generation') ?? 0 };
        this.kv.put(`render:${render}`, answer);
        answer = { ...answer, state: 'claimed' };
      });
      await this.schedule();
      await this.storage.sync(); // A lost claim acknowledgement cannot reach metering or the vendor.
      if (answer.state === 'ready') return this.read(render, answer, now);
      if (answer.state === 'pending') return { state: now - answer.at < 300 ? 'pending' : 'unavailable' };
      return answer;
    }
    if (op === 'release' || op === 'abandon') {
      const result = this.storage.transactionSync(() => {
        const record = this.kv.get(`render:${render}`);
        if (record?.state !== 'pending' || record.token !== token) return { state: 'unavailable' };
        if (op === 'abandon') { this.remove(render, record, 'unconfirmed'); return { state: 'unavailable' }; }
        this.kv.delete(`render:${render}`);
        return { state: 'released' };
      });
      await this.schedule();
      await this.storage.sync();
      return result;
    }
    if (op === 'complete') {
      if (typeof body.audio !== 'string' || body.audio.length > Math.ceil(RENDER_BYTES / 3) * 4
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(body.audio)
        || !Array.isArray(body.timings) || !body.timings.length || body.timings.length > MAX_TIMINGS
        || body.timings.length % 2 || !body.timings.every(t => Number.isFinite(t) && t >= 0)) return { state: 'unavailable' };
      const audio = Uint8Array.from(atob(body.audio), c => c.charCodeAt(0));
      const timings = new Float64Array(body.timings);
      const bytes = new Uint8Array(audio.byteLength + timings.byteLength);
      if (!audio.length || bytes.length > RENDER_BYTES) return { state: 'unavailable' };
      bytes.set(audio);
      bytes.set(new Uint8Array(timings.buffer), audio.byteLength);
      const hash = await digest(bytes);
      const result = this.storage.transactionSync(() => {
        const record = this.kv.get(`render:${render}`);
        if (record?.state !== 'pending' || record.token !== token || record.generation !== (this.kv.get('generation') ?? 0)) return { state: 'unavailable' };
        const chunks = Math.ceil(bytes.byteLength / CHUNK_BYTES);
        for (let i = 0; i < chunks; i++) this.kv.put(`chunk:${render}:${i}`, bytes.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
        const complete = { state: 'ready', expiresAt: now + RETENTION_S, chunks, bytes: bytes.byteLength, audioBytes: audio.byteLength, hash, generation: record.generation };
        this.kv.put(`render:${render}`, complete);
        return complete;
      });
      // Schedule before acknowledging; failure leaves a durable completed render for safe replay.
      await this.schedule();
      await this.storage.sync();
      return result;
    }
    return { state: 'unavailable' };
  }

  async read(render, record, now) {
    if (record.expiresAt <= now) { await this.alarm(); return { state: 'unavailable' }; }
    if (!Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > RENDER_BYTES
      || !Number.isSafeInteger(record.audioBytes) || record.audioBytes <= 0 || record.audioBytes >= record.bytes
      || (record.bytes - record.audioBytes) % 8 || record.chunks !== Math.ceil(record.bytes / CHUNK_BYTES)) return { state: 'unavailable' };
    const bytes = new Uint8Array(record.bytes);
    for (let i = 0; i < record.chunks; i++) {
      const chunk = this.kv.get(`chunk:${render}:${i}`);
      if ((!ArrayBuffer.isView(chunk) || chunk.BYTES_PER_ELEMENT !== 1) || chunk.length !== Math.min(CHUNK_BYTES, record.bytes - i * CHUNK_BYTES)) return { state: 'unavailable' };
      bytes.set(chunk, i * CHUNK_BYTES);
    }
    if (await digest(bytes) !== record.hash || this.kv.get(`render:${render}`)?.state !== 'ready'
      || record.generation !== (this.kv.get('generation') ?? 0)) return { state: 'unavailable' };
    return { state: 'ready', audio: encodeAudio(bytes.subarray(0, record.audioBytes)), timings: [...new Float64Array(bytes.slice(record.audioBytes).buffer)], expiresAt: record.expiresAt };
  }
}
