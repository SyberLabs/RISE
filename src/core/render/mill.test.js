// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';
import { KERNEL_REQUEST_SCHEMA } from './kernel-request.js';

vi.mock('./artifact.js', () => ({
  renderArtifact: vi.fn(async request => {
    writeFileSync(request.outputPath, Buffer.from('fake-mp4'));
    return {
      mp4Path: request.outputPath,
      srt: '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
      poster: new Uint8Array([0x42, 0x4d]),
      manifest: { schema: 'rise.render-manifest.v1', profile: request.profileId },
      jobHash: `sha256:${'a'.repeat(64)}`,
      job: { profile: request.profileId },
      plan: { frameCount: 6, durationMs: 200 },
      package: {
        'captions.srt': '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
        'poster.bmp': new Uint8Array([0x42, 0x4d]),
        'render-manifest.json': { schema: 'rise.render-manifest.v1', profile: request.profileId },
        'experience.mp4': Buffer.from('fake-mp4')
      },
      encoded: { path: request.outputPath, width: 108, height: 192, codec: 'h264', encoder: 'libx264' }
    };
  })
}));

vi.mock('../producer.js', () => ({
  runProducer: vi.fn(async ({ encode }) => ({
    stage: 'review-queued',
    job: { profile: 'social-portrait-1080' },
    packages: {
      'social-portrait-1080': {
        mp4Path: encode.outputPath,
        srt: '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
        poster: new Uint8Array([0x42, 0x4d]),
        manifest: { schema: 'rise.render-manifest.v1' },
        jobHash: `sha256:${'b'.repeat(64)}`,
        package: {
          'captions.srt': '1\n00:00:00,000 --> 00:00:00,200\nHello\n',
          'poster.bmp': new Uint8Array([0x42, 0x4d]),
          'render-manifest.json': { schema: 'rise.render-manifest.v1' },
          'experience.mp4': Buffer.from('fake-mp4')
        },
        encoded: { path: encode.outputPath }
      }
    }
  }))
}));

const {
  MILL_RENDER_PATH,
  admitMillJob,
  closeMill,
  createMill,
  drainMill,
  getMillJob,
  handleMillRequest,
  startMill
} = await import('./mill.js');
const { renderArtifact } = await import('./artifact.js');

const program = {
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'mill-score',
  authority: 'user',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: [{
      id: 'm1',
      anchor: { sourceIds: ['source-anna'] },
      data: { index: 0, title: 'One' }
    }]
  }]
};

const sources = [{ id: 'source-anna', name: 'Anna', data: 'Happy families are all alike.' }];

const kernelRequest = {
  schema: KERNEL_REQUEST_SCHEMA,
  program,
  sources,
  painter: 'clerk',
  scale: 0.1,
  profileId: 'social-portrait-1080'
};

const dirs = [];
const mills = [];
const servers = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rise-mill-'));
  dirs.push(dir);
  return dir;
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writableEnded: false,
    setHeader(name, value) { this.headers[name] = value; },
    end(text) {
      this.body = text || '';
      this.writableEnded = true;
    }
  };
}

function mockReq({ method, url, body = '' }) {
  const req = Readable.from([Buffer.from(body)]);
  req.method = method;
  req.url = url;
  return req;
}

function httpJson(url, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = httpRequest({
      hostname: u.hostname,
      port: u.port,
      path: `${u.pathname}${u.search}`,
      method,
      headers: payload == null ? {} : {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
}

afterEach(async () => {
  vi.mocked(renderArtifact).mockClear();
  while (servers.length) {
    await closeServer(servers.pop());
  }
  while (mills.length) {
    closeMill(mills.pop());
  }
  while (dirs.length) {
    rmSync(dirs.pop(), { recursive: true, force: true });
  }
});

describe('render mill HTTP admit', () => {
  it('GET /v1/render advertises the kernel without muxing', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const res = mockRes();
    await handleMillRequest(mill, { method: 'GET', url: MILL_RENDER_PATH, on() {} }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
      mill: true,
      kernel: 'renderArtifact'
    });
    expect(renderArtifact).not.toHaveBeenCalled();
  });

  it('POST /v1/render admits a kernel request into SQLite as queued', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const res = mockRes();
    await handleMillRequest(mill, mockReq({
      method: 'POST',
      url: MILL_RENDER_PATH,
      body: JSON.stringify(kernelRequest)
    }), res);
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('queued');
    expect(body.program_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(body.artifact_path).toBeNull();
    const row = getMillJob(mill.db, body.id);
    expect(row).toMatchObject({
      id: body.id,
      program_hash: body.program_hash,
      status: 'queued',
      artifact_path: null,
      error: null
    });
    const sqlite = readFileSync(join(mill.root, 'mill.sqlite')).subarray(0, 15).toString('utf8');
    expect(sqlite).toBe('SQLite format 3');
    expect(existsSync(join(mill.jobsDir, body.id, 'request.json'))).toBe(true);
    expect(renderArtifact).not.toHaveBeenCalled();
  });

  it('POST of program JSON lands through intake classification', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const res = mockRes();
    await handleMillRequest(mill, mockReq({
      method: 'POST',
      url: MILL_RENDER_PATH,
      body: JSON.stringify({ program, sources })
    }), res);
    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body).status).toBe('queued');
  });

  it('refuses unknown JSON before a row exists', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const res = mockRes();
    await handleMillRequest(mill, mockReq({
      method: 'POST',
      url: MILL_RENDER_PATH,
      body: JSON.stringify({ schema: 'rise.not-a-job.v1' })
    }), res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('admits over a real localhost POST', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const started = await startMill(mill, { port: 0 });
    servers.push(started.server);
    const posted = await httpJson(`${started.url}${MILL_RENDER_PATH}`, {
      method: 'POST',
      body: kernelRequest
    });
    expect(posted.status).toBe(202);
    const body = JSON.parse(posted.body);
    expect(body.status).toBe('queued');
    await drainMill(mill);
    const got = await httpJson(`${started.url}${MILL_RENDER_PATH}/${body.id}`);
    expect(got.status).toBe(200);
    const job = JSON.parse(got.body);
    expect(job.status).toBe('done');
    expect(job.artifact_path).toBe(join(mill.jobsDir, body.id, 'experience.mp4'));
  });
});

describe('render mill sqlite status and artifacts', () => {
  it('drains a queued job to done and writes mp4/srt/poster/manifest', async () => {
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const admitted = await admitMillJob(mill, kernelRequest);
    expect(getMillJob(mill.db, admitted.id).status).toBe('queued');
    await drainMill(mill);
    const row = getMillJob(mill.db, admitted.id);
    expect(row.status).toBe('done');
    expect(row.error).toBeNull();
    expect(row.artifact_path).toBe(join(mill.jobsDir, admitted.id, 'experience.mp4'));
    expect(existsSync(row.artifact_path)).toBe(true);
    expect(existsSync(join(mill.jobsDir, admitted.id, 'captions.srt'))).toBe(true);
    expect(existsSync(join(mill.jobsDir, admitted.id, 'poster.bmp'))).toBe(true);
    expect(existsSync(join(mill.jobsDir, admitted.id, 'render-manifest.json'))).toBe(true);
    expect(renderArtifact).toHaveBeenCalledOnce();
    const request = vi.mocked(renderArtifact).mock.calls[0][0];
    expect(request.schema).toBe(KERNEL_REQUEST_SCHEMA);
    expect(request.program.id).toBe('mill-score');
  });

  it('records sqlite error status when the kernel refuses', async () => {
    vi.mocked(renderArtifact).mockRejectedValueOnce(new Error('mux failed'));
    const mill = await createMill({ root: tempDir() });
    mills.push(mill);
    const admitted = await admitMillJob(mill, kernelRequest);
    await drainMill(mill);
    const row = getMillJob(mill.db, admitted.id);
    expect(row.status).toBe('error');
    expect(row.artifact_path).toBeNull();
    expect(row.error).toMatch(/mux failed/);
  });
});
