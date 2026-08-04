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
    // Measured on this machine (16 cores, ~6GB free), 109 files:
    //
    //   default (~15)   dies at ~28s
    //   maxForks 6      dies at ~28s
    //   maxForks 5      green,  79s   (one run)
    //   maxForks 4      green,  90/92/95s  (three runs)
    //   maxForks 3      green, 102s
    //   maxForks 2      green, 152s
    //   fileParallelism:false  green, 251s
    //
    // 4 is chosen over 5 deliberately: it is green three times for
    // three, it sits a full step below the observed break, and the
    // failure is resource-dependent — it will move when the machine is
    // busier. Thirteen seconds is not worth spending the margin on.
    //
    // THIS IS A CEILING, NOT A CURE. The underlying death is not
    // understood: `threads` dies too (exit 127, no message at all,
    // which is a native-level exit rather than a JS throw), and
    // src/visuals/visual-cortex.test.js — whose "recovers when preload
    // generation fails" case destroys a worker on purpose — is the
    // last thing to log before the fall, yet that file passes alone
    // (93 tests, green). So the trigger is an interaction, not a file.
    // Raise this number only with evidence, and if the real cause is
    // ever found, delete the ceiling rather than tuning it.
    // `maxWorkers` and not `poolOptions.forks.maxForks`: in Vitest 3 the
    // CLI still maps the old path, but setting it HERE is silently
    // ignored — the suite died exactly as before while the file looked
    // correct. Verified by running the plain command, not by reading
    // the config back.
    pool: 'forks',
    maxWorkers: 4,
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
