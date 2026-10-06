#!/usr/bin/env node
/**
 * Render the drawn prologue (film/prologue/scenes.js) shot by shot, frame by
 * frame, through Chromium's canvas into film/out/raw/anim-<id>.mp4.
 *
 *   node film/scripts/animatic.mjs            # every shot in the EDL that has one
 *   node film/scripts/animatic.mjs 2.1 3.4    # named shots
 *
 * Fonts come from the production build served by `vite preview`, so the
 * same Instrument Serif and Crimson Pro the app sets are used here.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = resolve(HERE, '..');
const RAW = join(FILM, 'out', 'raw');
const ORIGIN = process.env.RISE_FILM_ORIGIN || 'http://127.0.0.1:4318';
const FPS = 24;

const edl = JSON.parse(await readFile(join(FILM, 'edl.json'), 'utf8'));
const scenes = await readFile(join(FILM, 'prologue', 'scenes.js'), 'utf8');
await mkdir(RAW, { recursive: true });

const wanted = process.argv.slice(2);
const shots = edl.shots.filter(s => s.animatic && (!wanted.length || wanted.includes(s.id)));

const browser = await chromium.launch({
  executablePath: process.env.RISE_FILM_CHROMIUM || `${process.env.PLAYWRIGHT_BROWSERS_PATH || ''}/chromium`,
  headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`${ORIGIN}/`);
  await page.locator('.sl-lockup').waitFor({ timeout: 20_000 });
  await page.evaluate(() => {
    for (const node of [...document.head.children]) if (!(node.tagName === 'LINK' && node.rel === 'stylesheet') && node.tagName !== 'STYLE') node.remove();
    document.body.innerHTML = '<canvas id="stage"></canvas><p style="font-family:\'Instrument Serif\'">a</p><p style="font-family:\'Crimson Pro\'">a</p><p style="font-family:\'Instrument Sans\'">a</p>';
  });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: scenes });

  for (const shot of shots) {
    const out = join(RAW, `anim-${shot.id}.mp4`);
    const frames = Math.round(shot.seconds * FPS);
    const started = Date.now();
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'ignore', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
    for (let i = 0; i < frames; i += 1) {
      const dataUrl = await page.evaluate(([id, t, s]) => window.drawFrame(id, t, s), [shot.id, i / FPS, shot.seconds]);
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(bytes)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    console.log(`anim-${shot.id}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
} finally {
  await browser.close();
}
