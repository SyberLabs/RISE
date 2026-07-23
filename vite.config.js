import { defineConfig } from 'vite';
import { curiaPlugin } from './scripts/curia-plugin.js';

export default defineConfig({
  // Curia dev-write: apply:'serve' means the endpoint exists only on
  // the dev server; production builds carry no write path.
  plugins: [curiaPlugin()],

  // Note: We use a custom debug.js utility instead of dropping console statements.
  // This allows: debug logging in dev, optional debug in prod via localStorage,
  // and always-on error logging. Run RISE.enableDebug() in prod console to enable.
  esbuild: {
    drop: ['debugger'],
  },

  build: {
    // No public source maps — keep the shipped bundle opaque.
    // For local debugging use `vite build --sourcemap` or the dev server.
    sourcemap: false,

    // Increase warning threshold slightly (visual engines are large)
    chunkSizeWarningLimit: 300,

    rollupOptions: {
      output: {
        // Stable cache groups for large subsystems. These are not route-lazy
        // by themselves; true deferment requires dynamic imports at callers.
        manualChunks: {
          // Visual generation engines
          'visuals-klee': [
            './src/visuals/klee.js',
            './src/visuals/klee-enhanced.js'
          ],
          'visuals-fractal': [
            './src/visuals/fractal.js',
            './src/visuals/lib/fractal-engine.js'
          ],
          'visuals-other': [
            './src/visuals/turrell.js',
            './src/visuals/rockgarden.js'
          ],

          // Content source providers
          'sources-text': [
            './src/sources/text/gutenberg.js',
            './src/sources/text/arxiv.js',
            './src/sources/text/declassified.js'
          ],
          'sources-visual': [
            './src/sources/visual/wikimedia.js',
            './src/sources/visual/generated.js'
          ],

          // Sacred texts content (significant size)
          'content-texts': [
            './src/content/texts/tao-te-ching.js',
            './src/content/texts/heart-sutra.js',
            './src/content/texts/yoga-sutras.js',
            './src/content/texts/gospel-of-thomas.js',
            './src/content/texts/upanishads.js',
            './src/content/texts/hermetica.js'
          ],

          // Audio engine (can be deferred)
          'audio': [
            './src/audio/engine.js'
          ]
        }
      }
    }
  },

  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core/**/*.js', 'src/audio/**/*.js', 'src/components/**/*.js', 'src/sources/**/*.js', 'src/visuals/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/content/**', 'src/sources/text/data/**']
    }
  }
});
