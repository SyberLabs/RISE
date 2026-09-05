/**
 * The Scriptorium — a room where a score is written from dictation.
 *
 * Intent and length → take prompt + context → paste score → verdict →
 * an account of what the score does → read it, or keep it. RISE calls no
 * model; the reader carries documents by hand
 * (docs/vision/SCRIPTORIUM-SPEC.md §9).
 *
 * The room does not hand off to the Workshop. A score arrives finished and
 * bound in progress coordinates; the Workshop edits character spans by hand.
 * Routing one through the other would convert the anchors to enable editing
 * the room exists to make unnecessary (docs/vision/SCRIPTORIUM-SPEC.md §10b).
 *
 * THIS ROOM DOES NOT OWN THE SEQUENCE. It owns a document: markup, listeners,
 * object URLs, the clipboard, the Vault write, and the reader's files on their
 * way into IndexedDB. The five steps live in ScriptoriumSession
 * (src/core/scriptorium-session.js), which the internal CLI and the test suite
 * drive through the same methods this file binds buttons to. Every piece of
 * state the sequence owns is read here through a getter rather than copied:
 * two copies of the intent, the length or the verdict is how one entrance
 * learns a new word and the other never hears it (law 5).
 */

import { MemoryCore } from '../core/memory.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { LocalWorks } from '../core/local-work-store.js';
import {
  describeMaterials,
  inspectMaterial,
  MATERIAL_ACCEPT,
  probeVideoDurationMs
} from '../core/materials.js';
import {
  createSequenceVisualAsset,
  SEQUENCE_ASSET_STORAGE_IDB,
  VISUAL_SCORE_COLORS
} from '../core/visual-score-lane.js';
import { ensureWorkshopAssetsDurable } from '../core/workshop-asset-durability.js';
import {
  catalogueTextIsSafe,
  serializeCuratorContext
} from '../core/curator-context.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import { estimateRundownMinutes } from '../core/program-rundown.js';
import {
  createScriptoriumSession,
  readerWpm,
  SCRIPTORIUM_LENGTH
} from '../core/scriptorium-session.js';
import {
  downloadJsonFile,
  downloadTextFile
} from '../core/experience-program-io.js';
import { escapeHtml, safeUrl } from '../core/sanitize.js';
import './Scriptorium.css';

async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

/** A file's size as a person reads it. */
function fileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export class Scriptorium {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onCreateSession = options.onCreateSession || null;
    this.onSettingsTransaction = options.onSettingsTransaction || (() => {});
    /**
     * The sequence, which this room renders rather than performs.
     *
     * `prepareAssets` is the one step of it that needs a browser: a staged
     * material carries a blob: URL belonging to this document and to nothing
     * after it, so the bytes are written to IndexedDB on the way into a
     * project. A surface with no store (the CLI) passes nothing and carries
     * the descriptors as they are.
     */
    this.session = createScriptoriumSession({
      getWpm: () => readerWpm(options.getSettings?.()),
      prepareAssets: (projectId) => this.durableMaterials(projectId)
    });
    this.materialBlobs = new Map();
    this.objectUrls = new Set();
    // Said where the reader is standing. A refusal about a file belongs beside
    // the panel that took it, not in a status line six sections further down a
    // page that scrolls.
    this.materialNotice = null;
    // Closed until asked for. A reader composing from the Library alone should
    // not have to decline an upload panel on the way past.
    this.materialsOpen = false;
  }

  // ── The sequence's state, read rather than copied ────────────────────────
  get intent() { return this.session.intent; }
  get targetWords() { return this.session.targetWords; }
  get lengthChosen() { return this.session.lengthChosen; }
  get materials() { return this.session.materials; }
  get swells() { return this.session.swells; }
  get localWorks() { return this.session.localWorks; }
  get context() { return this.session.context; }
  get promptText() { return this.session.promptText; }
  get pasted() { return this.session.pasted; }
  get program() { return this.session.program; }
  get operationSet() { return this.session.operationSet; }
  get proposalRows() { return this.session.proposalRows; }
  get preview() { return this.session.preview; }
  get rundown() { return this.session.rundown; }
  get verdict() { return this.session.verdict; }
  get projectId() { return this.session.projectId; }
  get producer() { return this.session.producer; }
  get status() { return this.session.status; }
  set status(value) { this.session.status = value; }

  mount() {
    // render() ends in bind(). Binding again here gave every control two
    // listeners, and loadMaterials() returns without re-rendering for a reader
    // with no personal swells — so one click on Examine examined twice and one
    // click on Keep left two Vault drafts.
    this.render();
    void this.loadMaterials();
  }

  update() {
    // Router reuses this room; estimates must reflect the current settings.
    this.render();
  }

  /**
   * A composer may name the reader's own audio.
   *
   * The store is asynchronous and the take is rebuilt on every slider move, so
   * the materials are read ONCE and held. A take built before they arrive is
   * correct and smaller; it is rebuilt when they land rather than blocking the
   * room on a database that may hold nothing.
   */
  /**
   * What this browser holds, offered to the sequence before it is composed.
   *
   * TWO STORES, TWO FAILURES. A reader with no IndexedDB and a reader with no
   * swells reach the same early return in one try block, and putting the
   * shelf inside it would let either one silently hide the other — the
   * Library door would simply have no local works in it and nothing would say
   * why. Each store is asked on its own, and the room renders if either
   * answered.
   */
  async loadMaterials() {
    const [swells, works] = await Promise.all([
      PersonalSwells.getAll().catch(error => {
        console.warn('[Scriptorium] Personal audio unavailable:', error);
        return [];
      }),
      LocalWorks.all().catch(error => {
        console.warn('[Scriptorium] Your own texts are unavailable:', error);
        return [];
      })
    ]);

    let arrived = false;
    if (Array.isArray(swells) && swells.length) {
      this.session.setSwells(swells);
      arrived = true;
    }
    for (const work of works) {
      try {
        this.session.addLocalWork(work);
        arrived = true;
      } catch (error) {
        // One malformed record must not cost the reader the rest of the shelf.
        console.warn('[Scriptorium] Skipped a local work:', error);
      }
    }
    if (!arrived) return;

    this.session.take();
    this.render();
  }

  /**
   * The reader's own works, named so a composer may be asked for one.
   *
   * Silence here would be the room's fault, not the reader's: the shelf is
   * already in the prompt whether or not this line renders, and a reader who
   * cannot see that their poems are on the table will never ask for them.
   * Named parts are what makes a work addressable, so the count is shown.
   */
  renderOwnTexts() {
    if (!this.localWorks.length) return '';
    const named = this.localWorks.map(work => {
      const parts = work.labels.length;
      return `<li>${escapeHtml(work.title)} <span class="scriptorium-meta">${
        parts === 1 ? 'whole' : `${parts} parts`
      }</span></li>`;
    }).join('');
    return `
      <p class="scriptorium-note"><strong>Your own texts are on the table</strong></p>
      <ul class="scriptorium-source-list">${named}</ul>
      <p class="scriptorium-note">
        Ask for one by name in your intent and the composer may read from it
        the same way it reads from the shelf. Add or divide them in the
        Library, under Your Own Texts.
      </p>
    `;
  }

  renderRundown(rundown, preview) {
    const minutes = estimateRundownMinutes(rundown, this.session.wpm);
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

  /**
   * The notice, in two voices.
   *
   * A refusal and a confirmation used to be the same grey as each other and
   * as the two explanatory paragraphs bracketing them, so the one line saying
   * something HAD JUST HAPPENED was the third of three identical paragraphs.
   * `role="status"` was always right; this is the visible half of it.
   */
  materialNoticeMarkup() {
    return (this.materialNotice || []).map(line => `
      <span class="scriptorium-material-line scriptorium-material-${
        line.tone === 'refused' ? 'refused' : 'taken'
      }">${escapeHtml(line.text)}</span>
    `).join('');
  }

  /**
   * A picture of the file, not a description of one.
   *
   * The object URL was already minted for every staged file — held only so
   * `dropMaterial` could revoke it — while the panel rendered no image at all.
   *
   * ABSENT, NEVER BROKEN. A video shows its own first frame where the browser
   * will decode one and an unadorned labelled tile where it will not; an image
   * whose blob has gone (a URL revoked, a descriptor rehydrated without one)
   * falls back to the same tile rather than to a broken-image glyph. The
   * thumbnails are decorative — the filename beside them is the accessible
   * name — so they are hidden from assistive technology rather than announced
   * twice.
   */
  renderMaterialThumbnail(item) {
    const src = safeUrl(item.uri);
    if (!src) {
      return `<span class="scriptorium-material-thumb scriptorium-material-thumb-absent"
        aria-hidden="true">${item.kind === 'video' ? 'video' : 'image'}</span>`;
    }
    if (item.kind === 'video') {
      return `<span class="scriptorium-material-thumb scriptorium-material-thumb-video"
        aria-hidden="true"><video src="${src}" muted playsinline
        preload="metadata"></video><span class="scriptorium-material-badge">video</span></span>`;
    }
    return `<img class="scriptorium-material-thumb" src="${src}" alt="" aria-hidden="true">`;
  }

  /**
   * One staged file, as a reader needs to meet it.
   *
   * WHAT THIS LINE USED TO SAY was ` · asset-5e2b0776-8781-4fe1-acdc-…`: a
   * leading separator with nothing before it, because `kind` is only set on a
   * video descriptor, followed by an internal identifier presented as though
   * it were a fact about the photograph. The id does belong here — it is how
   * the composer will name the file in the score, and a reader reading a score
   * needs to match the two up — but it belongs labelled as that and set apart
   * from the file's own measurements.
   */
  renderMaterial(item) {
    const video = item.kind === 'video';
    const facts = [
      video ? 'Video' : 'Image',
      video && item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : '',
      fileSize(item.byteLength)
    ].filter(Boolean).join(' · ');
    const id = escapeHtml(item.id);
    return `
      <li class="scriptorium-material">
        ${this.renderMaterialThumbnail(item)}
        <div class="scriptorium-material-body">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="scriptorium-meta">${escapeHtml(facts)}</span>
          <span class="scriptorium-meta scriptorium-material-id">Named in the score:
            <code>${id}</code></span>
          <label class="scriptorium-material-describe" for="describe-${id}">
            What is this? <span class="scriptorium-material-optional">optional</span>
          </label>
          <input type="text" id="describe-${id}" class="scriptorium-material-description"
            data-action="describe-material" data-id="${id}"
            maxlength="${READING_LIMITS.maxMaterialDescriptionChars}"
            value="${escapeHtml(item.description || '')}"
            placeholder="The cliff path above the harbour, the morning after.">
        </div>
        <button type="button" class="btn-ghost btn-compact"
          data-action="drop-material" data-id="${id}"
          aria-label="Remove ${escapeHtml(item.name)}">Remove</button>
      </li>
    `;
  }

  renderProposal(rows) {
    return `
      <p class="scriptorium-note">
        ${rows.length} proposed operation${rows.length === 1 ? '' : 's'} against
        revision ${escapeHtml(String(this.operationSet?.baseRevision ?? 0))}.
        Pending acquisitions cannot execute. Rationale never enters the score.
      </p>
      <ul class="scriptorium-track-list">
        ${rows.map(row => `
          <li>
            <strong>${escapeHtml(row.op)}</strong>
            <span class="scriptorium-meta">${escapeHtml(row.status)}${
              row.sourceId ? ` · ${escapeHtml(row.sourceId)}` : ''
            }${row.assetId ? ` · ${escapeHtml(row.assetId)}` : ''}</span>
            ${row.rationale ? `<span class="scriptorium-meta">${escapeHtml(row.rationale)}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  render() {
    const preview = this.preview;
    const rundown = this.rundown;
    const verdict = this.verdict;
    // A ROOM KEEPS ITS PLACE WHEN IT IS REDRAWN.
    //
    // `.scriptorium` IS the scroll container, and this replaces it wholesale,
    // so every action tore out the element holding the offset and rebuilt it
    // at the top: a reader who pressed anything was thrown back to the first
    // line. Measured at 787px of travel discarded on a single keystroke.
    const room = this.container.querySelector('.scriptorium');
    const standing = room ? room.scrollTop : 0;

    this.container.innerHTML = `
      <div class="scriptorium" role="main">
        <div class="scriptorium-column">
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
          <!-- NINE STOPS, NOT A THOUSAND. The native value is words so a
               fill of 6000 means 6,000 words; input snaps to the nearest
               rung and the session stores that word value. -->
          <input id="scriptorium-length" class="scriptorium-length" type="range"
            min="${SCRIPTORIUM_LENGTH.rungs[0]}"
            max="${SCRIPTORIUM_LENGTH.rungs[SCRIPTORIUM_LENGTH.rungs.length - 1]}"
            step="1"
            value="${this.targetWords}"
            aria-valuetext="${escapeHtml(this.session.describeLength())}"
            aria-describedby="scriptorium-length-readout">
          <p class="scriptorium-note" id="scriptorium-length-readout">${escapeHtml(this.session.describeLength())}</p>
          <p class="scriptorium-note">
            A movement reads a whole work, one of its divisions, or a division's
            opening — whichever is the largest that fits. A score longer than
            this is refused, not trimmed.
          </p>
          ${this.renderOwnTexts()}
        </section>

        <section class="scriptorium-step">
          <details class="scriptorium-materials" ${this.materialsOpen ? 'open' : ''}>
            <summary>
              <span>Add your own images or video</span>
              <span class="scriptorium-meta">${escapeHtml(describeMaterials(this.materials))}</span>
            </summary>
            <p class="scriptorium-note">
              Optional. These are yours rather than the Library's — RISE describes
              them to the composer rather than vouching for them, and they travel
              with this reading rather than joining the shelf.
            </p>
            <input type="file" id="scriptorium-materials-input" hidden multiple
              accept="${MATERIAL_ACCEPT}">
            <button type="button" class="btn-secondary" data-action="add-material">Choose files</button>
            ${this.materialNotice?.length ? `
              <p class="scriptorium-note scriptorium-material-notice" role="status">
                ${this.materialNoticeMarkup()}
              </p>
            ` : ''}
            ${this.materials.length ? `
              <ul class="scriptorium-material-list">
                ${this.materials.map(item => this.renderMaterial(item)).join('')}
              </ul>
              <p class="scriptorium-note">
                The composer is told each file's name, what kind of thing it is,
                and whatever you write above. A file you describe can be placed
                where the reading touches what you described; a file you leave
                alone is still used, just arranged wherever it fits. Saying
                nothing costs nothing.
              </p>
            ` : ''}
          </details>
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
            spellcheck="false" placeholder='{ "schema": "rise.experience-program.v1" } or rise.agent-operation-set.v1'>${escapeHtml(this.pasted)}</textarea>
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
          ${rundown ? this.renderRundown(rundown, preview) : this.proposalRows ? this.renderProposal(this.proposalRows) : `
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
            <button type="button" class="btn-primary" data-action="begin" ${this.program || this.operationSet ? '' : 'disabled'}>Begin reading</button>
            <button type="button" class="btn-secondary" data-action="keep" ${this.program || this.operationSet ? '' : 'disabled'}>Keep in the Vault</button>
          </div>
        </section>

        ${this.status ? `<p class="scriptorium-status" role="status">${escapeHtml(this.status)}</p>` : ''}
        </div>
      </div>
    `;

    // Put them back where they were standing. After innerHTML this is a new
    // element, so the offset has to be carried across rather than kept.
    if (standing > 0) {
      const rebuilt = this.container.querySelector('.scriptorium');
      if (rebuilt) rebuilt.scrollTop = standing;
    }
    this.bind();
  }

  bind() {
    this.container.querySelector('[data-action="back"]')
      ?.addEventListener('click', () => this.onNavigate('portal'));

    this.container.querySelector('#scriptorium-intent')
      ?.addEventListener('input', (event) => {
        this.session.setIntent(event.target.value);
      });

    this.container.querySelector('#scriptorium-length')
      ?.addEventListener('input', (event) => {
        this.session.setTargetWords(event.target.value);
        event.target.value = String(this.session.targetWords);
        // The readout alone, not a re-render: this room rebuilds its whole
        // DOM, which would take the slider's focus away mid-drag.
        const readout = this.container.querySelector('#scriptorium-length-readout');
        if (readout) readout.textContent = this.session.describeLength();
        // A range reads its value aloud as a bare number, and the number here
        // is an index into a ladder — "3" tells a screen reader nothing.
        event.target.setAttribute('aria-valuetext', this.session.describeLength());
      });

    // COMMIT, NOT DRAG. The budget the gate measures against lives in the
    // context document, which was built once and never rebuilt — so a reader
    // who raised the length and pressed Examine was refused against the old
    // number, and told to raise the length. Rebuilt here so the prompt and the
    // context.json they copy carry the length on the slider, and rebuilt again
    // in examine() because that is the other door into the gate.
    this.container.querySelector('#scriptorium-length')
      ?.addEventListener('change', () => {
        if (this.context) this.session.take();
      });

    this.container.querySelector('[data-action="prepare-take"]')
      ?.addEventListener('click', () => {
        this.session.take();
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
      ?.addEventListener('input', (event) => { this.session.pasted = event.target.value; });

    this.container.querySelector('[data-action="examine"]')
      ?.addEventListener('click', () => this.examine());

    this.container.querySelector('[data-action="copy-refusal"]')
      ?.addEventListener('click', async () => {
        if (!this.verdict?.text) return;
        const ok = await copyText(this.verdict.text);
        this.status = ok ? 'Refusal copied.' : 'Could not copy.';
        this.render();
      });

    const materialsInput = this.container.querySelector('#scriptorium-materials-input');
    materialsInput?.addEventListener('change', (event) => {
      // COPY BEFORE CLEARING. `event.target.files` is a live FileList, not a
      // snapshot: emptying the input empties the same object, so passing it on
      // handed addMaterials zero files and every upload did nothing at all.
      // A File outlives the FileList it came from; the list does not.
      const files = [...(event.target.files || [])];
      event.target.value = '';
      void this.addMaterials(files);
    });

    this.container.querySelector('[data-action="add-material"]')
      ?.addEventListener('click', () => materialsInput?.click());

    this.container.querySelector('.scriptorium-materials')
      ?.addEventListener('toggle', (event) => {
        this.materialsOpen = event.target.open === true;
      });

    for (const button of this.container.querySelectorAll('[data-action="drop-material"]')) {
      button.addEventListener('click', () => this.dropMaterial(button.dataset.id));
    }

    // A THUMBNAIL THAT CANNOT LOAD BECOMES ABSENT, NOT BROKEN. A revoked or
    // stale blob: URL otherwise leaves the browser's own broken-image glyph in
    // a panel of the reader's photographs.
    for (const img of this.container.querySelectorAll('img.scriptorium-material-thumb')) {
      img.addEventListener('error', () => {
        img.removeAttribute('src');
        img.classList.add('scriptorium-material-thumb-absent');
      });
    }

    // TYPING IS NOT COMMITTING. `render()` rebuilds this room's whole DOM, so
    // doing it per keystroke would take focus out of the field mid-sentence —
    // the defect the length slider above carries a comment about. The
    // descriptor is updated on every keystroke because that is cheap and
    // cannot be seen; the capability document is rebuilt on commit, because
    // it is neither.
    for (const input of this.container.querySelectorAll('[data-action="describe-material"]')) {
      input.addEventListener('input', () => {
        this.describeMaterial(input.dataset.id, input.value);
      });
      input.addEventListener('change', () => {
        const outcome = this.describeMaterial(input.dataset.id, input.value);
        if (outcome === 'unknown') return;
        if (outcome === 'refused') {
          const held = this.materials.find(item => item.id === input.dataset.id);
          this.announceMaterials([{
            tone: 'refused',
            text: `A description is prose, not a link — RISE will not carry a web `
              + `address into the score. Say what ${held?.name || 'the file'} IS instead.`
          }]);
          return;
        }
        this.session.take();
        this.announceMaterials([{
          tone: 'taken',
          text: outcome === 'cleared'
            ? 'Description removed. Take the prompt again.'
            : 'Description saved — the composer will be told it. Take the prompt again.'
        }]);
      });
    }

    this.container.querySelector('[data-action="begin"]')
      ?.addEventListener('click', () => { void this.begin(); });

    this.container.querySelector('[data-action="keep"]')
      ?.addEventListener('click', () => { void this.keep(); });
  }

  /** The gate, said out loud. The verdict itself is the session's. */
  examine() {
    this.session.examine(
      this.container.querySelector('#scriptorium-paste')?.value ?? this.pasted
    );
    this.render();
  }

  /**
   * Load the works the score names, and show what is happening while it runs.
   *
   * The room's whole contribution is the two renders. `read()` sets its status
   * before its first await, so the frame below is painted with "Loading chosen
   * works…" on it without that function knowing this room paints at all.
   */
  async resolveProject() {
    const reading = this.session.read();
    this.render();
    const { project } = await reading;
    this.render();
    return project;
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
    this.openOnReadableType();
    await this.onCreateSession(project);
  }

  /**
   * A SCORE'S READING OPENS LEGIBLE.
   *
   * This room offers no type controls — a score carries its imagery, its
   * sound and its pace, and that is the room's whole argument for not routing
   * through the Workshop. But face and size are the READER's settings,
   * carried in from wherever they were last set. A reader arriving from a Fit
   * mask brings Thick + Fit with them, the mask engages over imagery the
   * score never promised for the letters, and the reading opens with no
   * visible word at all. Measured: an empty atom, is-mask true.
   *
   * So the reading opens on the traditional face at a fixed scale. Glass
   * needs nothing said about it: a score already sets streamGlass, and
   * glassCanApply refuses only while a mask or a Fit word holds the frame —
   * both of which leave with the size.
   */
  openOnReadableType() {
    const settings = { chamberFace: 'literary', fontSize: 'medium' };
    this.onSettingsTransaction(settings);
  }

  /**
   * Take a file the reader chose.
   *
   * Refusals are stated rather than swallowed: a file too large or of a kind
   * a reading cannot carry says which, because the reader is the only one who
   * can do anything about it.
   */
  async addMaterials(files) {
    const chosen = [...(files || [])];
    if (!chosen.length) return;
    const refused = [];

    for (const file of chosen) {
      const verdict = inspectMaterial(file, { held: this.materials.length });
      if (!verdict.ok) {
        refused.push(verdict.reason);
        continue;
      }
      let durationMs = null;
      if (verdict.kind === 'video') {
        try {
          durationMs = await probeVideoDurationMs(file);
        } catch {
          refused.push(`Could not read ${file.name}.`);
          continue;
        }
      }
      const id = `asset-${crypto.randomUUID()}`;
      const uri = URL.createObjectURL(file);
      this.objectUrls.add(uri);
      this.materialBlobs.set(id, file);
      this.session.addMaterial(createSequenceVisualAsset({
        id,
        name: file.name,
        kind: verdict.kind === 'video' ? 'video' : 'image',
        storage: SEQUENCE_ASSET_STORAGE_IDB,
        mimeType: file.type,
        byteLength: file.size,
        uri,
        ...(durationMs ? { durationMs } : {}),
        color: VISUAL_SCORE_COLORS[this.materials.length % VISUAL_SCORE_COLORS.length]
      }));
    }

    const taken = chosen.length - refused.length;
    this.materialsOpen = true;
    // The capability document is stale the moment the materials change, and a
    // reader who already copied the prompt must be told to take it again.
    this.session.take();
    // BOTH, NOT WHICHEVER CAME LAST. A refusal used to replace the notice, so
    // a reader who added ok.png and notes.pdf together got a changed capability
    // document, no word about re-exporting, and handed the model a context that
    // did not name their image.
    this.materialNotice = [
      ...refused.map(text => ({ tone: 'refused', text })),
      ...(taken
        ? [{
          tone: 'taken',
          text: `${describeMaterials(this.materials)} added. Take the prompt again.`
        }]
        : [])
    ];
    this.status = '';
    this.render();
  }

  /**
   * The reader's own words about one file they added.
   *
   * A SEPARATE FIELD, NOT `provenance`. Provenance survives the round trip
   * already, which makes it the tempting place to put this, and it is
   * load-bearing: a reader should always be able to tell whether they are
   * meeting a received text or one written here. Folding "what this is" into
   * "where this came from" would spend that distinction to save a field.
   *
   * @returns {'stored'|'cleared'|'refused'|'unknown'}
   */
  describeMaterial(id, text) {
    const held = this.materials.find(item => item.id === id);
    if (!held) return 'unknown';
    // BOUNDED, NOT REFUSED, FOR LENGTH. The field carries the same number as a
    // `maxlength`, so a reader typing or pasting cannot exceed it and only a
    // programmatic caller can — and telling THEM off would leave the reader
    // with an unexplained empty description. A URI is the other half of the
    // catalogue's rule and is a refusal, because silently deleting a sentence
    // the reader wrote is worse than declining it out loud.
    const description = String(text ?? '').trim()
      .slice(0, READING_LIMITS.maxMaterialDescriptionChars);
    // ASKED HERE, ENFORCED AT THE DOCUMENT. `boundedText` refuses a URI when
    // the context is built, which is correct and is several steps away from
    // this field — a reader who pasted a link would learn about it at Prepare
    // prompt, in a refusal naming neither the file nor the sentence. Same rule,
    // asked early enough to answer.
    if (description && !catalogueTextIsSafe(description)) return 'refused';
    if (description === (held.description || '')) {
      return description ? 'stored' : 'cleared';
    }
    this.session.setMaterials(this.materials.map(item => item.id === id
      ? createSequenceVisualAsset({ ...item, description })
      : item));
    return description ? 'stored' : 'cleared';
  }

  /**
   * Say it without rebuilding the room.
   *
   * The reader may be standing in a description field when this fires, and
   * `render()` replaces every node in the panel — see the length slider's
   * readout, which is patched in place for exactly this reason. A full render
   * is the fallback for the case where there is no notice element to patch.
   */
  announceMaterials(lines) {
    this.materialNotice = lines;
    const notice = this.container.querySelector('.scriptorium-material-notice');
    if (!notice) {
      this.render();
      return;
    }
    notice.innerHTML = this.materialNoticeMarkup();
  }

  dropMaterial(id) {
    const held = this.session.dropMaterial(id);
    if (!held) return;
    if (held.uri) {
      URL.revokeObjectURL(held.uri);
      this.objectUrls.delete(held.uri);
    }
    this.materialBlobs.delete(id);
    this.materialsOpen = true;
    this.session.take();
    this.materialNotice = [
      { tone: 'taken', text: `Removed. ${describeMaterials(this.materials)}.` },
      { tone: 'taken', text: 'Take the prompt again.' }
    ];
    this.status = '';
    this.render();
  }

  /**
   * The reader's files, in the store, before the project names them.
   *
   * A staged material carries a blob: URL belonging to this document and to
   * nothing after it, and persistence strips it — correctly, see
   * sequenceAssetForPersistence. Nothing in this room ever wrote the bytes, so
   * the project pointed at IndexedDB records that had never been created: the
   * gate accepted, section 5 listed the imagery, and Begin opened a still
   * ground over "no longer stored" — of a file added thirty seconds earlier.
   * The Workshop has always called this on the way to persistence.
   */
  async durableMaterials(projectId) {
    if (!this.materials.length) return [];
    try {
      return await ensureWorkshopAssetsDurable(projectId, this.materials, this.materialBlobs);
    } catch (error) {
      // A store that will not take the bytes is not a reason to withhold the
      // text. The references travel, hydration finds nothing, and the reader
      // is told the imagery is absent — which by then is true.
      console.warn('[Scriptorium] Could not store the files the reader added:', error);
      return this.materials;
    }
  }

  /**
   * Leaving the room releases the reader's files.
   *
   * Every staged material holds an object URL, and the router calls this on
   * the way out. Without it a reader who added nine landscapes and changed
   * their mind left nine blobs pinned for the life of the tab.
   */
  destroy() {
    for (const uri of this.objectUrls) URL.revokeObjectURL(uri);
    this.objectUrls.clear();
    this.materialBlobs.clear();
    this.session.setMaterials([]);
  }

  /** Keep it without reading it, and stay in the room. */
  async keep() {
    const project = await this.resolveProject();
    if (!project) return;
    // WITH THE BYTES. Without them durability found nothing in the store,
    // warned to the console, and saved the dangling reference — and the room
    // then told the reader it opens from the Vault whenever they want it.
    // Closing the tab made that permanent.
    const saved = await MemoryCore.saveWorkshopBlueprintAsync(project, {
      blobs: this.materialBlobs
    });
    this.status = saved?.id
      ? 'Kept in the Vault. It opens from there whenever you want it.'
      : 'Could not save the Vault draft.';
    this.render();
  }
}
