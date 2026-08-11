/**
 * The Scriptorium — a room where a score is written from dictation.
 *
 * Intent and length → take prompt + context → paste score → verdict →
 * an account of what the score does → read it, or keep it. RISE calls no
 * model; the reader carries documents by hand (SCRIPTORIUM-SPEC).
 *
 * The room does not hand off to the Workshop. A score arrives finished and
 * bound in progress coordinates; the Workshop edits character spans by hand.
 * Routing one through the other would convert the anchors to enable editing
 * the room exists to make unnecessary (SCRIPTORIUM-SPEC §10b).
 */

import { MemoryCore } from '../core/memory.js';
import {
  exportCuratorContext,
  serializeCuratorContext
} from '../core/curator-context.js';
import { buildCuratorPrompt } from '../core/curator-prompt.js';
import { describeProgramRundown, estimateRundownMinutes } from '../core/program-rundown.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import {
  describeImportFailure,
  downloadJsonFile,
  downloadTextFile,
  ExperienceProgramIoError,
  parseExperienceProgramJson,
  workshopProjectFromImportedProgram
} from '../core/experience-program-io.js';
import { ExperienceProgramValidationError } from '../core/experience-program.js';
import {
  previewProgramChoices,
  resolveProgramLibrarySources,
  assertResolvedProgramQuotations
} from '../core/scriptorium-resolve.js';
import { SourceSpanResolutionError } from '../core/source-span.js';
import { escapeHtml } from '../core/sanitize.js';
import './Scriptorium.css';

async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

const DEFAULT_TARGET_WORDS = 20_000;
const TARGET_WORDS_MIN = 1_000;
const TARGET_WORDS_STEP = 1_000;

/**
 * Minutes are shown and words are sent.
 *
 * A model can add words up from the library it was handed; it cannot turn
 * minutes back into words without a pace and a chunk mode. And a program can
 * score its own pace now, so the minutes below are what this length comes to
 * at the reader's CURRENT setting — a reading that slows itself will run
 * longer, which is the score doing its job rather than the estimate failing.
 */
function clampTargetWords(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_TARGET_WORDS;
  return Math.max(TARGET_WORDS_MIN, Math.min(READING_LIMITS.maxAtoms, parsed));
}

function readerWpm() {
  return Number(globalThis.rise?.settings?.wpm) || 320;
}

function describeLength(words) {
  const wpm = readerWpm();
  const minutes = Math.round(words / wpm);
  const clock = minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
    : `${minutes} min`;
  return `${words.toLocaleString()} words — about ${clock} at ${wpm} wpm`;
}

export class Scriptorium {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onCreateSession = options.onCreateSession || null;
    this.intent = '';
    this.targetWords = DEFAULT_TARGET_WORDS;
    this.context = null;
    this.promptText = '';
    this.pasted = '';
    this.program = null;
    this.preview = null;
    this.rundown = null;
    this.verdict = null;
    this.status = '';
  }

  mount() {
    this.render();
    this.bind();
  }

  buildTakeArtifacts() {
    this.context = exportCuratorContext({
      id: `scriptorium-${Date.now()}`,
      sources: [],
      includeLibrary: true,
      constraints: { targetWords: this.targetWords }
    });
    this.promptText = buildCuratorPrompt({
      intent: this.intent,
      context: this.context
    });
  }

  renderRundown(rundown, preview) {
    const minutes = estimateRundownMinutes(rundown, readerWpm());
    const lane = (title, rows, empty) => `
      <p class="scriptorium-note"><strong>${title}</strong></p>
      ${rows.length ? `<ul class="scriptorium-track-list">${rows.map(row => `
        <li>${escapeHtml(row.description)} <span class="scriptorium-meta">${escapeHtml(row.span)}</span></li>
      `).join('')}</ul>` : `<p class="scriptorium-note">${empty}</p>`}`;

    return `
      <p class="scriptorium-note">
        ${rundown.totals.words != null ? `${rundown.totals.words.toLocaleString()} words` : 'Length unknown'}${minutes ? ` · about ${minutes} min` : ''} ·
        ${rundown.totals.movements} movement${rundown.totals.movements === 1 ? '' : 's'}
      </p>

      <p class="scriptorium-note"><strong>Movements</strong></p>
      <ul class="scriptorium-source-list">
        ${rundown.movements.map((movement, index) => `
          <li>
            <strong>${escapeHtml(movement.title || `Movement ${index + 1}`)}</strong>
            <span class="scriptorium-meta">${movement.sources.map(source =>
              escapeHtml(source.title) + (source.words != null ? ` · ${source.words.toLocaleString()} words` : '')
            ).join(' · ')}</span>
          </li>
        `).join('')}
      </ul>

      ${lane('Pace', rundown.pace,
        'Unscored — this reads at whatever pace you have set.')}
      ${lane('Imagery', rundown.visuals, 'None — a still ground.')}
      ${lane('Sound', rundown.audio, 'Silence.')}

      ${preview?.sources?.some(source => source.divisionsAuthored === false) ? `
        <p class="scriptorium-note scriptorium-meta">
          Some divisions here were measured by RISE rather than authored by the
          book.
        </p>` : ''}
    `;
  }

  render() {
    const preview = this.preview;
    const rundown = this.rundown;
    const verdict = this.verdict;
    this.container.innerHTML = `
      <div class="scriptorium" role="main">
        <header class="scriptorium-header">
          <button type="button" class="scriptorium-back" data-action="back">← Portal</button>
          <h1>The Scriptorium</h1>
          <p class="scriptorium-sub">
            You state an intent and a length. A hand outside the building writes
            a score. RISE examines it before admitting it. A score may arrange
            imagery and sound, and may set the reading's own pace — though what
            it sets is a default, and your controls stay above it.
          </p>
        </header>

        <section class="scriptorium-step" aria-labelledby="scriptorium-intent-title">
          <h2 id="scriptorium-intent-title">1. Intent</h2>
          <label class="scriptorium-label" for="scriptorium-intent">What should the reading be about?</label>
          <textarea id="scriptorium-intent" class="scriptorium-intent" rows="3"
            placeholder="A sequence about memory and loss.">${escapeHtml(this.intent)}</textarea>

          <label class="scriptorium-label" for="scriptorium-length">How long should it be?</label>
          <input id="scriptorium-length" class="scriptorium-length" type="range"
            min="${TARGET_WORDS_MIN}" max="${READING_LIMITS.maxAtoms}" step="${TARGET_WORDS_STEP}"
            value="${this.targetWords}"
            aria-describedby="scriptorium-length-readout">
          <p class="scriptorium-note" id="scriptorium-length-readout">${escapeHtml(describeLength(this.targetWords))}</p>
          <p class="scriptorium-note">
            A movement reads its source whole, so this is the sum of the works the
            score names. A score longer than this is refused, not trimmed.
          </p>
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-take-title">
          <h2 id="scriptorium-take-title">2. Take</h2>
          <p class="scriptorium-note">Copy the prompt; download or copy context.json. No network leaves RISE.</p>
          <div class="scriptorium-actions">
            <button type="button" class="btn-primary" data-action="prepare-take">Prepare prompt &amp; context</button>
            <button type="button" class="btn-secondary" data-action="copy-prompt" ${this.promptText ? '' : 'disabled'}>Copy prompt</button>
            <button type="button" class="btn-secondary" data-action="download-prompt" ${this.promptText ? '' : 'disabled'}>Download prompt</button>
            <button type="button" class="btn-secondary" data-action="copy-context" ${this.context ? '' : 'disabled'}>Copy context.json</button>
            <button type="button" class="btn-secondary" data-action="download-context" ${this.context ? '' : 'disabled'}>Download context.json</button>
          </div>
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-paste-title">
          <h2 id="scriptorium-paste-title">3. Paste</h2>
          <label class="scriptorium-label" for="scriptorium-paste">The score that came back</label>
          <textarea id="scriptorium-paste" class="scriptorium-paste" rows="12"
            spellcheck="false" placeholder='{ "schema": "rise.experience-program.v1", ... }'>${escapeHtml(this.pasted)}</textarea>
          <div class="scriptorium-actions">
            <button type="button" class="btn-primary" data-action="examine">Examine</button>
          </div>
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-verdict-title">
          <h2 id="scriptorium-verdict-title">4. Verdict</h2>
          ${verdict?.ok ? `
            <p class="scriptorium-ok">Accepted as a proposal.</p>
          ` : verdict?.text ? `
            <pre class="scriptorium-refusal" id="scriptorium-refusal">${escapeHtml(verdict.text)}</pre>
            <button type="button" class="btn-secondary" data-action="copy-refusal">Copy refusal</button>
          ` : `
            <p class="scriptorium-note">Nothing examined yet.</p>
          `}
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-preview-title">
          <h2 id="scriptorium-preview-title">5. The reading</h2>
          ${rundown ? this.renderRundown(rundown, preview) : `
            <p class="scriptorium-note">This appears after a score is accepted at the gate.</p>
          `}
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-accept-title">
          <h2 id="scriptorium-accept-title">6. Begin</h2>
          <p class="scriptorium-note">
            The score is complete as it stands. Reading it loads the works it
            names; keeping it saves a Vault draft you can return to. Neither
            passes through the Workshop, which is for readings you compose
            yourself.
          </p>
          <div class="scriptorium-actions">
            <button type="button" class="btn-primary" data-action="begin" ${this.program ? '' : 'disabled'}>Begin reading</button>
            <button type="button" class="btn-secondary" data-action="keep" ${this.program ? '' : 'disabled'}>Keep in the Vault</button>
          </div>
        </section>

        ${this.status ? `<p class="scriptorium-status" role="status">${escapeHtml(this.status)}</p>` : ''}
      </div>
    `;
    this.bind();
  }

  bind() {
    this.container.querySelector('[data-action="back"]')
      ?.addEventListener('click', () => this.onNavigate('portal'));

    this.container.querySelector('#scriptorium-intent')
      ?.addEventListener('input', (event) => {
        this.intent = event.target.value.slice(0, 2000);
      });

    this.container.querySelector('#scriptorium-length')
      ?.addEventListener('input', (event) => {
        this.targetWords = clampTargetWords(event.target.value);
        // The readout alone, not a re-render: this room rebuilds its whole
        // DOM, which would take the slider's focus away mid-drag.
        const readout = this.container.querySelector('#scriptorium-length-readout');
        if (readout) readout.textContent = describeLength(this.targetWords);
      });

    this.container.querySelector('[data-action="prepare-take"]')
      ?.addEventListener('click', () => {
        this.buildTakeArtifacts();
        this.status = 'Prompt and context ready.';
        this.render();
      });

    this.container.querySelector('[data-action="copy-prompt"]')
      ?.addEventListener('click', async () => {
        if (!this.promptText) return;
        const ok = await copyText(this.promptText);
        this.status = ok ? 'Prompt copied.' : 'Could not copy; download instead.';
        this.render();
      });

    this.container.querySelector('[data-action="download-prompt"]')
      ?.addEventListener('click', () => {
        if (!this.promptText) return;
        downloadTextFile('scriptorium-prompt.txt', this.promptText);
        this.status = 'Prompt downloaded.';
        this.render();
      });

    this.container.querySelector('[data-action="copy-context"]')
      ?.addEventListener('click', async () => {
        if (!this.context) return;
        const ok = await copyText(serializeCuratorContext(this.context));
        this.status = ok ? 'context.json copied.' : 'Could not copy; download instead.';
        this.render();
      });

    this.container.querySelector('[data-action="download-context"]')
      ?.addEventListener('click', () => {
        if (!this.context) return;
        downloadJsonFile(
          `${this.context.id || 'curator-context'}.curator-context.json`,
          serializeCuratorContext(this.context)
        );
        this.status = 'context.json downloaded.';
        this.render();
      });

    this.container.querySelector('#scriptorium-paste')
      ?.addEventListener('input', (event) => { this.pasted = event.target.value; });

    this.container.querySelector('[data-action="examine"]')
      ?.addEventListener('click', () => this.examine());

    this.container.querySelector('[data-action="copy-refusal"]')
      ?.addEventListener('click', async () => {
        if (!this.verdict?.text) return;
        const ok = await copyText(this.verdict.text);
        this.status = ok ? 'Refusal copied.' : 'Could not copy.';
        this.render();
      });

    this.container.querySelector('[data-action="begin"]')
      ?.addEventListener('click', () => { void this.begin(); });

    this.container.querySelector('[data-action="keep"]')
      ?.addEventListener('click', () => { void this.keep(); });
  }

  examine() {
    const text = this.container.querySelector('#scriptorium-paste')?.value ?? this.pasted;
    this.pasted = text;
    if (!this.context) this.buildTakeArtifacts();
    if (!text.trim()) {
      this.verdict = { ok: false, text: 'Nothing to examine — paste the score first.' };
      this.status = 'Nothing pasted.';
      this.render();
      return;
    }
    try {
      const program = parseExperienceProgramJson(text, { context: this.context });
      this.program = program;
      this.preview = previewProgramChoices(program, this.context);
      this.rundown = describeProgramRundown(program, this.context);
      this.verdict = { ok: true, text: null };
      this.status = 'Score accepted at the gate. Read what it does, then begin.';
    } catch (error) {
      this.program = null;
      this.preview = null;
      this.rundown = null;
      const textOut = describeImportFailure(error, { context: this.context });
      this.verdict = { ok: false, text: textOut };
      this.status = (error instanceof ExperienceProgramValidationError
        || error instanceof ExperienceProgramIoError)
        ? 'Refused.'
        : (error.message || 'Refused.');
    }
    this.render();
  }

  /** Load the works the score names and build the project it compiles from. */
  async resolveProject() {
    if (!this.program) return;
    this.status = 'Loading chosen works…';
    this.render();
    try {
      const { sources, missing, refused } = await resolveProgramLibrarySources(this.program);
      if (missing.length || refused.length) {
        this.status = `Could not load: ${[...missing, ...refused].join(', ')}`;
        this.render();
        return;
      }
      if (!sources.length) {
        this.status = 'The score names no Library sources to load.';
        this.render();
        return;
      }

      assertResolvedProgramQuotations(this.program, sources);

      return workshopProjectFromImportedProgram({
        program: this.program,
        context: this.context,
        sources,
        assets: [],
        title: this.intent.trim().slice(0, 80) || this.program.id,
        intent: 'custom',
        id: `scriptorium-${Date.now()}`,
        provenance: { kind: 'live-curator-import', room: 'scriptorium' }
      });
    } catch (error) {
      this.verdict = {
        ok: false,
        text: describeImportFailure(error, { context: this.context })
      };
      this.status = (error instanceof ExperienceProgramValidationError
        || error instanceof ExperienceProgramIoError
        || error instanceof SourceSpanResolutionError)
        ? 'Refused.'
        : (error.message || 'Refused.');
      this.render();
      return null;
    }
  }

  /**
   * Read it now. The score carries its own imagery, sound and pace, so there
   * is nothing left to configure — which is the room's whole argument for not
   * routing through the Workshop.
   *
   * A project rather than a bare config because that is what carries the
   * canonical program through to the compiler, and `handleCreateSession`
   * already accepts either.
   */
  async begin() {
    const project = await this.resolveProject();
    if (!project) return;
    if (!this.onCreateSession) {
      this.status = 'This room cannot start a reading here.';
      this.render();
      return;
    }
    this.status = 'Opening the reading…';
    this.render();
    await this.onCreateSession(project);
  }

  /** Keep it without reading it, and stay in the room. */
  async keep() {
    const project = await this.resolveProject();
    if (!project) return;
    const saved = await MemoryCore.saveWorkshopBlueprintAsync(project);
    this.status = saved?.id
      ? 'Kept in the Vault. It opens from there whenever you want it.'
      : 'Could not save the Vault draft.';
    this.render();
  }
}
