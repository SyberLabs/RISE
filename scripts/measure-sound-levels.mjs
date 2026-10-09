/**
 * Measure every offered sound through the real engine (SND-001), on demand,
 * never in CI: `node scripts/measure-sound-levels.mjs [id ...]`.
 *
 * Starts a Vite dev server, opens headless Chromium with Playwright, and for
 * each sound in SOUND_GROUPS builds a fresh AudioEngine at its defaults
 * (soundscape layer 0.85, master 0.7), starts the sound the way the Chamber
 * does, with its trim from src/audio/sound-levels.js, and taps the engine's
 * last node (lifecycleGate) with an AudioWorklet in real time. RMS and peak
 * are taken over 25 s from 3 s after the start, past the 2 s fade-in.
 *
 * Writes docs/evals/sound/levels.json (all sounds only) and prints a table
 * with the trim each sound would need to sit at the band's centre.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { LEVEL_BAND, SOUND_TRIM_DB } from '../src/audio/sound-levels.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evals/sound/levels.json');
const WINDOW = { fromS: 3, seconds: 25 };
const CONCURRENCY = 3;
const only = process.argv.slice(2);

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.on = true; this.port.onmessage = () => { this.on = false; }; }
  process(inputs) {
    if (!this.on) return true;
    const input = inputs[0];
    const left = input?.[0] ?? new Float32Array(128);
    this.port.postMessage([left.slice(), (input?.[1] ?? left).slice()]);
    return true;
  }
}
registerProcessor('tap', Tap);`;

/** In the page: one sound, started as the Chamber starts it, measured over the window. */
async function measureInPage({ sound, window: { fromS, seconds }, worklet }) {
  const { AudioEngine } = await import('/src/audio/engine.js');
  const engine = new AudioEngine();
  await engine.init();
  await engine.resume();
  for (let i = 0; i < 20 && !engine.mayScheduleAudio; i += 1) {
    await engine.lifecycle.recover();
    if (!engine.mayScheduleAudio) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!engine.mayScheduleAudio) throw new Error(`the clock never ran: ${engine.lifecycle?.status}`);
  const context = engine.context;
  await context.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: 'application/javascript' })));
  const tap = new AudioWorkletNode(context, 'tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
  const sink = context.createGain();
  sink.gain.value = 0;
  tap.connect(sink).connect(context.destination);
  const skip = Math.round(fromS * context.sampleRate);
  const want = Math.round(seconds * context.sampleRate);
  let seen = 0;
  let counted = 0;
  let sum = 0;
  let peak = 0;
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  tap.port.onmessage = ({ data: [left, right] }) => {
    for (let i = 0; i < left.length && counted < want; i += 1, seen += 1) {
      if (seen < skip) continue;
      sum += left[i] * left[i] + right[i] * right[i];
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      counted += 1;
    }
    if (counted >= want) { tap.port.postMessage('stop'); finish(); }
  };
  engine.lifecycleGate.connect(tap);
  if (sound.kind === 'tone') { engine.stopSoundscape(true); engine.applyPreset(sound.id); }
  else { engine.applyPreset('silent'); engine.startSoundscape(sound.id); }
  await finished;
  const settings = { soundscapeLayer: engine.config.layerVolumes.soundscape, master: engine.config.masterVolume, fadeInS: engine.config.fadeTime, sampleRate: context.sampleRate };
  engine.destroy?.();
  return { rms: Math.sqrt(sum / (2 * want)), peak, settings };
}

const dbfs = value => (value > 0 ? Math.round(20 * Math.log10(value) * 10) / 10 : -Infinity);

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/u, '');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.goto(`${origin}/src/audio/sound-list.js`);
  let sounds = await page.evaluate(async () => {
    const { SOUND_GROUPS } = await import('/src/audio/sound-list.js');
    return SOUND_GROUPS.flatMap(group => group.entries.filter(entry => entry.kind !== 'silence').map(({ id, kind }) => ({ id, kind })));
  });
  await page.close();
  if (only.length) sounds = sounds.filter(sound => only.includes(sound.id));

  const results = new Map();
  let settings = null;
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < sounds.length) {
      const sound = sounds[next++];
      const context = await browser.newContext();
      const tab = await context.newPage();
      await tab.goto(`${origin}/src/audio/sound-list.js`);
      const measured = await tab.evaluate(measureInPage, { sound, window: WINDOW, worklet: WORKLET });
      await context.close();
      settings = measured.settings;
      results.set(sound.id, { id: sound.id, kind: sound.kind, trimDb: SOUND_TRIM_DB[sound.id], rmsDbfs: dbfs(measured.rms), peakDbfs: dbfs(measured.peak) });
      console.error(`measured ${sound.id}`);
    }
  }));

  const measured = sounds.map(sound => results.get(sound.id));
  const centre = LEVEL_BAND.rmsDbfs;
  console.log(['id', 'kind', 'trim dB', 'RMS dBFS', 'peak dBFS', 'in band', 'trim for centre'].join('\t'));
  for (const sound of measured) {
    const inBand = Math.abs(sound.rmsDbfs - centre) <= LEVEL_BAND.toleranceDb;
    console.log([sound.id, sound.kind, sound.trimDb, sound.rmsDbfs, sound.peakDbfs, inBand ? 'yes' : 'NO', Math.round((sound.trimDb + centre - sound.rmsDbfs) * 2) / 2].join('\t'));
  }
  if (!only.length) {
    mkdirSync(path.dirname(OUT), { recursive: true });
    const manifest = {
      measuredAt: new Date().toISOString(),
      settings: { ...settings, windowS: [WINDOW.fromS, WINDOW.fromS + WINDOW.seconds] },
      band: LEVEL_BAND,
      sounds: measured
    };
    writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`wrote ${path.relative(ROOT, OUT)}`);
  }
} finally {
  await browser.close();
  await server.close();
}
