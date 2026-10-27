import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { extname } from 'node:path';

/** Encode recitation and return its content-addressed path; old immutable URLs keep their bytes. */
export function encodeOpus(wavPath, opusPath) {
  const temporary = `${opusPath}.${process.pid}.tmp`;
  try {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
      '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', '-ar', '48000',
      '-f', 'ogg', temporary
    ]);
    const hash = createHash('sha256').update(readFileSync(temporary)).digest('hex');
    const output = `${opusPath.slice(0, -extname(opusPath).length)}-${hash}.opus`;
    renameSync(temporary, output);
    return output;
  } finally { rmSync(temporary, { force: true }); }
}
