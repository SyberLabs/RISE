#!/usr/bin/env node
/**
 * Render an Experience Program or agent operation set to a local MP4.
 *
 *   node scripts/render-mp4.mjs score.json
 *   node scripts/render-mp4.mjs ops.json --sources sources.json --out out/render
 *   node scripts/render-mp4.mjs request.json --scale 1 --painter chamber
 */
import { readFileSync } from 'node:fs';
import {
  RENDER_CLI_USAGE,
  materializeExportJob,
  parseRenderCliArgs
} from '../src/core/render/intake.js';

const parsed = parseRenderCliArgs(process.argv);
if (parsed.help) {
  console.log(RENDER_CLI_USAGE);
  process.exit(0);
}
if (parsed.error) {
  console.error(parsed.error);
  console.error(RENDER_CLI_USAGE);
  process.exit(1);
}

let document;
try {
  document = JSON.parse(readFileSync(parsed.inputPath, 'utf8'));
} catch (error) {
  console.error(`Could not read input JSON: ${error.message}`);
  process.exit(1);
}

let sources = null;
if (parsed.sourcesPath) {
  try {
    sources = JSON.parse(readFileSync(parsed.sourcesPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read --sources JSON: ${error.message}`);
    process.exit(1);
  }
}

console.log(`Rendering ${parsed.inputPath}`);
try {
  const artifact = await materializeExportJob({
    document,
    outDir: parsed.outDir,
    options: {
      sources,
      scale: parsed.scale,
      painter: parsed.painter,
      profileId: parsed.profileId,
      ffmpegPath: parsed.ffmpegPath,
      outputPath: parsed.mp4Path
    }
  });
  console.log(`Wrote ${artifact.mp4Path}`);
  if (artifact.plan) {
    console.log(`${artifact.encoded?.width}×${artifact.encoded?.height} · ${artifact.plan.frameCount} frames · ${artifact.plan.durationMs} ms`);
  }
  console.log(`Sidecars: ${parsed.outDir}`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
