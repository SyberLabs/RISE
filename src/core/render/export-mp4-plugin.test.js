// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handleExportMp4 } from '../../../scripts/export-mp4-plugin.js';

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(text) { this.body = text || ''; }
  };
}

describe('export MP4 plugin', () => {
  it('GET advertises the kernel without muxing', async () => {
    const res = mockRes();
    await handleExportMp4({ method: 'GET' }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
      available: true,
      kernel: 'renderArtifact'
    });
  });

  it('refuses methods other than GET and POST', async () => {
    const res = mockRes();
    await handleExportMp4({ method: 'DELETE' }, res);
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body).ok).toBe(false);
  });
});
