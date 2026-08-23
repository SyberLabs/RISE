import { cpus, freemem } from 'node:os';
import { defineConfig } from 'vite';
import { curiaPlugin } from './scripts/curia-plugin.js';
import { exportMp4Plugin } from './scripts/export-mp4-plugin.js';

const GB = 1024 ** 3;

// Held back for the vitest parent (~750 MB measured) and whatever else is
// already resident while the suite runs.
const RESERVED_GB = 2.5;

// One test file per fork. Typical peak is 100–200 MB; the worst measured was
// 594 MB, so a gigabyte a slot is the heavy file paying for itself.
const PER_WORKER_GB = 1;

const coreCeiling = Math.floor(cpus().length / 2);
const memoryCeiling = Math.floor((freemem() / GB - RESERVED_GB) / PER_WORKER_GB);

export default defineConfig({
  // Curia / Export MP4: apply:'serve' means the endpoints exist only on
  // the dev server; production builds carry no write path.
  plugins: [curiaPlugin(), exportMp4Plugin()],

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

    // A WORKER USED TO CARRY THE WHOLE ARCHIVE. Two was the ceiling because
    // each fork loaded jsdom, the visual engines, and Library fixtures that
    // linked ninety-five payloads — ninety-three megabytes, of which eighty-two
    // belonged to works no reader could open. Unlinking the unreachable ones
    // is the lighter setup the old note was waiting for: 168s → 81s here, and
    // green at eight, which is where it was left rather than pushed.
    //
    // Scaled to the machine, because CI is not this machine. A GitHub runner
    // has four cores where a workstation has sixteen, and a fixed six would
    // oversubscribe the runner as surely as two throttles the workstation.
    //
    // COUNTING CORES WAS NOT ENOUGH. The workstation has sixteen of them and
    // only sixteen gigabytes, so the core rule asked for six forks against
    // memory that could not seat six. The failure did not look like a failing
    // test: a fork was killed mid-file and the parent reported
    // ERR_IPC_CHANNEL_CLOSED, usually over Workshop.test.js or
    // visual-cortex.test.js, both of which pass alone. Measured here — 15.9 GB
    // total, 4.7 GB free at rest; isolation gives each test file its own fork,
    // and across one full run the forks peaked at 100–200 MB apiece with the
    // heaviest at 594 MB, over a parent holding ~750 MB. Six of those spiking
    // together do not fit; free memory fell to 1.85 GB with only three running.
    // Two finishes clean in ~163s and was the hand-passed flag all session.
    //
    // So the ceiling is whichever runs out first, cores or memory. The reserve
    // covers the vitest parent plus whatever else is resident — a dev server
    // and an editor are normal here. Read once at config load, which is a
    // snapshot and can be sampled at a bad moment; the floor of two and the
    // ceiling of six keep a bad sample from turning into a one-fork crawl or
    // an overcommit. The floor is the number that was measured good, not a
    // guess. Nothing changes on a four-core runner, where cores still bind
    // first and the answer is two either way.
    pool: 'forks',
    maxWorkers: Math.max(2, Math.min(6, coreCeiling, memoryCeiling)),
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
