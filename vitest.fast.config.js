import { configDefaults } from 'vitest/config';
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
export const FAST_TEST_FILES = 162;

const FAST_TESTS = [
    'src/core/account-saves.test.js',
    'src/app/account-control.test.js',
    'src/app/account-panel.test.js',
    'src/core/system-design.test.js',
    'worker/index.test.js',
    'worker/production-config.test.js',
    'worker/kev-worker-script.test.js',
    // The Plus gate's meter and the attacks it refuses: the lab's vendor key is behind it.
    'worker/plus.test.js',
    'worker/plus-lifecycle.test.js',
    // The independent attack suite: each test passes only while its attack fails.
    'worker/plus.security.test.js',
    'worker/plus-admin.test.js',
    'worker/plus-budget.test.js',
    'worker/plus-audio.test.js',
    'worker/plus-audio-runtime.test.js',
    'worker/plus-provider.test.js',
    'worker/plus-provider-rpc.test.js',
    'src/app/plus.test.js',
    'src/audio/plus-voice.test.js',
    'src/audio/voice.test.js',
    'src/core/user-data.test.js',
    'src/app/plus-customer.test.js',
    'src/app/plus-continuation.test.js',
    'src/components/Plus.test.js',
    'src/app/chamber-session-factory.test.js',
    'src/app/voice-demo-session.test.js',
    'src/components/read/VoiceDemo.test.js',
    // /try/, the public sample linked from syberlabs.io, and where its readings return.
    'src/app/try-session.test.js',
    'src/components/read/Try.test.js',
    'src/app/chamber-exit.test.js',
    'src/core/route-url.test.js',
    'src/components/Settings.test.js',
    'src/core/decision/**/*.test.js',
    // RISE Changes: the weekly digest's contract, collection and files (src/core/changes) and its routing, composition and
    // admission (scripts/changes, the Node pipeline), whose only other run is the job itself.
    'src/core/changes/**/*.test.js',
    'scripts/changes/**/*.test.js',
    // The quality gates: a figure's labels, a reading's process talk and its picture cadence, and the connector's count.
    'src/core/quality/**/*.test.js',
    // The figure kit: four kinds RISE draws itself, admitted and layout-clean at every bound.
    'src/core/figures/**/*.test.js',
    'worker/mcp-quality.test.js',
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
    // The Mystery School's canon: its counts, its works in the archive, its paths' steps.
    'src/content/school/canon.test.js',
    // The School corpus: every payload is the bytes its checksum names, readably named, with no distributor matter.
    'src/content/school/corpus.test.js',
    // The Gutenberg reader takes an edition apart only along the lines its recipe declares.
    'src/content/school/gutenberg.test.js',
    // The School's source readers beyond Gutenberg: each counts out its site's furniture and loses no word.
    'src/content/school/wikisource.test.js',
    'src/content/school/sacred-texts.test.js',
    'src/content/school/ccel.test.js',
    'src/content/school/tei.test.js',
    'src/content/school/file.test.js',
    'src/content/school/html.test.js',
    'src/content/school/latex.test.js',
    // A school text opens as the Library opens it, and a finished one marks the reader's record.
    'src/app/school-reading.test.js',
    'src/enterprise/**/*.test.js',
    'src/core/rise-current.test.js',
    'src/live/protocol.test.js',
    'src/live/stream.test.js',
    'src/live/runtime.test.js',
    // What goes up to the reader's provider with their next words: a privacy boundary (perception v1).
    'src/live/perception.test.js',
    // The interjection: its state machine, and the graft that puts an answer into the reading the reader interrupted.
    'src/live/interjection.test.js',
    'src/live/graft.test.js',
    // The model changes the room while it plays: where each change lands, one a phrase, and the reader's settings win.
    'src/live/runtime.room.test.js',
    // A provider's voice under the same clock (stage 7): the renderer's hold, marks and rate, and ElevenLabs' request and refusals.
    'src/live/voices/provider-tts.test.js',
    'src/live/voices/elevenlabs.test.js',
    // The illustrator: RISE's engines first, the picture admitted and repaired, landed at a phrase, the voice never waiting.
    'src/live/illustrator.test.js',
    'src/live/runtime.illustrator.test.js',
    'src/live/voice-never-starts.test.js',
    // A stored card's Current whose events the reducer refused plays whole, says what it lost, and waits on no voice.
    'src/live/sealed-lost-passages.test.js',
    // The last beat with words is said whole before the reading ends; a closing shown line is said by no one.
    'src/live/last-beat.test.js',
    // The scene sandbox's boundary, both ways: what a scene is given, what it may say the reader set, and the bounds on both.
    'src/scenes/scene-worker.test.js',
    'src/scenes/scene-runtime.test.js',
    'src/scenes/scene-widgets.test.js',
    // RISE's face in the Live venue: its states, its blink, its gaze, and that it says nothing (docs/plans/LIVE-CURRENT.md §22).
    'src/scenes/engines/oracle.test.js',
    'src/live/adapters/**/*.test.js',
    'src/live/host/**/*.test.js',
    // Google-shaped fakes are assembled at runtime. This fails if a contiguous literal is committed.
    'src/test/fake-google-key.test.js',
    'src/live/hosts/**/*.test.js',
    'src/visuals/attractor.test.js',
    'worker/mcp-server.test.js'
];

// Tests that drive a real browser run in the full unit suite (full-validation.yml), never here.
const BROWSER_TESTS = ['scripts/changes/render-check.test.js'];

export default {
    ...base,
    test: { ...base.test, include: FAST_TESTS, exclude: [...configDefaults.exclude, ...BROWSER_TESTS] }
};
