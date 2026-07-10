/**
 * Node.js Example for Server-Side Fractal Flame Rendering
 *
 * Installation:
 * npm install canvas
 *
 * Usage:
 * node fractal-flame-node-example.js
 */

// Polyfill ImageData for Node.js
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

const { FractalFlameGenerator } = require('./fractal-flame.js');

async function generateFlameToFile(outputPath, preset = 'random') {
  console.log('Creating fractal flame generator...');
  const generator = new FractalFlameGenerator();

  // Configure flame based on preset
  if (preset === 'random') {
    console.log('Generating random flame...');
    generator.generateRandomFlame();
  } else {
    console.log(`Loading preset: ${preset}`);
    loadPreset(generator, preset);
  }

  // Generate high-quality image
  console.log('Rendering (this may take a minute)...');
  const startTime = Date.now();

  const imageData = await generator.generateImage({
    iterations: 20000000,  // 20 million for high quality
    width: 1920,
    height: 1080,
    gamma: 4.0,
    brightness: 4.0,
    vibrancy: 1.0,
    oversample: 2
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Rendering complete in ${elapsed}s`);

  // Save to file using node-canvas
  try {
    const { createCanvas } = require('canvas');
    const fs = require('fs');

    const canvas = createCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving file. Make sure "canvas" npm package is installed:');
    console.error('  npm install canvas');
    console.error('\nError details:', error.message);
  }
}

function loadPreset(generator, name) {
  generator.clearTransforms();

  switch (name) {
    case 'phoenix':
      generator.addTransform({
        affine: [0.6, -0.4, 0, 0.4, 0.6, 0],
        variations: { linear: 0.3, swirl: 0.3, horseshoe: 0.4 },
        color: 0.0,
        weight: 1
      });
      generator.addTransform({
        affine: [-0.5, 0.5, 0.5, -0.5, -0.5, 0.3],
        variations: { handkerchief: 0.4, spiral: 0.3, disc: 0.3 },
        color: 0.33,
        weight: 1
      });
      generator.addTransform({
        affine: [0.7, 0.2, -0.3, -0.2, 0.7, 0],
        variations: { heart: 0.3, julia: 0.4, spherical: 0.3 },
        color: 0.66,
        weight: 1
      });
      generator.addTransform({
        affine: [0.3, -0.6, 0, 0.6, 0.3, -0.5],
        variations: { polar: 0.5, sinusoidal: 0.5 },
        color: 1.0,
        weight: 1
      });
      break;

    case 'dragon':
      generator.addTransform({
        affine: [0.824, 0.281, 0, -0.212, 0.864, 0],
        variations: { linear: 0.7, swirl: 0.3 },
        color: 0.1,
        weight: 1
      });
      generator.addTransform({
        affine: [0.088, 0.520, 0, -0.463, -0.377, 1.0],
        variations: { linear: 0.5, horseshoe: 0.5 },
        color: 0.6,
        weight: 1
      });
      generator.addTransform({
        affine: [-0.5, 0, 1, 0, -0.5, 0.8],
        variations: { linear: 0.6, disc: 0.4 },
        color: 0.9,
        weight: 1
      });
      break;

    case 'julia':
      generator.addTransform({
        affine: [1, 0, 0, 0, 1, 0],
        variations: { julia: 1 },
        color: 0.3,
        weight: 1
      });
      generator.addTransform({
        affine: [0.8, 0.2, 0, -0.2, 0.8, 0],
        variations: { julia: 0.8, spherical: 0.2 },
        color: 0.9,
        weight: 1
      });
      break;

    default:
      generator.generateRandomFlame();
  }

  generator.setCamera(0, 0, 1, 0);
}

// Batch generation example
async function generateBatch(count = 5) {
  console.log(`Generating ${count} random flames...\n`);

  for (let i = 0; i < count; i++) {
    const filename = `flame-${Date.now()}-${i}.png`;
    console.log(`\n[${i + 1}/${count}] Generating ${filename}...`);
    await generateFlameToFile(filename, 'random');
  }

  console.log('\nBatch generation complete!');
}

// Command-line interface
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Fractal Flame Generator - Node.js Example\n');
  console.log('Usage:');
  console.log('  node fractal-flame-node-example.js <output.png> [preset]');
  console.log('  node fractal-flame-node-example.js batch <count>');
  console.log('\nPresets:');
  console.log('  random, phoenix, dragon, julia');
  console.log('\nExamples:');
  console.log('  node fractal-flame-node-example.js my-flame.png');
  console.log('  node fractal-flame-node-example.js phoenix.png phoenix');
  console.log('  node fractal-flame-node-example.js batch 10');
  process.exit(0);
}

if (args[0] === 'batch') {
  const count = parseInt(args[1]) || 5;
  generateBatch(count).catch(console.error);
} else {
  const outputPath = args[0];
  const preset = args[1] || 'random';
  generateFlameToFile(outputPath, preset).catch(console.error);
}

// Export for use as a module
module.exports = { generateFlameToFile, generateBatch, loadPreset };
