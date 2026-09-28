/**
 * Passage direction for one reading: block records, admission, staging,
 * and the source-coordinate visual program the existing scheduler follows.
 *
 * Source preparation (segmentation, atom coordinates) happens once and
 * never re-chunks or retimes the reading. Direction is per block: local
 * direction always exists; a later Jev choice is staged for blocks the
 * reader has not entered yet. On first entry a block's treatment is frozen,
 * so a late response can never rewrite what was already experienced, and a
 * backward seek replays exactly what was shown.
 */

import { scoreChunk } from '../conductor.js';
import { alignSourceAtoms, normalizeQuote } from '../source-span.js';
import { segmentSource } from './segmentation.js';
import {
  compileTreatmentCue,
  isTreatmentChoice,
  localDirection
} from './treatments.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SHORT_BLOCK_WORDS = 25;

/**
 * The conductor's signal for one block. The lexicon is English, so text
 * that is not mostly Latin-letter words gets the low-confidence behaviour;
 * this never claims to understand a language it does not.
 */
export function blockSignal(text) {
  const tokens = String(text || '').match(/\S+/gu) || [];
  const words = tokens.map(token => token.replace(/[^\p{L}'’-]/gu, '')).filter(Boolean);
  const english = words.filter(word => /^[A-Za-z'’-]+$/u.test(word)).length;
  if (!words.length || english / words.length < 0.6) {
    return { valence: 0, arousal: 0.3, confidence: 0, supported: false };
  }
  const score = scoreChunk(text);
  if (!score) return { valence: 0, arousal: 0.3, confidence: 0, supported: true };
  return {
    valence: clamp(score.valence, -1, 1),
    arousal: clamp(score.arousal, 0, 1),
    confidence: clamp(score.hits / Math.max(3, tokens.length * 0.04), 0, 1),
    supported: true
  };
}

function fingerprint(text, edge) {
  const normalized = normalizeQuote(text);
  if (normalized.length <= 60) return normalized;
  const slice = edge === 'start' ? normalized.slice(0, 60) : normalized.slice(-60);
  const trimmed = edge === 'start' ? slice.replace(/\s+\S*$/u, '') : slice.replace(/^\S*\s+/u, '');
  return trimmed || slice;
}

function sameChoice(a, b) {
  return a?.treatmentId === b?.treatmentId && a?.intensityBand === b?.intensityBand;
}

export class PassageDirector {
  /**
   * @param {object} options
   * @param {{ id: string, text: string, chunkProfile?: string|null }[]} options.sources
   * @param {object[]} options.atoms session atoms (coordinates are stamped)
   * @param {(id: string) => object|null} options.flameRecipe preset lookup
   */
  constructor({ sources, atoms, flameRecipe }) {
    this.flameRecipe = typeof flameRecipe === 'function' ? flameRecipe : () => null;
    this.sources = [];
    this.blocks = [];
    const bySource = new Map();
    for (const atom of atoms) {
      if (!atom?.sourceId) continue;
      if (!bySource.has(atom.sourceId)) bySource.set(atom.sourceId, []);
      bySource.get(atom.sourceId).push(atom);
    }
    for (const source of sources) {
      const sourceAtoms = bySource.get(source.id) || [];
      if (!sourceAtoms.length || typeof source.text !== 'string') continue;
      // Stamp exact source coordinates; throws if the atoms do not align.
      if (!sourceAtoms.every(atom => Number.isInteger(atom.sourceCharacterStart))) {
        alignSourceAtoms(source.text, sourceAtoms, `$.sources[${source.id}]`, {
          chunkProfile: source.chunkProfile ?? null
        });
      }
      const segmentation = segmentSource(source.text);
      const entry = { id: source.id, text: source.text, segmentation, firstBlock: this.blocks.length };
      for (const block of segmentation.blocks) {
        const slice = source.text.slice(block.from, block.to);
        this.blocks.push({
          key: `pv-${this.sources.length}-${block.index}`,
          sourceId: source.id,
          sourceIndex: this.sources.length,
          index: block.index,
          from: block.from,
          to: block.to,
          words: block.words,
          quoteStart: fingerprint(slice, 'start') || 'x',
          quoteEnd: fingerprint(slice, 'end') || 'x',
          id: null,
          admitted: null,
          staged: null
        });
      }
      this.sources.push(entry);
    }
    this.sourceOrder = new Map(this.sources.map((source, index) => [source.id, index]));
    this.program = {
      coordinateSpace: 'source',
      segments: this.blocks.map(block => ({
        id: block.key,
        match: {
          sourceIds: [block.sourceId],
          fromCharacter: block.from,
          toCharacter: block.to,
          quoteStart: block.quoteStart,
          quoteEnd: block.quoteEnd
        },
        cue: { kind: 'still' }
      })),
      fallback: { kind: 'still' }
    };
  }

  get ready() {
    return this.blocks.length > 0;
  }

  /** Block index covering an atom's source position, or -1. */
  blockIndexForAtom(atom) {
    const at = atom?.sourceCharacterStart;
    const order = this.sourceOrder.get(atom?.sourceId);
    if (!Number.isInteger(at) || order === undefined) return -1;
    const source = this.sources[order];
    const first = source.firstBlock;
    const last = first + source.segmentation.blocks.length - 1;
    let low = first;
    let high = last;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const block = this.blocks[mid];
      if (at < block.from) high = mid - 1;
      else if (at >= block.to) low = mid + 1;
      else return mid;
    }
    // A zero-width pause at the very end belongs to the final block.
    return at >= this.blocks[last].to ? last : -1;
  }

  localChoice(index) {
    const block = this.blocks[index];
    const source = this.sources[block.sourceIndex];
    return localDirection(blockSignal(source.text.slice(block.from, block.to)));
  }

  _cueFor(choice) {
    return compileTreatmentCue(choice.treatmentId, choice.intensityBand,
      this.flameRecipe(choice.treatmentId));
  }

  /**
   * Freeze a block's treatment on first entry: staged Jev choice, else
   * local direction. Returns the admitted record.
   */
  admit(index) {
    const block = this.blocks[index];
    if (!block) return null;
    if (block.admitted) return block.admitted;
    const choice = block.staged || { ...this.localChoice(index), provenance: 'local' };
    block.admitted = Object.freeze({
      treatmentId: choice.treatmentId,
      intensityBand: choice.intensityBand,
      provenance: choice.provenance
    });
    block.staged = null;
    this.program.segments[index].cue = this._cueFor(block.admitted);
    return block.admitted;
  }

  /** Observe one atom; admits its block the first time it is entered. */
  observe(atom) {
    const index = this.blockIndexForAtom(atom);
    if (index < 0) return null;
    return { index, block: this.blocks[index], record: this.admit(index) };
  }

  /**
   * Stage choices for blocks that have not been entered. Admitted blocks
   * are never rewritten. Returns how many blocks were staged.
   */
  stage(choices, provenance = 'jev') {
    let staged = 0;
    for (const choice of choices || []) {
      const index = this.blocks.findIndex(block => block.id && block.id === choice.blockId);
      const block = this.blocks[index];
      if (!block || block.admitted || !isTreatmentChoice(choice.treatmentId, choice.intensityBand)) continue;
      block.staged = Object.freeze({
        treatmentId: choice.treatmentId, intensityBand: choice.intensityBand, provenance
      });
      staged += 1;
    }
    return staged;
  }

  /** Attach stable block ids computed during async source preparation. */
  identify(sourceId, preparedBlocks) {
    const source = this.sources.find(item => item.id === sourceId);
    if (!source) return false;
    for (const prepared of preparedBlocks) {
      const block = this.blocks[source.firstBlock + prepared.index];
      if (block && block.from === prepared.from && block.to === prepared.to) block.id = prepared.id;
    }
    return true;
  }

  /** Whether a block is short enough to hold the previous scene. */
  holdsPrevious(index) {
    return (this.blocks[index]?.words ?? 0) < SHORT_BLOCK_WORDS;
  }

  /** Admitted records keyed by stable block id, for saving the reading. */
  admittedChoices() {
    return this.blocks.filter(block => block.admitted && block.id).map(block => ({
      blockId: block.id,
      sourceId: block.sourceId,
      from: block.from,
      to: block.to,
      quoteStart: block.quoteStart,
      quoteEnd: block.quoteEnd,
      treatmentId: block.admitted.treatmentId,
      intensityBand: block.admitted.intensityBand,
      provenance: block.admitted.provenance
    }));
  }

  /** Restore previously admitted choices as Saved (e.g. a reopened reading). */
  restore(choices) {
    let restored = 0;
    for (const choice of choices || []) {
      const block = this.blocks.find(item => item.id && item.id === choice.blockId);
      if (!block || block.admitted || !isTreatmentChoice(choice.treatmentId, choice.intensityBand)) continue;
      block.staged = Object.freeze({
        treatmentId: choice.treatmentId, intensityBand: choice.intensityBand, provenance: 'saved'
      });
      restored += 1;
    }
    return restored;
  }

  /** The record the next admission would use (for diagnostics and tests). */
  pendingChoice(index) {
    const block = this.blocks[index];
    if (!block) return null;
    return block.admitted || block.staged || { ...this.localChoice(index), provenance: 'local' };
  }

  /**
   * A program for Page mode: every block carries the treatment it has or
   * would receive (admitted, staged, or local), sampled without playing.
   */
  pageProgram() {
    return {
      ...this.program,
      segments: this.program.segments.map((segment, index) => ({
        ...segment,
        cue: this._cueFor(this.pendingChoice(index))
      }))
    };
  }

  sameAsPrevious(index) {
    return index > 0 && sameChoice(this.blocks[index].admitted, this.blocks[index - 1].admitted);
  }
}
