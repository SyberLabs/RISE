/**
 * WHAT THE ROOM LOST.
 *
 * The five Scriptorium steps used to be methods on a component that ended each
 * one in `this.render()`, so asking what the room decides meant mounting a
 * document and clicking. They are here now, and the room is a view: these
 * tests drive the whole sequence with no container, no listeners and no markup.
 *
 * The last describe is the one that keeps it that way. An extraction that
 * leaves the old fields behind on the component is not an extraction — it is
 * two copies with a delegation between them, which is worse than either,
 * because the copy that is written to and the copy that is read can be
 * different ones.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  clampTargetWords,
  createScriptoriumSession,
  describeLength,
  holdingRung,
  readerWpm,
  SCRIPTORIUM_LENGTH
} from './scriptorium-session.js';
import { Scriptorium } from '../components/Scriptorium.js';
import { MAX_SAFE_TARGET_WORDS, READING_PACE } from './reading-limits.js';

const TAO = 'sacred-tao-te-ching';

const score = (sourceIds) => JSON.stringify({
  schema: 'rise.experience-program.v1',
  id: 'a-reading',
  authority: 'proposed',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: sourceIds.map((sourceId, index) => ({
      id: `m${index + 1}`,
      anchor: { sourceIds: [sourceId] },
      data: { index, title: sourceId }
    }))
  }]
});

describe('the sequence, with no room around it', () => {
  it('walks intent, length, take, examine, read', async () => {
    const session = createScriptoriumSession({ mintId: () => 'fixed' });
    session.setIntent('A sequence about memory and loss.');
    session.setTargetWords(400);

    const { context, promptText } = session.take();
    expect(context.id).toBe('fixed');
    expect(context.constraints.targetWords).toBe(400);
    expect(promptText).toContain('A sequence about memory and loss.');

    expect(session.examine(score([`${TAO}#40`]))).toMatchObject({ ok: true, kind: 'program' });
    const outcome = await session.read();
    expect(outcome.ok).toBe(true);
    expect(outcome.project.sources.map(source => source.id)).toEqual([`${TAO}#40`]);
    expect(outcome.project.id).toBe('fixed');
  }, 60_000);

  it('rebuilds the take when the length no longer matches the budget', () => {
    const session = createScriptoriumSession();
    session.setTargetWords(20_000);
    session.take();
    // The reader moves the dial and presses Examine without preparing again.
    session.setTargetWords(400);
    session.examine(score([TAO]));
    expect(session.context.constraints.targetWords).toBe(400);
    expect(session.verdict.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
  });

  it('sizes an unmoved dial to a pasted score that only exceeds the default sitting', () => {
    const session = createScriptoriumSession();
    expect(session.lengthChosen).toBe(false);
    expect(session.targetWords).toBe(SCRIPTORIUM_LENGTH.default);
    const verdict = session.examine(score(['oedipus-rex']));
    expect(verdict.ok).toBe(true);
    expect(session.rundown?.movements?.[0]?.title).toBe('oedipus-rex');
    expect(session.rundown.totals.words).toBeGreaterThan(SCRIPTORIUM_LENGTH.default);
    expect(session.targetWords).toBe(holdingRung(session.rundown.totals.words));
    expect(session.lengthChosen).toBe(false);
  });

  /**
   * THE ROOM PAINTS "Loading chosen works…" AND THIS IS WHY IT CAN.
   *
   * `read()` is async, and a status set after its first await would arrive one
   * frame too late — the room renders between the call and the resolution.
   * Nothing else in the suite can see this ordering.
   */
  it('says what it is doing before it starts awaiting', async () => {
    const session = createScriptoriumSession();
    session.setTargetWords(400);
    session.examine(score([`${TAO}#40`]));
    const reading = session.read();
    expect(session.status).toBe('Loading chosen works…');
    await reading;
  }, 60_000);

  it('refuses to read a score it has not examined', async () => {
    const session = createScriptoriumSession();
    const outcome = await session.read();
    expect(outcome.ok).toBe(false);
    expect(outcome.project).toBeNull();
    expect(outcome.verdict.code).toBe('PROGRAM_IO_NOT_EXAMINED');
  });

  it('carries the ids of what would not load, beside the prose', async () => {
    const session = createScriptoriumSession();
    session.setTargetWords(20_000);
    session.examine(score(['ulysses#18:200']));
    expect(session.verdict.ok).toBe(true);
    const outcome = await session.read();
    expect(outcome.verdict.code).toBe('PROGRAM_IO_LIBRARY_UNLOADABLE');
    expect(outcome.verdict.details.unreadable).toEqual(['ulysses#18:200']);
    expect(outcome.verdict.details.absent).toEqual([]);
  }, 120_000);

  it('makes the reader\'s files durable through the hook it was given', async () => {
    const prepareAssets = vi.fn(async () => []);
    const session = createScriptoriumSession({ prepareAssets });
    session.setTargetWords(400);
    session.addMaterial({ id: 'asset-1', name: 'cliff.png', color: '#fff' });
    session.examine(score([`${TAO}#40`]));
    await session.read();
    expect(prepareAssets).toHaveBeenCalledWith(session.projectId, session.materials);
  }, 60_000);
});

describe('the length and the pace, in one place', () => {
  afterEach(() => { delete globalThis.rise; });

  it('offers no length the gate would refuse', () => {
    // The property the deleted `max` was protecting: the dial cannot reach a
    // budget the gate would then refuse. Asserted over every rung, because
    // the ladder is nine numbers rather than one ceiling.
    for (const rung of SCRIPTORIUM_LENGTH.rungs) {
      expect(rung, `rung ${rung}`).toBeLessThanOrEqual(MAX_SAFE_TARGET_WORDS);
    }
    expect(SCRIPTORIUM_LENGTH.rungs).toContain(SCRIPTORIUM_LENGTH.default);
  });

  it('snaps to the nearest rung, and ties go to the shorter reading', () => {
    const [lowest] = SCRIPTORIUM_LENGTH.rungs;
    const highest = SCRIPTORIUM_LENGTH.rungs[SCRIPTORIUM_LENGTH.rungs.length - 1];
    expect(clampTargetWords(999_999)).toBe(highest);
    expect(clampTargetWords(4)).toBe(lowest);
    expect(clampTargetWords('not a number')).toBe(SCRIPTORIUM_LENGTH.default);
    // Exactly between 400 and 1,000. Down, because this room's failure was
    // always offering more than the shelf could serve.
    expect(clampTargetWords(700)).toBe(400);
    expect(clampTargetWords(701)).toBe(1000);
    for (const rung of SCRIPTORIUM_LENGTH.rungs) {
      expect(clampTargetWords(rung), `${rung} is already a rung`).toBe(rung);
    }
    expect(holdingRung(12_592)).toBe(18_000);
    expect(holdingRung(400)).toBe(400);
    expect(holdingRung(200_000)).toBeNull();
  });

  it('changes what the shelf can serve at every step', () => {
    // A dial whose travel repeats a sitting is not a control. Adjacent rungs
    // differ by at least a third, which is what makes nine of them legible
    // where a thousand stops were not.
    const { rungs } = SCRIPTORIUM_LENGTH;
    for (let i = 1; i < rungs.length; i += 1) {
      expect(rungs[i] / rungs[i - 1], `rung ${i}`).toBeGreaterThanOrEqual(1.33);
    }
    expect([...rungs].sort((a, b) => a - b)).toEqual([...rungs]);
  });

  it('reads the setting the app actually stores', () => {
    // The key is `defaultWpm`. A room reading `wpm` quoted every reader the
    // fallback, and told one who had set 220 an hour for an hour and forty.
    globalThis.rise = { settings: { wpm: 220 } };
    expect(readerWpm()).toBe(200);
    globalThis.rise = { settings: { defaultWpm: 220 } };
    expect(readerWpm()).toBe(220);
    // Clamped to READING_PACE, so the figure shown is the figure the reading
    // opens at. Derived, not restated: a second literal here would let the
    // room's ceiling and the engine's drift apart and still pass.
    globalThis.rise = { settings: { defaultWpm: 9_000 } };
    expect(readerWpm()).toBe(READING_PACE.max);
    // A pace the app accepts is a pace the room quotes. This was 100 — the
    // slider's floor, quoted at a reader who had chosen 60.
    globalThis.rise = { settings: { defaultWpm: 60 } };
    expect(readerWpm()).toBe(60);
  });

  it('quotes no pace but the one it was handed', () => {
    // `Number(null)` is 0 and 0 is finite, so a surface passing no override
    // was clamped to the window's floor and quoted 100.
    const session = createScriptoriumSession();
    globalThis.rise = { settings: { defaultWpm: 220 } };
    expect(session.wpm).toBe(220);
    expect(createScriptoriumSession({ wpm: 150 }).wpm).toBe(150);
    expect(describeLength(20_000, 220)).toContain('220 wpm');
    expect(describeLength(20_000, 220)).toContain('1h 31m');
  });
});

/**
 * A GESTURE REACHES THE SESSION.
 *
 * Not a style preference. Two fields for one fact means a write that lands on
 * one of them, and the Scriptorium already paid for that once: the budget the
 * gate measured against lived in a context built at one length while the
 * reader looked at another, so the refusal advised exactly what they had just
 * done. Restoring `this.targetWords = …` to the component fails this.
 *
 * THE READING HALF OF THIS CLAIM LIVES IN Scriptorium.room.test.js, and what
 * stood here was the weaker guard of the two. It listed fifteen field names
 * and required each to be absent from `Object.getOwnPropertyNames(room)` — a
 * shadow copy under a sixteenth name defeats that outright, and did:
 *
 *   this.shadowPreview = null;
 *   get preview() {
 *     if (this.session.preview) this.shadowPreview = this.session.preview;
 *     return this.shadowPreview;
 *   }
 *
 * `'preview' in room` is true, `preview` is not an own property name, and the
 * room presents the previous score's chosen works beside a fresh refusal. The
 * room test asserts the thing that is actually worth asserting — a sentinel
 * round trip per field including a `null`, which is the line a cached getter
 * fails; a name-free sweep for any value the session has discarded; the
 * reader-facing form of it in section 5; and that the list of fields equals
 * the session's own. Two guards where the weaker can pass alone is worse than
 * one, so the weaker is gone rather than kept in step.
 *
 * What is NOT covered there is the write direction: a room that read through
 * getters and wrote to fields of its own would satisfy every one of those
 * assertions and still hand the gate a stale length.
 */
describe('the reader\'s gestures land on the session, not on the room', () => {
  let container;
  let room;

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:x');
    global.URL.revokeObjectURL = vi.fn();
    container = document.createElement('div');
    room = new Scriptorium(container, { onNavigate: vi.fn(), onCreateSession: vi.fn() });
    room.mount();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('writes the reader\'s gestures into the session', () => {
    const intent = container.querySelector('#scriptorium-intent');
    intent.value = 'Memory and loss.';
    intent.dispatchEvent(new Event('input', { bubbles: true }));
    expect(room.session.intent).toBe('Memory and loss.');

    // The control's native value is words, snapped to the nearest rung.
    const slider = container.querySelector('#scriptorium-length');
    slider.value = '2000';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(room.session.targetWords).toBe(2000);

    const paste = container.querySelector('#scriptorium-paste');
    paste.value = '{}';
    paste.dispatchEvent(new Event('input', { bubbles: true }));
    expect(room.session.pasted).toBe('{}');
  });
});
