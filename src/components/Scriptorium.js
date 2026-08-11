/**
 * The Scriptorium — a room where a score is written from dictation.
 *
 * Intent → take prompt + context → paste score → verdict → preview →
 * accept as a proposed Vault draft. RISE calls no model; the reader
 * carries documents by hand (SCRIPTORIUM-SPEC).
 */

import { MemoryCore } from '../core/memory.js';
import {
  exportCuratorContext,
  serializeCuratorContext
} from '../core/curator-context.js';
import { buildCuratorPrompt } from '../core/curator-prompt.js';
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

function describeLength(words) {
  const wpm = Number(globalThis.rise?.settings?.wpm) || 320;
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
    this.intent = '';
    this.targetWords = DEFAULT_TARGET_WORDS;
    this.context = null;
    this.promptText = '';
    this.pasted = '';
    this.program = null;
    this.preview = null;
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

  render() {
    const preview = this.preview;
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
          <h2 id="scriptorium-preview-title">5. Preview</h2>
          ${preview ? `
            <p class="scriptorium-note">Sources the score asked for (loaded only if you accept):</p>
            <ul class="scriptorium-source-list">
              ${preview.sources.map(source => `
                <li>
                  <strong>${escapeHtml(source.title)}</strong>
                  <span class="scriptorium-meta">${escapeHtml(source.id)}${source.author ? ` · ${escapeHtml(source.author)}` : ''}${source.words != null ? ` · ${source.words.toLocaleString()} words` : ''}${source.divisionsAuthored === false ? ' · RISE-measured divisions' : (source.divisionsTitled ? '' : (source.divisionsAuthored ? ' · numbered divisions' : ''))}</span>
                </li>
              `).join('')}
            </ul>
            <p class="scriptorium-note">Tracks:</p>
            <ul class="scriptorium-track-list">
              ${preview.tracks.map(track => `
                <li>${escapeHtml(track.kind)} · ${track.clipCount} clip${track.clipCount === 1 ? '' : 's'}</li>
              `).join('')}
            </ul>
          ` : `
            <p class="scriptorium-note">Preview appears after a score is accepted at the gate.</p>
          `}
        </section>

        <section class="scriptorium-step" aria-labelledby="scriptorium-accept-title">
          <h2 id="scriptorium-accept-title">6. Accept</h2>
          <p class="scriptorium-note">Loads chosen Library works, saves a proposed Vault draft, opens the Workshop.</p>
          <button type="button" class="btn-primary" data-action="accept" ${this.program ? '' : 'disabled'}>Accept into Vault</button>
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

    this.container.querySelector('[data-action="accept"]')
      ?.addEventListener('click', () => { void this.accept(); });
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
      this.verdict = { ok: true, text: null };
      this.status = 'Score accepted at the gate. Review the preview, then accept.';
    } catch (error) {
      this.program = null;
      this.preview = null;
      const textOut = describeImportFailure(error, { context: this.context });
      this.verdict = { ok: false, text: textOut };
      this.status = (error instanceof ExperienceProgramValidationError
        || error instanceof ExperienceProgramIoError)
        ? 'Refused.'
        : (error.message || 'Refused.');
    }
    this.render();
  }

  async accept() {
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

      const project = workshopProjectFromImportedProgram({
        program: this.program,
        context: this.context,
        sources,
        assets: [],
        title: this.intent.trim().slice(0, 80) || this.program.id,
        intent: 'custom',
        id: `scriptorium-${Date.now()}`,
        provenance: { kind: 'live-curator-import', room: 'scriptorium' }
      });

      const saved = await MemoryCore.saveWorkshopBlueprintAsync(project);
      if (!saved?.id) {
        this.status = 'Could not save the Vault draft.';
        this.render();
        return;
      }
      this.status = 'Saved as a proposed Vault draft.';
      this.onNavigate('workshop', { blueprintId: saved.id });
    } catch (error) {
      this.verdict = {
        ok: false,
        text: describeImportFailure(error, { context: this.context })
      };
      this.status = (error instanceof ExperienceProgramValidationError
        || error instanceof ExperienceProgramIoError
        || error instanceof SourceSpanResolutionError)
        ? 'Refused.'
        : (error.message || 'Accept refused.');
      this.render();
    }
  }
}
