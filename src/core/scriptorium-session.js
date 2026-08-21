/**
 * The Scriptorium's sequence, with no room around it.
 *
 * Intent and length → take (prompt + context) → examine → read. Those four
 * steps ARE the Scriptorium (docs/vision/SCRIPTORIUM-SPEC.md §4), and until
 * now they lived inside Scriptorium.js tangled with innerHTML: every step
 * ended in `this.render()`, so the only way to ask what the room decides was
 * to mount a jsdom document and click.
 *
 * THREE SURFACES, ONE SEQUENCE. The room binds DOM events to these methods
 * and renders what they leave behind; the CLI binds argv to them and prints
 * it; the suite asserts on it directly. The room is a VIEW of this object —
 * it holds no copy of the intent, the length, the context, the verdict or the
 * program, and reads each one through a getter. That is the point: a second
 * copy of the steps is how one door learns a new word and the other never
 * hears it, which is the defect this codebase names first (law 5).
 *
 * WHAT IS DELIBERATELY NOT HERE: object URLs, IndexedDB, the clipboard, the
 * Vault. A material arrives here as the plain descriptor
 * createSequenceVisualAsset returns, and the bytes behind it are the calling
 * surface's business — the room hands `prepareAssets` a function that makes
 * them durable, and the CLI, which has no store, hands nothing.
 */

import { CuratorContextValidationError, exportCuratorContext } from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { describeProgramRundown } from './program-rundown.js';
import { clampReadingWpm, MAX_SAFE_TARGET_WORDS } from './reading-limits.js';
import {
  describeImportFailure,
  ExperienceProgramIoError,
  noLibrarySourcesError,
  parseCuratorPaste,
  unloadableLibrarySourcesError,
  workshopProjectFromImportedProgram
} from './experience-program-io.js';
import { ExperienceProgramValidationError } from './experience-program.js';
import {
  AgentOperationError,
  summarizeAgentOperationSet
} from './agent-operations.js';
import { emptyWorkshopProject, WorkshopProjectError } from './workshop-project.js';
import { ProducerError, runProducer } from './producer.js';
import {
  assertResolvedProgramQuotations,
  previewProgramChoices,
  resolveOperationLibrarySources,
  resolveProgramLibrarySources
} from './scriptorium-resolve.js';
import { SourceSpanResolutionError } from './source-span.js';
import { VisualScoreLaneError } from './visual-score-lane.js';
import { AudioScoreLaneError } from './audio-score-lane.js';
import { NarrationScoreLaneError } from './narration-score-lane.js';
import { NarrationError } from './narration.js';
import { EditorAssetError } from './editor-asset.js';

/**
 * The length dial, in one place.
 *
 * The floor is an opening, not the shortest work in the library. The shortest
 * work on the shelf runs to 10,321 words, so a slider that filtered by whole
 * works had nowhere below that to go; a movement can name a division's
 * opening now (see library-extent.js), and 200 words is a passage worth
 * reading.
 *
 * The ceiling is the COMPILER's, not the budget's. maxAtoms counts atoms, and
 * word chunking emits a paragraph-break atom for every paragraph — so a
 * length equal to the atom cap passed the gate and threw at Begin, which made
 * the top of the slider's travel a trap. The gate refuses against the same
 * constant (experience-program-io.js), so neither surface offers a length the
 * gate would refuse rather than the two agreeing by arithmetic.
 */
export const SCRIPTORIUM_LENGTH = Object.freeze({
  min: 200,
  step: 100,
  max: MAX_SAFE_TARGET_WORDS,
  default: 20_000
});

export function clampTargetWords(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return SCRIPTORIUM_LENGTH.default;
  return Math.max(SCRIPTORIUM_LENGTH.min, Math.min(SCRIPTORIUM_LENGTH.max, parsed));
}

/**
 * The pace this reading will actually open at.
 *
 * The settings object has no `wpm` — the app's key is `defaultWpm` — so every
 * duration the room showed was the fallback, and a reader who had set 220 was
 * quoted an hour for a reading that runs an hour and forty. This is also the
 * number written into the project's reading defaults, so the estimate and the
 * session are one expression rather than two that happen to agree. Clamped to
 * READING_PACE, because a value the reading would clamp is a figure the room
 * must not quote — and READING_PACE is now the window the reading applies,
 * rather than a copy of it that could drift.
 */
export function readerWpm() {
  return clampReadingWpm(globalThis.rise?.settings?.defaultWpm);
}

/**
 * Minutes are shown and words are sent.
 *
 * A model can add words up from the library it was handed; it cannot turn
 * minutes back into words without a pace and a chunk mode. And a program can
 * score its own pace now, so the minutes below are what this length comes to
 * at the reader's CURRENT setting — a reading that slows itself will run
 * longer, which is the score doing its job rather than the estimate failing.
 */
export function describeLength(words, wpm = readerWpm()) {
  const minutes = Math.round(words / wpm);
  const clock = minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
    : `${minutes} min`;
  return `${words.toLocaleString()} words — about ${clock} at ${wpm} wpm`;
}

/**
 * The errors this sequence phrases rather than reports as a fault of its own.
 *
 * WorkshopProjectError was the family that had neither a status nor a
 * wording: `ScriptoriumSession.isRefusal` did not list it, so `status` became
 * the raw message — `A Workshop project accepts at most 64 sources
 * ($.sources)` — where every other refusal says 'Refused.' and puts its
 * correction in the panel. Sixty-five chapters of the Tao at 8,456 words is
 * an ordinary score, and it reached the reader as an exception.
 *
 * IT IS A REMEMBERED LIST, AND THAT IS WHY IT IS CHECKED FROM THE OTHER SIDE.
 * Nothing in a list of seven can say what the eighth should have been, and
 * deleting one line from it left the whole suite and CI green while putting
 * `An operation set accepts 1–32 operations ($.operations)` in a reader's
 * status line. So scriptorium-cli.test.js enumerates every
 * `export class … extends Error` under src/core and requires each one to be
 * named here or excused there with a reason — the arrangement `UNREACHABLE`
 * already uses for statuses, and the only shape in which a NEW unnamed class
 * is a failure rather than a silence.
 *
 * AudioScoreLaneError, EditorAssetError and CuratorContextValidationError
 * arrived by that guard: two lanes' worth of ordinary scoring mistakes and
 * every malformed capability document reached readers as raw exceptions.
 */
function isRefusal(error) {
  return error instanceof ExperienceProgramIoError
    || error instanceof ExperienceProgramValidationError
    || error instanceof AgentOperationError
    || error instanceof SourceSpanResolutionError
    || error instanceof VisualScoreLaneError
    || error instanceof AudioScoreLaneError
    || error instanceof NarrationScoreLaneError
    || error instanceof NarrationError
    || error instanceof EditorAssetError
    || error instanceof CuratorContextValidationError
    || error instanceof WorkshopProjectError
    || error instanceof ProducerError;
}

/**
 * A headless Scriptorium.
 *
 * @param {object} [options]
 * @param {number} [options.wpm] override the reader's setting, which a
 *   surface with no reader (the CLI) has no way to read
 * @param {(projectId: string) => Promise<object[]>} [options.prepareAssets]
 *   the reader's own files, made durable, on the way into a project
 * @param {() => string} [options.mintId] one id per composition
 */
export function createScriptoriumSession(options = {}) {
  return new ScriptoriumSession(options);
}

export class ScriptoriumSession {
  constructor({ wpm = null, prepareAssets = null, mintId = null } = {}) {
    // NULL IS NOT A PACE. `Number(null)` is 0 and 0 is finite, so a surface
    // that passed no override was clamped to the window's floor and quoted a
    // reader who had set 220 a reading at 100. Absent falls through to
    // readerWpm() via the getter, which is why the fallback here is null.
    this.wpmOverride = clampReadingWpm(wpm, null);
    this.prepareAssets = typeof prepareAssets === 'function' ? prepareAssets : null;
    this.mintId = typeof mintId === 'function'
      ? mintId
      : () => `scriptorium-${Date.now()}`;

    this.intent = '';
    this.targetWords = SCRIPTORIUM_LENGTH.default;
    // WHAT THE READER BROUGHT. The Library is what RISE holds and answers
    // for; these are the reader's own, which RISE describes rather than
    // certifies. Descriptors only — no bytes, no object URLs.
    this.swells = [];
    this.materials = [];

    this.context = null;
    this.promptText = '';
    this.pasted = '';
    this.program = null;
    this.operationSet = null;
    this.proposalRows = null;
    this.preview = null;
    this.rundown = null;
    this.verdict = null;
    this.producer = null;
    this.status = '';
    // One composition, one id. Minted when a score is accepted rather than
    // per read() call, so the bytes, the Vault draft and the reading all name
    // the same project.
    this.projectId = null;
  }

  get wpm() {
    return this.wpmOverride ?? readerWpm();
  }

  setIntent(text) {
    this.intent = String(text ?? '').slice(0, 2000);
    return this.intent;
  }

  setTargetWords(value) {
    this.targetWords = clampTargetWords(value);
    return this.targetWords;
  }

  setSwells(swells) {
    // ID AND NAME ONLY. A stored swell carries its audio blob, and the
    // capability document's first rule is that it never embeds media bytes.
    this.swells = (Array.isArray(swells) ? swells : [])
      .filter(swell => swell && typeof swell.id === 'string')
      .map(swell => ({ id: swell.id, name: swell.name }));
    return this.swells;
  }

  setMaterials(materials) {
    this.materials = Array.isArray(materials) ? [...materials] : [];
    return this.materials;
  }

  addMaterial(material) {
    this.materials.push(material);
    return material;
  }

  dropMaterial(id) {
    const held = this.materials.find(item => item.id === id);
    if (!held) return null;
    this.materials = this.materials.filter(item => item.id !== id);
    return held;
  }

  describeLength() {
    return describeLength(this.targetWords, this.wpm);
  }

  /**
   * The capability document and the brief that travels beside it.
   *
   * Both from one call, because the prompt's worked examples are composed out
   * of the context it ships with (curator-prompt.js) — a prompt built against
   * a different document names ids that document does not offer.
   */
  take() {
    this.context = exportCuratorContext({
      id: this.mintId(),
      sources: [],
      includeLibrary: true,
      // The reader's own audio, by id AND by name. Passing nothing here was
      // the whole of the seam: both rooms build the same document from the
      // same function, and this one handed it empty arrays.
      swells: this.swells,
      assets: this.materials,
      constraints: { targetWords: this.targetWords }
    });
    this.promptText = buildCuratorPrompt({
      intent: this.intent,
      context: this.context
    });
    return { context: this.context, promptText: this.promptText };
  }

  /**
   * The gate. A pasted document becomes a proposal, or a refusal to paste back.
   */
  examine(text = this.pasted) {
    this.pasted = String(text ?? '');
    // The length IS the budget. A context built at another length judges the
    // score against a number the reader can no longer see, and the refusal
    // then advises exactly what they already did.
    if (!this.context || this.context.constraints?.targetWords !== this.targetWords) {
      this.take();
    }
    try {
      const pasted = parseCuratorPaste(this.pasted, { context: this.context });
      if (pasted.kind === 'operations') {
        this.operationSet = pasted.operationSet;
        this.proposalRows = summarizeAgentOperationSet(pasted.operationSet);
        this.program = null;
        this.preview = null;
        this.rundown = null;
        this.projectId = null;
        this.verdict = { ok: true, kind: 'operations', code: null, text: null };
        this.status = 'Operations accepted at the gate. '
          + 'Read what they would change, then begin.';
        return this.verdict;
      }
      this.operationSet = null;
      this.proposalRows = null;
      this.program = pasted.program;
      // A new score is a new composition, and it gets its id here rather than
      // once per read() call — so the bytes stored for it, the Vault draft,
      // and the reading all name the same project.
      this.projectId = this.mintId();
      this.preview = previewProgramChoices(this.program, this.context);
      this.rundown = describeProgramRundown(this.program, this.context);
      this.verdict = { ok: true, kind: 'program', code: null, text: null };
      this.status = 'Score accepted at the gate. Read what it does, then begin.';
      return this.verdict;
    } catch (error) {
      this.program = null;
      this.operationSet = null;
      this.proposalRows = null;
      this.preview = null;
      this.rundown = null;
      return this.refuse(error);
    }
  }

  /**
   * Load the works the score names and build the project it compiles from.
   *
   * The status is set BEFORE the first await, so a surface that renders on the
   * way past can say what is happening without this function knowing that it
   * renders at all.
   *
   * @returns {Promise<{ ok: boolean, project: object|null, verdict: object,
   *   sources: object[] }>}
   */
  async read() {
    if (this.operationSet) return this.readOperations();
    if (!this.program) {
      return this.refuseWith(this.refuse(new ExperienceProgramIoError(
        'PROGRAM_IO_NOT_EXAMINED',
        'No score has been examined',
        '$'
      )));
    }
    this.status = 'Loading chosen works…';
    try {
      const { sources, missing, refused, reasons } =
        await resolveProgramLibrarySources(this.program);
      if (missing.length || refused.length) {
        // ONE WORDING, TWO DOORS. What survives to here is what only the text
        // itself can settle, and the Workshop's Import score reaches it by
        // the same road — so the phrasing is describeImportFailure's, not a
        // status line this room writes for itself.
        return this.refuseWith(this.refuse(unloadableLibrarySourcesError({
          absent: missing,
          unreadable: refused,
          reasons
        })));
      }
      if (!sources.length) {
        return this.refuseWith(this.refuse(noLibrarySourcesError()));
      }

      assertResolvedProgramQuotations(this.program, sources);

      const projectId = this.projectId || this.mintId();
      this.projectId = projectId;

      const project = workshopProjectFromImportedProgram({
        program: this.program,
        context: this.context,
        sources,
        // CARRIED, NOT LOOKED UP. A sequence asset is validated against the
        // assets the reading holds, so a score that names one the project does
        // not carry is refused at compile — which is what an empty array here
        // guaranteed for anything the reader had added.
        assets: await this.assetsFor(projectId),
        // The pace the room quoted, so the reading opens at the number the
        // reader was shown rather than at this function's default.
        defaults: { reading: { wpm: this.wpm } },
        title: this.intent.trim().slice(0, 80) || this.program.id,
        intent: 'custom',
        id: projectId,
        provenance: { kind: 'live-curator-import', room: 'scriptorium' }
      });
      this.status = 'Ready to read.';
      return { ok: true, project, verdict: this.verdict, sources };
    } catch (error) {
      return this.refuseWith(this.refuse(error));
    }
  }

  async readOperations() {
    this.status = 'Applying operations…';
    try {
      const { sources, missing, refused, reasons } =
        await resolveOperationLibrarySources(this.operationSet);
      if (missing.length || refused.length) {
        return this.refuseWith(this.refuse(unloadableLibrarySourcesError({
          absent: missing,
          unreadable: refused,
          reasons
        })));
      }
      const resolvedSources = Object.fromEntries(sources.map(source => [source.id, source]));
      const produced = await runProducer({
        project: emptyWorkshopProject({
          id: this.operationSet.projectId,
          title: this.intent.trim().slice(0, 80) || this.operationSet.id,
          intent: 'custom'
        }),
        operationSet: this.operationSet,
        context: this.context,
        resolvedSources,
        render: false
      });
      this.producer = produced;
      this.status = 'Ready to read.';
      return { ok: true, project: produced.project, verdict: this.verdict, sources };
    } catch (error) {
      return this.refuseWith(this.refuse(error));
    }
  }

  /** The reader's own files, ready for a project to name them. */
  async assetsFor(projectId) {
    if (!this.materials.length) return [];
    if (!this.prepareAssets) return this.materials;
    return this.prepareAssets(projectId, this.materials);
  }

  /**
   * What the reader is handed back, from the one function that phrases it.
   *
   * A code as well as the prose: the prose is for a person and the code is
   * what a script can branch on (see scriptorium-cli.js), and deriving the
   * second from the first is how a refusal becomes a string match.
   */
  refuse(error) {
    this.verdict = {
      ok: false,
      kind: null,
      code: error?.code || 'UNKNOWN',
      text: describeImportFailure(error, { context: this.context }),
      // THE IDS, BESIDE THE PROSE. The typed errors already carry the
      // offending ids; a surface that had to grep the reply for them would be
      // asserting on wording, which is the thing every refusal code exists to
      // make unnecessary.
      details: error?.details || {}
    };
    this.status = isRefusal(error) ? 'Refused.' : (error?.message || 'Refused.');
    return this.verdict;
  }

  refuseWith(verdict) {
    return { ok: false, project: null, verdict, sources: [] };
  }
}
