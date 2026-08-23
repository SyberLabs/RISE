import { cpus, totalmem } from 'node:os';
import { defineConfig } from 'vite';
import { curiaPlugin } from './scripts/curia-plugin.js';
import { exportMp4Plugin } from './scripts/export-mp4-plugin.js';

// A FORK DIES AT ITS HEAP CEILING, NOT AT THE MACHINE'S.
//
// This was stated as a count of workers scaled against free system memory,
// and it could not have worked: the thing that kills a fork is its own V8
// old-space limit, and no number of workers changes that limit. So the suite
// passed on a workstation and died on CI over nothing either machine was
// short of — Node 20 defaults this ceiling to about 2 GB, Node 22 to about
// 4 GB, and the heaviest file in the suite needs a little over 2 GB.
//
// The failure did not look like a failing test. A fork was killed mid-file
// and the parent reported ERR_IPC_CHANNEL_CLOSED, 115 of 228 files in:
//
//     FATAL ERROR: Reached heap limit Allocation failed
//     Mark-Compact 2127.6 (2134.6) -> 2126.4 (2137.6) MB
//
// Reproduced by capping a passing local run at 2048 and by nothing else.
// The ceiling is named here so it stops depending on which Node picked it.
const WORKER_HEAP_MB = 4096;

// Cores bound the parallelism worth having; total memory bounds how many of
// those heaps can be resident at once. Total, not free: free memory is a
// snapshot, and reading it at config load turned a busy moment into a
// one-fork crawl.
const coreCeiling = Math.floor(cpus().length / 2);
const memoryCeiling = Math.floor(totalmem() / (WORKER_HEAP_MB * 1024 ** 2));

export default defineConfig({
  // Curia / Export MP4: apply:'serve' means the endpoints exist only on
  // the dev server; production builds carry no write path.
  plugins: [curiaPlugin(), exportMp4Plugin()],

  // Console statements are left in: error reporting has to survive the
  // build, and the noisy paths are already gated by their own callers.
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

    // NO manualChunks. Three tunings of it moved three kilobytes, because a
    // cache group is not a deferral: the config's own retired comment
    // conceded "these are not route-lazy by themselves." Worse, the
    // `content-texts` group was the ONLY dependency six sacred-text modules
    // had — nothing in src/ imported them, so naming them here is what built
    // them, and what modulepreloaded 89 KB of them before the Portal painted.
    // A build configuration that can conjure a dependency out of nothing is
    // the same defect class as the 82 MB of unreachable books, and it hid
    // the real first load behind nine tidy filenames.
    //
    // Deferment lives at the caller, as a dynamic import(), where it can be
    // read. Grouping lives with Rollup, which does it well enough unaided.

    rollupOptions: {
      /**
       * A DEFERRAL WRITTEN AT ONE SITE AND UNDONE AT ANOTHER IS NOW A BUILD
       * FAILURE.
       *
       * Rollup reports it plainly — "dynamically imported by X but also
       * statically imported by Y" — and the report sat on screen for every
       * build of this project without being acted on. It is the same shape
       * as the 82 MB of unreachable books and the same shape as the dead
       * sacred texts: the bundler is the only witness, and a witness nobody
       * reads is not a guard.
       *
       * Removing manualChunks turned two of these into nine, because the
       * cache groups had been hiding the rest. All nine are fixed. This
       * keeps the tenth from arriving quietly.
       */
      onwarn(warning, warn) {
        if (/dynamic import will not move module/.test(warning.message || '')) {
          throw new Error(
            `${warning.message}\n\n`
            + 'Either make the static importer lazy, or drop the import() and '
            + 'admit the module belongs in the chunk. Do not leave the two '
            + 'disagreeing — a deferral the bundler ignores reads as done.'
          );
        }
        warn(warning);
      }
    }
  },

  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],

    // A fork reuses its heap across the files it is handed, so the ceiling has
    // to cover the run rather than the file. The old note here budgeted 594 MB
    // a fork from a measurement that only ever watched one; the number that
    // matters is what a fork holds by the end, and that is over 2 GB.
    pool: 'forks',
    poolOptions: {
      forks: { execArgv: [`--max-old-space-size=${WORKER_HEAP_MB}`] }
    },
    maxWorkers: Math.max(1, Math.min(coreCeiling, memoryCeiling)),
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
