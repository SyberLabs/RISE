/**
 * Face, Size, Ink, specimen, and the dialogs that gate text-material changes.
 */
import { escapeHtml, safeUrl } from '../../core/sanitize.js';
import { CHAMBER_STREAM_FACES, resolveChamberStreamFace } from '../../core/chamber-stream-face.js';
import {
  FONT_SIZE_CHIPS,
  SIZE_HINT_FIT,
  persistFontSize,
  resolveFontSize,
  threeStepIntent
} from '../../core/chamber-type-size.js';
import { resolveTextMaterialCapability } from '../../core/chamber-text-material.js';
import { WORD_FILL_PROCEDURAL_PATTERNS } from '../../core/visual-registry.js';
import { normalizeWordFill } from '../../core/visual-selection.js';
import { configPatch } from '../../core/visual-taxonomy-config.js';
// The runtime's own rule for what sits behind an ink inside the glyph.
import { maskGroundFromConfig } from '../../core/mask-ground.js';
import { leafById } from '../../core/visual-taxonomy.js';
import { normalizeGalleryCadence } from '../../core/visual-presence.js';
import {
  MASK_REASON,
  bench,
  glyphFor,
  wordFillValue,
  inkPoolFamilies
} from './markup.js';

export const textMethods = {
  textMaterialSettings() {
    const settings = this.getSettings();
    return {
      face: resolveChamberStreamFace(settings?.chamberFace),
      fontSize: resolveFontSize(settings?.fontSize)
    };
  },

  textMaterialCapability(wordFill = this.selection.wordFill, settings = this.textMaterialSettings()) {
    const gallery = this._fieldPresentsGallery();
    return resolveTextMaterialCapability({
      face: settings.face,
      fontSize: settings.fontSize,
      chunkMode: 'word',
      visualMode: gallery ? 'interlocution' : 'off',
      presentation: gallery ? 'continuous' : 'full-frame',
      wordFill,
      programOwned: Boolean(this.programInfo)
    });
  },

  hasActiveMask() {
    return this.textMaterialCapability().maskActive;
  },

  requestTextMaterialTransaction({ face, fontSize, wordFill, temporal = null, settings = null }) {
    const next = normalizeWordFill(wordFill);
    this.selection.wordFill = next;
    const visualConfig = configPatch(this.selection);
    this.selection.config = visualConfig;
    this.onTextMaterialTransaction({
      settings: settings || { chamberFace: face, fontSize },
      temporal,
      visualConfig
    });
  },

  openDialog(dialog, returnFocus = document.activeElement) {
    this.dialog = dialog;
    this._dialogReturnFocusSelector = [
      'data-chamber-face',
      'data-font-size',
      'data-word-fill',
      'data-word-fill-border'
    ].map(attribute => {
      const value = returnFocus?.getAttribute?.(attribute);
      return value == null ? null : `[${attribute}=${JSON.stringify(value)}]`;
    }).find(Boolean) || null;
    this.render();
    queueMicrotask(() => this.container.querySelector('[data-dialog-primary]')?.focus());
  },

  closeDialog() {
    const returnFocusSelector = this._dialogReturnFocusSelector;
    this.dialog = null;
    this._dialogReturnFocusSelector = null;
    this.render();
    const returnFocus = this.container.querySelector(returnFocusSelector);
    if (!returnFocus) return;
    this._restoringDialogFocus = true;
    returnFocus.focus();
    this._restoringDialogFocus = false;
  },

  explainProgramOwnership(returnFocus) {
    this.openDialog({
      title: 'This text material is owned by the curated program.',
      body: 'The curated program controls its text material for this reading.',
      primaryLabel: 'Close',
      confirm: () => this.closeDialog()
    }, returnFocus);
  },

  confirmFieldReplacement({ fontSize, settings, returnFocus }) {
    const held = [...this.selection.enabled]
      .map(id => leafById(id)?.label)
      .filter(Boolean);
    this.openDialog({
      title: 'Fit paints the letters from a continuous field.',
      body: `${held.length ? held.join(' and ') : 'This field'} draws the room in its own `
        + 'mode, which leaves no continuous field to paint from — whatever the ink is set to. '
        + 'Taking Fit sets it aside. The reading keeps everything else.',
      primaryLabel: 'Set it aside',
      primaryAction: 'replace-field-for-fit',
      confirm: () => {
        this.selection.enabled = new Set();
        this.selection.emptyKind = 'held-empty';
        this.selection.config = { ...this.selection.config, interlocution: {} };
        this.requestTextMaterialTransaction({
          face: settings.face,
          fontSize,
          wordFill: this.selection.wordFill,
          temporal: { chunkMode: 'word', recitation: false },
          settings: { chamberFace: settings.face, fontSize, chamberMask: false }
        });
        this.closeDialog();
      }
    }, returnFocus);
  },

  explainBlockedMask(wordFill, returnFocus) {
    // NAME EVERYTHING THAT IS MISSING, BECAUSE THE REMEDY FIXES ALL OF IT.
    //
    // One sentence used to answer every refusal — 'Visual masks require Thick
    // + Fit' — while the corrective quietly also opened a Gallery. So the
    // message undersold what the button did, and when the field was the only
    // thing missing it named two things that were not the problem. The
    // resolver reports the first failing condition; the reader needs all of
    // them, since they are about to be set in one stroke.
    const settings = this.textMaterialSettings();
    const needsField = !this._fieldPresentsGallery();
    const missing = [];
    if (needsField) missing.push('a Gallery field');
    if (resolveChamberStreamFace(settings.face) !== 'thick') missing.push('the Thick face');
    if (resolveFontSize(settings.fontSize) !== 'fit') missing.push('the Fit size');
    // Only a field that CANNOT hold imagery is named as being set aside. A
    // Gallery already behind the reading is kept: it is the thing the mask is
    // about to be painted from, and discarding it to "fix" a face would throw
    // away the works the reader chose.
    const displaced = needsField
      ? [...this.selection.enabled].map(id => leafById(id)?.label).filter(Boolean)
      : [];
    const list = missing.length > 1
      ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`
      : (missing[0] || 'more surface');

    this.openDialog({
      title: `A mask needs ${list}.`,
      body: displaced.length
        ? `${displaced.join(' and ')} holds no imagery behind the reading, so it will be set aside `
          + 'for a Gallery. Bold, chamber-filling words provide the surface the imagery is painted on.'
        : 'Bold, chamber-filling words provide the surface, and a Gallery is what is painted through them.',
      primaryLabel: missing.length > 1 ? 'Set them' : 'Set it',
      primaryAction: 'use-thick-fit',
      confirm: () => {
        if (needsField) {
          // The field is the problem: clear it and open an empty Gallery.
          this.selection.enabled = new Set();
          this.selection.emptyKind = 'held-empty';
          this.selection.config = { ...this.selection.config, interlocution: {} };
        } else {
          // The field is already a Gallery — keep the works that are in it.
          this.selection.emptyKind = this.selection.enabled.size ? 'leaves' : 'held-empty';
        }
        this.requestTextMaterialTransaction({
          face: 'thick',
          fontSize: 'fit',
          wordFill,
          temporal: { chunkMode: 'word', recitation: false }
        });
        this.closeDialog();
      }
    }, returnFocus);
  },

  confirmMaskInvalidation({ face, fontSize, returnFocus }) {
    this.openDialog({
      title: 'This change cannot keep the current visual mask. Continue with Accent ink?',
      body: '',
      primaryLabel: 'Continue with Accent',
      primaryAction: 'dialog-confirm',
      confirm: () => {
        this.requestTextMaterialTransaction({
          face,
          fontSize,
          wordFill: { mode: 'accent', border: normalizeWordFill(this.selection.wordFill).border }
        });
        this.closeDialog();
      }
    }, returnFocus);
  },

  setFace(value, returnFocus) {
    if (resolveChamberStreamFace(value) !== value) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    if (this.hasActiveMask() && value !== settings.face) {
      return this.confirmMaskInvalidation({ face: value, fontSize: settings.fontSize, returnFocus });
    }
    this.writeSetting('chamberFace', value);
    this.render();
  },

  setSize(value, returnFocus) {
    const persist = persistFontSize(value);
    if (!persist) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    if (this.hasActiveMask() && persist !== settings.fontSize) {
      return this.confirmMaskInvalidation({ face: settings.face, fontSize: persist, returnFocus });
    }
    if (persist === 'fit' && this.locked) return;
    if (persist === 'fit') {
      const gallery = this._fieldPresentsGallery();
      // FIT USED TO TAKE THE FIELD WITHOUT ASKING. Choosing Fit while a Focal
      // was held cleared `enabled` outright — the Chapel rose a reader had
      // chosen simply vanished, replaced by an empty Gallery, with no dialog
      // and no way to know it had happened. Fit does need a Gallery, so the
      // conflict is real; what was missing was the asking. This panel already
      // knows how to ask — confirmMaskInvalidation does it in the other
      // direction — so the same courtesy applies here.
      if (!gallery && this.selection.enabled.size > 0) {
        return this.confirmFieldReplacement({ fontSize: persist, settings, returnFocus });
      }
      if (!gallery) this.selection.enabled = new Set();
      this.selection.emptyKind = gallery
        ? (this.selection.enabled.size ? 'leaves' : 'held-empty')
        : 'held-empty';
      if (!gallery) this.selection.config = { ...this.selection.config, interlocution: {} };
      this.requestTextMaterialTransaction({
        face: settings.face,
        fontSize: persist,
        wordFill: this.selection.wordFill,
        temporal: { chunkMode: 'word', recitation: false },
        settings: { chamberFace: settings.face, fontSize: persist, chamberMask: false }
      });
    } else {
      this.writeSetting('fontSize', persist);
    }
    this.render();
  },

  fitHoldsTheWord() {
    return resolveFontSize(this.textMaterialSettings().fontSize) === 'fit';
  },

  setWordFill(value, returnFocus) {
    if (this.locked) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    let wordFill = null;
    // The edge survives the ink: it is the Fit word's, not the fill's.
    const keptBorder = normalizeWordFill(this.selection.wordFill).border || 'cream';
    if (value === 'accent') {
      wordFill = wordFillValue(this.selection.wordFill) === 'accent'
        ? { mode: 'plain', border: keptBorder }
        : { mode: 'accent', border: keptBorder };
      this.inkFocus = null;
    } else if (value === 'same') {
      wordFill = { mode: 'same', border: keptBorder };
      this.inkFocus = null;
    } else if (value.startsWith('procedural:')) {
      const engineId = value.slice('procedural:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'procedural', procedural: [engineId], sourced: [],
        border: keptBorder
      };
      this.inkFocus = engineId;
    } else if (value.startsWith('sourced:')) {
      const sourceId = value.slice('sourced:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'collections', procedural: [], sourced: [sourceId],
        border: keptBorder
      };
      this.inkFocus = null;
    } else return;

    if (wordFill.mode === 'accent' || wordFill.mode === 'plain') {
      this.requestTextMaterialTransaction({ ...settings, wordFill });
    } else if (!this.textMaterialCapability(wordFill, settings).available) {
      this.explainBlockedMask(wordFill, returnFocus);
      return;
    } else {
      this.selection.wordFill = normalizeWordFill(wordFill);
      this.emit();
    }
    this.render();
  },

  setWordFillBorder(border, returnFocus) {
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    if (!this.fitHoldsTheWord() || !['off', 'cream', 'accent'].includes(border)) return;
    this.selection.wordFill = normalizeWordFill({ ...this.selection.wordFill, border });
    this.emit();
    this.render();
  },

  toggleInkBranch() {
    this._inkBranchOpen = this._inkBranchOpen === false;
    this.render();
  },

  setLivingText(enabled) {
    if (this.locked || this.programInfo) return;
    this.selection.livingText = {
      ...this.selection.livingText,
      enabled: enabled === true
    };
    this.emit();
    // Its siblings render; this one did not, and nothing showed it while the
    // native checkbox WAS the picture. Now the lit state is the row's, so a
    // missing redraw leaves the switch saying the opposite of the setting.
    this.render();
  },

  setCadence(value) {
    if (this.locked || this.programInfo) return;
    this.selection.galleryCadence = normalizeGalleryCadence(value);
    this.emit();
    this.render();
  },

  renderTextEntry(id) {
    const active = ['face', 'size', 'ink'].includes(id) ? id : 'face';
    return `<div class="vnav-entry-head"><span class="vnav-glyph">${glyphFor({ id: 'ink' })}</span>
      <div><h3>Type</h3><p class="vnav-kind">Text</p></div></div>
      ${this._renderSpecimen()}
      <div class="vnav-type-sections" data-active-section="${escapeHtml(active)}">
        ${this._faceSection(active === 'face')}
        ${this._sizeSection(active === 'size')}
        ${this._inkSection(active === 'ink')}
      </div>`;
  },

  _faceSection(isActive) {
    const selected = this.textMaterialSettings().face;
      // A FACE IS A SHAPE, AND A SHAPE SHOULD BE SHOWN. Four words set in one
      // another's typeface told a reader nothing about the choice they were
      // making; the difference between these four IS the letterform. Each
      // chip now wears its own face and a sample line carries the chosen one
      // at reading scale. The family is never named — that is a CSS matter,
      // and Chamber.settings-door.test.js forbids leaking it into the chrome.
      return this._section('Face', 'The letters, not the room.', isActive,
        `<div class="vnav-control-group">${bench('Face',
          CHAMBER_STREAM_FACES.map(item => ({
            id: item.id, label: item.id === 'thick' ? `${item.label} ★` : item.label,
            on: item.id === selected,
            readOnly: Boolean(this.programInfo), special: item.id === 'thick',
            attr: `data-chamber-face="${escapeHtml(item.id)}" data-face-sample="${escapeHtml(item.id)}"`
              + `${item.id === 'thick' ? ' aria-describedby="vnav-thick-explanation"' : ''}`
          })), 'vnav-face-grid')}
        </div>
        <p id="vnav-thick-explanation" class="vnav-control-explanation">Thick
          is the mask-ready face — the other three cannot carry a Visual mask.</p>`);
  },

  _sizeSection(isActive) {
    const selected = this.textMaterialSettings().fontSize;
      // A SCALE AND A MODE ARE NOT FOUR SIZES. S, M and L are three points on
      // one continuum; Fit is a different reading — it scales each word to
      // fill the chamber, steps one word at a time, and stands recitation and
      // phrase chunking aside. Offered as a fourth chip it invited the casual,
      // reversible try that a larger size deserves and it does not. Its cost
      // is also stated here rather than after the fact: the pane used to read
      // 'Choose the scale of the reading' until Fit was chosen, and only then
      // explain what Fit had already done.
      const chips = FONT_SIZE_CHIPS.filter(item => item.fontSize !== 'fit');
      const fit = FONT_SIZE_CHIPS.find(item => item.fontSize === 'fit');
      const scale = bench('Scale', chips.map(item => ({
        id: item.id, label: item.label, on: item.fontSize === selected,
        readOnly: Boolean(this.programInfo),
        attr: `data-font-size="${escapeHtml(item.id)}"`
      })));
      const mode = fit ? bench('Or read one word at a time', [{
        id: fit.id, label: 'Fit', on: selected === 'fit',
        readOnly: Boolean(this.programInfo), special: true,
        attr: `data-font-size="${escapeHtml(fit.id)}" aria-describedby="vnav-fit-consequence"`
      }], 'vnav-mode-bench') : '';
      // Controls and prose were sharing one undivided field, so a sentence
      // about Fit sat at the same rank as the buttons that set it. The
      // controls take a surface; the explanation stands outside it.
      // A SCALE SHOULD BE SEEN AS A SCALE. S, M and L differ by ratios the
      // Chamber actually uses — 0.82, 1, 1.18 — and were shown as three
      // identical letters. The sample carries the real ratio, read from the
      // same function the reading reads, so the preview cannot drift from it.
      //
      // Fit is not a fourth ratio. It fills the chamber with ONE word, so the
      // sample shows one word where the scale shows a phrase: the preview
      // teaches the difference the row could only assert.
      const isFit = resolveFontSize(selected) === 'fit';
      // THE BORDER IS A PROPERTY OF THE FIT WORD, SO IT LIVES WHERE FIT IS
      // CHOSEN. It sat at the foot of Ink, under the generated fields and the
      // museum pools, as though it were an attribute of the imagery. It is
      // not: Chamber.applyChamberMask is the only reader of it, and the only
      // thing it sets is --fit-border-color on the masked word.
      //
      // And the panel had the surface for it already. A control group holding
      // three small chips and a Fit chip left most of its width empty while
      // the sentence explaining Fit's cost stood outside, beneath it. The
      // explanation moves in beside the control it explains, which fills the
      // space and puts the consequence next to the button that causes it.
      return this._section('Size', selected === 'fit' ? SIZE_HINT_FIT : 'Choose the scale of the reading.', isActive,
        `<div class="vnav-control-group vnav-size-group">
          <div class="vnav-size-controls">${scale}${mode}${this._borderBench()}</div>
          <div class="vnav-size-note">
            <span class="vnav-bench-label">${isFit ? 'What Fit does' : 'What Fit would do'}</span>
            <p id="vnav-fit-consequence" class="vnav-fit-consequence">Fit scales each
              Word to fill the chamber and paints the gallery through the letters. Words step one at a
              time; Recitation and phrase chunking stand aside.</p>
          </div>
        </div>`);
  },

  _borderBench() {
    if (!this.fitHoldsTheWord()) return '';
    const border = normalizeWordFill(this.selection.wordFill).border;
    const shared = { disabled: Boolean(this.locked), readOnly: Boolean(this.programInfo) };
    return bench('Border of the word', [
      { id: 'off', label: 'Off', on: border === 'off', ...shared, attr: 'data-word-fill-border="off"' },
      { id: 'cream', label: 'Cream', on: border === 'cream', ...shared, attr: 'data-word-fill-border="cream"' },
      { id: 'accent', label: 'Accent', on: border === 'accent', ...shared, attr: 'data-word-fill-border="accent"' }
    ], 'is-property vnav-border-bench');
  },

  _inkSection(isActive) {
    const value = wordFillValue(this.selection.wordFill);
    const settings = this.textMaterialSettings();
    const fieldLocked = Boolean(this.locked);
    const programLocked = Boolean(this.programInfo);
    const capability = this.textMaterialCapability({ mode: 'same' }, settings);
    const maskAvailable = capability.available;
    // Four causes, four sentences. The panel used to answer every one of them
    // with 'requires Thick + Fit', which is false whenever the cause is the
    // field: a reader holding a Focal was told to change a face and a size
    // that would not have helped.
    const maskReason = maskAvailable ? null : MASK_REASON[capability.reason];
    const engines = WORD_FILL_PROCEDURAL_PATTERNS.map(item => ({
      id: item.id, label: item.name, on: value === `procedural:${item.id}`,
      disabled: fieldLocked,
      readOnly: programLocked,
      blocked: !maskAvailable && !programLocked,
      reason: !maskAvailable && !programLocked ? maskReason : null,
      attr: `data-word-fill="procedural:${escapeHtml(item.id)}"`
    }));
    const poolBenches = inkPoolFamilies().map(family => bench(family.label,
      family.options.map(item => ({
        id: item.id, label: item.label, on: value === `sourced:${item.id}`,
        disabled: fieldLocked,
        readOnly: programLocked,
        blocked: !maskAvailable && !programLocked,
        reason: !maskAvailable && !programLocked ? maskReason : null,
        attr: `data-word-fill="sourced:${escapeHtml(item.id)}"`
      }))
    )).join('');
    const styles = this.inkFocus ? this.renderStyleBenches(this.inkFocus) : '';

    // ONE QUESTION, NOT THREE HEADINGS.
    //
    // Ink, Engines and Pools were drawn as three groups and were one: every
    // chip in all of them writes `data-word-fill`, and wordFillValue collapses
    // them to a single value. So Accent, Same as the Field, Klee Lines and Old
    // Masters were mutually exclusive answers to one question laid out as
    // twenty peers, and nothing said that choosing Landscapes silently
    // un-chose Same as the Field. The captions implied accumulation where the
    // mechanism is replacement.
    //
    // The third answer is a DISCLOSURE, not a value. Opening it must not
    // change the reading — a reader browsing what is available has not yet
    // chosen anything — so it carries `data-ink-branch`, never
    // `data-word-fill`.
    //
    // It stands OPEN by default. The fault here was never that too much was
    // on screen; it was that what was on screen claimed a rank it did not
    // hold. Nesting fixes the rank. Hiding would have bought compactness by
    // spending discoverability, and every engine and pool that was reachable
    // before is still reachable at a glance.
    const chosenOwn = value.startsWith('procedural:') || value.startsWith('sourced:');
    const ownOpen = chosenOwn || this._inkBranchOpen !== false;
    const answers = bench('What paints the letters', [
      { id: 'accent', label: 'Accent', on: value === 'accent', disabled: fieldLocked, readOnly: programLocked, attr: 'data-word-fill="accent"' },
      { id: 'same', label: 'Same as the Field', on: value === 'same', disabled: fieldLocked, readOnly: programLocked, blocked: !maskAvailable && !programLocked, reason: !maskAvailable && !programLocked ? maskReason : null, attr: 'data-word-fill="same"' },
      {
        id: 'own', label: `Something of its own ${ownOpen ? '▾' : '▸'}`, on: chosenOwn,
        disabled: fieldLocked,
        attr: `data-ink-branch="own" aria-expanded="${ownOpen}" aria-controls="vnav-ink-own"`
      }
    ], 'vnav-ink-answers');

    return this._section('Ink', 'Paint the gallery through the letters.', isActive, `
      ${answers}
      ${ownOpen ? `<div class="vnav-ink-own" id="vnav-ink-own">
        <span class="vnav-ink-own-caption">Something of its own</span>
        ${bench('A generated field', engines)}
        ${poolBenches}
      </div>` : ''}
      ${styles}`);
  },

  renderDialog() {
    if (!this.dialog) return '';
    return `<div class="vnav-dialog-backdrop"><section class="vnav-dialog" role="dialog" aria-modal="true"
      aria-labelledby="vnav-dialog-title" tabindex="-1">
      <h3 id="vnav-dialog-title">${escapeHtml(this.dialog.title)}</h3>
      ${this.dialog.body ? `<p>${escapeHtml(this.dialog.body)}</p>` : ''}
      <div class="vnav-dialog-actions">
        <button type="button" data-action="dialog-cancel">Cancel</button>
        <button type="button" class="is-special" data-dialog-primary data-action="${escapeHtml(this.dialog.primaryAction || 'dialog-primary')}">${escapeHtml(this.dialog.primaryLabel)}</button>
      </div>
    </section></div>`;
  },

  _section(title, desc, isActive, body) {
    return `<section class="vnav-type-section${isActive ? ' is-active' : ''}"
      data-section="${escapeHtml(title.toLowerCase())}">
      <h4 class="vnav-section-title">${escapeHtml(title)}</h4>
      <p class="vnav-desc">${escapeHtml(desc)}</p>${body}
    </section>`;
  },

  _renderSpecimen() {
    const { face, fontSize } = this.textMaterialSettings();
    const size = resolveFontSize(fontSize);
    const isFit = size === 'fit';
    const masked = this.hasActiveMask();
    const ink = masked ? this._specimenInkUrl() : null;
    // THE SPECIMEN WEARS EVERY ANSWER, NOT ONLY THE PICTURESQUE ONE.
    //
    // It carried imagery through the letters and nothing else, so a reader
    // choosing Accent saw the sample unchanged and a reader setting a border
    // saw no edge — two of the three things this pane decides were invisible
    // in the one place built to show them. The accent is a fill like any
    // other, and the border is drawn the way the Chamber draws it, on the one
    // condition under which the Chamber draws it at all.
    const fill = wordFillValue(this.selection.wordFill);
    const border = isFit ? normalizeWordFill(this.selection.wordFill).border : 'off';
    const edge = border === 'cream' ? 'var(--color-light)'
      : border === 'accent' ? 'var(--color-accent)' : null;
    // A SMALLER SURFACE, NOT A DIFFERENT EFFECT.
    //
    // The Chamber paints a Fit word's ink over a ground plate that sits
    // INSIDE the glyph, behind the engine — mask-ground.js declares
    // Attractor, Klee, Turrell and Harmonograph `dark` so their filaments
    // read against Dark Slate rather than against whatever is behind the
    // reading. The specimen had no plate, so the Attractor still (a thin
    // bright filament on near-black) was clipped to 26px letters over a
    // near-black panel and vanished. A reader inspecting it would conclude
    // the effect makes the word almost invisible. It does not.
    //
    // The ground is not chosen here. It is asked of the same function the
    // runtime asks, so the miniature and the Chamber cannot disagree.
    // Gated on the MASK, not on whether the still has arrived. The Chamber
    // sets its plate in applyChamberMask, so the letters have a backing while
    // the imagery is still loading; a specimen that waited for the picture
    // would flash the unbacked state the Chamber never shows.
    const ground = masked ? this._specimenGround() : null;
    const label = isFit
      ? 'One Word, filling the chamber'
      : 'The reading, as it will appear';
    const style = [
      `--preview-intent:${threeStepIntent(fontSize)}`,
      ink ? `--specimen-ink:url('${ink}')` : '',
      edge ? `--specimen-edge:${edge}` : ''
    ].filter(Boolean).join(';');
    return `<figure class="vnav-preview-type vnav-specimen${ink ? ' has-ink' : ''}"
      data-face-sample="${escapeHtml(face)}"
      data-size-sample="${escapeHtml(size)}"
      ${fill === 'accent' ? 'data-ink-sample="accent"' : ''}
      ${edge ? 'data-edge-sample="on"' : ''}
      ${ground ? `data-specimen-ground="${escapeHtml(ground)}"` : ''}
      style="${style}">
      <span class="vnav-preview-label">${escapeHtml(label)}</span>
      <p class="vnav-preview-sample">${isFit ? 'Light' : 'Light enters form'}</p>
    </figure>`;
  },

  /**
   * The plate the Chamber would put behind this ink, from the Chamber's own
   * rule. `roomOpaque` is false here for the same reason it is in the
   * reading: a transparent fill over a room that is not opaque still needs a
   * ground, and combine() is what decides that — not this panel.
   */
  _specimenGround() {
    const patch = configPatch(this.selection);
    const inter = patch.interlocution || {};
    return maskGroundFromConfig({
      procedural: inter.procedural || [],
      sourced: inter.sourced || [],
      wordFill: this.selection.wordFill
    });
  },

  _specimenInkUrl() {
    const value = wordFillValue(this.selection.wordFill);
    const key = value.startsWith('procedural:') ? value.slice('procedural:'.length)
      : value.startsWith('sourced:') ? value.slice('sourced:'.length)
        : null;
    if (!key) return null;
    const url = this._previewCache?.get(key);
    return url ? safeUrl(url) : null;
  },
};
