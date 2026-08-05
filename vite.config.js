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

  // Visual engines use module workers so Vite can bundle dependencies.
  worker: {
    format: 'es'
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

    // ═══════════════════════════════════════════════════════════════
    // WHY THE POOL IS BOUNDED
    // ═══════════════════════════════════════════════════════════════
    //
    // At its default width this suite does not fail — it DIES. A
    // worker process disappears and tinypool's next message to it
    // raises `ERR_IPC_CHANNEL_CLOSED`, which vitest reports as an
    // unhandled rejection and exits non-zero on. Every test that had
    // run up to that point passed. An exit code that says "red" while
    // the tests say "green" is worse than either, because it trains
    // you to stop reading it.
    //
    // Measured on this machine (16 cores, ~6GB free):
    //
    //   default (~15)   dies
    //   maxWorkers 6    dies at ~28s
    //   maxWorkers 4    green 3/3 at 109 files... and DIED at 112,
    //                   about forty seconds in, after two files were
    //                   added by the pagination work
    //   maxWorkers 3    green 2/2, 103s
    //   maxWorkers 2    green 2/2, 132s
    //   fileParallelism:false   green, 251s
    //
    // A CORRECTION I OWE THE NEXT READER. I first called this memory
    // exhaustion, then talked myself out of it because the suite died
    // 28 seconds in and that felt too early for a gradual leak. The
    // evidence came back around: four workers each load jsdom, the
    // visual engines and — in four separate test files — the entire
    // 107-text Library. That is not a gradual leak, it is a spike, and
    // it arrives exactly as fast as the heavy files are scheduled. The
    // first instinct was right and the second-guessing was the error.
    //
    // 2 is chosen over the faster 3 deliberately. 4 was green three
    // times for three and then broke on the very next commit that added
    // files, which is what a ceiling one step below a cliff does. The
    // suite will keep growing; 29 seconds is not worth being wrong
    // about again in a week.
    //
    // THE REAL FIX IS FOOTPRINT, NOT COUNT. Four test files pull in the
    // whole Library. If those grow a shared fixture, or the pool learns
    // to schedule them apart, this ceiling can rise or go. Raising it
    // without doing that is just moving back toward the cliff.
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,

    include: ['src/**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core/**/*.js', 'src/audio/**/*.js', 'src/components/**/*.js', 'src/sources/**/*.js', 'src/visuals/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/content/**', 'src/sources/text/data/**']
    }
  }
});
