/**
 * Example Scripts for Abstract Figure Engine
 * Demonstrates various use cases and configuration patterns
 */

// Example 1: Basic Overlapping Rock Figure
function example1_basicRockFigure() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;

  // Simple configuration with basic shapes
  engine.setCore({
    anchor: [512, 512],
    variationWeights: {
      ellipse: 0.4,
      blob: 0.4,
      irregularPoly: 0.2
    },
    overlapFactor: 0.8,
    asymmetryBias: [0, 0]
  });

  // Generate with minimal shapes
  engine.generateFigure({
    iterations: 10,
    width: 1024,
    height: 1024,
    asymmetry: 0.3
  });

  // Render with basic settings
  engine.render(canvas, {
    backgroundRaking: false,
    useGradient: true,
    softEdges: false,
    outlineWidth: 2
  });

  return canvas;
}

// Example 2: Complex Sculptural Figure
function example2_complexSculpture() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;

  // Complex configuration with many variation types
  engine.setCore({
    anchor: [960, 540],
    variationWeights: {
      layered: 0.15,
      stackedBoulders: 0.15,
      fractalRock: 0.15,
      blob: 0.15,
      irregularPoly: 0.1,
      teardrop: 0.1,
      waveDistorted: 0.1,
      asymmetricalOval: 0.05,
      petalForm: 0.05
    },
    overlapFactor: 0.6,
    asymmetryBias: [0.3, -0.2], // Strong asymmetry to the right and up
    styleIndex: 0.6
  });

  // Generate with many shapes for complexity
  engine.generateFigure({
    iterations: 40,
    width: 1920,
    height: 1080,
    asymmetry: 0.8
  });

  // Render with all effects
  engine.render(canvas, {
    backgroundRaking: true,
    useGradient: true,
    softEdges: true,
    outlineWidth: 3,
    textureIntensity: 0.15
  });

  return canvas;
}

// Example 3: Enso-Inspired Circular Meditation
function example3_ensoMeditation() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;

  // Focus on circular, enso-like forms
  engine.setCore({
    anchor: [512, 512],
    variationWeights: {
      enso: 0.5,
      blob: 0.25,
      ellipse: 0.25
    },
    overlapFactor: 0.9,
    asymmetryBias: [0.05, 0.05], // Very subtle asymmetry
    styleIndex: 0.3 // Darker palette
  });

  engine.generateFigure({
    iterations: 8,
    width: 1024,
    height: 1024,
    asymmetry: 0.2
  });

  engine.render(canvas, {
    backgroundRaking: false,
    useGradient: false, // Flat fills for traditional ink effect
    softEdges: true,
    outlineWidth: 4,
    textureIntensity: 0.05
  });

  return canvas;
}

// Example 4: Raked Garden with Texture
function example4_rakedGarden() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 1280;

  // Emphasize raked patterns
  engine.setCore({
    anchor: [640, 640],
    variationWeights: {
      raked: 0.5,
      ellipse: 0.3,
      irregularPoly: 0.2
    },
    overlapFactor: 0.7,
    asymmetryBias: [0.1, 0]
  });

  engine.generateFigure({
    iterations: 15,
    width: 1280,
    height: 1280,
    asymmetry: 0.4
  });

  engine.render(canvas, {
    backgroundRaking: true, // Strong background raking
    useGradient: true,
    softEdges: false,
    outlineWidth: 1,
    textureIntensity: 0.2 // High texture for gravel effect
  });

  return canvas;
}

// Example 5: Humanoid Abstract Form
function example5_humanoidForm() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;

  // Vertical composition suggesting a figure
  engine.setCore({
    anchor: [384, 512],
    variationWeights: {
      blob: 0.3,
      ellipse: 0.25,
      teardrop: 0.2,
      irregularPoly: 0.15,
      asymmetricalOval: 0.1
    },
    overlapFactor: 0.75,
    asymmetryBias: [0, 0.2], // Bias upward for head-like structure
    styleIndex: 0.5,
    symmetry: 0.3 // Add subtle symmetry for body-like balance
  });

  engine.generateFigure({
    iterations: 25,
    width: 768,
    height: 1024,
    asymmetry: 0.5
  });

  engine.render(canvas, {
    backgroundRaking: false,
    useGradient: true,
    softEdges: true,
    outlineWidth: 2,
    textureIntensity: 0.1
  });

  return canvas;
}

// Example 6: Dynamic Angular Composition
function example6_angularDynamic() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;

  // Angular, geometric forms
  engine.setCore({
    anchor: [512, 512],
    variationWeights: {
      irregularPoly: 0.35,
      fractalRock: 0.25,
      triangularCluster: 0.2,
      splitRock: 0.2
    },
    overlapFactor: 0.5,
    asymmetryBias: [0.4, 0.3],
    styleIndex: 0.7
  });

  engine.generateFigure({
    iterations: 30,
    width: 1024,
    height: 1024,
    asymmetry: 0.9
  });

  engine.render(canvas, {
    backgroundRaking: true,
    useGradient: false, // Flat colors for geometric clarity
    softEdges: false,
    outlineWidth: 3,
    textureIntensity: 0.05
  });

  return canvas;
}

// Example 7: Organic Flow with Waves
function example7_organicWaves() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;

  // Flowing, wave-like forms
  engine.setCore({
    anchor: [640, 360],
    variationWeights: {
      waveDistorted: 0.3,
      blob: 0.25,
      teardrop: 0.2,
      spiralRock: 0.15,
      petalForm: 0.1
    },
    overlapFactor: 0.85,
    asymmetryBias: [0.2, 0],
    styleIndex: 0.45
  });

  engine.generateFigure({
    iterations: 22,
    width: 1280,
    height: 720,
    asymmetry: 0.6
  });

  engine.render(canvas, {
    backgroundRaking: true,
    useGradient: true,
    softEdges: true,
    outlineWidth: 2,
    textureIntensity: 0.12,
    backgroundColor: '#f0f0e8'
  });

  return canvas;
}

// Example 8: Minimal Monolith
function example8_minimalMonolith() {
  const engine = new AbstractFigureEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;

  // Single dominant form with few supporting shapes
  engine.setCore({
    anchor: [300, 400],
    variationWeights: {
      layered: 0.4,
      blob: 0.3,
      ellipse: 0.3
    },
    overlapFactor: 0.95,
    asymmetryBias: [0, 0],
    styleIndex: 0.3
  });

  engine.generateFigure({
    iterations: 5, // Very few shapes for minimalism
    width: 600,
    height: 800,
    asymmetry: 0.1
  });

  engine.render(canvas, {
    backgroundRaking: false,
    useGradient: true,
    softEdges: true,
    outlineWidth: 1,
    textureIntensity: 0.08,
    backgroundColor: '#ffffff'
  });

  return canvas;
}

// Example 9: Custom Shape Variation
function example9_customVariation() {
  const engine = new AbstractFigureEngine();

  // Add a custom variation: Star-like rock
  engine.addVariation('customStar', (c, s, params = {}) => {
    const points = [];
    const spikes = params.spikes || 7;
    const innerRadius = s * 0.4;
    const outerRadius = s;

    for (let i = 0; i <= spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const noise = (Math.random() - 0.5) * 0.2; // Add organic variation

      points.push([
        c[0] + radius * (1 + noise) * Math.cos(angle),
        c[1] + radius * (1 + noise) * Math.sin(angle)
      ]);
    }

    return points;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;

  engine.setCore({
    anchor: [512, 512],
    variationWeights: {
      customStar: 0.5,
      blob: 0.3,
      irregularPoly: 0.2
    },
    overlapFactor: 0.7,
    asymmetryBias: [0.15, 0.15]
  });

  engine.generateFigure({
    iterations: 18,
    width: 1024,
    height: 1024,
    asymmetry: 0.5
  });

  engine.render(canvas, {
    backgroundRaking: true,
    useGradient: true,
    softEdges: true,
    outlineWidth: 2,
    textureIntensity: 0.1
  });

  return canvas;
}

// Example 10: Batch Generation with Variations
function example10_batchGeneration(count = 5) {
  const engine = new AbstractFigureEngine();
  const canvases = [];
  const themes = ['serene', 'dynamic', 'contemplative', 'organic', 'architectural'];

  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    // Use a different theme for each
    const theme = themes[i % themes.length];
    engine.generateThemed(theme, 512, 512);

    engine.render(canvas, {
      backgroundRaking: Math.random() > 0.5,
      useGradient: true,
      softEdges: true,
      outlineWidth: 1 + Math.random() * 2,
      textureIntensity: 0.05 + Math.random() * 0.1
    });

    canvases.push({
      canvas: canvas,
      theme: theme,
      config: engine.saveConfig()
    });
  }

  return canvases;
}

// Example 11: Animation Frame Generator
function example11_animationFrames(frameCount = 30) {
  const engine = new AbstractFigureEngine();
  const frames = [];

  // Set base configuration
  engine.setCore({
    anchor: [512, 512],
    variationWeights: {
      blob: 0.3,
      ellipse: 0.3,
      waveDistorted: 0.4
    },
    overlapFactor: 0.7,
    asymmetryBias: [0, 0]
  });

  // Generate base figure
  engine.generateFigure({
    iterations: 20,
    width: 1024,
    height: 1024,
    asymmetry: 0.5
  });

  // Create animation by rotating shapes
  for (let frame = 0; frame < frameCount; frame++) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(0, 0, 1024, 1024);

    // Rotate context
    ctx.save();
    ctx.translate(512, 512);
    ctx.rotate((frame / frameCount) * Math.PI * 2);
    ctx.translate(-512, -512);

    // Render shapes
    engine.shapes.forEach(shape => {
      engine._renderShape(ctx, shape, {
        useGradient: true,
        outlineWidth: 2,
        textureIntensity: 0.1
      });
    });

    ctx.restore();
    frames.push(canvas);
  }

  return frames;
}

// Example 12: Responsive Multi-Format Export
function example12_multiFormatExport() {
  const engine = new AbstractFigureEngine();

  // Generate once
  engine.generateThemed('organic', 2048, 2048);

  const exports = {};

  // Export in multiple sizes
  const sizes = [
    { name: 'thumbnail', width: 256, height: 256 },
    { name: 'medium', width: 1024, height: 1024 },
    { name: 'large', width: 2048, height: 2048 },
    { name: 'wide', width: 1920, height: 1080 }
  ];

  sizes.forEach(size => {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    // Scale shapes to fit
    const scale = Math.min(size.width / 2048, size.height / 2048);
    const scaledEngine = new AbstractFigureEngine();
    scaledEngine.shapes = engine.shapes.map(shape => ({
      ...shape,
      points: shape.points.map(p => [p[0] * scale, p[1] * scale]),
      center: [shape.center[0] * scale, shape.center[1] * scale],
      size: shape.size * scale
    }));
    scaledEngine.palette = engine.palette;

    scaledEngine.render(canvas, {
      backgroundRaking: true,
      useGradient: true,
      softEdges: true,
      outlineWidth: Math.max(1, 2 * scale),
      textureIntensity: 0.1
    });

    exports[size.name] = canvas.toDataURL('image/png');
  });

  return exports;
}

// Export examples for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    example1_basicRockFigure,
    example2_complexSculpture,
    example3_ensoMeditation,
    example4_rakedGarden,
    example5_humanoidForm,
    example6_angularDynamic,
    example7_organicWaves,
    example8_minimalMonolith,
    example9_customVariation,
    example10_batchGeneration,
    example11_animationFrames,
    example12_multiFormatExport
  };
}
