/**
 * Admit — a reader's own file, shown as the parts it will become.
 *
 * The physics live in core/partition.js and none of them are repeated here.
 * This surface draws blocks it was handed and gives back the offset it was
 * given; every rule about where a joint may live is one file away, because a
 * view that computes its own offsets is a second copy of the physics and the
 * second copy is the one that ends up wrong.
 *
 * TAPS ARE SUFFICIENT. Place a joint by tapping a rule inside a part; join two
 * parts by tapping the seam between them. Dragging a seam slides it, which is
 * faster and is never the only way to reach a result — a phone with no hover
 * and no precise pointer can do everything this room does.
 *
 * TWO EXITS. "Add to Library" admits the work so the Scriptorium can compose
 * from it and point at `local-…#4`. "Read it now" is the door that existed
 * before this room did, unchanged: straight to the Chamber, nothing stored.
 * The strengthening brief deletes that door (§9.1); keeping it costs one
 * screen and loses nothing, and losing nothing was the point.
 */

import { escapeHtml } from '../core/sanitize.js';
import { draftLocalWork, validateLocalWork } from '../core/local-works.js';
import {
  describeMagnets,
  joinAt,
  layoutPartition,
  nearestSnap,
  partitionByMagnet,
  placeJoint,
  relabel,
  slideJoint
} from '../core/partition.js';
import './Admit.css';

/** A magnet worth a chip: one cut is a tap, and a hundred is the offer. */
const CHIP_MINIMUM = 2;

const MAGNET_WORDS = {
  title: ['title', 'titles'],
  date: ['date', 'dates'],
  paragraph: ['paragraph break', 'paragraph breaks'],
  sentence: ['sentence', 'sentences']
};

export class Admit {
  constructor(options = {}) {
    this.onAdmit = options.onAdmit || (() => {});
    this.onReadNow = options.onReadNow || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.rungWords = options.rungWords;
    // The direct exit is the same act in both rooms — take the text and skip
    // the shelf — but it is not the same sentence. "Read it now" in a room
    // where nothing is read would describe a door that does not exist.
    this.directLabel = options.directLabel || 'Read it now';

    // A work already on the shelf reopens with the joints its reader placed.
    // Re-drafting it would silently throw those away and hand back the
    // machine's first guess, which is the one thing the reader already
    // corrected.
    this.record = options.record ? validateLocalWork(options.record) : draftLocalWork({
      text: options.text || '',
      sourceName: options.sourceName || '',
      title: options.title || ''
    });
    this.element = null;
    this.drag = null;
    this._destroyed = false;

    this.create();
  }

  create() {
    this.element = document.createElement('div');
    this.element.className = 'admit-overlay';
    this.element.innerHTML = this.render();
    document.body.appendChild(this.element);
    this.attachEvents();
  }

  /** Every change is the same motion: a new record, then redraw the parts. */
  apply(record) {
    if (!record || record === this.record) return;
    this.record = record;
    const body = this.element?.querySelector('.admit-body');
    const summary = this.element?.querySelector('.admit-summary');
    if (body) body.innerHTML = this.renderParts();
    if (summary) summary.textContent = this.summary();
  }

  summary() {
    const parts = this.record.labels.length;
    return `${parts} ${parts === 1 ? 'part' : 'parts'}`;
  }

  render() {
    const title = escapeHtml(this.record.title);
    return `
      <div class="admit-room" role="dialog" aria-label="Add your text to the Library">
        <header class="admit-header">
          <input class="admit-title" id="admit-title" value="${title}"
                 aria-label="Title" maxlength="120" />
          <p class="admit-summary text-fog">${this.summary()}</p>
          ${this.renderChips()}
        </header>
        <div class="admit-body">${this.renderParts()}</div>
        <footer class="admit-footer">
          <button class="admit-action" data-action="cancel">Cancel</button>
          <button class="admit-action" data-action="read">${escapeHtml(this.directLabel)}</button>
          <button class="admit-action admit-action-primary" data-action="admit">
            Add to Library
          </button>
        </footer>
      </div>
    `;
  }

  /**
   * The offer, counted before it is accepted.
   *
   * A book of poems has ninety-five titles in it and nobody is tapping
   * ninety-five rules. The count goes in the chip because a reader deciding
   * whether to accept a hundred cuts wants to know it is a hundred.
   */
  renderChips() {
    const counts = describeMagnets(this.record.text, { rungWords: this.rungWords });
    const chips = Object.entries(counts)
      .filter(([kind, count]) => count >= CHIP_MINIMUM && MAGNET_WORDS[kind])
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => {
        const [one, many] = MAGNET_WORDS[kind];
        return `<button class="admit-chip" data-magnet="${escapeHtml(kind)}">
            Cut at every ${escapeHtml(count === 1 ? one : many)}
            <span class="admit-chip-count">${count}</span>
          </button>`;
      });
    return chips.length ? `<div class="admit-chips">${chips.join('')}</div>` : '';
  }

  renderParts() {
    const parts = layoutPartition(this.record, { rungWords: this.rungWords });
    return parts.map((part, index) => `
      ${index === 0 ? '' : this.renderSeam(index)}
      <section class="admit-part" data-part="${index}">
        <div class="admit-part-head">
          <input class="admit-label" data-label="${index}"
                 value="${escapeHtml(part.label)}"
                 aria-label="Name of part ${part.ordinal}" maxlength="80" />
          <span class="admit-words text-fog">${part.words} words</span>
        </div>
        ${part.blocks.map(block => this.renderBlock(block)).join('')}
      </section>
    `).join('');
  }

  renderBlock(block) {
    const prose = block.paragraphs
      .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
    if (!block.snap) return `<div class="admit-block">${prose}</div>`;
    return `
      <div class="admit-block" data-offset="${block.offset}">
        <button class="admit-rule" data-place="${block.offset}"
                aria-label="Divide here">
          <span class="admit-rule-mark">${escapeHtml(block.snap)}</span>
        </button>
        ${prose}
      </div>
    `;
  }

  /** A seam is a joint that exists: it can be joined away, or dragged. */
  renderSeam(jointIndex) {
    return `
      <div class="admit-seam" data-joint="${jointIndex}">
        <button class="admit-join" data-join="${jointIndex}"
                aria-label="Join these two parts">Join</button>
      </div>
    `;
  }

  attachEvents() {
    this.element.addEventListener('click', event => {
      const place = event.target.closest('[data-place]');
      if (place) return this.apply(placeJoint(this.record, Number(place.dataset.place)));

      const join = event.target.closest('[data-join]');
      if (join) return this.apply(joinAt(this.record, Number(join.dataset.join)));

      const magnet = event.target.closest('[data-magnet]');
      if (magnet) return this.apply(partitionByMagnet(this.record, magnet.dataset.magnet));

      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') this.close(() => this.onCancel());
      if (action === 'read') this.close(() => this.onReadNow(this.record.text, this.record.title));
      if (action === 'admit') this.close(() => this.onAdmit(this.record));
    });

    // A typed name is authorship, and the record must never overwrite one.
    this.element.addEventListener('change', event => {
      const label = event.target.closest('[data-label]');
      if (label) return this.apply(relabel(this.record, Number(label.dataset.label), label.value));
      if (event.target.id === 'admit-title') this.retitle(event.target.value);
    });

    this.element.addEventListener('pointerdown', event => this.beginDrag(event));
    this.element.addEventListener('pointermove', event => this.moveDrag(event));
    this.element.addEventListener('pointerup', event => this.endDrag(event));
    this.element.addEventListener('pointercancel', () => this.cancelDrag());
  }

  retitle(value) {
    const title = String(value ?? '').trim();
    if (!title) return;
    // The id is minted once, at the draft. Renaming a work in this room must
    // not re-mint it: an id that moves is an extent that stops resolving.
    this.record = { ...this.record, title };
  }

  beginDrag(event) {
    const seam = event.target.closest('.admit-seam');
    if (!seam || event.target.closest('[data-join]')) return;
    this.drag = { jointIndex: Number(seam.dataset.joint), seam };
    seam.classList.add('dragging');
    seam.setPointerCapture?.(event.pointerId);
  }

  /**
   * The nearest block edge under the finger, resolved through the snap table.
   *
   * Measuring the DOM is this room's job; deciding whether the result is a
   * legal joint is not. `nearestSnap` refuses anything that is not one, and
   * `slideJoint` refuses anything outside the two parts the seam divides —
   * so a wild drag lands nowhere rather than somewhere wrong.
   */
  moveDrag(event) {
    if (!this.drag) return;
    event.preventDefault();
    const blocks = [...this.element.querySelectorAll('.admit-block[data-offset]')];
    let best = null;
    for (const block of blocks) {
      const distance = Math.abs(block.getBoundingClientRect().top - event.clientY);
      if (!best || distance < best.distance) best = { block, distance };
    }
    this.drag.offset = best ? Number(best.block.dataset.offset) : null;
  }

  endDrag(event) {
    if (!this.drag) return;
    const { jointIndex, offset } = this.drag;
    this.drag.seam?.releasePointerCapture?.(event.pointerId);
    this.cancelDrag();
    if (offset == null) return;
    const snap = nearestSnap(this.record.text, offset, { rungWords: this.rungWords });
    if (snap) this.apply(slideJoint(this.record, jointIndex, snap.offset));
  }

  cancelDrag() {
    this.drag?.seam?.classList.remove('dragging');
    this.drag = null;
  }

  close(then) {
    if (this._destroyed) return;
    this._destroyed = true;
    this.element?.remove();
    this.element = null;
    then?.();
  }

  destroy() {
    this.close();
  }
}
