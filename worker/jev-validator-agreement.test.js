import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import releaseInventory from '../src/content/archive/release-inventory.json';
import modernManifest from '../src/content/modern-readings-manifest.json';
import { validateJevRecommendation } from '../src/app/jev-reading.js';
import { CHAMBER_STREAM_FACES } from '../src/core/chamber-stream-face.js';
import { FONT_SIZE_CHIPS } from '../src/core/chamber-type-size.js';
import { JEV_AUDIO_IDS, resolveJevChamberConfig } from '../src/core/jev-config.js';
import { JEV_ADJUSTMENTS, adjustJevDecision, jevReleasedWorkIds } from '../src/core/jev-describe.js';
import { jevColors } from '../src/core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';
import { ATTRACTOR_PALETTES, KLEE_PRESETS } from '../src/core/visual-style-definitions.js';

/*
 * The browser and the Worker validate a Jev plan in two implementations.
 * Existing tests prove the browser accepts what the Worker emits. This file
 * proves the other direction: every plan the reader's Adjust path can produce
 * is one the Worker's own validator (validConfig, reached through the request
 * handler's cached-decision path) also accepts. The Worker is stricter by
 * design, so plans the browser accepts and the Worker rejects are only counted.
 *
 * The validator is not exported, so each plan is offered to handleJevRecommend
 * as a cached decision: a cache hit means validCachedDecision and validConfig
 * accepted it; a miss falls through to a provider fetch, which is stubbed to fail.
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn(), optionsQuery: vi.fn(), get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn()
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings, ...values) => String(strings[0]).includes('rise_jev_options')
    ? mocks.optionsQuery(strings, ...values) : mocks.query(strings, ...values)
}));
vi.mock('@upstash/redis/cloudflare', () => ({
  Redis: class {
    get(key) { return mocks.get(key); }
    set(key, value, options) { return mocks.set(key, value, options); }
    incr(key) { return mocks.incr(key); }
    expire(key, seconds) { return mocks.expire(key, seconds); }
  }
}));

import { handleJevRecommend } from './jev-recommend.mjs';

const SITE = 'https://rise.example';
const env = {
  DECISION_PROVIDER: 'jev',
  OPENROUTER_API_KEY: 'openrouter-server-secret',
  NEON_DATABASE_URL: 'postgresql://private.example/rise',
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'redis-server-secret'
};
const FIT_DESCRIPTION = 'A thoughtful classic for reflective reading.';
const DECISION_KEY_PREFIX = 'rise:jev-decision:v13:';
// Contains no sound words, so the Worker's sound shortlist is a pure rotation.
const INTENT = 'I want a thoughtful novel.';

const WORK_IDS = jevReleasedWorkIds();
const editionOf = workId => releaseInventory[workId] || modernManifest[workId];
const catalog = WORK_IDS.map(workId => ({
  work_id: workId, title: workId, author: 'Test Author',
  edition_id: editionOf(workId).editionId, source_revision: editionOf(workId).sourceRevision,
  fit_description: FIT_DESCRIPTION, decision_criterion: 'Choose this for a reflective reading mood.',
  active: true
}));
const sounds = JEV_AUDIO_IDS.map(id => (
  { sound_id: id, decision_criterion: `Choose for a ${id} reading mood.`, active: true }));
const options = [
  ...CHAMBER_STREAM_FACES.map(face => ({ kind: 'chamberFace', id: face.id, description: 'Reviewed font.' })),
  ...FONT_SIZE_CHIPS.map(chip => ({ kind: 'fontSize', id: chip.fontSize, description: 'Reviewed size.' }))
];

// The Worker offers the model a 9-sound rotation window of the catalog each turn;
// the turn number picks the window, and silence is always offered.
const SHORTLIST = 9;
function soundWindow(offset) {
  return new Set(Array.from({ length: SHORTLIST }, (_, i) => JEV_AUDIO_IDS[(offset + i) % JEV_AUDIO_IDS.length]));
}
function offsetOffering(ids) {
  const needed = [...new Set(ids)].filter(id => id !== 'silent');
  const offset = JEV_AUDIO_IDS.findIndex((_, o) => needed.every(id => soundWindow(o).has(id)));
  if (offset < 0) throw new Error(`No sound window offers ${needed.join(', ')}`);
  return offset;
}

async function workerAccepts(decision) {
  const offset = offsetOffering([decision.config.audio, decision.config.middleAudio, decision.config.finaleAudio]);
  mocks.incr.mockResolvedValue(offset + 1);
  mocks.get.mockImplementation(async key =>
    String(key).startsWith(DECISION_KEY_PREFIX) ? decision : null);
  const response = await handleJevRecommend(new Request(`${SITE}/api/jev-recommend`, {
    method: 'POST',
    headers: { Origin: SITE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 3, intent: INTENT })
  }), env);
  if (response.status !== 200) return false;
  return (await response.json()).decisionCacheStatus === 'hit';
}

function clientAccepts(decision) {
  try { validateJevRecommendation(decision); return true; } catch { return false; }
}

/** Numerical Recipes LCG: deterministic, no Math.random. */
function lcg(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const pick = list => list[Math.floor(next() * list.length)];
  return { next, pick };
}

const SPACE = {
  section: ['first', 'middle', 'last', 'shortest', 'longest'],
  wpm: [100, 150, 200, 250, 300, 400, 500],
  curve: ['flat', 'induction', 'ascent', 'wave', 'climax'],
  chunkMode: ['word', 'phrase', 'sentence', 'paragraph'],
  visualMode: ['off', 'focals', 'genesis', 'attractor', 'interlocution'],
  visualStyle: ['quiet', 'gentle', 'immersive', 'psychedelic'],
  engine: ['klee', 'turrell', 'fractal', 'harmonograph', 'ostensoria', 'apparitio'],
  visualArc: ['single', 'dual', 'triple'],
  arcSplit: ['30', '50', '70'],
  theme: ['classic', 'amethyst', 'prism', 'ember', 'cobalt', 'jade'],
  visualPalette: ATTRACTOR_PALETTES.map(item => item.id),
  kleePreset: KLEE_PRESETS.map(item => item.id),
  galleryCadence: ['slow', 'balanced', 'lively'],
  chamberFace: CHAMBER_STREAM_FACES.map(face => face.id),
  fontSize: FONT_SIZE_CHIPS.map(chip => chip.fontSize),
  wordFill: ['plain', 'accent', 'same'],
  projection: ['stream', 'page'],
  revealMode: ['instant', 'progressive']
};

/** One random plan, completed exactly as the Worker completes a Jev answer. */
function randomDecision(rng) {
  const { pick } = rng;
  const window = [...soundWindow(Math.floor(rng.next() * JEV_AUDIO_IDS.length)), 'silent'];
  const selectors = {
    section: pick(SPACE.section), wpm: pick(SPACE.wpm), curve: pick(SPACE.curve),
    chunkMode: pick(SPACE.chunkMode), audio: pick(window),
    visualMode: pick(SPACE.visualMode), visualStyle: pick(SPACE.visualStyle),
    visualEngine: pick(SPACE.engine), visualArc: pick(SPACE.visualArc), arcSplit: pick(SPACE.arcSplit),
    middleEngine: pick(SPACE.engine), finaleEngine: pick(SPACE.engine),
    middleTheme: pick(SPACE.theme), finaleTheme: pick(SPACE.theme),
    middleAudio: pick(window), finaleAudio: pick(window),
    visualPalette: pick(SPACE.visualPalette), kleePreset: pick(SPACE.kleePreset),
    galleryCadence: pick(SPACE.galleryCadence), chamberFace: pick(SPACE.chamberFace),
    fontSize: pick(SPACE.fontSize), colorTheme: pick(SPACE.theme),
    textColor: pick(SPACE.theme), backgroundColor: pick(SPACE.theme),
    wordFill: pick(SPACE.wordFill), projection: pick(SPACE.projection), revealMode: pick(SPACE.revealMode)
  };
  return decisionFrom(selectors, pick(WORK_IDS));
}

function decisionFrom(selectors, workId) {
  const config = {
    ...selectors,
    colors: jevColors(selectors.colorTheme, selectors.textColor, selectors.backgroundColor),
    ...resolveJevChamberConfig(selectors)
  };
  config.visualProgram = compileJevVisualProgram(config);
  config.audioProgram = compileJevAudioProgram(config);
  const edition = editionOf(workId);
  return {
    schemaVersion: 2, requestId: 'agreement-test', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
    workId, editionId: edition.editionId, sourceRevision: edition.sourceRevision,
    reason: FIT_DESCRIPTION, config
  };
}

/** One Portal change: a random option of a random kind, or a different released text. */
function randomAdjustment(rng) {
  const kind = rng.pick([...Object.keys(JEV_ADJUSTMENTS), 'workId']);
  return [kind, kind === 'workId' ? rng.pick(WORK_IDS) : rng.pick(Object.keys(JEV_ADJUSTMENTS[kind]))];
}

beforeEach(() => {
  mocks.query.mockImplementation(strings => Promise.resolve(
    strings.join('').includes('FROM rise_sounds') ? sounds : catalog));
  mocks.optionsQuery.mockResolvedValue(options);
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue('OK');
  mocks.expire.mockResolvedValue(1);
  // A cache miss must fail loudly instead of reaching a provider.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('provider must not be called'); }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Worker and browser validators agree on Jev plans', () => {
  it('has a harness that accepts a coherent plan and rejects an incoherent one', async () => {
    const quiet = decisionFrom({
      section: 'first', wpm: 200, curve: 'flat', chunkMode: 'word', audio: 'silent',
      visualMode: 'off', visualStyle: 'quiet', visualEngine: 'klee', visualArc: 'single', arcSplit: '50',
      middleEngine: 'klee', finaleEngine: 'klee', middleTheme: 'classic', finaleTheme: 'classic',
      middleAudio: 'silent', finaleAudio: 'silent', visualPalette: 'white', kleePreset: 'harmonic',
      galleryCadence: 'balanced', chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic',
      textColor: 'classic', backgroundColor: 'classic', wordFill: 'plain',
      projection: 'stream', revealMode: 'instant'
    }, WORK_IDS[0]);
    expect(await workerAccepts(quiet)).toBe(true);
    // Psychedelic requires the Neon night palette; the browser does not check that.
    const incoherent = decisionFrom({ ...quiet.config, visualStyle: 'psychedelic', colorTheme: 'classic' }, WORK_IDS[0]);
    expect(clientAccepts(incoherent)).toBe(true);
    expect(await workerAccepts(incoherent)).toBe(false);
  });

  it('accepts in the Worker every plan the Adjust path produces', async () => {
    const rng = lcg(0x5eed01);
    let bases = 0;
    let adjusted = 0;
    for (let sample = 0; sample < 2000; sample += 1) {
      let decision = randomDecision(rng);
      // Adjust re-derives Jev's own answers; start from plans the Worker itself would emit.
      if (!(await workerAccepts(decision))) continue;
      bases += 1;
      const steps = [];
      for (let step = 0, count = 1 + Math.floor(rng.next() * 4); step < count; step += 1) {
        const [kind, value] = randomAdjustment(rng);
        steps.push(`${kind}:${value}`);
        // The catalog copy is the Worker's `reason`; a new text clears it in the browser only.
        decision = { ...adjustJevDecision(decision, kind, value), reason: FIT_DESCRIPTION };
        adjusted += 1;
        expect(clientAccepts(decision), `client rejects ${steps.join(' > ')}`).toBe(true);
        expect(await workerAccepts(decision), `worker rejects ${steps.join(' > ')}`).toBe(true);
      }
    }
    console.info(`[jev-agreement] adjust: ${bases} worker-valid base plans, ${adjusted} adjusted plans all accepted`);
    expect(bases).toBeGreaterThan(100);
  }, 60_000);

  it('accepts in the Worker every single option applied to a spread of base plans', async () => {
    const rng = lcg(0x5eed02);
    let checked = 0;
    for (let sample = 0; sample < 1000 && checked < 400; sample += 1) {
      const base = randomDecision(rng);
      if (!(await workerAccepts(base))) continue;
      for (const [kind, options] of Object.entries(JEV_ADJUSTMENTS)) {
        for (const value of Object.keys(options)) {
          const next = adjustJevDecision(base, kind, value);
          expect(await workerAccepts(next), `worker rejects ${kind}:${value}`).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  }, 60_000);

  it('counts random plans the browser accepts and the Worker rejects, without failing on them', async () => {
    const rng = lcg(0x5eed03);
    const total = 3000;
    let clientAccepted = 0;
    let workerAccepted = 0;
    let workerOnlyRejections = 0;
    let workerOnlyAcceptances = 0;
    for (let sample = 0; sample < total; sample += 1) {
      const decision = randomDecision(rng);
      const client = clientAccepts(decision);
      const worker = await workerAccepts(decision);
      if (client) clientAccepted += 1;
      if (worker) workerAccepted += 1;
      if (client && !worker) workerOnlyRejections += 1;
      if (!client && worker) workerOnlyAcceptances += 1;
    }
    console.info(`[jev-agreement] random plans: ${total} sampled, ${clientAccepted} browser-accepted, `
      + `${workerAccepted} worker-accepted, ${workerOnlyRejections} browser-accepted but worker-rejected `
      + `(worker stricter by design), ${workerOnlyAcceptances} worker-accepted but browser-rejected`);
    // The counts are informational; only guard against a sampler that measures nothing.
    expect(clientAccepted).toBeGreaterThan(0);
  }, 60_000);
});
