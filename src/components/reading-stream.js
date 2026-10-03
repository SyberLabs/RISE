/**
 * A reading already under way, silent: the text arrives one unit at a time
 * (word, phrase, sentence or paragraph), cut by the Chamber's own chunker so
 * Home shows the units the reading will have. Each unit holds for its words at
 * the reading's pace, never under 300 ms; after the last the stream rests and
 * reads again from the start. It waits while the tab is hidden. Under reduced
 * motion it shows the opening still.
 *
 * Decorative: the host is aria-hidden, and Home gives the opening as real text.
 */
import { chunkText, countWords } from '../core/chunker.js';
import './reading-stream.css';

const MIN_UNIT_MS = 300;
const REST_MS = 2400;
const STILL_CHARS = 90;

const reducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ReadingStream {
  constructor(host, { onProgress } = {}) {
    this.host = host;
    this.onProgress = onProgress || (() => {});
    this.units = [];
    this.index = 0;
    this.timer = 0;
    this.running = false;
    host.classList.add('reading-stream');
    host.setAttribute('aria-hidden', 'true');
    this.onVisibility = () => {
      if (document.hidden) this.clearTimer();
      else this.schedule();
    };
  }

  /** Start (or restart) showing `text`. */
  play(text, { chunkMode, wpm }) {
    this.stop();
    this.units = chunkText(text, { mode: chunkMode, wpm })
      .map(atom => atom.content)
      .filter(Boolean);
    this.wpm = wpm;
    this.host.dataset.chunkMode = chunkMode;
    if (reducedMotion()) {
      let opening = this.units[0] || '';
      for (const unit of this.units.slice(1)) {
        if (opening.length + 1 + unit.length > STILL_CHARS) break;
        opening += ` ${unit}`;
      }
      this.show('', opening);
      this.onProgress(0);
      return;
    }
    if (!this.units.length) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.step(0);
  }

  /** Cancel the timers; what is shown stays. */
  stop() {
    this.running = false;
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  destroy() {
    this.stop();
    this.host.replaceChildren();
  }

  /** Index units.length is the rest after the last unit. */
  step(index) {
    this.index = index;
    if (index < this.units.length) {
      this.show(this.units[index - 1] || '', this.units[index]);
      this.onProgress(index / this.units.length);
    } else {
      this.onProgress(1);
    }
    this.schedule();
  }

  schedule() {
    if (!this.running || this.timer || document.hidden) return;
    const unit = this.units[this.index];
    const ms = unit === undefined ? REST_MS : Math.max(MIN_UNIT_MS, countWords(unit) * 60_000 / this.wpm);
    this.timer = setTimeout(() => {
      this.timer = 0;
      this.step((this.index + 1) % (this.units.length + 1));
    }, ms);
  }

  clearTimer() {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  /** New elements each step, so the entrance animation runs again. */
  show(previous, current) {
    const line = (className, text) => {
      const p = document.createElement('p');
      p.className = className;
      p.textContent = text;
      return p;
    };
    this.host.replaceChildren(line('reading-stream-previous', previous), line('reading-stream-current', current));
  }
}
