/**
 * ONE PACE WINDOW, PROVED AT ITS EDGES.
 *
 * There were four statements of how fast a reader may read. app.js accepted
 * 50–1000 and stored it. normalizeReading (the layer the compiled session
 * honours) clamped to 100–500, and scriptorium-session.js carried a copy of
 * that pair so the room's estimate would agree with it. The two that agreed
 * were both wrong about the reader: someone who set 60 was accepted at 60,
 * quoted 100 and read at 100.
 *
 * WHY THESE TESTS PROBE EDGES RATHER THAN VALUES. Two literals that agree
 * today are not a guarantee — 100 and 500 agreed with each other perfectly
 * and disagreed with the app. So nothing below asserts a number. Each clamp
 * is asked four questions derived from READING_PACE:
 *
 *   f(min - 1) === f(min)   nothing under the floor gets through
 *   f(min)     !== f(min+1) the floor is READING_PACE.min and not something
 *                           higher that merely also rejects min - 1
 *   f(max + 1) === f(max)   nothing over the ceiling gets through
 *   f(max)     !== f(max-1) the ceiling is READING_PACE.max exactly
 *
 * A second literal reappearing anywhere in this list fails the pair that pins
 * the bound it moved, whether it narrows the window or widens it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../app.js';
import { Chamber } from '../components/Chamber.js';
import { chunkText } from './chunker.js';
import { EXPERIENCE_PROGRAM_LIMITS } from './experience-program.js';
import { PacingEngine } from './pacing.js';
import { estimateRundownMinutes } from './program-rundown.js';
import { clampReadingWpm, READING_PACE } from './reading-limits.js';
import { createScriptoriumSession, describeLength, readerWpm } from './scriptorium-session.js';
import { normalizeSessionConfig, SESSION_LIMITS } from './session-compiler.js';
import {
  emptyWorkshopProject,
  migrateWorkshopBlueprint,
  validateWorkshopProject,
  workshopProjectToSessionConfig
} from './workshop-project.js';

const { min, max } = READING_PACE;

/** A Workshop project's reading pace, through the real validator. */
function projectPace(wpm) {
  const base = emptyWorkshopProject();
  return validateWorkshopProject({
    ...base,
    defaults: { ...base.defaults, reading: { ...base.defaults.reading, wpm } }
  }).defaults.reading.wpm;
}

/**
 * The chunker keeps no wpm — it turns one into a duration. Long units,
 * because a word atom at 999 and one at 1000 both round to 60ms and the
 * ceiling would be untestable through them.
 */
const SENTENCE = `${Array.from({ length: 60 }, (_, i) => `word${i % 7}`).join(' ')}.`;
const PASSAGE = Array.from({ length: 6 }, () => SENTENCE).join(' ');
function chunkedMs(wpm) {
  return chunkText(PASSAGE, { mode: 'sentence', wpm })
    .reduce((total, atom) => total + atom.duration, 0);
}

/**
 * The ↑/↓ keys during a live reading. Built on the prototype rather than
 * mounted, because updateWpm is the whole subject and the HUD it calls after
 * is not.
 */
function chamberPace(wpm) {
  const chamber = Object.create(Chamber.prototype);
  chamber.player = { setSpeedFactor: vi.fn() };
  chamber.baseWpm = 200;
  chamber.currentWpm = wpm;
  chamber.showSpeedHud = () => {};
  chamber.updateWpm(0);
  return chamber.currentWpm;
}

const CLAMPS = [
  ['the shared clamp', wpm => clampReadingWpm(wpm)],
  ['the reader\'s stored setting', wpm => readerWpm({ defaultWpm: wpm })],
  ['a Scriptorium session\'s pace override', wpm => createScriptoriumSession({ wpm }).wpm],
  ['a Workshop project\'s reading defaults', projectPace],
  ['the compiled session config', wpm => normalizeSessionConfig({ wpm }).wpm],
  ['the pacing engine', wpm => new PacingEngine().normalizeWpm(wpm)],
  ['the chunker\'s delivered duration', chunkedMs],
  ['the Chamber\'s live speed keys', chamberPace]
];

describe('READING_PACE is the only pace window', () => {
  describe.each(CLAMPS)('%s', (_name, clamp) => {
    it('floors at READING_PACE.min and nowhere above it', () => {
      expect(clamp(min - 1)).toBe(clamp(min));
      expect(clamp(min)).not.toBe(clamp(min + 1));
    });

    it('ceilings at READING_PACE.max and nowhere below it', () => {
      expect(clamp(max + 1)).toBe(clamp(max));
      expect(clamp(max)).not.toBe(clamp(max - 1));
    });
  });

  it('bounds a migrated legacy pace by the engine, not by the old slider', () => {
    // ×1.4375 is the temporal contract's feel correction: a pace saved under
    // the hidden slowdown has to rise for the delivered reading to stay put.
    // A blueprint saved at the old slider's top migrates past 500, and
    // clamping it back to 500 discards exactly the feel being preserved.
    const migrated = wpm =>
      migrateWorkshopBlueprint({ id: 'legacy', sources: [], wpm }).defaults.reading.wpm;

    expect(migrated(500)).toBeGreaterThan(500);
    expect(migrated(500)).toBe(720);
    expect(migrated(max)).toBe(max);
    expect(migrated(min)).toBeLessThan(100);
  });

  it('is the window the limit tables publish, not a number beside them', () => {
    // These are read by callers that never touch clampReadingWpm — a refusal
    // message and a Vault acceptance check — so a copy here would drift
    // silently in exactly the way the four originals did.
    expect(SESSION_LIMITS.minWpm).toBe(min);
    expect(SESSION_LIMITS.maxWpm).toBe(max);
    expect(EXPERIENCE_PROGRAM_LIMITS.minWpm).toBe(min);
    expect(EXPERIENCE_PROGRAM_LIMITS.maxWpm).toBe(max);
  });
});

describe('an absent pace is not a slow one', () => {
  // `Number(null)`, `Number('')` and `Number([])` are all 0, and 0 is finite,
  // so every one of these used to survive the guard and clamp to the floor.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['an array', []],
    ['an object', {}],
    ['a boolean', true],
    ['not a number', 'quickly']
  ])('%s reaches the fallback rather than the floor', (_label, value) => {
    expect(clampReadingWpm(value, 220)).toBe(220);
    expect(clampReadingWpm(value)).toBe(READING_PACE.default);

    expect(readerWpm({ defaultWpm: value })).toBe(READING_PACE.default);

    expect(projectPace(value)).toBe(READING_PACE.default);
  });

  it('still reads a pace written as a string, which is what an input gives', () => {
    expect(clampReadingWpm('60')).toBe(60);
    expect(clampReadingWpm(' 60 ')).toBe(60);
    expect(projectPace('60')).toBe(60);
  });

  it('is a whole number of words a minute', () => {
    // Two of the three original clamps rounded and app.js did not, so the
    // same stored 220.6 was a pace of 220.6 in Settings and 221 in the
    // reading. A pace is quoted to the reader as an integer; it should be one.
    expect(clampReadingWpm(220.6)).toBe(221);
    expect(clampReadingWpm(220.4)).toBe(220);
    expect(projectPace(220.6)).toBe(221);
    // Rounding happens inside the window, so it cannot round past an edge.
    expect(clampReadingWpm(min - 0.4)).toBe(min);
    expect(clampReadingWpm(max + 0.4)).toBe(max);
  });
});

describe('the door a reader takes to set a pace', () => {
  let app;
  let documentedDefault;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false }))
    });
    localStorage.clear();
    app = new App();
    // Read rather than restated, so this test cannot disagree with app.js
    // about what an untouched install reads at.
    app.loadSettings();
    documentedDefault = app.settings.defaultWpm;
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('carries a deliberate 60 wpm all the way to the atoms', () => {
    // THE WHOLE PATH, not the inner function. Settings are stored as JSON and
    // re-read on load; every surface downstream reads them off the app object
    // rather than off the store, so a break anywhere in that chain is exactly
    // the wiring defect a direct call to readerWpm() cannot see.
    localStorage.setItem('rise-settings', JSON.stringify({ defaultWpm: 60 }));
    app.loadSettings();

    expect(app.settings.defaultWpm).toBe(60);
    expect(readerWpm(app.settings)).toBe(60);
    expect(createScriptoriumSession({ wpm: readerWpm(app.settings) }).wpm).toBe(60);

    // What the room quotes, and what the reading is actually compiled at.
    // Both were 100, and 2,000 words at 100 is 20 minutes rather than 33.
    expect(describeLength(2_000, readerWpm(app.settings))).toContain('60 wpm');
    expect(describeLength(2_000, readerWpm(app.settings))).toContain('33 min');

    const base = emptyWorkshopProject();
    const project = validateWorkshopProject({
      ...base,
      defaults: {
        ...base.defaults,
        reading: { ...base.defaults.reading, wpm: app.settings.defaultWpm }
      }
    });
    expect(project.defaults.reading.wpm).toBe(60);
    expect(workshopProjectToSessionConfig(project).wpm).toBe(60);
    expect(normalizeSessionConfig(workshopProjectToSessionConfig(project)).wpm).toBe(60);
  });

  it('reaches the documented default when the setting is absent or unreadable', () => {
    expect(documentedDefault).toBeGreaterThanOrEqual(min);
    expect(documentedDefault).toBeLessThanOrEqual(max);

    for (const stored of [{ defaultWpm: null }, { defaultWpm: '' }, { defaultWpm: 'fast' }, {}]) {
      localStorage.setItem('rise-settings', JSON.stringify(stored));
      app.loadSettings();
      expect(app.settings.defaultWpm).toBe(documentedDefault);
    }
  });

  it('bounds a pace where it is chosen, not where it is read', () => {
    // Stored unbounded, a 5,000 sat in the settings looking accepted and was
    // rewritten by every surface that later read it.
    app.handleSettingsChange('defaultWpm', 5_000);
    expect(app.settings.defaultWpm).toBe(max);
    expect(JSON.parse(localStorage.getItem('rise-settings')).defaultWpm).toBe(max);

    app.handleSettingsChange('defaultWpm', 60);
    expect(app.settings.defaultWpm).toBe(60);

    app.handleSettingsChange('defaultWpm', null);
    expect(app.settings.defaultWpm).toBe(60);
  });

  it('stores nothing the reading engine would go on to override', () => {
    for (const asked of [min - 40, min, 60, 220, max, max + 4_000]) {
      localStorage.setItem('rise-settings', JSON.stringify({ defaultWpm: asked }));
      app.loadSettings();
      expect(readerWpm(app.settings)).toBe(app.settings.defaultWpm);
      expect(projectPace(app.settings.defaultWpm)).toBe(app.settings.defaultWpm);
    }
  });
});

describe('the rundown estimate asks for a pace', () => {
  it('has no pace of its own to fall back on', () => {
    // This defaulted to 320 — a number no other surface on the Scriptorium
    // path uses — and no caller ever reached it. Omitting the pace now reads
    // as "no estimate" rather than as an estimate at a pace nobody set.
    const rundown = { pace: [], totals: { words: 2_000 } };
    expect(estimateRundownMinutes(rundown, 60)).toBe(33);
    expect(estimateRundownMinutes(rundown, READING_PACE.default)).toBe(10);
    expect(estimateRundownMinutes(rundown)).toBeNull();
  });
});
