import { defineConfig } from 'vite';

export default defineConfig({
  // Note: We use a custom debug.js utility instead of dropping console statements.
  // This allows: debug logging in dev, optional debug in prod via localStorage,
  // and always-on error logging. Run RISE.enableDebug() in prod console to enable.
  esbuild: {
    drop: ['debugger'],
  },

  build: {
    // Generate source maps for production debugging
    sourcemap: true,

    // Increase warning threshold slightly (visual engines are large)
    chunkSizeWarningLimit: 300,

    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Visual generation engines (lazy-loadable)
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

          // Content source providers (load on demand)
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
    include: ['src/**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core/**/*.js', 'src/audio/**/*.js'],
      exclude: ['src/legacy/**', 'src/**/*.test.js']
    }
  }
});
