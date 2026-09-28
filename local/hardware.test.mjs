import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectHardware, parseNvidiaSmi, readiness } from './hardware.mjs';

const GiB = 1024 ** 3;
const rtx = '0, NVIDIA GeForce RTX 5080, 16303, 1210, 576.88\n';

describe('hardware detection', () => {
  it('reads nvidia-smi and prefers the GPU with the most free memory', async () => {
    assert.deepEqual(parseNvidiaSmi(rtx), [{ index: 0, name: 'NVIDIA GeForce RTX 5080', memoryTotalMiB: 16303, memoryFreeMiB: 15093, driver: '576.88' }]);
    const hw = await detectHardware({ platform: 'win32', arch: 'x64', exec: async () => `1, NVIDIA T400, 4096, 100, 576.88\n${rtx}`,
      totalmem: () => 64 * GiB, freemem: () => 20 * GiB });
    assert.equal(hw.gpu.name, 'NVIDIA GeForce RTX 5080');
    assert.equal(hw.gpu.index, 0);
    assert.equal(readiness(hw).ok, true);
  });

  it('recognizes Apple Silicon and counts reclaimable memory the way macOS does', async () => {
    const vmStat = 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 60000.\nPages active: 500000.\nPages inactive: 700000.\nPages speculative: 20000.\n';
    const hw = await detectHardware({ platform: 'darwin', arch: 'arm64', exec: async () => vmStat,
      totalmem: () => 32 * GiB, freemem: () => 1 * GiB });
    assert.equal(hw.gpu.kind, 'apple');
    assert.equal(hw.ram.freeMiB, Math.floor((780000 * 16384) / 1024 ** 2));
    assert.equal(readiness(hw).ok, true);
  });

  it('refuses to load without a supported GPU, and never offers CPU', async () => {
    const hw = await detectHardware({ platform: 'linux', arch: 'x64', exec: async () => null,
      totalmem: () => 64 * GiB, freemem: () => 60 * GiB });
    const result = readiness(hw);
    assert.equal(result.code, 'NO_GPU');
    assert.doesNotMatch(result.message, /CPU mode|smaller model/iu);
  });

  it('refuses under system memory pressure and says it closed nothing', async () => {
    const hw = await detectHardware({ platform: 'win32', arch: 'x64', exec: async () => rtx,
      totalmem: () => 32 * GiB, freemem: () => 2 * GiB });
    const result = readiness(hw);
    assert.equal(result.code, 'RAM_PRESSURE');
    assert.match(result.message, /did not close anything/u);
  });

  it('refuses when the GPU is already mostly in use', async () => {
    const hw = await detectHardware({ platform: 'win32', arch: 'x64', exec: async () => '0, NVIDIA GeForce RTX 5080, 16303, 12000, 576.88',
      totalmem: () => 32 * GiB, freemem: () => 20 * GiB });
    assert.equal(readiness(hw).code, 'GPU_MEMORY');
  });
});
