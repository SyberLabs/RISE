import { execFileSync } from 'node:child_process';

/** The one ffmpeg recipe for recitation: mono Ogg Opus, 64 kbps, 48 kHz. */
export function encodeOpus(wavPath, opusPath) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
    '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', '-ar', '48000',
    '-f', 'ogg', opusPath
  ]);
}
