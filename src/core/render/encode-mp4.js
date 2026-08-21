/**
 * Node encoder adapter — RGBA frames + mixed PCM → H.264/AAC MP4.
 *
 * Chamber and clerk both feed raw RGBA (or PNG if a caller still sends
 * it). Encoded container bytes are not the determinism criterion;
 * decoded frames and mixed samples remain that pin.
 * This module is Node-only. It does not belong in the isomorphic renderer.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fail } from './errors.js';
import { encodeWav } from './wav.js';

function resolveFfmpeg(explicit = null) {
  const configured = explicit || process.env.RISE_FFMPEG_PATH;
  if (configured) return configured;
  try {
    const out = execFileSync('where', ['ffmpeg'], { encoding: 'utf8' });
    const line = out.split(/\r?\n/).map(item => item.trim()).find(Boolean);
    if (line) return line;
  } catch {
    /* try PATH name */
  }
  return 'ffmpeg';
}

function writeChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    const ok = stream.write(chunk, error => {
      if (error) reject(error);
    });
    if (ok) resolve();
    else stream.once('drain', resolve);
  });
}

function padEvenFrame(frame) {
  const width = frame.width + (frame.width % 2);
  const height = frame.height + (frame.height % 2);
  if (width === frame.width && height === frame.height) {
    return { width, height, rgba: frame.rgba };
  }
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < frame.height; y += 1) {
    out.set(
      frame.rgba.subarray(y * frame.width * 4, (y + 1) * frame.width * 4),
      y * width * 4
    );
  }
  return { width, height, rgba: out };
}

function isPngFrame(frame) {
  return frame?.format === 'png' && frame.png != null;
}

function pngBytes(frame) {
  return Buffer.isBuffer(frame.png) ? frame.png : Buffer.from(frame.png);
}

function rgbaBytes(frame) {
  const padded = padEvenFrame(frame);
  return {
    width: padded.width,
    height: padded.height,
    bytes: Buffer.from(
      padded.rgba.buffer,
      padded.rgba.byteOffset,
      padded.rgba.byteLength
    )
  };
}

export async function encodeMp4({
  frames,
  audio,
  outputPath,
  frameRate,
  ffmpegPath = null
} = {}) {
  if (!outputPath || typeof outputPath !== 'string') {
    fail('RENDER_ENCODE_PATH', 'encodeMp4 needs an output path', '$.outputPath');
  }
  const iterator = typeof frames === 'function' ? frames : null;
  if (!iterator && (!Array.isArray(frames) || !frames.length)) {
    fail('RENDER_ENCODE_FRAMES', 'encodeMp4 needs frames or a frame iterator', '$.frames');
  }
  const firstFrame = iterator ? await iterator(0) : frames[0];
  if (!firstFrame) fail('RENDER_ENCODE_FRAMES', 'encodeMp4 received no frames', '$.frames');
  const png = isPngFrame(firstFrame);
  const probe = png
    ? { width: firstFrame.width, height: firstFrame.height, bytes: pngBytes(firstFrame) }
    : rgbaBytes(firstFrame);
  const { width, height } = probe;
  mkdirSync(dirname(outputPath), { recursive: true });
  const fps = frameRate.numerator / frameRate.denominator;
  const staging = mkdtempSync(join(tmpdir(), 'rise-mp4-'));
  const wavPath = join(staging, 'mix.wav');
  writeFileSync(wavPath, encodeWav(audio));

  const ffmpeg = resolveFfmpeg(ffmpegPath);
  const videoInput = png
    ? ['-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0']
    : [
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${width}x${height}`,
      '-framerate', String(fps),
      '-i', 'pipe:0'
    ];
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...videoInput,
    '-i', wavPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    outputPath
  ];

  let stderr = '';
  let frameCount = 0;
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', error => {
      rmSync(staging, { recursive: true, force: true });
      fail('RENDER_ENCODE_FFMPEG',
        'ffmpeg is required to mux an MP4',
        '$.ffmpeg',
        { reason: error.message });
    });
    child.on('close', code => {
      rmSync(staging, { recursive: true, force: true });
      if (code !== 0 || !existsSync(outputPath)) {
        reject(Object.assign(new Error(stderr || `ffmpeg exited ${code}`), {
          name: 'RenderError',
          code: 'RENDER_ENCODE_FAILED',
          path: '$.ffmpeg'
        }));
        return;
      }
      resolve();
    });

    const pump = async () => {
      try {
        await writeChunk(child.stdin, probe.bytes);
        frameCount += 1;
        if (iterator) {
          let index = 1;
          while (true) {
            const frame = await iterator(index);
            if (!frame) break;
            await writeChunk(child.stdin, png ? pngBytes(frame) : rgbaBytes(frame).bytes);
            frameCount += 1;
            index += 1;
          }
        } else {
          for (let i = 1; i < frames.length; i += 1) {
            const frame = frames[i];
            await writeChunk(child.stdin, png ? pngBytes(frame) : rgbaBytes(frame).bytes);
            frameCount += 1;
          }
        }
        child.stdin.end();
      } catch (error) {
        child.kill('SIGKILL');
        reject(error);
      }
    };
    void pump();
  });

  return Object.freeze({
    path: outputPath,
    width,
    height,
    codec: 'h264-social-v1',
    encoder: 'ffmpeg-libx264',
    frameCount,
    durationMs: Math.round((frameCount / fps) * 1000)
  });
}
