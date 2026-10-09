import base from './vite.config.js';

// THE FAST UNIT SUBSET THE REQUIRED `CI` CHECK RUNS.
//
// This list used to live in .github/workflows/ci.yml as seventy CLI filters.
// A filter that matched nothing after a file moved dropped those tests without
// a sound (#377 moved three; #421 noticed). The list lives here now, and CI
// fails when the number of files it collects is not FAST_TEST_FILES: moving,
// adding or deleting a file in a listed directory makes CI fail until this
// number is changed in the same pull request.
//
//   npx vitest run --config vitest.fast.config.js
export const FAST_TEST_FILES = 81;

const FAST_TESTS = [
    'src/core/system-design.test.js',
    'worker/index.test.js',
    'worker/kev-worker-script.test.js',
    // The Plus gate's meter and the attacks it refuses: the lab's vendor key is behind it.
    'worker/plus.test.js',
    // The independent attack suite: each test passes only while its attack fails.
    'worker/plus.security.test.js',
    'worker/plus-admin.test.js',
    'worker/plus-budget.test.js',
    'worker/plus-provider.test.js',
    'worker/plus-provider-rpc.test.js',
    'src/app/plus.test.js',
    'src/app/chamber-session-factory.test.js',
    'src/components/Settings.test.js',
    'src/core/decision/**/*.test.js',
    'src/core/jev-palette.test.js',
    'src/components/read/Chamber.jev-look.test.js',
    'src/app/jev-reading.test.js',
    'src/core/openrouter-oauth.test.js',
    'src/core/kev-client.test.js',
    'src/core/csp.test.js',
    'src/core/passage-visuals/score-provider.test.js',
    'src/core/passage-visuals/scoring-client.test.js',
    'src/components/Home.jev.test.js',
    'src/components/Home.test.js',
    'src/components/reading-backdrop.test.js',
    'src/components/home-ask.test.js',
    'src/core/roll.test.js',
    'src/components/Library.jev.test.js',
    'src/core/content-store.test.js',
    'src/core/journey-session.test.js',
    'src/audio/engine.lifecycle.test.js',
    'src/content/keystones.test.js',
    'src/enterprise/**/*.test.js',
    'src/core/rise-current.test.js',
    'src/live/protocol.test.js',
    'src/live/stream.test.js',
    'src/live/runtime.test.js',
    'src/live/adapters/**/*.test.js',
    'src/live/host/**/*.test.js',
    'src/live/hosts/**/*.test.js',
    'src/visuals/attractor.test.js',
    'worker/mcp-server.test.js'
];

export default {
    ...base,
    test: { ...base.test, include: FAST_TESTS }
};
