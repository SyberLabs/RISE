/**
 * What this computer can run. Local Kev-4B needs a GPU it was built for
 * (NVIDIA CUDA, or Apple Silicon through MLX) and enough free memory to load
 * about 9 GB of bf16 weights. RISE never falls back to CPU or a smaller model.
 */
import { execFile } from 'node:child_process';
import os from 'node:os';

const MiB = 1024 * 1024;
export const REQUIREMENTS = Object.freeze({
  nvidiaFreeVramMiB: 10 * 1024,
  loadFreeRamMiB: 6 * 1024,
  appleTotalMiB: 16 * 1024,
  appleFreeMiB: 10 * 1024
});

/** nvidia-smi --query-gpu=index,name,memory.total,memory.used,driver_version --format=csv,noheader,nounits */
export function parseNvidiaSmi(output) {
  return String(output || '').split(/\r?\n/u).map(line => line.trim()).filter(Boolean).map(line => {
    const [index, name, total, used, driver] = line.split(',').map(part => part.trim());
    const memoryTotalMiB = Number(total);
    const memoryUsedMiB = Number(used);
    return /^\d+$/u.test(index) && Number.isFinite(memoryTotalMiB) && Number.isFinite(memoryUsedMiB) && name
      ? { index: Number(index), name, memoryTotalMiB, memoryFreeMiB: memoryTotalMiB - memoryUsedMiB, driver: driver || null } : null;
  }).filter(Boolean);
}

/**
 * macOS counts inactive and speculative pages as reclaimable, but
 * os.freemem() reports only wholly free pages, so a busy Mac looks full.
 */
export function parseVmStat(output) {
  const text = String(output || '');
  const pageSize = Number(/page size of (\d+) bytes/u.exec(text)?.[1]);
  const pages = name => Number(new RegExp(`Pages ${name}:\\s+(\\d+)`, 'u').exec(text)?.[1] || 0);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return null;
  return Math.floor(((pages('free') + pages('inactive') + pages('speculative')) * pageSize) / MiB);
}

function run(command, args) {
  return new Promise(resolve => {
    execFile(command, args, { timeout: 10_000, windowsHide: true }, (error, stdout) => resolve(error ? null : String(stdout)));
  });
}

export async function detectHardware({
  exec = run, platform = process.platform, arch = process.arch,
  totalmem = os.totalmem, freemem = os.freemem
} = {}) {
  const ram = { totalMiB: Math.floor(totalmem() / MiB), freeMiB: Math.floor(freemem() / MiB) };
  let gpu = null;
  if (platform === 'darwin' && arch === 'arm64') {
    const reclaimable = parseVmStat(await exec('vm_stat', []));
    if (reclaimable !== null) ram.freeMiB = Math.max(ram.freeMiB, reclaimable);
    gpu = { kind: 'apple', name: 'Apple Silicon (MLX)', memoryTotalMiB: ram.totalMiB, memoryFreeMiB: ram.freeMiB };
  } else {
    const smi = await exec('nvidia-smi', ['--query-gpu=index,name,memory.total,memory.used,driver_version', '--format=csv,noheader,nounits']);
    const gpus = parseNvidiaSmi(smi);
    if (gpus.length) {
      const best = [...gpus].sort((a, b) => b.memoryFreeMiB - a.memoryFreeMiB)[0];
      gpu = { kind: 'nvidia', ...best };
    }
  }
  return { platform, arch, ram, gpu };
}

/** Whether to load Kev now, and in plain words why not. Rechecked right before loading. */
export function readiness(hardware, requirements = REQUIREMENTS) {
  const { gpu, ram } = hardware;
  if (!gpu) {
    return { ok: false, code: 'NO_GPU', message: 'No supported GPU found. Local Kev needs an NVIDIA GPU with CUDA or an Apple Silicon Mac. RISE still works here for reading and manual settings.' };
  }
  if (gpu.kind === 'nvidia' && gpu.memoryFreeMiB < requirements.nvidiaFreeVramMiB) {
    return { ok: false, code: 'GPU_MEMORY', message: `${gpu.name} has ${gpu.memoryFreeMiB} MiB of free video memory; Kev-4B needs about ${requirements.nvidiaFreeVramMiB} MiB. Close GPU-heavy applications yourself and start again.` };
  }
  if (gpu.kind === 'apple' && ram.totalMiB < requirements.appleTotalMiB) {
    return { ok: false, code: 'UNIFIED_MEMORY', message: `This Mac has ${ram.totalMiB} MiB of memory; Kev-4B needs at least ${requirements.appleTotalMiB} MiB.` };
  }
  const needed = gpu.kind === 'apple' ? requirements.appleFreeMiB : requirements.loadFreeRamMiB;
  if (ram.freeMiB < needed) {
    return { ok: false, code: 'RAM_PRESSURE', message: `Only ${ram.freeMiB} MiB of system memory is free; loading Kev needs about ${needed} MiB. RISE did not close anything. Free memory yourself and start again.` };
  }
  return { ok: true, code: 'READY', message: `${gpu.name}: ${gpu.memoryFreeMiB} MiB free on the GPU, ${ram.freeMiB} MiB free system memory.` };
}
