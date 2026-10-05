#!/usr/bin/env node
/**
 * Cut the film from film/edl.json with ffmpeg.
 *
 *   node film/scripts/assemble.mjs            # film/out/review-cut.mp4
 *   node film/scripts/assemble.mjs --master   # film/out/master.mp4 (slower encode)
 *
 * Every shot becomes one normalised segment (1920×1080, 24 fps, yuv420p),
 * the segments are joined, and the sound (music, voice, the supplied
 * pitch) is mixed, ducked and loudness-normalised onto it. A Runway or
 * supplied clip that is missing is cut as its slate so the film always
 * runs its full length.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FILM = join(ROOT, 'film');
const OUT = join(FILM, 'out');
const SEG = join(OUT, 'seg');
const CARDS = join(OUT, 'cards');
const master = process.argv.includes('--master');
const FFMPEG = process.env.RISE_FFMPEG_PATH || 'ffmpeg';

const edl = JSON.parse(await readFile(join(FILM, 'edl.json'), 'utf8'));
const { fps, width, height } = edl;
const at = p => resolve(ROOT, p);
const fmt = n => Number(n).toFixed(3);
const preset = master ? 'slow' : 'veryfast';
const crf = master ? '17' : '20';

async function ffmpeg(args, label) {
  try {
    await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  } catch (error) {
    throw new Error(`${label}: ${error.stderr || error.message}`);
  }
}

/** Overlay this shot's lower thirds, each fading in and out, onto [v]. */
function lowerThirdGraph(shot, inputsOffset) {
  let graph = '';
  let last = 'v';
  (shot.lowerThirds || []).forEach((lt, i) => {
    const start = lt.at;
    const end = lt.at + lt.for;
    const label = `lt${i}`;
    graph += `[${inputsOffset + i}:v]format=rgba,fade=t=in:st=${fmt(start)}:d=0.45:alpha=1,`
      + `fade=t=out:st=${fmt(end - 0.45)}:d=0.45:alpha=1,setpts=PTS-STARTPTS[${label}];`
    graph += `[${last}][${label}]overlay=0:0:enable='between(t,${fmt(start)},${fmt(end)})'[${label}o];`;
    last = `${label}o`;
  });
  return { graph, last };
}

const VIDEO_OUT = ['-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps), '-an'];

/** One normalised segment per shot; returns its path. */
async function segment(shot, index) {
  const file = join(SEG, `${String(index).padStart(2, '0')}-${shot.id}.mp4`);
  const seconds = shot.seconds;
  const still = name => join(CARDS, `${name}.png`);
  // Each lower third is a still looped for the shot's length, so its fades have a clock to run on.
  const ltInputs = (shot.lowerThirds || []).flatMap(lt => [
    '-loop', '1', '-framerate', String(fps), '-t', fmt(seconds), '-i', still(`lt-${lt.name}`)
  ]);
  const size = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=#080d16,setsar=1`;

  if (shot.source === 'card') {
    const fadeIn = shot.fadeIn ?? 0.8;
    const fadeOut = shot.fadeOut ?? 0.8;
    // A slow 2% push over the card's life so it breathes rather than sits.
    const frames = Math.round(seconds * fps);
    const graph = `[0:v]${size},zoompan=z='1+0.02*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},`
      + `fade=t=in:st=0:d=${fmt(fadeIn)},fade=t=out:st=${fmt(seconds - fadeOut)}:d=${fmt(fadeOut)},format=yuv420p[v]`;
    await ffmpeg(['-loop', '1', '-framerate', String(fps), '-t', fmt(seconds), '-i', still(shot.card),
      '-filter_complex', graph, '-map', '[v]', '-t', fmt(seconds), ...VIDEO_OUT, file], `card ${shot.id}`);
    return file;
  }

  const clip = shot.clip ? at(shot.clip) : null;
  const present = clip && existsSync(clip);
  if (!present) {
    // The slate: a 0.4 s fade in, hard out, so missing shots still cut like shots.
    const graph = `[0:v]${size},fade=t=in:st=0:d=0.4,format=yuv420p[v]`;
    await ffmpeg(['-loop', '1', '-framerate', String(fps), '-t', fmt(seconds), '-i', still(`slate-${shot.id}`),
      '-filter_complex', graph, '-map', '[v]', '-t', fmt(seconds), ...VIDEO_OUT, file], `slate ${shot.id}`);
    return file;
  }

  // Rendered app footage gets a light grade; Runway and supplied clips pass clean.
  // `glow` (the attractor) screens a blurred copy over itself and lifts it.
  // No brightness or gamma lift: on a black field that only turns the void grey.
  // Blend in RGB: screening YUV planes screens the chroma too and tints the void.
  const grade = shot.glow
    ? `,format=gbrp,split=3[g0][g1][g2];[g1]gblur=sigma=5[gn];[g2]gblur=sigma=28[gw];`
      + `[g0][gn]blend=all_mode=screen[gs];[gs][gw]blend=all_mode=screen:all_opacity=0.9,`
      + `format=yuv420p,eq=contrast=1.3:saturation=1.3,vignette=angle=PI/4.5`
    : shot.source === 'rendered'
      ? ',eq=contrast=1.05:saturation=1.08:gamma=0.98,vignette=angle=PI/5'
      : '';
  // `zoom` pushes in on the centre: a small attractor fills more of the frame.
  const zoom = shot.zoom > 1
    ? `,scale=iw*${fmt(shot.zoom)}:ih*${fmt(shot.zoom)},crop=${width}:${height}`
    : '';
  const { graph: ltGraph, last } = lowerThirdGraph(shot, 1);
  const graph = `[0:v]${size}${zoom},fps=${fps}${grade},setpts=PTS-STARTPTS[v];${ltGraph}[${last}]format=yuv420p[out]`;
  await ffmpeg(['-ss', fmt(shot.in || 0), '-t', fmt(seconds), '-i', clip, ...ltInputs,
    '-filter_complex', graph, '-map', '[out]', '-t', fmt(seconds), ...VIDEO_OUT, file], `clip ${shot.id}`);
  return file;
}

/* ───────────────────────────── timeline ───────────────────────────── */

await mkdir(SEG, { recursive: true });
let cursor = 0;
const timeline = edl.shots.map(shot => {
  const entry = { ...shot, start: cursor };
  cursor += shot.seconds;
  return entry;
});
const total = cursor;
const stamp = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
console.log(`${edl.title}: ${timeline.length} shots, ${stamp(total)}`);

const segments = [];
for (const [i, shot] of timeline.entries()) {
  const file = await segment(shot, i);
  const present = shot.source === 'card' || (shot.clip && existsSync(at(shot.clip)));
  console.log(`  ${shot.id.padEnd(4)} ${fmt(shot.start).padStart(8)}  ${String(shot.seconds).padStart(3)} s  ${shot.source.padEnd(9)} ${present ? '' : 'SLATE  '}${shot.title || shot.card}`);
  segments.push(file);
}

const list = join(OUT, 'segments.txt');
await writeFile(list, segments.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
const video = join(OUT, 'video.mp4');
await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video], 'concat');

/* ─────────────────────────────── sound ─────────────────────────────── */

// Audio inputs follow the video (input 0); each push returns its index.
const inputs = [];
let inputCount = 1;
const addInput = (...args) => { inputs.push(...args); return inputCount++; };
let graph = '';
const mixes = [];

// Music: the real track, or a quiet synthesised bed so the cut has pulse.
const musicFile = at(edl.music.file);
const offset = edl.music.offset || 0;
if (existsSync(musicFile)) {
  const i = addInput('-ss', fmt(offset), '-i', musicFile);
  graph += `[${i}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${fmt(total)},afade=t=out:st=${fmt(total - 2)}:d=2[music0];`;
} else {
  const bpm = 96;
  const pulse = bpm / 60;
  // Layered sines under a slow swell, with a soft sub pulse on the beat.
  const expr = [
    `0.16*sin(2*PI*55*t)*(0.55+0.45*sin(2*PI*0.05*t))`,
    `0.07*sin(2*PI*110.3*t)*(0.6+0.4*sin(2*PI*0.13*t+1))`,
    `0.05*sin(2*PI*164.8*t)*(0.5+0.5*sin(2*PI*0.21*t+2))`,
    `0.04*sin(2*PI*329.6*t)*(0.5+0.5*sin(2*PI*0.08*t))`,
    // One soft peak per beat; written without commas, which lavfi would read as a filter break.
    `0.10*sin(2*PI*55*t)*exp(14*log((1+sin(2*PI*${pulse}*t))/2+0.000001))`
  ].join('+');
  const i = addInput('-f', 'lavfi', '-t', fmt(total), '-i', `aevalsrc=${expr}|${expr}:s=48000`);
  graph += `[${i}:a]lowpass=f=1800,aecho=0.6:0.3:120|260:0.25|0.15,`
    + `afade=t=in:st=0:d=3,afade=t=out:st=${fmt(total - 3)}:d=3,volume=0.5[music0];`;
}

// Duck the music under every shot that carries voice.
const voiced = timeline.filter(shot => shot.voice && shot.clip && existsSync(at(shot.clip)));
const duck = Math.pow(10, (edl.music.duckUnderVoiceDb ?? -18) / 20);
if (voiced.length) {
  const enable = voiced.map(shot => `between(t,${fmt(shot.start)},${fmt(shot.start + shot.seconds)})`).join('+');
  graph += `[music0]volume=enable='${enable}':volume=${fmt(duck)}[music];`;
} else {
  graph += `[music0]anull[music];`;
}
mixes.push('[music]');

// The supplied pitch brings its own sound, placed where it sits in the cut.
for (const shot of voiced) {
  const i = addInput('-ss', fmt(shot.in || 0), '-t', fmt(shot.seconds), '-i', at(shot.clip));
  graph += `[${i}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round(shot.start * 1000)}|${Math.round(shot.start * 1000)}[voice${i}];`;
  mixes.push(`[voice${i}]`);
}

// Optional voice-over lines.
for (const line of edl.voice || []) {
  const file = at(line.file);
  if (!existsSync(file)) continue;
  const i = addInput('-i', file);
  graph += `[${i}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round(line.at * 1000)}|${Math.round(line.at * 1000)}[vo${i}];`;
  mixes.push(`[vo${i}]`);
}

graph += `${mixes.join('')}amix=inputs=${mixes.length}:normalize=0:duration=first,`
  + `loudnorm=I=${edl.music.targetLufs ?? -14}:TP=-1:LRA=11,aresample=48000[a]`;

const output = join(OUT, master ? 'master.mp4' : 'review-cut.mp4');
await ffmpeg(['-i', video, ...inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', output], 'mix');

// A contact sheet: one frame every eight seconds, for a glance at the whole cut.
const sheet = join(OUT, master ? 'master-sheet.png' : 'review-sheet.png');
await ffmpeg(['-i', output, '-vf', `fps=1/8,scale=384:-1,tile=6x${Math.ceil(total / 8 / 6)}`, '-frames:v', '1', sheet], 'sheet');

// YouTube chapters from the acts.
const chapters = [];
for (const shot of timeline) {
  if (!chapters.length || chapters.at(-1).act !== shot.act) chapters.push({ act: shot.act, start: shot.start });
}
await writeFile(join(OUT, 'chapters.txt'), chapters.map(c => `${stamp(c.start)} ${c.act}`).join('\n') + '\n');

console.log(`\n${output}\n${sheet}\n${join(OUT, 'chapters.txt')}`);
