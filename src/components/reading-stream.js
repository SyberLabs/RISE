/**
 * A reading already under way, silent: the text arrives one unit at a time
 * (word, phrase, sentence or paragraph), compiled by the session compiler, so
 * Home shows the units the reading will have, each held as long as the reading
 * would hold it (its words, their length and punctuation, the pace curve). A
 * silence in the reading, such as a stanza break, lengthens the unit before it.
 * After the last unit the stream rests and reads again from the start. It
 * waits while the tab is hidden. Under reduced motion it shows the opening still.
 *
 * Decorative: the host is aria-hidden, and Home gives the opening as real text.
 */
import { compileSession } from '../core/session-compiler.js';
import './reading-stream.css';

const REST_MS = 2400;
const STILL_CHARS = 90;

const reducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ReadingStream {
  constructor(host, { onProgress }) {
    this.host = host;
    this.onProgress = onProgress;
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

  /**
   * Start (or restart) showing `text`. `curve` is the reading's pace curve
   * (flat when omitted). `verse` is the compiler's `verseLines`, named as
   * openingLines names it: a verse division read by phrase is read one line
   * at a time, as the Chamber reads it.
   */
  play(text, { chunkMode, wpm, curve, verse }) {
    this.stop();
    this.units = [];
    for (const atom of compileSession({ text, chunkMode, wpm, curve, verseLines: verse === true }).atoms) {
      if (atom.content) this.units.push({ text: atom.content, ms: atom.duration });
      else if (this.units.length) this.units.at(-1).ms += atom.duration;
    }
    this.host.dataset.chunkMode = chunkMode;
    if (reducedMotion()) {
      let opening = this.units[0].text;
      for (const { text: unit } of this.units.slice(1)) {
        if (opening.length + 1 + unit.length > STILL_CHARS) break;
        opening += ` ${unit}`;
      }
      this.show('', opening);
      this.onProgress(0);
      return;
    }
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
      this.show(this.units[index - 1]?.text || '', this.units[index].text);
      this.onProgress(index / this.units.length);
    } else {
      this.onProgress(1);
    }
    this.schedule();
  }

  schedule() {
    if (!this.running || this.timer || document.hidden) return;
    const ms = this.units[this.index]?.ms ?? REST_MS;
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
