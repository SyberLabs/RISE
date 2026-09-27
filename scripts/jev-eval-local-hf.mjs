// Exploratory semantic-choice baseline. This is not a replacement for Jev.
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline, env } from '@huggingface/transformers';

const descriptions = {
  pace: {
    '100': 'Very slow reading, restful, meditative.', '150': 'Slow and gentle reading.',
    '200': 'Moderate reading speed.', '250': 'Brisk reading speed.',
    '300': 'Fast reading pace.', '400': 'Very fast reading.', '500': 'Fastest possible reading.'
  },
  audio: {
    silent: 'Complete silence, no music or soundscape.',
    aurora: 'Soft atmospheric Aurora soundscape.',
    'faded-signal': 'Eerie fading electronic signal soundscape.',
    'soft-rain': 'Gentle steady natural rain behind the reading.'
  },
  visualMode: {
    off: 'No moving visuals, blank still background.',
    focals: 'One quiet focal figure.',
    genesis: 'Energetic growing graphic line art.',
    attractor: 'Luminous moving strange attractor field.',
    interlocution: 'Continuously crossfading colorful visual gallery.'
  },
  visualStyle: {
    quiet: 'Still, spare, minimal visual energy.',
    gentle: 'Calm, soft visual atmosphere.',
    immersive: 'Strong continuous visual field with color and motion.',
    psychedelic: 'Psychedelic, prismatic, neon, kaleidoscopic color.'
  },
  chamberFace: {
    literary: 'Traditional literary serif type like a printed book.',
    display: 'Expressive display serif typography.',
    thick: 'Bold geometric lettering.',
    jp: 'Japanese serif typography.',
    mono: 'Monospaced type like code or a typewriter.'
  },
  fontSize: {
    small: 'Small, unobtrusive text.', medium: 'Medium sized text.',
    large: 'Large, easy-to-read text.', fit: 'Huge word filling the screen.'
  }
};

const [casesPath, optionsPath, outputPath] = process.argv.slice(2);
if (!casesPath || !optionsPath || !outputPath) {
  console.error('Usage: node scripts/jev-eval-local-hf.mjs CASES.json OPTIONS.json OUTPUT.json');
  process.exitCode = 2;
} else {
  const cases = JSON.parse(await readFile(casesPath, 'utf8'));
  const options = JSON.parse(await readFile(optionsPath, 'utf8'));
  env.cacheDir = process.env.RISE_HF_CACHE || join(tmpdir(), 'rise-jev-hf-cache');
  const started = Date.now();
  const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
  const embed = async text => Array.from((await pipe(text, { pooling: 'mean', normalize: true })).data);
  const candidateVectors = {};
  for (const [axis, values] of Object.entries(options)) {
    if (values.some(value => !descriptions[axis]?.[value])) {
      throw new Error(`No local embedding description for ${axis}`);
    }
    candidateVectors[axis] = [];
    for (const value of values) candidateVectors[axis].push(await embed(descriptions[axis][value]));
  }
  const rows = [];
  for (const item of cases) {
    const prompt = await embed(item.intent);
    const decision = {};
    for (const [axis, values] of Object.entries(options)) {
      const similarities = candidateVectors[axis].map(candidate =>
        candidate.reduce((sum, number, i) => sum + number * prompt[i], 0));
      decision[axis] = values[similarities.indexOf(Math.max(...similarities))];
    }
    rows.push({ id: item.id, decision });
  }
  await writeFile(outputPath, `${JSON.stringify({ model: 'Xenova/all-MiniLM-L6-v2 (q8)',
    method: 'cosine similarity between prompt and independently worded option descriptions',
    elapsedMs: Date.now() - started, rows }, null, 2)}\n`);
  console.log(`Wrote ${rows.length} local Hugging Face model decisions to ${outputPath}`);
}
